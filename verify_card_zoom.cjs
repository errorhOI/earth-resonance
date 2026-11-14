const fs=require('fs'),vm=require('vm'),assert=require('assert');
const scope={window:{}};vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/dist/region-card-view.js','utf8'),scope);
const View=scope.window.RegionCardView,a=new View(),b=new View(),near=(a,b)=>assert(Math.abs(a-b)<1e-8);
a.zoomAt(2,.5,.5);a.zoomAt(1.2,.6,.4);
// The same scene point remains under the cursor when zooming around it.
near(a.point(550,270,1000,600)[0],600);near(a.point(550,270,1000,600)[1],240);
assert.equal(b.zoom,1);near(b.x,0);near(b.y,0);
a.zoomAt(100,.5,.5);assert.equal(a.zoom,4);a.pan(100,-100);near(a.x,1.5);near(a.y,-1.5);
a.zoomAt(.0001,.1,.8);assert.equal(a.zoom,1);near(a.x,0);near(a.y,0);
const events={},canvas={addEventListener:(k,fn)=>events[k]=fn,focus(){},getBoundingClientRect:()=>({left:20,top:30,width:500,height:300}),classList:{add(){},remove(){}},setPointerCapture(){}};
a.bind(canvas);let prevented=false;
events.wheel({deltaY:-200,deltaMode:0,clientX:270,clientY:180,preventDefault(){prevented=true}});assert(prevented);assert(a.zoom>1);
const zoom=a.zoom;events.wheel({ctrlKey:true});assert.equal(a.zoom,zoom);
events.pointerdown({button:0,pointerId:1,clientX:270,clientY:180,preventDefault(){}});
events.pointermove({pointerId:1,clientX:290,clientY:190});assert(a.x>0);events.pointercancel();
events.keydown({key:'Home',preventDefault(){}});assert.equal(a.zoom,1);near(a.x,0);near(a.y,0);
// Camera composition matches point projection at high DPI.
a.zoomAt(2,.5,.5);a.pan(.1,.1);const ops=[];
a.apply({translate:(...args)=>ops.push(['translate',...args]),scale:(...args)=>ops.push(['scale',...args])},500,300);
let [x,y]=[100,120];const last=ops[2],scale=ops[1],first=ops[0];x=(x+last[1])*scale[1]+first[1];y=(y+last[2])*scale[2]+first[2];
const projected=a.point(100,120,500,300);near(x,projected[0]);near(y,projected[1]);
console.log('Passed: independent card cameras, cursor anchor, limits, pan, reset, wheel input, browser-zoom passthrough and shared scene projection.');
