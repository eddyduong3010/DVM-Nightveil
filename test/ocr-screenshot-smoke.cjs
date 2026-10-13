const {app,nativeImage}=require('electron');
const path=require('node:path');
const {OcrReader}=require('../desktop/ocr.cjs');
const catalog=require('../data/catalog.json');
const regions=[{x:.18,y:.26,w:.20,h:.44},{x:.40,y:.26,w:.20,h:.44},{x:.62,y:.26,w:.20,h:.44}];
app.whenReady().then(async()=>{
 const file=process.argv[2];if(!file)throw Error('Pass an existing game screenshot path.');
 const reader=new OcrReader(path.join(__dirname,'..','data'),message=>console.log(message));
 try{
  const image=nativeImage.createFromPath(path.resolve(file));if(image.isEmpty())throw Error('Cannot open screenshot.');
  reader.capture=async()=>image;
  const result=await reader.scan(catalog.augments,regions,{force:true});
  console.log(JSON.stringify({size:image.getSize(),offers:result.offers,matches:result.matches.map(x=>({id:x.id,confidence:x.confidence,pass:x.pass,candidates:x.candidates?.slice(0,2)}))},null,2));
  if(result.offers.filter(Boolean).length<2)process.exitCode=1;
 }catch(error){console.error(error);process.exitCode=1;}finally{await reader.close();app.quit();}
}).catch(error=>{console.error(error);process.exitCode=1;app.quit();});
