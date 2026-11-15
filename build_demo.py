"""Build the offline data bundle and matched atmospheric-return audio examples."""
import hashlib
import base64
import json
from pathlib import Path
import shutil
import sys
import argparse
import numpy as np
import soundfile as sf
from ray_model import effective_speed, trace, verify
from atmospheric_layers import diagnose, METHOD

ROOT=Path(__file__).resolve().parent
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def height_profile(temperature, humidity, surface_pressure, grid):
    # Pressure edges from GEOS hybrid coefficients, bottom to top.
    edges=np.asarray(grid['_GEOS_72L_AP'])*100+np.asarray(grid['_GEOS_72L_BP'])*surface_pressure
    assert len(edges)==73 and np.all(edges>0) and np.all(np.diff(edges)<0)
    # Hydrostatic layer thickness using virtual temperature and constant g.
    virtual=temperature*(1+.6078*humidity)
    thickness=287.05*virtual/9.80665*np.log(edges[:-1]/edges[1:])
    heights=np.concatenate([[0.],np.cumsum(thickness)])
    centers=(heights[:-1]+heights[1:])/2
    return centers, np.sqrt(edges[:-1]*edges[1:])/100


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-only',action='store_true',help='Rebuild profiles/rays without touching saved audio')
    args=parser.parse_args()
    verify()
    raw_path=ROOT/'data/profiles.json'
    raw=json.loads(raw_path.read_text())
    assert raw['status']=='real_data_extracted'
    grid=json.loads((ROOT/'data/vertical-grid.json').read_text())
    dist=ROOT/'dist';(dist/'audio').mkdir(exist_ok=True)
    profiles=[]
    for p in raw['profiles']:
        t,q,u,v=[np.asarray(p[k],float) for k in ['T','QV','U','V']]
        assert all(a.shape==(72,) for a in [t,q,u,v])
        z,pressure=height_profile(t,q,p['PS'],grid)
        valid=z<=60000  # Explicitly restrict to the lower/middle atmosphere.
        z,t,u,v,pressure=[a[valid] for a in [z,t,u,v,pressure]]
        assert 50<z[0]<300 and 45000<z[-1]<=60000
        rays=[]
        for bearing in [90,270,0,180]:
            c=effective_speed(t,u,v,bearing)
            for angle in [5,10,15,20,25,30]:
                ray=trace(z,c,angle)
                ray['bearing_deg']=bearing
                rays.append(ray)
        profile=dict(id=p['id'],label=p['label'],latitude=p['latitude'],longitude=p['longitude'],
            height_m=z.tolist(),pressure_hpa=pressure.tolist(),temperature_k=t.tolist(),
            u_ms=u.tolist(),v_ms=v.tolist(),rays=rays,thermal_layers=diagnose(z,t))
        profiles.append(profile)
        print(p['label'], 'returns',sum(r['status']=='returned' for r in rays),'of',len(rays),flush=True)
    results=dict(status='computed_from_real_nasa_derived_data',time_label='1 Jan 2025, 01:30 UTC',
        source_description='NASA GMAO MERRA-2, redistributed and regridded by the GEOS-Chem team at 4 degrees latitude by 5 degrees longitude. These profiles are coarse regional model estimates, not local measurements. The download uses native-model-layer files, not the 42-pressure-level collection originally considered.',
        height_method='Height above the model surface is derived hydrostatically from temperature, specific humidity, surface pressure and the GEOS 72-layer pressure coefficients. Heights are estimates, not directly downloaded height observations. The demo stops at the highest layer center below 60 km.',
        time_method=raw['time_method'],profile_sha256=sha(raw_path),sources=raw['sources'],
        profiles=profiles,thermal_layer_method=METHOD,audio_time_compression=1000,audio_return_amplitude=.25,
        model='Flat, horizontally uniform, dry-air effective-speed ray approximation: c_eff=sqrt(1.4*287.05*T)+U*sin(bearing)+V*cos(bearing). Analytic integration through piecewise-linear effective speed. No crosswind advection, terrain, Earth curvature, absorption or amplitude prediction.',
        audio_note='Source cue and distant receiver arrival are combined for presentation. This is not an echo heard at the source. Arrival time is divided by 1000; the musical clip is not sped up. Return amplitude is artistic, not predicted. Infrasound-inspired ray paths do not validate audible bell propagation.')
    output=json.dumps(results,separators=(',',':'),allow_nan=False)
    (dist/'results.js').write_text('window.ATMOSPHERE_RESULTS='+output+';',encoding='utf-8')
    if args.data_only:
        print(f'Built {len(profiles)} profiles and {sum(len(p["rays"]) for p in profiles)} ray cases.',flush=True)
        return
    # Preserve the user's chosen audio. An exact copy is used for browser playback.
    # Legacy audio export is optional; serving the app and --data-only are standalone.
    sys.path.insert(0,str(ROOT.parent/'tutorial-hf'))
    from audio_utils import export_matched
    reports=[]
    embedded={}
    default=next(r for r in profiles[0]['rays'] if r['bearing_deg']==90 and r['angle_deg']==15)
    for voice in ['bells','soft_synth']:
        source=ROOT.parent/'tutorial-hf/audio/selected-glitch'/(voice+'.wav')
        digest=sha(source);shutil.copy2(source,dist/'audio'/(voice+'.wav'))
        assert sha(dist/'audio'/(voice+'.wav'))==digest
        embedded[voice]=base64.b64encode(source.read_bytes()).decode('ascii')
        if default['status']!='returned':continue
        original,rate=sf.read(source,always_2d=True)
        delay_seconds=default['travel_seconds']/1000
        delay=round(delay_seconds*rate)
        mix=np.zeros((len(original)+delay,2))
        mix[:len(original)]+=original
        mix[delay:delay+len(original)]+=.25*original
        matched,stats=export_matched(dist/'audio',voice+'_atmospheric_return',mix,rate,-20)
        reel=np.concatenate([original,np.zeros((round(.8*rate),2)),matched])
        path=dist/'audio'/(voice+'_original_then_return.wav')
        sf.write(path,reel,rate,subtype='PCM_24')
        reopened,sr=sf.read(path,always_2d=True)
        assert sr==rate and reopened.shape==reel.shape and np.isfinite(reopened).all() and np.max(np.abs(reopened))<1
        assert sha(source)==digest
        reports.append(dict(voice=voice,source_sha256=digest,source_unchanged=True,
            profile=profiles[0]['id'],bearing_deg=90,angle_deg=15,
            physical_travel_seconds=default['travel_seconds'],playback_delay_seconds=delay_seconds,
            amplitude_ratio=.25,amplitude_is_artistic=True,export=stats,comparison=path.name))
    (dist/'audio/settings.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    (dist/'audio-data.js').write_text('window.ATMOSPHERE_AUDIO='+json.dumps(embedded)+';',encoding='utf-8')
    print('DEFAULT RAY',json.dumps({k:v for k,v in default.items() if k!='path_m'}),flush=True)
    print('Build complete; audio comparisons:',len(reports),flush=True)


if __name__=='__main__':main()
