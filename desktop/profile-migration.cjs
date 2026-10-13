const fs=require('node:fs/promises');
const path=require('node:path');

// Old Nightveil builds used a generic profile name. Only import a recognized,
// clean Nightveil profile; never change or remove the source application data.
async function importLegacyNightveil(source,target){
 if(path.resolve(source)===path.resolve(target))return false;
 try{await fs.access(path.join(target,'settings.json'));return false;}catch{}
 let settings,session;
 try{
  settings=JSON.parse(await fs.readFile(path.join(source,'settings.json'),'utf8'));
  session=JSON.parse(await fs.readFile(path.join(source,'crash-diagnostics','session.json'),'utf8'));
 }catch{return false;}
 if(settings.inputSafetyVersion!==2||settings.autoScanVersion!==1||session.clean!==true||!/^0\.[0-8]\./.test(session.version||''))return false;
 await fs.mkdir(target,{recursive:true});
 for(const name of ['settings.json','build-history.json','history.sqlite','catalog.json','augment-references.json','build-references.json','community.json','licensed-combos.json']){
  try{await fs.copyFile(path.join(source,name),path.join(target,name),require('node:fs').constants.COPYFILE_EXCL);}catch{}
 }
 return true;
}
module.exports={importLegacyNightveil};
