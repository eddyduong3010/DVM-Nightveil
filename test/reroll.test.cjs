const {test}=require('node:test');
const assert=require('node:assert/strict');
const {REROLL_REGIONS,clickedReroll,RerollQueue}=require('../core/reroll.cjs');
const {adaptRegions}=require('../core/display-layout.cjs');
test('observed reroll buttons match the screenshot and stay separate from card selection on an ultrawide display',()=>{
 const game={x:0,y:0,width:2048,height:1152};
 assert.deepEqual([642,1034,1426].map(x=>clickedReroll(x,816,game)),[0,1,2]);
 assert.equal(clickedReroll(642,600,game),-1);
 const wide={x:-3440,y:200,width:3440,height:1440},regions=adaptRegions(REROLL_REGIONS,wide);
 regions.forEach((r,i)=>assert.equal(clickedReroll(wide.x+(r.x+r.w/2)*wide.width,wide.y+(r.y+r.h/2)*wide.height,wide,regions),i));
});
test('rapid rerolls debounce into one fresh request and old OCR cannot finish a newer reroll',()=>{
 const q=new RerollQueue();q.request(0,1000);q.request(2,1200);
 assert.equal(q.take(1500),null);assert.equal(q.take(1800,{busy:true}),null);
 const first=q.take(1800);assert.deepEqual(first.indices,[0,2]);
 q.request(1,1900);assert.equal(q.finish(first,['old','old','old'],2000),'stale');
 const next=q.take(2500);assert.deepEqual(next.indices,[0,2,1]);
 assert.equal(q.finish(next,['new','new','new'],3000),'complete');assert.equal(q.pending,false);
});
test('rerolls retry incomplete OCR with a limit and stop when disabled or reset',()=>{
 const q=new RerollQueue();q.request(0,1000);
 for(let i=0;i<4;i++){const at=2000+i*2000,t=q.take(at);assert.ok(t);assert.equal(q.finish(t,['id',null,'id'],at+100),i===3?'exhausted':'retry');}
 assert.equal(q.pending,false);q.request(1,10000);assert.deepEqual(q.take(35000),{expired:true});
 q.request(1,40000);assert.equal(q.take(41000,{focused:false}),null);assert.deepEqual(q.take(41000,{enabled:false}),{expired:true});
 q.request(0,50000);const t=q.take(51000);q.clear();assert.equal(q.finish(t,['a','b','c'],52000),'stale');
});
