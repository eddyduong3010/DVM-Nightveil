const e=require('./engine.cjs');
const h=require('./build-history.cjs');
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)]||0;
const patchOf=version=>String(version||'').match(/^\d+\.\d+/)?.[0]||'';
const catalogKey=data=>h.hash(data.patch+JSON.stringify(data.augments.map(a=>[a.numericId,a.id])));
function numericAugments(stats,data){
 const slots=[];let available=false,fields=0;
 for(let slot=1;slot<=6;slot++){
  const key='playerAugment'+slot;
  if(!Object.hasOwn(stats,key))continue;
  if(!Number.isInteger(stats[key])||stats[key]<0)return {available:false,slots:[],ids:[],unknown:[]};
  available=true;fields++;const numericId=stats[key];if(!numericId)continue;
  // ARAM numeric IDs are matched directly, never translated from Arena names.
  const found=data.augments.filter(a=>Number(a.numericId)===numericId);
  slots.push({slot,numericId,id:found.length===1?found[0].id:null});
 }
 return {available,complete:fields===6,slots,ids:[...new Set(slots.map(a=>a.id).filter(Boolean))],unknown:[...new Set(slots.filter(a=>!a.id).map(a=>a.numericId))]};
}
function importMatch(history,match,data,{selfParticipantId,now=Date.now()}={}){
 const reject=reason=>({changed:false,complete:false,reason});
 if(!match||match.queueId!==2400||match.gameMode!=='KIWI'||match.endOfGameResult!=='GameComplete')return reject('mode');
 if(!/^\d{1,20}$/.test(String(match.gameId))||patchOf(match.gameVersion)!==data.patch)return reject('patch');
 const ps=match.participants;
 if(!Array.isArray(ps)||ps.length!==10||new Set(ps.map(p=>p.participantId)).size!==10||ps.some(p=>!Number.isInteger(p.participantId)||p.participantId<1||p.participantId>10||!p.stats)||[100,200].some(t=>ps.filter(p=>p.teamId===t).length!==5))return reject('participants');
 const self=ps.find(p=>p.participantId===selfParticipantId);if(!self)return reject('self');
 const time=Math.floor(n(match.gameDuration)),endedAt=n(match.gameCreation)+time*1000;
 if(endedAt<=history.clearedAt)return reject('cleared');
 if(time<300||!n(match.gameCreation)||now-endedAt>h.MAX_AGE||endedAt>now+300000)return reject('date');
 const game=h.gameKey(match.gameId),numericChamp=new Map(Object.values(data.champions).map(c=>[Number(c.key),c.id]));
 if(ps.some(p=>!numericChamp.has(p.championId)))return reject('champions');
 const rows=ps.map(p=>{
  const champion=numericChamp.get(p.championId),key='participant:'+p.participantId;
  const player={riotId:key,championName:champion,rawChampionName:'game_character_displayname_'+champion,team:p.teamId===100?'ORDER':'CHAOS',items:Array.from({length:6},(_,slot)=>({itemID:n(p.stats['item'+slot]),count:1,slot})).filter(i=>i.itemID),scores:{kills:n(p.stats.kills),deaths:n(p.stats.deaths),assists:n(p.stats.assists)},level:n(p.stats.champLevel)};
  const items=h.inventory(player,data),completed=h.completeItems(items,data),aug=numericAugments(p.stats,data);
  const itemValue=items.reduce((sum,i)=>sum+n(data.items[i.id]?.gold?.total)*i.count,0);
  return {p,champion,key,player,items,completed,aug,itemValue};
 });
 const allPlayers=rows.map(r=>r.player);let autoPlayers=0,unknown=0;
 for(const row of rows){
  const {p,champion,key,player,items,completed,aug,itemValue}=row;
  if(aug.available)autoPlayers++;unknown+=aug.unknown.length;
  const stableId=h.hash(game+':participant:'+p.participantId);
  const identity=match.participantIdentities?.find(i=>i.participantId===p.participantId)?.player;
  const liveKey=identity?.gameName&&identity?.tagLine?identity.gameName+'#'+identity.tagLine:identity?.summonerName;
  if(history.deletedIds.includes(stableId)||(liveKey&&history.deletedIds.includes(h.hash(game+':'+liveKey))))continue;
  let old=history.records.find(r=>r.id===stableId||(liveKey&&r.id===h.hash(game+':'+liveKey)));
  // Fallback only when both champion AND team uniquely bind an old observation.
  if(!old){const candidates=history.records.filter(r=>r.game===game&&r.champion===champion&&r.teamId===p.teamId);if(candidates.length===1&&rows.filter(r=>r.champion===champion&&r.p.teamId===p.teamId).length===1)old=candidates[0];}
  const augments=aug.available?aug.ids:old?.augments||[];
  const role=e.inferRole(champion,data,{activePlayer:{riotId:key},allPlayers},'auto',augments);
  const opposing=rows.filter(r=>r.p.teamId!==p.teamId),peers=rows.filter(r=>r.p.teamId===p.teamId);
  const {kills,deaths,assists}=player.scores;
  const combatLead=kills>=4&&(kills+assists*.5)/Math.max(1,deaths)>=2;
  const goldLead=itemValue>=median(peers.map(r=>r.itemValue))*1.15&&player.level>=median(peers.map(r=>r.player.level));
  const qualified=old?.qualified===true||(completed.length>=2&&itemValue>=5000&&(combatLead||goldLead));
  const timeline=old?[...old.timeline]:[];
  if(!timeline.length||JSON.stringify(timeline.at(-1).items)!==JSON.stringify(items))timeline.push({time,items});
  const record={id:old?.id||stableId,matchRecordId:stableId,game,participantId:p.participantId,champion,teamId:p.teamId,side:p.participantId===selfParticipantId?'self':p.teamId===self.teamId?'ally':'enemy',patch:data.patch,role,items,completed,augments,
   augmentSource:aug.available?'lcu-history':old?.augmentSource||'unknown',augmentSlots:aug.slots,unknownAugmentIds:aug.unknown,
   scores:player.scores,level:player.level,itemValue,gameTime:time,opposingMagic:opposing.reduce((sum,r)=>sum+e.damageProfile(r.player,data,r.aug.ids).magic,0)/5,opposingChampions:opposing.map(r=>r.champion),
   firstSeen:old?.firstSeen||endedAt,updatedAt:endedAt,importedAt:now,timeline:timeline.slice(-16),reasons:qualified?['Nổi bật theo giá trị trang bị hoặc K/D/A trong trận.']:['Lưu combo sau trận; chưa đạt tiêu chí mẫu nổi bật.'],qualified,finalized:true,outcome:p.stats.win===true?'win':p.stats.win===false?'loss':'unknown'};
  if(old)history.records[history.records.indexOf(old)]=record;else history.records.push(record);
 }
 history.records=history.records.filter(r=>now-r.updatedAt<h.MAX_AGE).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,h.MAX_RECORDS);
 history.savedAt=now;
 return {changed:true,complete:rows.every(r=>r.aug.complete),autoPlayers,unknown,records:10,game};
}
module.exports={importMatch,numericAugments,patchOf,catalogKey};
