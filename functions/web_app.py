import os
import mimetypes
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from profile_service import load_fields, select_profile

ROOT=Path(__file__).resolve().parent.parent
STATIC=ROOT/'hosted-dist'
app=Flask(__name__,static_folder=None)
app.config.update(MAX_CONTENT_LENGTH=1024*1024)

@app.get('/api/health')
def health():
    return jsonify(service='cosmic-sound-lab',ready=True,busy=False,mode='atmosphere')

@app.get('/api/profile')
def profile():
    try:
        result=select_profile(float(request.args['lat']),float(request.args['lon']))
        return jsonify(profile=result,time='2025-01-01T01:30:00Z',
                       dataset='NASA MERRA-2 regridded by GEOS-Chem',grid='4 degrees x 5 degrees')
    except (ValueError,KeyError,IndexError):
        return jsonify(error='Choose valid map coordinates.'),400
    except Exception:
        app.logger.exception('Atmospheric calculation failed')
        return jsonify(error='Atmospheric data is unavailable. Try the region again.'),503

@app.get('/')
@app.get('/<path:filename>')
def static_file(filename='index.html'):
    if filename.startswith('api/') or any(part.startswith('.') for part in Path(filename).parts):
        return jsonify(error='Not found.'),404

    compressed=filename+'.gz'
    if (request.accept_encodings['gzip']>0 and not request.headers.get('Range')
            and (STATIC/compressed).is_file() and '..' not in Path(filename).parts):
        response=send_from_directory(STATIC,compressed,conditional=True,max_age=3600,
                                     mimetype=mimetypes.guess_type(filename)[0] or 'application/octet-stream')
        response.headers['Content-Encoding']='gzip'
    else:
        response=send_from_directory(STATIC,filename,conditional=True,max_age=3600)
    response.vary.add('Accept-Encoding')
    if filename=='index.html': response.headers['Cache-Control']='no-cache'
    return response

@app.after_request
def response_headers(response):
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    if request.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
    return response

def main():
    from waitress import serve
    if not (STATIC/'index.html').exists():
        raise RuntimeError('Run python prepare_hosting.py before starting the hosted server.')
    load_fields()
    serve(app,host='0.0.0.0',port=int(os.environ.get('PORT','8767')),
          threads=4,connection_limit=100,channel_timeout=60,max_request_body_size=1024*1024)

if __name__=='__main__':main()
