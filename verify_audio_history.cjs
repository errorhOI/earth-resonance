const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=name=>fs.readFileSync(__dirname+'/dist/'+name,'utf8');
let Processor;const messages=[];
const audio={sampleRate:48000,currentFrame:0,AudioWorkletProcessor:class{constructor(){this.port={postMessage:x=>messages.push(x)}}},registerProcessor:(name,type)=>{Processor=type}};
vm.createContext(audio);vm.runInContext(read('audio-history-meter.js'),audio);
const meter=new Processor();
for(let block=0;block<15;block++){
 audio.currentFrame=block*128;
 const left=new Float32Array(128),right=new Float32Array(128),output=new Float32Array(128).fill(1);
 if(block===2)left[19]=.8;if(block===5)right[33]=-.7;
 meter.process([[left,right]],[[output]]);
 assert(output.every(x=>x===0),'Meter branch must never add audible output');
}
assert.equal(messages.length,2);assert.equal(messages[0].time,.02);assert.equal(messages[1].time,.04);
assert(Math.abs(messages[0].high-.8)<1e-6&&Math.abs(messages[0].low+.7)<1e-6,'Capture transients in either channel between animation frames');
assert.equal(messages[1].high,0);assert.equal(messages[1].low,0);
const listeners={},sandbox={window:{addEventListener:(n,f)=>listeners[n]=f}};
vm.createContext(sandbox);vm.runInContext(read('audio-history.js'),sandbox);
const {History,strongest}=sandbox.window.AudioHistory,h=new History();h.reset(10);
h.add({time:9,low:-1,high:1});assert.equal(h.bins.length,0,'Reject previous playback messages');
for(let i=1;i<=5000;i++)h.add({time:10+i*.02,low:-.2,high:.4});
assert(h.bins.length<=1600&&h.bins[0].t>=69,'Keep only bounded recent history');
assert.equal(h.end,100);const length=h.bins.length;
h.add({time:109,low:-1,high:1});h.add({time:NaN,low:0,high:0});assert.equal(h.bins.length,length);
h.reset(123);assert.equal(h.end,0);assert.equal(h.bins.length,0);
const db=new Float32Array(1024).fill(-100);assert.equal(strongest(db,48000,2048),null);
db[40]=-20;assert.equal(strongest(db,48000,2048),938);db[0]=-1;assert.equal(strongest(db,48000,2048),938,'Ignore DC');
console.log('PASS: PCM peaks, stereo transients, silent meter, exact time bins, bounded history, playback reset and frequency readout');
