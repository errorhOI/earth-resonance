'use strict';
(() => {
 const key='cosmic-siblings.scan-speed.v1';
 const control=document.getElementById('scanSpeed'),output=document.getElementById('scanSpeedValue');
 const valid=n=>Number.isFinite(n)&&n>=.5&&n<=2&&Number.isInteger(n*4);
 function display(){const text=Number(control.value)+'×';output.textContent=text;control.setAttribute('aria-valuetext',text)}
 try{const raw=localStorage.getItem(key),saved=Number(raw);if(raw!==null&&valid(saved))control.value=String(saved)}catch{}
 display();
 function save(){
  display();const value=Number(control.value);if(!valid(value))return;
  try{localStorage.setItem(key,String(value))}catch{}
 }
 control.addEventListener('input',save);
 control.addEventListener('change',save);
 window.addEventListener('pagehide',save);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
})();
