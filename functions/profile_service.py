from functools import lru_cache
import json
from pathlib import Path
import threading
import h5py
import numpy as np
from remote_profile import RemoteFile
from extract_profiles import value
from build_demo import height_profile
from atmospheric_layers import diagnose
from ray_model import effective_speed, trace

ROOT=Path(__file__).resolve().parent.parent
LOCK=threading.Lock()
FIELDS=None

def load_fields():
    global FIELDS
    if FIELDS is not None:return FIELDS
    bundle=ROOT/'data/hosted-fields.npz'
    if bundle.exists():
        import hashlib
        manifest=json.loads(bundle.with_suffix('.json').read_text(encoding='utf-8'))
        if hashlib.sha256(bundle.read_bytes()).hexdigest()!=manifest['sha256']:
            raise ValueError('Atmospheric bundle checksum mismatch.')
        with np.load(bundle,allow_pickle=False) as archive:
            values={key:archive[key] for key in ['lat','lon','T','QV','PS','U','V']}
        for key,array in values.items():
            if list(array.shape)!=manifest['shapes'][key] or not np.isfinite(array).all():
                raise ValueError('Invalid atmospheric bundle.')
        FIELDS=values
        return values
    FIELDS=load_source_fields()
    return FIELDS

def load_source_fields():

    values={}
    for kind,size in [('I3',19224099),('A3dyn',28185683)]:
        name=f'MERRA2.20250101.{kind}.4x5.nc4'
        with RemoteFile(name,size) as remote, h5py.File(remote,'r') as f:
            lat=f['lat'][:];lon=f['lon'][:]
            if 'lat' in values:
                assert np.array_equal(lat,values['lat']) and np.array_equal(lon,values['lon'])
            values['lat']=lat;values['lon']=lon
            assert np.array_equal(f['lev'][:],np.arange(1,73))
            assert f['time'][:2].tolist()==([0,180] if kind=='I3' else [90,270])
            for key in (['T','QV','PS'] if kind=='I3' else ['U','V']):
                times=[0,1] if kind=='I3' else [0]
                values[key]=np.mean([value(f[key],(t,)) for t in times],axis=0)
    return values

@lru_cache(maxsize=32)
def build_cell(y,x):
    f=load_fields();lat=float(f['lat'][y]);lon=float(f['lon'][x])
    t,q,u,v=[f[k][:,y,x] for k in ['T','QV','U','V']];ps=float(f['PS'][y,x])
    if not (20000<ps<120000 and np.all((t>140)&(t<350))):
        raise ValueError('This atmospheric cell has invalid values.')
    grid=json.loads((ROOT/'data/vertical-grid.json').read_text(encoding='utf-8'))
    z,pressure=height_profile(t,q,ps,grid);valid=z<=60000
    z,t,u,v,pressure=[a[valid] for a in [z,t,u,v,pressure]]
    rays=[]
    for bearing in [90,270,0,180]:
        speed=effective_speed(t,u,v,bearing)
        for angle in [5,10,15,20,25,30]:rays.append({**trace(z,speed,angle),'bearing_deg':bearing})
    return dict(id=f'cell_{y}_{x}',label=f'MERRA-2 cell {lat:g}, {lon:g}',
                latitude=lat,longitude=lon,grid_indices={'lat':y,'lon':x},
                height_m=z.tolist(),pressure_hpa=pressure.tolist(),temperature_k=t.tolist(),
                u_ms=u.tolist(),v_ms=v.tolist(),rays=rays,thermal_layers=diagnose(z,t))

def select_profile(latitude,longitude):
    if not np.isfinite([latitude,longitude]).all() or not -90<=latitude<=90 or not -180<=longitude<=180:
        raise ValueError('Coordinates outside the supported range.')
    with LOCK:
        f=load_fields();y=int(np.argmin(abs(f['lat']-latitude)))
        x=int(np.argmin(abs((f['lon']-longitude+180)%360-180)))
        return build_cell(y,x)
