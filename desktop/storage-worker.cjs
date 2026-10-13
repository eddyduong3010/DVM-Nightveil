const {parentPort,workerData}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {loadHistory,newHistory}=require('../core/build-history.cjs');
const dir=workerData.directory,file=path.join(dir,'history.sqlite'),backups=path.join(dir,'history-backups');
let db,initializationError=null,status='SQLite · ghi trong tiến trình nền';
function healthy(file){let test;try{test=new DatabaseSync(file,{readOnly:true});return Object.values(test.prepare('PRAGMA quick_check').get())[0]==='ok';}catch{return false;}finally{test?.close();}}
function save(history){
 const {records,...metadata}=history;
 db.exec('BEGIN IMMEDIATE');
 try{
  db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run('history',JSON.stringify(metadata));
  db.exec('DELETE FROM builds');const put=db.prepare('INSERT INTO builds(id,ordinal,payload) VALUES(?,?,?)');
  records.forEach((r,i)=>put.run(r.id,i,JSON.stringify(r)));db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
function backup(manual=false){
 fs.mkdirSync(backups,{recursive:true});
 const name=(manual?'manual-':'daily-')+new Date().toISOString().slice(0,10)+(manual?'-'+Date.now():'')+'.sqlite';
 const dest=path.join(backups,name);if(!fs.existsSync(dest))db.exec("VACUUM INTO '"+dest.replaceAll("'","''")+"'");
 for(const prefix of ['daily-','manual-']){
  const files=fs.readdirSync(backups).filter(n=>n.startsWith(prefix)&&n.endsWith('.sqlite')).sort().reverse();
  for(const n of files.slice(5))fs.unlinkSync(path.join(backups,n));
 }
 return dest;
}
function open(){
 fs.mkdirSync(dir,{recursive:true});
 if(fs.existsSync(file)&&!healthy(file)){
  const suffix='.corrupt-'+randomUUID();
  for(const ext of ['','-wal','-shm'])if(fs.existsSync(file+ext))fs.renameSync(file+ext,file+suffix+ext);
  const copies=fs.existsSync(backups)?fs.readdirSync(backups).filter(n=>n.endsWith('.sqlite')).map(n=>path.join(backups,n)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs):[];
  const good=copies.find(healthy);if(good){fs.copyFileSync(good,file);status='Đã phục hồi SQLite từ bản sao lưu.';}else status='CSDL lỗi đã được giữ riêng; đang đọc bản JSON cũ nếu có.';
 }
 db=new DatabaseSync(file);if(db.prepare('PRAGMA user_version').get().user_version>3)throw Error('CSDL từ phiên bản mới hơn; không sửa.');db.exec('PRAGMA foreign_keys=ON;');db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS builds(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,payload TEXT NOT NULL);');
 if(!db.prepare('SELECT value FROM metadata WHERE key=?').get('history')){
  let history=newHistory();const old=path.join(dir,'build-history.json');
  if(fs.existsSync(old)){
   const raw=JSON.parse(fs.readFileSync(old,'utf8'));
   if(raw?.schema!==1||!Array.isArray(raw.records))throw Error('Lịch sử JSON cũ sai cấu trúc; giữ nguyên để phục hồi.');
   history=loadHistory(raw);
   if(raw.records?.length&&loadHistory(raw,0).records.length!==raw.records.length)throw Error('Lịch sử cũ có bản ghi không hợp lệ. Đã giữ nguyên file JSON; chưa chuyển đổi.');
   status='Đã chuyển lịch sử cũ sang SQLite; giữ nguyên bản JSON gốc.';
  }
  save(history);
 }
 require('./advanced-storage.cjs').migrate(db,()=>backup(true));
 backup();
}
parentPort.on('message',({id,type,body})=>{
 try{
  if(initializationError)throw initializationError;
  if(!db){try{open();}catch(e){initializationError=e;db?.close();db=null;throw e;}}
  let value;
  if(type==='load')value={...JSON.parse(db.prepare('SELECT value FROM metadata WHERE key=?').get('history').value),records:db.prepare('SELECT payload FROM builds ORDER BY ordinal').all().map(r=>JSON.parse(r.payload))};
  else if(type==='save'){save(JSON.parse(body));value=true;}
  else if(type==='advanced')value=require('./advanced-storage.cjs').run(db,body);
  else if(type==='backup')value=backup(true);
  else if(type==='close'){db.close();db=null;value=true;}
  else throw Error('Lệnh lưu trữ không hợp lệ.');
  parentPort.postMessage({id,value,status});
 }catch(e){parentPort.postMessage({id,error:e.message});}
});
