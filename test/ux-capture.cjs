const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.disableHardwareAcceleration();
const phase=process.argv.find(a=>a.startsWith('--phase='))?.split('=')[1]||'before';
const output=path.resolve(__dirname,'../../../outputs/ux-audit-0.4.0',phase);fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(output,'profile-'+Date.now()));fs.mkdirSync(app.getPath('userData'),{recursive:true});
fs.writeFileSync(path.join(app.getPath('userData'),'settings.json'),JSON.stringify({displaySetupVersion:1,display:{showOnStartup:false},learnBuilds:false,autoScanVersion:1,inputSafetyVersion:2}));
const data=require('../data/catalog.json'),h=require('../core/build-history.cjs'),fixture=require('../core/demo.cjs').demo(data),history=h.newHistory();fixture.gameData.gameMode='KIWI';h.observeHistory(history,fixture,data,{game:'ux-fixture'});
fs.writeFileSync(path.join(app.getPath('userData'),'build-history.json'),JSON.stringify(history));
const reader=require('../desktop/lcu.cjs').LeagueReader;reader.prototype.readClient=async()=>null;reader.prototype.readLive=async()=>null;reader.prototype.readRecentMatches=async()=>({games:{games:[]}});
require('../scripts/update-data.cjs').updateData=async()=>data;
const errors=[],measurements=[];
app.on('browser-window-created',(_,w)=>w.webContents.on('console-message',e=>{if(e.level==='error'&&!/ERR_|Failed to load resource/.test(e.message))errors.push(e.message);}));
require('../desktop/main.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await wait(100);}throw Error('UI not ready');}
app.whenReady().then(async()=>{
 try{
  await until(()=>BrowserWindow.getAllWindows().length===4&&BrowserWindow.getAllWindows().every(w=>w.webContents.getURL()&&!w.webContents.isLoading()));
  const main=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('?')),overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('overlay=1'));
  const command=(type,payload)=>main.webContents.executeJavaScript(`window.mayhem.command(${JSON.stringify(type)},${JSON.stringify(payload)})`);
  await until(async()=>(await main.webContents.executeJavaScript('window.mayhem.getState()')).status!=='Đang kết nối');
  await command('demo',true);main.showInactive();
  async function capture(win,name){await wait(180);const m=await win.webContents.executeJavaScript(`({w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,body:document.body.scrollHeight,buttons:[...document.querySelectorAll('nav button')].map(b=>b.innerText)})`);measurements.push({name,...m});fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());}
  for(const [w,height,zoom,label] of [[1280,800,1,'1280'],[1000,680,1,'1000'],[1024,720,1.25,'dpi125'],[1200,900,1.5,'dpi150'],[1280,1000,2,'dpi200']]){
   main.webContents.setZoomFactor(zoom);main.setContentSize(w,height);await wait(100);
   for(const [index,labelText] of ['Trận đấu','Lõi & combo','Thử combo','Lịch sử build','Thiết lập','Về Nightveil'].entries()){
    const labels=await main.webContents.executeJavaScript("[...document.querySelectorAll('nav button')].map(b=>b.innerText)");if(!labels.some(x=>x.includes(labelText)))throw Error('Missing '+labelText);
    await main.webContents.executeJavaScript(`Array.from(document.querySelectorAll('nav button')).find(b=>b.innerText.includes(${JSON.stringify(labelText)})).click()`);
    await capture(main,`${index+1}-${label}-${['match','augments','combo','history','settings','about'][index]}`);
    if(label==='1280'){await main.webContents.executeJavaScript('window.scrollTo(0,document.body.scrollHeight)');await capture(main,`${index+1}-bottom-${index}`);await main.webContents.executeJavaScript('window.scrollTo(0,0)');}
   }
  }
  main.webContents.setZoomFactor(1);await command('display-open');await capture(main,'07-display-setup');await command('display-save',{showOnStartup:false});await command('demo',true);
  if(phase==='before'){await capture(overlay,'08-overlay');}
  else{
   for(const mode of ['mini','compact','expanded']){await command('settings',{overlayMode:mode});await capture(overlay,'08-overlay-'+mode);}
  }
  const assert=require('node:assert/strict');
  main.webContents.setZoomFactor(1);main.setContentSize(1000,680);
  await main.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");await wait(150);
  assert.equal(await main.webContents.executeJavaScript("document.activeElement.getAttribute('aria-label')"),'Tìm lõi');
  const owned=(await main.webContents.executeJavaScript('window.mayhem.getState()')).owned;
  await main.webContents.executeJavaScript(`(()=>{const el=document.querySelector('input[aria-label="Tìm lõi"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'tu duy ma thuat');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(100);
  assert.match(await main.webContents.executeJavaScript("document.querySelector('.library-results').innerText"),/Tư Duy Ma Thuật/);
  await main.webContents.executeJavaScript("document.querySelector('.library-results button').click()");await wait(100);
  assert.ok(await main.webContents.executeJavaScript("document.querySelector('.library-detail').getBoundingClientRect().bottom<innerHeight"));
  assert.deepEqual((await main.webContents.executeJavaScript('window.mayhem.getState()')).owned,owned);
  await capture(main,'09-search-detail');await command('display-open');await wait(100);
  await main.webContents.executeJavaScript("document.querySelector('[role=dialog]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await wait(100);
  assert.equal(await main.webContents.executeJavaScript("!!document.querySelector('[role=dialog]')"),false);
  assert.ok(measurements.every(m=>m.scroll<=m.w),JSON.stringify(measurements.filter(m=>m.scroll>m.w)));
  fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify({phase,errors,measurements},null,2));console.log({phase,errors,screenshots:measurements.length});
 }catch(e){console.error(e);process.exitCode=1;}finally{app.quit();}
});
