const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const scope={window:{},AudioBuffer:class{constructor({length,sampleRate,numberOfChannels}){this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}getChannelData(c){return this.channels[c]}}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/dist/region-sound.js','utf8'),scope);
const sound=scope.window.RegionSound,box={left:151/360,right:169/360,top:60.8/180,bottom:75.2/180};
const features=[0,35].map(t=>sound.features({width:960,height:480,data:fs.readFileSync(__dirname+`/data/aerosols-test-${t}.rgba`)},box,'aerosols'));
assert.notEqual(sound.fingerprint(features[0]),sound.fingerprint(features[1]));
const result={region:[22,-20],frames_seconds:[0,35],feature_hashes:features.map(f=>sound.fingerprint(f)),voices:{}};
for(const voice of ['bells','soft_synth']){
 const hashes=features.map(f=>{const b=sound.synth([sound.merge(f)],'aerosols',voice,.8),x=b.getChannelData(0);assert(x.some(v=>Math.abs(v)>.001));assert(x.every(v=>Number.isFinite(v)&&Math.abs(v)<=.8));return crypto.createHash('sha256').update(Buffer.from(x.buffer)).digest('hex')});
 assert.notEqual(hashes[0],hashes[1]);result.voices[voice]={different_audio:true,finite_unclipped:true,hashes};
}
fs.writeFileSync(__dirname+'/aerosol-video-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
