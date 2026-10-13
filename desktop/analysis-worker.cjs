const {parentPort}=require('node:worker_threads');
const lab=require('../core/build-lab.cjs'),sim=require('../core/simulation.cjs'),info=require('../core/intelligence.cjs'),evidence=require('../core/evidence.cjs');
let catalog,index;
parentPort.on('message',({id,type,payload})=>{try{
 let value;if(type==='initialize'){catalog=payload;index=info.createIndex(catalog,[],evidence.SOURCES);value=true;}
 else if(!catalog)throw Error('Chưa có danh mục.');
 else if(type==='reindex'){index=info.createIndex(catalog,payload.builds||[],evidence.SOURCES);for(const [id,r] of Object.entries(require('../core/synergy-graph.cjs').AUG))index.push({id,name:r.reason,kind:'mechanics',text:info.normalize(id+' '+r.reason+' '+(r.need||[]).join(' '))});value=index.length;}
 else if(type==='search')value=info.search(index,payload.query);
 else if(type==='analyze')value=lab.analyze(catalog,payload.build,payload.constraints);
 else if(type==='simulate'){
  if(!Array.isArray(payload.builds)||payload.builds.length>4)throw Error('Tối đa 4 nhánh.');
  value=payload.builds.map(raw=>{const b=lab.validateBuild(raw,catalog),level=Number(payload.level||1);if(!Number.isInteger(level)||level<1||level>30)throw Error('Cấp tướng không hợp lệ.');const assumptions={...lab.stats(catalog,b,level),...payload.scenario,...b.assumptions};return {id:raw.id,name:b.name,result:sim.simulate(assumptions),curve:sim.sensitivity(assumptions),limitations:['Chỉ số cơ bản và tăng trưởng theo mô hình xấp xỉ.','Chưa tính nội tại trang bị, lõi và kỹ năng nếu không nhập hiệu ứng rõ ràng.'],patch:b.patch};});
 }else if(type==='diff')value=info.patchDiff(payload.before,payload.after);
 else if(type==='practice')value=info.practice(catalog,payload.seed,payload.rarity);
 else throw Error('Lệnh phân tích không hợp lệ.');parentPort.postMessage({id,value});
 }catch(e){parentPort.postMessage({id,error:e.message});}});
