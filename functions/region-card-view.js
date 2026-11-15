'use strict';
window.RegionCardView=class RegionCardView {
 constructor(){this.zoom=1;this.x=0;this.y=0;}
 clamp(){const limit=(this.zoom-1)/2;this.x=Math.max(-limit,Math.min(limit,this.x));this.y=Math.max(-limit,Math.min(limit,this.y));}
 point(x,y,w,h){return [w/2+(x-w/2)*this.zoom+this.x*w,h/2+(y-h/2)*this.zoom+this.y*h];}
 zoomAt(factor,u,v){
  const old=this.zoom;this.zoom=Math.max(1,Math.min(4,old*factor));
  this.x=u-.5-(u-.5-this.x)*this.zoom/old;this.y=v-.5-(v-.5-this.y)*this.zoom/old;this.clamp();
 }
 pan(dx,dy){this.x+=dx;this.y+=dy;this.clamp();}
 reset(){this.zoom=1;this.x=0;this.y=0;}
 apply(ctx,w,h){ctx.translate(w/2+this.x*w,h/2+this.y*h);ctx.scale(this.zoom,this.zoom);ctx.translate(-w/2,-h/2);}
 bind(canvas){
  let drag=null;canvas.tabIndex=0;
  canvas.title='Scroll to zoom · Drag to pan · Home to reset';
  canvas.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),unit=e.deltaMode===1?16:e.deltaMode===2?r.height:1;
   this.zoomAt(Math.exp(Math.max(-.4,Math.min(.4,-e.deltaY*unit*.0015))),(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
  },{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus({preventScroll:true});if(this.zoom===1)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('panning');});
  canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;const r=canvas.getBoundingClientRect();this.pan((e.clientX-drag.x)/r.width,(e.clientY-drag.y)/r.height);drag.x=e.clientX;drag.y=e.clientY;});
  const release=()=>{drag=null;canvas.classList.remove('panning');};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release);
  canvas.addEventListener('keydown',e=>{if(e.key==='Home'){e.preventDefault();this.reset()}else if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoomAt(e.key==='-'?1/1.2:1.2,.5,.5)}});
 }
};
