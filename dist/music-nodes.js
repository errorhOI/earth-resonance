'use strict';
// A node is one complete color scan followed by its rendered sound/arrival tail.
// Completion comes from the audio output clock, never a wall-clock timer.
class MusicNodeSequence {
 constructor({regions,activate,play,stopAudio,loop,update,together=()=>false,single=()=>false}){Object.assign(this,{regions,activate,play,stopAudio,loop,update,together,single});this.generation=0;this.running=false;this.transitioning=false;this.index=-1;this.order=[]}
 start(id){
  this.stop();this.order=this.regions().slice();if(!this.order.length)return;
  this.group=this.together();this.index=this.group?0:Math.max(0,this.order.findIndex(r=>r.cardId===id));if(this.single()){this.order=[this.order[this.index]];this.index=0}this.running=true;
  return this.next(this.generation);
 }
 stop(){this.running=false;this.transitioning=false;this.generation++;this.stopAudio();this.update(this);this.onStop?.()}
 async next(token){
  if(!this.running||token!==this.generation)return;
  if(this.index>=this.order.length){if(this.loop())this.index=0;else{this.stop();return}}
  const region=this.order[this.index];this.transitioning=true;this.update(this);
  try{
   await this.activate(region);if(!this.running||token!==this.generation)return;
   let advanced=false;
   const started=await this.play(()=>{
    if(advanced||!this.running||token!==this.generation)return;
    advanced=true;this.index+=this.group?this.order.length:1;void this.next(token);
   },this.group?this.order:null);
   if(token!==this.generation)return;
   this.transitioning=false;if(!started)this.stop();else this.update(this);
  }catch(error){if(token===this.generation){this.stop();this.onError?.(error)}}
 }
}
window.MusicNodeSequence=MusicNodeSequence;
(() => {
 const $=id=>document.getElementById(id),strip=$('musicNodes'),play=$('play'),stop=$('stop'),loop=$('loop'),status=$('nodeStatus'),mode=$('nodeMode');
 let signature='',sequence;
 // Playback mode is session-only: every page load starts with one region.
 mode.value='single';
 mode.onchange=()=>{sequence.stop();signature='';sync()};
 function paint(){
  const playback=window.soundLabController?.playback(),melody=mode.value==='melody';
  const current=sequence?.running?(melody?playback?.colorSample?.cardId:sequence.order[sequence.index]?.cardId):null;
  for(const node of strip.querySelectorAll('button')){
   const active=!!sequence?.running&&(sequence.group&&!melody?sequence.order.some(r=>r.cardId===Number(node.dataset.region)):Number(node.dataset.region)===current);node.classList.toggle('playing',active);node.setAttribute('aria-pressed',String(active));
  }
  const busy=!!sequence?.running||!!window.soundLabController?.busy();
  play.disabled=!regionCards.list().some(r=>r.included!==false)||busy;stop.disabled=!busy&&![oceanVideo,aerosolVideo,currentVideo].some(v=>v&&!v.paused);
  status.textContent=sequence?.running?(melody?(playback?.melody&&playback.stepIndex>=0?NodeScore.note(playback.midi):'…'):sequence.group?`${sequence.order.length} regions`:`${sequence.index+1} / ${sequence.order.length}`):'';
  window.MelodyEditor?.paint(playback);
 }
 function sync(){
  const regions=regionCards.list(),next=regions.map(r=>r.cardId+':'+r.key+':'+(r.included!==false)).join('|');
  if(next!==signature){
   if(sequence?.running)sequence.stop();signature=next;strip.replaceChildren();
   regions.forEach((r,i)=>{
    if(i){const link=document.createElement('span');link.className='node-link';link.textContent=mode.value==='together'?'+':'→';link.setAttribute('aria-hidden','true');strip.append(link)}
    const node=document.createElement('button');node.type='button';node.className='music-node';node.dataset.region=r.cardId;
    const label=document.createElement('span'),coords=document.createElement('small');
    label.textContent=`Region ${String(r.cardId).padStart(2,'0')} · ${r.kind==='ocean'?'Ocean':'Aerosols'}`;
    coords.textContent=AtmosphereGeo.coordinate(r.latitude,r.longitude);node.append(label,coords);
    node.title=mode.value==='together'?'Play selected regions':'Play from this node';node.setAttribute('aria-label',`${mode.value==='together'?'Play selected regions, node':'Play from node'} ${i+1}, ${r.kind}, ${coords.textContent}`);
    node.onclick=()=>{if(r.included===false){r.included=true;regionCards.highlight()}sequence.start(r.cardId)};
    const choice=document.createElement('div');choice.className='node-choice';
    const include=document.createElement('input');include.type='checkbox';include.checked=r.included!==false;
    include.setAttribute('aria-label',`Include node ${i+1}, ${r.kind}`);
    include.onchange=()=>{sequence.stop();r.included=include.checked;regionCards.highlight()};
    choice.append(include,node);strip.append(choice);
   });
  }
  $('musicSequence').hidden=!regions.length;window.MelodyEditor?.sync(mode.value);paint();
 }
 sequence=new MusicNodeSequence({regions:()=>regionCards.list().filter(r=>r.included!==false),together:()=>mode.value==='together'||mode.value==='melody',single:()=>mode.value==='single',
  activate:async region=>{await regionPicker.activate(region);regionCards.show(true)},
  play:(done,regions)=>mode.value==='melody'?soundLabController.playMelody(MelodyEditor.resolve(regions),MelodyEditor.bpm,done):regions?soundLabController.playTogether(regions,done):soundLabController.playScan(done),stopAudio:()=>soundLabController.stop(),loop:()=>loop.checked,update:paint});
 sequence.onError=error=>setVisualStatus(error.message||'Sequence stopped. Try playing the selected region.');
 play.onclick=()=>sequence.start(mode.value==='single'?window.regionSelection?.cardId:undefined);stop.onclick=()=>sequence.stop();
 window.addEventListener('regions-changed',sync);
 window.addEventListener('soundlab-stop',()=>{if(sequence.running&&!sequence.transitioning)sequence.stop()});
 // Explicit single-region actions take over immediately, including during loading.
 document.addEventListener('click',e=>{
  if(sequence.running&&e.target.closest('[data-listen],.card-select,.card-atmosphere,.card-remove,#import,#editRegion'))sequence.stop();
 },true);
 document.addEventListener('input',e=>{
  if(sequence.running&&e.target.matches('#voice,#preset,#dataset,#time,[data-fx],#bearing,#angle,#overlayBearing,#overlayAngle,#balance'))sequence.stop();
 },true);
 document.addEventListener('change',e=>{
  if(sequence.running&&e.target.matches('#voice,#preset,#dataset,#bearing,#angle,#overlayBearing,#overlayAngle,#balance'))sequence.stop();
 },true);
 document.addEventListener('pointerdown',e=>{if(sequence.running&&e.target.id==='globe')sequence.stop()},true);
 window.musicSequence=sequence;sync();
 function tick(){paint();requestAnimationFrame(tick)}requestAnimationFrame(tick);
})();
