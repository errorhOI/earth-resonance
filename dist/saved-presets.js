'use strict';
// Existing presets remain usable; Sound Lab no longer creates or manages saved presets.
(() => {
 const STORAGE='cosmic-siblings.sound-presets.v1',select=$('preset');
 const limits={bass:[-12,12],mid:[-12,12],treble:[-12,12],smooth:[0,100],dynamics:[0,100],reverb:[0,100],width:[0,180],octave:[0,100]};
 let presets=[];
 function valid(p){return p&&typeof p.id==='string'&&/^user_[a-z0-9_-]+$/i.test(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=40&&['bells','soft_synth','orchestral'].includes(p.voice)&&typeof p.balanced==='boolean'&&p.effects&&Object.keys(p.effects).length===Object.keys(limits).length&&Object.entries(limits).every(([key,[min,max]])=>typeof p.effects[key]==='number'&&Number.isFinite(p.effects[key])&&p.effects[key]>=min&&p.effects[key]<=max)}
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE));
  if(saved?.version===1&&Array.isArray(saved.presets)&&saved.presets.length<=100&&saved.presets.every(valid))presets=saved.presets;
 }catch{}
 if(presets.length){const group=document.createElement('optgroup');group.label='My presets';for(const p of presets)group.append(new Option(p.name,p.id));select.append(group)}
 select.addEventListener('change',()=>{const p=presets.find(p=>p.id===select.value);if(p)window.soundLabController.applyUserPreset(p)});
 for(const id of ['voice','balance'])$(id).addEventListener('change',()=>{if(select.value.startsWith('user_'))select.value='custom'});
})();
