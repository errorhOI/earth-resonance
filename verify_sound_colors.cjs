const fs=require('fs'),vm=require('vm'),assert=require('assert');
const scope={window:{}};vm.createContext(scope);
vm.runInContext(fs.readFileSync(__dirname+'/dist/region-sound.js','utf8'),scope);
vm.runInContext(fs.readFileSync(__dirname+'/dist/sound-colors.js','utf8').replace('SoundColors.attach();',''),scope);
const sound=scope.window.RegionSound,colors=scope.window.SoundColors,box={left:0,right:1,top:0,bottom:.8};
function image(left,right=left){return {width:32,height:32,data:Uint8ClampedArray.from(Array.from({length:1024},(_,i)=>[...(i%32<16?left:right),255]).flat())}}
const mixed=sound.merge(sound.features(image([0,40,255],[255,40,0]),box,'ocean'));
const shown=colors.describe({feature:mixed,kind:'ocean'});assert.equal(shown.length,2);assert.equal(shown[0].name,'Blue');assert.equal(shown[1].name,'Red');
assert.deepEqual(Array.from(shown[0].rgb),[0,40,255]);assert.deepEqual(Array.from(shown[1].rgb),[255,40,0]);assert(Math.abs(shown[0].weight-shown[1].weight)<1e-10);
for(const [rgb,name] of [[[0,100,255],'Sea salt'],[[190,50,220],'Dust'],[[255,80,30],'Smoke'],[[30,220,60],'Sulfate']]){
 const feature=sound.merge(sound.features(image(rgb),box,'aerosols')),chips=colors.describe({feature,kind:'aerosols'});assert.equal(chips.length,1);assert.equal(chips[0].name,name);assert.deepEqual(Array.from(chips[0].rgb),rgb);
}
const grey=sound.merge(sound.features(image([100,100,100]),box,'ocean'));assert.equal(colors.describe({feature:grey,kind:'ocean'}).length,0);
const faint={coverage:.5,types:[.001,0,0,0],colors:[{r:0,g:.3,b:1,weight:.5}]};assert.equal(colors.describe({feature:faint,kind:'aerosols'}).length,0);
console.log('Passed: actual sampled RGB, blended ocean colors, aerosol note categories/thresholds and neutral-pixel exclusion.');
