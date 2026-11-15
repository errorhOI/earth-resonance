import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import threading
import time
import requests

ROOT=Path(__file__).resolve().parent/'data'
BASE='https://geos-chem.s3.amazonaws.com/GEOS_4x5/MERRA2/2025/01/'


class RemoteFile(io.RawIOBase):
    def __init__(self,name,size):
        super().__init__()
        self.name=name;self.url=BASE+name;self.size=size;self.position=0
        self.cache=ROOT/'range-cache'/name
        self.cache.mkdir(parents=True,exist_ok=True)
        self.pool=concurrent.futures.ThreadPoolExecutor(max_workers=12)
        self.block_size=16384;self.requests=0;self.lock=threading.Lock();self.local=threading.local()
    def readable(self):return True
    def seekable(self):return True
    def writable(self):return False
    def tell(self):return self.position
    def seek(self,offset,whence=0):
        self.position=offset if whence==0 else self.position+offset if whence==1 else self.size+offset
        return self.position
    def block(self,index):
        start=index*self.block_size;end=min(start+self.block_size,self.size)-1
        path=self.cache/f'{index:06d}.bin'
        if path.exists() and path.stat().st_size==end-start+1:return path.read_bytes()
        if not hasattr(self.local,'session'):self.local.session=requests.Session()
        for attempt in range(3):
            try:
                r=self.local.session.get(self.url,headers={'Range':f'bytes={start}-{end}'},timeout=(15,30))
                r.raise_for_status()
                break
            except requests.RequestException:
                if attempt==2:raise
                time.sleep(1)
        if r.status_code!=206 or len(r.content)!=end-start+1:raise IOError('Invalid HTTP range response')
        if r.headers.get('Content-Range')!=f'bytes {start}-{end}/{self.size}':raise IOError('Source size or range mismatch')
        path.write_bytes(r.content)
        with self.lock:self.requests+=1
        return r.content
    def prefetch(self,datasets):
        blocks=set()
        for dataset,times in datasets:
            for t in times:
                coords=[(t,z,0,0) for z in range(dataset.shape[1])] if dataset.ndim==4 else [(t,0,0)]
                for coord in coords:
                    chunk=dataset.id.get_chunk_info_by_coord(coord)
                    if chunk.byte_offset is None:raise IOError('Missing HDF5 data chunk')
                    blocks.update(range(chunk.byte_offset//self.block_size,(chunk.byte_offset+chunk.size-1)//self.block_size+1))
        needed=[i for i in sorted(blocks) if not (self.cache/f'{i:06d}.bin').exists()]
        print(f'Fetching {len(needed)} small blocks for selected variables in {self.name}',flush=True)
        futures=[self.pool.submit(self.block,i) for i in needed]
        for i,f in enumerate(concurrent.futures.as_completed(futures),1):
            f.result()
            if i%25==0 or i==len(futures):print(f'Profile blocks {i}/{len(futures)}',flush=True)
    def read(self,size=-1):
        if size<0:size=self.size-self.position
        if not size or self.position>=self.size:return b''
        size=min(size,self.size-self.position)
        first=self.position//self.block_size;last=(self.position+size-1)//self.block_size
        parts=list(self.pool.map(self.block,range(first,last+1)))
        offset=self.position%self.block_size
        result=b''.join(parts)[offset:offset+size]
        self.position+=len(result)
        return result
    def readinto(self,buffer):
        value=self.read(len(buffer));buffer[:len(value)]=value;return len(value)
    def close(self):
        if hasattr(self,'pool'):self.pool.shutdown(wait=True)
        super().close()


def inspect():
    import h5py
    for name,size in [('MERRA2.20250101.I3.4x5.nc4',19224099),('MERRA2.20250101.A3dyn.4x5.nc4',28185683)]:
        with RemoteFile(name,size) as remote:
            with h5py.File(remote,'r') as file:
                print(name,flush=True)
                for key in file:
                    d=file[key]
                    print(key,d.shape,d.chunks,{k:str(v) for k,v in d.attrs.items() if k in ['units','long_name','standard_name','positive']},flush=True)
                for key in ['lat','lon','lev','time']:
                    if key in file:print(key,file[key][:].tolist(),flush=True)


if __name__=='__main__':inspect()
