'use strict';
// Shared perspective with the brightness surface. Horizontal fitting and the
// raised atmosphere base are schematic, never a terrain-aware propagation model.
window.CardAtmosphere = (() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const corners=[[0,0],[1,0],[1,1],[0,1]];
 function scene(entry,g){
  const profile=entry.region.profile;
  const ray=profile?.rays.find(r=>r.bearing_deg===+$('bearing').value&&r.angle_deg===+$('angle').value);
  if(!ray)return null;
  const base=ray.path_m[0][1],top=profile.height_m.at(-1),span=top-base;
  const lift=g.zh+8,airHeight=g.h*.29;
  const project=(u,v,z)=>[g.w/2+(u-v)*g.sx,g.cy+(u+v)*g.sy-z];
  const b=ray.bearing_deg*Math.PI/180,du=.34*Math.sin(b),dv=-.34*Math.cos(b);
  const from=[.5-du,.5-dv],to=[.5+du,.5+dv];
  const maxX=Math.max(1,...ray.path_m.map(p=>p[0]));
  const at=([distance,z])=>{const f=distance/maxX;return project(from[0]+f*(to[0]-from[0]),from[1]+f*(to[1]-from[1]),lift+(z-base)/span*airHeight)};
  return {profile,ray,base,top,span,lift,airHeight,project,from,to,at};
 }
 function polygon(ctx,points,fill,stroke,dash=[]){
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
 }
 function back(ctx,entry,g){
  const s=scene(entry,g);if(!s)return;
  const {project,lift,airHeight}=s;
  ctx.save();
  for(const edge of [[0,1],[0,3]]){
   const a=corners[edge[0]],b=corners[edge[1]];
   polygon(ctx,[project(...a,lift),project(...b,lift),project(...b,lift+airHeight),project(...a,lift+airHeight)],'rgba(123,178,193,.025)','#92b5c01c');
  }
  ctx.restore();
 }
 function draw(ctx,entry,g,now,paused){
  const s=scene(entry,g);if(!s)return;
  const {profile,ray,base,top,span,lift,airHeight,project,from,to,at}=s;
  const playback=window.soundLabController?.playback?.();
  const waves=SoundTiming.waves(playback,entry.region,ray);
  const arrivals=waves.filter(p=>p.arrived),travelling=waves.filter(p=>p.progress<1);
  const focus=SoundTiming.focus(entry.region,waves);
  const progress=focus?.progress||0;
  const total=ray.path_seconds.at(-1),point=AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,progress*total);
  const returned=ray.status==='returned',source=at(ray.path_m[0]),end=at(ray.path_m.at(-1));
  const layers=(profile.thermal_layers?.layers||[]).filter(l=>Number.isFinite(l.bottom_km)&&Number.isFinite(l.top_km)&&l.top_km>l.bottom_km);
  const heightKm=point[1]/1000;
  const activeLayer=focus&&layers.find((l,i)=>heightKm>=l.bottom_km&&(heightKm<l.top_km||(i===layers.length-1&&heightKm<=l.top_km+1e-6)));
  ctx.save();
  // Thin floating sheets mark diagnosed thermal boundaries and the sampled top;
  // none is a rigid reflector. All share the same height scale as the ray.
  const boundaries=layers.slice(0,-1).map(l=>l.top_km*1000).filter(z=>z>base&&z<top);
  for(const z of boundaries){const rise=lift+(z-base)/span*airHeight;polygon(ctx,corners.map(([u,v])=>project(u,v,rise)),'rgba(140,185,198,.018)','#9bbbc52d',[3,5])}
  polygon(ctx,corners.map(([u,v])=>project(u,v,lift+airHeight)),'rgba(123,178,193,.065)','#9bc7d56b',[5,5]);
  // Highlight only the data-derived volume containing the moving wave.
  // Low-opacity faces preserve the imagery; boundaries never change the ray.
  if(activeLayer){
   const low=lift+(Math.max(base,activeLayer.bottom_km*1000)-base)/span*airHeight;
   const high=lift+(Math.min(top,activeLayer.top_km*1000)-base)/span*airHeight;
   const lower=corners.map(([u,v])=>project(u,v,low)),upper=corners.map(([u,v])=>project(u,v,high));
   for(let i=0;i<4;i++){
    const next=(i+1)%4;
    polygon(ctx,[lower[i],lower[next],upper[next],upper[i]],'rgba(236,211,153,.035)',null);
   }
   polygon(ctx,upper,'rgba(236,211,153,.045)','#ecd39966');
   polygon(ctx,lower,null,'#ecd39955');
  }
  // Front edges show volume while leaving the data colors visible.
  for(const corner of [corners[1],corners[2],corners[3]]){
   const a=project(...corner,lift),b=project(...corner,lift+airHeight);
   ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle='#8ab3c029';ctx.lineWidth=.8;ctx.setLineDash([3,6]);ctx.stroke();ctx.setLineDash([]);
  }
  const dot=(p,color,r=3.5)=>{ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()};
  // Dashed anchors connect this schematic to the brightness image. They are not
  // extra sound-path segments or physical terrain height calculations.
  for(const [uv,p,color] of [[from,source,'#dfc58b'],...(returned?[[to,end,'#81d5cd']]:[])]){
   const foot=project(...uv,g.brightnessAt(...uv)*g.zh);
   ctx.beginPath();ctx.moveTo(...foot);ctx.lineTo(...p);ctx.strokeStyle=color+'66';ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.stroke();ctx.setLineDash([]);dot(foot,color,2.5);
  }
  const path=(points,color,width)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...at(p)):ctx.moveTo(...at(p)));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()};
  path(ray.path_m,'#e3c78070',1.5);
  if(focus){const travelled=ray.path_m.filter((_,i)=>ray.path_seconds[i]<=progress*total);travelled.push(point);path(travelled,'#f1d58d',2.5)}
  for(const f of [.22,.5,.78]){
   const a=at(AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,(f-.01)*total)),b=at(AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,f*total));
   ctx.save();ctx.translate(...b);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));ctx.strokeStyle='#ecd399';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(0,0);ctx.lineTo(-5,3);ctx.stroke();ctx.restore();
  }
  dot(source,'#dfc58b');dot(end,returned?'#81d5cd':'#a9b3b0');const pos=at(point);
  if(!reduced.matches)for(const wave of travelling)if(wave!==focus)dot(at(AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,wave.progress*total)),'#fff4cd55',2);
  if(focus){dot(pos,'#fff4cd',5);ctx.beginPath();ctx.arc(...pos,8,0,Math.PI*2);ctx.strokeStyle='#fff4cd';ctx.lineWidth=1.2;ctx.stroke()}
  const next=AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,Math.min(total,progress*total+total*.01));
  const prev=AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,Math.max(0,progress*total-total*.01));
  const n=at(next),p=at(prev),direction=Math.atan2(n[1]-p[1],n[0]-p[0]);
  if(focus&&progress<1&&!reduced.matches){for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(...pos,9+i*5,direction-.7,direction+.7);ctx.strokeStyle=`rgba(238,213,153,${.65-i*.16})`;ctx.lineWidth=1.5;ctx.stroke()}}
  for(const arrival of arrivals){const f=arrival.after/.18;ctx.beginPath();ctx.arc(...end,reduced.matches?7:6+f*14,0,Math.PI*2);ctx.strokeStyle=`rgba(129,213,205,${Math.max(0,1-f)})`;ctx.lineWidth=2;ctx.stroke()}
  const peak=Math.max(...ray.path_m.map(p=>p[1]));
  const phase=!focus?(playback?.active?(playback.propagation?'Waiting for note':'Original · no delayed sound'):'Listen to animate'):progress>=1?(returned?'Receiver reached':ray.status==='range_limit'?'Range limit reached':'Leaves sampled atmosphere'):returned&&point[1]>peak*.94?'Bending':next[1]<prev[1]?'Descending':'Rising';
  // Keep captions readable at a fixed size while their scene anchors zoom.
  const label=(text,x,y,color='#d8ded6',align='left',fixed=false)=>{ctx.save();if(g.screen){if(!fixed)[x,y]=g.screen(x,y);ctx.setTransform(g.dpr,0,0,g.dpr,0,0)}ctx.font='12px Arial';ctx.textAlign=align;ctx.lineWidth=4;ctx.strokeStyle='#111610';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore()};
  if(focus)label(`${activeLayer?.name||'Layer unresolved'} · ${heightKm.toFixed(1)} km`,16,18,'#ecd399','left',true);
  if(focus?.arrived)label('Arrived',g.w-16,18,'#81d5cd','right',true);
  label('A',source[0]-8,source[1]+18,'#e5ce99','right');
  label(returned?'B':'No return',end[0]+8,end[1]+18,returned?'#9cded6':'#bdc5c2');
  ctx.restore();entry.canvas.dataset.atmospherePhase=phase;entry.canvas.dataset.atmosphereStatus=ray.status;
  entry.canvas.dataset.atmosphereLayer=activeLayer?.name||'unresolved';entry.canvas.dataset.atmosphereHeightKm=focus?heightKm.toFixed(3):'';
  entry.canvas.dataset.trackedPulseStart=focus?String(focus.start):'';
  entry.canvas.dataset.arrivalPhase=arrivals.length?'arrived':travelling.length?'travelling':'idle';
 }
 return {back,draw};
})();
