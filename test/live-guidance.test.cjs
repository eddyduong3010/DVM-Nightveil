const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseOpggBuild,parseOpggAugments}=require('../desktop/opgg.cjs');
const {cardChange}=require('../core/card-monitor.cjs');
const {clickedCard,shouldConfirmChoice}=require('../core/card-choice.cjs');
const {buildAdvice}=require('../core/engine.cjs');
const data=require('../data/catalog.json');
const {demo}=require('../core/demo.cjs');

test('OP.GG parser reads current-patch Mayhem item IDs and rejects a stale patch',()=>{
  const html='<h1>ARAM Build &amp; Runes in Patch 16.20</h1><table><caption>Boots Table</caption><tbody><tr><td><img src="/item/3020.png"></td></tr></tbody></table><table><caption>Builds Table</caption><tbody><tr><td><img src="/item/2503.png"><img src="/item/6653.png"><img src="/item/3116.png"></td></tr></tbody></table>';
  const found=parseOpggBuild(html,'Zyra','16.20');
  assert.deepEqual(found.builds,[['2503','6653','3116']]);
  assert.deepEqual(found.boots,['3020']);
  assert.equal(parseOpggBuild(html,'Zyra','16.21'),null);
});

test('source build follows purchased items and yields to a different chosen playstyle',()=>{
  const s=demo(data);s.allPlayers=s.allPlayers.filter(p=>p.team===s.allPlayers[0].team);s.allPlayers[0].championName='Zyra';s.allPlayers[0].rawChampionName='game_character_displayname_Zyra';s.allPlayers[0].items=[];
  const reference={source:'OP.GG',patch:data.patch,champion:'Zyra',url:'https://op.gg/lol/modes/aram-mayhem/zyra/build',fetchedAt:1,builds:[['2503','6653','3116']]};
  assert.equal(buildAdvice(s,data,'Zyra',[],'auto',{},reference).next.id,'2503');
  s.allPlayers[0].items=[{itemID:2503,count:1}];
  assert.equal(buildAdvice(s,data,'Zyra',[],'auto',{},reference).next.id,'6653');
  assert.notEqual(buildAdvice(s,data,'Zyra',[],'adc',{},reference).next.id,'2503');
});

test('card watcher ignores one transient change but detects a persistent reroll or closed screen',()=>{
  const state={suspected:0};
  assert.equal(cardChange(state,[.09,.01,.01]),false);
  assert.equal(cardChange(state,[.01,.01,.01]),false);
  assert.equal(cardChange(state,[.13,.01,.01]),false);
  assert.equal(cardChange(state,[.13,.01,.01]),true);
  assert.equal(cardChange({suspected:0},[.15,.16,.17]),true);
});

test('a click records the selected card only after the entire choice screen closes',()=>{
  const game={x:100,y:50,width:1000,height:800},regions=[{x:.18,y:.26,w:.2,h:.44},{x:.4,y:.26,w:.2,h:.44},{x:.62,y:.26,w:.2,h:.44}];
  const card=clickedCard(600,400,game,regions,['A','B','C']);
  assert.deepEqual(card,{id:'B',index:1});
  assert.equal(clickedCard(150,400,game,regions,['A','B','C']),null);
  const choice={...card,clickedAt:1000};
  assert.equal(shouldConfirmChoice(choice,3,false,3000),false);
  assert.equal(shouldConfirmChoice(choice,0,false,3000),false);
  assert.equal(shouldConfirmChoice(choice,0,true,3000),true);
  assert.equal(shouldConfirmChoice(choice,0,true,61000),false);
});

test('OP.GG ordering alone must not fabricate tiers for unknown Gragas augments',()=>{
  const names=data.augments.filter(a=>a.en).slice(0,25);
  const html=`<h1>Patch ${data.patch}</h1><ul class="w-full">${names.map(a=>`<li><img alt="${a.en}"></li>`).join('')}</ul>`;
  const parsed=parseOpggAugments(html,'Gragas',data.patch,data.augments);
  assert.ok(parsed&&Object.keys(parsed.ranks).length>=20);
  assert.equal(parseOpggAugments(html,'Gragas','0.0',data.augments),null);
  const reference={source:'OP.GG',patch:data.patch,champion:'Gragas',total:183,ranks:{PressureCooker:68,ChainReaction:1,Donation:60}};
  const advice=require('../core/engine.cjs').augmentAdvice(data,'Gragas',[],['PressureCooker','ChainReaction','Donation'],'auto',{referenceAugments:reference});
  assert.deepEqual(advice.offers.map(a=>a.tier),['?','?','?']);
  assert.deepEqual(advice.bestIds,[]);
});
