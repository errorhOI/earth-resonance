const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/dist/saved-regions.js','utf8');
const key='cosmic-siblings.regions.v1';
const bounds={left:.1,right:.15,top:.2,bottom:.28};
const storage={value:null,getItem(){return this.value},setItem(k,v){assert.equal(k,key);this.value=v}};
async function boot({fail=false,during,slow=false}={}){
 const events={},documentEvents={},controls={bearing:{value:'90'},angle:{value:'15'},location:{querySelector:()=>null,add(){}}};
 let list=[],gallery=false,played=false,status='',pending=0,maxPending=0;
 const profile={id:'cell',label:'Cell',rays:[{}]};
 const video={readyState:2,videoWidth:100,videoHeight:50,currentTime:1};
 const win={addEventListener:(n,fn)=>events[n]=fn};
 const cards={list:()=>list,isGallery:()=>gallery,add:r=>{r.cardId=list.length+1;list.push(r);events['regions-changed']?.()},show:v=>{gallery=v;events['regions-changed']?.()}};
 const picker={activate:async(r,opts)=>{win.regionSelection=r;played=!!opts?.play},invalidate:()=>win.regionSelection=null};
 const scope={window:win,regionCards:cards,regionPicker:picker,localStorage:storage,$:id=>controls[id],setVisualStatus:s=>status=s,
 document:{addEventListener(n,fn){documentEvents[n]=fn},removeEventListener(n){delete documentEvents[n]},createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({})})})},
 data:{profiles:[]},oceanVideo:video,aerosolVideo:video,RegionSound:{features:()=>[{coverage:.5}],fingerprint:()=>123},Option:function(){},
 AbortController,AbortSignal,setTimeout,clearTimeout,fetch:async(url,{signal})=>{if(fail)throw Error('offline');pending++;maxPending=Math.max(maxPending,pending);return {ok:true,json:async()=>{try{if(slow)await new Promise(resolve=>setTimeout(resolve,Math.abs(Math.round(Number(new URL(url,'http://localhost').searchParams.get('lat'))))%4));if(signal.aborted)throw Error('aborted');return {profile}}finally{pending--}}}}};
 vm.createContext(scope);
 // Browser classic scripts expose window properties as globals.
 Object.defineProperty(scope,'RegionStorage',{get:()=>win.RegionStorage});
 vm.runInContext(code,scope);during?.({win,cards,events,documentEvents});await win.savedRegions.ready;
 return {win,cards,picker,events,controls,get list(){return list},get played(){return played},get status(){return status},get maxPending(){return maxPending},scope};
}
(async()=>{
 let app=await boot();assert.equal(app.list.length,0);
 const originals=[{kind:'ocean',bounds,cardId:1,included:false},{kind:'aerosols',bounds:{left:.3,right:.4,top:.4,bottom:.5},cardId:2}];
 for(const r of originals)app.cards.add(r);
 await app.picker.activate(originals[1]);app.controls.bearing.value='270';app.controls.angle.value='10';app.cards.show(true);
 const saved=JSON.parse(storage.value);assert.equal(saved.regions.length,2);assert.equal(saved.active,1);assert(!storage.value.includes('profile'));assert(!storage.value.includes('features'));
 app=await boot();assert.equal(app.list.length,2);assert.equal(app.win.regionSelection.kind,'aerosols');assert.equal(app.controls.bearing.value,270);assert.equal(app.controls.angle.value,10);assert.equal(app.played,false);
 assert.deepEqual(JSON.parse(JSON.stringify(app.list[0].bounds)),bounds);
 assert.equal(app.list[0].included,false);assert.equal(app.list[1].included,true,'Node inclusion survives reload; old selections default included');
 // Interacting during startup must not cancel restoration or persist an empty UI.
 const intact=storage.value;
 app=await boot({during:({win,cards,events,documentEvents})=>{
  assert.equal(win.savedRegions.loading,true);assert.equal(win.savedRegions.editable,false);
  documentEvents.pointerdown?.({isTrusted:true});documentEvents.keydown?.({isTrusted:true});
  events.pagehide();cards.show(false);assert.equal(storage.value,intact);
 }});
 assert.equal(app.list.length,2);assert.equal(app.win.savedRegions.editable,true);
 app.events.pagehide();assert.equal(JSON.parse(storage.value).regions.length,2);
 assert.equal(app.list[0].frame,1,'Full ocean video has no obsolete 10-second offset');
 // Delete the selected region, save, then simulate another full page load.
 app.list.pop();app.picker.invalidate();app.events['regions-changed']();app=await boot();assert.equal(app.list.length,1);assert.equal(app.win.regionSelection,null);
 const before=storage.value;app=await boot({fail:true});assert.equal(app.list.length,0);assert.equal(storage.value,before);assert.match(app.status,/Refresh to retry/);
 app.cards.show(true);app.events['atmosphere-selected']();app.events.pagehide();
 assert.equal(storage.value,before,'Failed restore stays protected after view changes and page exit');
 assert.equal(app.win.savedRegions.editable,false);
 app=await boot();assert.equal(app.list.length,1,'A later reload can recover saved regions');
 storage.value='{broken';app=await boot();assert.equal(storage.value,'{broken');assert.equal(app.list.length,0);
 storage.value=JSON.stringify({...saved,regions:[{kind:'imported',bounds}]});app=await boot();assert.equal(app.list.length,0);
 const many=Array.from({length:40},(_,i)=>({kind:i%2?'aerosols':'ocean',bounds:{left:i/100,right:i/100+.03,top:.1+i/100,bottom:.13+i/100}}));
 storage.value=JSON.stringify({...saved,regions:many,active:39});app=await boot({slow:true});
 assert.equal(app.list.length,40,'Collections beyond 12 restore completely');
 assert(app.maxPending<=4&&app.maxPending>1,'Restore bounds concurrent requests rather than region count');
 assert.deepEqual(JSON.parse(JSON.stringify(app.list.map(r=>({kind:r.kind,bounds:r.bounds})))),many,'Concurrent restore preserves mixed-dataset order and exact bounds');
 assert.equal(app.win.regionSelection.cardId,40,'Last saved region stays active');
 assert.equal(JSON.parse(storage.value).regions.length,40,'Saving does not truncate the collection');
 app=await boot({slow:true});assert.equal(app.list.length,40,'Larger collection survives another refresh');
 assert.equal(app.win.regionSelection.cardId,40);assert.equal(app.played,false);
 storage.value=JSON.stringify({...saved,regions:[],active:-1});app=await boot();assert.equal(app.list.length,0);
 console.log('Passed: startup interactions, failed-load recovery, exact bounds/order, active selection, deletion, no autoplay, invalid storage, 40-region save/reload and bounded concurrent restoration.');
})().catch(e=>{console.error(e);process.exitCode=1});
