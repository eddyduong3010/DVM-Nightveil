function demo(data,champion='Jinx'){
  const player=(champ,name,team,level,ids,kills,deaths,assists)=>({championName:champ,rawChampionName:'game_character_displayname_'+champ,riotId:name+'#DEMO',summonerName:name,team,level,isDead:false,items:ids.map((id,slot)=>({itemID:id,slot,count:1,displayName:data.items[String(id)]?.name||''})),scores:{kills,deaths,assists,creepScore:60}});
  return {activePlayer:{riotId:'Bạn#DEMO',summonerName:'Bạn',level:13,currentGold:1650},gameData:{gameTime:620,mapNumber:12,gameMode:'ARAM',gameVersion:data.version},allPlayers:[
    player(champion,'Bạn','ORDER',13,champion==='Evelynn'?[3152,3020,3100,1058]:[6672,3006,3031,1036],5,4,12),player('Leona','Đồng đội','ORDER',13,[2502,3047],2,4,16),
    player('Vladimir','Vladimir','CHAOS',14,[3089,3152,3020],9,2,8),player('Jinx','Jinx địch','CHAOS',13,[3031,3085,3006],7,3,12),player('Soraka','Soraka','CHAOS',12,[6617,3107,3158],1,3,19),player('Malphite','Malphite','CHAOS',13,[3143,3110,3047],4,4,15),player('Lux','Lux','CHAOS',13,[6655,4645,3020],6,3,11)]};
}
module.exports={demo};
