const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
(async()=>{
 const controls=new Map(),$=id=>{if(!controls.has(id))controls.set(id,{value:'',checked:false,dataset:{},classList:{toggle(){}},setAttribute(){}});return controls.get(id)};
 $('voice').value='bells';$('volume').value='70';$('scanSpeed').value='.75';$('location').value='cell';$('followVideo').checked=true;
 let storedLoop='false';$('loop').checked=true;
 const created=[],scope={localStorage:{getItem:()=>storedLoop,setItem:(key,value)=>storedLoop=value},window:{regionSelection:{kind:'ocean',cardId:1,profile:{id:'cell'}},dispatchEvent(){}},
  document:{getElementById:$,querySelectorAll:()=>[]},SoundDSP:{defaults:{}},currentRay:{status:'returned',travel_seconds:500,path_seconds:[0,500],bearing_deg:90,angle_deg:15},
  AudioHistory:{connect:async()=>{},begin(){}},AudioContext:class{createGain(){return {gain:{value:1},connect(){return this}}}createAnalyser(){return {connect(){}}}async resume(){}},
  LiveRegionAudio:class{constructor(o){Object.assign(this,o);created.push(this)}async start(){}stop(){this.stopped=true}setLoop(v){this.loop=v}playback(){return {}}},
  currentVideo:{},playing:false,globe:null,analyser:null,clearTimeout,setTimeout,Event};
 vm.createContext(scope);vm.runInContext(read('sound-lab.js'),scope);
 assert.equal($('loop').checked,false,'Saved Loop off overrides the HTML default');
 await $('play').onclick();assert.equal(created.at(-1).maxSteps,16,'Unchecked Listen is one scan');assert(scope.playing);
 created.at(-1).onComplete();assert(!scope.playing,'Single scan stops after completion');assert(created.at(-1).stopped);
 $('loop').checked=true;await $('play').onclick();assert.equal(created.at(-1).maxSteps,Infinity);
 $('loop').checked=false;$('loop').onchange();assert.equal(created.at(-1).loop,false,'Live toggle reaches scanner');assert.equal(storedLoop,'false');
 $('loop').checked=true;let completed=0;await scope.window.soundLabController.playScan(()=>completed++);
 assert.equal(created.at(-1).maxSteps,16,'Node remains a finite scan despite Listen loop setting');created.at(-1).onComplete();assert.equal(completed,1);
 scope.window.musicSequence={running:true};created.at(-1).loop='unchanged';$('loop').onchange();
 assert.equal(created.at(-1).loop,'unchanged','Sequence Loop must not make a single node scan infinite');delete scope.window.musicSequence;
 scope.window.soundLabController.stop();created.at(-1).onComplete();assert.equal(completed,1,'Stale completion ignored');
 // The real scanner must finish the current cycle without restarting or
 // shortening existing atmospheric arrival timestamps.
 const scanScope={window:{}};vm.createContext(scanScope);vm.runInContext(read('live-region-audio.js'),scanScope);
 const scanner=Object.create(scanScope.window.LiveRegionAudio.prototype);Object.assign(scanner,{emitted:21,scanStep:5,columnCount:16,finishAt:12,pulses:[{start:3,travel:2}]});
 scanner.setLoop(false);assert.equal(scanner.maxSteps,32);assert.equal(scanner.finishAt,12);assert.equal(scanner.pulses[0].start,3);
 scanner.setLoop(true);assert.equal(scanner.maxSteps,Infinity);
 scanner.emitted=32;scanner.scanStep=0;scanner.setLoop(false);assert.equal(scanner.maxSteps,32,'At scan boundary, do not add another cycle');
 scanner.emitted=0;scanner.setLoop(false);assert.equal(scanner.maxSteps,16);
 console.log('PASS: Listen respects Loop off/on, live toggle finishes current scan, finite node playback, stopped callbacks and in-flight timing preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
