const {Worker}=require('node:worker_threads');const path=require('node:path');
class AnalysisClient{
 constructor(){this.pending=new Map();this.seq=0;}
 async initialize(catalog){this.catalog=catalog;return this.request('initialize',catalog);}
 request(type,payload){
  if(this.pending.size>=32)return Promise.reject(Error('Đang xử lý nhiều yêu cầu; thử lại sau.'));
  if(!this.worker){this.worker=new Worker(path.join(__dirname,'analysis-worker.cjs'));this.worker.on('message',r=>{const p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.value);if(!this.pending.size)this.worker?.unref();});this.worker.on('error',e=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();this.worker=null;});this.worker.unref();if(type!=='initialize'&&this.catalog)this.worker.postMessage({id:0,type:'initialize',payload:this.catalog});}
  const id=++this.seq;this.worker.ref();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Phân tích quá thời gian.'));},15000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,type,payload});});
 }
 async close(){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Ứng dụng đang đóng.'));}this.pending.clear();await this.worker?.terminate();this.worker=null;}
}
module.exports={AnalysisClient};
