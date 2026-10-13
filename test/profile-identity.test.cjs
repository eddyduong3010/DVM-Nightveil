const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {importLegacyNightveil}=require('../desktop/profile-migration.cjs');
test('only a recognized clean Nightveil profile is copied, never moved',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nightveil-profile-'));
 try{
  const old=path.join(root,'mayhem-companion'),next=path.join(root,'dvm-nightveil');
  await fs.mkdir(path.join(old,'crash-diagnostics'),{recursive:true});
  await fs.writeFile(path.join(old,'settings.json'),JSON.stringify({inputSafetyVersion:2,autoScanVersion:1,overlayEnabled:true}));
  await fs.writeFile(path.join(old,'crash-diagnostics','session.json'),JSON.stringify({clean:true,version:'0.8.0'}));
  await fs.writeFile(path.join(old,'history.sqlite'),'history');
  assert.equal(await importLegacyNightveil(old,next),true);
  assert.equal((await fs.readFile(path.join(next,'history.sqlite'),'utf8')),'history');
  assert.equal((await fs.readFile(path.join(old,'history.sqlite'),'utf8')),'history');
  assert.equal(await importLegacyNightveil(old,next),false);
  const other=path.join(root,'other');await fs.writeFile(path.join(old,'crash-diagnostics','session.json'),JSON.stringify({clean:true,version:'1.0.0'}));
  assert.equal(await importLegacyNightveil(old,other),false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
