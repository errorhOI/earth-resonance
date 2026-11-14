const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const scope={window:{},setTimeout:fn=>fn()};vm.createContext(scope);
 vm.runInContext(read('music-nodes.js').split('(() => {')[0],scope);
 const regions=[{cardId:1,kind:'ocean'},{cardId:2,kind:'aerosols'},{cardId:3,kind:'aerosols',included:false}];
 let done,played=[],loop=false;
 const seq=new scope.window.MusicNodeSequence({regions:()=>regions.filter(r=>r.included!==false),together:()=>true,
  activate:async()=>{},play:async(cb,rs)=>{done=cb;played.push(rs.map(r=>r.cardId));return true},stopAudio(){},loop:()=>loop,update(){}});
 await seq.start();assert.deepEqual(played,[[1,2]]);done();await settle();assert(!seq.running);
 loop=true;await seq.start();const first=done;first();await settle();assert.equal(played.length,3);first();assert.equal(played.length,3);
 const stale=done;seq.stop();stale();await settle();assert.equal(played.length,3);
 let instances=[],completed=0,paused=0;
 scope.LiveRegionAudio=class {
  constructor(o){Object.assign(this,o);instances.push(this)}
  async start(){this.started=true}
  stop(){this.stopped=true;assert.equal(this.ownsVideo,false)}
  playback(){return {scanProgress:.5,draining:false,seconds:2,colorSample:{cardId:this.region.cardId,scanIndex:this.region.cardId,scanCount:16},pulses:[.3],wavePulses:[{cardId:this.region.cardId,profileId:this.region.cardId,age:.3,travel:this.config().travel_seconds,bearing:90,angle:15}]}}
 };
 vm.runInContext(read('live-region-group.js'),scope);vm.runInContext(read('sound-timing.js'),scope);
 const bus={gain:{},connect(){},disconnect(){this.disconnected=true}},video={pause(){paused++}};
 const group=new scope.window.LiveRegionGroup({ctx:{createGain:()=>bus},output:{},regions:regions.slice(0,2),videoFor:()=>video,
  config:r=>({travel_seconds:r.cardId*.4}),onSample(){},onError:e=>{throw e},onComplete:()=>completed++});
 await group.start();assert(instances.every(s=>s.started));assert.equal(bus.gain.value,.5);assert(video.loop);
 instances[0].onComplete();assert.equal(completed,0,'Wait for every region tail');instances[1].onComplete();assert.equal(completed,1);instances[1].onComplete();assert.equal(completed,1);
 const state={active:true,...group.playback()};assert.equal(state.wavePulses.length,2);assert.equal(state.colorSamples.length,2);
 for(const r of regions.slice(0,2)){
  assert.equal(scope.window.SoundTiming.scan(state,r),(r.cardId+.5)/16,'Each scan line follows its own audio sample');
  const waves=scope.window.SoundTiming.waves(state,{...r,profile:{id:r.cardId}},{bearing_deg:90,angle_deg:15});
  assert.equal(waves.length,1);assert.equal(waves[0].travel,r.cardId*.4,'Atmosphere uses this region delay');
 }
 group.stop();assert(instances.every(s=>s.stopped));assert.equal(paused,1,'Shared source video paused once');assert(bus.disconnected);
 instances[0].onComplete();assert.equal(completed,1,'Stopped group cannot finish again');
 console.log('PASS: selected subset, simultaneous voices, loop/stop cancellation, bounded sum, per-region scan/pulse/delay, tail completion and shared video ownership');
})().catch(e=>{console.error(e);process.exitCode=1});
