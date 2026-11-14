'use strict';
(() => {
 const STORAGE='cosmic-siblings.sound-presets.v1',select=$('preset');
 const limits={bass:[-12,12],mid:[-12,12],treble:[-12,12],smooth:[0,100],dynamics:[0,100],reverb:[0,100],width:[0,180],octave:[0,100]};
 let presets=[],readError='';
 const group=document.createElement('optgroup');group.label='My presets';
 const button=document.createElement('button');button.id='savePreset';button.type='button';button.textContent='Save preset';
 $('closeLab').before(button);
 const manageButton=document.createElement('button');manageButton.id='managePresets';manageButton.type='button';manageButton.textContent='⋯';manageButton.title='Manage saved presets';manageButton.setAttribute('aria-label','Manage saved presets');$('closeLab').before(manageButton);
 const manager=document.createElement('dialog');manager.id='managePresetsDialog';manager.setAttribute('aria-labelledby','managePresetsTitle');
 manager.innerHTML='<div class="dialog-header"><h2 id="managePresetsTitle">My presets</h2><button id="closeManagePresets" type="button" aria-label="Close preset manager">×</button></div><form id="managePresetForm"><label for="managedPreset">Saved preset</label><select id="managedPreset"></select><label for="renamedPreset">Name</label><input id="renamedPreset" required maxlength="40" autocomplete="off"><p id="managePresetStatus" class="status" role="status"></p><div class="preset-manage-actions"><button id="deletePreset" type="button">Delete</button><button id="undoPresetDelete" type="button" hidden>Undo delete</button><button id="renamePreset" type="submit" class="primary">Rename</button></div></form>';
 document.querySelector('.visual-panel').append(manager);
 const dialog=document.createElement('dialog');dialog.id='savePresetDialog';dialog.setAttribute('aria-labelledby','savePresetTitle');
 dialog.innerHTML='<div class="dialog-header"><h2 id="savePresetTitle">Save my preset</h2><button id="closeSavePreset" type="button" aria-label="Close save preset">×</button></div><form id="savePresetForm"><label for="presetName">Name</label><input id="presetName" name="name" required maxlength="40" autocomplete="off" placeholder="e.g. Soft ocean"><p class="micro">Instrument + Sound Lab settings · saved in this browser</p><p id="presetSaveStatus" class="status" role="status"></p><button id="confirmSavePreset" type="submit" class="primary wide">Save preset</button></form>';
 document.querySelector('.visual-panel').append(dialog);
 function valid(p){return p&&typeof p.id==='string'&&/^user_[a-z0-9_-]+$/i.test(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=40&&['bells','soft_synth','orchestral'].includes(p.voice)&&typeof p.balanced==='boolean'&&p.effects&&Object.keys(p.effects).length===Object.keys(limits).length&&Object.entries(limits).every(([key,[min,max]])=>typeof p.effects[key]==='number'&&Number.isFinite(p.effects[key])&&p.effects[key]>=min&&p.effects[key]<=max)}
 function readStore(){
  const raw=localStorage.getItem(STORAGE);if(raw===null)return {version:1,presets:[],lastDeleted:null};
  const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.presets)||parsed.presets.length>100||!parsed.presets.every(valid)||(parsed.lastDeleted!=null&&!valid(parsed.lastDeleted)))throw Error('invalid saved presets');
  return parsed;
 }
 function read(){return readStore().presets}
 function write(next,lastDeleted=readStore().lastDeleted||null){localStorage.setItem(STORAGE,JSON.stringify({version:1,presets:next,lastDeleted}))}
 function populate(){
  const current=select.value;group.replaceChildren();
  for(const p of presets)group.append(new Option(p.name,p.id));
  if(presets.length)select.append(group);else group.remove();
  if([...select.options].some(o=>o.value===current))select.value=current;
  else if(current.startsWith('user_'))select.value='custom';
 }
 try{presets=read();populate()}catch{readError='Saved presets could not be read. Browser storage may be unavailable.'}
 function sameName(name){return presets.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())}
 function formLabel(){const name=$('presetName').value.trim();$('confirmSavePreset').textContent=sameName(name)?'Replace preset':'Save preset';$('presetName').setCustomValidity('')}
 button.onclick=()=>{
  try{presets=read();populate();readError=''}catch{readError='Saved presets could not be read. Browser storage may be unavailable.'}
  $('presetName').value=presets.find(p=>p.id===select.value)?.name||'';
  $('presetSaveStatus').textContent=readError;formLabel();dialog.showModal();$('presetName').focus();
 };
 $('closeSavePreset').onclick=()=>dialog.close();$('presetName').oninput=formLabel;
 $('savePresetForm').onsubmit=e=>{
  e.preventDefault();const name=$('presetName').value.trim();
  if(!name){$('presetName').setCustomValidity('Enter a preset name.');$('presetName').reportValidity();return}
  if([...select.options].some(o=>!o.value.startsWith('user_')&&o.textContent.toLocaleLowerCase()===name.toLocaleLowerCase())){$('presetSaveStatus').textContent='Choose a name different from the built-in presets.';return}
  try{
   presets=read();const existing=sameName(name);
   if(!existing&&presets.length>=100){$('presetSaveStatus').textContent='100 presets saved. Use an existing name to replace one.';return}
   const saved={id:existing?.id||'user_'+crypto.randomUUID(),name,...window.soundLabController.presetSnapshot()};
   const next=existing?presets.map(p=>p.id===existing.id?saved:p):[...presets,saved];
   write(next);
   presets=next;populate();select.value=saved.id;$('labStatus').textContent='Preset saved';dialog.close();
  }catch{$('presetSaveStatus').textContent='Could not save. Check browser storage; your sound settings are unchanged.'}
 };
 select.addEventListener('change',()=>{const p=presets.find(p=>p.id===select.value);if(p)window.soundLabController.applyUserPreset(p)});
 for(const id of ['voice','balance'])$(id).addEventListener('change',()=>{if(select.value.startsWith('user_'))select.value='custom'});
 function nameTaken(name,exceptId){return presets.some(p=>p.id!==exceptId&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase())||[...select.options].some(o=>!o.value.startsWith('user_')&&o.textContent.toLocaleLowerCase()===name.toLocaleLowerCase())}
 function manageFields(){const p=presets.find(p=>p.id===$('managedPreset').value);$('renamedPreset').value=p?.name||'';$('renamedPreset').setCustomValidity('');for(const id of ['managedPreset','renamedPreset','renamePreset','deletePreset'])$(id).disabled=!p}
 function renderManager(preferredId){
  const stored=readStore();presets=stored.presets;populate();$('managedPreset').replaceChildren();
  for(const p of presets)$('managedPreset').add(new Option(p.name,p.id));
  if(presets.some(p=>p.id===preferredId))$('managedPreset').value=preferredId;
  if(!presets.length)$('managedPreset').add(new Option('No saved presets',''));
  $('undoPresetDelete').hidden=!stored.lastDeleted;$('undoPresetDelete').disabled=false;manageFields();
 }
 manageButton.onclick=()=>{
  $('managePresetStatus').textContent='';try{renderManager(select.value)}catch{$('managePresetStatus').textContent='Could not read browser storage.';for(const id of ['renamePreset','deletePreset','undoPresetDelete'])$(id).disabled=true}
  manager.showModal();
 };
 $('closeManagePresets').onclick=()=>manager.close();
 $('managedPreset').onchange=()=>{$('managePresetStatus').textContent='';manageFields()};
 $('renamedPreset').oninput=()=>$('renamedPreset').setCustomValidity('');
 $('managePresetForm').onsubmit=e=>{
  e.preventDefault();const id=$('managedPreset').value,name=$('renamedPreset').value.trim();
  if(!name){$('renamedPreset').setCustomValidity('Enter a preset name.');$('renamedPreset').reportValidity();return}
  try{
   presets=read();if(!presets.some(p=>p.id===id))throw Error('missing preset');
   if(nameTaken(name,id)){$('managePresetStatus').textContent='That name is already used. Choose another.';return}
   write(presets.map(p=>p.id===id?{...p,name}:p));renderManager(id);$('managePresetStatus').textContent='Renamed';$('labStatus').textContent='Preset renamed';
  }catch{$('managePresetStatus').textContent='Could not rename. Check browser storage and try again.'}
 };
 $('deletePreset').onclick=()=>{
  try{presets=read();const id=$('managedPreset').value,p=presets.find(p=>p.id===id);if(!p)throw Error('missing preset');write(presets.filter(p=>p.id!==id),p);renderManager();$('managePresetStatus').textContent='Deleted. Your current sound is unchanged.';$('labStatus').textContent='Preset deleted'}
  catch{$('managePresetStatus').textContent='Could not delete. Check browser storage and try again.'}
 };
 $('undoPresetDelete').onclick=()=>{
  try{
   const stored=readStore(),p=stored.lastDeleted;presets=stored.presets;if(!p)return;
   if(presets.length>=100){$('managePresetStatus').textContent='Make room for one preset before restoring.';return}
   if(presets.some(item=>item.id===p.id)||nameTaken(p.name)){$('managePresetStatus').textContent='Rename the preset using this name before restoring.';return}
   write([...presets,p],null);renderManager(p.id);$('managePresetStatus').textContent='Restored';$('labStatus').textContent='Preset restored';
  }catch{$('managePresetStatus').textContent='Could not restore. Check browser storage and try again.'}
 };
})();
