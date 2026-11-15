const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const controls=new Map(),$=id=>{if(!controls.has(id))controls.set(id,{value:'',checked:false,dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},querySelectorAll:()=>[]});return controls.get(id)};
 $('voice').value='bells';$('volume').value='70';$('scanSpeed').value='.75';$('location').value='cell';$('followVideo').checked=true;$('echo').checked=true;
 const stored=new Map([['cosmic-siblings.echo','false'],['cosmic-siblings.volume','200']]),created=[],gains=[];
 const ray={status:'returned',travel_seconds:500,path_seconds:[0,500],bearing_deg:90,angle_deg:15};
 const region={kind:'ocean',cardId:1,profile:{id:'cell',rays:[ray]}};
 class Capture{constructor(o){Object.assign(this,o);created.push(this)}async start(){}stop(){this.stopped=true}playback(){return {}}}
 const scope={localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},window:{regionSelection:region,dispatchEvent(){}},document:{getElementById:$,querySelectorAll:()=>[]},SoundDSP:{defaults:{}},currentRay:ray,
  AudioHistory:{connect:async()=>{},begin(){}},AudioContext:class{createGain(){const node={gain:{value:1,setTargetAtTime(v){this.value=v}},connect(){return this}};gains.push(node);return node}createWaveShaper(){return {connect(){return this}}}createAnalyser(){return {connect(){}}}async resume(){}},
  LiveRegionAudio:Capture,LiveRegionGroup:Capture,NodeMelodyAudio:Capture,oceanVideo:{},aerosolVideo:{},currentVideo:{},playing:false,globe:null,analyser:null,clearTimeout,setTimeout,Event};
 vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/dist/sound-dsp.js','utf8'),scope);scope.SoundDSP=scope.window.SoundDSP;vm.runInContext(fs.readFileSync(__dirname+'/dist/sound-lab.js','utf8'),scope);
 const controller=scope.window.soundLabController;
 assert.equal($('echo').checked,false,'Saved echo setting is restored');
 assert.equal($('volume').value,200,'Saved 200% volume is restored');
 for(const enabled of [false,true]){
  $('echo').checked=enabled;
  await $('play').onclick();assert.equal(created.at(-1).config().delay_seconds,enabled?.5:0);controller.stop();
  await controller.playTogether([region],()=>{});assert.equal(created.at(-1).config(region).delay_seconds,enabled?.5:0);controller.stop();
  await controller.playMelody([{region,midi:69,beats:1}],48,()=>{});assert.equal(created.at(-1).config(region).delay_seconds,enabled?.5:0);assert.equal(gains[0].gain.value,2,'200% applies to melody as well as scans');controller.stop();
 }
 ray.status='profile_limit';await controller.playTogether([region],()=>{});assert.equal(created.at(-1).config(region).delay_seconds,0,'Echo cannot invent a return');controller.stop();ray.status='returned';
 let restarted=null;scope.window.musicSequence={running:true,index:0,order:[region],start:id=>restarted=id};
 $('echo').checked=false;$('echo').onchange();assert.equal(restarted,1,'Keep sequence context when changing Echo');assert.equal(stored.get('cosmic-siblings.echo'),'false');
 assert.equal($('scanSpeed').value,'.75','Echo never changes scan speed');
 $('volume').value='150';$('volume').oninput();assert.equal(stored.get('cosmic-siblings.volume'),'150');assert.equal(gains[0].gain.value,1.5);assert.equal(stored.get('cosmic-siblings.echo'),'false');
 delete scope.window.musicSequence;await $('play').onclick();const previous=created.at(-1);$('echo').checked=true;$('echo').onchange();await new Promise(r=>setImmediate(r));
 assert(previous.stopped,'Clear already rendered delayed copies on toggle');assert.equal(created.at(-1).config().delay_seconds,.5);
 controller.stop();
 // Exercise the REAL node activation and atmosphere update paths. Previously
 // these overwrote the user's checkbox after Play, before taking the snapshot.
 const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
 const ids=[...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.filter(id=>id==='echo').length,1,'Exactly one Echo control');
 Object.assign(region,{bounds:{left:.1,right:.2,top:.2,bottom:.3},features:[],latitude:39,longitude:-53});
 Object.assign(region.profile,{latitude:38,longitude:-55,height_m:[0,59000],temperature_k:[290,250],u_ms:[0,0],v_ms:[0,0]});
 Object.assign(ray,{landing_range_km:150,turning_height_km:35,source_height_km:.065});
 Object.assign(scope,{$,data:{profiles:[region.profile]},setVisualStatus(){},view(){},chart(){},chooseDataset(){},AtmosphereGeo:{coordinate:()=>'',destination:()=>[0,0]},RegionSound:{fingerprint:()=>''},AbortController});
 scope.globe={map:{select(){}},regionBox:null};$('dataset').value='ocean';$('bearing').value='90';$('angle').value='15';
 vm.runInContext(read('app.js').split('function update(){')[1].split("for(const p of data.profiles)$('location')")[0].replace(/^/, 'function update(){'),scope);
 vm.runInContext(read('region-picker.js'),scope);
 vm.runInContext(read('music-nodes.js').split('(() => {')[0],scope);
 for(const enabled of [false,true])for(const status of ['returned','profile_limit']){
  ray.status=status;$('echo').checked=enabled;
  const sequence=new scope.window.MusicNodeSequence({regions:()=>[region],activate:r=>scope.window.regionPicker.activate(r),together:()=>true,
   play:()=>controller.playMelody([{region,midi:69,beats:1}],48,()=>{}),stopAudio:()=>controller.stop(),loop:()=>false,update(){}});
  await sequence.start();assert.equal($('echo').checked,enabled,'Starting a node must preserve Echo preference for any ray status');
  assert.equal(created.at(-1).config(region).delay_seconds,enabled&&status==='returned'?.5:0);
  sequence.stop();
 }
 let melodyStarts=0;scope.window.MelodyEditor={active:true};scope.window.musicSequence={start(){melodyStarts++}};
 $('play').onclick();$('labPlay').onclick();assert.equal(melodyStarts,2,'Listen and Sound Lab play the selected melody template');
 scope.window.MelodyEditor.active=false;await $('play').onclick();assert.equal(melodyStarts,3,'No melody still routes through the shared playback mode');controller.stop();
 scope.window.regionCards={isGallery:()=>true};
 for(const mode of ['single','order','together']){
  $('nodeMode').value=mode;const before=melodyStarts;
  $('play').onclick();$('labPlay').onclick();assert.equal(melodyStarts,before+2,`Listen and Sound Lab use the selected ${mode} sequence in region view`);
 }
 scope.window.regionCards.isGallery=()=>false;const before=melodyStarts;
 await $('play').onclick();assert.equal(melodyStarts,before+1,'Map and region view use the same playback mode');controller.stop();
 console.log('PASS: saved echo setting, single/group/melody routing, no invented returns, sequence-preserving restart, stale audio cleared, template Listen routing and scan speed unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
