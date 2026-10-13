const path=require('node:path');
const crypto=require('node:crypto');
const {desktopCapturer,screen}=require('electron');
const {createWorker}=require('tesseract.js');
const {matchAugment,normalize}=require('../core/engine.cjs');
const {clientCrop}=require('../core/display-layout.cjs');
function fingerprint(image){
  const size=image.getSize(),focus=image.crop({x:Math.round(size.width*.15),y:Math.round(size.height*.05),width:Math.round(size.width*.7),height:Math.round(size.height*.52)}).resize({width:24,height:16});
  return focus.toBitmap();
}
function imageDifference(a,b){
  if(!a||!b||a.length!==b.length)return 1;
  let total=0;for(let i=0;i<a.length;i+=4)total+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
  return total/(a.length/4*3*255);
}
class OcrReader{
  constructor(dataDir,onStatus,captureOptions){this.dataDir=dataDir;this.onStatus=onStatus;this.captureOptions=captureOptions;this.worker=null;this.busy=false;this.watching=false;this.reset();}
  reset(){this.lastHash='';this.lastComplete=false;this.previousCards=[];}
  async ready(){
    if(!this.worker){this.onStatus('Đang khởi động nhận diện tiếng Việt…');this.worker=await createWorker(['vie','eng'],1,{workerPath:require.resolve('tesseract.js/src/worker-script/node/index.js').replace('app.asar','app.asar.unpacked'),langPath:path.join(this.dataDir,'ocr').replace('app.asar','app.asar.unpacked'),gzip:false,cacheMethod:'none',logger:()=>{},errorHandler:()=>{}});await this.worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});}
  }
  async capture(){
    const display=screen.getPrimaryDisplay();
    const options=this.captureOptions?.();
    const thumbnailSize=options?.thumbnailSize||{width:Math.min(2560,Math.round(display.size.width*display.scaleFactor)),height:Math.min(1600,Math.round(display.size.height*display.scaleFactor))};
    const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize,fetchWindowIcons:false});
    const game=sources.find(s=>s.name==='League of Legends (TM) Client');
    if(!game || game.thumbnail.isEmpty())throw new Error('Không thấy cửa sổ trận. Mở trận ở chế độ không viền rồi nhấn F8 hoặc Ctrl + Shift + A.');
    const crop=clientCrop(game.thumbnail.getSize(),options?.client,options?.outer);
    return crop?game.thumbnail.crop(crop):game.thumbnail;
  }
  crop(image,region,scale=1.2){const size=image.getSize();const x=Math.round(region.x*size.width),y=Math.round(region.y*size.height),width=Math.max(10,Math.round(region.w*size.width)),height=Math.max(10,Math.round(region.h*size.height));return image.crop({x:Math.min(x,size.width-10),y:Math.min(y,size.height-10),width:Math.min(width,size.width-x),height:Math.min(height,size.height-y)}).resize({width:Math.max(600,Math.round(width*scale))});}
  titleRegion(r){return {x:r.x,y:r.y+r.h*.28,w:r.w,h:r.h*.18};}
  async observe(regions){
    if(this.busy||this.watching||!this.previousCards.some(c=>c?.id))return null;
    this.watching=true;
    try{const image=await this.capture();return regions.map((r,i)=>this.previousCards[i]?.id?imageDifference(fingerprint(this.crop(image,r,1)),this.previousCards[i].pixels):0);}
    finally{this.watching=false;}
  }
  async scan(augments,regions,{force=false,enemy=false,quick=false,fresh=false}={}){
    if(this.busy||this.watching)return {busy:true};this.busy=true;
    try{
      const image=await this.capture();
      const crops=enemy?[this.crop(image,{x:.03,y:.05,w:.94,h:.9},1)]:regions.map(r=>this.crop(image,this.titleRegion(r)));
      const hash=crypto.createHash('sha256').update(Buffer.concat(crops.map(c=>c.toPNG()))).digest('hex');
      if(hash===this.lastHash&&!force&&!enemy&&this.lastComplete)return {unchanged:true};
      if(!enemy)this.lastHash=hash;
      await this.ready();
      await this.worker.setParameters({tessedit_pageseg_mode:enemy?'11':'6'});
      const results=[];
      for(let i=0;i<crops.length;i++){
        this.onStatus(enemy?'Đã chụp game · đang đọc lõi đối thủ…':`Đã chụp game · đang đọc thẻ ${i+1}/3…`);
        const pixels=enemy?null:fingerprint(this.crop(image,regions[i],1));
        const previous=enemy||fresh?null:this.previousCards[i];
        const {data}=await this.worker.recognize(crops[i].toPNG());
        let matched=matchAugment(data.text,augments),pass=enemy?'toàn giao diện':'dòng tên';
        if(!enemy&&!matched.match&&previous?.id){
          const sameCandidate=matched.candidates?.[0]?.id===previous.id&&matched.confidence>=.65;
          if(sameCandidate||imageDifference(pixels,previous.pixels)<.015){matched={...matched,match:augments.find(a=>a.id===previous.id)||null};pass='giữ thẻ cùng ảnh';}
        }
        results.push({text:data.text,confidence:data.confidence,match:matched,pass,pixels});
      }
      if(enemy){
        const lines=results[0].text.split(/\n+/).filter(l=>normalize(l).length>=5);
        const found=[...new Map(lines.map(t=>matchAugment(t,augments)).filter(r=>r.match).map(r=>[r.match.id,{id:r.match.id,name:r.match.name,confidence:r.confidence}])).values()];
        return {enemy:true,found,text:results[0].text,scannedAt:Date.now()};
      }
      if(!quick||results.some(r=>r.match.match)){
        for(let i=0;i<results.length;i++){
          if(results[i].match.match)continue;
          this.onStatus(`Đang kiểm tra thêm thẻ ${i+1}/3…`);
          const full=await this.worker.recognize(this.crop(image,regions[i],1).toPNG());
          const alternate=matchAugment(full.data.text,augments);
          if(alternate.match||alternate.confidence>results[i].match.confidence){results[i].match=alternate;results[i].pass='toàn thẻ';results[i].text=full.data.text;results[i].confidence=full.data.confidence;}
        }
      }
      this.previousCards=results.map(r=>({id:r.match.match?.id||null,pixels:r.pixels}));
      this.lastComplete=results.every(r=>r.match.match?.id);
      return {offers:results.map(r=>r.match.match?.id||null),matches:results.map(r=>({id:r.match.match?.id||null,confidence:r.match.confidence,candidates:r.match.candidates,pass:r.pass})),scannedAt:Date.now()};
    }finally{this.busy=false;}
  }
  async inspect(augments,saveImage){
    if(this.busy||this.watching)return {busy:true};
    this.busy=true;
    try{
      const image=await this.capture();
      await saveImage(image.toPNG());
      await this.ready();
      await this.worker.setParameters({tessedit_pageseg_mode:'11'});
      const result=await this.worker.recognize(image.toPNG());
      const found=[...new Map(result.data.text.split(/\n+/).map(line=>matchAugment(line,augments)).filter(r=>r.match).map(r=>[r.match.id,{id:r.match.id,name:r.match.name,confidence:r.confidence}])).values()];
      return {found,text:result.data.text,scannedAt:Date.now()};
    }finally{this.busy=false;}
  }
  async close(){const worker=this.worker;this.worker=null;await worker?.terminate();}
}
module.exports={OcrReader};
