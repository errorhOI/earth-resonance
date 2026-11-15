'use strict';
class AtmosphereShell {
 constructor(gl){
  this.gl=gl;
  const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();
  gl.attachShader(this.program,shader(gl.VERTEX_SHADER,'attribute vec2 aPoint;void main(){gl_Position=vec4(aPoint,0.,1.);}'));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
   precision mediump float;
   uniform vec2 uSize;uniform float uRadius;uniform vec3 uBounds;uniform bool uResolved;
   vec4 layer(vec2 p,float inner,float outer,vec3 tint){
    float rho=length(p);if(rho>=outer)return vec4(0.);
    float z1=sqrt(max(0.,outer*outer-rho*rho));
    float z0=sqrt(max(0.,inner*inner-rho*rho));
    // Earth hides the rear atmosphere inside its silhouette.
    float lengthThrough=(z1-z0)*(rho<1.?1.:2.);
    float alpha=1.-exp(-lengthThrough*.55);
    // A front-quarter cutaway exposes the interior. Rear volume stays visible.
    float cut=smoothstep(.10,.45,p.x/outer)*smoothstep(-.60,-.25,p.y/outer);
    alpha*=mix(1.,rho<1.?.12:.55,cut);
    float rim=exp(-abs(rho-outer)*180.)*.27;
    alpha=clamp(alpha+rim,0.,.48);
    vec3 normal=normalize(vec3(p,z1));
    float light=.65+.35*max(dot(normal,normalize(vec3(-.5,.6,1.))),0.);
    return vec4(tint*light,alpha);
   }
   void main(){
    vec2 p=(gl_FragCoord.xy-uSize*.5)/uRadius;
    if(length(p)>uBounds.z+.015)discard;
    vec4 a=layer(p,1.,uBounds.x,vec3(.32,.61,.70));
    vec4 b=layer(p,uBounds.x,uBounds.y,vec3(.36,.53,.68));
    vec4 c=layer(p,uBounds.y,uBounds.z,vec3(.22,.42,.56));
    if(!uResolved){a=vec4(0.);b=vec4(0.);c=layer(p,1.,uBounds.z,vec3(.4,.45,.47));}
    vec3 rgb=a.rgb*a.a;float alpha=a.a;
    rgb=b.rgb*b.a+rgb*(1.-b.a);alpha=b.a+alpha*(1.-b.a);
    rgb=c.rgb*c.a+rgb*(1.-c.a);alpha=c.a+alpha*(1.-c.a);
    gl_FragColor=vec4(rgb,alpha);
   }`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.slot=gl.getAttribLocation(this.program,'aPoint');
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  this.u={};for(const key of ['uSize','uRadius','uBounds','uResolved'])this.u[key]=gl.getUniformLocation(this.program,key);
 }
 draw(viewer,w,h){
  const model=viewer.map.profile?.thermal_layers;if(!model||viewer.flat||!viewer.atmosphere||!viewer.map.enabled)return;
  const gl=this.gl,r=km=>viewer.map.radiusAt(km*1000),resolved=model.status==='estimated';
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.slot);gl.vertexAttribPointer(this.slot,2,gl.FLOAT,false,0,0);
  gl.uniform2f(this.u.uSize,w,h);gl.uniform1f(this.u.uRadius,viewer.radius);
  gl.uniform3f(this.u.uBounds,r(model.tropopause?.height_km||0),r(model.stratopause?.height_km||0),r(model.coverage_top_km));gl.uniform1i(this.u.uResolved,resolved?1:0);
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);
 }
}
window.AtmosphereShell=AtmosphereShell;
