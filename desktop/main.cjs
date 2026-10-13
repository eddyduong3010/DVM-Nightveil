const {app,BrowserWindow,ipcMain,globalShortcut,screen,dialog,shell,powerMonitor}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {POLICY,assertCommand}=require('../core/feature-policy.cjs');
const liveAdviceEnabled=POLICY.liveAdvice==='LOCAL_EXPERIMENTAL'||POLICY.liveAdvice==='APPROVED';
const ownOcrEnabled=POLICY.liveOCR==='VISIBLE_SELF_ONLY'||POLICY.liveOCR==='APPROVED';
const {visibleSession}=require('../core/visible-session.cjs');
const {AdvancedService}=require('./advanced-service.cjs');
let advanced;
const {LeagueReader}=require('./lcu.cjs');
const {RuntimeState,StatePublisher,validLive}=require('../core/runtime-state.cjs');
const runtime=new RuntimeState(),publisher=new StatePublisher();
let helperRestartTimer=null,helperRestarts=0,displayChangeTimer=null,updateNextAt=0,updateFailures=0;
const {OcrReader}=require('./ocr.cjs');
const {fetchOpggBuild,fetchOpggAugments}=require('./opgg.cjs');
const {fetchCommunity}=require('./community.cjs');
const engine=require('../core/engine.cjs');
const {badgeLayout}=require('../core/badge-layout.cjs');
const {cardChange}=require('../core/card-monitor.cjs');
const {clickedCard,shouldConfirmChoice}=require('../core/card-choice.cjs');
const {augmentGate,shouldAutoScan}=require('../core/auto-scan.cjs');
const {demo}=require('../core/demo.cjs');
const {updateData}=require('../scripts/update-data.cjs');
const displayLayout=require('../core/display-layout.cjs');
const overlayLayout=require('../core/overlay-layout.cjs');
const {REROLL_REGIONS,clickedReroll,RerollQueue}=require('../core/reroll.cjs');
const learning=require('../core/build-history.cjs');
const {HistoryStore}=require('./history-store.cjs');
const {MatchHistorySync}=require('./match-history-sync.cjs');
const {CatalogStore}=require('./catalog-store.cjs');
const {atomicJson}=require('./json-cache.cjs');
const releaseRuntime=require('./release-runtime.cjs');
const releaseConfig=require('../data/release.json');
let diagnostics,applicationUpdates,healthyTimer;
function releaseBusy(){return !releaseRuntime.canInstall({phase:runtime.state,clientPhase:client?.phase,snapshot,gameFocused});}
const {buildOptions,FOCUSES}=require('../core/build-options.cjs');
const {planCombos,sanitizeDraft}=require('../core/combo-planner.cjs');
const mechanics=require('../data/mechanics.json');
const brand=require('../data/brand.json');
const {importLegacyNightveil}=require('./profile-migration.cjs');
// An explicit test profile remains isolated; regular installations use their
// own Nightveil directory instead of the other Mayhem application's profile.
const previousProfile=app.getPath('userData');
app.setName(brand.name);
app.setPath('userData',['dvm-nightveil',brand.name,'mayhem-companion'].includes(path.basename(previousProfile))?path.join(app.getPath('appData'),'dvm-nightveil'):previousProfile);
let catalogStore,dataSnapshots=[],communityStatus='',buildCache=null,overlayUX={},tabHeld=false,settingsWrites=Promise.resolve();
const rerolls=new RerollQueue();
let rerollTimer,scanRevision=0,history=learning.newHistory(),historyStore,historySync,historyGame='',lastHistoryTime=-1,historyTierChampions=[];
let main,overlay,badgeOverlay,controlOverlay,reader,ocr,data,userDir,ocrDir,pollTimer,scanTimer,updateTimer,hotkeyHelper,gameClientRect=null,gameFocused=false;
let targetItem='',community=null,communityBusy=false,diagnostic={armed:false,status:'Chưa chụp bảng Tab',path:''};
let gamePhysicalRect=null,gameOuterRect=null,leagueClientRect=null,displaySetupOpen=false;
const assessmentCache=new Map();
function cachedAssessment(champ,ownedIds,offers,role,context={}){
 const key=JSON.stringify([data.patch,data.version,data.fetchedAt,champ,ownedIds,offers,role,context.referenceAugments?.parserVersion,context.referenceAugments?.fetchedAt,context.enemyThreats?.map(t=>t.champion)]);
 if(assessmentCache.has(key))return assessmentCache.get(key);
 const result=engine.augmentAdvice(data,champ,ownedIds,offers,role,context);
 if(assessmentCache.size>=40)assessmentCache.delete(assessmentCache.keys().next().value);
 assessmentCache.set(key,result);return result;
}
const defaults={autoScan:true,overlayEnabled:true,cardTiersEnabled:true,overlaySide:'right',role:'auto',manualChampion:'',gameDirectory:'',regions:[{x:.18,y:.26,w:.20,h:.44},{x:.40,y:.26,w:.20,h:.44},{x:.62,y:.26,w:.20,h:.44}]};
defaults.display={...displayLayout.DEFAULT_DISPLAY};
defaults.autoReroll=true;defaults.learnBuilds=true;defaults.useHistory=true;defaults.rerollRegions=REROLL_REGIONS;
Object.assign(defaults,overlayLayout.sanitizeOverlay());
defaults.buildFocus='auto';defaults.planner={champion:'',ids:[]};
let settings={...defaults},snapshot=null,client=null,status='Đang kết nối',lastLive=0,lastGameTime=-1,matchId=null,epoch=0,owned=[],offered=[],enemyAugments={},scan={status:'Sẵn sàng',matches:[],enemyCandidates:[]},mode='live',message='',polling=false,updating=false,pendingCatalog=null,versionWarning='',hotkeyFailures=[],hotkeyListener='Đang khởi động';
let autoScanState={gate:0,attempts:0,nextAt:0,complete:false};
let monitorState={suspected:0,rescans:0,observing:false,allChanged:false};
let pendingChoice=null,bufferedClick=null;
const referenceCache=new Map(),referenceAttempts=new Map(),referenceFetching=new Set();
const augmentReferenceCache=new Map(),augmentReferenceAttempts=new Map(),augmentReferenceFetching=new Set();
const augmentReferenceFailures=new Map();
const augmentReferenceErrors=new Map();
const augmentReferenceVerified=new Set();
let saveAugmentReferences=Promise.resolve();
const appVersion=require('../package.json').version;
const safeCatalog=()=>({items:data.items,version:data.version,patch:data.patch,fetchedAt:data.fetchedAt,champions:data.champions,augments:data.augments,assessment:data.assessment,sources:data.sources});
function selectedDisplay(){
 if(gameClientRect&&gameFocused)return screen.getDisplayMatching(gameClientRect);
 const chosen=screen.getAllDisplays().find(d=>String(d.id)===settings.display.monitorId);
 return chosen||(leagueClientRect?screen.getDisplayMatching(leagueClientRect):screen.getPrimaryDisplay());
}
function currentGameSize(){return displayLayout.gameSize(settings.display,selectedDisplay(),gamePhysicalRect);}
function effectiveRegions(){return displayLayout.adaptRegions(settings.regions,currentGameSize(),settings.regionsManual===true);}
function effectiveRerollRegions(){return displayLayout.adaptRegions(settings.rerollRegions,currentGameSize(),settings.rerollRegionsManual===true);}
function validRegions(regions){return Array.isArray(regions)&&regions.length===3&&regions.every(r=>r&&['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>=.015&&r.h>=.015&&r.x+r.w<=1&&r.y+r.h<=1);}
function observeBuilds(force=false){
 if(!settings.learnBuilds||mode!=='live'||!snapshot)return;
 const t=snapshot.gameData?.gameTime||0;
 if(!force&&lastHistoryTime>=0&&t-lastHistoryTime<15)return;
 if(client?.version?.match(/^\d+\.\d+/)?.[0]!==data.patch)return;
 if(!historyGame)historyGame=learning.gameKey(matchId,snapshot);
 lastHistoryTime=t;
 if(learning.observeHistory(history,snapshot,data,{game:historyGame,knownAugments:enemyAugments,queueId:client?.queueId,mode}))historyStore.save(history);
}
function historyView(suggestions){
 const present=r=>({...r,name:data.champions[r.champion]?.name||r.champion,icon:data.champions[r.champion]?.icon,roleLabel:engine.roles[r.role]||r.role,itemDetails:r.items.map(i=>({...i,name:data.items[i.id]?.name||i.id,icon:data.items[i.id]?.icon})),augmentNames:r.augments.map(id=>data.augments.find(a=>a.id===id)?.name||id),augmentDetails:r.augments.map(id=>{const a=data.augments.find(a=>a.id===id),ref=augmentReferenceCache.get(r.champion);return {id,name:a?.name||id,icon:a?.icon,tier:ref?.patch===r.patch?ref.tiers?.[id]||'?':'?'};})});
 return {...suggestions,items:suggestions.items.map(i=>({...i,name:data.items[i.id]?.name||i.id,icon:data.items[i.id]?.icon})),examples:suggestions.examples.map(present),augments:suggestions.augments.map(a=>({...a,name:data.augments.find(i=>i.id===a.id)?.name||a.id})),records:history.records.map(present),total:history.records.length,automatic:history.records.filter(r=>r.augmentSource==='lcu-history').length,sync:historySync?.state,error:historyStore?.error||'',storage:historyStore?.status||''};
}
function syncBuildHistory(){
 if(!historySync||historySync.busy)return;
 const current=history;
 const previous=historySync.state;
 historySync.tick({history:current,data,client,enabled:settings.learnBuilds,mode,isActive:()=>!app.isQuitting&&mode==='live'&&settings.learnBuilds&&history===current,save:()=>historyStore.save(current)}).then(()=>{if(!app.isQuitting&&historySync.state!==previous)broadcast();}).catch(()=>{});
}
function fitMain(){
 if(!main||main.isDestroyed())return;
 const bounds=displayLayout.mainLayout(selectedDisplay(),settings.display,leagueClientRect);
 main.setMinimumSize(Math.min(860,bounds.width),Math.min(620,bounds.height));main.setBounds(bounds);
}
function displayState(){const d=selectedDisplay();return {
 setupOpen:displaySetupOpen,selectedId:String(d.id),gameRect:gamePhysicalRect,clientRect:leagueClientRect,
 monitors:screen.getAllDisplays().map(m=>({id:String(m.id),label:m.label||'Màn hình',width:Math.round(m.size.width*m.scaleFactor),height:Math.round(m.size.height*m.scaleFactor),scale:m.scaleFactor,primary:m.id===screen.getPrimaryDisplay().id})),
 overlayScale:overlay?.webContents.getZoomFactor()||1,effectiveRegions:effectiveRegions(),effectiveRerollRegions:effectiveRerollRegions(),gameSize:currentGameSize(),
 warning:settings.display.gameMode==='fullscreen'?'Toàn màn hình độc quyền có thể che overlay hoặc làm ảnh chụp đen. Nếu gặp lỗi, chuyển game sang Không viền.':''
};}
function currentChampion(){
 if(snapshot){const p=engine.findSelf(snapshot);if(p)return engine.championId(p,data);}
 if(client?.selectedChampionKey){const c=Object.values(data.champions).find(c=>String(c.key)===String(client.selectedChampionKey));if(c)return c.id;}
 return settings.manualChampion||'';
}
function rosterChampions(){
 const ids=[currentChampion()];
 if(snapshot?.allPlayers?.length)ids.push(...snapshot.allPlayers.map(p=>engine.championId(p,data)));
 else for(const key of client?.championKeys||[]){const found=Object.values(data.champions).find(c=>String(c.key)===String(key));if(found)ids.push(found.id);}
 return [...new Set(ids.filter(id=>data.champions[id]))];
}
function getState({overlayOnly=false}={}){
 if(!liveAdviceEnabled)return {policy:POLICY,appVersion,brand,settings,overlayUX,diagnostic,mode,status,message,updating,applicationUpdate:applicationUpdates?.state,display:overlayOnly?null:displayState(),catalog:overlayOnly?null:{patch:data.patch,version:data.version},client:client?{phase:client.phase,version:client.version}:null,runtime:{state:runtime.state},history:overlayOnly?null:historyView({items:[],examples:[],augments:[]}),historyItemNames:{},owned:[],threats:[],offered:[],scan:{status:'Chỉ đọc dữ liệu đã hiển thị · không quét lõi'},visibleSession:POLICY.visibleSession==='READ_ONLY'?visibleSession(snapshot,data):null,lastLive,stale:!!lastLive&&Date.now()-lastLive>4500,staticReference:settings.staticReference||null,hotkeyListener,hotkeyFailures,overlayDiagnostic:overlayDiagnostic(),dataHealth:{patch:data.patch,updatedAt:data.fetchedAt,snapshots:dataSnapshots}};
 const champ=currentChampion(), blank={activePlayer:{},allPlayers:[],gameData:{mapNumber:12}};
 const enemyThreats=snapshot?engine.threats(snapshot,data,enemyAugments):[];
 const historyRole=engine.inferRole(champ,data,snapshot,settings.role,owned);
 const learned=learning.historyAdvice(history,data,champ,historyRole,{owned,items:engine.findSelf(snapshot)?.items||[],game:historyGame,enemyMagic:enemyThreats.reduce((n,t)=>n+t.damage.magic,0)/Math.max(1,enemyThreats.length)});
 const self=engine.findSelf(snapshot);
 const roster=(snapshot?.allPlayers||[]).filter(p=>p!==self).map(p=>{
   const id=engine.championId(p,data),key=engine.playerKey(p),ref=augmentReferenceCache.get(id);
   const known=(enemyAugments[key]?.ids||[]);
   return {key,champion:id,name:data.champions[id]?.name||p.championName,side:self&&p.team===self.team?'Đồng đội':'Đối thủ',augments:known.length?cachedAssessment(id,[],known,engine.inferRole(id,data,{activePlayer:{riotId:key},allPlayers:[p]},'auto',known),{referenceAugments:ref}).offers.filter(Boolean):[],referenceReady:ref?.patch===data.patch};
 });
 for(const threat of enemyThreats)threat.augments=roster.find(p=>p.key===threat.key)?.augments||[];
 const rosterIds=rosterChampions();
 const augmentReference=augmentReferenceCache.get(champ);
 const assessment=champ?cachedAssessment(champ,owned,offered,engine.inferRole(champ,data,snapshot,settings.role,owned),{enemyThreats,referenceAugments:augmentReference}):null;
 const topAugments=[];
 if(assessment){const groups=new Set();for(const a of assessment.rows){if(a.score===null||owned.includes(a.id)||groups.has(a.group))continue;topAugments.push({id:a.id,name:a.name,tier:a.tier,reason:a.reason});groups.add(a.group);if(topAugments.length===3)break;}}
 const stale=mode==='live'&&!!lastLive&&Date.now()-lastLive>4500;
 const communityCombos=community?.patch===data.patch?community.combos.filter(c=>c.champion===champ).map(c=>({...c,items:c.ids.map(id=>({id,name:data.augments.find(a=>a.id===id)?.name,owned:owned.includes(id)})),matched:c.ids.filter(id=>owned.includes(id)).length})).sort((a,b)=>b.matched-a.matched).slice(0,8):[];
 const buildKey=JSON.stringify([data.patch,data.version,data.fetchedAt,community?.releaseId,community?.fetchedAt,mode,epoch,champ,Math.floor((snapshot?.gameData?.gameTime||0)/30),snapshot?.activePlayer?.currentGold,snapshot?.allPlayers?.map(p=>[engine.playerKey(p),p.championName,p.team,p.level,p.isDead,p.items,p.scores]),owned,settings.role,settings.buildFocus,settings.useHistory,targetItem,enemyAugments,referenceCache.get(champ)?.fetchedAt,history.savedAt]);
 if(!buildCache||buildCache.key!==buildKey)buildCache={key:buildKey,value:champ?buildOptions(snapshot||blank,data,champ,owned,settings.role,enemyAugments,referenceCache.get(champ),{targetItem,community,threats:enemyThreats,historyAdvice:settings.useHistory?learned:null,focus:settings.buildFocus}):null};
 return {runtime:{state:runtime.state},brand,appVersion,applicationUpdate:applicationUpdates?.state,mode,status,message,settings,overlayUX,overlayDiagnostic:overlayDiagnostic(),visibleSession:visibleSession(snapshot,data),staticReference:settings.staticReference||null,planner:overlayOnly?null:planCombos(data,community,settings.planner),dataHealth:overlayOnly?null:{status:catalogStore?.status,communityStatus,snapshots:dataSnapshots,mechanicsVersion:mechanics.version,mechanicsVerified:mechanics.patches.includes(data.patch),storage:historyStore?.error||historyStore?.status,patch:data.patch,augments:data.augments.length,communityRelease:community?.releaseId,updatedAt:data.fetchedAt},display:overlayOnly?null:displayState(),hotkeyFailures,hotkeyListener,diagnostic,targetOptions:overlayOnly?[]:Object.values(data.items).filter(i=>i.gold?.total>=1800&&engine.itemValid(i,champ,snapshot?.gameData?.mapNumber||12)).map(i=>({id:i.id,name:i.name})).sort((a,b)=>a.name.localeCompare(b.name)),community:community?.patch===data.patch?{source:community.source,statsDate:community.statsDate,combos:communityCombos}:null,client:client?{phase:client.phase,queueId:client.queueId,version:client.version}:null,
   champion:champ?data.champions[champ]||{id:champ,name:champ}:null,catalog:overlayOnly?null:safeCatalog(),lastLive,stale,versionWarning,roster,rosterTierStatus:{loaded:rosterIds.filter(id=>augmentReferenceCache.get(id)?.patch===data.patch).length,total:rosterIds.length},
   gameTime:snapshot?.gameData?.gameTime||0,gameMode:client?.queueId===2400?'ARAM Hỗn Loạn':snapshot?.gameData?.gameMode||'',
   owned,ownedNames:owned.map(id=>data.augments.find(a=>a.id===id)?.name||id),offered,offerDetails:offered.map(id=>data.augments.find(a=>a.id===id)||null),topAugments,scan,updating,assessment:overlayOnly&&assessment?{offers:assessment.offers,advice:assessment.advice,bestIds:assessment.bestIds}:assessment,augmentReference:augmentReference?.patch===data.patch?{source:'OP.GG',patch:augmentReference.patch,url:augmentReference.url,covered:Object.keys(augmentReference.tiers||{}).length,iconCount:Object.keys(augmentReference.icons||{}).length,ambiguousCount:(augmentReference.ambiguousIcons||[]).flat().length,total:augmentReference.total,catalogCount:data.augments.length}:null,augmentReferenceStatus:augmentReferenceFetching.has(champ)?'Đang tải tier theo tướng từ OP.GG…':augmentReferenceErrors.get(champ)?'Nguồn OP.GG tạm lỗi; đang thử lại. Hiển thị ước tính theo cơ chế khi có.':'Đang chờ dữ liệu tier theo tướng.',badgeCenters:badgeLayout(gameClientRect,effectiveRegions())?.centers||[],
   build:buildCache.value?.selected||null,buildPlans:overlayOnly?null:buildCache.value?.plans||[],
   threats:enemyThreats,history:overlayOnly?null:historyView(learned),historyItemNames:overlayOnly?null:Object.fromEntries(history.records.flatMap(r=>r.timeline.flatMap(t=>t.items.map(i=>[i.id,data.items[i.id]?.name||i.id])))),
   selfItems:engine.findSelf(snapshot)?.items?.map(i=>({id:String(i.itemID),name:data.items[String(i.itemID)]?.name||i.displayName,icon:data.items[String(i.itemID)]?.icon}))||[],
   itemDetails:Object.fromEntries((snapshot?.allPlayers||[]).flatMap(p=>(p.items||[]).map(i=>[i.itemID,{name:data.items[String(i.itemID)]?.name||i.displayName,icon:data.items[String(i.itemID)]?.icon}])))};
}
function broadcast(){
 if(!data||app.isQuitting)return;positionOverlay();syncOverlay();syncBadgeOverlay();syncControlOverlay();
 const mainVisible=main&&!main.isDestroyed()&&main.isVisible()&&!main.isMinimized();
 const sideVisible=overlay&&!overlay.isDestroyed()&&overlay.isVisible(),badgesVisible=badgeOverlay&&!badgeOverlay.isDestroyed()&&badgeOverlay.isVisible();
 if(controlOverlay?.isVisible())publisher.send(controlOverlay,{settings,diagnostic,overlayUX});
 if(!mainVisible&&!sideVisible&&!badgesVisible)return;
 const state=getState({overlayOnly:!mainVisible});
 if(mainVisible)publisher.send(main,state);
 const compact={...state,build:state.build?{...state.build,graph:null,observations:[],alternatives:[],path:[],components:[],conflicts:[]}:null,catalog:null,history:null,historyItemNames:null,display:null,targetOptions:[],planner:null,buildPlans:null,dataHealth:null,assessment:state.assessment?{offers:state.assessment.offers,advice:state.assessment.advice,bestIds:state.assessment.bestIds}:null};
 if(sideVisible)publisher.send(overlay,compact);if(badgesVisible)publisher.send(badgeOverlay,compact);
}
function overlayDiagnostic(){return {enabled:settings.overlayEnabled,visible:!!overlay?.isVisible(),gameFocused,hasGame:!!snapshot||['InProgress','GameStart'].includes(client?.phase),helper:hotkeyListener};}
function overlayVisibility(){return overlayLayout.visibility({enabled:settings.overlayEnabled,demo:mode==='demo',hasGame:!!snapshot||['InProgress','GameStart'].includes(client?.phase),focused:gameFocused&&runtime.state!=='SUSPENDED',tabHeld,choices:offered.some(Boolean)&&!!scan.scannedAt&&Date.now()-scan.scannedAt<90000,autoTab:settings.overlayAutoHideTab,autoChoices:settings.overlayAutoHideChoices});}
function syncOverlay(){
 if(!overlay||overlay.isDestroyed())return;
 const show=overlayVisibility().panel;
 if(overlay._clickThrough!==settings.overlayClickThrough){overlay.setIgnoreMouseEvents(settings.overlayClickThrough);overlay._clickThrough=settings.overlayClickThrough;}
 if(show){if(!overlay.isVisible())overlay.showInactive();}
 else if(overlay.isVisible())overlay.hide();
}
function positionOverlay(side=settings.overlaySide){
 if(!overlay||overlay.isDestroyed())return;
 const d=selectedDisplay(),area=gameFocused&&gameClientRect?displayLayout.intersect(gameClientRect,d.bounds):d.workArea;
 const next=overlayLayout.layout(area,settings.display,{...settings,side,hasOffers:offered.some(Boolean)}),old=overlay.getBounds();overlayUX=next;
 if(Object.keys(next.bounds).some(k=>next.bounds[k]!==old[k]))overlay.setBounds(next.bounds);
 if(Math.abs(overlay.webContents.getZoomFactor()-next.zoom)>.001)overlay.webContents.setZoomFactor(next.zoom);
}
function syncControlOverlay(){
 if(!controlOverlay||controlOverlay.isDestroyed()||!overlay||overlay.isDestroyed())return;
 const show=overlayVisibility().controls;
 if(!show){controlOverlay.hide();return;}
 const old=controlOverlay.getBounds(),next=overlayUX.controls;
 if(!next)return;
 const zoom=1;
 if(Math.abs(controlOverlay.webContents.getZoomFactor()-zoom)>.001)controlOverlay.webContents.setZoomFactor(zoom);
 if(Object.keys(next).some(k=>next[k]!==old[k]))controlOverlay.setBounds(next);
 if(!controlOverlay.isVisible())controlOverlay.showInactive();
}
function syncBadgeOverlay(){
 if(!ownOcrEnabled){badgeOverlay?.hide();return;}
 if(!badgeOverlay||badgeOverlay.isDestroyed())return;
 const layout=badgeLayout(gameClientRect,effectiveRegions());
 const show=overlayVisibility().badges&&settings.cardTiersEnabled!==false&&mode==='live'&&!!snapshot&&gameFocused&&!!layout&&!!scan.scannedAt&&Date.now()-scan.scannedAt<90000&&offered.some(Boolean);
 if(!show){if(badgeOverlay.isVisible())badgeOverlay.hide();return;}
 const old=badgeOverlay.getBounds(),next=layout.bounds;
 if(Object.keys(next).some(k=>old[k]!==next[k]))badgeOverlay.setBounds(next);
 if(!badgeOverlay.isVisible())badgeOverlay.showInactive();
}
function saveSettings(){const saved=structuredClone(settings);settingsWrites=settingsWrites.catch(()=>{}).then(()=>releaseRuntime.saveSettings(userDir,saved));return settingsWrites;}
function resetMatch(){rerolls.clear();scanRevision++;historyGame='';lastHistoryTime=-1;epoch++;owned=[];offered=[];enemyAugments={};targetItem='';settings.role='auto';assessmentCache.clear();scan={status:'Sẵn sàng',matches:[],enemyCandidates:[]};autoScanState={gate:0,attempts:0,nextAt:0,complete:false};monitorState={suspected:0,rescans:0,observing:false,allChanged:false};pendingChoice=null;bufferedClick=null;ocr.reset();}
function maybeRefreshBuild(){
 if(!liveAdviceEnabled)return;
 if(mode==='demo'||!data?.patch)return;
 const champ=currentChampion();if(!champ)return;
 const cached=referenceCache.get(champ),now=Date.now();
 if(cached?.patch===data.patch&&now-cached.fetchedAt<6*3600000)return;
 if(referenceFetching.has(champ)||now-(referenceAttempts.get(champ)||0)<30000)return;
 referenceAttempts.set(champ,now);referenceFetching.add(champ);
 const requestedPatch=data.patch;
 fetchOpggBuild(champ,requestedPatch).then(async result=>{if(result&&!app.isQuitting&&result.patch===data.patch&&requestedPatch===data.patch){referenceCache.set(champ,result);await fs.writeFile(path.join(userDir,'build-references.json'),JSON.stringify(Object.fromEntries(referenceCache)));broadcast();}}).catch(()=>{}).finally(()=>referenceFetching.delete(champ));
}
async function refreshCommunity(){
 if(settings.localOnly)return;
 if(!liveAdviceEnabled){await advanced?.request('sync-sources').catch(()=>{});return;}
 if(settings.localOnly)return;
 if(communityBusy||app.isQuitting)return;communityBusy=true;
 const catalog=data;
 try{const fresh=await fetchCommunity(catalog,userDir);if(fresh&&!app.isQuitting&&catalog.patch===data.patch){community=fresh;communityStatus=`Combo đã đồng bộ · ${fresh.combos.length} bộ`;await atomicJson(path.join(userDir,'community.json'),fresh);}}
 catch(e){communityStatus='Giữ combo đã có: '+e.message;}finally{communityBusy=false;broadcast();}
}
async function inspectTab(){
 if(!liveAdviceEnabled)return;
 if(!diagnostic.armed||!gameFocused||mode!=='live'||!snapshot)return;
 if(ocr.busy||ocr.watching){diagnostic.status='OCR đang bận. Giữ Tab lại sau vài giây.';broadcast();return;}
 diagnostic.armed=false;diagnostic.status='Đang chụp và đọc bảng Tab…';broadcast();
 const capturedEpoch=epoch;
 try{
  const dir=path.join(userDir,'diagnostics');await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'tab-latest.png');
  const result=await ocr.inspect(data.augments,png=>fs.writeFile(file,png));
  if(result.busy){diagnostic.armed=true;diagnostic.status='OCR đang bận; giữ Tab lại để chụp.';return;}
  const report={capturedAt:new Date().toISOString(),patch:data.patch,playerFields:(snapshot?.allPlayers||[]).map(p=>({champion:p.championName,keys:Object.keys(p)})),recognized:result.found,text:result.text};
  await fs.writeFile(path.join(dir,'tab-latest.json'),JSON.stringify(report,null,2));
  diagnostic.path=file;
  if(epoch===capturedEpoch){scan.enemyCandidates=result.found;scan.enemyScannedAt=result.scannedAt;}
  diagnostic.status=result.found.length?`Đọc được ${result.found.length} tên lõi; xác nhận chủ sở hữu trong Thiết lập.`:'Đã chụp Tab nhưng chưa đọc được tên lõi. Ảnh đã lưu để kiểm tra giao diện; chưa thể kết luận ai sở hữu lõi.';
 }catch(e){diagnostic.status='Chưa chụp được Tab: '+e.message;}
 finally{broadcast();}
}
function maybeRefreshAugments(champ=currentChampion()){
 if(!['APPROVED','PUBLIC_TIER_CACHE'].includes(POLICY.opgg))return;
 if(mode==='demo'||!data?.patch)return;
 if(!champ)return;
 const cached=augmentReferenceCache.get(champ),now=Date.now();
 if(augmentReferenceVerified.has(champ)&&cached?.patch===data.patch&&now-cached.fetchedAt<6*3600000)return;
 const failures=augmentReferenceFailures.get(champ)||0;
 const retryMs=failures?Math.min(120000,10000*2**Math.min(failures-1,4)):0;
 if(augmentReferenceFetching.has(champ)||now-(augmentReferenceAttempts.get(champ)||0)<retryMs)return;
 augmentReferenceAttempts.set(champ,now);augmentReferenceFetching.add(champ);
 const requestedPatch=data.patch;
 fetchOpggAugments(champ,requestedPatch,data.augments).then(result=>{
   if(app.isQuitting||requestedPatch!==data.patch)return;
   if(!result)throw new Error('Trang lõi chưa khớp bản vá hoặc định dạng');
   augmentReferenceCache.set(champ,result);augmentReferenceFailures.delete(champ);augmentReferenceErrors.delete(champ);augmentReferenceVerified.add(champ);
   const contents=JSON.stringify(Object.fromEntries(augmentReferenceCache));
   saveAugmentReferences=saveAugmentReferences.then(()=>fs.writeFile(path.join(userDir,'augment-references.json'),contents)).catch(()=>{});
 }).catch(e=>{augmentReferenceFailures.set(champ,failures+1);augmentReferenceErrors.set(champ,e.message||'Không tải được');})
   .finally(()=>{augmentReferenceFetching.delete(champ);broadcast();});
}
function maybeRefreshRosterAugments(){
 if(!liveAdviceEnabled)return;
 const viewed=main?.isVisible()&&!main?.isMinimized()?historyTierChampions:[];
 for(const champ of [...new Set([currentChampion(),...viewed].filter(Boolean))]){
   if(augmentReferenceFetching.size>=3)break;
   maybeRefreshAugments(champ);
 }
}
runtime.on('transition',()=>{if(reader&&!polling)schedulePoll();});
function schedulePoll(){clearTimeout(pollTimer);const delay=POLICY.visibleSession==='READ_ONLY'||liveAdviceEnabled?runtime.delay():['SUSPENDED','DEMO','STOPPED'].includes(runtime.state)?null:Math.max(250,runtime.nextClient-Date.now());if(delay!==null&&!app.isQuitting)pollTimer=setTimeout(poll,delay);}
async function poll(){
 if(polling||mode==='demo'||app.isQuitting||runtime.state==='SUSPENDED')return;polling=true;
 const pollEpoch=epoch;
 try{
   if(runtime.due('client')){const c=await reader.readClient();if(mode!=='live'||pollEpoch!==epoch)return;client=c?{...c,checkedAt:Date.now()}:null;runtime.dispatch('CLIENT',c);const wanted=c?.version?.match(/^\d+\.\d+/)?.[0];if(wanted&&wanted!==data.patch){const cached=await catalogStore?.forPatch(wanted);if(mode!=='live'||pollEpoch!==epoch)return;if(cached)activateCatalog(cached);}}
   if(pendingCatalog&&!['InProgress','GameStart','Reconnect'].includes(client?.phase)){activateCatalog(pendingCatalog);pendingCatalog=null;}
    status=client?'Đã kết nối client · quan sát thụ động':'Ngoại tuyến · cache sẵn sàng';
    const readLive=(POLICY.visibleSession==='READ_ONLY'||liveAdviceEnabled)&&runtime.due('live');
   const live=readLive?await reader.readLive().catch(()=>null):null;
   if(mode!=='live'||pollEpoch!==epoch)return;
   if(validLive(live)&&!['POSTGAME','CLIENT','CHAMP_SELECT'].includes(runtime.state)){
      runtime.dispatch('LIVE_OK');
      const id=client?.gameId;const t=live.gameData?.gameTime||0;
      if((matchId&&id&&matchId!==id)||(lastGameTime>=0&&t+15<lastGameTime))resetMatch();
      if(id)matchId=id;lastGameTime=t;snapshot=live;lastLive=Date.now();status='Đang đọc trận';
       if(POLICY.visibleSession==='READ_ONLY')observeBuilds();
      if(targetItem&&engine.consumed(targetItem,new Set((engine.findSelf(live)?.items||[]).map(i=>String(i.itemID))),data))targetItem='';
   }else if(readLive||runtime.state==='POSTGAME'){
      runtime.dispatch('LIVE_FAIL');
      status=client?.phase==='ChampSelect'?'Đang chọn tướng':client?'Đã kết nối client · chờ trận':'Chưa thấy client';
      if(snapshot&&(runtime.state==='POSTGAME'||Date.now()-lastLive>8000)){snapshot=null;offered=[];if(pendingCatalog){activateCatalog(pendingCatalog);pendingCatalog=null;}}
      if(client&&['Lobby','ChampSelect','None'].includes(client.phase)&&matchId){resetMatch();matchId=null;lastGameTime=-1;}
   }
   const liveVersion=client?.version?.match(/^\d+\.\d+/)?.[0];
   versionWarning=liveVersion&&liveVersion!==data.patch?'Dữ liệu '+data.patch+' khác client '+liveVersion+'. Điểm và build có thể đã cũ.':!liveVersion?'Chưa xác minh phiên bản client. Dữ liệu tham khảo '+data.patch+'.':'';
   broadcast();maybeRefreshBuild();maybeRefreshRosterAugments();syncBuildHistory();
 }catch{status='Kết nối tạm gián đoạn';broadcast();}finally{polling=false;schedulePoll();}
}
function maybeAutoScan(){
 if(!liveAdviceEnabled)return;
 if(rerolls.pending||displaySetupOpen||!settings.autoScan||!settings.overlayEnabled||mode!=='live'||!snapshot||!gameFocused||ocr.busy||ocr.watching||Date.now()-lastLive>4000)return;
 if(snapshot.gameData?.gameMode!=='KIWI'&&client?.queueId!==2400)return;
 const self=engine.findSelf(snapshot);
 if(!self)return;
 const oldGate=autoScanState.gate;
 const attempt=shouldAutoScan(autoScanState,{level:self.level,gameTime:snapshot.gameData?.gameTime||0,isDead:self.isDead,focused:gameFocused,busy:ocr.busy,now:Date.now()});
 if(oldGate!==autoScanState.gate){offered=[];scan.matches=[];pendingChoice=null;bufferedClick=null;monitorState={suspected:0,rescans:0,observing:false,allChanged:false};ocr.reset();broadcast();}
 if(attempt)runScan(false,false,true);
}
async function maybeWatchCards(){
 if(!liveAdviceEnabled)return;
 if(rerolls.pending||!settings.overlayEnabled||mode!=='live'||!snapshot||!gameFocused||!offered.some(Boolean)||!scan.scannedAt||ocr.busy||monitorState.observing)return;
 if(Date.now()-scan.scannedAt>90000){offered=[];scan.matches=[];pendingChoice=null;bufferedClick=null;scan.status='Bộ thẻ đã hết thời gian hiển thị; F8 để đọc lại nếu vẫn đang chọn.';broadcast();return;}
 monitorState.observing=true;
 const observedAt=scan.scannedAt;
 try{
   const differences=await ocr.observe(effectiveRegions());
   if(rerolls.pending||!offered.some(Boolean)||scan.scannedAt!==observedAt||!gameFocused)return;
   if(!differences||!cardChange(monitorState,differences))return;
   monitorState.suspected=0;monitorState.rescans++;monitorState.allChanged=differences.every(d=>d>=.12);
   offered=[];scan.matches=[];scan.scannedAt=0;scan.status='Thẻ lõi đã thay đổi · đang đọc lại…';autoScanState.complete=false;broadcast();
   if(monitorState.rescans<=6)runScan(false,true,false,true);
   else{scan.status='Thẻ lõi thay đổi nhiều lần; nhấn F8 để đọc lại.';broadcast();}
 }catch{}finally{monitorState.observing=false;}
}
function scanTick(){if(app.isQuitting)return;maybeAutoScan();maybeWatchCards();scanTimer=setTimeout(scanTick,snapshot&&gameFocused?2500:10000);}
function pumpReroll(){if(app.isQuitting)return;maybeReadReroll();if(rerolls.pending)rerollTimer=setTimeout(pumpReroll,200);}
function maybeReadReroll(){
 if(!liveAdviceEnabled)return;
 const ticket=rerolls.take(Date.now(),{busy:ocr?.busy||ocr?.watching,focused:gameFocused,enabled:settings.autoReroll&&settings.overlayEnabled&&mode==='live'&&!!snapshot});
 if(!ticket)return;
 if(ticket.expired){scan.status='Lượt tự đọc sau nhấp xoay đã hết hạn. F8 để đọc khi thẻ hiện rõ.';broadcast();return;}
 runScan(false,true,false,false,ticket);
}
async function runScan(enemy=false,force=false,auto=false,observedChange=false,rerollTicket=null){
 if(!ownOcrEnabled){scan.status='DISABLED_UNTIL_APPROVED';broadcast();return;}
 if(app.isQuitting||runtime.state==='SUSPENDED')return;
 if(mode==='demo'){message='Chế độ minh họa không chụp game. Chuyển sang trận thật để quét.';broadcast();return;}
 scan.feedbackAt=Date.now();
 if(ocr.busy||ocr.watching){scan.status='Đã nhận phím quét; đang xử lý ảnh trước đó.';broadcast();return;}
 // Do not leave the previous cards marked as current while a rescan is in flight.
 const startEpoch=epoch,startRevision=scanRevision;let completedOffers=null;
 const scanStart=Date.now();bufferedClick=null;
 if(!enemy&&!auto){offered=[];if(!observedChange)pendingChoice=null;}
 scan.status=rerollTicket?'Đã nhận nhấp xoay · đang đọc bộ mới…':enemy?'Đang đọc lõi trên giao diện…':observedChange?'Đang cập nhật sau khi xoay/chọn lõi…':auto?'Tự đọc ba thẻ khi tới mốc lõi…':'Đang đọc ba thẻ…';broadcast();
 try{
   const result=await ocr.scan(data.augments,effectiveRegions(),{force,enemy,quick:auto||observedChange,fresh:!!rerollTicket||rerolls.pending});
   if(epoch!==startEpoch||scanRevision!==startRevision||mode!=='live')return;
   if(result.unchanged){offered=scan.matches.map(r=>r.id||null);scan.scannedAt=Date.now();scan.status='Ảnh vùng lõi chưa đổi';return;}
   if(result.busy)return;
   if(enemy){scan.enemyCandidates=result.found;scan.enemyScannedAt=result.scannedAt;scan.status=result.found.length?'Đã đọc '+result.found.length+' tên lõi. Mở bảng điều khiển để xác nhận chủ sở hữu.':'Không đọc được tên lõi trên ảnh. Chọn Kiểm tra Tab để kiểm tra khả năng hiển thị; dữ liệu trận chưa cung cấp lõi địch.';}
   else{
     completedOffers=result.offers;offered=result.offers;scan.matches=result.matches;scan.scannedAt=result.scannedAt;
     const count=result.offers.filter(Boolean).length;
     if(bufferedClick&&bufferedClick.clickedAt>=scanStart&&result.offers[bufferedClick.index])pendingChoice={id:result.offers[bufferedClick.index],index:bufferedClick.index,clickedAt:bufferedClick.clickedAt};
     bufferedClick=null;
     scan.status=count?`Đọc được ${count}/3 thẻ${auto?' · tự quét':''}. Tự ghi nhận khi chọn; Ctrl + Shift + 1–3 là dự phòng.`:observedChange?'Thẻ lõi đã đóng hoặc chưa đọc được bộ mới.':'Không nhận ra tên lõi. Ctrl + Shift + C để nhập/sửa ba thẻ.';
     if(!count&&auto)scan.status=`Đang chờ thẻ lõi hiện rõ · thử ${autoScanState.attempts}/24.`;
     if(count===3){
       const self=engine.findSelf(snapshot);
       autoScanState.gate=augmentGate(self?.level||0,snapshot?.gameData?.gameTime||0);autoScanState.complete=true;
      }
     if(observedChange){
       if(shouldConfirmChoice(pendingChoice,count,monitorState.allChanged,Date.now()))confirmOwned(pendingChoice.id);
       else if(count===0&&monitorState.allChanged){autoScanState.complete=false;autoScanState.attempts=0;autoScanState.nextAt=Date.now()+1500;}
       pendingChoice=null;
     }
   }
 }catch(e){if(startRevision===scanRevision){scan.status=e.message||'Nhận diện chưa thành công.';scan.matches=[];offered=[];bufferedClick=null;}}
 finally{if(rerollTicket){const done=rerolls.finish(rerollTicket,completedOffers,Date.now());if(done==='exhausted')scan.status='Chưa đọc đủ sau khi xoay. F8 để thử lại hoặc chỉnh vùng nút xoay trong Thiết lập.';}broadcast();}
}
function activateCatalog(fresh){
 if(data?.patch!==fresh.patch){referenceCache.clear();augmentReferenceCache.clear();augmentReferenceVerified.clear();augmentReferenceFailures.clear();augmentReferenceErrors.clear();ocr?.reset();}
 advanced?.catalogChanged(fresh).catch(e=>{message='Patch analysis: '+e.message;});data=fresh;assessmentCache.clear();buildCache=null;if(community?.patch!==fresh.patch)community=null;
}
async function update(force=false){
 if(settings.localOnly){message='Chỉ dùng cache: cập nhật mạng đang tắt.';broadcast();return;}
 if(updating||app.isQuitting||(!force&&Date.now()<updateNextAt))return;
 updating=true;message='Đang kiểm tra dữ liệu mới…';broadcast();
 try{const target=client?.version?.match(/^\d+\.\d+/)?.[0];const fresh=await updateData(userDir,target,m=>{message=m;broadcast();});
   if(app.isQuitting)return;
   dataSnapshots=await catalogStore.entries();updateFailures=0;updateNextAt=Date.now()+6*3600000;
   if(releaseBusy()&&mode==='live'){pendingCatalog=fresh;message=`Đã tải ${fresh.augments.length} lõi mới; áp dụng sau trận để không đổi dữ liệu giữa lượt quét.`;}
   else{activateCatalog(fresh);message=`Đã cập nhật ${fresh.augments.length} lõi, ${Object.keys(fresh.champions).length} tướng (bản ${fresh.patch}).`;
     maybeRefreshRosterAugments();refreshCommunity();}
 }
 catch(e){updateNextAt=Date.now()+Math.min(1800000,30000*2**Math.min(updateFailures++,6));message='Giữ dữ liệu đã có. '+e.message;}finally{updating=false;broadcast();}
}
function validAugment(id){return typeof id==='string'&&data.augments.some(a=>a.id===id);}
function confirmOwned(id){
 if(!validAugment(id)){scan.status='Chưa có tên lõi ở vị trí này. Mở bảng bằng Ctrl + Shift + C để nhập thủ công.';scan.feedbackAt=Date.now();broadcast();return;}
 rerolls.clear();scanRevision++;
 if(!owned.includes(id)){epoch++;owned.push(id);offered=[];ocr.reset();autoScanState.complete=true;}
 pendingChoice=null;
 bufferedClick=null;
 scan.status='Đã ghi nhận: '+data.augments.find(a=>a.id===id).name+'. Lõi trong game vẫn do bạn tự chọn.';
 scan.feedbackAt=Date.now();broadcast();
}
function confirmOffer(index){confirmOwned(offered[index]);}
async function advancedCommand(payload={}){
 const {action,input={}}=payload;
 if(action==='sync-sources'&&settings.localOnly)return advanced.sources.status;
 if(action==='profile'){const r=await advanced.request(action,input);settings.localOnly=input.localOnly===true;await saveSettings();return r;}
 if(action==='pin'){
  if(releaseBusy())throw Error('Chỉ thay tham khảo tĩnh ngoài trận.');
  const b=require('../core/build-lab.cjs').validateBuild(input,data);
  settings.staticReference={...b,championName:data.champions[b.champion].name,icon:data.champions[b.champion].icon,itemDetails:b.items.map(id=>({id,name:data.items[id].name,icon:data.items[id].icon})),augmentDetails:b.augments.map(id=>{const a=data.augments.find(a=>a.id===id);return {id,name:a.name};})};await saveSettings();broadcast();return true;
 }
 if(action==='open-link'){await shell.openExternal(require('../core/intelligence.cjs').validateLink(input.url));return true;}
 if(action==='export-layout'){
  const chosen=await dialog.showSaveDialog(main,{defaultPath:'DVM-layout.json',filters:[{name:'JSON',extensions:['json']}]});if(!chosen.canceled)await fs.writeFile(chosen.filePath,JSON.stringify({schema:1,overlay:overlayLayout.sanitizeOverlay(settings),side:settings.overlaySide,display:settings.display},null,2),'utf8');return !chosen.canceled;
 }
 if(action==='import-layout'){
  const chosen=await dialog.showOpenDialog(main,{properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(chosen.canceled)return false;const file=chosen.filePaths[0];if((await fs.stat(file)).size>64000)throw Error('Layout quá lớn.');const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.schema!==1)throw Error('Layout sai phiên bản.');Object.assign(settings,overlayLayout.sanitizeOverlay(value.overlay));settings.overlaySide=value.side==='left'?'left':'right';settings.display=displayLayout.sanitizeDisplay(value.display);await saveSettings();positionOverlay();broadcast();return true;
 }
 if(action==='export-report'){const b=require('../core/build-lab.cjs').validateBuild(input,data);const chosen=await dialog.showSaveDialog(main,{defaultPath:'DVM-review.html',filters:[{name:'HTML',extensions:['html']}]});if(!chosen.canceled)await fs.writeFile(chosen.filePath,require('../core/report.cjs').buildReport(b,data,appVersion),'utf8');return !chosen.canceled;}
 if(action==='export-file'){
  const json=await advanced.request('export');const chosen=await dialog.showSaveDialog(main,{defaultPath:'DVM-builds.json',filters:[{name:'JSON',extensions:['json']}]});if(!chosen.canceled)await fs.writeFile(chosen.filePath,JSON.stringify(json,null,2),'utf8');return !chosen.canceled;
 }
 if(action==='import-file'){
  const chosen=await dialog.showOpenDialog(main,{properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(chosen.canceled)return null;
  const stat=await fs.stat(chosen.filePaths[0]);if(stat.size>2000000)throw Error('Tệp lớn hơn 2 MB.');return advanced.request('import',JSON.parse(await fs.readFile(chosen.filePaths[0],'utf8')));
 }
 if(action==='export-image'){
  const chosen=await dialog.showSaveDialog(main,{defaultPath:'DVM-build.png',filters:[{name:'PNG',extensions:['png']}]});if(!chosen.canceled)await fs.writeFile(chosen.filePath,(await main.webContents.capturePage()).toPNG());return !chosen.canceled;
 }
 return advanced.request(action,input);
}
async function command(type,payload){
 assertCommand(type);
 if(type==='advanced'){return advancedCommand(payload);}
 switch(type){
  case 'demo':runtime.dispatch(payload?'DEMO':'RESUME');mode=payload?'demo':'live';resetMatch();snapshot=payload?demo(data,'Evelynn'):null;lastLive=payload?Date.now():0;client=payload?{phase:'InProgress',queueId:2400,version:data.version}:null;status=payload?'Dữ liệu minh họa':'Đang kết nối';if(payload){owned=['ARAM_WitchfulThinking'];offered=['ARAM_ThreadtheNeedle','ARAM_Marksmage','ARAM_Deft'];}else poll();break;
  case 'settings':{
    if(payload?.rerollRegions){if(!validRegions(payload.rerollRegions))throw Error('Vùng nút xoay phải nằm trong khung game, mỗi kích thước ít nhất 0,015.');rerolls.clear();scanRevision++;settings.rerollRegions=payload.rerollRegions;settings.rerollRegionsManual=true;}
    if(typeof payload?.autoReroll==='boolean'){settings.autoReroll=payload.autoReroll;if(!payload.autoReroll)rerolls.clear();}
    if(typeof payload?.learnBuilds==='boolean')settings.learnBuilds=payload.learnBuilds;
    if(typeof payload?.useHistory==='boolean')settings.useHistory=payload.useHistory;
    if(typeof payload?.autoScan==='boolean')settings.autoScan=payload.autoScan;
    if(typeof payload?.overlayEnabled==='boolean')settings.overlayEnabled=payload.overlayEnabled;
    if(typeof payload?.cardTiersEnabled==='boolean')settings.cardTiersEnabled=payload.cardTiersEnabled;
    if(payload?.role==='auto'||engine.roles[payload?.role])settings.role=payload.role;
    if(FOCUSES[payload?.buildFocus])settings.buildFocus=payload.buildFocus;
    const merged={...settings,...payload};for(const key of Object.keys(overlayLayout.sanitizeOverlay()))if(Object.hasOwn(payload||{},key))settings[key]=overlayLayout.sanitizeOverlay(merged)[key];
    if(['left','right'].includes(payload?.overlaySide))settings.overlaySide=payload.overlaySide;
    if(payload?.manualChampion===''||data.champions[payload?.manualChampion])settings.manualChampion=payload.manualChampion;
    if(Array.isArray(payload?.regions)&&payload.regions.length===3&&payload.regions.every(r=>['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>=.02&&r.h>=.02&&r.x+r.w<=1&&r.y+r.h<=1)){epoch++;settings.regions=payload.regions;settings.regionsManual=true;offered=[];scan.matches=[];scan.scannedAt=0;autoScanState.complete=false;autoScanState.attempts=0;ocr.reset();}
    await saveSettings();break;
  }
  case 'display-open':displaySetupOpen=true;main?.show();break;
  case 'display-save':rerolls.clear();scanRevision++;epoch++;settings.display=displayLayout.sanitizeDisplay(payload);settings.displaySetupVersion=1;displaySetupOpen=false;offered=[];scan.matches=[];scan.scannedAt=0;ocr.reset();autoScanState.complete=false;autoScanState.attempts=0;autoScanState.nextAt=0;positionOverlay();fitMain();await saveSettings();break;
  case 'regions-reset':epoch++;offered=[];scan.matches=[];scan.scannedAt=0;autoScanState.complete=false;autoScanState.attempts=0;settings.regions=defaults.regions;settings.regionsManual=false;ocr.reset();await saveSettings();break;
  case 'reroll-regions-reset':rerolls.clear();scanRevision++;settings.rerollRegions=REROLL_REGIONS;settings.rerollRegionsManual=false;await saveSettings();break;
  case 'scan':runScan(false,true);break;
  case 'scan-enemy':runScan(true,true);break;
  case 'inspect-tab':diagnostic.armed=!diagnostic.armed;diagnostic.status=diagnostic.armed?'Quay lại game rồi giữ Tab khoảng 2 giây. Chỉ chụp một lần.':'Đã hủy chụp Tab.';break;
  case 'open-diagnostic':if(diagnostic.path)await shell.showItemInFolder(diagnostic.path);break;
  case 'overlay-cycle':settings.overlayMode=overlayLayout.nextMode(settings.overlayMode);await saveSettings();break;
  case 'overlay-interaction':settings.overlayClickThrough=!settings.overlayClickThrough;await saveSettings();break;
  case 'display-cancel':displaySetupOpen=false;break;
  case 'overlay-toggle':settings.overlayEnabled=!settings.overlayEnabled;await saveSettings();break;
  case 'target-item':if(payload===''||engine.itemValid(data.items[String(payload)],currentChampion(),snapshot?.gameData?.mapNumber||12))targetItem=String(payload);break;
  case 'owned-add':confirmOwned(payload);break;
  case 'owned-remove':owned=owned.filter(id=>id!==payload);break;
  case 'offers':if(Array.isArray(payload)&&payload.length===3&&payload.every(id=>id===null||validAugment(id))){epoch++;offered=payload;scan.status='Ba thẻ được nhập thủ công';scan.matches=payload.map(id=>({id,confidence:id?1:0,candidates:[]}));autoScanState.complete=payload.every(Boolean);}break;
  case 'enemy-confirm':{
    const found=snapshot?.allPlayers?.find(p=>engine.playerKey(p)===payload?.key);const ids=payload?.ids;
    if(found&&Array.isArray(ids)&&ids.every(validAugment)&&ids.length<=10){const old=enemyAugments[payload.key]?.ids||[];enemyAugments[payload.key]={ids:[...new Set([...old,...ids])],observedAt:Date.now(),source:'Người dùng xác nhận từ giao diện'};scan.enemyCandidates=[];observeBuilds(true);}break;
  }
  case 'enemy-clear':if(typeof payload==='string'){enemyAugments[payload]={ids:[],observedAt:Date.now(),source:'Người dùng xóa quan sát'};observeBuilds(true);}break;
  case 'history-clear':history={...learning.newHistory(),syncedMatches:history.syncedMatches,clearedAt:Date.now()};await historyStore.save(history);break;
  case 'history-delete':{const r=history.records.find(r=>r.id===payload);if(r)history.deletedIds=[...new Set([...history.deletedIds,r.id,r.matchRecordId].filter(Boolean))].slice(-3000);history.savedAt=Date.now();history.records=history.records.filter(r=>r.id!==payload);await historyStore.save(history);break;}
  case 'history-folder':await shell.showItemInFolder(historyStore.file);break;
  case 'history-backup':{const saved=await historyStore.backup();message='Đã sao lưu lịch sử: '+path.basename(saved);break;}
  case 'planner-save':settings.planner=sanitizeDraft(payload,data);await saveSettings();break;
  case 'planner-current':settings.planner=sanitizeDraft({champion:currentChampion(),ids:owned},data);await saveSettings();break;
  case 'catalog-rollback':if(snapshot&&mode==='live')throw Error('Khôi phục dữ liệu sau khi trận kết thúc.');activateCatalog(await catalogStore.rollback(data.patch));dataSnapshots=await catalogStore.entries();message='Đã khôi phục danh mục trước; đang kiểm tra lại combo.';refreshCommunity();break;
  case 'history-tiers':if(Array.isArray(payload)){historyTierChampions=[...new Set(payload.filter(id=>typeof id==='string'&&data.champions[id]))].slice(0,24);maybeRefreshRosterAugments();}break;
  case 'app-update-check':await applicationUpdates?.check(true);break;
  case 'app-update-install':await applicationUpdates?.install();break;
  case 'privacy':await dialog.showMessageBox(main,{type:'info',title:'Quyền riêng tư — DVM Nightveil',message:'Chính sách quyền riêng tư',detail:await fs.readFile(path.join(__dirname,'..','PRIVACY.md'),'utf8')});break;
  case 'crash-diagnostics':await shell.openPath(path.join(userDir,'crash-diagnostics'));break;
  case 'update':update(true);break;
  case 'folder':{
    const result=await dialog.showOpenDialog(main,{title:'Chọn thư mục League of Legends có tệp lockfile',properties:['openDirectory']});
    if(!result.canceled){settings.gameDirectory=result.filePaths[0];reader.extraDirectory=settings.gameDirectory;reader.credentials=null;reader.lastDiscovery=0;await saveSettings();poll();}break;
  }
  case 'main':main?.show();break;
  case 'minimize':main?.minimize();break;
  case 'overlay-reset':settings.overlaySide='right';positionOverlay();await saveSettings();break;
  case 'overlay-side':settings.overlaySide=settings.overlaySide==='left'?'right':'left';positionOverlay();await saveSettings();break;
  case 'open-recommendation-source':if(require('../core/source-links.cjs').isRecommendationSource(payload))await shell.openExternal(payload);break;
  case 'source':{const allowed=['https://developer.riotgames.com/docs/lol','https://www.communitydragon.org/'];if(allowed.includes(payload))await shell.openExternal(payload);break;}
  case 'open-build-source':{const ref=referenceCache.get(currentChampion());if(ref?.url?.startsWith('https://op.gg/lol/modes/aram-mayhem/'))await shell.openExternal(ref.url);break;}
  case 'open-augment-source':{const ref=augmentReferenceCache.get(currentChampion());if(ref?.url?.startsWith('https://op.gg/lol/modes/aram-mayhem/'))await shell.openExternal(ref.url);break;}
  case 'open-community':if(payload==='https://arammayhem.com/data/'||community?.combos.some(c=>c.url===payload))await shell.openExternal(payload);break;
  default:throw new Error('Lệnh không hợp lệ');
 }
 broadcast();return {ok:true};
}
function windowOptions(){return {icon:path.join(__dirname,'..','dist','nightveil.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:true},backgroundColor:'#0b1019',autoHideMenuBar:true};}
const hotkeyTimes={};
function handleGameClick(x,y){
 if(!liveAdviceEnabled)return;
 // Native helper observes global clicks; UI clicks must never confirm a card.
 const point=screen.screenToDipPoint?.({x,y});
 if(point&&[controlOverlay,settings.overlayClickThrough===false?overlay:null].some(w=>{
  if(!w||w.isDestroyed()||!w.isVisible())return false;
  const b=w.getBounds();return point.x>=b.x&&point.x<b.x+b.width&&point.y>=b.y&&point.y<b.y+b.height;
 }))return;
 if(!gameFocused||!gameClientRect)return;
 const hasOffer=offered.some(Boolean);
 const recentCards=(hasOffer&&scan.scannedAt&&Date.now()-scan.scannedAt<90000)||rerolls.pending||(ocr.busy&&Date.now()-(scan.feedbackAt||0)<20000);
 if(settings.autoReroll&&settings.overlayEnabled&&mode==='live'&&recentCards&&(snapshot?.gameData?.gameMode==='KIWI'||client?.queueId===2400)){
  const index=clickedReroll(x,y,gamePhysicalRect,effectiveRerollRegions());
  if(index>=0){
   scanRevision++;rerolls.request(index,Date.now());clearTimeout(rerollTimer);rerollTimer=setTimeout(pumpReroll,180);pendingChoice=null;bufferedClick=null;
   offered=Array.from({length:3},(_,i)=>i===index?null:offered[i]||null);
   scan.matches=Array.from({length:3},(_,i)=>i===index?{id:null}:scan.matches[i]||{id:null});
   scan.rerollAt=Date.now();scan.rerollIndex=index;scan.status=`Đã nhận nhấp nút xoay thẻ ${index+1} · chờ thẻ mới…`;
   autoScanState.complete=false;broadcast();return;
  }
 }
 const card=clickedCard(x,y,gamePhysicalRect,effectiveRegions(),hasOffer?offered:[true,true,true]);
 if(!card)return;
 if(hasOffer&&scan.scannedAt&&Date.now()-scan.scannedAt<90000&&!pendingChoice)pendingChoice={...card,clickedAt:Date.now()};
 else if(!hasOffer&&ocr.busy&&Date.now()-(scan.feedbackAt||0)<60000&&!bufferedClick)bufferedClick={index:card.index,clickedAt:Date.now()};
}
function handleHotkey(name){
 if(!ownOcrEnabled&&(/SCAN|OWN_|TAB_READY/.test(name)))return;
 if(name==='TAB_DOWN'||name==='TAB_UP'){tabHeld=name==='TAB_DOWN';broadcast();return;}
 if(name==='TAB_READY'){inspectTab();return;}
 const now=Date.now();if(now-(hotkeyTimes[name]||0)<650)return;hotkeyTimes[name]=now;
 scan.lastHotkey=name;scan.feedbackAt=now;
 if(name==='SCAN_SELF'||name==='SCAN_SELF_CHORD')runScan(false,true);
 else if(name==='SCAN_ENEMY_CHORD'){scan.status='Lõi đối thủ không hiển thị trong Tab/API; không thể quét dữ liệu chưa nhìn thấy.';broadcast();}
 else if(name.startsWith('OWN_'))confirmOffer(Number(name.at(-1))-1);
 else if(name==='OVERLAY'){settings.overlayEnabled=!settings.overlayEnabled;saveSettings();broadcast();}
 else if(name==='CYCLE'){command('overlay-cycle').catch(()=>{});}
 else if(name==='INTERACT'){command('overlay-interaction').catch(()=>{});}
 else if(name==='SIDE'){settings.overlaySide=settings.overlaySide==='left'?'right':'left';positionOverlay();saveSettings();broadcast();}
 else if(name==='MAIN')main?.show();
}
async function startHotkeyHelper(){
 if(app.isQuitting)return;const helperStarted=Date.now();
 try{
  const script=path.join(userDir,'hotkeys.ps1');
  await fs.copyFile(path.join(__dirname,'hotkeys.ps1'),script);
  hotkeyHelper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-ParentProcessId',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let pending='';
  hotkeyHelper.stdout.setEncoding('utf8');
  hotkeyHelper.stdout.on('data',chunk=>{pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trim();pending=pending.slice(end+1);if(line==='READY'){hotkeyListener='Sẵn sàng';broadcast();}else if(line==='GAME_FOCUS'){if(!gameFocused){gameFocused=true;runtime.dispatch('FOCUS',true);schedulePoll();broadcast();}}else if(line==='GAME_BLUR'){gameFocused=false;runtime.dispatch('FOCUS',false);tabHeld=false;gameClientRect=null;gamePhysicalRect=null;gameOuterRect=null;broadcast();}else if(line.startsWith('GAME_RECT ')){const values=line.slice(10).split(' ').map(Number);if(values.length===4&&values.every(Number.isFinite)&&values[2]>200&&values[3]>200){gamePhysicalRect={x:values[0],y:values[1],width:values[2],height:values[3]};gameClientRect=screen.screenToDipRect(null,gamePhysicalRect);if(!gameFocused){runtime.dispatch('FOCUS',true);schedulePoll();clearTimeout(scanTimer);if(ownOcrEnabled)scanTimer=setTimeout(scanTick,0);}gameFocused=true;broadcast();}}else if(line.startsWith('GAME_WINDOW ')){const v=line.slice(12).split(' ').map(Number);if(v.length===4&&v.every(Number.isFinite)&&v[2]>200&&v[3]>200)gameOuterRect={x:v[0],y:v[1],width:v[2],height:v[3]};}else if(line.startsWith('CLIENT_RECT ')){const v=line.slice(12).split(' ').map(Number);if(v.length===4&&v.every(Number.isFinite)&&v[2]>200&&v[3]>200)leagueClientRect=screen.screenToDipRect(null,{x:v[0],y:v[1],width:v[2],height:v[3]});}else if(line.startsWith('GAME_CLICK ')){const values=line.slice(11).split(' ').map(Number);if(values.length===2&&values.every(Number.isFinite))handleGameClick(values[0],values[1]);}else if(line)handleHotkey(line);}});
  hotkeyHelper.stderr.setEncoding('utf8');
  hotkeyHelper.stderr.on('data',chunk=>{hotkeyListener='Lỗi bộ nghe phím: '+chunk.trim().slice(0,120);broadcast();});
  hotkeyHelper.on('error',()=>{hotkeyListener='Không khởi động được';broadcast();});
  hotkeyHelper.on('close',()=>{if(Date.now()-helperStarted>60000)helperRestarts=0;gameFocused=false;gameClientRect=null;if(!app.isQuitting){hotkeyListener='Đang nối lại bộ nghe phím';broadcast();clearTimeout(helperRestartTimer);helperRestartTimer=setTimeout(startHotkeyHelper,Math.min(30000,1000*2**Math.min(helperRestarts++,5)));}});
 }catch(e){hotkeyListener='Không khởi động được: '+e.message;broadcast();}
}
async function boot(){
 userDir=app.getPath('userData');await fs.mkdir(userDir,{recursive:true});
 if(path.basename(userDir)==='dvm-nightveil')await importLegacyNightveil(path.join(app.getPath('appData'),'mayhem-companion'),userDir);
 diagnostics=new releaseRuntime.Diagnostics(path.join(userDir,'crash-diagnostics'),appVersion);
 const recoveryMode=await diagnostics.start();
 settings=await releaseRuntime.loadSettings(userDir,defaults);
 historyStore=new HistoryStore(userDir);history=await historyStore.load();
 settings.role='auto';Object.assign(settings,overlayLayout.sanitizeOverlay(settings));
 settings.display=displayLayout.sanitizeDisplay(settings.display);
 if(!validRegions(settings.rerollRegions)){settings.rerollRegions=REROLL_REGIONS;settings.rerollRegionsManual=false;}
 displaySetupOpen=!process.argv.includes('--background')&&(settings.displaySetupVersion!==1||settings.display.showOnStartup);
 if(settings.regionsManual===undefined)settings.regionsManual=JSON.stringify(settings.regions)!==JSON.stringify(defaults.regions);
 if(settings.inputSafetyVersion!==2){settings.autoScan=false;settings.inputSafetyVersion=2;delete settings.overlayInteractive;await saveSettings();}
 if(settings.autoScanVersion!==1){settings.autoScan=true;settings.autoScanVersion=1;await saveSettings();}
 if(settings.liveFeatureVersion!==1){settings.autoScan=true;settings.autoReroll=true;settings.cardTiersEnabled=true;settings.liveFeatureVersion=1;await saveSettings();}
 if(recoveryMode){settings.autoScan=false;settings.overlayEnabled=false;message='Đã mở chế độ phục hồi sau nhiều lần thoát bất thường; tự quét và overlay đang tạm tắt.';}
 catalogStore=new CatalogStore(userDir);data=await catalogStore.load(require('../data/catalog.json'));dataSnapshots=await catalogStore.entries();
 advanced=new AdvancedService(historyStore);await advanced.initialize(data);
 // Respect each user's saved scan and tier preferences. Scanning captures only
 // visible game pixels and never sends input to the game.
 settings.planner=sanitizeDraft(settings.planner,data);if(!FOCUSES[settings.buildFocus])settings.buildFocus='auto';
 try{const saved=JSON.parse(await fs.readFile(path.join(userDir,'augment-references.json'),'utf8'));for(const [champ,ref] of Object.entries(saved)){if(ref?.patch===data.patch&&ref?.champion===champ&&Object.keys(ref.ranks||{}).length>=20)augmentReferenceCache.set(champ,ref);}}catch{}
 try{const saved=JSON.parse(await fs.readFile(path.join(userDir,'build-references.json'),'utf8'));for(const [champ,ref] of Object.entries(saved)){if(ref?.patch===data.patch&&ref?.champion===champ&&Array.isArray(ref.builds))referenceCache.set(champ,ref);}}catch{}
 try{const saved=JSON.parse(await fs.readFile(path.join(userDir,'community.json'),'utf8'));if(saved?.schema===2&&saved?.patch===data.patch&&Array.isArray(saved.combos)&&saved.releaseId)community=saved;}catch{}
 if(!community){try{const bundled=require('../data/community.json');if(bundled.schema===2&&bundled.patch===data.patch)community=bundled;}catch{}}
 ocrDir=path.join(__dirname,'..','data');reader=new LeagueReader();reader.extraDirectory=settings.gameDirectory;
 historySync=new MatchHistorySync(reader);
 ocr=new OcrReader(ocrDir,m=>{scan.status=m;broadcast();},()=>({thumbnailSize:displayLayout.captureSize(gameOuterRect||currentGameSize()),client:gamePhysicalRect,outer:gameOuterRect}));
 main=new BrowserWindow({...windowOptions(),width:1240,height:850,minWidth:860,minHeight:620,show:false,title:brand.name});
 fitMain();
 const area=selectedDisplay().workArea;
 overlay=new BrowserWindow({...windowOptions(),width:378,height:Math.min(940,area.height-40),x:area.x+area.width-398,y:area.y+20,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,show:false,resizable:false,focusable:false,title:'DVM Nightveil · Overlay'});
 overlay.setAlwaysOnTop(true,'screen-saver');overlay.setIgnoreMouseEvents(true);positionOverlay();
 badgeOverlay=new BrowserWindow({...windowOptions(),width:500,height:58,x:area.x+100,y:area.y+100,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,show:false,resizable:false,focusable:false,title:'DVM Nightveil · Tier'});
 badgeOverlay.setAlwaysOnTop(true,'screen-saver');badgeOverlay.setIgnoreMouseEvents(true);
 controlOverlay=new BrowserWindow({...windowOptions(),width:112,height:34,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,show:false,resizable:false,focusable:false,title:'DVM Nightveil · Ẩn / Hiện'});
 controlOverlay.setAlwaysOnTop(true,'screen-saver');
 for(const win of [main,overlay,badgeOverlay,controlOverlay]){win.webContents.on('render-process-gone',(_e,d)=>diagnostics.record('renderer-gone',d));win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());}
 const trusted=event=>[main,overlay,badgeOverlay,controlOverlay].some(w=>w&&!w.isDestroyed()&&event.sender===w.webContents&&event.senderFrame===w.webContents.mainFrame)&&event.senderFrame.url.split('?')[0]===require('node:url').pathToFileURL(path.join(__dirname,'..','dist','index.html')).href;
 ipcMain.handle('state:get',event=>{if(!trusted(event))throw Error('IPC không được phép.');return event.sender===controlOverlay?.webContents?{settings,diagnostic,overlayUX}:getState({overlayOnly:event.sender===overlay?.webContents||event.sender===badgeOverlay?.webContents});});
 ipcMain.handle('command',(event,{type,payload}={})=>{if(!trusted(event))throw Error('IPC không được phép.');if(event.sender!==main.webContents&&type==='settings'){if(!payload||Object.keys(payload).some(k=>k!=='overlayMode')||!['mini','compact','expanded'].includes(payload.overlayMode))throw Error('Cấu hình chỉ có ở bảng chính.');return command(type,payload);}if(event.sender!==main.webContents&&!['overlay-toggle','overlay-cycle','overlay-interaction','overlay-side','main','scan','scan-enemy','owned-add','target-item'].includes(type))throw Error('Lệnh chỉ có ở bảng chính.');return command(type,payload);});
 await main.loadFile(path.join(__dirname,'..','dist','index.html'));
 await overlay.loadFile(path.join(__dirname,'..','dist','index.html'),{query:{overlay:'1'}});
 await badgeOverlay.loadFile(path.join(__dirname,'..','dist','index.html'),{query:{badges:'1'}});
 await controlOverlay.loadFile(path.join(__dirname,'..','dist','index.html'),{query:{control:'1'}});
 main.on('show',()=>{if(!main.isDestroyed())main.webContents.send('state:changed',getState());});
 main.on('closed',()=>{main=null;app.quit();});
 const keys=[['CommandOrControl+Shift+A','SCAN_SELF_CHORD'],['F8','SCAN_SELF'],['CommandOrControl+Shift+1','OWN_1'],['CommandOrControl+Shift+2','OWN_2'],['CommandOrControl+Shift+3','OWN_3'],['CommandOrControl+Shift+O','OVERLAY'],['CommandOrControl+Shift+E','SCAN_ENEMY_CHORD'],['CommandOrControl+Shift+M','SIDE'],['CommandOrControl+Shift+C','MAIN'],['CommandOrControl+Shift+Space','CYCLE'],['CommandOrControl+Shift+I','INTERACT']];
 const activeKeys=ownOcrEnabled?keys:keys.filter(([,name])=>['OVERLAY','SIDE','MAIN','CYCLE','INTERACT'].includes(name));
 hotkeyFailures=activeKeys.filter(([key,name])=>!globalShortcut.register(key,()=>handleHotkey(name))).map(([key])=>key);if(hotkeyFailures.length)message='Một số phím tắt đang được ứng dụng khác sử dụng. Chi tiết trong Thiết lập; bộ nghe phím trong game vẫn hoạt động khi sẵn sàng.';
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{clearTimeout(displayChangeTimer);displayChangeTimer=setTimeout(()=>{if(app.isQuitting)return;if(gamePhysicalRect)gameClientRect=screen.screenToDipRect(null,gamePhysicalRect);positionOverlay();fitMain();broadcast();},80);});
 await startHotkeyHelper();
 powerMonitor?.on('suspend',()=>{epoch++;runtime.dispatch('SUSPEND');clearTimeout(pollTimer);reader.close?.();broadcast();});
 powerMonitor?.on('resume',()=>{epoch++;runtime.dispatch('RESUME');reader.invalidate?.();poll();});
 let feedVerified=false;if(app.isPackaged&&releaseConfig.updatesEnabled){try{feedVerified=releaseRuntime.verifiedFeed(releaseConfig,require('js-yaml').load(await fs.readFile(path.join(process.resourcesPath,'app-update.yml'),'utf8')));}catch{diagnostics.record('update-config-invalid');}}
 applicationUpdates=new releaseRuntime.ApplicationUpdates({updater:feedVerified?require('electron-updater').autoUpdater:null,enabled:feedVerified,busy:releaseBusy,changed:broadcast,backup:async()=>{await saveSettings();await historyStore.backup();await diagnostics.record('install-update');}});
 healthyTimer=setTimeout(()=>diagnostics.healthy().catch(()=>{}),60000);
 if(ownOcrEnabled)scanTimer=setTimeout(scanTick,500);
 // Reroll timer is armed only by an observed reroll click.
 updateTimer=setInterval(()=>{if(!settings.localOnly)applicationUpdates?.check();if(!settings.localOnly)advanced?.request('sync-sources').catch(()=>{});if(!snapshot&&!ocr.busy&&!ocr.watching)ocr.close().catch(()=>{});if(!snapshot&&Date.now()-new Date(data.fetchedAt).getTime()>6*3600000)update();},60000);
 await poll();broadcast();if(displaySetupOpen)main.show();else if(snapshot)main.minimize();else if(client)main.showInactive();else main.show();
 setTimeout(()=>{update();if(!settings.localOnly)applicationUpdates?.check();if(!settings.localOnly)advanced?.request('sync-sources').catch(()=>{});},3000);
 setTimeout(refreshCommunity,8000);
}
if(!app.requestSingleInstanceLock()){app.quit();}else{app.on('second-instance',()=>{if(snapshot)main?.showInactive();else{main?.show();main?.focus();}});app.whenReady().then(boot).catch(e=>{dialog.showErrorBox('Không mở được DVM Nightveil',e.message);app.quit();});}
process.on('uncaughtExceptionMonitor',()=>diagnostics?.record('uncaught-exception'));
app.on('child-process-gone',(_e,d)=>diagnostics?.record('child-gone',d));
app.on('before-quit',event=>{
 if(app.isQuitting)return;
 event.preventDefault();app.isQuitting=true;epoch++;
 runtime.dispatch('STOP');reader?.close?.();clearTimeout(helperRestartTimer);clearTimeout(displayChangeTimer);clearTimeout(pollTimer);clearInterval(scanTimer);clearInterval(rerollTimer);clearInterval(updateTimer);globalShortcut.unregisterAll();hotkeyHelper?.kill();
 clearTimeout(healthyTimer);const pending=Promise.allSettled([settingsWrites,historyStore?.close(),advanced?.close(),ocr?.close(),diagnostics?.close()]);
 Promise.race([pending,new Promise(resolve=>setTimeout(resolve,2500))]).finally(()=>app.quit());
});
