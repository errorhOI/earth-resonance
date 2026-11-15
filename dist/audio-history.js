'use strict';
window.AudioHistory=(()=>{
 const seconds=30;
 class History {
  constructor(){this.reset(0)}
  reset(start){this.start=start;this.bins=[];this.end=0}
  add(bin){
   const t=bin.time-this.start;
   if(t<0||!Number.isFinite(t)||!Number.isFinite(bin.low)||!Number.isFinite(bin.high))return;
   if(this.bins.length&&t<=this.bins.at(-1).t)return;
   this.end=t;this.bins.push({t,low:bin.low,high:bin.high});
   while(this.bins.length&&(this.bins[0].t<t-seconds-1||this.bins.length>1600))this.bins.shift();
  }
 }
 const history=new History();let context,meter,ready,active=false,exact=false,lastSample=-1,lastSpectrum=0,frequency='';
 let samples=new Float32Array(2048),spectrum=new Float32Array(1024);
 async function connect(ctx,output){
  if(ready)return ready;context=ctx;
  ready=(async()=>{try{
   await ctx.audioWorklet.addModule('audio-history-meter.js?v=1');
   meter=new AudioWorkletNode(ctx,'history-meter',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   meter.port.onmessage=event=>{if(active)history.add(event.data)};
   output.connect(meter);meter.connect(ctx.destination);exact=true;
  }catch(error){console.warn('Using sampled waveform history:',error)}})();return ready;
 }
 function begin(){history.reset(context?.currentTime||0);active=true;frequency='';lastSample=-1;lastSpectrum=0}
 function end(){active=false}
 for(const name of ['soundlab-stop','soundlab-ended'])window.addEventListener(name,end);
 function strongest(db,rate,size){
  let index=-1,level=-70;
  for(let i=Math.ceil(40*size/rate);i<db.length;i++)if(db[i]>level){index=i;level=db[i]}
  return index<0?null:Math.round(index*rate/size);
 }
 function draw(analyser,isPlaying){
  const $=id=>document.getElementById(id),canvas=$('audioWave');if($('audioWavePanel').hidden)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  if(analyser&&active&&isPlaying){
   if(samples.length!==analyser.fftSize){samples=new Float32Array(analyser.fftSize);spectrum=new Float32Array(analyser.frequencyBinCount)}
   if(!exact&&context.currentTime-lastSample>=.02){
    analyser.getFloatTimeDomainData(samples);let low=0,high=0;for(const v of samples){low=Math.min(low,v);high=Math.max(high,v)}
    history.add({time:context.currentTime,low,high});lastSample=context.currentTime;
   }
   if(performance.now()-lastSpectrum>150){
    analyser.getFloatFrequencyData(spectrum);const hz=strongest(spectrum,context.sampleRate,analyser.fftSize);
    frequency=hz?`Strongest ~${hz} Hz`:'Quiet';lastSpectrum=performance.now();
   }
  }
  const audible=active&&context?Math.max(0,SoundTiming.now(context)-history.start):history.end;
  const end=Math.min(history.end,audible),left=Math.max(0,end-seconds),span=seconds;
  const bins=history.bins.filter(b=>b.t>=left&&b.t<=end);
  let peak=0;for(const b of bins)peak=Math.max(peak,-b.low,b.high);
  const range=Math.max(.02,2**Math.ceil(Math.log2(Math.max(.01,peak)*1.1)));
  const dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const top=25,bottom=h-8,mid=(top+bottom)/2,scale=(bottom-top)*.46/range;
  c.font='12px sans-serif';c.textBaseline='top';c.fillStyle='#a6ab9f';c.strokeStyle='#303831';c.lineWidth=1;
  for(let tick=Math.ceil(left/5)*5;tick<=left+span;tick+=5){
   const x=(tick-left)/span*w;c.textAlign=x>w-35?'right':x<30?'left':'center';c.fillText(`${tick.toFixed(0)}s`,x,2);
   c.beginPath();c.moveTo(x,19);c.lineTo(x,23);c.stroke();
  }
  c.beginPath();c.moveTo(0,mid);c.lineTo(w,mid);c.stroke();
  const columns=new Map();for(const b of bins){const x=Math.min(Math.floor(w)-1,Math.floor((b.t-left)/span*w));const p=columns.get(x)||[0,0];p[0]=Math.min(p[0],b.low);p[1]=Math.max(p[1],b.high);columns.set(x,p)}
  c.strokeStyle='#76cfc3';c.lineWidth=Math.max(1,w/span*.02);c.beginPath();
  for(const [x,[low,high]] of columns){c.moveTo(x,mid-high*scale);c.lineTo(x,mid-low*scale)}c.stroke();
  const x=(end-left)/span*w;c.strokeStyle='#d7faf3';c.lineWidth=1;c.beginPath();c.moveTo(x,top);c.lineTo(x,bottom);c.stroke();
  $('waveAmplitude').textContent=`±${Number(range.toPrecision(3))} · auto scale`;
  $('waveTime').textContent=active&&isPlaying?frequency:'30 s history';
  $('waveTime').title='Strongest frequency in the mixed output; it may be a note or harmonic. Several colors and delayed notes can overlap.';
  const r=window.regionSelection;
  const playback=window.soundLabController?.playback();
  $('waveLabel').textContent=active&&isPlaying&&r?(playback?.melody?'Melody · '+NodeScore.note(playback.midi):`${playback?.group?playback.regionIds.length+' regions': 'Region '+r.cardId} · ${document.querySelector('[data-listen].active')?.textContent||'Audio'}`):history.bins.length?'Stopped · history kept':'Ready';
  canvas.dataset.peak=peak.toFixed(5);canvas.dataset.historySeconds=end.toFixed(2);canvas.dataset.capture=exact?'pcm':'sampled';
  canvas.setAttribute('aria-label',`Audio amplitude history, ${left.toFixed(1)} to ${end.toFixed(1)} seconds. ${active?frequency:'Stopped'}.`);
  canvas.title=exact?'Output waveform · last 30 seconds':'Sampled output waveform · last 30 seconds';
 }
 return {connect,begin,draw,History,strongest};
})();
