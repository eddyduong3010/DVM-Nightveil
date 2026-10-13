const {test}=require('node:test');
const assert=require('node:assert/strict');
const l=require('../core/display-layout.cjs');
const {badgeLayout}=require('../core/badge-layout.cjs');
const {clickedCard}=require('../core/card-choice.cjs');
const presets=require('../data/display-presets.json');
const regions=[{x:.18,y:.26,w:.2,h:.44},{x:.4,y:.26,w:.2,h:.44},{x:.62,y:.26,w:.2,h:.44}];
test('all laptop/gaming presets keep the main window and overlays on the chosen display at 100/125/150/200 percent',()=>{
 for(const p of presets.screens)for(const dpi of [1,1.25,1.5,2]){
  const size=l.resolution(p.id),area={x:-2500,y:120,width:Math.round(size.width/dpi),height:Math.round(size.height/dpi)-40};
  const display={workArea:area,scaleFactor:dpi};
  for(const side of ['left','right']){
   const {bounds:b,zoom}=l.overlayLayout(area,l.DEFAULT_DISPLAY,side);
   assert.ok(b.x>=area.x&&b.y>=area.y);assert.ok(b.x+b.width<=area.x+area.width);assert.ok(b.y+b.height<=area.y+area.height);assert.ok(zoom>0);
  }
  const b=l.mainLayout(display,l.DEFAULT_DISPLAY);
  assert.ok(b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height);
 }
});
test('detected game size overrides presets and capture keeps ultrawide aspect ratio',()=>{
 const config=l.sanitizeDisplay({screenResolution:'1920x1080',gameResolution:'2560x1440'});
 const actual={width:3440,height:1440};
 assert.deepEqual(l.gameSize(config,{},actual),actual);
 const cap=l.captureSize(actual);assert.equal(cap.width,2560);assert.ok(Math.abs(cap.width/cap.height-3440/1440)<.002);
});
test('windowed captures exclude the title bar but client-only captures are not cropped twice',()=>{
 const client={x:100,y:140,width:1280,height:720},outer={x:100,y:100,width:1280,height:760};
 assert.deepEqual(l.clientCrop({width:1280,height:760},client,outer),{x:0,y:40,width:1280,height:720});
 assert.equal(l.clientCrop({width:1280,height:720},client,outer),null);
});
test('card regions, click detection and badge centers agree on a 150-percent-scaled ultrawide display',()=>{
 const physical={x:3840,y:0,width:3440,height:1440};const dpi=1.5;
 const dip={x:2560,y:0,width:Math.round(3440/dpi),height:960};
 const rois=l.adaptRegions(regions,physical);
 const layout=badgeLayout(dip,rois);
 for(let i=0;i<3;i++){
  const center={x:physical.x+(rois[i].x+rois[i].w/2)*physical.width,y:physical.y+(rois[i].y+rois[i].h/2)*physical.height};
  assert.equal(clickedCard(center.x,center.y,physical,rois,['a','b','c']).index,i);
  assert.ok(Math.abs((layout.bounds.x+layout.centers[i])*dpi-center.x)<2);
 }
 assert.deepEqual(l.adaptRegions(regions,physical,true),regions);
});
test('invalid saved display configuration falls back safely and client size limits the main layout',()=>{
 assert.deepEqual(l.sanitizeDisplay(null),l.DEFAULT_DISPLAY);
 assert.deepEqual(l.sanitizeDisplay({monitorId:'file:',overlayScale:-1,gameMode:'anything',gameResolution:'99999x0'}),l.DEFAULT_DISPLAY);
 const d={scaleFactor:1,workArea:{x:0,y:0,width:1920,height:1040}};
 const small=l.mainLayout(d,l.sanitizeDisplay({clientResolution:'1280x720'}));
 assert.equal(small.width,1280);assert.equal(small.height,720);
});
