const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
let playback;const status={},reduced={matches:false};
const scope={window:{soundLabController:{playback:()=>playback}},document:{getElementById:()=>status},matchMedia:()=>reduced};
vm.createContext(scope);
for(const n of ['sound-timing.js','atmosphere-map.js','map-endpoints.js']){
 vm.runInContext(n==='atmosphere-map.js'?read(n).split('class AtmosphereMap')[0]:read(n),scope);Object.assign(scope,scope.window);
}
const api=scope.MapEndpoints,profiles=JSON.parse(read('results.json')).profiles;
let count=0;
for(const profile of profiles)for(const ray of profile.rays){
 const region={cardId:1,kind:'ocean',profile},travel=ray.path_seconds.at(-1)/1000;
 const pulse={cardId:1,profileId:profile.id,bearing:ray.bearing_deg,angle:ray.angle_deg,travel,arrival:ray.status==='returned',age:travel/2};
 playback={active:true,propagation:true,wavePulses:[pulse]};
 let waves=api.pulses(region,ray);
 if(!pulse.arrival){assert.equal(waves.length,0);continue}
 assert.equal(waves.length,1);assert.equal(waves[0].arrived,false);
 const expected=scope.AtmosphereGeo.destination(profile.latitude,profile.longitude,ray.bearing_deg,scope.AtmosphereGeo.pointAt(ray.path_m,ray.path_seconds,travel*500)[0]);
 assert.deepEqual(Array.from(waves[0].location),Array.from(expected));
 pulse.age=travel-.00001;assert.equal(api.pulses(region,ray)[0].arrived,false);
 pulse.age=travel;waves=api.pulses(region,ray);assert.equal(waves[0].arrived,true);
 const end=api.locations(region,ray).b;assert(Math.abs(end[0]-waves[0].location[0])<1e-6);assert(Math.abs(end[1]-waves[0].location[1])<1e-6);
 pulse.age=travel+.181;assert.equal(api.pulses(region,ray).length,0);
 pulse.age=travel/2;assert.equal(api.pulses({...region,cardId:2},ray).length,0);
 playback.propagation=false;assert.equal(api.pulses(region,ray).length,0);
 playback.propagation=true;playback.active=false;assert.equal(api.pulses(region,ray).length,0);count++;
}
// Renderer draws arrival at the same clock boundary, including reduced motion.
const profile=profiles.find(p=>p.rays.some(r=>r.status==='returned')),ray=profile.rays.find(r=>r.status==='returned'),region={cardId:1,kind:'aerosols',profile};
const viewer={overlay:{dataset:{}},flatRect:()=>({width:1120,height:560,left:40,top:70}),aspect:2};
const ctx=new Proxy({},{get:(_,key)=>(...args)=>{if(['arc','moveTo','lineTo','rect'].includes(key))assert(args.every(Number.isFinite))},set:()=>true});
const travel=ray.path_seconds.at(-1)/1000;
playback={active:true,propagation:true,wavePulses:[{cardId:1,profileId:profile.id,bearing:ray.bearing_deg,angle:ray.angle_deg,travel,arrival:true,age:travel/2}]};
api.draw(ctx,1200,700,1,viewer,region,ray);assert.equal(viewer.overlay.dataset.arrivalPhase,'travelling');
reduced.matches=true;playback.wavePulses[0].age=travel;api.draw(ctx,1200,700,1,viewer,region,ray);assert.equal(viewer.overlay.dataset.arrivalPhase,'arrived');
playback.active=false;api.draw(ctx,1200,700,1,viewer,region,ray);assert.equal(viewer.overlay.dataset.arrivalPhase,'idle');
const html=read('index.html');assert(html.indexOf('id="coverageNote"')>html.indexOf('<dialog id="credits"'));
console.log(`Passed ${count} returning paths: modeled distance, audio arrival boundary, stopped/original/other-region isolation, reduced motion, and relocated legend.`);
