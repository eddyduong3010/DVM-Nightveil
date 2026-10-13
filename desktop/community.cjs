const {normalize}=require('../core/engine.cjs');
const {z}=require('zod');
const path=require('node:path');
const {JsonCache}=require('./json-cache.cjs');
const SOURCE='https://arammayhem.com/data/';
const COMBO_TYPES=['god','strong','blackTech','entertainment','trap','bug'];
const fileSchema=z.object({schemaVersion:z.literal(1),meta:z.object({releaseId:z.string().min(1),patch:z.string().optional()}).passthrough(),rows:z.array(z.record(z.string(),z.unknown()))}).passthrough();
async function fetchCommunity(catalog,directory){
  const cache=new JsonCache(path.join(directory,'http-cache'));
  const index=await cache.get('https://arammayhem.com/data/v1/index.json',v=>z.object({schemaVersion:z.literal(1),releaseId:z.string().min(1),latestPatch:z.string(),latest:z.object({files:z.object({augments:z.object({json:z.url()}),combos:z.object({json:z.url()})})})}).passthrough().parse(v));
  const expected=catalog.patch.replace(/^16\./,'26.');
  if(index.latestPatch!==expected)throw Error('Nguồn combo chưa cùng bản vá '+expected+'.');
  const responses=await Promise.all(['augments','combos'].map(kind=>cache.get(index.latest.files[kind].json,v=>fileSchema.parse(v))));
  for(const file of responses)if(file.meta.releaseId!==index.releaseId||(file.meta.patch&&file.meta.patch!==expected))throw Error('Nguồn combo đang đổi phiên bản; giữ bản tốt trước.');
  const result=parseCommunity(responses[0],responses[1],catalog);
  if(!result)throw Error('Dữ liệu combo thiếu hoặc chưa cùng bản vá.');
  return result;
}
function parseCommunity(augments,combos,catalog){
  // Riot Data Dragon uses 16.x while public season labels use 26.x in 2026.
  const seasonPatch=catalog.patch.replace(/^16\./,'26.');
  if(augments.schemaVersion!==1||combos.schemaVersion!==1||augments.meta?.patch!==seasonPatch||!Array.isArray(augments.rows)||!Array.isArray(combos.rows)||!augments.meta.releaseId||combos.meta?.releaseId!==augments.meta.releaseId||(combos.meta.patch&&combos.meta.patch!==seasonPatch))return null;
  const byName=new Map();
  for(const a of catalog.augments){const n=normalize(a.en);byName.set(n,byName.has(n)?null:a.id);}
  const bySourceId=new Map(augments.rows.map(a=>[a.augmentId,byName.get(normalize(a.name?.en))]));
  const popularity={};
  for(const row of augments.rows){const id=byName.get(normalize(row.name?.en));if(id&&!row.retiredPatch&&Number.isFinite(row.pickRate))popularity[id]={pickRate:row.pickRate,rank:row.pickRateRank};}
  const mapped=combos.rows.map(row=>({id:String(row.comboId??row.url),champion:row.championId,ids:Array.isArray(row.augmentIds)&&row.augmentIds.length?row.augmentIds.map(id=>bySourceId.get(id)):(row.augmentNames||[]).map(a=>byName.get(normalize(a.en))),types:(row.types||[]).filter(t=>COMBO_TYPES.includes(t)),url:row.url}))
    .filter(row=>catalog.champions[row.champion]&&row.ids.length&&row.ids.every(Boolean)&&typeof row.url==='string'&&row.url.startsWith('https://arammayhem.com/combo/'));
  return {schema:2,releaseId:augments.meta.releaseId,source:SOURCE,attribution:'Data: arammayhem.com',license:'CC BY 4.0',patch:catalog.patch,publicPatch:seasonPatch,fetchedAt:Date.now(),statsDate:augments.meta.statsDate,popularity,combos:mapped};
}
module.exports={fetchCommunity,parseCommunity,COMBO_TYPES};
