'use strict';
window.SoundColors=(()=>{
 const names={ocean:['Blue','Green','Yellow','Orange','Red'],aerosols:['Sea salt','Dust','Smoke','Sulfate']};
 function describe(sample){
  const f=sample.feature;if(f.coverage<.015)return [];
  return (f.colors||[]).map((c,i)=>({...c,index:i,name:names[sample.kind]?.[i]||'Color'}))
   .filter(c=>c.weight>.0001&&(sample.kind!=='aerosols'||f.types[c.index]*.35>.008))
   .map(c=>({...c,rgb:[c.r,c.g,c.b].map(n=>Math.round(n*255))}));
 }
 function attach(){
  const row=document.createElement('div');row.id='soundColors';row.className='sound-colors';row.hidden=true;
  row.title='Colors sampled at the scan line. Distinct ocean color ranges and aerosol categories contribute separate notes. Mixed and delayed notes may overlap.';
  const label=document.createElement('span');label.textContent='Sound colors';const chips=document.createElement('div');chips.className='sound-color-chips';row.append(label,chips);$('audioWave').before(row);
  let previous=null;
  function frame(){
   if(!document.hidden){
    const playback=window.soundLabController?.playback?.(),sample=playback?.colorSample,samples=playback?.group?playback.colorSamples:(sample?[sample]:[]),key=samples.map(s=>s.cardId+':'+s.start).join('|');
    row.hidden=!playback?.active||!samples.length||(!playback.group&&sample.cardId!==window.regionSelection?.cardId);
    if(!row.hidden&&key!==previous){
     previous=key;const colors=samples.flatMap(s=>describe(s).map(c=>({...c,cardId:s.cardId}))),sum=colors.reduce((s,c)=>s+c.weight,0);
     label.textContent=colors.length?(playback.melody?'Tone colors':'Sound colors'):'No color signal';chips.replaceChildren();
     row.title=playback.melody?'Region colors shape tone and loudness. Note pitch follows the composed melody.':'Colors sampled at the scan line contribute distinct notes.';
     for(const color of colors){const chip=document.createElement('span');chip.className='sound-color';chip.style.backgroundColor=`rgb(${color.rgb.join(',')})`;chip.style.flexGrow=color.weight/sum;
      const description=`Region ${color.cardId} · ${color.name} · ${Math.round(color.weight/sum*100)}% of displayed color samples`;
      chip.title=description;chip.setAttribute('role','img');chip.setAttribute('aria-label',description);chips.append(chip);
     }
    }
   }
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 }
 return {describe,attach};
})();
SoundColors.attach();
