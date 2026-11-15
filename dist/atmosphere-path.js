'use strict';
(() => {
 const dialog=$('details'),svg=$('bendingPath');
 const ns='http://www.w3.org/2000/svg',plot={left:52,right:680,top:30,bottom:276};
 let profile=null,ray=null,dot=null,ceiling=60,distance=1,renderWidth=0;
 function el(tag,attrs={},text,parent=svg){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;parent.append(node);return node}
 function valueAt(values,height){const z=profile.height_m;if(height<=z[0])return values[0];for(let i=1;i<z.length;i++)if(height<=z[i]){const f=(height-z[i-1])/(z[i]-z[i-1]);return values[i-1]+(values[i]-values[i-1])*f}return values.at(-1)}
 const x=meters=>plot.left+meters/1000/distance*(plot.right-plot.left);
 const y=meters=>plot.bottom-meters/1000/ceiling*(plot.bottom-plot.top);
 function marker(){
  if(!ray||!dot)return;
  const point=ray.path_m[0];
  dot.setAttribute('cx',x(point[0]));dot.setAttribute('cy',y(point[1]));
  const t=valueAt(profile.temperature_k,point[1]),b=ray.bearing_deg*Math.PI/180;
  const wind=valueAt(profile.u_ms,point[1])*Math.sin(b)+valueAt(profile.v_ms,point[1])*Math.cos(b);
  // Match the ray's piecewise-linear effective-speed profile exactly.
  const effective=profile.temperature_k.map((temp,i)=>Math.sqrt(1.4*287.05*temp)+profile.u_ms[i]*Math.sin(b)+profile.v_ms[i]*Math.cos(b));
  $('pathTemperature').textContent=(t-273.15).toFixed(1)+' °C';
  $('pathWind').textContent=(wind>=0?'+':'')+wind.toFixed(1)+' m/s';
  $('pathSpeed').textContent=valueAt(effective,point[1]).toFixed(1)+' m/s';
  $('pathAltitude').textContent=(point[1]/1000).toFixed(1)+' km';
  const layers=profile.thermal_layers?.layers||[],height=point[1]/1000;
  $('pathLayer').textContent=layers.find((l,i)=>height>=l.bottom_km&&(height<l.top_km||i===layers.length-1&&height<=l.top_km+1e-6))?.name||'Not resolved';
 }
 function build(){
  const selected=window.regionSelection;profile=selected?.profile;ray=currentRay;
  $('bendingPathPanel').hidden=!profile||!ray;if(!profile||!ray)return;
  svg.replaceChildren();
  renderWidth=Math.max(340,Math.round(svg.clientWidth));plot.right=renderWidth-24;svg.setAttribute('viewBox',`0 0 ${renderWidth} 330`);
  ceiling=Math.ceil(profile.height_m.at(-1)/10000)*10;
  distance=Math.max(1,Math.ceil(Math.max(...ray.path_m.map(p=>p[0]))/10000)*10);
  const title=el('title',{},'Modeled sound path through the selected atmospheric profile');
  const description=el('desc',{},'Calculated sound route. Height is vertical and distance is horizontal.');
  title.id='bendingPathTitle';description.id='bendingPathDescription';
  for(let k=0;k<=4;k++){
   const height=ceiling*k/4,py=y(height*1000);el('line',{x1:plot.left,y1:py,x2:plot.right,y2:py,stroke:'#38413c','stroke-width':.7});
   el('text',{x:plot.left-9,y:py+4,'text-anchor':'end'},height.toFixed(0));
   const dx=distance*k/4;el('text',{x:x(dx*1000),y:plot.bottom+20,'text-anchor':'middle'},dx.toFixed(0));
  }
  el('text',{x:plot.left,y:16},'Height · km');el('text',{x:(plot.left+plot.right)/2,y:320,'text-anchor':'middle'},'Distance along path · km');
  el('path',{d:ray.path_m.map(([a,b],i)=>(i?'L':'M')+x(a)+' '+y(b)).join(' '),fill:'none',stroke:'#76cfc3','stroke-width':2.2});
  const first=ray.path_m[0],last=ray.path_m.at(-1),returned=ray.status==='returned';
  for(const [point,color] of [[first,'#76cfc3'],[last,returned?'#81d5cd':'#b0b5ab']])el('circle',{cx:x(point[0]),cy:y(point[1]),r:4,fill:color});
  el('text',{x:x(first[0])+6,y:y(first[1])-9},'Sound starts');
  el('text',{x:x(last[0])-6,y:Math.max(22,y(last[1])-9),'text-anchor':'end'},returned?'Sound arrives':'Model ends here');
  dot=el('circle',{r:5,fill:'#fff',stroke:'#171916','stroke-width':1.5});
  $('simplePathHeight').textContent=(Math.max(...ray.path_m.map(p=>p[1]))/1000).toFixed(1)+' km';
  marker();
 }
 $('pathSources').onclick=()=>{dialog.close();window.openSourceDetails()};
 $('pathMap').onclick=()=>{dialog.close();$('flatView').click();$('globe').focus()};
 new MutationObserver(()=>{if(dialog.open)build()}).observe(dialog,{attributes:true,attributeFilter:['open']});
 window.addEventListener('atmosphere-selected',()=>{if(dialog.open)build()});
 new ResizeObserver(()=>{if(dialog.open&&Math.max(340,Math.round(svg.clientWidth))!==renderWidth)build()}).observe(svg);
})();
