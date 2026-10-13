// Reject redirects so remote metadata cannot widen the allowed origin set.
async function boundedBody(response, limit=16000000){
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel?.();throw Error('Gói dữ liệu quá lớn.');}
 if(!response.body?.getReader)throw Error('Nguồn dữ liệu thiếu luồng đọc an toàn.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Gói dữ liệu quá lớn.');chunks.push(Buffer.from(value));}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 return Buffer.concat(chunks,size);
}
function allowedUrl(url,hosts){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port&&!['443'].includes(u.port)||!hosts.includes(u.hostname))throw Error('Nguồn dữ liệu không được hỗ trợ.');return u;}
async function safeFetch(url,{hosts,fetcher=fetch,...options}){allowedUrl(url,hosts);return fetcher(url,{...options,redirect:'error'});}
module.exports={boundedBody,allowedUrl,safeFetch};
