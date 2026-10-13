const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');

test('Electron entry point and local client reader parse before packaging',()=>{
  for(const file of ['desktop','core','scripts'].flatMap(dir=>fs.readdirSync(path.join(__dirname,'..',dir)).filter(f=>f.endsWith('.cjs')).map(f=>dir+'/'+f))){
    const result=spawnSync(process.execPath,['--check',path.join(__dirname,'..',file)],{encoding:'utf8'});
    assert.equal(result.status,0,`${file}: ${result.stderr}`);
  }
});
