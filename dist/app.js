'use strict';
const $=id=>document.getElementById(id), data=window.ATMOSPHERE_RESULTS;
let globe, currentRay, analyser, playing=false;
let mediaVersion=0, currentVideo=null, importedURL=null, sourceOffset=0, sourceFPS=NASA_MEDIA.ocean.fps;
const oceanVideo=document.createElement('video'),aerosolVideo=document.createElement('video');
function configureVideo(v){v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';return v}
configureVideo(oceanVideo);configureVideo(aerosolVideo);
const bytes=encoded=>Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
oceanVideo.src=URL.createObjectURL(new Blob([bytes(NASA_MEDIA.ocean.video_base64)],{type:'video/mp4'}));
aerosolVideo.src=URL.createObjectURL(new Blob([bytes(NASA_MEDIA.aerosols.video_base64)],{type:NASA_MEDIA.aerosols.video_type}));
function setVisualStatus(text){$('visualStatus').textContent=text}
function bindVideo(v){v.addEventListener('loadeddata',()=>{if(currentVideo===v){globe?.setSource(v,v===oceanVideo);if(globe)globe.mediaKind=v===oceanVideo?'ocean':v===aerosolVideo?'aerosols':'imported';$('time').max=v.duration;v.play().catch(()=>setVisualStatus('Select a region and press Play.'))}});v.addEventListener('error',()=>{if(currentVideo===v)setVisualStatus('This video could not be decoded. Try an MP4/H.264 video.')})}
bindVideo(oceanVideo);bindVideo(aerosolVideo);
function releaseImported(){if(currentVideo&&currentVideo!==oceanVideo&&currentVideo!==aerosolVideo){currentVideo.pause();currentVideo.removeAttribute('src');currentVideo.load()}if(importedURL){URL.revokeObjectURL(importedURL);importedURL=null}}
function setStill(src,version,ocean=false){const img=new Image();img.onload=()=>{if(version===mediaVersion&&(!currentVideo||currentVideo.readyState<2)){globe?.setSource(img,ocean);if(globe)globe.mediaKind=$('dataset').value}};img.onerror=()=>setVisualStatus('Unable to decode this image.');img.src=src}
function chooseDataset(){
 const version=++mediaVersion;if(globe)globe.mediaKind=null;releaseImported();oceanVideo.pause();aerosolVideo.pause();currentVideo=null;setVisualStatus('');
 $('dataset').querySelector('option[value="imported"]')?.remove();
 const ocean=$('dataset').value==='ocean';if(globe?.map)globe.map.enabled=false;sourceOffset=ocean?NASA_MEDIA.ocean.source_start_seconds:0;sourceFPS=ocean?NASA_MEDIA.ocean.fps:NASA_MEDIA.aerosols.fps;
 $('datasetTitle').textContent=ocean?'Ocean currents & temperature':'GEOS aerosols';
 DatasetPeriods.show(ocean?'ocean':'aerosols');
 $('legend').innerHTML=ocean?'<span class="temperature-scale"></span><span>Cooler → warmer surface water</span>':'<span><i class="dot" style="background:#4798df"></i>Sea salt</span><span><i class="dot" style="background:#d881c0"></i>Dust</span><span><i class="dot" style="background:#df7456"></i>Smoke</span><span><i class="dot" style="background:#7bad81"></i>Sulfate</span>';
 $('mediaNote').textContent=ocean?'ECCO2 · 2007–08 · NASA SVS':'GEOS · Aug–Sep 2024 · NASA GMAO / SVS';
 $('time').disabled=false;
 currentVideo=ocean?oceanVideo:aerosolVideo;setStill(NASA_MEDIA[ocean?'ocean':'aerosols'].poster,version,ocean);if(currentVideo.readyState>=2){globe?.setSource(currentVideo,ocean);if(globe)globe.mediaKind=ocean?'ocean':'aerosols';currentVideo.play().catch(()=>setVisualStatus('Select a region and press Play.'))}
 window.regionPicker?.invalidate();view(true);
}
function view(flat){globe?.setFlat(true);window.regionCards?.show(!flat);$('zoomControls').hidden=true}
function rotation(value){if(globe)globe.rotation=value;$('rotate').textContent=value?'Rotation on':'Rotation off';$('rotate').setAttribute('aria-pressed',value)}
$('zoomIn').onclick=()=>globe?.setZoom(globe.zoom*1.2);$('zoomOut').onclick=()=>globe?.setZoom(globe.zoom/1.2);$('zoomReset').onclick=()=>globe?.setZoom(1);
$('globeView').onclick=()=>view(false);$('flatView').onclick=()=>view(true);$('rotate').onclick=()=>rotation(!globe?.rotation);$('rings').onchange=()=>{if(globe)globe.atmosphere=$('rings').checked;$('layerLegend').hidden=!$('rings').checked};
$('dataset').onchange=chooseDataset;$('time').oninput=()=>{if(currentVideo&&Number.isFinite(currentVideo.duration))currentVideo.currentTime=+$('time').value};
$('import').onclick=()=>$('file').click();
$('file').onchange=()=>{
 const file=$('file').files[0];if(!file)return;if(file.size>250*1024*1024){setVisualStatus('Choose a media file smaller than 250 MB.');return}if(!/^(image|video)\//.test(file.type)){setVisualStatus('Please choose an image or video.');return}
 window.regionPicker?.invalidate();const version=++mediaVersion;if(globe?.map)globe.map.enabled=false;releaseImported();oceanVideo.pause();aerosolVideo.pause();currentVideo=null;importedURL=URL.createObjectURL(file);sourceOffset=0;sourceFPS=0;
 if(!$('dataset').querySelector('option[value="imported"]'))$('dataset').add(new Option('Your imported media','imported'));$('dataset').value='imported';$('datasetTitle').textContent=file.name;$('datasetTitle').dataset.sourceName=file.name;$('legend').textContent='Colors are not interpreted automatically.';$('mediaNote').textContent='Local media · source and projection unverified. Nothing is uploaded. Globe wrapping may distort this image; use Flat map to see the original aspect ratio.';
 DatasetPeriods.show('imported');
 const isVideo=file.type.startsWith('video/');$('time').disabled=!isVideo;setVisualStatus('');
 if(isVideo){currentVideo=configureVideo(document.createElement('video'));bindVideo(currentVideo);currentVideo.src=importedURL}else{setStill(importedURL,version);$('timeValue').textContent='STILL IMAGE';$('frameNumber').textContent='1 IMAGE'}$('file').value='';
};
function stop(){window.soundLabController?.stop()}
function update(){
 stop();const p=data.profiles.find(p=>p.id===$('location').value);currentRay=p.rays.find(r=>r.bearing_deg===+$('bearing').value&&r.angle_deg===+$('angle').value);const returned=currentRay.status==='returned';
 $('range').textContent=returned?currentRay.landing_range_km.toFixed(1)+' km':'No return';$('height').textContent=returned?currentRay.turning_height_km.toFixed(1)+' km':'—';$('travel').textContent=returned?(currentRay.travel_seconds/60).toFixed(2)+' min':'—';$('delay').textContent=returned?(currentRay.travel_seconds/1000).toFixed(3)+' s':'—';window.soundLabController?.atmosphereChanged();
 if(globe?.map){const changed=globe.map.profile?.id!==p.id;globe.map.select(p,currentRay,changed)}
 const thermal=p.thermal_layers,layers=thermal?.layers||[],turn=currentRay.turning_height_km;
 $('layerLegend').innerHTML=layers.length?'<div class="layer-caption">Estimated layers · height ×40</div>'+layers.map(l=>`<span class="${returned&&turn>=l.bottom_km&&turn<l.top_km?'current-layer':''}">${l.name}<small>${l.bottom_km.toFixed(1)}–${l.top_km.toFixed(1)} km${l.name==='Lower mesosphere'?' · data top':''}</small></span>`).join(''):'<span>Layer boundaries unresolved</span>';
 $('layerTable').innerHTML=layers.length?'<table><caption>Estimated layers · km above model surface</caption><thead><tr><th>Layer</th><th>Base</th><th>Top</th><th>Thickness</th></tr></thead><tbody>'+layers.map(l=>`<tr><td>${l.name}</td><td>${l.bottom_km.toFixed(1)}</td><td>${l.top_km.toFixed(1)}</td><td>${l.thickness_km.toFixed(1)}</td></tr>`).join('')+'</tbody></table>':'Layer boundaries could not be resolved from this profile.';
 const receiver=returned?AtmosphereGeo.destination(p.latitude,p.longitude,currentRay.bearing_deg,currentRay.landing_range_km*1000):null;
 $('layerLegend').hidden=!window.regionSelection||!$('rings').checked;
 $('mapCoordinates').textContent='Atmosphere grid '+AtmosphereGeo.coordinate(p.latitude,p.longitude)+(receiver?' · Receiver '+AtmosphereGeo.coordinate(...receiver):'');
 $('outcome').textContent=returned?'Modeled arrival: '+(currentRay.travel_seconds/1000).toFixed(3)+' s after time compression.':'No return within model limits. Delayed arrival is unavailable.';
 $('profileStatus').textContent=p.label+' · '+p.latitude+'° latitude, '+p.longitude+'° longitude · '+data.time_label+' · historical sample';
 $('pathNote').textContent=returned?'Returns '+currentRay.landing_range_km.toFixed(1)+' km away at the starting height of '+(currentRay.source_height_km*1000).toFixed(0)+' m above the surface. This is a distant receiver, not an echo heard at the source.':'The ray exits the profile or exceeds the range limit. No delayed arrival is added.';
 const ymax=Math.ceil(p.height_m.at(-1)/10000)*10;chart('temperature',p.temperature_k.map((t,i)=>[t,p.height_m[i]/1000]),'Temperature · K','#c4ae7e',null,ymax);const a=+$('bearing').value*Math.PI/180;chart('wind',p.u_ms.map((u,i)=>[u*Math.sin(a)+p.v_ms[i]*Math.cos(a),p.height_m[i]/1000]),'Wind component · m/s','#96b7bd',null,ymax);$('sourceDetails').textContent=data.source_description+' '+data.height_method+' '+data.time_method;window.dispatchEvent(new Event('atmosphere-selected'));
}
for(const p of data.profiles)$('location').add(new Option(p.label,p.id));for(const id of ['location','bearing','angle'])$(id).onchange=update;
$('locateProfile').onclick=()=>view(true);
$('atmosphere').onclick=()=>$('details').showModal();$('closeDetails').onclick=()=>$('details').close();$('about').onclick=()=>{const r=window.regionSelection;$('selectedSourceDetails').hidden=!r;$('sourceRegionCoordinates').textContent=r?(r.kind==='ocean'?'Ocean':'Aerosols')+' · '+AtmosphereGeo.coordinate(r.latitude,r.longitude):'';$('credits').showModal()};$('closeCredits').onclick=()=>$('credits').close();
const spectrum=new Uint8Array(128);
function tick(){
 if(currentVideo&&Number.isFinite(currentVideo.duration)){$('time').value=currentVideo.currentTime;$('time').max=currentVideo.duration;const fmt=s=>Math.floor(s/60).toString().padStart(2,'0')+':'+Math.floor(s%60).toString().padStart(2,'0');const month=currentVideo===oceanVideo?OceanCalendar.label(currentVideo.currentTime,currentVideo.duration):'';$('timeValue').textContent=(month?month+' · ':'')+fmt(currentVideo.currentTime+sourceOffset)+' / '+fmt(currentVideo.duration+sourceOffset);$('timeValue').title=month?'Approximate model month, mapped across the full ocean animation.':'';$('frameNumber').textContent=sourceFPS?'FRAME '+Math.min(Math.ceil(currentVideo.duration*sourceFPS),Math.floor(currentVideo.currentTime*sourceFPS)+1).toString().padStart(3,'0'):'LOCAL VIDEO'}
 if(playing){analyser.getByteFrequencyData(spectrum);if(globe)globe.spectrum=spectrum}requestAnimationFrame(tick);
}
try{globe=new EarthGlobe($('globe'),$('overlay'),GLOBE_GLB);globe.map.profiles=data.profiles;globe.map.onSelect=id=>{$('location').value=id;update()};globe.onZoomChange=z=>{$('zoomReset').textContent=Math.round(z*100)+'%';$('zoomOut').disabled=z<=.75;$('zoomIn').disabled=z>=3};globe.onRotateChange=rotation;globe.onError=setVisualStatus;chooseDataset()}catch(error){setVisualStatus(error.message)}update();requestAnimationFrame(tick);
function chart(id,points,xlabel,color,xmax,ymax){
 const el=$(id),w=id==='ray'?1000:450,h=id==='ray'?350:320,L=65,R=25,T=20,B=48;
 const xmin=id==='ray'?0:Math.floor(Math.min(...points.map(p=>p[0]))/10)*10;
 xmax=xmax??Math.ceil(Math.max(...points.map(p=>p[0]))/10)*10;
 if(xmax<=xmin)xmax=xmin+1;
 const X=x=>L+(x-xmin)/(xmax-xmin)*(w-L-R),Y=y=>h-B-y/ymax*(h-T-B);
 let s='';for(let k=0;k<=4;k++){const y=k*ymax/4,x=xmin+(xmax-xmin)*k/4;s+=`<path d="M${L} ${Y(y)}H${w-R}" stroke="#2c4154"/><text x="${L-12}" y="${Y(y)+4}" text-anchor="end">${y.toFixed(0)}</text><text x="${X(x)}" y="${h-B+22}" text-anchor="middle">${x.toFixed(0)}</text>`}
 s+=`<text x="${w/2}" y="${h-6}" text-anchor="middle">${xlabel}</text><text x="15" y="${h/2}" transform="rotate(-90 15 ${h/2})" text-anchor="middle">Height above surface · km</text>`;
 s+=`<path id="${id}-line" d="${points.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(2)} ${Y(p[1]).toFixed(2)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
 if(id==='ray'){s+=`<circle cx="${X(0)}" cy="${Y(points[0][1])}" r="5" fill="#81e3ca"/>`;if(currentRay.status==='returned'){const end=points.at(-1);s+=`<circle cx="${X(end[0])}" cy="${Y(end[1])}" r="5" fill="#ffd28a"/>`}}
 el.innerHTML=s;
}


