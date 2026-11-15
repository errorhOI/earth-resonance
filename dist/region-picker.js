'use strict';
(() => {
 const canvas=$('globe');let drag=null,serial=0,abort=null,selection=null;
 
 const point=e=>{const rect=canvas.getBoundingClientRect(),map=globe.flatRect(rect.width,rect.height);
  return {u:(e.clientX-rect.left-map.left)/map.width,v:(e.clientY-rect.top-map.top)/map.height};};
 const inside=p=>p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1;
 function box(a,b){return {left:Math.max(0,Math.min(a.u,b.u)),right:Math.min(1,Math.max(a.u,b.u)),top:Math.max(0,Math.min(a.v,b.v)),bottom:Math.min(1,Math.max(a.v,b.v))}}
 function ready(value){$('followVideoControl').hidden=!value||!currentVideo;$('atmosphereControls').hidden=!value;$('layerLegend').hidden=!value||!$('rings').checked;for(const id of ['play','expandedPlay','labPlay','saveRegion'])$(id).disabled=!value;for(const b of $('regionSelections').querySelectorAll('button')){const selected=value&&b.dataset.region===window.regionSelection?.key;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected)}}
 function invalidate(){serial++;abort?.abort();window.soundLabController?.stop();window.regionSelection=null;selection=null;globe.regionBox=null;globe.map.enabled=false;$('regionCoordinates').textContent='Select a region';$('regionStatus').textContent='';setVisualStatus('');$('regionSelections').hidden=true;ready(false)}
 async function capture(bounds,{replace=false}={}){
  // New selections must not replace a saved collection that is still loading
  // (or temporarily unavailable). Ordinary clicks no longer cancel restoration.
  if(window.savedRegions&&!window.savedRegions.editable){setVisualStatus(window.savedRegions.loading?'Restoring saved regions…':'Saved regions are kept, but could not load. Refresh to retry.');return}
  const prior=replace?window.regionSelection?.cardId:null;
  const ticket=++serial;abort?.abort();abort=new AbortController();window.soundLabController.stop();window.regionSelection=null;ready(false);
  const kind=$('dataset').value;if(kind==='imported'){setVisualStatus('Use a NASA map to select geographic regions.');return}
  const source=globe.source;if(!source||globe.mediaKind!==kind||currentVideo&&currentVideo.readyState<2){setVisualStatus('Imagery is loading. Try again shortly.');return}
  currentVideo?.pause();selection=bounds;globe.regionBox=bounds;
  const lat=90-(bounds.top+bounds.bottom)*90,lon=(bounds.left+bounds.right)*180-180;
  $('regionCoordinates').textContent=AtmosphereGeo.coordinate(lat,lon);
  $('regionCoordinates').title=`West ${(bounds.left*360-180).toFixed(2)}°, east ${(bounds.right*360-180).toFixed(2)}°, north ${(90-bounds.top*180).toFixed(2)}°, south ${(90-bounds.bottom*180).toFixed(2)}°`;
  setVisualStatus('Loading region…');globe.map.enabled=false;
  try{
   const c=document.createElement('canvas');c.width=source.videoWidth||source.naturalWidth;c.height=source.videoHeight||source.naturalHeight;
   const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);
   const features=RegionSound.features(context.getImageData(0,0,c.width,c.height),bounds,kind);
   if(!features.some(f=>f.coverage>.015))throw Error('No usable colors here. Choose a colored region.');
   const response=await fetch(`/api/profile?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,{signal:abort.signal});
   const result=await response.json();if(!response.ok)throw Error(result.error);if(ticket!==serial)return;
   const p=result.profile;const at=data.profiles.findIndex(item=>item.id===p.id);if(at<0)data.profiles.push(p);else data.profiles[at]=p;
   if(!$('location').querySelector(`option[value="${p.id}"]`))$('location').add(new Option(p.label,p.id));$('location').value=p.id;
   const key=kind+'-'+RegionSound.fingerprint({features,bounds})+'-'+(currentVideo?currentVideo.currentTime.toFixed(3):'still');
   window.regionSelection={key,kind,bounds,latitude:lat,longitude:lon,features,frame:currentVideo?currentVideo.currentTime+sourceOffset:null,profile:p};
   $('regionCoordinates').dataset.sourceFingerprint=RegionSound.fingerprint(features);$('regionCoordinates').dataset.bounds=JSON.stringify(bounds);
   globe.map.enabled=false;globe.map.profiles=[];update();view(true);
   $('regionStatus').textContent=`Frame ${window.regionSelection.frame.toFixed(1)} s · `+'atmosphere grid '+AtmosphereGeo.coordinate(p.latitude,p.longitude);
   setVisualStatus('');window.regionCards?.add(window.regionSelection,prior);window.soundLabController.regionChanged();ready(true);if(currentVideo&&$('followVideo').checked)window.soundLabController.playProcessedOnce();
  }catch(e){if(ticket!==serial)return;setVisualStatus(e.name==='AbortError'?'':e.message);globe.map.enabled=false;ready(false)}
 }
 canvas.addEventListener('pointerdown',e=>{if(!globe.flat||e.button!==0||e.shiftKey||$('dataset').value==='imported')return;const p=point(e);if(!inside(p))return;drag={start:p,end:p,id:e.pointerId};canvas.setPointerCapture(e.pointerId);window.soundLabController.stop()});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;drag.end=point(e);globe.regionBox=box(drag.start,drag.end)});
 canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;let b=box(drag.start,point(e));drag=null;
  if(b.right-b.left<.01||b.bottom-b.top<.01){const p=point(e);b=box({u:p.u-.025,v:p.v-.04},{u:p.u+.025,v:p.v+.04})}capture(b)});
 canvas.addEventListener('pointercancel',()=>{drag=null;globe.regionBox=selection});
 $('editRegion').onclick=()=>{const r=window.regionSelection;$('regionLat').value=r?r.latitude.toFixed(2):0;$('regionLon').value=r?r.longitude.toFixed(2):0;$('regionDialog').showModal()};
 $('closeRegion').onclick=()=>$('regionDialog').close();
 $('regionForm').onsubmit=e=>{e.preventDefault();if(!$('regionForm').reportValidity())return;const u=(+$('regionLon').value+180)/360,v=(90-+$('regionLat').value)/180;$('regionDialog').close();view(true);capture(box({u:u-.025,v:v-.04},{u:u+.025,v:v+.04}))};
 async function activate(r,{play=false}={}){
  serial++;abort?.abort();window.soundLabController.stop();
  if($('dataset').value!==r.kind){$('dataset').value=r.kind;chooseDataset()}
  setVisualStatus('');window.regionSelection=r;selection=r.bounds;globe.regionBox=r.bounds;globe.map.enabled=false;
  $('location').value=r.profile.id;update();
  $('regionCoordinates').textContent=AtmosphereGeo.coordinate(r.latitude,r.longitude);
  $('regionCoordinates').dataset.bounds=JSON.stringify(r.bounds);
  $('regionCoordinates').dataset.sourceFingerprint=RegionSound.fingerprint(r.features);
  $('regionStatus').textContent='Atmosphere grid '+AtmosphereGeo.coordinate(r.profile.latitude,r.profile.longitude);
  window.soundLabController.regionChanged();ready(true);window.regionCards?.highlight();
  if(play)await window.soundLabController.playProcessedOnce();
 }
 $('saveRegion').onclick=()=>window.regionCards?.show(true);
 window.regionPicker={invalidate,capture,activate};invalidate();view(true);
})();
