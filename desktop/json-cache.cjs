const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {safeFetch,boundedBody}=require('./safe-http.cjs');
async function atomicJson(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(tmp,JSON.stringify(value));await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(()=>{});}
}
class JsonCache {
 constructor(directory,fetcher=fetch){this.directory=directory;this.fetcher=fetcher;this.hits=0;this.downloads=0;}
 async get(url,validate=x=>x,{immutable=false}={}){
  const parsed=new URL(url),host=parsed.hostname;
  if(parsed.protocol!=='https:'||!['ddragon.leagueoflegends.com','raw.communitydragon.org','arammayhem.com'].includes(host))throw Error('Nguồn dữ liệu không được hỗ trợ.');
  const file=path.join(this.directory,createHash('sha256').update(url).digest('hex')+'.json');
  let cache=null;try{cache=JSON.parse(await fs.readFile(file,'utf8'));validate(cache.value);if(cache.url!==url)cache=null;}catch{cache=null;}
  if(cache&&immutable){this.hits++;return validate(cache.value);}
  const response=await safeFetch(url,{hosts:['ddragon.leagueoflegends.com','raw.communitydragon.org','arammayhem.com'],fetcher:this.fetcher,headers:cache?.etag?{'If-None-Match':cache.etag}:{},signal:AbortSignal.timeout(25000)});
  if(response.status===304&&cache){this.hits++;return validate(cache.value);}
  if(!response.ok)throw Error(`Nguồn ${host} trả HTTP ${response.status}.`);
  const body=(await boundedBody(response)).toString('utf8');
  const raw=JSON.parse(body),checked=validate(raw); // Never publish or cache an invalid response.
  await atomicJson(file,{url,etag:response.headers.get('etag'),value:raw,fetchedAt:Date.now()});
  this.downloads++;return checked;
 }
}
module.exports={JsonCache,atomicJson};
