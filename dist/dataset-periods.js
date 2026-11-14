'use strict';
// Represented data periods, not the pages' publication or update dates.
// Sources: assets/provenance.json and the linked NASA SVS descriptions.
window.DatasetPeriods={
 ocean:'25 Mar 2007 – 3 Mar 2008',
 aerosols:'1 Aug – 14 Sep 2024',
 label(kind){return this[kind]&&typeof this[kind]==='string'?this[kind]:'Date not provided'},
 show(kind){const el=document.getElementById('datasetPeriod');if(el)el.textContent='Data · '+this.label(kind)}
};
