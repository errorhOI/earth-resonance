'use strict';
const regionToneCache=new Map();
function regionTone(midi,voice,rate,length){
 const key=[midi,voice,rate,length].join(':');if(regionToneCache.has(key))return regionToneCache.get(key);
 const hz=440*2**((midi-69)/12),bell=voice==='bells',tone=new Float32Array(length);
 const partials=bell?[[1,1,0],[2,.17,5],[3,.045,8],[4,.012,10]]:[[1,1,0],[2,.17,2.5],[3,.055,4],[4,.018,6],[5,.006,8]];
 const orchestral=voice==='orchestral';
 const attack=orchestral?.055:bell?.022:.045,release=orchestral?.18:bell?.12:.16,decay=orchestral?2.4:bell?5.2:3;
 const brightness=Math.max(0,Math.min(1,Math.log2(hz/220)/2));
 const extraDecay=brightness*(bell?1.8:orchestral?1.2:.9);
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
 for(let j=0;j<length;j++){
  const t=j/rate,envelope=smooth(t/attack)*smooth((length-1-j)/(rate*release))*Math.exp(-(decay+extraDecay)*t);
  let wave=0;
  if(orchestral){
   let strings=0,brass=0;
   const phase=2*Math.PI*hz*t,vibrato=.0005*hz*Math.sin(2*Math.PI*4.8*t)*smooth(t/.12);
   for(let harmonic=1;harmonic<=6;harmonic++){
    if(hz*harmonic*2**(3/1200)>=rate*.45)continue;
    const p=phase*harmonic;
    strings+=(.64*Math.sin(p+vibrato)+.18*Math.sin(p*2**(-3/1200)+vibrato)+.18*Math.sin(p*2**(3/1200)+vibrato))/harmonic**2.1*Math.exp(-1.2*(harmonic-1)*t);
    brass+=Math.sin(p)/harmonic**2.2*Math.exp(-1.4*(harmonic-1)*t);
   }
   const chime=hz*2<rate*.45?Math.sin(phase*2)*Math.exp(-8*t):0;
   wave=.66*strings+.315*brass*(.7+.3*smooth(t/.12))+.025*chime;
  }else for(const [ratio,gain,damping] of partials)if(hz*ratio<rate*.45)wave+=gain*Math.sin(2*Math.PI*hz*ratio*t)*Math.exp(-damping*t);
  tone[j]=.88*wave*envelope;
 }
 if(regionToneCache.size>=64)regionToneCache.delete(regionToneCache.keys().next().value);
 regionToneCache.set(key,tone);return tone;
}
window.RegionSound={
 melody(feature,kind,voice,midi,seconds){
  const rate=48000,length=Math.ceil((seconds+.12)*rate),buffer=new AudioBuffer({numberOfChannels:2,length,sampleRate:rate});
  if(!Number.isInteger(midi)||midi<36||midi>84||!this.notes(feature,kind).length)return buffer;
  const warmth=Math.max(0,Math.min(1,feature.warmth)),brightness=Math.max(0,Math.min(1,feature.brightness));
  const tone=regionTone(midi,voice,rate,length),overtone=regionTone(midi+12,voice,rate,length);
  const gain=(.13+.15*brightness)*Math.min(1,Math.sqrt(feature.coverage*3)),tint=.015+.07*warmth;
  for(let c=0;c<2;c++){const samples=buffer.getChannelData(c);for(let i=0;i<length;i++)samples[i]=gain*(tone[i]+tint*overtone[i])/(1+tint)}
  return buffer;
 },
 onsets(columns,kind){return columns.flatMap((f,i)=>f.coverage>=.015&&(kind!=='aerosols'||f.types.some(g=>g*.35>.008))?[i*.25]:[])},
 fingerprint(features){let hash=2166136261;for(const ch of JSON.stringify(features)){hash=Math.imul(hash^ch.charCodeAt(0),16777619)}return (hash>>>0).toString(16).padStart(8,'0')},
 features(image,box,kind){
  const {data:rgba,width,height}=image,columns=[];
  for(let step=0;step<16;step++){
   let weight=0,brightness=0,warmth=0;const types=[0,0,0,0],colors=Array.from({length:kind==='aerosols'?4:5},()=>({r:0,g:0,b:0,weight:0,brightness:0,warmth:0}));
   for(let dx=0;dx<8;dx++)for(let dy=0;dy<48;dy++){
    const u=box.left+(box.right-box.left)*(step+(dx+.5)/8)/16;
    const v=box.top+(box.bottom-box.top)*(dy+.5)/48;
    if(kind==='ocean'&&u<.18&&v>.906)continue;
    const x=Math.min(width-1,Math.floor(u*width)),y=Math.min(height-1,Math.floor(v*height)),i=(y*width+x)*4;
    const r=rgba[i]/255,g=rgba[i+1]/255,b=rgba[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,s=max?d/max:0;
    if(max<.10||s<.24)continue;
    let hue=d===0?0:max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);hue=(hue+360)%360;
    const w=s,lum=.2126*r+.7152*g+.0722*b;
    weight+=w;brightness+=lum*w;warmth+=(1-Math.min(240,hue>300?0:hue)/240)*w;
    const type=hue>=165&&hue<260?0:hue>=260?1:hue<65?2:3;types[type]+=lum*w;
    const bin=kind==='aerosols'?type:hue>=165&&hue<=300?0:hue>=75&&hue<165?1:hue>=45&&hue<75?2:hue>=15&&hue<45?3:4;
    colors[bin].r+=r*w;colors[bin].g+=g*w;colors[bin].b+=b*w;colors[bin].weight+=w;
    colors[bin].brightness+=lum*w;colors[bin].warmth+=(1-Math.min(240,hue>300?0:hue)/240)*w;
   }
   columns.push({brightness:weight?brightness/weight:0,warmth:weight?warmth/weight:0,
                 coverage:weight/384,types:types.map(v=>weight?v/weight:0),colors:colors.map(c=>({r:c.weight?c.r/c.weight:0,g:c.weight?c.g/c.weight:0,b:c.weight?c.b/c.weight:0,weight:c.weight/384,brightness:c.weight?c.brightness/c.weight:0,warmth:c.weight?c.warmth/c.weight:0}))});
  }
  return columns;
 },
 notes(f,kind){
  if(f.coverage<.015)return [];
  if(kind==='aerosols')return f.types.map((gain,i)=>({midi:[48,55,62,69][i],gain:gain*.35})).filter(n=>n.gain>.008);
  const pitch=w=>{const n=Math.max(0,Math.min(14,Math.round(w*14)));return 45+12*Math.floor(n/5)+[0,2,4,7,9][n%5]};
  const colors=(f.colors||[]).filter(c=>c.weight>.0001);
  if(!colors.length)return [{midi:pitch(f.warmth),gain:.08+f.brightness*.20}];
  const total=colors.reduce((sum,c)=>sum+Math.sqrt(c.weight),0),notes=new Map();
  for(const c of colors){
   const midi=pitch(c.warmth??f.warmth),gain=(.08+(c.brightness??f.brightness)*.20)*Math.sqrt(c.weight)/total;
   notes.set(midi,(notes.get(midi)||0)+gain);
  }
  return [...notes].map(([midi,gain])=>({midi,gain}));
 },
 merge(columns){const total=columns.reduce((s,f)=>s+f.coverage,0);return {brightness:total?columns.reduce((s,f)=>s+f.brightness*f.coverage,0)/total:0,warmth:total?columns.reduce((s,f)=>s+f.warmth*f.coverage,0)/total:0,coverage:total/columns.length,types:[0,1,2,3].map(i=>columns.reduce((s,f)=>s+f.types[i],0)/columns.length),colors:Array.from({length:columns[0]?.colors?.length||0},(_,i)=>{const bins=columns.map(f=>f.colors[i]),weight=bins.reduce((s,c)=>s+c.weight,0);return {r:weight?bins.reduce((s,c)=>s+c.r*c.weight,0)/weight:0,g:weight?bins.reduce((s,c)=>s+c.g*c.weight,0)/weight:0,b:weight?bins.reduce((s,c)=>s+c.b*c.weight,0)/weight:0,weight:weight/columns.length,brightness:weight?bins.reduce((s,c)=>s+(c.brightness||0)*c.weight,0)/weight:0,warmth:weight?bins.reduce((s,c)=>s+(c.warmth||0)*c.weight,0)/weight:0}})}},
 synth(columns,kind,voice,duration=4.5){
  const rate=48000,buffer=new AudioBuffer({numberOfChannels:2,length:Math.ceil(duration*rate),sampleRate:rate});
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  for(let step=0;step<columns.length;step++){
   const f=columns[step];if(f.coverage<.015)continue;
   const notes=window.RegionSound.notes(f,kind);
   for(const note of notes){
    const start=Math.round(step*.25*rate),length=Math.round(.7*rate),pan=columns.length===1?.5:step/(columns.length-1);
    const tone=regionTone(note.midi,voice,rate,length);
    for(let j=0;j<length&&start+j<left.length;j++){
     const v=tone[j]*note.gain*Math.min(1,f.coverage*3);
     left[start+j]+=v*Math.sqrt(1-.65*pan);right[start+j]+=v*Math.sqrt(.35+.65*pan);
    }
   }
  }
  let peak=0;for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  if(peak>.8)for(let i=0;i<left.length;i++){left[i]*=.8/peak;right[i]*=.8/peak}
  return buffer;
 }
};
