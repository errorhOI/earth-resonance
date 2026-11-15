'use strict';
window.MapEndpoints = (() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function pulses(region,ray){
  const playback=window.soundLabController?.playback?.();
  if(!region?.profile||ray?.status!=='returned'||!playback?.propagation)return [];
  return SoundTiming.waves(playback,region,ray).filter(w=>w.arrival).map(w=>{
   const point=AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,w.progress*ray.path_seconds.at(-1));
   return {...w,location:AtmosphereGeo.destination(region.profile.latitude,region.profile.longitude,ray.bearing_deg,point[0])};
  });
 }
 function locations(region,ray){
  if(!region?.profile||!ray||!['ocean','aerosols'].includes(region.kind))return null;
  const p=region.profile,a=[p.latitude,p.longitude];
  return {a,b:ray.status==='returned'?AtmosphereGeo.destination(...a,ray.bearing_deg,ray.landing_range_km*1000):null};
 }
 function draw(ctx,w,h,dpr,viewer,region,ray){
  if(viewer.overlay?.dataset){viewer.overlay.dataset.arrivalPhase='idle';viewer.overlay.dataset.trackedPulseStart=''}
  const pair=locations(region,ray),status=document.getElementById('mapEndpoints');
  if(status)status.hidden=!pair;
  if(!pair)return;
  const text=`A · ${AtmosphereGeo.coordinate(...pair.a)}  →  ${pair.b?'B · '+AtmosphereGeo.coordinate(...pair.b):'No return'}`;
  if(status&&status.textContent!==text)status.textContent=text;
  const {width,height,left,top}=viewer.flatRect(w,h);
  const project=ll=>[left+(ll[1]+180)/360*width,top+(90-ll[0])/180*height];
  const a=project(pair.a),b=pair.b&&project(pair.b);
  ctx.save();ctx.beginPath();ctx.rect(left,top,width,height);ctx.clip();
  if(b){
   ctx.beginPath();let prev=null;
   for(let i=0;i<=64;i++){
    const q=project(AtmosphereGeo.destination(...pair.a,ray.bearing_deg,ray.landing_range_km*1000*i/64));
    if(!prev||Math.abs(q[0]-prev[0])>width/2)ctx.moveTo(...q);else ctx.lineTo(...q);prev=q;
   }
   ctx.strokeStyle='#76cfc3';ctx.lineWidth=1.5*dpr;ctx.setLineDash([3*dpr,3*dpr]);ctx.stroke();ctx.setLineDash([]);
  }
  const marker=(point,name,color,side)=>{
   const x=Math.max(left+13*dpr,Math.min(left+width-13*dpr,point[0]+side*21*dpr));
   const y=Math.max(top+13*dpr,Math.min(top+height-13*dpr,point[1]+side*22*dpr));
   ctx.beginPath();ctx.moveTo(...point);ctx.lineTo(x,y);ctx.strokeStyle=color;ctx.lineWidth=dpr;ctx.stroke();
   ctx.beginPath();ctx.arc(...point,3*dpr,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#101110';ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,10*dpr,0,Math.PI*2);ctx.fillStyle='#101110ed';ctx.fill();ctx.strokeStyle=color;ctx.stroke();
   ctx.font=`${12*dpr}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(name,x,y);
  };
  marker(a,'A','#76cfc3',-1);if(b)marker(b,'B','#81d5cd',1);
  const waves=b?pulses(region,ray):[];
  const focus=b?SoundTiming.focus(region,waves):null;
  if(viewer.overlay?.dataset)viewer.overlay.dataset.trackedPulseStart=focus?String(focus.start):'';
  if(viewer.overlay?.dataset)viewer.overlay.dataset.arrivalPhase=waves.some(w=>w.arrived)?'arrived':waves.length?'travelling':'idle';
  for(const wave of waves){
   if(wave.arrived){
    const fade=Math.max(0,1-wave.after/.18);
    ctx.beginPath();ctx.arc(...b,(reduced.matches?8:6+14*(1-fade))*dpr,0,Math.PI*2);
    ctx.strokeStyle=`rgba(129,213,205,${fade})`;ctx.lineWidth=2*dpr;ctx.stroke();
   }else if(!reduced.matches&&wave!==focus){
    const point=project(wave.location);
    ctx.beginPath();ctx.arc(...point,2*dpr,0,Math.PI*2);ctx.fillStyle='#e5fff955';ctx.fill();
   }
  }
  if(focus&&(!reduced.matches||focus.arrived)){
   const point=project(focus.location);
   ctx.beginPath();ctx.arc(...point,5*dpr,0,Math.PI*2);ctx.fillStyle='#e5fff9';ctx.fill();
   ctx.beginPath();ctx.arc(...point,8*dpr,0,Math.PI*2);ctx.strokeStyle='#e5fff9';ctx.lineWidth=1.2*dpr;ctx.stroke();
  }
  ctx.restore();
 }
 return {locations,pulses,draw};
})();
