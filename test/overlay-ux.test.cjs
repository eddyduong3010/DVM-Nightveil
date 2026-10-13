const {test}=require('node:test'),assert=require('node:assert/strict');
const o=require('../core/overlay-layout.cjs'),presets=require('../data/display-presets.json');
test('overlay avoids reserved top/bottom HUD at all supported resolutions, DPI levels and negative monitor origins',()=>{
 for(const preset of presets.screens)for(const dpi of [1,1.25,1.5,2])for(const mode of o.MODES)for(const side of ['left','right'])for(const hasOffers of [false,true]){
  const [pw,ph]=preset.id.split('x').map(Number),area={x:-3000,y:120,width:Math.round(pw/dpi),height:Math.round(ph/dpi)};
  const result=o.layout(area,{overlayScale:'auto'},{overlayMode:mode,side,hasOffers}),b=result.bounds,c=result.controls;
  assert.ok(b.x>=area.x&&b.x+b.width<=area.x+area.width,JSON.stringify(result));
  assert.ok(c.y>=area.y+result.safe.top);assert.ok(b.y+b.height<=area.y+area.height-result.safe.bottom+1);
  assert.ok(result.zoom>=.85);assert.equal(c.y+c.height,b.y);assert.ok(c.height>=24);
 }
});
test('expanded falls back to readable compact/mini rather than shrinking text on a short screen',()=>{
 assert.equal(o.layout({x:0,y:0,width:1920,height:1080},{},{overlayMode:'expanded'}).mode,'expanded');
 assert.equal(o.layout({x:0,y:0,width:1366,height:768},{},{overlayMode:'expanded'}).mode,'compact');
 assert.equal(o.layout({x:0,y:0,width:960,height:540},{},{overlayMode:'expanded'}).mode,'mini');
});
test('manual zoom and vertical offsets remain within safe bounds even at 200 percent DPI',()=>{
 for(const h of [360,540,720,1080])for(const zoom of [.65,.85,1,1.5])for(const position of [0,.5,1]){
  const r=o.layout({x:30,y:40,width:640,height:h},{overlayScale:zoom},{overlayMode:'expanded',overlayVertical:position});
  assert.ok(r.bounds.y+r.bounds.height<=40+h-r.safe.bottom+1);
 }
});
test('Tab and choice auto-hide preserve manual visibility and return to the configured state',()=>{
 const game={hasGame:true,focused:true};assert.equal(o.visibility(game).panel,true);
 assert.equal(o.visibility({focused:true,hasGame:false}).panel,true);
 assert.deepEqual(o.visibility({...game,tabHeld:true}),{panel:false,badges:false,controls:false});
 assert.equal(o.visibility({...game,enabled:false,tabHeld:false}).panel,false);
 assert.deepEqual(o.visibility({...game,choices:true}),{panel:false,badges:true,controls:true});
 assert.equal(o.visibility({...game,choices:true,autoChoices:false}).panel,true);
 assert.equal(o.visibility({...game,tabHeld:true,autoTab:false}).panel,true);
 assert.deepEqual(o.visibility({...game,focused:false}),{panel:false,badges:false,controls:false});
});
test('mode cycling and persisted settings reject malformed values',()=>{
 assert.equal(o.nextMode('mini'),'compact');assert.equal(o.nextMode('expanded'),'mini');
 const p=o.sanitizeOverlay({overlayMode:'giant',overlayVertical:99,overlayInset:-9,overlayClickThrough:false});
 assert.equal(p.overlayMode,'compact');assert.equal(p.overlayVertical,1);assert.equal(p.overlayInset,8);assert.equal(p.overlayClickThrough,false);
});
