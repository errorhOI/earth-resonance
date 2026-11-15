'use strict';
window.AtmosphereGeo={
 destination(lat,lon,bearing,meters){const d=meters/6371000,r=Math.PI/180,p=lat*r,l=lon*r,b=bearing*r;
  const p2=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b));
  const l2=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2));
  return [p2/r,((l2/r+540)%360)-180];
 },
 pointAt(points,times,time){if(time<=0)return points[0];if(time>=times.at(-1))return points.at(-1);let lo=0,hi=times.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid]<=time)lo=mid;else hi=mid}const f=(time-times[lo])/(times[hi]-times[lo]);return points[lo].map((v,k)=>v+(points[hi][k]-v)*f)},
 coordinate(lat,lon){return Math.abs(lat).toFixed(1)+'°'+(lat>=0?'N':'S')+' '+Math.abs(lon).toFixed(1)+'°'+(lon>=0?'E':'W')}
};
class AtmosphereMap {
 constructor(viewer){this.viewer=viewer;this.profiles=[];this.profile=null;this.ray=null;this.enabled=true;this.heightScale=40;this.hits=[];
  let down;
  viewer.canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  viewer.canvas.addEventListener('click',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||!this.enabled)return;const rect=viewer.canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*viewer.canvas.width/rect.width,y=(e.clientY-rect.top)*viewer.canvas.height/rect.height;const nearest=this.hits.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];if(nearest&&nearest.d<12*(viewer.canvas.width/rect.width))this.onSelect?.(nearest.id)});
 }
 radiusAt(height){return 1+height/6371000*this.heightScale}
 select(profile,ray,focus=false){this.profile=profile;this.ray=ray;this.path=ray.path_m.map(([x,z])=>{const ll=AtmosphereGeo.destination(profile.latitude,profile.longitude,ray.bearing_deg,x);return [...ll,this.radiusAt(z)]});if(focus)this.focus()}
 focus(){if(!this.profile)return;const v=this.viewer;v.yaw=-this.profile.longitude*Math.PI/180+.95;v.pitch=this.profile.latitude*Math.PI/180-.2;v.rotation=false;v.onRotateChange?.(false);v.setZoom(.86)}
 project(lat,lon,radius,w,h){const v=this.viewer;
  if(v.flat){const m=v.flatRect(w,h);return {x:m.left+(lon+180)/360*m.width,y:m.top+(90-lat)/180*m.height,visible:true}}
  const r=Math.PI/180,p=lat*r,l=lon*r,x=Math.cos(p)*Math.sin(l),y=Math.sin(p),z=Math.cos(p)*Math.cos(l),cy=Math.cos(v.yaw),sy=Math.sin(v.yaw),cp=Math.cos(v.pitch),sp=Math.sin(v.pitch);
  const xx=cy*x+sy*z,zz=-sy*x+cy*z,yy=cp*y-sp*zz,depth=sp*y+cp*zz;
  return {x:w/2+xx*radius*v.radius,y:h/2-yy*radius*v.radius,visible:depth>=0||radius*Math.hypot(xx,yy)>1,depth};
 }
 draw(ctx,w,h,dpr){this.hits=[];this.viewer.canvas.dataset.arrivalPhase='idle';if(!this.enabled||!this.profile)return;
  const v=this.viewer,project=p=>this.project(...p,w,h),source=project([this.profile.latitude,this.profile.longitude,1]);
  const line=(points,color,width,dash=[])=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width*dpr;ctx.setLineDash(dash.map(x=>x*dpr));let last=null;for(const ll of points){const q=project(ll);if(!q.visible){last=null;continue}if(!last||(v.flat&&Math.abs(q.x-last.x)>w*.4))ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);last=q}ctx.stroke();ctx.setLineDash([])};
  const dot=(p,color,size)=>{if(!p.visible)return;ctx.beginPath();ctx.arc(p.x,p.y,size*dpr,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#121511';ctx.lineWidth=1.5*dpr;ctx.stroke()};
  const label=(p,text,side)=>{if(!p.visible)return;ctx.font=12*dpr+'px Arial';ctx.textAlign=side;ctx.lineWidth=3*dpr;ctx.strokeStyle='#101110';ctx.fillStyle='#e9e6d9';const x=p.x+(side==='right'?-10:10)*dpr,y=p.y+17*dpr;ctx.strokeText(text,x,y);ctx.fillText(text,x,y)};
  for(const p of this.profiles){const q=project([p.latitude,p.longitude,1]);if(q.visible){this.hits.push({...q,id:p.id});if(p.id!==this.profile.id)dot(q,'#a6aea0',2.8)}}
  line(this.path.map(p=>[p[0],p[1],1]),'#76cfc377',1,[3,4]);line(this.path,'#76cfc3',2);
  dot(source,'#a8e4dc',4.5);label(source,'Source','right');
  const returned=this.ray.status==='returned',last=this.path.at(-1),receiver=project(last);
  if(returned){dot(receiver,'#81d5cd',4.5);label(receiver,'Receiver','left')}
  if(returned&&!v.flat){
   const top=this.ray.path_m.reduce((best,p,i,a)=>p[1]>a[best][1]?i:best,0),peak=this.path[top],q=project(peak);
   const guide=[];for(let a=-12;a<=12;a+=.4){const ll=AtmosphereGeo.destination(peak[0],peak[1],this.ray.bearing_deg,a*6371000*Math.PI/180);guide.push([...ll,peak[2]])}
   if(v.atmosphere)line(guide,'#76cfc399',1,[3,4]);
   dot(q,'#c8f2ec',3);if(q.visible){ctx.font=12*dpr+'px Arial';ctx.textAlign='right';ctx.fillStyle='#a8e4dc';ctx.strokeStyle='#101110';ctx.lineWidth=3*dpr;const text=this.ray.turning_height_km.toFixed(1)+' km · turn';ctx.strokeText(text,q.x-10*dpr,q.y-10*dpr);ctx.fillText(text,q.x-10*dpr,q.y-10*dpr)}
  }
  const playback=window.soundLabController?.playback?.();
  if(!playback?.active||!(playback.propagation||playback.arrival)||playback.profileId!==this.profile.id||playback.bearing!==this.ray.bearing_deg||playback.angle!==this.ray.angle_deg)return;
  const total=this.ray.path_seconds.at(-1),pulses=playback.live?playback.pulses:[playback.seconds];
  for(const seconds of pulses){const actual=seconds*1000;if(playback.live&&actual>total+700)continue;
   if(actual<=total){this.viewer.canvas.dataset.arrivalPhase='travelling';const [x,z]=AtmosphereGeo.pointAt(this.ray.path_m,this.ray.path_seconds,actual),ll=AtmosphereGeo.destination(this.profile.latitude,this.profile.longitude,this.ray.bearing_deg,x);dot(project([...ll,this.radiusAt(z)]),'#ffffff',5)}
   if(actual>=total)this.viewer.canvas.dataset.arrivalPhase=returned?'arrived':'exited';
   if(returned&&actual>=total&&actual<total+700&&receiver.visible){const f=(actual-total)/700;ctx.beginPath();ctx.arc(receiver.x,receiver.y,(6+25*f)*dpr,0,2*Math.PI);ctx.strokeStyle=`rgba(129,213,205,${1-f})`;ctx.lineWidth=2*dpr;ctx.stroke()}
  }
 }
}
window.AtmosphereMap=AtmosphereMap;
