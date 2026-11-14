'use strict';
// Scan 16 image columns at an adjustable cadence, sampling the current frame.
class LiveRegionAudio {
 constructor({ctx,output,region,video,config,onSample,onPaused,onEnded,onError,maxSteps=Infinity,onComplete,ownsVideo=true}){
  Object.assign(this,{ctx,output,region,video,config,onSample,onPaused,onEnded,onError,maxSteps,onComplete,ownsVideo});
  this.emitted=0;this.finishAt=0;this.completed=false;
  this.running=false;this.busy=false;this.lastFrame=-Infinity;this.scanStep=0;this.voices=new Set();this.pulses=[];this.colorSamples=[];this.epoch=0;
  this.canvas=document.createElement('canvas');this.canvas.width=video.videoWidth;this.canvas.height=video.videoHeight;
  this.reader=this.canvas.getContext('2d',{willReadFrequently:true});
  this.gain=ctx.createGain();this.gain.gain.value=.7;
  // Bound the summed overlapping notes/tails before monitoring volume.
  this.limiter=ctx.createWaveShaper();const curve=new Float32Array(8193);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.85*Math.tanh(x/.85)}this.limiter.curve=curve;this.limiter.oversample='2x';
  this.gain.connect(this.limiter).connect(output);
  this.pause=()=>{this.epoch++;this.lastFrame=-Infinity;this.scanStep=0;this.clearVoices();this.pulses=[];this.colorSamples=[];this.onPaused?.()};
  this.ended=()=>this.onEnded();this.seek=()=>{if(Number.isFinite(this.maxSteps))this.lastFrame=-Infinity;else this.pause()};
 }
 async start(){
  this.running=true;this.video.addEventListener('pause',this.pause);this.video.addEventListener('seeking',this.seek);this.video.addEventListener('ended',this.ended);
  await this.video.play();if(!this.running)return;
  const tick=()=>{if(!this.running)return;this.request=requestAnimationFrame(tick);
   if(this.emitted>=this.maxSteps){this.finishScan();return}
   if(this.video.paused||this.video.seeking||this.video.readyState<2||this.busy)return;
   const frame=this.video.currentTime;
   if(frame<this.lastFrame){
    // A source-video loop must not cut off the final delayed notes of a node.
    if(!Number.isFinite(this.maxSteps)){this.epoch++;this.clearVoices();this.pulses=[];this.colorSamples=[];this.scanStep=0}
    this.lastFrame=-Infinity;
   }
   if(frame-this.lastFrame<this.scanInterval())return;
   this.lastFrame=frame;this.emit(frame);
  };tick();
 }
 finishScan(){
  if(this.completed||this.busy||this.emitted<this.maxSteps||SoundTiming.now(this.ctx)<this.finishAt)return;
  this.completed=true;this.onComplete?.();
 }
 setLoop(enabled){
  // Finish the current spatial scan when repetition is disabled, including its
  // rendered tails. Do not restart the scan or discard in-flight arrivals.
  const columns=this.columnCount||16;
  this.maxSteps=enabled?Infinity:this.emitted+(this.scanStep?columns-this.scanStep:(this.emitted?0:columns));
  this.completed=false;
 }
 scanInterval(){
  const speed=Number(this.config().scan_speed);
  return .25/(Number.isFinite(speed)?Math.max(.5,Math.min(2,speed)):1);
 }
 async emit(frame){
  if(this.emitted>=this.maxSteps||this.busy||!this.running)return;
  this.busy=true;const ticket=this.epoch;
  try{
   this.reader.drawImage(this.video,0,0);
   const columns=RegionSound.features(this.reader.getImageData(0,0,this.canvas.width,this.canvas.height),this.region.bounds,this.region.kind);
   this.columnCount=columns.length;
   const scanIndex=this.scanStep%columns.length,feature=columns[scanIndex],s=this.config();
   const raw=RegionSound.synth([feature],this.region.kind,s.voice,.8);
   const buffer=s.mode==='original'?raw:await SoundDSP.render(raw,s.effects,s.delay_seconds);
   if(!this.running||this.video.paused||this.video.seeking||ticket!==this.epoch||this.emitted>=this.maxSteps)return;
   const node=this.ctx.createBufferSource(),gain=this.ctx.createGain();
   gain.gain.value=SoundDSP.level(buffer,raw,s.balanced);node.buffer=buffer;node.connect(gain).connect(this.gain);
   const voice={node,gain};this.voices.add(voice);node.onended=()=>{this.voices.delete(voice);node.disconnect();gain.disconnect()};
   const start=this.ctx.currentTime+.015;node.start(start);
   this.emitted++;
   const audibleNote=RegionSound.onsets([feature],this.region.kind).length>0;
   const travel=audibleNote&&s.mode==='processed'?s.travel_seconds+.18:0;
   this.finishAt=Math.max(this.finishAt,start+Math.max(buffer.duration||buffer.length/buffer.sampleRate,travel));
   this.scanStep=(scanIndex+1)%columns.length;
   this.colorSamples.push({start,feature,kind:this.region.kind,cardId:this.region.cardId,frame,scanIndex,scanCount:columns.length});
   this.colorSamples=this.colorSamples.filter(s=>this.ctx.currentTime-s.start<2);
   if(RegionSound.onsets([feature],this.region.kind).length)this.pulses.push({start,cardId:this.region.cardId,profileId:s.profile_id,bearing:s.bearing,angle:s.angle,travel:s.travel_seconds,arrival:s.mode==='processed'&&s.delay_seconds>0,propagation:s.mode==='processed'});
   this.pulses=this.pulses.filter(p=>this.ctx.currentTime-p.start<p.travel+1);
   this.onSample({frame,columns,fingerprint:RegionSound.fingerprint(columns),onset:start,coverage:feature.coverage});
  }catch(error){if(this.running)this.onError(error)}finally{this.busy=false}
 }
 clearVoices(){for(const {node,gain} of this.voices){gain.gain.setTargetAtTime(0,this.ctx.currentTime,.01);try{node.stop(this.ctx.currentTime+.05)}catch{}}this.voices.clear()}
 stop(){this.running=false;this.epoch++;cancelAnimationFrame(this.request);this.clearVoices();this.pulses=[];this.video.removeEventListener('pause',this.pause);this.video.removeEventListener('seeking',this.seek);this.video.removeEventListener('ended',this.ended);if(this.ownsVideo)this.video.pause();setTimeout(()=>{this.gain.disconnect();this.limiter.disconnect()},80)}
 playback(){const now=SoundTiming.now(this.ctx);return {live:true,scanProgress:Math.min(1,this.emitted/this.maxSteps),draining:Number.isFinite(this.maxSteps)&&this.emitted>=this.maxSteps,colorSample:this.colorSamples.filter(s=>s.start<=now&&now-s.start<.8).at(-1)||null,pulses:this.pulses.map(p=>now-p.start).filter(t=>t>=0),wavePulses:this.pulses.filter(p=>p.propagation).map(p=>({...p,age:now-p.start})),seconds:this.video.currentTime}}
}
window.LiveRegionAudio=LiveRegionAudio;
