'use strict';
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const synonyms={onhit:'don danh',haste:'hoi ky nang',dot:'sat thuong theo thoi gian',burn:'thieu dot',heal:'hoi mau',shield:'la chan'};
function createIndex(catalog,builds=[],sources=[]){
 return [...Object.values(catalog.champions).map(x=>({...x,kind:'champions'})),...catalog.augments.map(x=>({...x,kind:'augments'})),...Object.values(catalog.items).map(x=>({...x,kind:'items'})),...builds.map(x=>({...x,kind:'library'})),...sources.map(x=>({...x,kind:'sources'}))].map(x=>({id:x.id,name:x.name,kind:x.kind,icon:x.icon,text:normalize([x.name,x.en,x.plain,x.description,x.tags,x.notes,x.coverage].join(' '))}));
}
function search(index,q,limit=40){const words=normalize(q).trim().split(/\s+/).filter(Boolean);if(!words.length)return [];return index.filter(x=>words.every(w=>x.text.includes(w)||synonyms[w]&&x.text.includes(synonyms[w]))).slice(0,Math.min(100,limit));}
function patchDiff(before,after){
 const changes=[];for(const kind of ['champions','items','augments']){const table=x=>Object.fromEntries((Array.isArray(x[kind])?x[kind]:Object.values(x[kind]||{})).map(r=>[r.id,r]));const a=table(before),b=table(after);
 for(const id of new Set([...Object.keys(a),...Object.keys(b)])){
  if(!a[id]||!b[id]){changes.push({kind,id,name:(b[id]||a[id]).name,type:a[id]?'REMOVED':'ADDED',breaking:!!a[id]});continue;}
  for(const field of ['stats','from','into','gold','maps','rarity','description','english','modes'])if(JSON.stringify(a[id][field])!==JSON.stringify(b[id][field]))changes.push({kind,id,name:b[id].name,type:['description','english'].includes(field)?'TEXT_CHANGED':'DATA_CHANGED',field,before:a[id][field]??null,after:b[id][field]??null,breaking:['from','into','maps'].includes(field),requiresReview:true});
 }}return {from:before.patch,to:after.patch,changes,createdAt:new Date().toISOString()};
}
function affectedBuilds(report,builds){const changed=new Set(report.changes.map(c=>c.kind+':'+c.id));return builds.filter(b=>changed.has('champions:'+b.champion)||(b.items||[]).some(id=>changed.has('items:'+id))||(b.augments||[]).some(id=>changed.has('augments:'+id))).map(b=>({id:b.id,name:b.name,simulationInvalidated:true,reason:'Dữ liệu phụ thuộc thay đổi; cần tính lại, chưa kết luận mạnh/yếu hơn.'}));}
function practice(catalog,seed=1,rarity){let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const pool=catalog.augments.filter(a=>!rarity||a.rarity===rarity);const cards=[];while(pool.length&&cards.length<3)cards.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return cards;}
function preferenceOrder(builds,preferences={},enabled=true){return builds.map((b,i)=>({b,i,score:enabled?Number(preferences[b.archetype]||0):0})).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.b);}
function validateLink(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('Chỉ nhận liên kết HTTPS công khai.');return u.href;}
module.exports={normalize,createIndex,search,patchDiff,affectedBuilds,practice,preferenceOrder,validateLink};
