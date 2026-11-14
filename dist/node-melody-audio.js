'use strict';
// A composed score performed by region nodes, scheduled on the same audio clock
// as their ray pulses. Image sampling modulates timbre/level, never score pitch.
class NodeMelodyAudio {
 constructor({ctx,output,steps,bpm,videoFor,config,onComplete,onError}){
  Object.assign(this,{ctx,steps,bpm,videoFor,config,onComplete,onError});
  this.running=false;this.busy=false;this.index=0;this.epoch=0;this.finishAt=0;this.pulses=[];this.samples=[];this.voices=new Set();this.readers=new Map();
  this.regions=[...new Set(steps.filter(s=>s.region).map(s=>s.region))];
  this.bus=ctx.createGain();this.bus.gain.value=.65;this.bus.connect(output);
 }
 async start(){
  this.running=true;
  await Promise.all([...new Set(this.regions.map(this.videoFor))].map(video=>{video.loop=true;return video.play()}));
  if(!this.running)return;this.nextAt=this.ctx.currentTime+.25;
  const tick=()=>{if(!this.running)return;this.request=requestAnimationFrame(tick);
   if(this.busy)return;
   if(this.index>=this.steps.length){if(SoundTiming.now(this.ctx)>=Math.max(this.finishAt,this.nextAt)){this.running=false;this.onComplete?.()}return}
   if(this.nextAt-this.ctx.currentTime<.35)void this.emit();
  };tick();
 }
 async emit(){
  if(this.busy||!this.running||this.index>=this.steps.length)return;
  this.busy=true;const ticket=this.epoch,index=this.index,step=this.steps[index],duration=step.beats*60/this.bpm;
  try{
   if(step.midi===null){this.samples.push({start:this.nextAt,duration,index,rest:true});this.nextAt+=duration;this.index++;return}
   const region=step.region,video=this.videoFor(region);
   if(video.readyState<2||video.seeking||video.paused)return;
   let reader=this.readers.get(video);
   if(!reader){const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;reader=canvas.getContext('2d',{willReadFrequently:true});this.readers.set(video,reader)}
   reader.drawImage(video,0,0);const columns=RegionSound.features(reader.getImageData(0,0,video.videoWidth,video.videoHeight),region.bounds,region.kind);
   const scanIndex=index%columns.length,feature=columns[scanIndex],s=this.config(region);
   const raw=RegionSound.melody(feature,region.kind,s.voice,step.midi,duration*.9);
   const buffer=await SoundDSP.render(raw,s.effects,s.delay_seconds);
   if(!this.running||ticket!==this.epoch)return;
   const start=Math.max(this.nextAt,this.ctx.currentTime+.025),node=this.ctx.createBufferSource(),gain=this.ctx.createGain();
   gain.gain.value=SoundDSP.level(buffer,raw,s.balanced);node.buffer=buffer;node.connect(gain).connect(this.bus);
   const voice={node,gain};this.voices.add(voice);node.onended=()=>{this.voices.delete(voice);node.disconnect();gain.disconnect()};node.start(start);
   const audible=RegionSound.notes(feature,region.kind).length>0;
   this.samples.push({start,duration,index,midi:step.midi,feature,kind:region.kind,cardId:region.cardId,scanIndex,scanCount:columns.length,frame:video.currentTime});
   if(audible)this.pulses.push({start,cardId:region.cardId,profileId:s.profile_id,bearing:s.bearing,angle:s.angle,travel:s.travel_seconds,arrival:s.delay_seconds>0,propagation:true});
   const now=SoundTiming.now(this.ctx);this.samples=this.samples.filter(s=>s.start+s.duration>now-1);this.pulses=this.pulses.filter(p=>p.start+p.travel>now-.3);
   this.finishAt=Math.max(this.finishAt,start+buffer.duration,start+(audible?s.travel_seconds+.18:0));
   this.nextAt=start+duration;this.index++;
  }catch(error){if(this.running)this.onError(error)}finally{this.busy=false}
 }
 stop(){
  this.running=false;this.epoch++;cancelAnimationFrame(this.request);
  for(const {node,gain} of this.voices){gain.gain.setTargetAtTime(0,this.ctx.currentTime,.01);try{node.stop(this.ctx.currentTime+.05)}catch{}}
  this.voices.clear();this.pulses=[];this.samples=[];
  for(const video of new Set(this.regions.map(this.videoFor)))video.pause();setTimeout(()=>this.bus.disconnect(),80);
 }
 playback(){
  const now=SoundTiming.now(this.ctx),current=this.samples.filter(s=>s.start<=now&&s.start+s.duration>now).at(-1),sample=current&&!current.rest?current:null;
  return {live:true,group:true,melody:true,stepIndex:current?.index??-1,midi:sample?.midi??null,regionIds:this.regions.map(r=>r.cardId),colorSample:sample,colorSamples:sample?[sample]:[],
   wavePulses:this.pulses.map(p=>({...p,age:now-p.start})),pulses:this.pulses.map(p=>now-p.start).filter(age=>age>=0),seconds:now-(this.samples[0]?.start||now)};
 }
}
window.NodeMelodyAudio=NodeMelodyAudio;
