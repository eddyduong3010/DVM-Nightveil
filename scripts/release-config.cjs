const fs=require('node:fs'),path=require('node:path');
function configuration(env){
 const repo=env.GITHUB_REPOSITORY||'eddyduong3010/DVM-Nightveil';
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Invalid repository');
 const signed=env.RELEASE_SIGNED==='true',publicFeed=env.PUBLIC_UPDATE_FEED==='true',publisher=env.WINDOWS_PUBLISHER||'';
 if(signed&&(!publisher||!env.CSC_LINK||!env.CSC_KEY_PASSWORD))throw Error('Signed release requires WINDOWS_PUBLISHER, CSC_LINK and CSC_KEY_PASSWORD');
 if(publicFeed&&!signed)throw Error('Public updates require signed releases');
 const [owner,name]=repo.split('/');
 return {metadata:{updatesEnabled:signed&&publicFeed,publisher:signed?publisher:'',channel:signed?'stable':'preview',repository:repo},builder:{forceCodeSigning:signed,...(publicFeed?{publish:[{provider:'github',owner,repo:name,releaseType:'draft'}]}:{publish:null}),win:{target:['nsis','dir'],icon:'assets/nightveil.ico',verifyUpdateCodeSignature:true,...(signed?{publisherName:publisher}:{})}}};
}
if(require.main===module){const root=path.join(__dirname,'..'),c=configuration(process.env),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));fs.writeFileSync(path.join(root,'data/release.json'),JSON.stringify(c.metadata));fs.writeFileSync(path.join(root,'release-config.json'),JSON.stringify({...pkg.build,...c.builder}));console.log('Release configuration: '+c.metadata.channel);}
module.exports={configuration};
