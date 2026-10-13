'use strict';
const engine=require('./engine.cjs');
function visibleSession(snapshot,catalog){
 if(!snapshot||!Array.isArray(snapshot.allPlayers))return null;
 const self=engine.findSelf(snapshot);
 const players=snapshot.allPlayers.map(player=>{
  const champion=engine.championId(player,catalog);
  return {champion,name:catalog.champions[champion]?.name||player.championName||champion||'Tướng chưa rõ',icon:catalog.champions[champion]?.icon||'',side:self?(player===self?'Bạn':player.team===self.team?'Đồng đội':'Đối thủ'):'Chưa rõ',items:(player.items||[]).map(item=>{const id=String(item.itemID);return {id,name:catalog.items[id]?.name||item.displayName||id,icon:catalog.items[id]?.icon||''};})};
 });
 return {champion:self?engine.championId(self,catalog):'',gameTime:Math.max(0,Math.floor(snapshot.gameData?.gameTime||0)),players};
}
module.exports={visibleSession};
