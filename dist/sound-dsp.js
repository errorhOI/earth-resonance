'use strict';
window.SoundDSP = (() => {
 const defaults={bass:0,mid:0,treble:0,smooth:0,dynamics:0,reverb:0,width:100,octave:0};
 function outputGraph(ctx){
  const input=ctx.createGain(),headroom=ctx.createGain(),monitor=ctx.createWaveShaper();
  headroom.gain.value=1/8;
  const curve=new Float32Array(16385);
  for(let i=0;i<curve.length;i++){
   const x=(i/(curve.length-1)*2-1)*8,a=Math.abs(x);
   curve[i]=a<=.8?x:Math.sign(x)*(.8+.18*Math.tanh((a-.8)/.18));
  }
  monitor.curve=curve;monitor.oversample='none';
  input.connect(headroom).connect(monitor);
  return {input,monitor};
 }
 const presets={clean:{...defaults},warm:{...defaults,bass:4,mid:1,treble:-4,smooth:55,dynamics:25},
  spacious:{...defaults,treble:-1,smooth:25,reverb:40,width:140},
  cinematic:{...defaults,bass:5,mid:-1,treble:-3,smooth:45,dynamics:45,reverb:55,width:145,octave:25}};
 function metrics(buffer,seconds=buffer.duration){let peak=0,sum=0;const n=Math.min(buffer.length,Math.round(seconds*buffer.sampleRate));for(let c=0;c<buffer.numberOfChannels;c++){const x=buffer.getChannelData(c);for(let i=0;i<x.length;i++){peak=Math.max(peak,Math.abs(x[i]));if(i<n)sum+=x[i]*x[i]}}return {peak,rms:Math.sqrt(sum/Math.max(1,n*buffer.numberOfChannels))}}
 function level(buffer,reference,balanced=true){const m=metrics(buffer,reference.duration),r=metrics(reference);return Math.min(balanced&&m.rms>1e-8?r.rms/m.rms:1,m.peak>0?.92/m.peak:1)}
 function impulse(ctx,seconds){const b=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate);let seed=2026;for(let c=0;c<2;c++){const x=b.getChannelData(c);for(let i=0;i<x.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;x[i]=((seed>>>0)/4294967296*2-1)*Math.exp(-7*i/x.length)*Math.min(1,i/(ctx.sampleRate*.008))}}return b}
 function octave(ctx,input){
  const b=ctx.createBuffer(2,input.length,input.sampleRate),grain=Math.round(input.sampleRate*.12),hop=Math.floor(grain/4),weights=new Float32Array(input.length),src0=input.getChannelData(0),out0=b.getChannelData(0);
  for(let start=-grain;start<input.length;start+=hop){
   let shift=0,best=-Infinity;
   if(start>=0&&start+hop<input.length){
    for(let candidate=-384;candidate<=384;candidate+=8){let dot=0,power=0,energy=0;
     for(let j=hop/4|0;j<hop;j+=12){const target=start+j,read=Math.floor(start+grain/4+j*.5+candidate);if(read<0||read>=input.length||weights[target]<.001)continue;const x=src0[read],y=out0[target]/weights[target];dot+=x*y;power+=x*x;energy+=y*y}
     const score=energy>1e-10?dot/Math.sqrt(Math.max(1e-20,power*energy)):-Infinity;if(score>best){best=score;shift=candidate}
    }
   }
   for(let j=0;j<grain;j++){const target=start+j,read=start+grain/4+j*.5+shift;if(target<0||target>=b.length||read<0||read>=input.length-1)continue;const k=Math.floor(read),f=read-k,w=.5-.5*Math.cos(2*Math.PI*j/(grain-1));
    for(let c=0;c<2;c++){const src=input.getChannelData(Math.min(c,input.numberOfChannels-1));b.getChannelData(c)[target]+=(src[k]*(1-f)+src[k+1]*f)*w}weights[target]+=w;
   }
  }
  for(let c=0;c<2;c++){const out=b.getChannelData(c);for(let i=0;i<out.length;i++)out[i]=weights[i]>1e-5?out[i]/weights[i]:0}return b;
 }
 async function render(input,settings,delay=0){
  const s={...defaults,...settings},tail=s.reverb>0?2.5:0,ctx=new OfflineAudioContext(2,Math.ceil((input.duration+tail+delay)*48000),48000);
  const bus=ctx.createGain(),source=ctx.createBufferSource();source.buffer=input;source.connect(bus);source.start(0);
  if(s.octave>0){const low=ctx.createBufferSource(),g=ctx.createGain(),lp=ctx.createBiquadFilter();low.buffer=octave(ctx,input);g.gain.value=s.octave/100*.5;lp.type='lowpass';lp.frequency.value=500;low.connect(lp).connect(g).connect(bus);low.start(0)}
  let node=bus;for(const [type,hz,value] of [['lowshelf',180,s.bass],['peaking',1000,s.mid],['highshelf',3000,s.treble]]){if(value===0)continue;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=hz;f.Q.value=.7;f.gain.value=value;node.connect(f);node=f}
  if(s.smooth>0){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=12000*Math.pow(.1,s.smooth/100);f.Q.value=.707;node.connect(f);node=f}
  if(s.dynamics>0){const c=ctx.createDynamicsCompressor();c.threshold.value=-6-s.dynamics*.3;c.ratio.value=1+s.dynamics*.09;c.knee.value=12;c.attack.value=.005;c.release.value=.2;node.connect(c);node=c}
  const split=ctx.createChannelSplitter(2),merge=ctx.createChannelMerger(2),w=s.width/100;node.connect(split);
  for(const [from,to,v] of [[0,0,(1+w)/2],[1,1,(1+w)/2],[0,1,(1-w)/2],[1,0,(1-w)/2]]){const g=ctx.createGain();g.gain.value=v;split.connect(g,from);g.connect(merge,0,to)}
  const mixed=ctx.createGain();merge.connect(mixed);
  if(s.reverb>0){const con=ctx.createConvolver(),wet=ctx.createGain();con.buffer=impulse(ctx,2.5);wet.gain.value=s.reverb/100*.65;merge.connect(con).connect(wet).connect(mixed)}
  mixed.connect(ctx.destination);
  if(delay>0){const d=ctx.createDelay(12),g=ctx.createGain();d.delayTime.value=delay;g.gain.value=.45;mixed.connect(d).connect(g).connect(ctx.destination)}
  const rendered=await ctx.startRendering(),peak=metrics(rendered).peak;
  if(peak>.92)for(let c=0;c<2;c++){const x=rendered.getChannelData(c);for(let i=0;i<x.length;i++)x[i]*=.92/peak}
  return rendered;
 }
 function wav(buffer,gain=1){const length=buffer.length,raw=new ArrayBuffer(44+length*4),v=new DataView(raw),str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};str(0,'RIFF');v.setUint32(4,36+length*4,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*4,true);for(let i=0;i<length;i++)for(let c=0;c<2;c++){const x=Math.max(-1,Math.min(1,buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1))[i]*gain));v.setInt16(44+(i*2+c)*2,Math.round(x*(x<0?32768:32767)),true)}return raw}
 return {defaults,presets,render,metrics,level,wav,outputGraph};
})();
