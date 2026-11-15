'use strict';
(() => {
 const DSP=SoundDSP;
 let settings={...DSP.defaults},mode='processed',ctx,source,output,sourceGain,startTime=0,offset=0,version=0,changeTimer;
 let pendingPlay=false,activePath=null,live=null,outputMonitor;
 const originals=new Map(),mixes=new Map();
 const $=id=>document.getElementById(id);
 const volumeKey='cosmic-siblings.volume';
 const volumeGain=()=>Math.max(0,Math.min(2,Number($('volume').value)/100||0));
 try{const saved=localStorage.getItem(volumeKey);if(saved!==null&&saved!==undefined&&saved.trim()!==''&&Number.isFinite(Number(saved)))$('volume').value=Math.max(0,Math.min(200,Number(saved)))}catch{}
 $('volumeValue').textContent=$('volume').value+'%';
 const delay=()=>$('echo').checked&&window.regionSelection&&currentRay?.status==='returned'?currentRay.travel_seconds/1000:0;
 const snapshot=()=>({region:window.regionSelection,voice:$('voice').value,effects:{...settings},scan_speed:+$('scanSpeed').value,echo_enabled:$('echo').checked,delay_seconds:delay(),travel_seconds:currentRay.path_seconds.at(-1)/1000,profile_id:$('location').value,bearing:currentRay.bearing_deg,angle:currentRay.angle_deg,balanced:$('balance').checked});
 async function original(voice,region=window.regionSelection){if(!region)throw Error('Select a region on the flat map first.');const key=region.key+voice;if(!originals.has(key)){if(originals.size>12)originals.clear();originals.set(key,RegionSound.synth(region.features,region.kind,voice))}return originals.get(key)}
 async function mix(s){const key=JSON.stringify([s.region?.key,s.voice,s.effects,s.delay_seconds]);if(!mixes.has(key)){if(mixes.size>5)mixes.delete(mixes.keys().next().value);const p=original(s.voice,s.region).then(b=>DSP.render(b,s.effects,s.delay_seconds));mixes.set(key,p);p.catch(()=>mixes.delete(key))}return mixes.get(key)}
 function position(){return playing&&ctx?Math.max(0,ctx.currentTime-startTime+offset):0}
 function prepareAudio(){
  if(!ctx){ctx=new AudioContext({sampleRate:48000});const graph=DSP.outputGraph(ctx);output=graph.input;outputMonitor=graph.monitor;analyser=ctx.createAnalyser();analyser.fftSize=2048;outputMonitor.connect(analyser).connect(ctx.destination)}
  const resumed=ctx.resume();void AudioHistory.connect(ctx,outputMonitor);return resumed;
 }
 function stop(){for(const v of new Set([typeof oceanVideo==='undefined'?null:oceanVideo,typeof aerosolVideo==='undefined'?null:aerosolVideo,currentVideo]))v?.pause?.();clearTimeout(changeTimer);pendingPlay=false;version++;if(live){live.stop();live=null;const r=window.regionSelection;if(r?.liveFrame!==undefined)$('regionStatus').textContent='Frame '+r.liveFrame.toFixed(1)+' s · atmosphere grid '+AtmosphereGeo.coordinate(r.profile.latitude,r.profile.longitude)}if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}sourceGain?.disconnect();playing=false;if(globe)globe.spectrum=null;$('audioStatus').hidden=true;$('audioStatus').textContent='';$('regionStatus').dataset.audioMode='stopped';window.dispatchEvent(new Event('soundlab-stop'))}
 async function play(at=0,{once=false,onScanComplete,regions,melody}={}){
  clearTimeout(changeTimer);pendingPlay=true;const ticket=++version,s=snapshot(),chosenMode=mode;
  try{
   await prepareAudio();if(ticket!==version)return;$('audioStatus').hidden=true;
   if(live){live.stop();live=null}
   if(melody){
    if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}sourceGain?.disconnect();
    output.gain.value=volumeGain();activePath={propagation:true};
    live=new NodeMelodyAudio({ctx,output,steps:melody.steps,bpm:melody.bpm,videoFor:r=>r.kind==='ocean'?oceanVideo:aerosolVideo,
     config:r=>{const ray=r.profile.rays.find(ray=>ray.bearing_deg===s.bearing&&ray.angle_deg===s.angle);
      if(!ray)throw Error('Atmospheric path unavailable for this region.');
      return {...s,profile_id:r.profile.id,delay_seconds:s.echo_enabled&&ray.status==='returned'?ray.travel_seconds/1000:0,travel_seconds:ray.path_seconds.at(-1)/1000};},
     onError:error=>{if(ticket===version){stop();$('audioStatus').hidden=false;$('audioStatus').textContent=error.message}},
     onComplete:()=>{if(ticket===version){if(onScanComplete)onScanComplete();else stop()}}});
    AudioHistory.begin();playing=true;pendingPlay=false;await live.start();return ticket===version;
   }
   if(regions?.length){
    if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}sourceGain?.disconnect();
    output.gain.value=volumeGain();activePath={propagation:chosenMode==='processed'};
    live=new LiveRegionGroup({ctx,output,regions,videoFor:r=>r.kind==='ocean'?oceanVideo:aerosolVideo,
     config:r=>{
      const ray=r.profile.rays.find(ray=>ray.bearing_deg===s.bearing&&ray.angle_deg===s.angle);
      if(!ray)throw Error('Atmospheric path unavailable for this region.');
      return {...s,region:r,mode:chosenMode,scan_speed:+$('scanSpeed').value,
       profile_id:r.profile.id,delay_seconds:s.echo_enabled&&ray.status==='returned'?ray.travel_seconds/1000:0,
       travel_seconds:ray.path_seconds.at(-1)/1000};
     },onSample:(r,sample)=>{if(ticket===version){r.liveFeatures=sample.columns;r.liveFrame=sample.frame}},
     onError:error=>{if(ticket===version){stop();$('audioStatus').hidden=false;$('audioStatus').textContent=error.message}},
     onComplete:()=>{if(ticket===version)onScanComplete?.()}});
    AudioHistory.begin();playing=true;pendingPlay=false;await live.start();return ticket===version;
   }
   if(['ocean','aerosols'].includes(s.region?.kind)&&($('followVideo').checked||onScanComplete)&&currentVideo){
    if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}sourceGain?.disconnect();
    output.gain.value=volumeGain();currentVideo.loop=true;
    activePath={propagation:chosenMode==='processed',arrival:chosenMode==='processed'&&s.delay_seconds>0,profileId:s.profile_id,bearing:s.bearing,angle:s.angle};
    let count=0;
    live=new LiveRegionAudio({ctx,output,region:s.region,video:currentVideo,maxSteps:(once||onScanComplete||!$('loop').checked)?16:Infinity,onComplete:()=>{if(ticket===version){if(onScanComplete)onScanComplete();else stop()}},
     config:()=>({...snapshot(),mode}),
     onSample:sample=>{if(ticket!==version)return;const r=window.regionSelection;r.liveFeatures=sample.columns;r.liveFrame=sample.frame+sourceOffset;
      $('regionCoordinates').dataset.sourceFingerprint=sample.fingerprint;
      $('regionStatus').textContent='Live · '+r.liveFrame.toFixed(1)+' s · atmosphere grid '+AtmosphereGeo.coordinate(r.profile.latitude,r.profile.longitude);
      $('regionStatus').dataset.audioMode='live-video';$('regionStatus').dataset.videoTime=sample.frame.toFixed(3);$('regionStatus').dataset.sampleCount=++count;
     },onPaused:()=>{if(ticket!==version)return;$('regionStatus').dataset.audioMode='paused';$('regionStatus').textContent='Paused · atmosphere grid '+AtmosphereGeo.coordinate(s.region.profile.latitude,s.region.profile.longitude)},onEnded:stop,onError:error=>{stop();$('audioStatus').hidden=false;$('audioStatus').textContent=error.message}});
    AudioHistory.begin();playing=true;pendingPlay=false;await live.start();return true;
   }
   const raw=await original(s.voice,s.region),buffer=chosenMode==='original'?raw:await mix(s);
   if(ticket!==version)return;if(!buffer)throw Error('Select a region first.');
   const previousSource=source,previousGain=sourceGain;
   if(previousSource){previousSource.onended=null;previousGain.gain.cancelScheduledValues(ctx.currentTime);previousGain.gain.setValueAtTime(previousGain.gain.value,ctx.currentTime);previousGain.gain.linearRampToValueAtTime(0,ctx.currentTime+.025);try{previousSource.stop(ctx.currentTime+.03)}catch{}setTimeout(()=>{previousSource.disconnect();previousGain.disconnect()},60)}
   source=ctx.createBufferSource();source.buffer=buffer;source.loop=!once&&$('loop').checked;sourceGain=ctx.createGain();
   const targetLevel=DSP.level(buffer,raw,s.balanced);sourceGain.gain.setValueAtTime(0,ctx.currentTime);sourceGain.gain.linearRampToValueAtTime(targetLevel,ctx.currentTime+.025);output.gain.value=volumeGain();
   source.connect(sourceGain).connect(output);offset=at%buffer.duration;startTime=ctx.currentTime;AudioHistory.begin();source.start(startTime,offset);playing=true;pendingPlay=false;activePath={propagation:chosenMode==='processed'&&!!s.region,arrival:chosenMode==='processed'&&s.delay_seconds>0,profileId:s.profile_id,bearing:s.bearing,angle:s.angle,cardId:s.region.cardId,travel:s.travel_seconds,onsets:RegionSound.onsets(s.region.features,s.region.kind),duration:buffer.duration};
   $('regionStatus').dataset.audioMode='static-frame';
   source.onended=()=>{if(ticket===version){playing=false;$('regionStatus').dataset.audioMode='stopped';globe&&(globe.spectrum=null);window.dispatchEvent(new Event('soundlab-ended'))}};
   return true;
  }catch(error){if(ticket===version){stop();$('audioStatus').hidden=false;$('audioStatus').textContent=error.message}}
 }
 function setMode(next,replay=true){const at=position(),was=playing||pendingPlay;mode=next;for(const b of document.querySelectorAll('[data-listen]')){b.classList.toggle('active',b.dataset.listen===mode);b.setAttribute('aria-pressed',b.dataset.listen===mode)}if(was&&replay)play(at)}
 function syncControls(){for(const [key,value] of Object.entries(settings)){$('fx-'+key).value=value;$('fx-'+key+'-value').textContent=value+(key==='bass'||key==='mid'||key==='treble'?' dB':'%')}}
 function changed(){clearTimeout(changeTimer);if((playing||pendingPlay)&&mode==='processed')changeTimer=setTimeout(()=>play(position()),120)}
 for(const control of document.querySelectorAll('[data-fx]'))control.oninput=()=>{settings[control.dataset.fx]=+control.value;$('preset').value='custom';syncControls();changed()};
 $('preset').onchange=()=>{if(!DSP.presets[$('preset').value])return;settings={...DSP.presets[$('preset').value]};syncControls();setMode('processed',false);changed()};
 $('resetFx').onclick=()=>{settings={...DSP.defaults};$('preset').value='clean';syncControls();changed()};
 $('openLab').onclick=()=>$('soundLab').showModal();$('closeLab').onclick=()=>$('soundLab').close();
 const playCurrent=()=>window.musicSequence?window.musicSequence.start($('nodeMode').value==='single'?window.regionSelection?.cardId:undefined):play();
 $('play').onclick=playCurrent;$('labPlay').onclick=()=>{setMode('processed',false);playCurrent()};$('stop').onclick=stop;
 for(const b of document.querySelectorAll('[data-listen]'))b.onclick=()=>setMode(b.dataset.listen);
 $('volume').oninput=()=>{$('volumeValue').textContent=$('volume').value+'%';try{localStorage.setItem(volumeKey,String(volumeGain()*100))}catch{}if(output)output.gain.setTargetAtTime(volumeGain(),ctx.currentTime,.02)};
 const loopKey='cosmic-siblings.listen-loop';
 const echoKey='cosmic-siblings.echo';
 try{const saved=localStorage.getItem(echoKey);if(saved==='true'||saved==='false')$('echo').checked=saved==='true'}catch{}
 $('echo').onchange=()=>{try{localStorage.setItem(echoKey,String($('echo').checked))}catch{}
  mixes.clear();const sequence=window.musicSequence;
  if(sequence?.running){const id=sequence.order[sequence.index]?.cardId;sequence.start(id)}
  else if(playing||pendingPlay){const at=position();stop();void play(at)}
 };
 try{const saved=localStorage.getItem(loopKey);if(saved==='true'||saved==='false')$('loop').checked=saved==='true'}catch{}
 $('loop').onchange=()=>{try{localStorage.setItem(loopKey,String($('loop').checked))}catch{}if(!window.musicSequence?.running){if(source)source.loop=$('loop').checked;live?.setLoop?.($('loop').checked)}};$('balance').onchange=()=>{if(playing||pendingPlay)play(position())};
 $('followVideo').onchange=()=>{const was=playing||pendingPlay,r=window.regionSelection;if(!$('followVideo').checked&&r?.liveFeatures){window.regionSelection={...r,features:r.liveFeatures,frame:r.liveFrame,key:r.key+'-frame-'+RegionSound.fingerprint(r.liveFeatures)}}stop();if(was)play()};
 $('voice').onchange=()=>{const was=playing||pendingPlay;stop();if(was)play()};
 function playback(){
  const audible=playing&&ctx?Math.max(0,SoundTiming.now(ctx)-startTime+offset):0;
  const state={active:playing,seconds:source?.loop?audible%(activePath?.duration||1):audible,...activePath};
  if(live)return {...state,...live.playback()};
  state.wavePulses=[];
  if(playing&&source&&activePath?.propagation){
   const elapsed=SoundTiming.now(ctx)-startTime+offset,cycle=source.loop?Math.floor(elapsed/activePath.duration):0;
   for(const loop of source.loop?[cycle-1,cycle]:[0])for(const onset of activePath.onsets){
    const start=loop*activePath.duration+onset,age=elapsed-start;
    if(loop>=0&&age>=0&&age<=activePath.travel+.18)state.wavePulses.push({...activePath,start:startTime-offset+start,age});
   }
  }
  return state;
 }
 window.soundLabController={stop,prepareAudio,busy:()=>playing||pendingPlay,regionChanged:()=>{stop();mixes.clear()},playProcessedOnce:()=>{stop();setMode('processed',false);return play(0,{once:true})},atmosphereChanged:changed,
  playTogether:(regions,onComplete)=>{stop();setMode('processed',false);return play(0,{regions,onScanComplete:onComplete})},
  playMelody:(steps,bpm,onComplete)=>{stop();setMode('processed',false);return play(0,{melody:{steps,bpm},onScanComplete:onComplete})},
  playScan:onComplete=>{stop();setMode('processed',false);return play(0,{once:true,onScanComplete:onComplete})},
  applyUserPreset:p=>{settings={...p.effects};$('voice').value=p.voice;$('balance').checked=p.balanced;syncControls();setMode('processed',false);changed();window.dispatchEvent(new Event('soundlab-preset-applied'))},
  playback};syncControls();
})();
