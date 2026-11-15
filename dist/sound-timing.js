'use strict';
window.SoundTiming = (() => {
 const tracked=new WeakMap();
 return {
 scan(playback,region){
  if(!playback?.active||!region)return null;
  const sample=playback.colorSamples?.find(s=>s.cardId===region.cardId)||playback.colorSample;
  if(playback.live)return sample?.cardId===region.cardId&&Number.isInteger(sample.scanIndex)&&sample.scanCount>0?(sample.scanIndex+.5)/sample.scanCount:null;
  if(playback.cardId!==region.cardId||playback.seconds>=4)return null;
  return (Math.floor(Math.max(0,playback.seconds)/.25)+.5)/16;
 },
 focus(region,waves){
  const key=p=>JSON.stringify([p.start,p.cardId,p.profileId,p.bearing,p.angle]);
  const previous=tracked.get(region);
  const focus=waves.find(p=>key(p)===previous)||waves.filter(p=>p.progress<1).sort((a,b)=>a.age-b.age)[0]||waves.at(-1);
  if(focus)tracked.set(region,key(focus));else tracked.delete(region);
  return focus;
 },
 now(ctx){
  const stamp=ctx.getOutputTimestamp?.();
  if(stamp?.performanceTime>0&&stamp.contextTime>0&&ctx.state==='running')
   return Math.min(ctx.currentTime,stamp.contextTime+Math.max(0,performance.now()-stamp.performanceTime)/1000);
  return Math.max(0,ctx.currentTime-(ctx.outputLatency||0)-(ctx.baseLatency||0));
 },
 waves(playback,region,ray){
  if(!playback?.active)return [];
  return (playback.wavePulses||[]).filter(p=>p.cardId===region.cardId&&p.profileId===region.profile.id&&p.bearing===ray.bearing_deg&&p.angle===ray.angle_deg&&p.age>=0&&p.age<=p.travel+.18)
   .map(p=>({...p,progress:Math.min(1,p.age/p.travel),arrived:p.arrival&&p.age>=p.travel,after:p.age-p.travel}));
 }
 };
})();
