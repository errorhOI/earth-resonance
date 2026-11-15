'use strict';
class HistoryMeter extends AudioWorkletProcessor {
 constructor(){super();this.count=0;this.low=0;this.high=0;this.size=Math.round(sampleRate*.02)}
 process(inputs,outputs){
  for(const channel of outputs[0]||[])channel.fill(0);
  const channels=inputs[0]||[],length=channels[0]?.length||128;
  for(let i=0;i<length;i++){
   for(const channel of channels){const v=channel[i]||0;this.low=Math.min(this.low,v);this.high=Math.max(this.high,v)}
   if(++this.count===this.size){
    this.port.postMessage({time:(currentFrame+i+1)/sampleRate,low:this.low,high:this.high});
    this.count=0;this.low=0;this.high=0;
   }
  }
  return true;
 }
}
registerProcessor('history-meter',HistoryMeter);
