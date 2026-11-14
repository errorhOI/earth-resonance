const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
const profiles=JSON.parse(read('results.json')).profiles;
const controls={bearing:{value:90},angle:{value:15}};
let playback;
const scope={window:{soundLabController:{playback:()=>playback}},document:{getElementById:()=>null},performance:{now:()=>5000},$:id=>controls[id],matchMedia:()=>({matches:false})};
vm.createContext(scope);
for(const name of ['sound-timing.js','region-sound.js','atmosphere-map.js','card-atmosphere.js','map-endpoints.js']){
 vm.runInContext(name==='atmosphere-map.js'?read(name).split('class AtmosphereMap')[0]:read(name),scope);
 Object.assign(scope,scope.window);
}
assert(Math.abs(scope.SoundTiming.now({currentTime:5,state:'running',getOutputTimestamp:()=>({contextTime:4.8,performanceTime:4900})})-4.9)<1e-9);
assert(Math.abs(scope.SoundTiming.now({currentTime:5,baseLatency:.01,outputLatency:.04})-4.95)<1e-9);
const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
const g={w:1800,h:600,sx:390,sy:109.2,zh:108,cy:330,brightnessAt:()=>.5};
let checked=0;
for(const profile of profiles)for(const ray of profile.rays){
 controls.bearing.value=ray.bearing_deg;controls.angle.value=ray.angle_deg;
 const region={cardId:1,profile},entry={region,canvas:{dataset:{}}},travel=ray.path_seconds.at(-1)/1000;
 const pulse={start:10,cardId:1,profileId:profile.id,bearing:ray.bearing_deg,angle:ray.angle_deg,travel,arrival:ray.status==='returned'};
 playback={active:true,propagation:true,wavePulses:[{...pulse,age:travel-.0001}]};
 scope.CardAtmosphere.draw(ctx,entry,g,0,false);assert.equal(entry.canvas.dataset.arrivalPhase,'travelling');
 playback.wavePulses=[{...pulse,age:travel},{...pulse,start:10+travel/2,age:travel/2}];
 scope.CardAtmosphere.draw(ctx,entry,g,0,false);
 assert.equal(entry.canvas.dataset.arrivalPhase,pulse.arrival?'arrived':'travelling');
 if(pulse.arrival)assert.equal(entry.canvas.dataset.atmospherePhase,'Receiver reached');
 assert.equal(scope.SoundTiming.waves(playback,{...region,cardId:2},ray).length,0);
 playback={active:false,wavePulses:playback.wavePulses};scope.CardAtmosphere.draw(ctx,entry,g,0,false);assert.equal(entry.canvas.dataset.arrivalPhase,'idle');
 playback={active:true,propagation:false,wavePulses:[]};scope.CardAtmosphere.draw(ctx,entry,g,0,false);assert.equal(entry.canvas.dataset.arrivalPhase,'idle');checked++;
}
// An older overlapping arrival must not steal the tracked height/layer caption.
{
 const profile=profiles.find(p=>p.rays.some(r=>r.status==='returned'));
 const ray=profile.rays.find(r=>r.status==='returned');
 controls.bearing.value=ray.bearing_deg;controls.angle.value=ray.angle_deg;
 const region={cardId:9,kind:'ocean',profile},entry={region,canvas:{dataset:{}}};
 const travel=ray.path_seconds.at(-1)/1000;
 const pulse={cardId:9,profileId:profile.id,bearing:ray.bearing_deg,angle:ray.angle_deg,travel,arrival:true};
 let labels=[],arcs=[];
 const canvasCtx=new Proxy({fillText:t=>labels.push(t),arc:(...args)=>arcs.push(args)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 function frame(age,olderAge){
  labels=[];arcs=[];
  playback={active:true,propagation:true,wavePulses:[{...pulse,start:10,age:olderAge},{...pulse,start:10+travel*.75,age}]};
  scope.CardAtmosphere.draw(canvasCtx,entry,g,0,false);
 }
 frame(travel*.2,travel*.95);
 frame(travel*.3,travel*1.05);
 assert.equal(entry.canvas.dataset.trackedPulseStart,String(10+travel*.75));
 assert.equal(entry.canvas.dataset.arrivalPhase,'arrived','Other notes still trigger receiver flashes');
 assert(!labels.includes('Arrived'),'Caption must describe the tracked note only');
 const point=scope.AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,ray.path_seconds.at(-1)*.3);
 assert.equal(entry.canvas.dataset.atmosphereHeightKm,(point[1]/1000).toFixed(3));
 const layer=profile.thermal_layers.layers.find(l=>point[1]/1000>=l.bottom_km&&point[1]/1000<l.top_km);
 assert.equal(entry.canvas.dataset.atmosphereLayer,layer.name);
 // The bright marker uses the same altitude and projection as the layer sheets.
 const base=ray.path_m[0][1],span=profile.height_m.at(-1)-base,b=ray.bearing_deg*Math.PI/180;
 const f=point[0]/Math.max(1,...ray.path_m.map(p=>p[0]));
 const u=.5-.34*Math.sin(b)+f*.68*Math.sin(b),v=.5+.34*Math.cos(b)-f*.68*Math.cos(b);
 const expected=[g.w/2+(u-v)*g.sx,g.cy+(u+v)*g.sy-(g.zh+8+(point[1]-base)/span*g.h*.29)];
 const marker=arcs.find(a=>a[2]===5);assert(marker);
 assert(Math.abs(marker[0]-expected[0])<1e-8&&Math.abs(marker[1]-expected[1])<1e-8);
 // Switching views must keep the existing pulse, even when a newer one appears.
 const viewer={overlay:{dataset:{}},flatRect:()=>({left:0,top:0,width:1000,height:500})};
 playback.wavePulses.push({...pulse,start:20,age:travel*.05});
 arcs=[];scope.MapEndpoints.draw(canvasCtx,1000,500,1,viewer,region,ray);
 assert.equal(viewer.overlay.dataset.trackedPulseStart,entry.canvas.dataset.trackedPulseStart);
 const location=scope.AtmosphereGeo.destination(profile.latitude,profile.longitude,ray.bearing_deg,point[0]);
 const mapMarker=arcs.find(a=>a[2]===5);
 assert(Math.abs(mapMarker[0]-(location[1]+180)/360*1000)<1e-8);
 assert(Math.abs(mapMarker[1]-(90-location[0])/180*500)<1e-8);
 frame(travel,travel*1.75);assert(labels.includes('Arrived'));
 scope.MapEndpoints.draw(canvasCtx,1000,500,1,viewer,region,ray);
 assert.equal(viewer.overlay.dataset.trackedPulseStart,entry.canvas.dataset.trackedPulseStart);
 assert.equal(viewer.overlay.dataset.arrivalPhase,'arrived');
 assert.equal(entry.canvas.dataset.atmosphereHeightKm,(ray.path_m.at(-1)[1]/1000).toFixed(3));
 playback={active:false};scope.CardAtmosphere.draw(canvasCtx,entry,g,0,false);
 assert.equal(entry.canvas.dataset.trackedPulseStart,'');
 scope.MapEndpoints.draw(canvasCtx,1000,500,1,viewer,region,ray);
 assert.equal(viewer.overlay.dataset.trackedPulseStart,'');
 // A map-first selection also remains selected when returning to the card.
 playback={active:true,propagation:true,wavePulses:[{...pulse,start:30,age:travel*.3}]};
 scope.MapEndpoints.draw(canvasCtx,1000,500,1,viewer,region,ray);
 playback.wavePulses.push({...pulse,start:31,age:travel*.05});
 scope.CardAtmosphere.draw(canvasCtx,entry,g,0,false);
 assert.equal(entry.canvas.dataset.trackedPulseStart,'30');
 assert.equal(viewer.overlay.dataset.trackedPulseStart,'30');
}
const feature={coverage:1,types:[0,0,0,0]};
assert.equal(scope.RegionSound.onsets([feature],'aerosols').length,0);
assert.deepEqual(Array.from(scope.RegionSound.onsets([{...feature,coverage:0},feature,feature],'ocean')),[.25,.5]);
// Live notes must use the exact scheduled buffer onset, then clear on pause/seek.
const gain=()=>({gain:{value:1,setTargetAtTime(){}},connect(){return this},disconnect(){}});
let scheduled,frame=1;
const audio={currentTime:10,createGain:gain,createWaveShaper:gain,createBufferSource:()=>({connect:()=>gain(),start:t=>scheduled=t,stop(){},disconnect(){}})};
scope.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData(){return {}}})})};
scope.RegionSound={features:()=>[feature],merge:()=>feature,synth:()=>({}),onsets:()=>[0],fingerprint:()=>''};
scope.SoundDSP={render:async()=>({}),level:()=>1};scope.cancelAnimationFrame=()=>{};
vm.runInContext(read('live-region-audio.js'),scope);
(async()=>{
 const live=new scope.window.LiveRegionAudio({ctx:audio,output:{},region:{cardId:7,kind:'ocean'},video:{videoWidth:1,videoHeight:1,paused:false,currentTime:1},config:()=>({mode:'processed',delay_seconds:.6,travel_seconds:.6,profile_id:'cell',bearing:90,angle:15}),onSample(){}});
 live.running=true;await live.emit(frame);
 assert.equal(scheduled,10.015);assert.equal(live.playback().wavePulses[0].start,scheduled);
 assert.equal(live.playback().colorSample,null);
 audio.currentTime=scheduled+.001;assert.equal(live.playback().colorSample.cardId,7);
 assert.equal(live.playback().colorSample.feature,feature);
 audio.currentTime=scheduled+.6;assert(Math.abs(live.playback().wavePulses[0].age-.6)<1e-10);
 live.pause();assert.equal(live.playback().wavePulses.length,0);
 assert.equal(live.playback().colorSample,null);
 console.log(JSON.stringify({raysChecked:checked,arrivalBoundary:true,overlappingNotes:true,regionIsolation:true,originalAndStop:true,liveScheduledOnset:true,pauseClearsMarkers:true,outputClock:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
