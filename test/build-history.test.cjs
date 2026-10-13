const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const h=require('../core/build-history.cjs');
const {HistoryStore}=require('../desktop/history-store.cjs');
const data=require('../data/catalog.json');
const e=require('../core/engine.cjs');
const {demo}=require('../core/demo.cjs');
const fixture=()=>{const s=demo(data);s.gameData.gameMode='KIWI';return s;};
test('history records strong players once per match and does not invent augments or wins',()=>{
 const history=h.newHistory(),s=fixture();h.observeHistory(history,s,data,{game:'one'});
 assert.ok(history.records.some(r=>r.champion==='Vladimir'));
 assert.equal(history.records.some(r=>r.champion==='Leona'),false);
 const count=history.records.length;h.observeHistory(history,s,data,{game:'one'});assert.equal(history.records.length,count);
 assert.ok(history.records.every(r=>r.augmentSource==='unknown'&&r.augments.length===0&&r.outcome==='unknown'));
 assert.equal(JSON.stringify(history).includes('#DEMO'),false);
 assert.ok(history.records.every(r=>r.timeline.length===1));
 const v=s.allPlayers.find(p=>p.championName==='Vladimir');v.items.push({itemID:3135,slot:3,count:1});s.gameData.gameTime+=15;
 h.observeHistory(history,s,data,{game:'one'});assert.equal(history.records.find(r=>r.champion==='Vladimir').timeline.length,2);
});
test('recording rejects demo, wrong mode, early game, unknown self and weak inventories',()=>{
 const history=h.newHistory(),s=fixture();
 assert.equal(h.observeHistory(history,s,data,{game:'demo',mode:'demo'}),false);
 assert.equal(h.observeHistory(history,{...s,gameData:{...s.gameData,gameMode:'ARAM'}},data,{game:'one'}),false);
 assert.equal(h.observeHistory(history,{...s,gameData:{...s.gameData,gameTime:120}},data,{game:'one'}),false);
 assert.equal(h.observeHistory(history,{...s,activePlayer:{}},data,{game:'one'}),false);
 s.allPlayers.forEach(p=>p.items=[{itemID:1001}]);assert.equal(h.observeHistory(history,s,data,{game:'one'}),false);
});
test('confirmed augments survive restart but an explicit correction removes them',()=>{
 const history=h.newHistory(),s=fixture(),key=e.playerKey(s.allPlayers.find(p=>p.championName==='Vladimir'));
 h.observeHistory(history,s,data,{game:'one',knownAugments:{[key]:{ids:['ARAM_WitchfulThinking']}}});
 const restored=h.loadHistory(JSON.parse(JSON.stringify(history)));h.observeHistory(restored,s,data,{game:'one'});
 assert.deepEqual(restored.records.find(r=>r.champion==='Vladimir').augments,['ARAM_WitchfulThinking']);
 h.observeHistory(restored,s,data,{game:'one',knownAugments:{[key]:{ids:[]}}});
 assert.deepEqual(restored.records.find(r=>r.champion==='Vladimir').augments,[]);
});
test('history advice needs three independent past games of the same champion role and patch',()=>{
 const history=h.newHistory(),s=fixture();
 h.observeHistory(history,s,data,{game:'one'});const single=h.historyAdvice(history,data,'Jinx','adc');assert.equal(single.sampleCount,1);assert.ok(single.items.every(i=>i.bonus===0));
 for(const game of ['two','three'])h.observeHistory(history,s,data,{game});
 const a=h.historyAdvice(history,data,'Jinx','adc');assert.equal(a.sampleCount,3);assert.ok(a.items.some(i=>i.bonus>0));
 assert.equal(h.historyAdvice(history,data,'Jinx','adc',{game:'three'}).sampleCount,2);
 assert.equal(h.historyAdvice(history,data,'Jinx','mage').sampleCount,0);
 assert.equal(h.historyAdvice(history,{...data,patch:'0.0'},'Jinx','adc').sampleCount,0);
 const record=history.records.find(r=>r.champion==='Jinx');history.records.push({...record,id:'duplicate-person'});assert.equal(h.historyAdvice(history,data,'Jinx','adc').sampleCount,3);
 const suggestions={...a,items:[...a.items,{id:'not-an-item',bonus:999,count:3,games:3}]};
 const build=e.buildAdvice(s,data,'Jinx',[],'auto',{},null,{targetItem:'3072',historyAdvice:suggestions});assert.equal(build.next.id,'3072');assert.equal(build.next.score,1000);
});
test('atomic history storage survives queued saves and malformed input is rejected',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mayhem-history-test-'));
 const store=new HistoryStore(dir),reader=new HistoryStore(dir);
 try{
  const history=h.newHistory();h.observeHistory(history,fixture(),data,{game:'one'});
  const first=store.save(history);history.records=history.records.slice(0,1);const last=store.save(history);await Promise.all([first,last]);
  const loaded=await reader.load();assert.equal(loaded.records.length,1);
  assert.equal(h.loadHistory({schema:1,records:[{id:'broken'}]}).records.length,0);
  await store.save(h.newHistory());assert.equal((await store.load()).records.length,0);
 }finally{await store.close();await reader.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('mayhem-history-test-'));await fs.rm(dir,{recursive:true,force:true});}
});
test('a historical item bonus does not displace a currently prioritized wound component',()=>{
 const s=fixture();s.allPlayers[0].items=[{itemID:1053,count:1,slot:0}];
 const reference={champion:'Jinx',patch:data.patch,builds:[['3072','3031','3085']]};
 const before=e.buildAdvice(s,data,'Jinx',[],'adc',{},reference);
 const after=e.buildAdvice(s,data,'Jinx',[],'adc',{},reference,{historyAdvice:{qualified:true,sampleCount:3,items:[{id:'3072',bonus:5,count:3,games:3}]}});
 assert.equal(before.next.id,'3123');assert.equal(after.next.id,'3123');
});
