const {app,BrowserWindow,session,globalShortcut}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/advanced-validation');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',path.join(out,'profile-'+Date.now()));fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(path.join(app.getPath('userData'),'settings.json'),JSON.stringify({displaySetupVersion:1,display:{showOnStartup:false},localOnly:true}));
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');const cp=require('node:child_process'),spawn=cp.spawn;let helper;
cp.spawn=(exe,args,opts)=>{if(exe==='powershell.exe'){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close');helper=child;return child;}return spawn(exe,args,opts);};
const reader=require('../desktop/lcu.cjs').LeagueReader;let liveCalls=0,fakeClient=null,fakeLive=null;reader.prototype.readClient=async()=>fakeClient;reader.prototype.readLive=async()=>{liveCalls++;return fakeLive;};reader.prototype.readRecentMatches=async()=>({games:{games:[]}});
require('../desktop/ocr.cjs').OcrReader.prototype.scan=async()=>({offers:['ARAM_ThreadtheNeedle','BurstingTeeth','ARAM_Marksmage'],matches:[{id:'ARAM_ThreadtheNeedle'},{id:'BurstingTeeth'},{id:'ARAM_Marksmage'}],scannedAt:Date.now()});
require('../scripts/update-data.cjs').updateData=async()=>require('../data/catalog.json');require('../desktop/source-adapters.cjs').SourceAdapters.prototype.sync=async()=>({});
const errors=[];app.on('browser-window-created',(_,w)=>{w.webContents.on('render-process-gone',(_,d)=>errors.push(d.reason));w.webContents.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('net::ERR_'))errors.push(e.message);});});
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['https://*/*']},(_,cb)=>cb({cancel:true})));
const started=Date.now();require('../desktop/main.cjs');const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 let main;for(let i=0;i<120;i++){main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));if(main&&!main.webContents.isLoading()&&await main.webContents.executeJavaScript("!!document.querySelector('.dv-shell')"))break;await wait(100);}assert.ok(main);main.showInactive();
 const js=s=>main.webContents.executeJavaScript(s),command=(action,input={})=>js(`window.mayhem.command('advanced',${JSON.stringify({action,input})})`),click=label=>js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)})?.click()`);
 const startupMs=Date.now()-started;assert.equal(await js("document.querySelectorAll('.dv-side nav button').length"),14);
 const initial=await js('window.mayhem.getState()');assert.equal(initial.settings.liveFeatureVersion,1);assert.equal(initial.settings.autoScan,true);assert.equal(initial.settings.cardTiersEnabled,true);
 for(let i=0;i<100&&!helper;i++)await wait(100);
 assert.ok(helper);helper.stdout.write('GAME_FOCUS\n');await wait(120);
 assert.equal((await js('window.mayhem.getState()')).overlayDiagnostic.visible,true,'game focus must show overlay before client responds');
 helper.stdout.write('GAME_BLUR\n');await wait(120);
 assert.equal((await js('window.mayhem.getState()')).overlayDiagnostic.visible,false);
 await js("document.querySelectorAll('.dv-side nav button')[4].click()");await wait(200);
 assert.equal(await js("document.querySelector('select[aria-label=\"Tướng lập build\"]').value"),'');
 await js("{const select=document.querySelector('select[aria-label=\"Tướng lập build\"]');select.value='Lux';select.dispatchEvent(new Event('change',{bubbles:true}));}");await wait(200);
 await js("document.querySelectorAll('.dv-side nav button')[0].click()");
 const b={name:'Evelynn test',champion:'Evelynn',items:['3089'],augments:['ARAM_WitchfulThinking'],archetype:'ap-burst',patch:'16.20'};
 await command('save-build',b);let loaded=await command('load');assert.equal(loaded.local.builds.length,1);await command('pin',b);
 assert.ok((await js('window.mayhem.getState()')).overlayDiagnostic);
 const pages=['Tổng quan','Tướng','Lõi','Trang bị','Build & combo','Mô phỏng','So sánh','Ảnh hưởng patch','Cộng đồng','Luyện tập','Xem lại sau trận','Build của bạn','Nguồn & bằng chứng','Thiết lập'];
 for(let i=0;i<pages.length;i++){
  await js(`document.querySelectorAll('.dv-side nav button')[${i}].click()`);await wait(i===5||i===6?500:160);
  assert.equal(await js("document.querySelector('.dv-header h1')?.textContent"),pages[i]);
  if(i===5){await click('Nạp ví dụ giả định');await wait(400);assert.match(await js('document.body.innerText'),/APPROXIMATE/);}
  if(i===9){await click('Tạo 3 thẻ ngoại tuyến');await wait(300);assert.equal(await js("document.querySelectorAll('.dv-build-grid article').length"),3);}
  if([0,4,5,9,12,13].includes(i))fs.writeFileSync(path.join(out,'screen-'+i+'.png'),(await main.webContents.capturePage()).toPNG());
 }
 const sizes=[];await js("document.querySelectorAll('.dv-side nav button')[4].click()");await wait(250);
 for(const [width,height,scale] of [[860,620,1],[1280,800,1],[1920,1080,1],[1280,900,1.5]]){
  main.setBounds({x:0,y:0,width,height});main.webContents.setZoomFactor(scale);await wait(250);
  const overflow=await js('document.documentElement.scrollWidth>innerWidth+2');assert.equal(overflow,false,`${width} @ ${scale}`);fs.writeFileSync(path.join(out,`lab-${width}-${scale}.png`),(await main.webContents.capturePage()).toPNG());sizes.push({width,height,zoom:scale,horizontalOverflow:overflow});
 }
 const catalog=require('../data/catalog.json');fakeClient={phase:'InProgress',queueId:2400,version:catalog.version,gameId:'ocr-test'};fakeLive=require('../core/demo.cjs').demo(catalog,'Lux');fakeLive.gameData.gameMode='KIWI';
 await js("window.mayhem.command('demo',false)");for(let i=0;i<50;i++){if((await js('window.mayhem.getState()')).champion?.id==='Lux')break;await wait(100);}
 helper.stdout.write('GAME_FOCUS\nGAME_RECT 0 0 2560 1440\n');await wait(100);
 helper.stdout.write('SCAN_SELF\n');for(let i=0;i<30;i++){if((await js('window.mayhem.getState()')).offered?.filter(Boolean).length===3)break;await wait(100);}
 const scanned=await js('window.mayhem.getState()');assert.deepEqual(scanned.offered,['ARAM_ThreadtheNeedle','BurstingTeeth','ARAM_Marksmage']);assert.equal(scanned.assessment.offers.length,3);assert.equal(scanned.scan.lastHotkey,'SCAN_SELF');
 const badges=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('badges=1'));assert.ok(badges?.isVisible());assert.equal(await badges.webContents.executeJavaScript("document.querySelectorAll('.nv-card-badge').length"),3);fs.writeFileSync(path.join(out,'card-tiers-restored.png'),(await badges.webContents.capturePage()).toPNG());
 await js("window.mayhem.command('demo',true)");await wait(300);
 const overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('overlay=1'));
 assert.ok(overlay?.isVisible());assert.equal(await overlay.webContents.executeJavaScript("document.querySelectorAll('.nv-offer').length"),3);
 fs.writeFileSync(path.join(out,'overlay-restored.png'),(await overlay.webContents.capturePage()).toPNG());
 await js("window.mayhem.command('settings',{overlayMode:'expanded'})");await wait(200);assert.equal(await overlay.webContents.executeJavaScript("document.querySelectorAll('.nv-roster>div').length"),5);fs.writeFileSync(path.join(out,'overlay-restored-expanded.png'),(await overlay.webContents.capturePage()).toPNG());
 assert.ok(globalShortcut.isRegistered('F8')||(await js('window.mayhem.getState()')).hotkeyFailures.includes('F8'));assert.ok(liveCalls<=5);assert.deepEqual(errors,[]);const result={status:'PASS',startupMs,pages:14,sizes,liveCalls,errors,scope:'Real Electron, isolated profile, mocked client/network/helper and OCR. Zoom is not physical DPI.'};fs.writeFileSync(path.join(out,'desktop-result.json'),JSON.stringify(result,null,2));console.log(result);
 }catch(e){console.error(e);process.exitCode=1;}finally{app.quit();}});
