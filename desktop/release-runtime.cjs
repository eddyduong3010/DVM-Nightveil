const fs=require('node:fs/promises'),path=require('node:path');
const {atomicJson}=require('./json-cache.cjs');
const SETTINGS_SCHEMA=1;
function migrateSettings(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Cấu hình không hợp lệ.');
 if((raw.settingsSchema||0)>SETTINGS_SCHEMA)throw Error('Cấu hình thuộc phiên bản mới hơn.');
 const result={...raw,settingsSchema:SETTINGS_SCHEMA};delete result.__proto__;delete result.constructor;delete result.prototype;return result;
}
async function loadSettings(directory,defaults){
 const file=path.join(directory,'settings.json');let raw;
 try{raw=JSON.parse(await fs.readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')return {...defaults,settingsSchema:SETTINGS_SCHEMA};
  await fs.copyFile(file,file+'.corrupt-'+Date.now()).catch(()=>{});
  try{raw=JSON.parse(await fs.readFile(file+'.last-good','utf8'));}catch{return {...defaults,settingsSchema:SETTINGS_SCHEMA};}
 }
 const migrated=migrateSettings(raw);
 if(!raw.settingsSchema)await atomicJson(file+'.pre-migration',raw);
 return {...defaults,...migrated};
}
async function saveSettings(directory,value){const checked=migrateSettings(value);await atomicJson(path.join(directory,'settings.json'),checked);await atomicJson(path.join(directory,'settings.json.last-good'),checked);}
class Diagnostics{
 constructor(directory,version){this.directory=directory;this.version=version;this.queue=Promise.resolve();}
 async start(){await fs.mkdir(this.directory,{recursive:true});let old={};try{old=JSON.parse(await fs.readFile(path.join(this.directory,'session.json'),'utf8'));}catch{}
  this.failures=old.clean===false?(old.failures||0)+1:0;await atomicJson(path.join(this.directory,'session.json'),{clean:false,failures:this.failures,version:this.version});this.record('startup');return this.failures>=3;
 }
 record(event,details={}){ // Deliberately never serialize messages, paths, stack, player identifiers or tokens.
  const row={at:new Date().toISOString(),version:this.version,event:String(event).replace(/[^a-z0-9_-]/gi,'').slice(0,48)};
  if(Number.isInteger(details.exitCode))row.exitCode=details.exitCode;
  if(['crashed','oom','killed','abnormal-exit','launch-failed'].includes(details.reason))row.reason=details.reason;
  this.queue=this.queue.catch(()=>{}).then(async()=>{const file=path.join(this.directory,'events.jsonl');let s;try{s=await fs.stat(file);}catch{}if(s?.size>262144)await fs.rename(file,path.join(this.directory,'events.previous.jsonl'));await fs.appendFile(file,JSON.stringify(row)+'\n');}).catch(()=>{});return this.queue;
 }
 async healthy(){await atomicJson(path.join(this.directory,'session.json'),{clean:false,failures:0,version:this.version});}
 async close(){await this.queue;await atomicJson(path.join(this.directory,'session.json'),{clean:true,failures:0,version:this.version});}
}
function canInstall({phase,clientPhase,snapshot,gameFocused}){return !snapshot&&!gameFocused&&['CLIENT','DISCONNECTED','POSTGAME','DEMO'].includes(phase)&&!['InProgress','Reconnect','GameStart','ChampSelect','ReadyCheck','Matchmaking'].includes(clientPhase);}
function verifiedFeed(meta,config){const names=Array.isArray(config?.publisherName)?config.publisherName:[config?.publisherName];return meta.updatesEnabled===true&&!!meta.publisher&&names.length===1&&names[0]===meta.publisher&&config?.provider==='github'&&`${config.owner}/${config.repo}`===meta.repository&&!config.token&&!config.private;}
class ApplicationUpdates{
 constructor({updater,enabled=false,busy=()=>true,backup=async()=>{},changed=()=>{}}){Object.assign(this,{updater,enabled,busy,backup,changed});this.state={status:enabled?'Sẵn sàng kiểm tra':'Chưa bật: cần kênh công khai và bản ký số'};this.next=0;this.failures=0;this.running=false;
  if(!enabled)return;updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;updater.allowPrerelease=false;
  updater.on('update-available',()=>this.set('Đang tải bản cập nhật đã phát hành'));
  updater.on('update-not-available',()=>this.set('Đang dùng bản mới nhất'));
  updater.on('update-downloaded',()=>{this.ready=true;this.set('Đã tải; cài khi bạn sẵn sàng ngoài trận');});
  updater.on('error',()=>this.set('Cập nhật thất bại; giữ bản hiện tại'));
 }
 set(status){this.state={status,ready:!!this.ready};this.changed();}
 async check(force=false){if(!this.enabled||this.running||this.busy()||(!force&&Date.now()<this.next))return false;this.running=true;try{await this.updater.checkForUpdates();this.failures=0;this.next=Date.now()+6*3600000;return true;}catch{this.next=Date.now()+Math.min(3600000,60000*2**Math.min(this.failures++,6));this.set('Không kết nối được; sẽ thử lại');return false;}finally{this.running=false;}}
 async install(){if(!this.enabled||!this.ready||this.busy())throw Error('Chỉ cài ngoài trận khi đã tải xong bản cập nhật.');await this.backup();if(this.busy())throw Error('Trận đã bắt đầu; hoãn cập nhật.');this.updater.quitAndInstall(false,true);}
}
module.exports={migrateSettings,loadSettings,saveSettings,Diagnostics,ApplicationUpdates,canInstall,verifiedFeed};
