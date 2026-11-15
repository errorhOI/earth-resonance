'use strict';
(() => {
 const panel=document.querySelector('.visual-panel');
 panel.append($('regionDialog'),$('soundLab'),$('details'),$('credits'));
 $('followVideo').defaultChecked=true;$('followVideo').checked=true;
})();
