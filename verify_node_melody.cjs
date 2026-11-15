const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
const scope={window:{},AudioBuffer:class{constructor({length,sampleRate,numberOfChannels}){this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}getChannelData(c){return this.channels[c]}}};
vm.createContext(scope);vm.runInContext(read('region-sound.js'),scope);vm.runInContext(read('node-melody.js').split('(() => {')[0],scope);
const score=scope.window.NodeScore,sound=scope.window.RegionSound;
const regions=[{cardId:1,kind:'ocean',bounds:{left:0,right:.5}},{cardId:2,kind:'aerosols',bounds:{left:.5,right:1}}];
const phrase=score.phrase(),steps=score.resolve(phrase,regions);
assert.equal(steps.reduce((s,n)=>s+n.beats,0),8);assert.equal(steps.filter(s=>s.midi!==null).length,8);
assert.equal(steps[1].region,regions[0]);assert.equal(steps[2].region,regions[1]);assert.equal(steps[3].region,regions[0]);
assert.equal(score.assignments(phrase,regions)[0],null,'Rest has no region');
assert.equal(score.assignments(phrase,[regions[1]])[1],regions[1],'Labels follow remaining selected region');
assert.equal(score.assignments(phrase,[regions[1],regions[0]])[1],regions[1],'Labels follow node order');
assert.equal(score.assignments(phrase,[])[1],undefined,'Empty selection has no invented assignment');
assert(score.valid(JSON.parse(JSON.stringify(phrase))),'Score survives storage round trip');
phrase.steps[1].region=score.identity(regions[1]);assert.equal(score.resolve(phrase,regions)[1].region,regions[1]);
assert.equal(score.assignments(phrase,regions)[2],regions[0],'Explicit assignments do not advance automatic alternation');
assert.throws(()=>score.resolve(phrase,[regions[0]]),/missing/);assert.throws(()=>score.resolve({bpm:0,steps:[]},regions));
const feature=(warmth,brightness)=>({warmth,brightness,coverage:1,types:[1,0,0,0],colors:[]});
const blue=feature(0,.2),red=feature(1,.8),neutral={...blue,coverage:0};
const spectral=(a,hz)=>{let re=0,im=0;for(let i=0;i<a.length;i++){const p=2*Math.PI*hz*i/48000;re+=a[i]*Math.cos(p);im+=a[i]*Math.sin(p)}return Math.hypot(re,im)};
for(const voice of ['bells','soft_synth','orchestral']){
 const a=sound.melody(blue,'ocean',voice,69,.6).getChannelData(0),b=sound.melody(red,'ocean',voice,69,.6).getChannelData(0);
 assert(a.every(x=>Number.isFinite(x)&&Math.abs(x)<1));assert.notDeepEqual(a,b);
 for(const samples of [a,b]){assert(spectral(samples,440)>spectral(samples,440*2**(1/12))*3);assert(spectral(samples,440)>spectral(samples,440*2**(-1/12))*3);assert.equal(samples[0],0);assert.equal(samples.at(-1),0)}
 assert(spectral(b,880)/spectral(b,440)>spectral(a,880)/spectral(a,440),'Color changes timbre at the same assigned pitch');
 assert(spectral(b,440)>spectral(a,440),'Brightness changes loudness');
 assert(sound.melody(neutral,'ocean',voice,69,.6).getChannelData(0).every(x=>x===0));
}
(async()=>{
 let raf,outputTime=0,complete=0,starts=[],sampled=[],renderDelay=0;
 const gain=()=>({gain:{value:1,setTargetAtTime(){}},connect(){return this},disconnect(){}});
 const ctx={currentTime:0,createGain:gain,createBufferSource:()=>({connect:gain,start:t=>starts.push(t),stop(){},disconnect(){}})};
 const video=()=>({paused:true,readyState:2,videoWidth:16,videoHeight:1,currentTime:0,async play(){this.paused=false},pause(){this.paused=true}}),ocean=video(),aerosols=video();
 const s={window:{},document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData(){return {}}})})},requestAnimationFrame:fn=>{raf=fn;return 1},cancelAnimationFrame(){},setTimeout:fn=>fn(),
  SoundTiming:{now:()=>outputTime},RegionSound:{features:()=>Array.from({length:16},(_,i)=>({column:i,coverage:1})),melody:(f,k,v,n,d)=>{sampled.push({f,k,n,d});return {duration:d}},notes:()=>[1]},
  SoundDSP:{render:async(raw,e,delay)=>{renderDelay=delay;return {duration:raw.duration+delay}},level:()=>1}};
 vm.createContext(s);vm.runInContext(read('node-melody-audio.js'),s);
 const sequence=[{midi:null,beats:1},{midi:69,beats:.5,region:regions[0]},{midi:71,beats:1,region:regions[1]}];
 const options={ctx,output:{},steps:sequence,bpm:60,videoFor:r=>r.kind==='ocean'?ocean:aerosols,config:r=>({voice:'bells',effects:{},delay_seconds:r.cardId===1?.6:1.2,travel_seconds:r.cardId===1?.6:1.2,profile_id:r.cardId,bearing:90,angle:15}),onComplete:()=>complete++,onError:e=>{throw e}};
 const audio=new s.window.NodeMelodyAudio(options);await audio.start();
 const settle=()=>new Promise(r=>setImmediate(r));await settle();assert.equal(starts.length,0,'Rest emits no sound');
 ctx.currentTime=1;outputTime=.9;raf();await settle();assert.equal(starts[0],1.25);assert.equal(sampled[0].n,69);assert.equal(sampled[0].k,'ocean');
 assert.equal(audio.playback().colorSample,null,'Lookahead does not highlight notes before output time');
 outputTime=1.3;const first=audio.playback();assert.equal(first.midi,69);assert.equal(first.colorSample.cardId,1);assert(Math.abs(first.wavePulses[0].age-.05)<1e-9);assert.equal(first.wavePulses[0].travel,.6);
 ctx.currentTime=1.5;raf();await settle();assert.equal(starts[1],1.75,'Half beat spacing');assert.equal(renderDelay,1.2,'Second node uses its own delay');assert.equal(sampled[1].k,'aerosols');
 outputTime=1.85;assert.equal(audio.playback().midi,71);assert.equal(audio.playback().colorSample.cardId,2);
 ctx.currentTime=10;outputTime=audio.finishAt-.001;raf();assert.equal(complete,0,'Wait for audible arrival tail');
 outputTime=audio.finishAt+.001;raf();assert.equal(complete,1);raf();assert.equal(complete,1);assert.equal(starts.length,2,'No implicit loop');audio.stop();assert(ocean.paused&&aerosols.paused);
 // Stop while DSP is in flight cannot schedule late notes or pulses.
 let release;s.SoundDSP.render=()=>new Promise(r=>release=r);ctx.currentTime=0;outputTime=0;starts=[];
 const pending=new s.window.NodeMelodyAudio({...options,steps:[sequence[1]]});await pending.start();pending.stop();release({duration:2});await settle();assert.equal(starts.length,0);assert.equal(pending.pulses.length,0);
 console.log('PASS: composed pitches, color-dependent tone/level, silent neutral pixels, saved score, region assignments, rests/beats, output-clock highlights, per-node arrivals, one pass and cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
