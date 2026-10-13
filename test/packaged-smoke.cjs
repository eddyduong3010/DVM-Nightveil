// Exercise the actual packaged EXE in an isolated profile over its loopback
// debugging port. This never sends keys or mouse input to the game.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const net=require('node:net');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=35000){const start=Date.now();while(Date.now()-start<ms){try{const r=await fn();if(r)return r;}catch{}await wait(150);}throw Error('Packaged app did not become ready.');}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map();let seq=0;
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('Debugging target closed.'));pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 return {ws,send,async evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+r.result?.description);return r.result.value;}};
}
(async()=>{
 const exe=path.resolve(process.argv[2]||'artifacts/win-unpacked/DVM Nightveil.exe');
 const output=path.resolve(__dirname,'../../../outputs/advanced-validation'),profile=path.join(output,'packaged-profile-'+Date.now());await fs.mkdir(profile,{recursive:true});
 const h=require('../core/build-history.cjs'),raw=h.newHistory(),catalog=require('../data/catalog.json'),fixture=require('../core/demo.cjs').demo(catalog);fixture.gameData.gameMode='KIWI';h.observeHistory(raw,fixture,catalog,{game:'packaged-fixture'});
 const b={name:'Packaged Evelynn',champion:'Evelynn',items:['3089'],augments:['ARAM_WitchfulThinking'],archetype:'ap-burst',patch:catalog.patch};
 await fs.writeFile(path.join(profile,'build-history.json'),JSON.stringify(raw));await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({autoScan:false,autoReroll:false,cardTiersEnabled:false,liveFeatureVersion:1,autoScanVersion:1,inputSafetyVersion:2,learnBuilds:false,localOnly:true,displaySetupVersion:1,display:{showOnStartup:false},staticReference:b}));
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const child=spawn(exe,['--user-data-dir='+profile,'--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--background'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b.toString());
 let main,overlay;const deadline=setTimeout(()=>{child.kill();},60000);
 try{
  const targets=await until(async()=>{const rows=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();return rows.some(t=>t.url.includes('overlay=1'))&&rows.some(t=>t.url.includes('control=1'))&&rows.some(t=>t.url.includes('badges=1'))&&rows.some(t=>t.url.endsWith('/index.html'))&&rows;});
  main=await connect(targets.find(t=>t.type==='page'&&t.url.endsWith('/index.html')).webSocketDebuggerUrl);
  await until(()=>main.evaluate('!!window.mayhem'));
  const cmd=(type,payload)=>main.evaluate('window.mayhem.command('+JSON.stringify(type)+','+JSON.stringify(payload)+')');
  const state=()=>main.evaluate('window.mayhem.getState()');
  // Wait for boot's first client discovery and renderer subscription, not just
  // preload availability. Boot may still minimize a window while discovering.
  await until(async()=>{const s=await state();return s.status!=='Đang kết nối'&&s.hotkeyListener==='Sẵn sàng'&&await main.evaluate("!!document.querySelector('nav button')");});
  let s=await state();assert.equal(s.appVersion,require('../package.json').version);assert.equal(s.brand.name,'DVM Nightveil');assert.equal(s.history.total,raw.records.length);assert.equal(s.history.error,'');
  assert.ok((await fs.stat(path.join(profile,'history.sqlite'))).isFile());
  const adv=(action,input={})=>cmd('advanced',{action,input});
  const saved=await adv('save-build',b);assert.ok(saved.id);const loaded=await adv('load');assert.equal(loaded.local.builds.length,1);
  const simulation=await adv('simulate',{builds:[b],scenario:{duration:5},level:18});assert.ok(simulation[0].result.total>0);
  await cmd('demo',true);await cmd('main');
  overlay=await connect(targets.find(t=>t.url.includes('overlay=1')).webSocketDebuggerUrl);const o=await overlay.evaluate('window.mayhem.getState()');assert.equal(o.staticReference.name,b.name);assert.equal(o.champion.id,'Evelynn');assert.ok(o.assessment.offers.some(Boolean));assert.ok(o.build?.selected||o.build);assert.equal((await state()).overlayDiagnostic.visible,true);
  await until(()=>overlay.evaluate("document.querySelectorAll('.nv-offer').length===3"));
  assert.notEqual(await overlay.evaluate("document.querySelector('.nv-purchase strong')?.innerText"),'Chờ trang bị');
  const overlayShot=await overlay.send('Page.captureScreenshot',{captureBeyondViewport:true});await fs.writeFile(path.join(output,'packaged-overlay-compact.png'),Buffer.from(overlayShot.data,'base64'));
  await cmd('scan');assert.match((await state()).message,/minh họa/);
  await cmd('history-backup');assert.ok((await fs.readdir(path.join(profile,'history-backups'))).some(n=>n.startsWith('manual-')));
  await main.evaluate("document.querySelectorAll('.dv-side nav button')[13].click()");await wait(300);
  assert.match(await main.evaluate('document.body.innerText'),/Design by DVM in VietNam/);
  const shot=await main.send('Page.captureScreenshot',{captureBeyondViewport:true});await fs.writeFile(path.join(output,'packaged-settings.png'),Buffer.from(shot.data,'base64'));
  await main.evaluate("document.querySelectorAll('.dv-side nav button')[4].click()");await wait(150);
  await main.evaluate("{const select=document.querySelector('select[aria-label=\"Tướng lập build\"]');select.value='Lux';select.dispatchEvent(new Event('change',{bubbles:true}));}");
  await main.evaluate("document.querySelectorAll('.dv-side nav button')[5].click()");await wait(500);
  assert.match(await main.evaluate('document.body.innerText'),/APPROXIMATE/);
  const result={passed:true,version:s.appVersion,isolatedProfile:true,legacyRows:raw.records.length,sqliteMigration:true,workerBackup:true,buildSaved:true,simulationWorker:true,augmentedOverlay:true,demoScanNoCapture:true,branding:true,network:'local-only setting',installerWizard:'NOT_TESTED'};
  await fs.writeFile(path.join(output,'packaged-smoke.json'),JSON.stringify(result,null,2));console.log(result);

 }finally{
  if(main){await main.send('Page.close').catch(()=>{});main.ws.close();}overlay?.ws.close();
  await Promise.race([new Promise(r=>child.exitCode!==null?r():child.once('exit',r)),wait(4000)]);if(child.exitCode===null)child.kill();clearTimeout(deadline);
  await fs.writeFile(path.join(output,'packaged-runtime.log'),stderr);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
