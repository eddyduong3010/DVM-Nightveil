const {importMatch,patchOf,catalogKey}=require('../core/match-history.cjs');
const {gameKey}=require('../core/build-history.cjs');
class MatchHistorySync{
 constructor(reader){this.reader=reader;this.busy=false;this.nextAt=0;this.phase='';this.currentGame=null;this.state={status:'Chờ client để tự đồng bộ lõi và đồ sau trận.',lastAt:0,games:0,players:0,unknown:0};}
 async tick({history,data,client,enabled=true,mode='live',isActive=()=>true,save=async()=>{},now=Date.now()}){
  if(!enabled||mode!=='live'||!client||this.busy)return;
  const ended=['PreEndOfGame','EndOfGame','WaitingForStats'].includes(client.phase);
  const leftGame=this.phase==='InProgress'&&client.phase!=='InProgress';
  if((ended&&this.phase!==client.phase)||leftGame)this.nextAt=0;
  this.phase=client.phase;
  if(now<this.nextAt)return;
  this.busy=true;this.nextAt=now+(ended?15000:60000);this.state.status='Đang đồng bộ lịch sử lõi + đồ từ client…';
  try{
   const response=await this.reader.readRecentMatches(20);if(!isActive())return;
   const games=response?.games?.games;
   if(!Array.isArray(games))throw Error('HISTORY_FORMAT');
   const catalog=catalogKey(data),queue=games.filter(m=>m.queueId===2400&&m.gameMode==='KIWI'&&patchOf(m.gameVersion)===data.patch&&Number(m.gameCreation)+Number(m.gameDuration)*1000>history.clearedAt);
   let imported=0,players=0,unknown=0,failed=0,incomplete=0;
   for(const summary of queue){
    if(!isActive())return;
    const key=gameKey(summary.gameId);
    if(history.syncedMatches.some(m=>m.key===key&&m.catalog===catalog))continue;
    // Summary identifies our own participant; detail supplies all ten owners.
    const self=summary.participants?.length===1?summary.participants[0].participantId:null;
    if(!self){failed++;continue;}
    try{
     const match=await this.reader.readMatch(summary.gameId);if(!isActive())return;
     if(String(match?.gameId)!==String(summary.gameId)){failed++;continue;}
     const result=importMatch(history,match,data,{selfParticipantId:self,now});
     if(result.changed){
      imported++;players+=result.autoPlayers;unknown+=result.unknown;
      if(result.complete){history.syncedMatches=history.syncedMatches.filter(m=>m.key!==key);history.syncedMatches.push({key,catalog,at:now});history.syncedMatches=history.syncedMatches.slice(-300);}else incomplete++;
      await save(history);
     }else failed++;
    }catch{failed++;}
   }
   this.state={status:failed||incomplete?`Đã đồng bộ ${imported} trận; ${failed+incomplete} trận chưa đủ dữ liệu, sẽ tự thử lại.`:imported?`Đã tự lấy lõi + đồ của ${players} lượt người trong ${imported} trận.`:'Lịch sử đã cập nhật. Trận đang chơi sẽ được bổ sung lõi sau khi kết thúc.',lastAt:now,games:imported,players,unknown};
  }catch{this.state.status='Chưa đọc được lịch sử từ client; sẽ tự thử lại sau 60 giây.';this.nextAt=now+60000;}
  finally{this.busy=false;}
 }
}
module.exports={MatchHistorySync};
