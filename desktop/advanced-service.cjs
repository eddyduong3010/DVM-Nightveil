const {AnalysisClient}=require('./analysis-client.cjs');
const {ARCHETYPES,validateBuild}=require('../core/build-lab.cjs');
const evidence=require('../core/evidence.cjs'),info=require('../core/intelligence.cjs');
const {POLICY}=require('../core/feature-policy.cjs');
const {randomUUID}=require('node:crypto');
class AdvancedService{
 constructor(store){this.store=store;this.analysis=new AnalysisClient();this.sources=new (require('./source-adapters.cjs').SourceAdapters)(store.directory);this.sourceLoaded=false;}
 async initialize(catalog){if(!this.sourceLoaded){await this.sources.load();this.sourceLoaded=true;}this.catalog=catalog;this.analysis.catalog=catalog;if(this.analysis.worker)await this.analysis.initialize(catalog);}
 async request(action,p={}){
  if(!p||typeof p!=='object'||JSON.stringify(p).length>2e6)throw Error('Yêu cầu không hợp lệ hoặc quá lớn.');
  const storage=(action,payload)=>this.store.request('advanced',{action,payload});
  if(action==='load'){const local=await storage('load');local.builds=info.preferenceOrder(local.builds,local.profile.preferences,local.profile.personalization!==false);return {catalog:this.catalog,archetypes:ARCHETYPES,sources:this.sources.registry(),policy:POLICY,local,workspace:await storage('workspace-load'),simulations:await storage('simulations')};}
  if(action==='workspace'){if(!Array.isArray(p.branches)||!p.branches.length||p.branches.length>4)throw Error('Workspace cần 1–4 nhánh.');const branches=p.branches.map(b=>({...validateBuild(b,this.catalog),id:typeof b.id==='string'?b.id.slice(0,80):randomUUID()}));return storage('workspace',{branches,active:Math.max(0,Math.min(branches.length-1,Number(p.active)||0))});}
  if(action==='save-simulation'){const results=await this.analysis.request('simulate',p);return storage('simulation',{builds:p.builds,scenario:p.scenario,level:p.level,results,patch:this.catalog.patch,formulaVersion:require('../core/simulation.cjs').VERSION});}
  if(action==='sync-sources'){const local=await storage('load');return this.sources.sync({localOnly:local.profile.localOnly===true});}
  if(action==='community-discover'){
   const names=new Map(this.catalog.augments.map(a=>[info.normalize(a.en),a.id])),source=this.sources.knowledge;
   const rows=source.rows.filter(r=>!p.champion||r.champion===p.champion).map(r=>({...r,ids:r.names.map(n=>names.get(info.normalize(n.en))||null),patch:source.patch,patchCompatibility:source.patch===this.catalog.patch?'MATCH':'UNVERIFIED_MAPPING',verification:'COMMUNITY',source:source.source}));
   return {...source,rows:rows.filter(r=>!(p.excluded||[]).some(id=>r.ids.includes(id))).sort((a,b)=>b.ids.filter(id=>p.selected?.includes(id)).length-a.ids.filter(id=>p.selected?.includes(id)).length).slice(0,100)};
  }
  if(action==='search'){const local=await storage('load');if(!this.indexStamp||this.indexStamp!==JSON.stringify(local.builds.map(b=>[b.id,b.updatedAt]))||!this.analysis.worker){await this.analysis.request('reindex',{builds:local.builds});this.indexStamp=JSON.stringify(local.builds.map(b=>[b.id,b.updatedAt]));}return this.analysis.request(action,p);}
  if(['analyze','simulate','practice'].includes(action))return this.analysis.request(action,p);
  if(action==='save-build'){const clean=validateBuild(p,this.catalog);if(p.id&&(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)))throw Error('Build ID không hợp lệ.');const result=await storage('save-build',{...clean,id:p.id});const local=await storage('load');if(local.profile.personalization!==false){const preferences={...local.profile.preferences};preferences[clean.archetype]=Math.min(100,(Number(preferences[clean.archetype])||0)+1);await storage('profile',{...local.profile,preferences});}return result;}
  if(['delete-build','versions','delete-submission'].includes(action)){if(typeof p.id!=='string')throw Error('Thiếu ID.');return storage(action,{id:p.id});}
  if(action==='profile')return storage('profile',{language:p.language==='en'?'en':'vi',personalization:p.personalization!==false,localOnly:p.localOnly===true,textScale:Math.max(85,Math.min(140,Number(p.textScale)||100)),highContrast:p.highContrast===true,reducedMotion:p.reducedMotion!==false,favorites:(p.favorites||[]).filter(x=>this.catalog.champions[x]).slice(0,100),preferences:Object.fromEntries(ARCHETYPES.map(a=>[a.id,Math.max(0,Math.min(100,Number(p.preferences?.[a.id])||0))]))});
  if(action==='clear-personalization')return storage(action);
  if(action==='practice-save'){if(!Array.isArray(p.cards)||p.cards.length!==3||!p.cards.includes(p.chosen)||!p.cards.every(id=>this.catalog.augments.some(a=>a.id===id)))throw Error('Tình huống luyện tập không hợp lệ.');return storage('practice',{cards:p.cards,chosen:p.chosen,champion:this.catalog.champions[p.champion]?p.champion:Object.keys(this.catalog.champions).sort()[0],notes:String(p.notes||'').slice(0,4000),explanationRead:p.explanationRead===true,difficulty:['Beginner','Intermediate','Advanced','Expert'].includes(p.difficulty)?p.difficulty:'Beginner',patch:this.catalog.patch});}
  if(action==='submission'){const build=validateBuild(p,this.catalog);return storage('submission',{...build,url:info.validateLink(p.url),creator:String(p.creator||'').slice(0,120),type:'COMMUNITY',verification:'UNVERIFIED',publishedAt:String(p.publishedAt||'').slice(0,32)});}
  if(action==='import'){
   if(p.schema!==1||!Array.isArray(p.builds)||p.builds.length>100)throw Error('Backup schema 1, tối đa 100 build.');
   const clean=p.builds.map(b=>validateBuild(b,this.catalog));await this.store.backup();
   for(const b of clean)await storage('save-build',{...b,id:randomUUID()});return {imported:clean.length};
  }
  if(action==='export'){const local=await storage('load');return {schema:1,exportedAt:new Date().toISOString(),builds:local.builds,profile:local.profile,practice:local.practice,submissions:local.submissions};}
  if(action==='diagnostics'){const t=performance.now();await this.analysis.request('search',{query:Object.keys(this.catalog.champions).sort()[0]||''});return {database:'SQLite schema 3',workerRoundTripMs:performance.now()-t,catalogPatch:this.catalog.patch,catalogVersion:this.catalog.version,champions:Object.keys(this.catalog.champions).length,augments:this.catalog.augments.length,policy:POLICY,telemetry:false};}
  throw Error('Chức năng chưa hỗ trợ.');
 }
 async catalogChanged(next){const before=this.catalog;await this.initialize(next);if(!before)return;if(['champions','items','augments'].every(k=>JSON.stringify(before[k])===JSON.stringify(next[k]))&&before.patch===next.patch)return;const report=await this.analysis.request('diff',{before,after:next});if(report.changes.length){const local=await this.store.request('advanced',{action:'load'});const sims=await this.store.request('advanced',{action:'simulations'});report.affected=info.affectedBuilds(report,[...local.builds,...sims.flatMap(s=>s.builds||[])]);await this.store.request('advanced',{action:'invalidate-simulations',payload:{ids:report.affected.map(b=>b.id)}});await this.store.request('advanced',{action:'patch',payload:report});}}
 close(){return this.analysis.close();}
}
module.exports={AdvancedService};
