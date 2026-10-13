const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
// Installed production graph only, including transitive runtime libraries.
const root=path.join(__dirname,'..'),lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'))),rows=[];
let notice='DVM Nightveil — third-party runtime components\nGenerated from installed package-lock. Game assets retain their separate owners.\n\n';
for(const [key,entry] of Object.entries(lock.packages||{})){
 if(!key||entry.dev)continue;const dir=path.join(root,key);let pkg;try{pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));}catch{continue;}
 rows.push({name:pkg.name,version:pkg.version,license:pkg.license||'UNKNOWN',integrity:entry.integrity||null});
 notice+='\n=== '+pkg.name+' '+pkg.version+' ('+(pkg.license||'UNKNOWN')+') ===\n';
 for(const file of fs.readdirSync(dir).filter(n=>/^(license|copying|notice)(\.|$)/i.test(n)&&fs.statSync(path.join(dir,n)).isFile()))notice+=fs.readFileSync(path.join(dir,file),'utf8')+'\n';
}
notice+='\nElectron embeds Chromium/Node and their notices. Keep LICENSE and LICENSES.chromium.html in the application directory.\nOCR models: Tesseract tessdata (Apache-2.0); game data: Riot Games; community combos: arammayhem.com CC BY 4.0. See docs/DATA-RIGHTS.md.\n';
fs.writeFileSync(path.join(root,'THIRD-PARTY-NOTICES.txt'),notice);fs.writeFileSync(path.join(root,'dependency-inventory.json'),JSON.stringify(rows,null,2)+'\n');console.log('Runtime components: '+rows.length);
