const fs=require('fs'),vm=require('vm'),assert=require('assert');
let callback,speed=1;const starts=[],delays=[];
const gain=()=>({gain:{value:1,setTargetAtTime(){}},connect(){return this},disconnect(){}});
const audio={currentTime:10,createGain:gain,createWaveShaper:gain,createBufferSource:()=>({connect:gain,start:t=>starts.push(t),stop(){},disconnect(){}})};
const feature={coverage:1},region={cardId:7,kind:'ocean'};
const video={videoWidth:1,videoHeight:1,paused:false,seeking:false,readyState:4,currentTime:0,addEventListener(){},play:async()=>{}};
const scope={window:{},performance:{now:()=>0},requestAnimationFrame:fn=>(callback=fn,1),cancelAnimationFrame(){},document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({})})})},
 RegionSound:{features:()=>Array(16).fill(feature),synth:()=>({}),onsets:()=>[0],fingerprint:()=>''},SoundDSP:{render:async(raw,fx,delay)=>(delays.push(delay),raw),level:()=>1}};
vm.createContext(scope);
for(const n of ['sound-timing.js','live-region-audio.js']){vm.runInContext(fs.readFileSync(__dirname+'/dist/'+n,'utf8'),scope);Object.assign(scope,scope.window)}
const config=()=>({scan_speed:speed,mode:'processed',delay_seconds:.6,travel_seconds:.6,profile_id:'cell',bearing:90,angle:15});
const live=new scope.LiveRegionAudio({ctx:audio,output:{},region,video,config,onSample(){},onError:e=>{throw e}});
async function tick(time){video.currentTime=time;audio.currentTime=10+time;callback();await new Promise(setImmediate)}
(async()=>{
 await live.start();await new Promise(setImmediate);assert.equal(starts.length,1);
 await tick(.24);assert.equal(starts.length,1);
 speed=2;await tick(.24);assert.equal(starts.length,2,'Faster rate applies during playback');
 const originalPulse=live.pulses[0];assert.equal(live.scanStep,2);
 await tick(.35);assert.equal(starts.length,2);
 await tick(.366);assert.equal(starts.length,3);
 speed=.5;await tick(.5);assert.equal(starts.length,3,'Slower rate postpones only the next note');
 assert.equal(live.pulses[0],originalPulse,'Speed changes must preserve in-flight notes');
 assert.equal(originalPulse.start,10.015);assert.equal(originalPulse.travel,.6);
 audio.currentTime=originalPulse.start+.6+1e-8;
 const p={active:true,...live.playback()};
 assert(scope.SoundTiming.waves(p,{...region,profile:{id:'cell'}},{bearing_deg:90,angle_deg:15}).find(w=>w.start===originalPulse.start).arrived);
 await tick(.865);assert.equal(starts.length,3);
 await tick(.867);assert.equal(starts.length,4);assert.equal(live.scanStep,4,'Speed changes must not reset or skip scan columns');
 assert(delays.every(d=>d===.6));assert.equal(live.epoch,0);
 audio.currentTime=starts.at(-1)+.001;
 const current={active:true,...live.playback()};assert.equal(scope.SoundTiming.scan(current,region),3.5/16);
 speed=NaN;assert.equal(live.scanInterval(),.25);
 speed=10;assert.equal(live.scanInterval(),.125);
 speed=.1;assert.equal(live.scanInterval(),.5);
 console.log('Passed: live 0.5x–2x speed changes, no restart/skipped columns, preserved note timestamps and delay, scan-line output timing, and bounded rates.');
})().catch(e=>{console.error(e);process.exitCode=1});
