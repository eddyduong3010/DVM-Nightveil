'use strict';
const TYPES=['OFFICIAL','VERIFIED_MECHANIC','LICENSED_STATISTICAL','EDITORIAL','COMMUNITY','EXPERIMENTAL','OUTDATED','UNKNOWN'];
const SOURCES=[
 {id:'riot',name:'Riot Data Dragon',url:'https://developer.riotgames.com/docs/lol#data-dragon',category:'OFFICIAL',license:'Riot developer terms',usage:'Static reference; assets belong to Riot',coverage:'Champion base stats, item stats; not complete spell formulas',status:'REFERENCE'},
 {id:'mayhem',name:'ARAMMayhem',url:'https://arammayhem.com/data/',category:'LICENSED_STATISTICAL',license:'CC BY 4.0',usage:'Attribution required; pick rates only',coverage:'Limited sample, community combos; no win rates or tiers in licensed dataset',status:'REFERENCE'},
 {id:'dvm',name:'DVM editorial rules',url:'https://github.com/eddyduong3010/DVM-Nightveil',category:'EDITORIAL',license:'DVM',usage:'Local heuristic, not validated damage or strength',coverage:'Build compatibility and assumptions',status:'UNVERIFIED'},
 {id:'cdragon',name:'CommunityDragon',url:'https://www.communitydragon.org/',category:'COMMUNITY',license:'Riot assets; redistribution rights require review',usage:'Cached reference, not proof of mechanics',coverage:'Augment names and icons, incomplete descriptions',status:'UNVERIFIED'},
 {id:'opgg',name:'OP.GG',url:'https://op.gg/lol/policies/agreement',category:'COMMUNITY',license:'Written permission unresolved',usage:'No automated retrieval in advanced production mode',coverage:'External reference only',status:'DISABLED'}
];
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
function confidence(e={},patch){
 const terms={reliability:clamp(e.reliability)*25,recency:clamp(e.recency)*15,patch:e.patch&&e.patch===patch?20:0,completeness:clamp(e.completeness)*15,verification:e.verified===true?15:0,agreement:clamp(e.agreement)*10};
 let score=Math.round(Object.values(terms).reduce((a,b)=>a+b,0)*(1-clamp(e.uncertainty))*(e.conflict?.5:1));
 if(!e.source||e.type==='UNKNOWN')score=0;
 if(e.patch!==patch)score=Math.min(score,25);
 return {version:1,score,label:score>=80?'High Confidence':score>=55?'Medium Confidence':score>=25?'Low Confidence':'Insufficient Evidence',terms,meaning:'Độ tin cậy thông tin, không phải xác suất thắng',sampleUsed:false};
}
function resolveClaims(claims,patch){return claims.map(c=>({...c,confidence:confidence({...c,conflict:claims.some(x=>x.subject===c.subject&&x.value!==c.value)},patch)}));}
function freshness({patch,currentPatch,checkedAt,valid=true,available=true},now=Date.now()){
 if(!available)return 'UNAVAILABLE';if(!valid)return 'UNVERIFIED';if(!patch||!currentPatch)return 'UNVERIFIED';if(patch!==currentPatch)return 'INCOMPATIBLE';return now-new Date(checkedAt).getTime()>7*86400000||!Number.isFinite(new Date(checkedAt).getTime())?'STALE':'CURRENT';
}
module.exports={TYPES,SOURCES,confidence,resolveClaims,freshness};
