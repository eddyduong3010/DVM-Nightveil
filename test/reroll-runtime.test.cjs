const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const data=require('../data/catalog.json');
const {demo}=require('../core/demo.cjs');
function runtime(scan){
 const entry=path.resolve(__dirname,'../desktop/main.cjs'),localRequire=createRequire(entry),clock={now:100000};
 // Exercise retained research routines with a test-only policy fixture. Production has no override.
 const source=fs.readFileSync(entry,'utf8').split('if(!app.requestSingleInstanceLock())')[0].replace("const {POLICY,assertCommand}=require('../core/feature-policy.cjs');","const POLICY={liveAdvice:'APPROVED',liveOCR:'APPROVED',opgg:'APPROVED'};const assertCommand=()=>{};");
 const snapshot=demo(data);snapshot.gameData.gameMode='KIWI';
 const display={size:{width:2048,height:1152},scaleFactor:1};
 const fakeOcr={busy:false,watching:false,reset(){},async scan(...args){this.busy=true;try{return await scan(...args);}finally{this.busy=false;}}};
 const context=vm.createContext({require:name=>name==='electron'?{app:{getVersion:()=> 'test',getPath:()=>path.resolve('test-profile'),setName(){},setPath(){}},screen:{getDisplayMatching:()=>display}}:localRequire(name),__dirname:path.dirname(entry),setTimeout,clearTimeout,setInterval,clearInterval,Date:class extends Date{static now(){return clock.now;}},fixture:data,fixtureSnapshot:snapshot,fakeOcr});
 vm.runInContext(source+`;data=fixture;snapshot=fixtureSnapshot;client={queueId:2400};gameFocused=true;gamePhysicalRect={x:0,y:0,width:2048,height:1152};gameClientRect=gamePhysicalRect;ocr=fakeOcr;broadcast=()=>{};offered=['ARAM_Deft','ARAM_WitchfulThinking','ARAM_Typhoon'];scan={scannedAt:Date.now(),matches:offered.map(id=>({id}))};globalThis.api={scan:runScan,click:handleGameClick,tick:maybeReadReroll,state:()=>({offered,owned,scan,pending:rerolls.pending}),confirm:confirmOwned};`,context);
 return {api:context.api,clock};
}
test('main process discards OCR captured before a reroll and automatically replaces tiers from a fresh scan',async()=>{
 let release,requests=0;const options=[];
 const old=['ARAM_Deft','ARAM_WitchfulThinking','ARAM_Typhoon'],fresh=['ARAM_WithHaste','ARAM_WitchfulThinking','ARAM_Typhoon'];
 const r=runtime(async(_a,_regions,opts)=>{options.push(opts);requests++;const offers=requests===1?await new Promise(resolve=>release=resolve):fresh;return {offers,matches:offers.map(id=>({id})),scannedAt:100500};});
 const ongoing=r.api.scan(false,true);r.api.click(642,816);
 assert.match(r.api.state().scan.status,/nhấp nút xoay thẻ 1/);
 release(old);await ongoing;assert.equal(r.api.state().offered[0],null);assert.equal(r.api.state().owned.length,0);
 r.clock.now+=1000;r.api.tick();await new Promise(setImmediate);
 assert.deepEqual(Array.from(r.api.state().offered),fresh);assert.equal(options[1].fresh,true);assert.equal(r.api.state().pending,false);
});
test('choosing a card cancels a queued reroll so it cannot repopulate the closed choice overlay',async()=>{
 let calls=0;const r=runtime(async()=>{calls++;return {};});
 r.api.click(1034,816);assert.equal(r.api.state().pending,true);
 r.api.confirm('ARAM_Deft');r.clock.now+=2000;r.api.tick();await new Promise(setImmediate);
 assert.equal(calls,0);assert.equal(r.api.state().offered.length,0);assert.equal(r.api.state().pending,false);
});
