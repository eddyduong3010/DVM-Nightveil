const {test}=require('node:test');
const assert=require('node:assert/strict');
const data=require('../data/catalog.json');
const h=require('../core/build-history.cjs');
const {importMatch,numericAugments}=require('../core/match-history.cjs');
const {MatchHistorySync}=require('../desktop/match-history-sync.cjs');
const fixture=()=>structuredClone(require('./fixtures/mayhem-result.json'));
const now=fixture().gameCreation+fixture().gameDuration*1000+60000;
const options={selfParticipantId:10,now};
const summary=()=>{const m=fixture();return {...m,participants:[m.participants[9]]};};
test('real client response shape imports all ten owners, 30 exact ARAM augment IDs, items and outcomes',()=>{
 const history=h.newHistory(),result=importMatch(history,fixture(),data,options);
 assert.equal(result.autoPlayers,10);assert.equal(result.unknown,0);assert.equal(result.complete,true);
 assert.equal(history.records.length,10);assert.equal(history.records.filter(r=>r.side==='ally').length,4);assert.equal(history.records.filter(r=>r.side==='enemy').length,5);assert.equal(history.records.filter(r=>r.side==='self').length,1);
 assert.ok(history.records.every(r=>r.augments.length===3&&r.augmentSource==='lcu-history'&&r.finalized));
 const zilean=history.records.find(r=>r.side==='self');assert.equal(zilean.champion,'Zilean');assert.equal(zilean.outcome,'win');assert.ok(zilean.items.some(i=>i.id==='3121'));
 assert.ok(history.records.filter(r=>r.side==='enemy').every(r=>r.outcome==='loss'));
 assert.equal(JSON.stringify(history).includes('puuid'),false);
 importMatch(history,fixture(),data,options);assert.equal(history.records.length,10);assert.equal(history.records[0].timeline.length,1);
});
test('unknown or ambiguous numeric IDs stay unresolved, not guessed from Arena or icons',()=>{
 const a=numericAugments({playerAugment1:1030,playerAugment2:999999,playerAugment3:0},data);
 assert.equal(a.ids.length,1);assert.deepEqual(a.unknown,[999999]);assert.equal(a.slots[1].slot,2);
 assert.equal(numericAugments({},data).available,false);
 assert.equal(a.complete,false);
 assert.equal(numericAugments({playerAugment1:null},data).available,false);
 const duplicate={...data,augments:[...data.augments,{id:'wrong-arena',numericId:1030}]};assert.deepEqual(numericAugments({playerAugment1:1030},duplicate).unknown,[1030]);
 const m=fixture(),history=h.newHistory();m.participants[0].stats.playerAugment1=999999;importMatch(history,m,data,options);assert.deepEqual(history.records.find(r=>r.participantId===1).unknownAugmentIds,[999999]);
});
test('missing augment fields keep sync pending rather than caching an incomplete match as finished',async()=>{
 const m=fixture(),history=h.newHistory();delete m.participants[0].stats.playerAugment6;
 const sync=new MatchHistorySync({readRecentMatches:async()=>({games:{games:[summary()]}}),readMatch:async()=>m});
 await sync.tick({history,data,client:{phase:'EndOfGame'},now});
 assert.equal(history.records.length,10);assert.equal(history.syncedMatches.length,0);assert.match(sync.state.status,/thử lại/);
});
test('mode, patch, incomplete roster, unknown self and stale match are rejected',()=>{
 for(const edit of [m=>m.queueId=450,m=>m.gameMode='CHERRY',m=>m.gameVersion='1.1',m=>m.participants.pop(),m=>m.participants[0].participantId=2,m=>m.endOfGameResult='InProgress',m=>m.gameCreation=1]){
  const m=fixture(),history=h.newHistory();edit(m);assert.equal(importMatch(history,m,data,options).changed,false);assert.equal(history.records.length,0);
 }
 assert.equal(importMatch(h.newHistory(),fixture(),data,{...options,selfParticipantId:12}).changed,false);
});
test('live observations merge by exact identity and preserve observed purchase milestones',()=>{
 const history=h.newHistory(),m=fixture(),p=m.participants[0],champ='Hwei',game=h.gameKey(m.gameId);
 const liveKey='Test participant#TEST';m.participantIdentities=[{participantId:p.participantId,player:{gameName:'Test participant',tagLine:'TEST'}}];
 const old={id:h.hash(game+':'+liveKey),game,champion:champ,teamId:100,role:'mage',patch:data.patch,items:[{id:'1058',count:1}],completed:[],augments:[],timeline:[{time:330,items:[{id:'1058',count:1}]}],scores:{},updatedAt:now-10000,firstSeen:now-10000,qualified:true};history.records.push(old);
 importMatch(history,m,data,options);assert.equal(history.records.length,10);const r=history.records.find(r=>r.id===old.id);assert.equal(r.timeline.length,2);assert.equal(r.timeline[0].time,330);assert.equal(r.augments.length,3);
 assert.equal(JSON.stringify(history).includes('Test participant'),false);
});
test('deletion and clearing are respected by subsequent imports and survive persistence',()=>{
 const history=h.newHistory(),m=fixture();importMatch(history,m,data,options);const id=history.records[0].id;
 history.deletedIds.push(id);history.records=history.records.filter(r=>r.id!==id);importMatch(history,m,data,options);assert.equal(history.records.length,9);
 const restored=h.loadHistory(JSON.parse(JSON.stringify(history)),now);assert.deepEqual(restored.deletedIds,[id]);
 restored.records=[];restored.clearedAt=now;assert.equal(importMatch(restored,m,data,options).changed,false);
});
test('automatic sync imports recent matches once, honors disable/demo, and retries missing details',async()=>{
 const history=h.newHistory();let calls=0,fail=true;
 const reader={readRecentMatches:async()=>({games:{games:[summary()]}}),readMatch:async()=>{calls++;if(fail)throw Error('CLIENT_404');return fixture();}};
 const sync=new MatchHistorySync(reader),base={history,data,client:{phase:'InProgress'},now,save:async()=>{}};
 await sync.tick({...base,enabled:false});await sync.tick({...base,mode:'demo'});assert.equal(calls,0);
 await sync.tick(base);assert.equal(calls,1);assert.equal(history.records.length,0);
 fail=false;await sync.tick({...base,now:now+61000});assert.equal(calls,2);assert.equal(history.records.length,10);
 await sync.tick({...base,now:now+122000});assert.equal(calls,2);assert.equal(history.syncedMatches.length,1);
 // A catalog numeric mapping change enables a fresh automatic enrichment.
 const changedData={...data,augments:[...data.augments,{id:'new',numericId:98765}]};await sync.tick({...base,data:changedData,now:now+183000});assert.equal(calls,3);
});
test('ending a match triggers early sync, concurrent ticks and cancelled work do not double-write',async()=>{
 const history=h.newHistory();let requests=0,release;
 const sync=new MatchHistorySync({readRecentMatches:async()=>{requests++;return {games:{games:[]}};}}),base={history,data,client:{phase:'InProgress'},now};
 await sync.tick(base);await sync.tick({...base,client:{phase:'EndOfGame'},now:now+1000});assert.equal(requests,2);
 let active=true,writes=0;const slow=new MatchHistorySync({readRecentMatches:()=>new Promise(r=>{release=r;})});
 const pending=slow.tick({...base,isActive:()=>active,save:()=>writes++});await slow.tick(base);active=false;release({games:{games:[summary()]}});await pending;
 assert.equal(history.records.length,0);assert.equal(writes,0);assert.equal(slow.busy,false);
});
test('a mismatched returned match ID cannot attach augments to a requested game',async()=>{
 const history=h.newHistory(),wrong=fixture();wrong.gameId++;
 const sync=new MatchHistorySync({readRecentMatches:async()=>({games:{games:[summary()]}}),readMatch:async()=>wrong});
 await sync.tick({history,data,client:{phase:'Lobby'},now});assert.equal(history.records.length,0);assert.equal(history.syncedMatches.length,0);
});
test('live sampling includes a strong ally and final low-performing builds are excluded from learning',()=>{
 const snapshot=require('../core/demo.cjs').demo(data);snapshot.gameData.gameMode='KIWI';
 const self=require('../core/engine.cjs').findSelf(snapshot),ally=snapshot.allPlayers.find(p=>p!==self&&p.team===self.team);
 ally.items=[{itemID:3083,slot:0},{itemID:3084,slot:1}];ally.scores={kills:8,deaths:1,assists:10};
 const history=h.newHistory();h.observeHistory(history,snapshot,data,{game:'live',now});assert.ok(history.records.some(r=>r.side==='ally'));
 const m=fixture();m.participants[0].stats.kills=0;m.participants[0].stats.assists=0;for(let i=0;i<6;i++)m.participants[0].stats['item'+i]=0;
 importMatch(history,m,data,options);const r=history.records.find(r=>r.champion==='Hwei');assert.equal(r.qualified,false);assert.equal(h.historyAdvice(history,data,'Hwei',r.role,{now}).sampleCount,0);
});
