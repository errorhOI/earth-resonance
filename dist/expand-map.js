'use strict';
// Keep dialogs in the visual panel; map navigation now uses wheel zoom.
(() => {
 const panel=document.querySelector('.visual-panel');
 panel.append($('regionDialog'),$('soundLab'),$('details'),$('credits'));
 $('followVideo').defaultChecked=true;$('followVideo').checked=true;
})();
