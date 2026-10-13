const {test}=require('node:test'),assert=require('node:assert/strict');
const data=require('../data/catalog.json'),engine=require('../core/engine.cjs'),{buildOptions}=require('../core/build-options.cjs'),g=require('../core/synergy-graph.cjs');
const {demo}=require('../core/demo.cjs');
function state(champ,items=[]){const s=demo(data,champ);s.allPlayers[0].items=items.map(itemID=>({itemID,count:1}));s.allPlayers=s.allPlayers.filter(p=>p.team==='ORDER');return s;}
function run(champ,aug=[],items=[],focus='auto',extra={},catalog=data){return buildOptions(state(champ,items),catalog,champ,aug,'auto',{},null,{focus,...extra});}
const cases=[
 ['Evelynn',['ARAM_Marksmage','ARAM_WitchfulThinking'],[3152],'experimental','3115'],
 ['Lux',['ARAM_ApexInventor'],[6655],'experimental','3157'],
 ['Brand',['ARAM_Vulnerability'],[],'damage','6653'],
 ['Soraka',['ARAM_FirstAidKit'],[],'sustain','6617'],
 ['Jinx',[],[],'sustain','3072'],
 ['Vayne',['ARAM_DualWield'],[],'antitank','3153'],
 ['KogMaw',['ARAM_DualWield'],[],'antitank','3153'],
 ['Kayle',['ARAM_Marksmage'],[],'experimental','3115'],
 ['Vladimir',[],[],'sustain','4633'],
 ['Aatrox',[],[],'sustain','3153'],
 ['Malphite',[],[],'utility','3110'],
 ['Leona',['ARAM_Goliath'],[],'survival','2502'],
 ['Sona',['ARAM_FirstAidKit'],[],'utility','3107'],
 ['Janna',['ARAM_FirstAidKit'],[],'sustain','6617'],
 ['Katarina',['ARAM_Marksmage'],[],'experimental','3115'],
 ['Zyra',['ARAM_Minionmancer'],[],'damage','6655'],
 ['Veigar',['ARAM_StackosaurusRex'],[],'damage','6655'],
 ['Nasus',[],[],'utility','3071'],
 ['Singed',['ARAM_Vulnerability'],[],'utility','3116'],
 ['Cassiopeia',[],[],'antitank','3135'],
 ['Riven',['ARAM_Earthwake'],[],'experimental','6692'],
 ['Yasuo',[],[],'sustain','3072'],
 ['Ashe',[],[],'utility','3071'],
 ['MasterYi',['ARAM_DualWield'],[],'antitank','3153']
];
for(const [champ,aug,items,focus,expected] of cases)test(`${champ}: ${focus}, augments and invested items yield explained legal alternatives`,()=>{
 const r=run(champ,aug,items,focus),p=r.selected;assert.equal(p.focus,focus);assert.ok(p.next);const ids=p.graph.nodes.filter(n=>n.type==='Item').map(n=>n.id);assert.ok(ids.includes('item:'+expected),ids.join(','));assert.ok(p.graph.nodes.some(n=>n.type==='Ability'));assert.ok(p.path.every(i=>engine.itemValid(data.items[i.id],champ,12)));assert.ok(!p.path.some(i=>items.includes(Number(i.id))));assert.ok(p.tradeoff.length>10);assert.ok(p.next.explanation.sources.length);assert.equal(Object.values(p.next.explanation.breakdown).reduce((a,b)=>a+b,0),p.next.score);assert.ok(p.alternatives.every(i=>i.explanation.confidence));
});
test('add/remove augment combo recomputes item evidence without mutating inputs',()=>{const before=JSON.stringify(data);const a=run('Evelynn',[],[3152]),b=run('Evelynn',['ARAM_Marksmage','ARAM_WitchfulThinking'],[3152]),c=run('Evelynn',[],[3152]);assert.ok(b.selected.graph.nodes.some(n=>n.type==='AugmentCombo'));assert.ok(b.selected.graph.edges.some(n=>n.to==='item:3115'));assert.deepEqual(a,c);assert.equal(JSON.stringify(data),before);});
test('lock survives every archetype and removing it restores actual preferences',()=>{const a=run('Lux',[],[],'damage',{targetItem:'3157'});assert.ok(a.plans.every(p=>p.next.id==='3157'));assert.notEqual(run('Lux',[],[],'damage').selected.next.id,'3157');});
test('conflicting locked magic penetration does not bypass exclusivity',()=>{const r=run('Lux',[],[3135],'auto',{targetItem:'3137'}).selected;assert.notEqual(r.next.id,'3137');assert.ok(r.conflicts.some(s=>s.includes('xung đột')));});
test('unsupported healing augment on damage-only kit reports condition rather than inventing synergy',()=>{const p=run('Jinx',['ARAM_FirstAidKit']).selected;assert.ok(p.conflicts.some(s=>s.includes('cần heal')));assert.ok(!p.graph.edges.some(e=>e.from==='augment:ARAM_FirstAidKit'&&e.type==='supports'));});
test('pets missing, stack missing, unknown augment are explicit low-coverage warnings',()=>{for(const id of ['ARAM_Minionmancer','ARAM_StackosaurusRex','ARAM_NEW_PATCH']){const p=run('Lux',[id]).selected;assert.ok(p.conflicts.length);}});
test('sustain is not offered as lifesteal to Lux and falls back from saved unsupported focus',()=>{const r=run('Lux',[],[],'sustain');assert.ok(!r.plans.some(p=>p.id==='sustain'));assert.equal(r.selected.focus,'auto');assert.ok(r.selected.notes.some(n=>n.includes('chưa phù hợp')));});
test('patch change disables old graph synergies and old reference popularity; rollback restores them',()=>{const newer={...data,patch:'16.21',version:'16.21.1'};const a=run('Evelynn',['ARAM_Marksmage','ARAM_WitchfulThinking']);const b=run('Evelynn',['ARAM_Marksmage','ARAM_WitchfulThinking'],[],'auto',{},newer);assert.equal(b.selected.confidence,'Thấp');assert.ok(!b.selected.graph.nodes.some(n=>n.type==='AugmentCombo'));assert.ok(b.selected.conflicts.some(s=>s.includes('Patch mới')));assert.deepEqual(a,run('Evelynn',['ARAM_Marksmage','ARAM_WitchfulThinking']));});
test('licensed pick rate is displayed without score effect or forbidden field leakage',()=>{const community={source:'https://arammayhem.com/data/',license:'CC BY 4.0',patch:data.patch,statsDate:'2026-10-11',popularity:{ARAM_WitchfulThinking:{pickRate:88,winRate:99}},combos:[]};const a=run('Lux',['ARAM_WitchfulThinking']),b=run('Lux',['ARAM_WitchfulThinking'],[],'auto',{community});assert.equal(a.selected.next.score,b.selected.next.score);assert.equal(b.selected.observations[0].pickRate,88);assert.ok(!JSON.stringify(b).includes('winRate'));assert.equal(run('Lux',['ARAM_WitchfulThinking'],[],'auto',{community:{...community,patch:'16.19'}}).selected.observations.length,0);});
test('unlicensed source cannot affect recommendations or expose observations',()=>{const p=run('Lux',['ARAM_WitchfulThinking'],[],'auto',{community:{patch:data.patch,popularity:{ARAM_WitchfulThinking:{pickRate:60}}}}).selected;assert.equal(p.observations.length,0);});
test('new or removed item cannot remain a recommended item from old rules',()=>{const changed={...data,items:{...data.items}};delete changed.items['3157'];const p=run('Lux',['ARAM_ApexInventor'],[],'experimental',{},changed).selected;assert.ok(!p.graph.nodes.some(n=>n.id==='item:3157'));});
test('two source statistics with different pick rates produce identical scores',()=>{const base={source:'https://arammayhem.com/data/',license:'CC BY 4.0',patch:data.patch,combos:[]};const a=run('Lux',['ARAM_WitchfulThinking'],[],'damage',{community:{...base,popularity:{ARAM_WitchfulThinking:{pickRate:1}}}}),b=run('Lux',['ARAM_WitchfulThinking'],[],'damage',{community:{...base,popularity:{ARAM_WitchfulThinking:{pickRate:99}}}});assert.equal(a.selected.next.score,b.selected.next.score);});
test('antiheal remains tactical priority across six applicable modes against healing opponents',()=>{const s=demo(data,'Jinx');s.allPlayers[0].items=[{itemID:6672}];const r=buildOptions(s,data,'Jinx',['ARAM_DualWield'],'auto');assert.ok(r.plans.every(p=>p.next.id==='3123'));});
test('all graph edge endpoints resolve to typed nodes',()=>{for(const c of cases){const r=run(c[0],c[1],c[2],c[3]);for(const p of r.plans){const ids=new Set(p.graph.nodes.map(n=>n.id));for(const e of p.graph.edges){assert.ok(ids.has(e.from),e.from);assert.ok(ids.has(e.to),e.to);}}}});

test('manual mana target on Vladimir is honored with an explicit waste warning',()=>{const p=run('Vladimir',[],[],'auto',{targetItem:'6655'}).selected;assert.equal(p.next.id,'6655');assert.ok(p.conflicts.some(s=>s.includes('năng lượng')));});

test('utility candidate pool still respects allied armor shred instead of bypassing team context',()=>{
 const s=state('Ashe');s.allPlayers[1].items=[];const before=buildOptions(s,data,'Ashe',[],'auto',{},null,{focus:'utility'}).selected;
 s.allPlayers[1].items=[{itemID:3071}];const after=buildOptions(s,data,'Ashe',[],'auto',{},null,{focus:'utility'}).selected;
 const get=p=>[p.next,...p.path,...p.alternatives].find(i=>i?.id==='3071');assert.ok(get(before));assert.ok(get(after));assert.ok(get(after).score<get(before).score);assert.ok(after.notes.some(n=>n.includes('Rìu Đen')));
});

test('recommendation source links open only explicitly supported HTTPS sources',()=>{
 const {isRecommendationSource:ok}=require('../core/source-links.cjs');
 for(const u of ['https://arammayhem.com/data/','https://developer.riotgames.com/docs/lol#data-dragon','https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/champion/Evelynn.json'])assert.ok(ok(u));
 for(const u of ['javascript:alert(1)','file:///C:/x','https://ddragon.leagueoflegends.com.evil.test/a','https://evil.test/','https://user@arammayhem.com/data/'])assert.ok(!ok(u));
});

test('patch drift removes old heuristic augment tiers but accepts explicitly current source tiers',()=>{
 const d={...data,patch:'16.21'},ids=['ARAM_WitchfulThinking'];const a=engine.augmentAdvice(d,'Lux',[],ids);assert.equal(a.offers[0].tier,'?');assert.equal(a.offers[0].score,null);
 const b=engine.augmentAdvice(d,'Lux',[],ids,'auto',{referenceAugments:{champion:'Lux',patch:'16.21',tiers:{ARAM_WitchfulThinking:'A'}}});assert.equal(b.offers[0].tier,'A');
});
