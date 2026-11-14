'use strict';
class MelodyTemplates {
 constructor(storage){this.storage=storage;this.key='cosmic-siblings.melody-templates.v1';this.items=[];this.active='sweden';this.draft=null;
  try{const data=JSON.parse(storage.getItem(this.key));if(data?.version===1){const seen=new Set();this.items=(Array.isArray(data.items)?data.items:[]).filter(x=>x&&typeof x.id==='string'&&x.id.startsWith('user-')&&!seen.has(x.id)&&seen.add(x.id)&&typeof x.name==='string'&&x.name.trim()&&x.name.length<=48&&NodeScore.valid(x.score));this.active=['sweden','draft',...this.items.map(x=>x.id)].includes(data.active)?data.active:'sweden';if(NodeScore.valid(data.draft))this.draft=data.draft}}catch{}
 }
 persist(){this.storage.setItem(this.key,JSON.stringify({version:1,items:this.items,active:this.active,draft:this.draft}))}
 add(name,score){name=name.trim();if(!name||name.length>48||!NodeScore.valid(score))throw Error('Enter a name up to 48 characters.');if(name.toLowerCase()==='sweden'||this.items.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Choose a different name.');
  const item={id:'user-'+crypto.randomUUID(),name,score:structuredClone(score)};const previous=this.active;this.items.push(item);this.active=item.id;try{this.persist()}catch(error){this.items.pop();this.active=previous;throw Error('Could not save in this browser. Your melody is still open.')}return item;
 }
 edited(score){if(!NodeScore.valid(score))return;const item=this.items.find(x=>x.id===this.active);if(item)item.score=structuredClone(score);else{this.active='draft';this.draft=structuredClone(score)}this.persist()}
 rename(id,name){const item=this.items.find(x=>x.id===id);if(!item)throw Error('Select a saved template.');name=name.trim();if(!name||name.length>48)throw Error('Enter a name up to 48 characters.');if(name.toLowerCase()==='sweden'||this.items.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('Choose a different name.');const old=item.name;item.name=name;try{this.persist()}catch{item.name=old;throw Error('Could not save the new name.')}return item}
 remove(id){const index=this.items.findIndex(x=>x.id===id);if(index<0)throw Error('Select a saved template.');const item=this.items[index],active=this.active,draft=this.draft;
  this.items.splice(index,1);if(active===id){this.active='draft';this.draft=structuredClone(item.score)}
  try{this.persist()}catch{this.items.splice(index,0,item);this.active=active;this.draft=draft;throw Error('Could not delete the template.')}return {item:structuredClone(item),index,active};
 }
 restore(deleted){const item=structuredClone(deleted.item);if(this.items.some(x=>x.id===item.id||x.name.toLowerCase()===item.name.toLowerCase()))throw Error('A template with this name already exists.');const active=this.active,index=Math.min(deleted.index,this.items.length);this.items.splice(index,0,item);
  if(active==='draft'&&deleted.active===item.id&&JSON.stringify(this.draft)===JSON.stringify(item.score))this.active=item.id;
  try{this.persist()}catch{this.items.splice(index,1);this.active=active;throw Error('Could not restore the template.')}return item;
 }
}
window.MelodyTemplates=MelodyTemplates;
(() => {
 const $=id=>document.getElementById(id),select=$('melodyTemplate');if(!select)return;
 const library=new MelodyTemplates(localStorage),status=$('templateStatus'),dialog=$('templateDialog');let creating=false;
 const current=MelodyEditor.getScore(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(library.active==='sweden'&&!same(current,NodeScore.phrase())){library.active='draft';library.draft=current}
 const custom=library.items.find(x=>x.id===library.active);if(custom&&!same(custom.score,current)){library.active='draft';library.draft=current}
 const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o};
 function render(){select.replaceChildren(option('none','No melody'),option('sweden','Sweden'));if(library.draft)select.append(option('draft','Unsaved melody'));for(const item of library.items)select.append(option(item.id,item.name));select.append(option('new','+ New template'));select.value=MelodyEditor.active?library.active:'none';$('saveMelodyTemplate').disabled=!MelodyEditor.active;$('manageMelodyTemplates').hidden=!library.items.length}
 function activate(score){window.musicSequence.stop();MelodyEditor.load(score);$('nodeMode').value='melody';$('nodeMode').onchange();window.regionCards.show(true);render()}
 function open(isNew){creating=isNew;$('templateDialogTitle').textContent=isNew?'New template':'Save template';$('templateName').value='';$('templateError').textContent='';dialog.showModal();$('templateName').focus()}
 select.onchange=()=>{const value=select.value;status.hidden=true;if(value==='new'){render();open(true);return}
  if(value==='none'){$('nodeMode').value='order';$('nodeMode').onchange();render();return}
  const next=value==='sweden'?NodeScore.phrase():value==='draft'?library.draft:library.items.find(x=>x.id===value)?.score;
  if(!next)return;library.active=value;try{library.persist()}catch{status.hidden=false;status.textContent='Template choice could not save.'}activate(next);
 };
 $('saveMelodyTemplate').onclick=()=>open(false);$('closeTemplateDialog').onclick=()=>dialog.close();
 $('templateForm').onsubmit=e=>{e.preventDefault();if(!$('templateForm').reportValidity())return;const next=creating?{bpm:48,steps:[{midi:62,beats:1,region:'auto'}]}:MelodyEditor.getScore();try{library.add($('templateName').value,next);dialog.close();status.hidden=true;activate(next)}catch(error){$('templateError').textContent=error.message}};
 const manager=$('manageMelodyDialog'),managed=$('managedMelodyTemplate'),name=$('renamedMelodyTemplate'),message=$('manageMelodyStatus');let deleted=null;
 function syncManager(preferred=managed.value){managed.replaceChildren(...library.items.map(x=>option(x.id,x.name)));managed.value=library.items.some(x=>x.id===preferred)?preferred:library.items[0]?.id||'';const item=library.items.find(x=>x.id===managed.value);name.value=item?.name||'';for(const control of [managed,name,$('renameMelodyTemplate'),$('deleteMelodyTemplate')])control.disabled=!item;$('undoMelodyDelete').hidden=!deleted}
 $('manageMelodyTemplates').onclick=()=>{message.textContent='';syncManager(library.active);manager.showModal()};$('closeManageMelodies').onclick=()=>manager.close();
 managed.onchange=()=>{message.textContent='';syncManager()};
 $('manageMelodyForm').onsubmit=e=>{e.preventDefault();if(!$('manageMelodyForm').reportValidity())return;try{const item=library.rename(managed.value,name.value);render();syncManager(item.id);message.textContent='Renamed'}catch(error){message.textContent=error.message}};
 $('deleteMelodyTemplate').onclick=()=>{try{deleted=library.remove(managed.value);render();syncManager();message.textContent='Template deleted';}catch(error){message.textContent=error.message}};
 $('undoMelodyDelete').onclick=()=>{try{const item=library.restore(deleted);deleted=null;render();syncManager(item.id);message.textContent='Restored'}catch(error){message.textContent=error.message}};
 window.addEventListener('melody-edited',()=>{try{library.edited(MelodyEditor.getScore());status.hidden=true}catch{status.hidden=false;status.textContent='Changes could not save in this browser.'}render()});
 window.addEventListener('melody-mode-changed',render);render();
})();
