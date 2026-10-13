const path=require('node:path'),fs=require('node:fs/promises');
const {JsonCache,atomicJson}=require('./json-cache.cjs');
const {SOURCES}=require('../core/evidence.cjs');
function validateIndex(v){if(v?.schemaVersion!==1||!v.releaseId||!v.latestPatch||v.license?.name!=='CC BY 4.0'||!v.license?.attribution)throw Error('Schema hoặc giấy phép ARAMMayhem không hợp lệ.');for(const key of ['augments','combos']){const u=new URL(v.latest?.files?.[key]?.json);if(u.protocol!=='https:'||u.hostname!=='arammayhem.com'||!u.pathname.startsWith('/data/v1/'))throw Error('Endpoint dữ liệu chưa xác minh.');}return v;}
function validateRows(v,release,patch){if(v?.schemaVersion!==1||v.meta?.releaseId!==release||v.meta?.patch&&v.meta.patch!==patch||!Array.isArray(v.rows)||v.rows.length>100000)throw Error('Snapshot nguồn không nhất quán.');return v;}
class SourceAdapters{
 constructor(directory){this.file=path.join(directory,'source-status.json');this.knowledgeFile=path.join(directory,'licensed-combos.json');this.knowledge={rows:[],patch:null};this.cache=new JsonCache(path.join(directory,'http-cache'));this.status={};this.nextAt=0;this.failures=0;this.busy=null;}
 async load(){try{this.status=JSON.parse(await fs.readFile(this.file,'utf8'));}catch{}try{const saved=JSON.parse(await fs.readFile(this.knowledgeFile,'utf8'));if(saved.license==='CC BY 4.0'&&Array.isArray(saved.rows)&&saved.rows.length<10000)this.knowledge=saved;}catch{}return this.status;}
 async sync({localOnly=false}={}){
  if(localOnly||Date.now()<this.nextAt)return this.status;if(this.busy)return this.busy;
  this.busy=this.perform().finally(()=>{this.busy=null;});return this.busy;
 }
 async perform(){
  const at=new Date().toISOString();const results=await Promise.allSettled([
   this.cache.get('https://ddragon.leagueoflegends.com/api/versions.json',v=>{if(!Array.isArray(v)||!v.length||!/^\d+\.\d+\.\d+$/.test(v[0]))throw Error('Danh sách phiên bản sai schema.');return v;}),
   (async()=>{const index=await this.cache.get('https://arammayhem.com/data/v1/index.json',validateIndex);const files=await Promise.all(['augments','combos'].map(key=>this.cache.get(index.latest.files[key].json,v=>validateRows(v,index.releaseId,index.latestPatch))));const knowledge={license:index.license.name,attribution:index.license.attribution,source:'https://arammayhem.com/data/',patch:index.latestPatch,releaseId:index.releaseId,updatedAt:at,verification:'COMMUNITY',rows:files[1].rows.filter(r=>typeof r.championId==='string'&&Array.isArray(r.augmentNames)&&typeof r.url==='string'&&r.url.startsWith('https://arammayhem.com/combo/')).map(r=>({id:String(r.comboId),champion:r.championId,names:r.augmentNames.map(a=>({en:String(a.en||''),vi:String(a['vi-VN']||a.en||'')})),tags:Array.isArray(r.types)?r.types.filter(t=>typeof t==='string'):[],url:r.url}))};await atomicJson(this.knowledgeFile,knowledge);this.knowledge=knowledge;return {index,counts:files.map(x=>x.rows.length)};})()
  ]);
  for(const [i,id] of ['riot','mayhem'].entries()){
   const r=results[i];this.status[id]={...this.status[id],checkedAt:at};
   if(r.status==='fulfilled')this.status[id]={checkedAt:at,lastSuccess:at,status:'CURRENT',patch:i===0?r.value[0]:r.value.index.latestPatch,release:i===0?r.value[0]:r.value.index.releaseId,coverage:i===0?'Data Dragon versions':'Augments '+r.value.counts[0]+'; combos '+r.value.counts[1],license:i===0?'Riot developer terms':r.value.index.license.name,error:null};
   else this.status[id]={...this.status[id],status:this.status[id].lastSuccess?'STALE':'UNAVAILABLE',error:r.reason.message.slice(0,240)};
  }
  if(results.some(x=>x.status==='rejected'))this.nextAt=Date.now()+Math.min(3600000,30000*2**Math.min(this.failures++,7));else{this.failures=0;this.nextAt=Date.now()+6*3600000;}
  await atomicJson(this.file,this.status);return this.status;
 }
 registry(){return SOURCES.map(s=>({...s,...this.status[s.id]}));}
}
module.exports={SourceAdapters,validateIndex,validateRows};
