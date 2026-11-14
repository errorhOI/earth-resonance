const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=n=>fs.readFileSync(__dirname+'/dist/'+n,'utf8');
const scope={window:{}};vm.createContext(scope);vm.runInContext(read('music-nodes.js').split('(() => {')[0],scope);
const Sequence=scope.window.MusicNodeSequence,settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const regions=[{cardId:1,kind:'ocean'},{cardId:2,kind:'aerosols'},{cardId:3,kind:'ocean'}];
 let order=[],done,loops=false,stops=0;
 const seq=new Sequence({regions:()=>regions,activate:async r=>order.push(r.cardId),play:async cb=>{done=cb;return true},stopAudio:()=>stops++,loop:()=>loops,update(){}});
 await seq.start();assert.deepEqual(order,[1]);assert(seq.running);
 const first=done;first();await settle();assert.deepEqual(order,[1,2]);first();await settle();assert.deepEqual(order,[1,2],'Ignore duplicate completion');
 done();await settle();assert.deepEqual(order,[1,2,3]);done();await settle();assert(!seq.running,'One pass stops at final node');
 loops=true;order=[];await seq.start(3);done();await settle();assert.deepEqual(order,[3,1],'Loop wraps to first node');
 const stale=done;seq.stop();stale();await settle();assert.deepEqual(order,[3,1],'Stop invalidates pending completion');
 order=[];let release,played=0;seq.activate=r=>new Promise(resolve=>{order.push(r.cardId);release=resolve});seq.play=async()=>{played++;return true};
 const pending=seq.start();seq.stop();release();await pending;assert.equal(played,0,'Stop during activation cannot start audio later');
 seq.activate=async()=>{};seq.play=async()=>false;await seq.start();assert(!seq.running,'Failed playback stops the chain');
 regions.length=0;await seq.start();assert(!seq.running);

 // Real live scanner: exactly 16 columns, wait for output-clock tail, preserve
 // pending arrivals across a source-video loop and never emit a seventeenth note.
 let featureId=0,raf,completed=0,outputTime=0,starts=[],sampled=[];
 const gain=()=>({gain:{setTargetAtTime(){}},connect(){return this},disconnect(){}});
 const ctx={currentTime:0,createGain:gain,createWaveShaper:gain,createBufferSource:()=>({connect:gain,start:t=>starts.push(t),stop(){},disconnect(){}})};
 const video={paused:false,seeking:false,readyState:2,currentTime:0,videoWidth:16,videoHeight:1,play:async()=>{},pause(){this.paused=true},addEventListener(){},removeEventListener(){}};
 const liveScope={window:{},document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData(){return {}}})})},
 requestAnimationFrame:fn=>{raf=fn;return 1},cancelAnimationFrame(){},setTimeout:fn=>fn(),
 SoundTiming:{now:()=>outputTime},RegionSound:{features:()=>Array.from({length:16},(_,i)=>({column:i,frame:featureId,coverage:1})),synth:columns=>{sampled.push(columns[0]);return {duration:.8}},onsets:()=>[0],fingerprint:()=>''},
 SoundDSP:{render:async()=>({duration:2.3}),level:()=>1}};
 vm.createContext(liveScope);vm.runInContext(read('live-region-audio.js'),liveScope);
 let seen=[];const config={scan_speed:1,mode:'processed',delay_seconds:1.5,travel_seconds:1.5};
 const live=new liveScope.window.LiveRegionAudio({ctx,output:{},region:{cardId:1,kind:'ocean',bounds:{}},video,config:()=>config,maxSteps:16,onSample:s=>seen.push(s),onComplete:()=>completed++});
 await live.start();await settle();
 for(let i=1;i<16;i++){
  ctx.currentTime=i*.3;outputTime=ctx.currentTime;video.currentTime=i===8?0:i*.3;
  if(i===8){live.seek();assert(live.pulses.length>0,'Video wrap preserves delayed pulses')}
  featureId=i;raf();await settle();
 }
 assert.equal(starts.length,16);assert.equal(seen.length,16);
 assert.deepEqual(sampled.map(s=>s.column),Array.from({length:16},(_,i)=>i),'Each spatial column drives its own note');
 assert.deepEqual(sampled.map(s=>s.frame),Array.from({length:16},(_,i)=>i),'Each note samples the current video frame');
 assert.equal(live.emitted,16);assert.equal(live.scanStep,0);
 const expected=starts.at(-1)+2.3;assert(Math.abs(live.finishAt-expected)<1e-9,'Wait through the rendered delay and audio tail');
 ctx.currentTime=expected+1;outputTime=expected-.001;raf();assert.equal(completed,0,'Rendering ahead must not advance before audible completion');
 outputTime=expected+.001;raf();assert.equal(completed,1);raf();assert.equal(completed,1,'Complete exactly once');
 await live.emit(20);assert.equal(starts.length,16);
 assert(live.playback().draining);live.stop();
 console.log('PASS: ordered mixed-source nodes, start from node, loop, stop/races, failure handling, 16-column scan, source wrap, output-clock tails and single completion');
})().catch(error=>{console.error(error);process.exitCode=1});
