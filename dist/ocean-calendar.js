'use strict';
// NASA SVS 3912's published model-time extent. The mirrored movie has 2,059
// frames, while NASA's date table has 2,001 entries: use normalized progress,
// explicitly approximate, rather than claim an exact frame/date registration.
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
