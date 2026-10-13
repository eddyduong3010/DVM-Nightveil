const crypto=require('node:crypto');
const e=require('./engine.cjs');
const MAX_RECORDS=300,MAX_AGE=180*86400000;
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,24);
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const median=values=>{const v=[...values].sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:0;};
const newHistory=()=>({schema:1,records:[],syncedMatches:[],deletedIds:[],clearedAt:0,savedAt:0});
function inventory(player,data){return (player.items||[]).filter(i=>i.slot===undefined||i.slot<6).map(i=>({id:String(i.itemID),count:Math.max(1,Math.min(6,finite(i.count)||1))})).filter(i=>data.items[i.id]).sort((a,b)=>a.id.localeCompare(b.id));}
function completeItems(items,data){return [...new Set(items.map(i=>i.id).filter(id=>data.items[id]?.gold?.total>=2200&&!data.items[id]?.tags?.includes('Boots')))];}
function loadHistory(raw,now=Date.now()){
 const result=newHistory();
 if(raw?.schema!==1||!Array.isArray(raw.records))return result;
 result.savedAt=finite(raw.savedAt);
 result.clearedAt=finite(raw.clearedAt);
 result.deletedIds=(Array.isArray(raw.deletedIds)?raw.deletedIds:[]).filter(id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id)).slice(-3000);
 result.syncedMatches=(Array.isArray(raw.syncedMatches)?raw.syncedMatches:[]).filter(m=>m&&typeof m.key==='string'&&typeof m.catalog==='string'&&Number.isFinite(m.at)&&now-m.at<MAX_AGE).slice(-300);
 result.records=raw.records.filter(r=>r&&typeof r.id==='string'&&typeof r.game==='string'&&typeof r.champion==='string'&&typeof r.patch==='string'&&typeof r.role==='string'&&Array.isArray(r.items)&&r.items.every(i=>i&&/^\d+$/.test(i.id)&&Number.isFinite(i.count))&&Array.isArray(r.completed)&&r.completed.every(id=>typeof id==='string')&&Array.isArray(r.augments)&&r.augments.every(id=>typeof id==='string')&&Array.isArray(r.timeline)&&r.timeline.every(t=>Number.isFinite(t.time)&&Array.isArray(t.items))&&r.scores&&Number.isFinite(r.updatedAt)&&now-r.updatedAt<MAX_AGE).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_RECORDS);
 return result;
}
function gameKey(id,snapshot,now=Date.now()){
 return hash(id?'game:'+id:'estimated-start:'+Math.round((now-finite(snapshot.gameData?.gameTime)*1000)/30000));
}
function observeHistory(history,snapshot,data,{game,knownAugments={},queueId,mode='live',now=Date.now()}={}){
 if(mode!=='live'||!game||(snapshot?.gameData?.gameMode!=='KIWI'&&queueId!==2400))return false;
 const self=e.findSelf(snapshot),time=Math.floor(finite(snapshot.gameData?.gameTime));
 if(!self||time<300)return false;
 const others=(snapshot.allPlayers||[]).filter(p=>p!==self&&p.team);
 const rows=others.map(p=>{
  const items=inventory(p,data),cost=items.reduce((n,i)=>n+finite(data.items[i.id]?.gold?.total)*i.count,0);
  const scores={kills:finite(p.scores?.kills),deaths:finite(p.scores?.deaths),assists:finite(p.scores?.assists)};
  return {p,items,cost,scores,completed:completeItems(items,data),level:finite(p.level)};
 });
 let changed=false;
 for(const row of rows){
  const key=e.playerKey(row.p),id=hash(game+':'+key),champion=e.championId(row.p,data),old=history.records.find(r=>r.id===id);
  if(history.deletedIds.includes(id))continue;
  if(old?.finalized)continue;
  const peers=rows.filter(r=>r.p.team===row.p.team),middleGold=median(peers.map(r=>r.cost)),middleLevel=median(peers.map(r=>r.level));
  const opposingTeam=(snapshot.allPlayers||[]).filter(p=>p.team&&p.team!==row.p.team);
  const magic=opposingTeam.reduce((n,p)=>n+e.damageProfile(p,data).magic,0)/Math.max(1,opposingTeam.length);
  const {kills,deaths,assists}=row.scores;
  const combatLead=kills>=4&&(kills+assists*.5)/Math.max(1,deaths)>=2;
  const goldLead=row.cost>=middleGold*1.15&&row.level>=middleLevel;
  const qualifies=row.completed.length>=2&&row.cost>=5000&&(combatLead||goldLead);
  if(!data.champions[champion]||(!old&&!qualifies))continue;
  if(old&&time<old.gameTime)continue;
  // Only owner-confirmed observations are passed into this map; unknown is not zero augments.
  const known=knownAugments[key];
  const ids=Object.hasOwn(knownAugments,key)?known?.ids||[]:old?.augments||[];
  const augments=[...new Set(ids.filter(id=>data.augments.some(a=>a.id===id)))];
  const role=e.inferRole(champion,data,{activePlayer:{riotId:key},allPlayers:[row.p]},'auto',augments);
  const timeline=old?[...old.timeline]:[];
  if(!timeline.length||JSON.stringify(timeline.at(-1).items)!==JSON.stringify(row.items))timeline.push({time,items:row.items});
  const reasons=[];
  if(combatLead)reasons.push(`${kills}/${deaths}/${assists} tại ${Math.floor(time/60)} phút`);
  if(goldLead)reasons.push(`Giá trị đồ hơn trung vị cùng đội ${Math.round((row.cost/Math.max(1,middleGold)-1)*100)}%`);
  const record={id,game,champion,teamId:row.p.team==='ORDER'?100:row.p.team==='CHAOS'?200:null,side:row.p.team===self.team?'ally':'enemy',qualified:true,patch:data.patch,role,items:row.items,completed:row.completed,augments,augmentSource:augments.length?'confirmed':'unknown',scores:row.scores,level:row.level,itemValue:row.cost,gameTime:time,opposingMagic:magic,opposingChampions:opposingTeam.map(p=>e.championId(p,data)),firstSeen:old?.firstSeen||now,updatedAt:now,timeline:timeline.slice(-16),reasons:qualifies?reasons:old.reasons,outcome:'unknown'};
  if(old)history.records[history.records.indexOf(old)]=record;else history.records.push(record);
  changed=true;
 }
 if(changed){history.records=history.records.filter(r=>now-r.updatedAt<MAX_AGE).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_RECORDS);history.savedAt=now;}
 return changed;
}
function historyAdvice(history,data,champion,role,{owned=[],items=[],game='',now=Date.now(),enemyMagic=.5}={}){
 const eligible=history.records.filter(r=>r.qualified!==false&&r.champion===champion&&r.patch===data.patch&&r.role===role&&r.game!==game&&now-r.updatedAt<MAX_AGE);
 const ownSet=new Set(owned),itemSet=new Set(items.map(i=>String(i.itemID)));
 const overlap=r=>r.augments.filter(id=>ownSet.has(id)).length*5+r.items.filter(i=>itemSet.has(i.id)).length*2+(Math.abs((r.opposingMagic??.5)-enemyMagic)<.25?1:0);
 const ranked=[...eligible].sort((a,b)=>overlap(b)-overlap(a)||b.updatedAt-a.updatedAt);
 const perGame=[],seen=new Set();for(const r of ranked){if(!seen.has(r.game)){seen.add(r.game);perGame.push(r);}if(perGame.length===30)break;}
 const counts=new Map();for(const r of perGame)for(const id of r.completed)counts.set(id,(counts.get(id)||0)+1);
 const observed=perGame.filter(r=>r.augments.length),augmentCounts=new Map();for(const r of observed)for(const id of r.augments)augmentCounts.set(id,(augmentCounts.get(id)||0)+1);
 const augments=[...augmentCounts].map(([id,count])=>({id,count,observedGames:observed.length})).sort((a,b)=>b.count-a.count);
 const candidates=[...counts].map(([id,count])=>({id,count,games:perGame.length,bonus:perGame.length>=3&&count>=2&&count/perGame.length>=.5?Math.min(5,Math.round(count/perGame.length*5)):0})).filter(i=>e.itemValid(data.items[i.id],champion,12)).sort((a,b)=>b.count-a.count);
 return {sampleCount:perGame.length,qualified:perGame.length>=3,items:candidates,augments,examples:ranked.slice(0,3),matchedAugments:ranked[0]?.augments.filter(id=>ownSet.has(id))||[]};
}
module.exports={newHistory,loadHistory,gameKey,observeHistory,historyAdvice,MAX_RECORDS,MAX_AGE,hash,inventory,completeItems};
