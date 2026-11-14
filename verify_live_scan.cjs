const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
let image;
const gain=()=>({gain:{value:1,setTargetAtTime(){}},connect(){return this},disconnect(){}});
const audio={currentTime:10,createGain:gain,createWaveShaper:gain,createBufferSource:()=>({connect:gain,start(){},stop(){},disconnect(){}})};
const scope={window:{},performance:{now:()=>0},cancelAnimationFrame(){},document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>image})})},AudioBuffer:class{
 constructor({length,sampleRate,numberOfChannels}){this.sampleRate=sampleRate;this.length=length;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}
 getChannelData(i){return this.channels[i]}
}};
vm.createContext(scope);
for(const n of ['region-sound.js','sound-timing.js','live-region-audio.js']){vm.runInContext(read(n),scope);Object.assign(scope,scope.window)}
const synth=scope.RegionSound.synth;let rendered=[],config;
scope.RegionSound.synth=(...args)=>{const wav=synth(...args);rendered.push({feature:args[0][0],audio:Buffer.from(wav.getChannelData(0).buffer)});return wav};
scope.SoundDSP={render:async raw=>raw,level:()=>1};
function frame(swap=false){return {width:96,height:24,data:Uint8ClampedArray.from(Array.from({length:96*24},(_,i)=>{
 const column=Math.floor(i%96/6);return [...(column===2?[80,80,80]:((column<8)!==swap?[0,40,255]:[255,40,0])),255];
}).flat())}}
const region={cardId:7,kind:'ocean',bounds:{left:0,right:1,top:0,bottom:1}};
const video={videoWidth:96,videoHeight:24,paused:false,seeking:false,currentTime:1};
config={mode:'processed',voice:process.argv[2]||'bells',delay_seconds:.6,travel_seconds:.6,profile_id:'cell',bearing:90,angle:15};
const live=new scope.LiveRegionAudio({ctx:audio,output:{},region,video,config:()=>config,onSample(){}});live.running=true;
(async()=>{
 image=frame();
 for(let index=0;index<16;index++){
  audio.currentTime=10+index*.25;video.currentTime=1+index*.25;
  await live.emit(video.currentTime);
  const scheduled=audio.currentTime+.015;
  // A new column cannot become visible before that note reaches audio output.
  const before=live.playback();assert(!before.colorSample||before.colorSample.start<scheduled);
  audio.currentTime=scheduled+.001;const p={active:true,...live.playback()};
  assert.equal(p.colorSample.scanIndex,index);
  assert.equal(scope.SoundTiming.scan(p,region),(index+.5)/16);
  assert.equal(scope.SoundTiming.scan(p,{cardId:8}),null);
  assert.equal(p.colorSample.feature,rendered.at(-1).feature);
  assert.equal(p.wavePulses.some(w=>w.start===scheduled),index!==2,'Neutral strips must not launch an audible pulse');
 }
 assert(!rendered[0].audio.equals(rendered[8].audio),'Blue and red strips must generate different notes');
 assert(rendered[2].audio.every(x=>x===0),'Uncolored strip stays silent');
 image=frame(true);audio.currentTime=14;await live.emit(5);
 audio.currentTime=14.016;let p={active:true,...live.playback()};
 assert.equal(p.colorSample.scanIndex,0,'Scan wraps across the selected bounds');
 assert(!rendered[0].audio.equals(rendered.at(-1).audio),'Next pass samples the changed video, not cached notes');
 const pulse=p.wavePulses.at(-1);audio.currentTime=pulse.start+.6+1e-8;
 p={active:true,...live.playback()};
 const waves=scope.SoundTiming.waves(p,{...region,profile:{id:'cell'}},{bearing_deg:90,angle_deg:15});
 assert(waves.find(w=>w.start===pulse.start).arrived,'Scanned note retains exact delayed-arrival timing');
 live.pause();assert.equal(live.scanStep,0);assert.equal(scope.SoundTiming.scan({active:true,...live.playback()},region),null);
 video.paused=true;await live.emit(6);assert.equal(live.scanStep,0,'Discarded notes do not advance scan');
 assert.equal(scope.SoundTiming.scan({...p,active:false},region),null);
 console.log('Passed: 16 spatial columns, distinct color audio, fresh video on wrap, neutral silence, output-clock scan, delayed arrivals, pause/reset and region isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});
