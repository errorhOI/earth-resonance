const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/dist/scan-speed.js','utf8'),key='cosmic-siblings.scan-speed.v1';
const storage=new Map();
function page(blocked=false){
 const listeners={},events={},attrs={},control={value:'1',setAttribute:(k,v)=>attrs[k]=v,addEventListener:(event,fn)=>listeners[event]=fn},output={};
 const scope={window:{addEventListener:(n,fn)=>events[n]=fn},document:{hidden:false,addEventListener:(n,fn)=>events[n]=fn,getElementById:id=>id==='scanSpeed'?control:output},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k)??null},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v)}}};
 vm.runInNewContext(code,scope);return {control,output,attrs,events,document:scope.document,change:(value,event='input')=>{control.value=value;listeners[event]()}};
}
let ui=page();assert.equal(ui.control.value,'1');
ui.change('0.5');assert.equal(storage.get(key),'0.5');
ui=page();assert.equal(ui.control.value,'0.5');assert.equal(ui.output.textContent,'0.5×');assert.equal(ui.attrs['aria-valuetext'],'0.5×');
ui.change('1.75');assert.equal(page().control.value,'1.75');
ui.change('0.75','change');assert.equal(page().control.value,'0.75');
ui.control.value='1.25';ui.events.pagehide();assert.equal(page().control.value,'1.25');
ui.control.value='1.5';ui.document.hidden=true;ui.events.visibilitychange();assert.equal(page().control.value,'1.5');
for(const invalid of ['NaN','9','0','1.1','', 'null']){storage.set(key,invalid);assert.equal(page().control.value,'1')}
ui=page(true);ui.change('2');assert.equal(ui.output.textContent,'2×');
console.log('Passed: scan speed restores after reload, updates labels, validates stored values, and works when storage is blocked.');
