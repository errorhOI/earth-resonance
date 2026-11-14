'use strict';
(() => {
 const panel=document.querySelector('.visual-panel'),grid=$('regionGrid'),cards=new Map();
 let nextId=1,lastDraw=0,inGallery=false;
 const datasetName=()=>$('dataset').value==='imported'?$('datasetTitle').dataset.sourceName:($('dataset').value==='ocean'?'Ocean currents & temperature':'GEOS aerosols');
 const sample=document.createElement('canvas'),N=32;sample.width=N;sample.height=N;
 const sampler=sample.getContext('2d',{willReadFrequently:true});
 const videoFor=r=>r.kind==='ocean'?oceanVideo:aerosolVideo;
 const observer=new IntersectionObserver(entries=>{for(const e of entries)e.target._visible=e.isIntersecting});
 function counts(){
  $('globeView').textContent=`Regions (${cards.size})`;$('regionCount').textContent=`${cards.size} selected`;
  $('emptyRegions').hidden=cards.size>0;grid.classList.toggle('single-region',cards.size===1);
  $('audioWavePanel').hidden=!cards.size;
 }
 function highlight(){for(const {region,element} of cards.values()){
  const active=region.cardId===window.regionSelection?.cardId;element.classList.toggle('selected',active);
  element.querySelector('.card-select').setAttribute('aria-pressed',active);
  element.querySelector('.card-period').textContent=DatasetPeriods.label(region.kind);
 }window.dispatchEvent(new Event('regions-changed'));}
 function show(value){
  inGallery=value;panel.classList.toggle('cards-view',value);$('regionGallery').hidden=!value;
  $('datasetTitle').textContent=datasetName();
  DatasetPeriods.show($('dataset').value);
  $('flatView').classList.toggle('active',!value);$('globeView').classList.toggle('active',value);
  $('flatView').setAttribute('aria-pressed',!value);$('globeView').setAttribute('aria-pressed',value);
  // Both datasets can animate in the gallery, but only the selected region is audible.
  if(value)for(const v of new Set([...cards.values()].map(c=>videoFor(c.region))))v.play().catch(()=>{});
  else for(const v of [oceanVideo,aerosolVideo])if(v!==currentVideo)v.pause();
  highlight();
 }
 async function select(entry,play=false,details=false){
  await window.regionPicker.activate(entry.region,{play});show(true);
  if(details){$('scientificDetails').open=false;$('details').showModal()}
 }
 function add(region,replaceId){
  if(replaceId&&cards.has(replaceId)){
   region.cardId=replaceId;cards.get(replaceId).region=region;highlight();show(true);return;
  }
  region.cardId=nextId++;
  const element=document.createElement('article');element.className='region-card';element.dataset.cardId=region.cardId;
  const coords=AtmosphereGeo.coordinate(region.latitude,region.longitude);
  element.innerHTML=`<header><button class="card-select" aria-pressed="false" title="Select region"><span class="card-number">Region ${String(region.cardId).padStart(2,'0')}</span><span>${coords}<small>${region.kind==='ocean'?'Ocean':'Aerosols'}</small><small class="card-period"></small></span></button><button class="card-remove" aria-label="Remove region ${region.cardId}" title="Remove region">×</button></header><div class="surface-view"><canvas class="region-surface" role="img" aria-label="Animated atmospheric sound path above the image brightness surface at ${coords}. Separate display scales."></canvas></div><div class="card-footer"><span class="card-frame"></span><button class="card-atmosphere" aria-label="Atmosphere for region ${region.cardId}">Atmosphere ↗</button></div>`;
  const entry={region,element,canvas:element.querySelector('canvas'),view:new RegionCardView()};entry.view.bind(entry.canvas);cards.set(region.cardId,entry);
  element.querySelector('.card-select').onclick=()=>select(entry,playing);
  element.querySelector('.card-atmosphere').onclick=()=>select(entry,false,true);
  element.querySelector('.card-remove').onclick=()=>{
   if(window.regionSelection?.cardId===entry.region.cardId)window.regionPicker.invalidate();
   observer.unobserve(element);cards.delete(region.cardId);element.remove();counts();highlight();
   if(!cards.size)show(false);
  };
  grid.append(element);observer.observe(element);counts();highlight();show(true);
 }
 // Fixed display luma, not per-card normalization or a physical elevation model.
 function surface(entry){
  const v=videoFor(entry.region),c=entry.canvas,b=entry.region.bounds;
  if(v.readyState<2)return;
  const w=Math.round(c.clientWidth),h=Math.round(c.clientHeight);if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=w*dpr;c.height=h*dpr}
  sampler.drawImage(v,b.left*v.videoWidth,b.top*v.videoHeight,(b.right-b.left)*v.videoWidth,(b.bottom-b.top)*v.videoHeight,0,0,N,N);
  const px=sampler.getImageData(0,0,N,N).data,ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const sx=Math.min(w*.38,h*.65),sy=sx*.28,zh=h*.18,cy=h*.55;
  const brightnessAt=(u,v)=>{const i=(Math.round(Math.max(0,Math.min(1,v))*(N-1))*N+Math.round(Math.max(0,Math.min(1,u))*(N-1)))*4;return (.2126*px[i]+.7152*px[i+1]+.0722*px[i+2])/255};
  const geometry={w,h,sx,sy,zh,cy,brightnessAt,dpr,screen:(x,y)=>entry.view.point(x,y,w,h)};
  ctx.save();entry.view.apply(ctx,w,h);
  window.CardAtmosphere?.back(ctx,entry,geometry);
  const points=[];let sum=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const i=(y*N+x)*4,z=(.2126*px[i]+.7152*px[i+1]+.0722*px[i+2])/255;
   sum+=z;points.push({x:w/2+(x-y)/(N-1)*sx,y:cy+(x+y)/(N-1)*sy-z*zh,r:px[i],g:px[i+1],b:px[i+2]});
  }
  function poly(pts,color,stroke){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.45;ctx.stroke()}}
  // Front skirts make the zero-brightness plane legible without implying terrain depth.
  const base=(x,y)=>({x:w/2+(x-y)/(N-1)*sx,y:cy+(x+y)/(N-1)*sy});
  for(let k=0;k<N-1;k++){
   poly([points[(N-1)*N+k],points[(N-1)*N+k+1],base(k+1,N-1),base(k,N-1)],'#242a28');
   poly([points[k*N+N-1],points[(k+1)*N+N-1],base(N-1,k+1),base(N-1,k)],'#1c2220');
  }
  // Back-to-front ordering, with two triangles per sampled cell.
  for(let diagonal=0;diagonal<2*(N-1);diagonal++)for(let y=0;y<N-1;y++){
   const x=diagonal-y;if(x<0||x>=N-1)continue;
   const a=points[y*N+x],b=points[y*N+x+1],d=points[(y+1)*N+x],e=points[(y+1)*N+x+1];
   for(const tri of [[a,b,d],[b,e,d]]){
    const rgb=['r','g','b'].map(k=>Math.round(tri.reduce((s,p)=>s+p[k],0)/3));
    poly(tri,`rgb(${rgb.join(',')})`,'rgba(192,210,200,.09)');
   }
  }
  const scan=SoundTiming.scan(window.soundLabController?.playback?.(),entry.region);
  if(scan!==null){
   ctx.beginPath();
   for(let y=0;y<N;y++){const v=y/(N-1),x=w/2+(scan-v)*sx,z=cy+(scan+v)*sy-brightnessAt(scan,v)*zh-1;y?ctx.lineTo(x,z):ctx.moveTo(x,z)}
   ctx.strokeStyle='#f7ead0';ctx.lineWidth=1.5;ctx.stroke();
  }
  c.dataset.scanFraction=scan===null?'':scan.toFixed(4);
  window.CardAtmosphere?.draw(ctx,entry,geometry,performance.now(),v.paused);
  ctx.restore();c.dataset.zoom=entry.view.zoom.toFixed(3);
  const t=v.currentTime+(entry.region.kind==='ocean'?10:0);
  const status=entry.element.querySelector('.card-frame');status.textContent=`${v.paused?'Paused':'Video'} · ${t.toFixed(1)} s`;
  c.dataset.frame=t.toFixed(3);c.dataset.meanBrightness=(sum/(N*N)).toFixed(5);
 }
 function waveform(){window.AudioHistory.draw(analyser,playing)}
 function frame(now){
  if(!document.hidden){waveform();if(inGallery){const redraw=now-lastDraw>100;if(redraw)lastDraw=now;for(const entry of cards.values())if(entry.element._visible&&(redraw||playing&&(entry.region.cardId===window.regionSelection?.cardId||window.soundLabController?.playback().regionIds?.includes(entry.region.cardId))))surface(entry)}}
  requestAnimationFrame(frame);
 }
 function atmosphereSummary(){
  const r=window.regionSelection;if(!r||!currentRay)return;
  const returned=currentRay.status==='returned';
  $('pathDistance').textContent=returned?`${currentRay.landing_range_km.toFixed(1)} km`:'No return';
 }
 window.addEventListener('atmosphere-selected',atmosphereSummary);
 $('atmosphere').addEventListener('click',()=>{$('scientificDetails').open=false;atmosphereSummary()});
 $('rings').checked=false;if(globe){globe.atmosphere=false;globe.map.enabled=false}
 $('chooseRegionFromEmpty').onclick=()=>{$('flatView').click();$('globe').focus()};
 $('saveRegion').textContent='View regions';$('saveRegion').onclick=()=>show(true);
 window.regionCards={add,count:()=>cards.size,list:()=>[...cards.values()].map(c=>c.region),isGallery:()=>inGallery,show,highlight};counts();show(false);requestAnimationFrame(frame);
})();
