// Explicit local verification against a COPY; never modifies the source profile.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {HistoryStore}=require('../desktop/history-store.cjs'),h=require('../core/build-history.cjs');
const data=require('../data/catalog.json'),{demo}=require('../core/demo.cjs'),{buildOptions}=require('../core/build-options.cjs');
(async()=>{
 const source=process.argv[2];if(!source)throw Error('Provide the legacy build-history.json path.');
 const dir=path.resolve(__dirname,'../../../outputs/validation-0.3.0/profile-copy-'+Date.now());await fs.mkdir(dir,{recursive:true});
 const original=await fs.readFile(source),expected=h.loadHistory(JSON.parse(original));await fs.writeFile(path.join(dir,'build-history.json'),original);
 const store=new HistoryStore(dir),start=performance.now();
 try{
  const migrated=await store.load();assert.equal(store.error,'');assert.deepEqual(migrated,expected);const migrationMs=performance.now()-start;
  await store.backup();assert.ok((await fs.readFile(source)).equals(original));
  const s=demo(data,'Evelynn'),times=[];for(let i=0;i<100;i++){const t=performance.now();buildOptions(s,data,'Evelynn',['ARAM_WitchfulThinking'],'auto',{},null,{});times.push(performance.now()-t);}
  times.sort((a,b)=>a-b);const report={passed:true,records:migrated.records.length,augments:migrated.records.reduce((n,r)=>n+r.augments.length,0),sourceUnchanged:true,migrationMs:Math.round(migrationMs),buildOptionsMedianMs:+times[50].toFixed(2),buildOptionsP95Ms:+times[95].toFixed(2),note:'Synthetic CPU timings; not an FPS or in-game OCR benchmark.'};
  await fs.writeFile(path.join(dir,'../profile-migration.json'),JSON.stringify(report,null,2));console.log(report);
 }finally{await store.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
