const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {validateCatalog}=require('../core/data-validation.cjs');
const {atomicJson}=require('./json-cache.cjs');
class CatalogStore {
 constructor(directory){this.directory=directory;this.folder=path.join(directory,'catalog-snapshots');this.manifest=path.join(this.folder,'index.json');this.status='';}
 async entries(){try{const v=JSON.parse(await fs.readFile(this.manifest,'utf8'));return v.entries.filter(e=>/^[a-f0-9]{24}\.json$/.test(e.file));}catch{return [];}}
 async readEntry(entry){const body=await fs.readFile(path.join(this.folder,entry.file),'utf8');if(createHash('sha256').update(body).digest('hex').slice(0,24)+'.json'!==entry.file)throw Error('Snapshot checksum không khớp.');return validateCatalog(JSON.parse(body));}
 async forPatch(patch){for(const e of await this.entries()){if(e.patch!==patch)continue;try{const value=await this.readEntry(e);if(value.patch===patch)return value;}catch{}}return null;}
 async load(fallback){
  for(const [i,e] of (await this.entries()).entries()){
   try{const data=await this.readEntry(e);if(i)this.status='Đã phục hồi danh mục tốt gần nhất.';return data;}catch{}
  }
  try{return validateCatalog(JSON.parse(await fs.readFile(path.join(this.directory,'catalog.json'),'utf8')));}catch{}
  this.status='Đang dùng danh mục đi kèm ứng dụng.';return validateCatalog(fallback);
 }
 async publish(input){
  const data=validateCatalog(input),body=JSON.stringify(data),file=createHash('sha256').update(body).digest('hex').slice(0,24)+'.json';
  const previous=await this.entries();
  // Preserve the pre-migration cache as a rollback target on first publication.
  if(!previous.length){try{const old=validateCatalog(JSON.parse(await fs.readFile(path.join(this.directory,'catalog.json'),'utf8')));const oldFile=createHash('sha256').update(JSON.stringify(old)).digest('hex').slice(0,24)+'.json';await atomicJson(path.join(this.folder,oldFile),old);previous.push({file:oldFile,patch:old.patch,at:old.fetchedAt});}catch{}}
  await atomicJson(path.join(this.folder,file),data);
  const counts=new Map();const entries=[{file,patch:data.patch,at:data.fetchedAt},...previous.filter(e=>e.file!==file)].filter(e=>{const n=counts.get(e.patch)||0;counts.set(e.patch,n+1);return n<2;}).slice(0,8);
  await atomicJson(this.manifest,{schema:1,entries}); // Atomic active-pointer change.
  await atomicJson(path.join(this.directory,'catalog.json'),data).catch(()=>{});
  for(const name of await fs.readdir(this.folder)){if(/^[a-f0-9]{24}\.json$/.test(name)&&!entries.some(e=>e.file===name))await fs.unlink(path.join(this.folder,name)).catch(()=>{});}
  this.status='Dữ liệu đã kiểm tra và lưu bản phục hồi.';return data;
 }
 async rollback(expectedPatch){
  const entries=await this.entries();
  for(let i=1;i<entries.length;i++){
   if(expectedPatch&&entries[i].patch!==expectedPatch)continue;
   try{const data=await this.readEntry(entries[i]);await atomicJson(this.manifest,{schema:1,entries:[entries[i],...entries.filter((_,j)=>j!==i)]});await atomicJson(path.join(this.directory,'catalog.json'),data).catch(()=>{});this.status='Đã khôi phục bản dữ liệu trước.';return data;}catch{}
  }
  throw Error('Chưa có bản phục hồi hợp lệ cùng bản vá.');
 }
}
module.exports={CatalogStore};
