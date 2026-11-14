'use strict';
// Minimal renderer for the packaged GLB's POSITION/NORMAL/TEXCOORD_0 mesh.
// The real video is decoded by the browser; each new frame replaces its texture.
class EarthGlobe {
 constructor(canvas,overlay,base64){
  this.canvas=canvas;this.overlay=overlay;this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
  if(!this.gl)throw Error('WebGL is unavailable. Use a browser with hardware acceleration.');
  this.flatView=new FlatMapView();this.mapPan=null;this.yaw=.52;this.pitch=-.14;this.zoom=1;this.rotation=true;this.flat=false;this.atmosphere=true;this.ocean=true;this.aspect=2;this.source=null;this.dirty=true;this.lastTextureTime=-1;
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('Invalid globe GLB');
  const jsonLength=view.getUint32(12,true),model=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength))),binaryStart=28+jsonLength;
  const primitive=model.meshes[0].primitives[0],gl=this.gl;
  const readAccessor=index=>{const a=model.accessors[index],b=model.bufferViews[a.bufferView];const n={VEC3:3,VEC2:2,SCALAR:1}[a.type],T=a.componentType===5123?Uint16Array:Float32Array;return new T(bytes.buffer,binaryStart+(b.byteOffset||0)+(a.byteOffset||0),a.count*n)};
  const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform float uYaw,uPitch,uAspect,uScale,uTextureAspect;uniform bool uFlat;uniform vec2 uPan;varying vec2 vUV;varying vec3 vNormal;
  void main(){vec3 p=aPosition;vec3 n=aNormal;float cy=cos(uYaw),sy=sin(uYaw),cx=cos(uPitch),sx=sin(uPitch);mat3 ry=mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy);mat3 rx=mat3(1.,0.,0.,0.,cx,sx,0.,-sx,cx);p=rx*ry*p;n=rx*ry*n;if(uFlat){p=vec3(aUV.x*2.-1.,(1.-aUV.y*2.)/uTextureAspect,0.);n=vec3(0.,0.,1.);}gl_Position=vec4(p.x*uScale/uAspect,p.y*uScale,-p.z*.2,1.);if(uFlat)gl_Position.xy+=uPan;vUV=aUV;vNormal=n;}`;
  const fragment=`precision mediump float;uniform sampler2D uMap;uniform bool uOcean,uFlat;varying vec2 vUV;varying vec3 vNormal;void main(){vec3 c=texture2D(uMap,vUV).rgb;if(uOcean&&!uFlat&&vUV.x<.18&&vUV.y>.906)c=vec3(.13);float light=uFlat?1.:.62+.38*max(dot(normalize(vNormal),normalize(vec3(-.5,.5,1.))),0.);gl_FragColor=vec4(c*light,1.);}`;
  const shader=(kind,code)=>{const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.attributes=[];
  for(const [attribute,key,n] of [['aPosition','POSITION',3],['aNormal','NORMAL',3],['aUV','TEXCOORD_0',2]]){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,readAccessor(primitive.attributes[key]),gl.STATIC_DRAW);const slot=gl.getAttribLocation(this.program,attribute);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,n,gl.FLOAT,false,0,0);this.attributes.push({buffer,slot,n})}
  const indices=readAccessor(primitive.indices);this.count=indices.length;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  this.uniforms={};for(const name of ['uYaw','uPitch','uAspect','uScale','uTextureAspect','uFlat','uOcean','uMap','uPan'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([20,20,20,255]));gl.enable(gl.DEPTH_TEST);
  this.drag=null;this.pointers=new Map();this.pinch=null;
  const distance=()=>{const p=[...this.pointers.values()];return Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1])};
  canvas.addEventListener('pointerdown',e=>{if(this.flat){if(e.button===1||e.button===2||e.shiftKey){e.preventDefault();this.mapPan={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')}return;}this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.rotation=false;canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');this.onRotateChange?.(false);
   if(this.pointers.size===1)this.drag=[e.clientX,e.clientY];else{this.drag=null;this.pinch={distance:Math.max(1,distance()),zoom:this.zoom}}
  });
  canvas.addEventListener('pointermove',e=>{if(this.mapPan?.id===e.pointerId){const r=canvas.getBoundingClientRect();this.flatView.pan(e.clientX-this.mapPan.x,e.clientY-this.mapPan.y,r.width,r.height,this.aspect);this.mapPan.x=e.clientX;this.mapPan.y=e.clientY;return;}if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,[e.clientX,e.clientY]);
   if(this.pointers.size>=2&&this.pinch){this.setZoom(this.pinch.zoom*distance()/this.pinch.distance);return}
   if(!this.drag)return;this.yaw+=(e.clientX-this.drag[0])*.008/this.zoom;this.pitch=Math.max(-1.35,Math.min(1.35,this.pitch+(e.clientY-this.drag[1])*.008/this.zoom));this.drag=[e.clientX,e.clientY];
  });
  const release=e=>{if(this.mapPan?.id===e.pointerId)this.mapPan=null;this.pointers.delete(e.pointerId);this.pinch=null;this.drag=this.pointers.size===1?[...this.pointers.values()][0]:null;if(!this.pointers.size)canvas.classList.remove('dragging')};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('contextmenu',e=>{if(this.flat)e.preventDefault()});
  canvas.addEventListener('wheel',e=>{if(e.ctrlKey)return;const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;
   if(this.flat){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,m=this.flatRect(r.width,r.height);if(x<m.left||x>m.left+m.width||y<m.top||y>m.top+m.height)return;e.preventDefault();this.flatView.zoomAt(Math.exp(Math.max(-.4,Math.min(.4,-e.deltaY*unit*.0015))),x,y,r.width,r.height,this.aspect);}
   else{e.preventDefault();this.setZoom(this.zoom*Math.exp(Math.max(-.4,Math.min(.4,-e.deltaY*unit*.0015))))}
  },{passive:false});
  canvas.addEventListener('keydown',e=>{if(this.flat){const r=canvas.getBoundingClientRect();if(e.key==='Home'){e.preventDefault();this.flatView.reset()}else if(['+','=','-'].includes(e.key)){e.preventDefault();this.flatView.zoomAt(e.key==='-'?1/1.2:1.2,r.width/2,r.height/2,r.width,r.height,this.aspect)}return;}if(e.key==='+'||e.key==='='){e.preventDefault();this.setZoom(this.zoom*1.2)}else if(e.key==='-'){e.preventDefault();this.setZoom(this.zoom/1.2)}else if(e.key==='Home'){e.preventDefault();this.setZoom(1)}});
  this.map=new AtmosphereMap(this);
  this.shell=new AtmosphereShell(gl);
  this.previous=performance.now();this.animate=this.animate.bind(this);requestAnimationFrame(this.animate);
 }
 setSource(source,ocean=false){this.source=source;this.ocean=ocean;this.dirty=true;this.lastTextureTime=-1;this.aspect=(source.videoWidth||source.naturalWidth||2)/(source.videoHeight||source.naturalHeight||1);window.dispatchEvent(new Event('visual-source-changed'))}
 setFlat(value){this.flat=value;this.drag=null;this.pinch=null;this.pointers.clear()}
 flatRect(w,h){return this.flatView.rect(w,h,this.aspect)}
 flatScale(aspect){return this.flatRect(aspect,1).width}
 setZoom(value){if(!Number.isFinite(value))return;this.zoom=Math.max(.75,Math.min(3,value));this.onZoomChange?.(this.zoom)}
 animate(now){
  const dt=Math.min((now-this.previous)/1000,.1);this.previous=now;
  if(this.rotation&&!this.flat&&!this.drag)this.yaw+=dt*.045;
  const gl=this.gl,rect=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(!rect.width||!rect.height||document.hidden){requestAnimationFrame(this.animate);return}
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.overlay.width=w;this.overlay.height=h;gl.viewport(0,0,w,h)}
  const mapRect=this.flatRect(w,h);
  const a=w/h,scale=this.flat?this.flatScale(a):.79*Math.min(1,a)*this.zoom;this.radius=scale*h/2;
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  gl.uniform2f(this.uniforms.uPan,this.flat?2*(mapRect.left+mapRect.width/2-w/2)/w:0,this.flat?-2*(mapRect.top+mapRect.height/2-h/2)/h:0);
  gl.uniform1f(this.uniforms.uYaw,this.yaw);gl.uniform1f(this.uniforms.uPitch,this.pitch);gl.uniform1f(this.uniforms.uAspect,a);gl.uniform1f(this.uniforms.uScale,scale);gl.uniform1f(this.uniforms.uTextureAspect,this.aspect);gl.uniform1i(this.uniforms.uFlat,this.flat?1:0);gl.uniform1i(this.uniforms.uOcean,this.ocean?1:0);
  const isVideo=this.source instanceof HTMLVideoElement;
  if(this.source&&(!isVideo||this.source.readyState>=2)&&(this.dirty||(isVideo&&this.source.currentTime!==this.lastTextureTime))){
   try{gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.source);this.dirty=false;this.lastTextureTime=isVideo?this.source.currentTime:0}catch(error){this.source=null;this.onError?.(error.message)}
  }
  for(const a of this.attributes){gl.bindBuffer(gl.ARRAY_BUFFER,a.buffer);gl.enableVertexAttribArray(a.slot);gl.vertexAttribPointer(a.slot,a.n,gl.FLOAT,false,0,0)}
  gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);this.shell.draw(this,w,h);this.drawOverlay(w,h,ratio,now);requestAnimationFrame(this.animate);
 }
 drawOverlay(w,h,dpr,now){
   const ctx=this.overlay.getContext('2d');ctx.clearRect(0,0,w,h);if(this.flat){window.atmosphereCoverage?.draw(ctx,w,h,this);this.map?.draw(ctx,w,h,dpr);this.drawRegion(ctx,w,h,dpr);window.MapEndpoints?.draw(ctx,w,h,dpr,this,window.regionSelection,currentRay);return;}
  const cx=w/2,cy=h/2,r=this.radius;ctx.lineWidth=dpr*.75;
  const ring=r+8*dpr;ctx.beginPath();for(let i=0;i<=192;i++){const a=i/192*2*Math.PI;const sample=this.spectrum?.[i%128]||0;const rr=ring+sample/255*20*dpr;const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=this.spectrum?'rgba(211,190,142,.65)':'rgba(165,164,155,.18)';ctx.stroke();
  this.map?.draw(ctx,w,h,dpr);
  this.drawRegion(ctx,w,h,dpr);
 }
 drawRegion(ctx,w,h,dpr){
  const b=this.regionBox;if(!b)return;
  const project=(u,v)=>this.map.project(90-v*180,u*360-180,1.002,w,h);
  const line=points=>{ctx.beginPath();let last=null;for(const p of points){const q=project(...p);if(!q.visible){last=null;continue}if(last)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);last=q}ctx.stroke()};
  ctx.strokeStyle='#e7d29b';ctx.lineWidth=1.5*dpr;ctx.setLineDash([5*dpr,4*dpr]);
  for(const [a,z] of [[[b.left,b.top],[b.right,b.top]],[[b.right,b.top],[b.right,b.bottom]],[[b.right,b.bottom],[b.left,b.bottom]],[[b.left,b.bottom],[b.left,b.top]]]){
   const points=[];for(let i=0;i<=40;i++)points.push([a[0]+(z[0]-a[0])*i/40,a[1]+(z[1]-a[1])*i/40]);line(points)
  }ctx.setLineDash([]);
  const fraction=SoundTiming.scan(window.soundLabController?.playback?.(),window.regionSelection);
  if(fraction!==null){const u=b.left+(b.right-b.left)*fraction;ctx.strokeStyle='#f7ead0';ctx.lineWidth=2*dpr;line([[u,b.top],[u,b.bottom]])}
 }
}
window.EarthGlobe=EarthGlobe;
