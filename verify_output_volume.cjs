const fs=require('fs'),vm=require('vm'),assert=require('assert');
const scope={window:{}};vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/dist/sound-dsp.js','utf8'),scope);
const nodes=[],node=type=>{const n={type,gain:{value:1},connect(to){this.to=to;return to}};nodes.push(n);return n};
const graph=scope.window.SoundDSP.outputGraph({createGain:()=>node('gain'),createWaveShaper:()=>node('shaper')});
assert.equal(graph.input.to.to,graph.monitor,'All sound flows through the peak protection');
assert.equal(graph.monitor.oversample,'none','No oversampling delay added to atmosphere timing');
function sample(x,volume){const curve=graph.monitor.curve,z=Math.max(-1,Math.min(1,x*volume*graph.input.to.gain.value)),at=(z+1)/2*(curve.length-1),i=Math.floor(at),f=at-i;return curve[i]*(1-f)+curve[Math.min(curve.length-1,i+1)]*f}
assert.equal(sample(0,2),0);assert.equal(sample(.3,0),0);
for(const x of [-.3,-.05,.05,.3])assert(Math.abs(sample(x,2)-2*sample(x,1))<1e-6,'200% doubles ordinary sample amplitude');
let prev=-1;for(let x=-16;x<=16;x+=.002){const v=sample(x,2);assert(Number.isFinite(v)&&Math.abs(v)<.981,'Overlapping loud signals stay below full scale');assert(v>=prev-1e-7);prev=v}
for(const n of ['sound-lab.js','node-melody-audio.js','live-region-audio.js'])assert(!fs.readFileSync(__dirname+'/dist/'+n,'utf8').includes('createDynamicsCompressor()'),'Output change adds no lookahead to note scheduling');
console.log('PASS: 200% is +6.02 dB for ordinary samples, silence stays silent, overlapping peaks bounded, no added lookahead');
