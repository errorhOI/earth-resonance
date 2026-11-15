from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import argparse
import json
from profile_service import select_profile

ROOT=Path(__file__).resolve().parent
PORT=8766

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def respond(self,status,value):
        body=json.dumps(value,allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)
    def do_GET(self):
        if self.headers.get('Host') not in (f'127.0.0.1:{PORT}',f'localhost:{PORT}'):
            return self.respond(403,{'error':'Local connections only.'})
        url=urlsplit(self.path)
        if url.path=='/api/health':
            return self.respond(200,{'service':'cosmic-sound-lab','ready':True,'busy':False,'mode':'atmosphere'})
        if url.path=='/api/profile':
            try:
                query=parse_qs(url.query)
                profile=select_profile(float(query['lat'][0]),float(query['lon'][0]))
                return self.respond(200,{'profile':profile,'time':'2025-01-01T01:30:00Z',
                    'dataset':'NASA MERRA-2 regridded by GEOS-Chem','grid':'4 degrees x 5 degrees'})
            except (ValueError,KeyError,IndexError):
                return self.respond(400,{'error':'Choose valid map coordinates.'})
            except Exception:
                return self.respond(503,{'error':'Atmospheric data is unavailable. Try the region again.'})
        if url.path.startswith('/api/'):
            return self.respond(404,{'error':'Unknown endpoint.'})
        if (ROOT/'dist'/url.path.lstrip('/')).is_dir() and url.path!='/':
            return self.respond(404,{'error':'Not found.'})
        super().do_GET()
    def do_POST(self):
        self.respond(404,{'error':'This app has no AI generation endpoint.'})

def main():
    global PORT
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8766)
    PORT=parser.parse_args().port
    print(f'Sound Lab: http://127.0.0.1:{PORT}/ - atmosphere and region sonification',flush=True)
    with ThreadingHTTPServer(('127.0.0.1',PORT),Handler) as server:
        server.serve_forever()

if __name__=='__main__':main()
