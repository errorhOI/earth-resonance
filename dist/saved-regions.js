'use strict';
// Store only geographic selections. Media and scientific profiles are reloaded.
window.RegionStorage = (() => {
 const key='cosmic-siblings.regions.v1';
 function valid(r){const b=r?.bounds;return ['ocean','aerosols'].includes(r?.kind)&&b&&['left','right','top','bottom'].every(k=>Number.isFinite(b[k])&&b[k]>=0&&b[k]<=1)&&b.left<b.right&&b.top<b.bottom;}
 function read(storage){
  const raw=storage.getItem(key);if(raw===null)return null;
  const s=JSON.parse(raw);
  if(s?.version!==1||!Array.isArray(s.regions)||!s.regions.every(valid)||!Number.isInteger(s.active)||s.active< -1||s.active>=s.regions.length||![0,90,180,270].includes(s.bearing)||![5,10,15,20,25,30].includes(s.angle)||typeof s.gallery!=='boolean')throw Error('Invalid saved regions');
  return s;
 }
 function write(storage,regions,active,{bearing,angle,gallery}){
  const saved=regions.map(r=>({kind:r.kind,bounds:{...r.bounds},included:r.included!==false}));
  if(!saved.every(valid))throw Error('Invalid regions');
  storage.setItem(key,JSON.stringify({version:1,regions:saved,active:regions.findIndex(r=>r.cardId===active?.cardId),bearing,angle,gallery}));
 }
 return {read,write};
})();
(() => {
 let restoring=true,blocked=false;
 const notice=text=>setVisualStatus(text);
 function save(){
  if(restoring||blocked)return;
  try{RegionStorage.write(localStorage,regionCards.list(),window.regionSelection,{bearing:+$('bearing').value,angle:+$('angle').value,gallery:regionCards.isGallery()});}
  catch{notice('Regions could not be saved in this browser.');}
 }
 window.addEventListener('regions-changed',save);
 window.addEventListener('atmosphere-selected',save);
 window.addEventListener('pagehide',save);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
 function waitVideo(video,signal){return new Promise((resolve,reject)=>{
  if(signal.aborted)return reject(Error('Cancelled'));
  if(video.readyState>=2&&video.videoWidth)return resolve();
  const finish=error=>{clearTimeout(timer);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);signal.removeEventListener('abort',failed);error?reject(error):resolve();};
  const loaded=()=>finish(),failed=()=>finish(Error('Imagery unavailable'));
  const timer=setTimeout(failed,60000);video.addEventListener('loadeddata',loaded);video.addEventListener('error',failed);signal.addEventListener('abort',failed,{once:true});
 });}
 async function prepare(saved){
  const b=saved.bounds,lat=90-(b.top+b.bottom)*90,lon=(b.left+b.right)*180-180;
  const video=saved.kind==='ocean'?oceanVideo:aerosolVideo;
  const signal=AbortSignal.timeout(65000);
  const [response]=await Promise.all([fetch(`/api/profile?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,{signal}),waitVideo(video,signal)]);
  const result=await response.json();if(!response.ok||!result.profile?.rays?.length)throw Error('Atmosphere unavailable');
  const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;
  const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0);
  const features=RegionSound.features(context.getImageData(0,0,c.width,c.height),b,saved.kind);
  return {kind:saved.kind,included:saved.included!==false,bounds:b,latitude:lat,longitude:lon,features,frame:video.currentTime,profile:result.profile,key:saved.kind+'-'+RegionSound.fingerprint({bounds:b,features})};
 }
 async function restore(){
  let saved;
  try{
   saved=RegionStorage.read(localStorage);if(!saved?.regions.length)return;
   notice('Restoring regions…');
   // Prepare everything before changing the visible selection. A failed load
   // leaves the saved list intact, so a later refresh can retry it.
   // No collection-size cap. Bound simultaneous profile requests and image
   // sampling instead, preserving saved order even if requests finish out of order.
   const regions=new Array(saved.regions.length);let cursor=0,failed=false;
   async function worker(){
    while(!failed&&cursor<saved.regions.length){
     const index=cursor++;
     try{regions[index]=await prepare(saved.regions[index]);}
     catch(error){failed=true;throw error;}
    }
   }
   await Promise.all(Array.from({length:Math.min(4,saved.regions.length)},worker));
   $('bearing').value=saved.bearing;$('angle').value=saved.angle;
   for(const r of regions){
    const i=data.profiles.findIndex(p=>p.id===r.profile.id);if(i<0)data.profiles.push(r.profile);else data.profiles[i]=r.profile;
    if(!$('location').querySelector(`option[value="${r.profile.id}"]`))$('location').add(new Option(r.profile.label,r.profile.id));
    regionCards.add(r);
   }
   if(saved.active>=0)await regionPicker.activate(regions[saved.active]);
   else regionPicker.invalidate();
   regionCards.show(saved.gallery);notice('');
  }catch{
   blocked=true;notice('Saved regions are kept, but could not load. Refresh to retry.');
  }finally{
   restoring=false;
   if(!blocked)save();
  }
 }
 window.savedRegions={save,get loading(){return restoring},get editable(){return !restoring&&!blocked},ready:restore()};
})();
