'use strict';
class LiveRegionGroup {
 constructor({ctx,output,regions,videoFor,config,onSample,onError,onComplete}){
  this.running=false;this.completed=new Set();this.finished=false;
  this.bus=ctx.createGain();this.bus.gain.value=1/Math.max(1,regions.length);this.bus.connect(output);
  this.streams=regions.map(region=>new LiveRegionAudio({ctx,output:this.bus,region,video:videoFor(region),ownsVideo:false,maxSteps:16,
   config:()=>config(region),onSample:sample=>onSample(region,sample),onPaused:()=>{},onEnded:()=>{},onError,
   onComplete:()=>{this.completed.add(region.cardId);if(this.running&&!this.finished&&this.completed.size===regions.length){this.finished=true;onComplete?.()}}
  }));
 }
 async start(){this.running=true;for(const s of this.streams)s.video.loop=true;await Promise.all(this.streams.map(s=>s.start()))}
 stop(){this.running=false;for(const s of this.streams)s.stop();for(const video of new Set(this.streams.map(s=>s.video)))video.pause();setTimeout(()=>this.bus.disconnect(),80)}
 playback(){
  const states=this.streams.map(s=>s.playback()),samples=states.flatMap(s=>s.colorSample?[s.colorSample]:[]);
  return {live:true,group:true,regionIds:this.streams.map(s=>s.region.cardId),colorSamples:samples,colorSample:samples[0]||null,
   wavePulses:states.flatMap(s=>s.wavePulses),pulses:states.flatMap(s=>s.pulses),seconds:states[0]?.seconds||0,
   scanProgress:Math.min(...states.map(s=>s.scanProgress)),draining:states.every(s=>s.draining)};
 }
}
window.LiveRegionGroup=LiveRegionGroup;
