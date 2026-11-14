'use strict';
// A short melody-only excerpt, not a complete score. See Sources & method.
const NodeScore={
 key:'cosmic-siblings.node-melody.v1',
 phrase:()=>({bpm:48,steps:[null,69,71,66,62,64,66,69,64].map((midi,i)=>({midi,beats:[1,.5,.5,1.5,.25,1.75,.25,.25,2][i],region:'auto'}))}),
 identity:r=>JSON.stringify([r.kind,r.bounds]),
 note:midi=>midi===null?'Rest':['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi%12]+(Math.floor(midi/12)-1),
 valid:score=>score&&Number.isFinite(score.bpm)&&score.bpm>=30&&score.bpm<=160&&Array.isArray(score.steps)&&score.steps.length>0&&score.steps.length<=128&&score.steps.every(s=>(s.midi===null||(Number.isInteger(s.midi)&&s.midi>=36&&s.midi<=84))&&Number.isFinite(s.beats)&&s.beats>=.25&&s.beats<=4&&typeof s.region==='string'),
 resolve(score,regions){
  if(!this.valid(score))throw Error('Choose valid notes and tempo.');
  if(!regions.length)throw Error('Select a region node first.');
  if(!score.steps.some(s=>s.midi!==null))throw Error('Add at least one note.');
  let noteIndex=0;
  return score.steps.map(s=>{if(s.midi===null)return {...s,region:null};
   const region=s.region==='auto'?regions[noteIndex++%regions.length]:regions.find(r=>this.identity(r)===s.region);
   if(!region)throw Error('A melody region is missing or unchecked. Reassign it below.');
   return {...s,region};});
 }
};
window.NodeScore=NodeScore;
(() => {
 const host=document.getElementById('musicSequence');if(!host)return;
 let score=NodeScore.phrase(),signature='';
 try{const saved=JSON.parse(localStorage.getItem(NodeScore.key));if(NodeScore.valid(saved)){score=saved;if(saved.steps.some(s=>s.backing)){score={...saved,steps:saved.steps.map(({backing,...step})=>step)};localStorage.setItem(NodeScore.key,JSON.stringify(score))}}}catch{}
 const panel=document.createElement('section');panel.id='nodeMelody';panel.hidden=true;panel.setAttribute('aria-label','Node melody editor');
 panel.innerHTML='<div class="melody-toolbar"><label>Tempo <input id="melodyTempo" type="number" min="30" max="160" step="1" aria-label="Melody tempo in BPM"> BPM</label><button id="addMelodyNote" type="button">+ Note</button></div><div id="melodySteps"></div><p class="micro">Notes: composed · Tone: region colors</p>';
 host.append(panel);
 const rows=panel.querySelector('#melodySteps'),tempo=panel.querySelector('#melodyTempo');tempo.value=score.bpm;
 const save=()=>{try{localStorage.setItem(NodeScore.key,JSON.stringify(score))}catch{}};
 function change(){window.musicSequence?.stop();save();window.dispatchEvent(new Event('melody-edited'))}
 const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o};
 function draw(){
  const regions=regionCards.list().filter(r=>r.included!==false);signature=regions.map(NodeScore.identity).join('|');rows.replaceChildren();
  score.steps.forEach((step,i)=>{
   const row=document.createElement('div');row.className='melody-step';row.dataset.step=i;
   const number=document.createElement('span');number.textContent='Step '+String(i+1).padStart(2,'0');
   const note=document.createElement('select');note.setAttribute('aria-label',`Step ${i+1} note`);note.append(option('rest','Rest'));
   for(let midi=36;midi<=84;midi++)note.append(option(midi,NodeScore.note(midi)));note.value=step.midi===null?'rest':step.midi;
   note.onchange=()=>{step.midi=note.value==='rest'?null:Number(note.value);change();draw()};
   const beats=document.createElement('select');beats.setAttribute('aria-label',`Step ${i+1} beats`);
   for(let b=.25;b<=4;b+=.25)beats.append(option(b,`${b} beat${b===1?'':'s'}`));beats.value=step.beats;beats.onchange=()=>{step.beats=Number(beats.value);change()};
   const region=document.createElement('select');region.setAttribute('aria-label',`Step ${i+1} region`);region.append(option('auto','Next node'));
   for(const r of regions){region.append(option(NodeScore.identity(r),`Region ${String(r.cardId).padStart(2,'0')} · ${r.kind==='ocean'?'Ocean':'Aerosols'}`))}
   if(step.region!=='auto'&&!regions.some(r=>NodeScore.identity(r)===step.region))region.append(option(step.region,'Missing region'));
   region.value=step.region;region.disabled=step.midi===null;region.onchange=()=>{step.region=region.value;change()};
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove step ${i+1}`);remove.disabled=score.steps.length===1;remove.onclick=()=>{score.steps.splice(i,1);change();draw()};
   row.append(number,note,beats,region,remove);rows.append(row);
  });
 }
 tempo.onchange=()=>{score.bpm=Math.max(30,Math.min(160,Math.round(Number(tempo.value)||48)));tempo.value=score.bpm;change()};
 panel.querySelector('#addMelodyNote').onclick=()=>{if(score.steps.length>=128)return;score.steps.push({midi:62,beats:1,region:'auto'});change();draw()};
 window.MelodyEditor={get bpm(){return score.bpm},get active(){return document.getElementById('nodeMode').value==='melody'},getScore:()=>JSON.parse(JSON.stringify(score)),load(next){if(!NodeScore.valid(next))return false;window.musicSequence?.stop();score=JSON.parse(JSON.stringify(next));tempo.value=score.bpm;save();draw();return true},resolve:regions=>NodeScore.resolve(score,regions),sync(mode){panel.hidden=mode!=='melody';const next=regionCards.list().filter(r=>r.included!==false).map(NodeScore.identity).join('|');if(next!==signature)draw();window.dispatchEvent(new Event('melody-mode-changed'))},paint(state){for(const row of rows.children)row.classList.toggle('playing',!!state?.active&&!!state.melody&&Number(row.dataset.step)===state.stepIndex)}};
 draw();
})();
