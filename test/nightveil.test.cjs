const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const data=require('../data/catalog.json');
const {validateCatalog,validateDragon}=require('../core/data-validation.cjs');
const {CatalogStore}=require('../desktop/catalog-store.cjs');
const {JsonCache}=require('../desktop/json-cache.cjs');
const {HistoryStore}=require('../desktop/history-store.cjs');
const h=require('../core/build-history.cjs');
const {demo}=require('../core/demo.cjs');
const {buildOptions}=require('../core/build-options.cjs');
const {planCombos,sanitizeDraft}=require('../core/combo-planner.cjs');
const {parseCommunity}=require('../desktop/community.cjs');
async function temporary(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nightveil-test-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('nightveil-test-'));await fs.rm(dir,{recursive:true,force:true});});return dir;}
function recorded(){const raw=h.newHistory(),s=demo(data);s.gameData.gameMode='KIWI';h.observeHistory(raw,s,data,{game:'migration',knownAugments:{'Vladimir#DEMO':{ids:['ARAM_WitchfulThinking']}}});raw.deletedIds=['a'.repeat(24)];raw.syncedMatches=[{key:'b'.repeat(24),catalog:data.patch,at:Date.now()}];return raw;}

test('catalog validation allows disabled placeholders, rejects blank purchasable ARAM items and mixed patches',()=>{
 assert.equal(validateCatalog(data).augments.length,data.augments.length);
 const blank=structuredClone(data);blank.items['3089'].name='';assert.throws(()=>validateCatalog(blank),/Danh mục/);
 assert.throws(()=>validateCatalog({...data,patch:'0.0'}),/bản vá/);
 assert.throws(()=>validateCatalog({...data,augments:[...data.augments,data.augments[0]]}),/trùng/);
 assert.throws(()=>validateDragon({version:'0.0.1',data:data.items},data.version,'item','vi_VN'),/bản vá/);
});
test('invalid catalog never replaces the active snapshot; corrupt snapshot and same-patch rollback recover',async t=>{
 const dir=await temporary(t),store=new CatalogStore(dir),next={...data,fetchedAt:new Date(Date.parse(data.fetchedAt)+1000).toISOString()};
 await store.publish(data);await assert.rejects(store.publish({...data,augments:[]}),/cấu trúc/);
 assert.equal((await store.load(null)).fetchedAt,data.fetchedAt);
 await store.publish(next);assert.equal((await store.load(null)).fetchedAt,next.fetchedAt);
 assert.equal((await store.rollback(data.patch)).fetchedAt,data.fetchedAt);
 await assert.rejects(store.rollback('0.0'),/cùng bản vá/);
 await store.publish(next);const entry=(await store.entries())[0];await fs.writeFile(path.join(dir,'catalog-snapshots',entry.file),'broken');
 assert.equal((await store.load(null)).fetchedAt,data.fetchedAt);assert.match(store.status,/phục hồi/);
});
test('ETag cache validates before publication and reuses immutable/304 data without downloading again',async t=>{
 const dir=await temporary(t),requests=[];let response=new Response(JSON.stringify({ok:true}),{headers:{etag:'v1'}});
 const cache=new JsonCache(dir,async(url,options)=>{requests.push(options);return response;});
 const validate=v=>{assert.equal(v.ok,true);return v;},url='https://arammayhem.com/data/test.json';
 await cache.get(url,validate);response=new Response(null,{status:304});await cache.get(url,validate);
 assert.equal(requests[1].headers['If-None-Match'],'v1');
 response=new Response(JSON.stringify({ok:false}));await assert.rejects(cache.get(url,validate));
 const before=requests.length;assert.deepEqual(await cache.get(url,validate,{immutable:true}),{ok:true});assert.equal(requests.length,before);
 await assert.rejects(cache.get('https://untrusted.invalid/'),/không được/);
 await assert.rejects(cache.get('http://arammayhem.com/data/test.json'),/không được/);
});
test('SQLite migration keeps exact augments, deletion markers and legacy JSON; backup restores a corrupt database',async t=>{
 const dir=await temporary(t),raw=recorded(),text=JSON.stringify(raw);await fs.writeFile(path.join(dir,'build-history.json'),text);
 let store=new HistoryStore(dir);
 try{
  const loaded=await store.load();assert.equal(store.error,'');assert.deepEqual(loaded, h.loadHistory(raw));assert.match(store.status,/chuyển/);
  const originalCount=loaded.records.length;loaded.records=loaded.records.slice(1);loaded.clearedAt=123;
  await store.save(loaded);assert.equal(store.error,'');await store.backup();await store.close();
  assert.equal(await fs.readFile(path.join(dir,'build-history.json'),'utf8'),text);
  await fs.writeFile(path.join(dir,'history.sqlite'),'corrupt');store=new HistoryStore(dir);
  const recovered=await store.load();assert.equal(recovered.records.length,originalCount-1);assert.deepEqual(recovered.deletedIds,raw.deletedIds);assert.equal(recovered.clearedAt,123);assert.match(store.status,/phục hồi/);
 }finally{await store.close();}
});
test('malformed legacy history stays intact and cannot be replaced by a later save',async t=>{
 const dir=await temporary(t),text=JSON.stringify({schema:1,records:[{id:'invalid'}]});await fs.writeFile(path.join(dir,'build-history.json'),text);const store=new HistoryStore(dir);
 try{await store.load();assert.match(store.error,/không hợp lệ/);await store.save(h.newHistory());assert.match(store.error,/không hợp lệ/);assert.equal(await fs.readFile(path.join(dir,'build-history.json'),'utf8'),text);}finally{await store.close();}
});
test('build focus keeps a prioritized cheap wound component and locked target; alternatives can change order',()=>{
 const s=demo(data,'Evelynn');let options=buildOptions(s,data,'Evelynn',['ARAM_WitchfulThinking'],'auto',{},null,{focus:'survival'});
 assert.equal(options.selected.id,'survival');assert.ok(options.plans.every(p=>p.next.id==='3916'));
 options=buildOptions(s,data,'Evelynn',['ARAM_WitchfulThinking'],'auto',{},null,{targetItem:'3089',focus:'damage'});
 assert.ok(options.plans.every(p=>p.next.id==='3089'&&p.tactical.some(i=>i.id==='3916')));
 assert.ok(options.plans.every(p=>p.path.filter(i=>data.items[i.id].tags.includes('Boots')).length<=1));
 s.allPlayers[0].items.push({itemID:3916});options=buildOptions(s,data,'Evelynn',[],'auto',{},null,{});
 assert.ok(new Set(options.plans.map(p=>p.next.id)).size>1);assert.ok(options.plans.every(p=>p.next.id!=='3165'));
});
test('community combo matching uses source IDs and preserves warning tags without mislabeling pick rate as tier',()=>{
 const aug={schemaVersion:1,meta:{patch:'26.20',releaseId:'one'},rows:[{augmentId:1,name:{en:'Deft'},pickRate:22}]};
 const combos={schemaVersion:1,meta:{releaseId:'one'},rows:[{comboId:'c',championId:'Evelynn',augmentIds:[1],types:['trap','bug','blackTech'],url:'https://arammayhem.com/combo/c/'}]};
 const parsed=parseCommunity(aug,combos,data);assert.deepEqual(parsed.combos[0].ids,['ARAM_Deft']);assert.equal(parsed.popularity.ARAM_Deft.tier,undefined);assert.equal(parsed.combos[0].types.length,3);
 assert.equal(parseCommunity(aug,{...combos,meta:{releaseId:'two'}},data),null);
 const ambiguous={...data,augments:[...data.augments,{...data.augments.find(a=>a.id==='ARAM_Deft'),id:'duplicate'}]};assert.equal(parseCommunity(aug,combos,ambiguous).combos.length,0);
 const own=['ARAM_Deft'],draft={champion:'Evelynn',ids:own},plan=planCombos(data,parsed,draft);assert.equal(plan.combos[0].complete,true);assert.equal(plan.warnings.length,1);assert.deepEqual(own,['ARAM_Deft']);
 assert.equal(planCombos(data,{...parsed,patch:'0.0'},draft).combos.length,0);
 assert.equal(sanitizeDraft({ids:data.augments.slice(0,9).map(a=>a.id)},data).ids.length,6);
});
