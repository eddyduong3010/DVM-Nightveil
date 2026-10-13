const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {newHistory,loadHistory}=require('../core/build-history.cjs');
class HistoryStore{
 constructor(directory){this.directory=directory;this.file=path.join(directory,'history.sqlite');this.queue=Promise.resolve();this.error='';this.status='';this.pending=new Map();this.sequence=0;}
 request(type,body){
  if(!this.worker){
   this.worker=new Worker(path.join(__dirname,'storage-worker.cjs'),{workerData:{directory:this.directory}});
   this.worker.on('message',r=>{const p=this.pending.get(r.id);if(!p)return;this.pending.delete(r.id);this.status=r.status||this.status;r.error?p.reject(Error(r.error)):p.resolve(r.value);if(!this.pending.size)this.worker?.unref();});
   this.worker.on('error',e=>{for(const p of this.pending.values())p.reject(e);this.pending.clear();this.worker=null;});
   this.worker.unref();
  }
  const id=++this.sequence;this.worker.ref();return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,type,body});});
 }
 async load(){try{const history=loadHistory(await this.request('load'));this.error='';return history;}catch(e){this.error='Chưa đọc được lịch sử: '+e.message;return newHistory();}}
 save(history){const body=JSON.stringify(history);this.queue=this.queue.catch(()=>{}).then(async()=>{try{await this.request('save',body);this.error='';}catch(e){this.error='Chưa lưu được lịch sử: '+e.message;}});return this.queue;}
 async backup(){await this.queue;return this.request('backup');}
 async close(){await this.queue;if(this.worker){await this.request('close').catch(()=>{});await this.worker.terminate();this.worker=null;}}
}
module.exports={HistoryStore};
