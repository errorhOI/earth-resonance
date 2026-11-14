const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const context={window:{},AudioBuffer:class{constructor({length,sampleRate,numberOfChannels}){this.sampleRate=sampleRate;this.length=length;this.duration=length/sampleRate;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}getChannelData(c){return this.channels[c]}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/dist/region-sound.js','utf8'),context);
const sound=context.window.RegionSound,box={left:0,right:1,top:0,bottom:.8};
function image(rgb){return {width:32,height:32,data:Uint8ClampedArray.from(Array.from({length:1024},()=>[...rgb,255]).flat())}}
const blue=sound.features(image([0,40,255]),box,'ocean'),red=sound.features(image([255,40,0]),box,'ocean');
assert(blue.length===16&&red.length===16&&blue[0].warmth<red[0].warmth);
const a=sound.synth(blue,'ocean','bells'),b=sound.synth(red,'ocean','bells');
const digest=x=>crypto.createHash('sha256').update(Buffer.from(x.getChannelData(0).buffer)).digest('hex');
assert.notEqual(digest(a),digest(b));assert.equal(digest(a),digest(sound.synth(blue,'ocean','bells')));
const grey=sound.features(image([100,100,100]),box,'ocean');assert(grey.every(c=>c.coverage===0));
assert(sound.synth(grey,'ocean','bells').getChannelData(0).every(x=>x===0));
for(const [rgb,category] of [[[0,100,255],0],[[190,50,220],1],[[255,80,30],2],[[30,220,60],3]]){
 const f=sound.features(image(rgb),box,'aerosols');assert.equal(f[0].types.indexOf(Math.max(...f[0].types)),category);
 for(const voice of ['bells','soft_synth','orchestral']){const wav=sound.synth(f,'aerosols',voice);for(const ch of wav.channels)assert(ch.every(x=>Number.isFinite(x)&&Math.abs(x)<=.80001))}
}
const merged=sound.merge(blue);assert(Math.abs(merged.warmth-blue[0].warmth)<1e-8);
const short=sound.synth([merged],'ocean','bells',.8);
assert.equal(short.duration,.8);assert(short.getChannelData(0).some(x=>Math.abs(x)>.01));
assert(short.getChannelData(0).every((x,i)=>x===short.getChannelData(1)[i]));
// Different colors within ONE scan strip remain separate audible notes.
function verticalMix(redRows){return {width:128,height:48,data:Uint8ClampedArray.from(Array.from({length:128*48},(_,i)=>[...(Math.floor(i/128)<redRows?[255,40,0]:[0,40,255]),255]).flat())}}
const fullBox={left:.2,right:.8,top:0,bottom:1};
const split=sound.features(verticalMix(24),fullBox,'ocean')[0];
const mixedNotes=sound.notes(split,'ocean'),blueNote=sound.notes(blue[0],'ocean')[0],redNote=sound.notes(red[0],'ocean')[0];
assert.deepEqual(Array.from(mixedNotes,n=>n.midi).sort(),[blueNote.midi,redNote.midi].sort());
assert.equal(sound.notes(sound.merge([split]),'ocean').length,2,'Merged exports preserve separate color pitches');
const mixedAudio=sound.synth([split],'ocean','bells',.8);
assert.notEqual(digest(mixedAudio),digest(sound.synth([{...split,colors:[]}],'ocean','bells',.8)),'Color mixture differs from averaged-pitch audio');
assert(mixedAudio.channels.every(ch=>ch.every(x=>Number.isFinite(x)&&Math.abs(x)<=.80001)));
const small=sound.features(verticalMix(2),fullBox,'ocean')[0];
assert.equal(sound.notes(small,'ocean').length,2,'Small red patch survives a mostly blue strip');
const quietRed=sound.notes(small,'ocean').find(n=>n.midi===redNote.midi);
assert(quietRed.gain>redNote.gain*(2/48),'Smaller patches receive more weight than a simple area average');
// Instrument changes must preserve pitch while adding quiet upper harmonics,
// and end smoothly instead of cutting an oscillation off at the note boundary.
const spectral=(samples,hz)=>{let re=0,im=0;for(let i=0;i<samples.length;i++){const phase=2*Math.PI*hz*i/48000;re+=samples[i]*Math.cos(phase);im+=samples[i]*Math.sin(phase)}return Math.hypot(re,im)};
for(const voice of ['bells','soft_synth','orchestral']){
 for(const feature of [blue[0],red[0]]){
  const samples=sound.synth([feature],'ocean',voice,.8).getChannelData(0);
  const hz=440*2**((sound.notes(feature,'ocean')[0].midi-69)/12),fundamental=spectral(samples,hz),second=spectral(samples,2*hz);
  assert(second>fundamental*.06&&second<fundamental*.5,'Quiet upper harmonics enrich the mapped fundamental');
  assert.equal(samples[0],0);assert(samples.slice(33600).every(x=>x===0),'No extra tail changes note duration');
  assert(Math.abs(samples[1])<.00001&&Math.abs(samples[33598])<.00001,'Smooth attack and release avoid endpoint clicks');
 }
}
assert.notEqual(digest(short),digest(sound.synth([merged],'ocean','soft_synth',.8)),'Instruments retain distinct timbres');
console.log(JSON.stringify({distinct_color_audio:true,deterministic:true,neutral_pixels_silent:true,aerosol_categories:4,finite_unclipped:true,smooth_endpoints:true,quiet_upper_harmonics:true,seconds:a.duration,live_tone_seconds:short.duration,live_centered:true}));

assert.notEqual(digest(short),digest(sound.synth([merged],'ocean','orchestral',.8)));
assert.notEqual(digest(sound.synth([merged],'ocean','soft_synth',.8)),digest(sound.synth([merged],'ocean','orchestral',.8)));

// Upper-note ringing stays subdued without moving the color-selected pitch.
// Check the actual waveform, including late sustain, rather than coefficients.
for(const voice of ['bells','soft_synth','orchestral'])for(const midi of [69,78]){
 const samples=vm.runInContext(`regionTone(${midi},'${voice}',48000,33600)`,context);
 const hz=440*2**((midi-69)/12),fundamental=spectral(samples,hz);
 const upper=[2,3,4,5,6].reduce((sum,h)=>sum+(spectral(samples,hz*h)/fundamental)**2,0);
 assert(upper<(voice==='orchestral'?.045:.016),'Upper harmonics remain soft relative to the mapped note');
 for(const offset of [-1,1])assert(fundamental>spectral(samples,hz*2**(offset/12))*3,'Color pitch remains distinct from neighbouring semitones');
 const rms=(a,b)=>Math.sqrt(samples.slice(a,b).reduce((s,v)=>s+v*v,0)/(b-a));
 assert(rms(19200,28800)/rms(2400,7200)<(voice==='bells'?.11:voice==='orchestral'?.22:.27),'Bright notes decay before overlapping tails become a sustained ring');
}
console.log('PASS: softer upper harmonics, clear mapped pitches and reduced bright-note sustain');
