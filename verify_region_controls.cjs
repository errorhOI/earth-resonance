const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/dist/index.html','utf8');
// Missing DOM elements must return null, as they do in the browser.
const controls=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{hidden:false,disabled:false,value:'aerosols',dataset:{},addEventListener(){},querySelectorAll(){return []}}]));
const $=id=>controls.get(id)||null;
const win={soundLabController:{stop(){},regionChanged(){}},regionCards:{highlight(){}}};
const scope={window:win,$,currentVideo:{},globe:{map:{}},view(){},setVisualStatus(){},update(){},chooseDataset(){},AtmosphereGeo:{coordinate:()=>''},RegionSound:{fingerprint:()=>''}};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(__dirname+'/dist/region-picker.js','utf8'),scope);
assert.equal($('saveMix'),null);
assert.equal($('play').disabled,true);
(async()=>{
 const region={kind:'aerosols',key:'saved',bounds:{},profile:{id:'cell'},features:[],latitude:38,longitude:-40};
 await win.regionPicker.activate(region);
 assert.equal(win.regionSelection,region);
 assert.equal($('play').disabled,false);
 assert.equal($('labPlay').disabled,false);
 win.regionPicker.invalidate();
 assert.equal($('play').disabled,true);
 console.log('PASS: actual HTML controls support startup, saved region activation and invalidation without removed save controls');
})().catch(e=>{console.error(e);process.exitCode=1});
