const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
app.disableHardwareAcceleration();
const root=path.join(__dirname,'..');
app.whenReady().then(async()=>{
 try{
  const w=new BrowserWindow({width:256,height:256,frame:false,show:false,transparent:true,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
  const svg=fs.readFileSync(path.join(root,'public/nightveil.svg'),'utf8');
  await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><body style="margin:0;background:transparent;overflow:hidden">'+svg+'</body></html>'));
  await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const img=await w.webContents.capturePage();
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'public/nightveil.png'),img.toPNG());
  const sizes=[16,24,32,48,64,128,256],buffers=sizes.map(size=>img.resize({width:size,height:size,quality:'best'}).toPNG());
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
  sizes.forEach((size,i)=>{const at=6+i*16;header[at]=size===256?0:size;header[at+1]=size===256?0:size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(buffers[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=buffers[i].length;});
  fs.writeFileSync(path.join(root,'assets/nightveil.ico'),Buffer.concat([header,...buffers]));
  console.log('DVM Nightveil icons rendered at 16–256 px');w.destroy();app.quit();
 }catch(e){console.error(e);app.exit(1);}
});
