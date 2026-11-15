const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
class Element{
 constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={toggle(){}}}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=children}
 setAttribute(){}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)])}
}
(async()=>{
 const controls=new Map(),$=id=>{if(!controls.has(id))controls.set(id,new Element());return controls.get(id)};
 const listeners={},regions=[{cardId:1,key:'ocean',kind:'ocean'},{cardId:2,key:'aerosols',kind:'aerosols'}];
 let done,events=[],busy=false;
 const video=()=>({paused:false,pause(){this.paused=true}}),oceanVideo=video(),aerosolVideo=video();
 const sound={busy:()=>busy,playback:()=>({active:busy}),stop(){busy=false;oceanVideo.pause();aerosolVideo.pause()},
  async playScan(cb){events.push('scan');busy=true;done=cb;return true},
  async playTogether(rs,cb){events.push(rs.map(r=>r.cardId));busy=true;done=cb;return true},
  async playMelody(steps,bpm,cb){events.push('melody');busy=true;done=cb;return true}};
 const scope={window:{soundLabController:sound,addEventListener:(name,fn)=>listeners[name]=fn},
  document:{getElementById:$,createElement:tag=>Object.assign(new Element(),{tag}),addEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){}},regionCards:{list:()=>regions,show(){},highlight(){}},
  regionPicker:{async activate(r){scope.window.regionSelection=r;events.push(r.cardId)}},
  soundLabController:sound,MelodyEditor:{resolve:rs=>rs,bpm:48},AtmosphereGeo:{coordinate:()=>''},NodeScore:{note:()=>''},
  oceanVideo,aerosolVideo,currentVideo:oceanVideo,setVisualStatus:message=>{throw Error(message)},requestAnimationFrame(){}};
 vm.createContext(scope);vm.runInContext(read('music-nodes.js'),scope);
 const seq=scope.window.musicSequence;
 assert.equal($('nodeMode').value,'single');scope.window.regionSelection=regions[1];
 await $('play').onclick();assert.deepEqual(events,[2,'scan'],'One region uses the active card');
 done();await settle();assert(!seq.running,'Loop off stops after one selected region');
 assert(oceanVideo.paused&&aerosolVideo.paused,'Stop freezes imagery');
 for(const mode of ['order','together','melody']){
  events=[];$('nodeMode').value=mode;$('nodeMode').onchange();await $('play').onclick();
  if(mode==='order'){assert.deepEqual(events,[1,'scan']);done();await settle();assert.deepEqual(events,[1,'scan',2,'scan'])}
  if(mode==='together')assert.deepEqual(events,[1,[1,2]]);
  if(mode==='melody')assert.deepEqual(events,[1,'melody']);
  done();await settle();assert(!seq.running,mode+' finishes once');
 }
 events=[];$('nodeMode').value='order';$('nodeMode').onchange();$('loop').checked=true;await $('play').onclick();
 done();await settle();done();await settle();assert.deepEqual(events,[1,'scan',2,'scan',1,'scan'],'One Loop repeats the entire sequence');
 $('loop').checked=false;done();await settle();done();await settle();assert(!seq.running,'Turning Loop off finishes the current pass');
 events=[];await $('play').onclick();const stale=done;$('stop').onclick();stale();await settle();assert.deepEqual(events,[1,'scan'],'Shared Stop cancels later nodes');
 regions.forEach(r=>r.included=false);listeners['regions-changed']();assert($('play').disabled,'No selected nodes disables shared Play');
 const html=read('index.html');for(const id of ['play','stop','loop','nodeMode'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1);
 for(const id of ['playNodes','stopNodes','loopNodes','videoPlay'])assert(!html.includes('id="'+id+'"'),'Remove duplicate '+id);
 console.log('PASS: one transport, active single region, ordered/together/melody routing, whole-sequence loop, live loop-off, cancellation, empty selection and no duplicate controls');
})().catch(error=>{console.error(error);process.exitCode=1});
