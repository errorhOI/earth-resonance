'use strict';
window.FlatMapView=class FlatMapView {
 constructor(){this.zoom=1;this.panX=0;this.panY=0;}
 rect(w,h,aspect){
  const width=.9*Math.min(w,h*aspect)*this.zoom,height=width/aspect;
  const px=Math.max(-Math.max(0,(width-w)/2),Math.min(Math.max(0,(width-w)/2),this.panX*w));
  const py=Math.max(-Math.max(0,(height-h)/2),Math.min(Math.max(0,(height-h)/2),this.panY*h));
  this.panX=px/w;this.panY=py/h;
  return {width,height,left:(w-width)/2+px,top:(h-height)/2+py};
 }
 zoomAt(factor,x,y,w,h,aspect){
  const old=this.rect(w,h,aspect),u=(x-old.left)/old.width,v=(y-old.top)/old.height;
  this.zoom=Math.max(1,Math.min(8,this.zoom*factor));
  const next=this.rect(w,h,aspect);
  this.panX=(x-u*next.width-(w-next.width)/2)/w;
  this.panY=(y-v*next.height-(h-next.height)/2)/h;
  this.rect(w,h,aspect);
 }
 pan(dx,dy,w,h,aspect){this.panX+=dx/w;this.panY+=dy/h;this.rect(w,h,aspect);}
 reset(){this.zoom=1;this.panX=0;this.panY=0;}
};
