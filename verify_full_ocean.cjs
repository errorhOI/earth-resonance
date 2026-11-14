const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto'),{execFileSync}=require('child_process');
const ffmpeg=path.resolve(__dirname,'../preparation/.venv/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const source=path.resolve(__dirname,'../preparation/ocean-source/flat_global_ecco2_1200w_comp_p30.mp4'),video=path.join(__dirname,'dist/assets/ocean-texture.mp4');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frameHashes=p=>execFileSync(ffmpeg,['-v','error','-i',p,'-map','0:v:0','-f','framemd5','-'],{maxBuffer:8*1024*1024}).toString().split('\n').filter(l=>l&&!l.startsWith('#'));
const originals=frameHashes(source),packaged=frameHashes(video);
assert.equal(packaged.length,2059);assert.deepEqual(packaged,originals,'Every decoded frame and timestamp must match the full source');
const raw=fs.readFileSync(path.join(__dirname,'dist/media-data.js'),'utf8'),media=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
assert.equal(hash(Buffer.from(media.ocean.video_base64,'base64')),hash(fs.readFileSync(video)));
assert.equal(media.ocean.source_start_seconds,0);assert.equal(media.ocean.fps,30);assert.equal(media.ocean.duration_seconds,2059/30);
const scope={window:{},AudioBuffer:class{constructor({length,sampleRate,numberOfChannels}){this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}getChannelData(c){return this.channels[c]}}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'dist/region-sound.js'),'utf8'),scope);
const sound=scope.window.RegionSound,box={left:.29,right:.36,top:.25,bottom:.38},featureHashes=[],audioHashes=[];
for(const t of [0,34,65]){
 const data=execFileSync(ffmpeg,['-v','error','-ss',String(t),'-i',video,'-frames:v','1','-vf','scale=320:160','-pix_fmt','rgba','-f','rawvideo','-'],{maxBuffer:1024*1024});
 assert.equal(data.length,320*160*4);
 const features=sound.features({data,width:320,height:160},box,'ocean');featureHashes.push(sound.fingerprint(features));
 const audio=sound.synth(features,'ocean','soft_synth');audioHashes.push(hash(Buffer.from(audio.getChannelData(0).buffer)));
 assert(audio.getChannelData(0).some(v=>Math.abs(v)>.001));
}
assert.equal(new Set(featureHashes).size,3);assert.equal(new Set(audioHashes).size,3);
console.log('Passed: all 2,059 original frames/timestamps retained; embedded full video matches; source starts at zero; distinct color-driven audio at 0, 34 and 65 seconds.');
