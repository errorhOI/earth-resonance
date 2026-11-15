import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np

ROOT=Path(__file__).resolve().parent.parent

def bundle_fields():
    from profile_service import load_source_fields
    from remote_profile import BASE
    fields=load_source_fields()
    path=ROOT/'data/hosted-fields.npz'
    np.savez_compressed(path,**fields)
    manifest={
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'shapes':{k:list(v.shape) for k,v in fields.items()},
        'dataset':'NASA GMAO MERRA-2, regridded by GEOS-Chem, 4 x 5 degrees',
        'time':'2025-01-01T01:30:00Z',
        'sources':[BASE+f'MERRA2.20250101.{kind}.4x5.nc4' for kind in ['I3','A3dyn']],
        'processing':'Same decoded arrays as profile_service: T, QV, PS mean of 00:00 and 03:00 instantaneous fields; U, V 00:00-03:00 means. No quantization. Heights, layers and rays calculated on request.',
        'units':{'lat':'degrees north','lon':'degrees east','T':'K','QV':'kg/kg','PS':'Pa','U':'m/s','V':'m/s'}}
    path.with_suffix('.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')

def build_static():

    output=ROOT/'hosted-dist';output.mkdir(exist_ok=True)
    files=subprocess.check_output(['git','ls-files','ui','functions'],cwd=ROOT,text=True).splitlines()
    files=[name for name in files if name.startswith('ui/') or Path(name).suffix in {'.js','.json'}]
    if not files:raise RuntimeError('No tracked application files found.')
    for filename in files:
        rel=Path(filename).relative_to('ui' if filename.startswith('ui/') else 'functions');target=output/rel
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes((ROOT/filename).read_bytes())
    source=(ROOT/'functions/media-data.js').read_text(encoding='utf-8')
    media=json.loads(source.split('=',1)[1].rstrip(';\r\n'))
    source=(ROOT/'functions/aerosols-data.js').read_text(encoding='utf-8')
    additions=json.loads(source.split(',',1)[1].rstrip(');\r\n'))
    media['aerosols'].update(additions)
    assets=output/'assets';assets.mkdir(exist_ok=True)
    for name,extension in [('ocean','mp4'),('aerosols','webm')]:
        data=base64.b64decode(media[name].pop('video_base64'),validate=True)
        digest=hashlib.sha256(data).hexdigest()
        target=f'assets/{name}-{digest[:12]}.{extension}'
        (output/target).write_bytes(data)
        media[name]['video_url']=target
        if name=='ocean' and digest!=media[name]['video_sha256']:
            raise ValueError('Ocean video checksum mismatch.')
    (output/'media-data.js').write_text('window.NASA_MEDIA='+json.dumps(media,separators=(',',':'))+';\n',encoding='utf-8')
    (output/'aerosols-data.js').write_text('\n',encoding='utf-8')
    app=(output/'app.js').read_text(encoding='utf-8')
    replacements={
        "v.preload='auto'":"v.preload='metadata'",
        "oceanVideo.src=URL.createObjectURL(new Blob([bytes(NASA_MEDIA.ocean.video_base64)],{type:'video/mp4'}));":"oceanVideo.src=NASA_MEDIA.ocean.video_url;",
        "aerosolVideo.src=URL.createObjectURL(new Blob([bytes(NASA_MEDIA.aerosols.video_base64)],{type:NASA_MEDIA.aerosols.video_type}));":"aerosolVideo.src=NASA_MEDIA.aerosols.video_url;"}
    for old,new in replacements.items():
        if app.count(old)!=1:raise ValueError('Media loader changed; review hosted replacement: '+old)
        app=app.replace(old,new)
    (output/'app.js').write_text(app,encoding='utf-8')

    import re
    html=(output/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'((?:src|href)="([^"?]+))\?v=[^" ]+',lambda m:m[1]+'?v='+hashlib.sha256((output/m[2]).read_bytes()).hexdigest()[:12],html)
    (output/'index.html').write_text(html,encoding='utf-8')
    for path in output.rglob('*'):
        if path.suffix in {'.js','.css','.json','.html'} and path.stat().st_size>1024:
            path.with_name(path.name+'.gz').write_bytes(gzip.compress(path.read_bytes(),compresslevel=6,mtime=0))
    print('Hosted build ready. Videos are unchanged, served as binary files with range requests.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--rebuild-fields',action='store_true')
    args=parser.parse_args()
    if args.rebuild_fields:bundle_fields()
    from profile_service import load_fields
    if not (ROOT/'data/hosted-fields.npz').exists():raise RuntimeError('Atmosphere bundle missing.')
    load_fields()
    build_static()
