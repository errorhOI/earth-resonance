"""Extract real grid-cell profiles; download only required HDF5 ranges."""
import hashlib
import json
from pathlib import Path
import h5py
import numpy as np
from remote_profile import RemoteFile, ROOT, BASE

LOCATIONS=[('atlantic','North Atlantic',46.,-30.),
           ('malaysia','Near Malaysia (coarse grid)',2.,100.),
           ('pacific','South Pacific',-22.,-140.),
           ('north_pacific','North Pacific',38.,-160.),
           ('equatorial_pacific','Equatorial Pacific',2.,-110.),
           ('japan','Japan region',38.,140.),
           ('india','Central India',22.,80.),
           ('sahara','Central Sahara',22.,15.),
           ('mediterranean','Mediterranean',38.,15.),
           ('greenland','Greenland region',66.,-40.),
           ('southern_ocean','Southern Ocean',-54.,30.),
           ('southern_africa','Southern Africa',-30.,25.),
           ('australia','Central Australia',-26.,135.),
           ('amazon','Amazon region',-6.,-60.)]


def value(dataset,index):
    raw=np.asarray(dataset[index],dtype=float)
    fill=dataset.attrs.get('_FillValue')
    if fill is not None and np.any(raw==fill):raise ValueError('Missing data in chosen profile')
    raw=raw*float(np.asarray(dataset.attrs.get('scale_factor',1)).item())+float(np.asarray(dataset.attrs.get('add_offset',0)).item())
    if not np.isfinite(raw).all():raise ValueError('Invalid atmospheric data')
    return raw


def main():
    result={p[0]:dict(id=p[0],label=p[1],latitude=p[2],longitude=p[3]) for p in LOCATIONS}
    sources=[]
    for kind,size in [('I3',19224099),('A3dyn',28185683)]:
        name=f'MERRA2.20250101.{kind}.4x5.nc4'
        with RemoteFile(name,size) as remote:
            with h5py.File(remote,'r') as file:
                assert np.array_equal(file['lev'][:],np.arange(1,73))
                times=file['time'][:].tolist()
                fields={'T':[0,1],'QV':[0,1],'PS':[0,1]} if kind=='I3' else {'U':[0],'V':[0]}
                print('Time axis',kind,times,flush=True)
                assert times[:2]==([0,180] if kind=='I3' else [90,270])
                remote.prefetch([(file[k],ts) for k,ts in fields.items()])
                for id,label,lat,lon in LOCATIONS:
                    y=int(np.argmin(abs(file['lat'][:]-lat)));x=int(np.argmin(abs(file['lon'][:]-lon)))
                    assert float(file['lat'][y])==lat and float(file['lon'][x])==lon
                    result[id]['grid_indices']={'lat':y,'lon':x}
                    for key,ts in fields.items():
                        indices=[(t,slice(None),y,x) if file[key].ndim==4 else (t,y,x) for t in ts]
                        values=[value(file[key],index) for index in indices]
                        result[id][key]=np.mean(values,axis=0).tolist()
                        result[id][key+'_source_samples']=[v.tolist() for v in values]
                sources.append(dict(url=BASE+name,bytes=size,variables=list(fields),
                    selected_time_indices=fields,time_values_minutes=times,
                    time_units=str(file['time'].attrs['units']),
                    variable_units={k:str(file[k].attrs.get('units')) for k in fields}))
    for p in result.values():
        assert 20000<p['PS']<120000
        assert np.all((np.array(p['T'])>140)&(np.array(p['T'])<350))
        assert np.max(np.abs(p['U']))<200 and np.max(np.abs(p['V']))<200
        assert np.min(p['QV'])>=0 and np.max(p['QV'])<.1
    record=dict(status='real_data_extracted',dataset='NASA GMAO MERRA-2, regridded by GEOS-Chem',
        resolution='4 degrees latitude x 5 degrees longitude; 72 model layers',
        nominal_time='2025-01-01T01:30:00Z',
        time_method='T, QV and PS linearly interpolated halfway between 00:00 and 03:00 UTC instantaneous fields. U and V are 00:00-03:00 UTC means centered at 01:30. These are not simultaneous direct observations.',
        profiles=list(result.values()),sources=sources)
    path=ROOT/'profiles.json';path.write_text(json.dumps(record,indent=2),encoding='utf-8')
    blocks=[]
    for path in sorted((ROOT/'range-cache').rglob('*.bin')):
        blocks.append(dict(file=str(path.relative_to(ROOT)),bytes=path.stat().st_size,
            sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    (ROOT/'range-cache-manifest.json').write_text(json.dumps(blocks,indent=2),encoding='utf-8')
    print(f'Extracted {len(result)} real atmospheric profiles; cached bytes:',sum(x['bytes'] for x in blocks),flush=True)


if __name__=='__main__':main()
