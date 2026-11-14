const fs=require('fs'),vm=require('vm'),assert=require('assert');
const scope={window:{}};vm.createContext(scope);
vm.runInContext(fs.readFileSync(__dirname+'/dist/flat-map-view.js','utf8'),scope);
const View=scope.window.FlatMapView,near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const view=new View();
let m=view.rect(1000,600,2);near(m.width,900);near(m.height,450);
view.zoomAt(3,500,300,1000,600,2);
let old=view.rect(1000,600,2),x=650,y=250,u=(x-old.left)/old.width,v=(y-old.top)/old.height;
view.zoomAt(1.2,x,y,1000,600,2);m=view.rect(1000,600,2);
near(m.left+u*m.width,x);near(m.top+v*m.height,y);
// Geographic picking and overlay projection are inverses at every zoom/pan.
for(const zoom of [1,2,4,8])for(const pan of [-1,0,.25,1]){
 view.zoom=zoom;view.panX=pan;view.panY=pan;m=view.rect(1000,600,2);
 for(const [lat,lon] of [[26,-155],[0,0],[-45,100],[89,179]]){
  const px=m.left+(lon+180)/360*m.width,py=m.top+(90-lat)/180*m.height;
  near((px-m.left)/m.width*360-180,lon);near(90-(py-m.top)/m.height*180,lat);
 }
 const hi=view.rect(2000,1200,2);near(hi.left,m.left*2);near(hi.top,m.top*2);near(hi.width,m.width*2);
 assert(m.width<1000||m.left<=1e-8&&m.left+m.width>=1000-1e-8);
 assert(m.height<600||m.top<=1e-8&&m.top+m.height>=600-1e-8);
}
view.zoomAt(100,500,300,1000,600,2);assert.equal(view.zoom,8);
view.pan(1e6,-1e6,1000,600,2);m=view.rect(1000,600,2);near(m.left,0);near(m.top+m.height,600);
view.zoomAt(.00001,500,300,1000,600,2);assert.equal(view.zoom,1);near(view.panX,0);near(view.panY,0);
view.reset();assert.equal(view.zoom,1);
console.log('Passed: cursor-anchored zoom, coordinate round trips, overlay alignment at 1x–8x, high-DPI scaling, pan boundaries and reset.');
