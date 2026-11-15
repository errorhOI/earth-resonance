'use strict';
(() => {
 const mode=$('atmosphereOverlay'),bearing=$('overlayBearing'),angle=$('overlayAngle');
 const note=$('coverageNote'),settings=$('overlaySettings'),controls=$('coverageControls');
 const raster=document.createElement('canvas');raster.width=1440;raster.height=720;
 const ctx=raster.getContext('2d');let bundle=null,error=false,cacheKey='';
 for(const [target,source] of [[bearing,$('bearing')],[angle,$('angle')]]){
  for(const option of source.options)target.add(new Option(source.id==='angle'?option.value+'°':option.textContent,option.value));
  target.value=source.value;
  target.onchange=()=>{source.value=target.value;source.dispatchEvent(new Event('change'));refresh()};
 }
 function refresh(){
  bearing.value=$('bearing').value;angle.value=$('angle').value;
  const supported=$('dataset').value!=='imported',active=supported&&mode.value!=='off';
  controls.hidden=!supported;settings.hidden=mode.value!=='returns'&&!window.regionSelection;note.hidden=!active;
  if(!active)return;
  if(error){note.textContent='Overlay unavailable. Select a region to check its profile.';return}
  if(!bundle){note.textContent='Loading atmosphere overlay…';return}
  const available=bundle.coverage.reduce((sum,n)=>sum+n,0),total=bundle.coverage.length;
  const bi=bundle.bearings.indexOf(+bearing.value),ai=bundle.angles.indexOf(+angle.value);
  const values=mode.value==='coverage'?bundle.coverage:bundle.statuses[bi*bundle.angles.length+ai];
  const key=mode.value+':'+bi+':'+ai;if(key!==cacheKey){cacheKey=key;paint(values)}
  if(mode.value==='coverage'){
   note.textContent=`Teal: data available · ${available.toLocaleString()} / ${total.toLocaleString()} cells · 1 Jan 2025`;
   if(available<total)note.textContent+=' · Hatched: unavailable';
  }else{
   note.textContent='Teal: modeled return · Gray: no return within limits · 1 Jan 2025';
   if(values.includes(0))note.textContent+=' · Hatched: unavailable';
  }
 }
 function paint(values){
  ctx.clearRect(0,0,raster.width,raster.height);
  const lat=bundle.latitude,lon=bundle.longitude,s=4;
  for(let y=0;y<lat.length;y++)for(let x=0;x<lon.length;x++){
   const north=y===lat.length-1?90:(lat[y]+lat[y+1])/2;
   const south=y===0?-90:(lat[y]+lat[y-1])/2;
   const code=values[y*lon.length+x],covered=bundle.coverage[y*lon.length+x];
   const west=x===0?(lon.at(-1)-360+lon[0])/2:(lon[x-1]+lon[x])/2;
   const east=x===lon.length-1?(lon[x]+lon[0]+360)/2:(lon[x]+lon[x+1])/2;
   for(const shift of [-360,0,360]){
    const left=Math.max(-180,west+shift),right=Math.min(180,east+shift);if(left>=right)continue;
    const px=(left+180)*s,py=(90-north)*s,w=(right-left)*s,h=(north-south)*s;
    ctx.fillStyle=!covered?'rgba(229,172,103,.16)':mode.value==='coverage'?'rgba(98,216,193,.10)':code===1?'rgba(98,216,193,.18)':'rgba(100,105,111,.08)';
    ctx.fillRect(px,py,w,h);
    ctx.strokeStyle='rgba(180,218,209,.05)';ctx.lineWidth=.65;ctx.strokeRect(px,py,w,h);
    if(!covered){ctx.save();ctx.beginPath();ctx.rect(px,py,w,h);ctx.clip();ctx.strokeStyle='rgba(229,172,103,.45)';ctx.lineWidth=1;for(let n=-h;n<w;n+=8){ctx.beginPath();ctx.moveTo(px+n,py);ctx.lineTo(px+n+h,py+h);ctx.stroke()}ctx.restore()}
   }
  }
 }
 window.atmosphereCoverage={draw(context,w,h,viewer){
  if(!bundle||error||mode.value==='off'||$('dataset').value==='imported')return;
  const {width,height,left,top}=viewer.flatRect(w,h);
  context.drawImage(raster,left,top,width,height);
 }};
 mode.onchange=refresh;
 window.addEventListener('atmosphere-selected',refresh);
 window.addEventListener('visual-source-changed',refresh);
 $('dataset').addEventListener('change',refresh);
 fetch('atmosphere-coverage.json').then(response=>{if(!response.ok)throw Error('Unavailable');return response.json()}).then(value=>{
  if(value.coverage.length!==value.latitude.length*value.longitude.length||value.statuses.length!==value.bearings.length*value.angles.length||value.statuses.some(row=>row.length!==value.coverage.length))throw Error('Invalid coverage grid');
  bundle=value;refresh();
 }).catch(()=>{error=true;refresh()});
 refresh();
})();
