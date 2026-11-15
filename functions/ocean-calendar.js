'use strict';
window.OceanCalendar={
 start:Date.parse('2007-03-25T12:00:00Z'),
 end:Date.parse('2008-03-03T12:00:00Z'),
 formatter:new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}),
 label(seconds,duration){
  if(!Number.isFinite(seconds)||!Number.isFinite(duration)||duration<=0)return '';
  const fraction=Math.max(0,Math.min(1,seconds/duration));
  return '~ '+this.formatter.format(new Date(this.start+(this.end-this.start)*fraction));
 }
};
