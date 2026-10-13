const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../core/engine.cjs');
const {quotePurchase}=require('../core/inventory.cjs');
const {parseCommunity}=require('../desktop/community.cjs');
const data=require('../data/catalog.json');
const {demo}=require('../core/demo.cjs');
function state(champ='Lux',items=[]){const s=demo(data);Object.assign(s.allPlayers[0],{championName:champ,rawChampionName:'game_character_displayname_'+champ,items:items.map(itemID=>({itemID,count:1}))});return s;}

test('wound component is sufficient before a full item and recognizes teammate coverage',()=>{
 const s=state('Lux',[6655]);
 let b=e.buildAdvice(s,data,'Lux');assert.equal(b.next.id,'3916');assert.notEqual(b.goal.id,'3165');
 s.allPlayers[0].items.push({itemID:3916});b=e.buildAdvice(s,data,'Lux');assert.notEqual(b.next.id,'3165');assert.ok(b.notes.some(n=>n.includes('giữ mảnh')));
 s.allPlayers[0].items.pop();s.allPlayers[1].items.push({itemID:3076});b=e.buildAdvice(s,data,'Lux');assert.notEqual(b.next.id,'3916');assert.ok(b.notes.some(n=>n.includes('không cộng dồn')));
});
test('Bramble is not suggested to proactively wound a distant healing mage',()=>{
 const s=state('Leona',[2502]);s.allPlayers=s.allPlayers.filter(p=>p.team==='ORDER'||p.championName==='Vladimir');
 const b=e.buildAdvice(s,data,'Leona');assert.ok(!b.tactical.some(i=>i.id==='3076'));assert.ok(b.notes.some(n=>n.includes('không chủ động')));
});
test('confirmed enemy healing augment affects advice; unknown augments do not',()=>{
 const s=state('Lux',[6655]);s.allPlayers=s.allPlayers.filter(p=>p.team==='ORDER'||p.championName==='Lux');
 const before=e.buildAdvice(s,data,'Lux'),after=e.buildAdvice(s,data,'Lux',[],'auto',{'Lux#DEMO':{ids:['NatureIsHealing']}});
 assert.equal(before.healing,0);assert.equal(after.healing,1);assert.equal(after.next.id,'3916');
});
test('role conversion and actual investment steer build direction',()=>{
 assert.equal(e.inferRole('Jinx',data,state('Jinx',[3153]),'auto'),'onhit');
 assert.equal(e.inferRole('Gragas',data,state('Gragas',[3031]),'auto',['ARAM_ADAPt']),'mage');
 assert.equal(e.inferRole('Jinx',data,state('Jinx'),'auto',['ARAM_DualWield']),'onhit');
 assert.equal(e.inferRole('Jinx',data,state('Jinx',[3031]),'auto',['ARAM_DualWield']),'adc');
});
test('a user target remains selected while alternatives and tactical purchases stay visible',()=>{
 const b=e.buildAdvice(state('Lux',[6655]),data,'Lux',[],'auto',{},null,{targetItem:'3089'});
 assert.equal(b.next.id,'3089');assert.equal(b.goal.id,'3089');assert.ok(b.tactical.some(i=>i.id==='3916'));assert.ok(b.alternatives.length);
});
test('recipe credit handles duplicates and quotes intermediate upgrades at additional cost',()=>{
 const tiny={items:{a:{gold:{total:3000},from:['b','b']},b:{gold:{total:1000},from:['c','c']},c:{gold:{total:300}}}};
 const q=quotePurchase('a',[{itemID:'b',count:1},{itemID:'c',count:1}],tiny);
 assert.equal(q.credit,1300);assert.equal(q.remaining,1700);assert.equal(q.missing.find(i=>i.id==='b').remaining,700);
 assert.equal(q.missing.filter(i=>i.id==='c').length,1);
});
test('component shopping uses combine cost and supports upgrading basic boots',()=>{
 const s=state('Lux',[1052,1001]);s.allPlayers=s.allPlayers.filter(p=>p.team==='ORDER');s.activePlayer.currentGold=400;
 const b=e.buildAdvice(s,data,'Lux',[],'auto',{},null,{targetItem:'3165'});
 assert.ok(b.components.some(i=>i.id==='3916'&&i.total===400));assert.ok(b.path.some(i=>i.id==='3020'));
});
test('missing player identities never select the first anonymous player',()=>{
 const s={activePlayer:{},allPlayers:[{championName:'Lux',items:[],team:'ORDER'}]};
 assert.equal(e.findSelf(s),null);assert.equal(e.threats(s,data).length,0);
});
test('teammate armor shred removes duplicate team-utility priority',()=>{
 const s=state('Darius',[6692]);s.allPlayers.push({...s.allPlayers[1],championName:'Ashe',rawChampionName:'game_character_displayname_Ashe',riotId:'ally2',items:[]},{...s.allPlayers[1],championName:'Jinx',rawChampionName:'game_character_displayname_Jinx',riotId:'ally3',items:[]});
 let b=e.buildAdvice(s,data,'Darius');assert.ok(b.path.some(i=>i.id==='3071'));
 s.allPlayers[1].items.push({itemID:3071});b=e.buildAdvice(s,data,'Darius');assert.ok(b.notes.some(n=>n.includes('đã có Rìu Đen')));
});
test('community pick rates stay separate from tiers and mismatched patches are rejected',()=>{
 const aug={schemaVersion:1,meta:{patch:'26.20',releaseId:'fixture'},rows:[{name:{en:'Deft'},pickRate:25}]};
 const combos={schemaVersion:1,meta:{releaseId:'fixture'},rows:[{championId:'Jinx',augmentNames:[{en:'Deft'}],types:['strong'],url:'https://arammayhem.com/combo/test/'}]};
 const result=parseCommunity(aug,combos,{...data,patch:'16.20'});
 assert.equal(result.popularity.ARAM_Deft.pickRate,25);assert.equal(result.popularity.ARAM_Deft.tier,undefined);assert.equal(result.combos[0].ids[0],'ARAM_Deft');
 assert.equal(parseCommunity(aug,combos,{...data,patch:'16.21'}),null);
 assert.deepEqual(result.combos[0].types,['strong']);
 assert.equal(parseCommunity(aug,{...combos,meta:{releaseId:'different'}},data),null);
});
