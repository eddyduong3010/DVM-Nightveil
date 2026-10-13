const {app,BrowserWindow,session}=require('electron'),fs=require('node:fs'),path=require('node:path');
const phase=process.argv.find(x=>x.startsWith('--label='))?.split('=')[1]||'before',out=path.resolve(__dirname,'../../../outputs/advanced-benchmark');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',path.join(out,'profile-'+phase+'-'+Date.now()));fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(path.join(app.getPath('userData'),'settings.json'),JSON.stringify({displaySetupVersion:1,display:{showOnStartup:false},autoScan:false,autoScanVersion:1,inputSafetyVersion:2,learnBuilds:false}));
const base=process.env.DVM_BENCH_ROOT||path.resolve(__dirname,'..');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const cp=require('node:child_process'),spawn=cp.spawn;cp.spawn=(exe,args,opts)=>{if(exe==='powershell.exe'){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close');setTimeout(()=>child.stdout.write('READY\n'),20);return child;}return spawn(exe,args,opts);};
const catalog=require(path.join(base,'data/catalog.json')),fixture=require(path.join(base,'core/demo.cjs')).demo(catalog,'Evelynn');fixture.gameData.gameMode='KIWI';
let stage='idle',calls={client:0,live:0},ipc=0,bytes=0;const reader=require(path.join(base,'desktop/lcu.cjs')).LeagueReader;
reader.prototype.readClient=async()=>{calls.client++;return stage==='idle'?null:{phase:stage==='select'?'ChampSelect':'InProgress',selectedChampionKey:28,queueId:2400,gameId:12345,version:catalog.version};};
reader.prototype.readLive=async()=>{calls.live++;if(stage!=='live')throw Error('simulated unavailable');return {...fixture,gameData:{...fixture.gameData,gameTime:620+Math.floor((Date.now()-started)/1000)}};};
reader.prototype.readRecentMatches=async()=>({games:{games:[]}});
require(path.join(base,'scripts/update-data.cjs')).updateData=async()=>catalog;
require(path.join(base,'desktop/community.cjs')).fetchCommunity=async()=>require(path.join(base,'data/community.json'));
require(path.join(base,'desktop/opgg.cjs')).fetchOpggBuild=async()=>null;require(path.join(base,'desktop/opgg.cjs')).fetchOpggAugments=async()=>null;
app.on('browser-window-created',(_,w)=>{const send=w.webContents.send.bind(w.webContents);w.webContents.send=(channel,...args)=>{if(channel==='state:changed'){ipc++;bytes+=Buffer.byteLength(JSON.stringify(args));}return send(channel,...args);};});
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['https://*/*']},(_,cb)=>cb({cancel:true})));
const started=Date.now();require(path.join(base,'desktop/main.cjs'));const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 let main;for(let i=0;i<200;i++){main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));if(main&&!main.webContents.isLoading()&&await main.webContents.executeJavaScript("!!document.querySelector('nav')"))break;await wait(100);}main.showInactive();const startupMs=Date.now()-started,rows=[];
 for(const name of ['idle','select','live','disconnect']){stage=name;const initial={...calls,ipc,bytes},cpu=[],ram=[];for(let i=0;i<8;i++){await wait(1000);const m=app.getAppMetrics();cpu.push(m.reduce((s,p)=>s+(p.cpu?.percentCPUUsage||0),0));ram.push(m.reduce((s,p)=>s+(p.memory?.workingSetSize||0),0)/1024);}rows.push({stage,seconds:8,clientCalls:calls.client-initial.client,liveCalls:calls.live-initial.live,ipc:ipc-initial.ipc,ipcBytes:bytes-initial.bytes,cpuPercentMean:cpu.reduce((a,b)=>a+b,0)/cpu.length,workingSetPeakMiB:Math.max(...ram)});}
 const result={label:phase,displays:require('electron').screen.getAllDisplays().map(d=>({bounds:d.bounds,scale:d.scaleFactor})),platform:process.platform,electron:process.versions.electron,startupMs,scenario:'mock APIs and fixed native helper; visible main; overlay hidden; network image requests blocked identically; Windows process CPU and working set sampled once/second',rows};fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(result,null,2));console.log(result);
 }catch(e){console.error(e);process.exitCode=1;}finally{app.quit();}});
