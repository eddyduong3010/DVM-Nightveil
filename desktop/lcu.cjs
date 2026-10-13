const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

const agent=new https.Agent({keepAlive:true,maxSockets:4,maxFreeSockets:2,timeout:5000});
// Certificate exception is confined to the two League loopback clients.
function localGet(port, pathname, auth, signal) {
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname:'127.0.0.1',port,path:pathname,method:'GET',rejectUnauthorized:false,timeout:1800,headers:auth?{Authorization:'Basic '+Buffer.from('riot:'+auth).toString('base64')}:{},agent,signal},r=>{
      if(r.statusCode!==200){r.resume();reject(new Error('CLIENT_'+r.statusCode));return;}
      r.on('error',reject);r.on('aborted',()=>reject(new Error('CLIENT_ABORTED')));
      const chunks=[];let bytes=0;r.on('data',c=>{bytes+=c.length;if(bytes>4*1024*1024){req.destroy(new Error('CLIENT_SIZE'));return;}chunks.push(c);});
      r.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('CLIENT_FORMAT'));}});
    });const deadline=setTimeout(()=>req.destroy(new Error('CLIENT_DEADLINE')),2500);req.on('close',()=>clearTimeout(deadline));req.on('timeout',()=>req.destroy(new Error('CLIENT_TIMEOUT')));req.on('error',reject);req.end();
  });
}
class LeagueReader {
  constructor({get=localGet,now=Date.now}={}){this.credentials=null;this.lastDiscovery=0;this.extraDirectory='';this.get=get;this.now=now;this.requests=new Set();this.session=null;this.sessionAt=0;this.phase=null;this.failures=0;}
  request(port,url,auth){const controller=new AbortController();this.requests.add(controller);return Promise.resolve().then(()=>this.get(port,url,auth,controller.signal)).finally(()=>this.requests.delete(controller));}
  invalidate(){this.credentials=null;this.clientVersion=null;this.session=null;this.sessionAt=0;this.lastDiscovery=0;}
  close(){for(const r of this.requests)r.abort();this.requests.clear();agent.destroy();}
  discover(){if(!this.discovery)this.discovery=this.discoverOnce().finally(()=>{this.discovery=null;});return this.discovery;}
  async discoverOnce(){
    if(this.credentials)return this.credentials;
    if(this.now()-this.lastDiscovery<12000)return null;this.lastDiscovery=this.now();
    const dirs=[this.extraDirectory,'C:\\Riot Games\\League of Legends','D:\\Riot Games\\League of Legends','D:\\Games\\League of Legends','C:\\Games\\League of Legends'].filter(Boolean);
    for(const dir of dirs){try{const parts=(await fs.readFile(path.join(dir,'lockfile'),'utf8')).trim().split(':');const port=Number(parts[2]);if(parts.length>=5&&port>0&&port<65536&&parts[3])return this.credentials={port,password:parts[3]};}catch{}}
    try{
      const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty ExecutablePath"],{windowsHide:true,timeout:5000});
      for(const line of stdout.trim().split(/\r?\n/))if(/LeagueClientUx\.exe$/i.test(line.trim()))dirs.unshift(path.dirname(line.trim()));
    }catch{}
    for(const dir of [...new Set(dirs)]){
      try{const s=(await fs.readFile(path.join(dir,'lockfile'),'utf8')).trim().split(':');const port=Number(s[2]);if(s.length>=5&&port>0&&port<65536&&s[3]){this.credentials={port,password:s[3]};return this.credentials;}}catch{}
    }
    return null;
  }
  async readClient(){
    const auth=await this.discover();if(!auth)return null;
    try{
      const phase=await this.request(auth.port,'/lol-gameflow/v1/gameflow-phase',auth.password);
      if(phase!==this.phase||this.now()-this.sessionAt>=30000||!this.session){this.session=await this.request(auth.port,'/lol-gameflow/v1/session',auth.password).catch(()=>null);this.sessionAt=this.now();}
      this.phase=phase;const session=this.session;this.failures=0;
      let selected=null,championKeys=[];
      if(phase==='ChampSelect'){
        const s=await this.request(auth.port,'/lol-champ-select/v1/session',auth.password).catch(()=>null);
        selected=s?.myTeam?.find(p=>p.cellId===s.localPlayerCellId)?.championId || null;
        championKeys=[...(s?.myTeam||[]),...(s?.theirTeam||[])].map(p=>p.championId).filter(Boolean);
      }
      if(!this.clientVersion)this.clientVersion=await this.request(auth.port,'/lol-patch/v1/game-version',auth.password).catch(()=>null);
      return {phase,selectedChampionKey:selected,championKeys,queueId:session?.gameData?.queue?.id||null,gameId:session?.gameData?.gameId||null,version:typeof this.clientVersion==='string'?this.clientVersion:null};
    }catch(e){if(/401|403|ECONNREFUSED|ECONNRESET/.test(e.message)||++this.failures>=3)this.invalidate();return null;}
  }
  async readLive(){return this.request(2999,'/liveclientdata/allgamedata');}
  async readRecentMatches(count=20){
    const auth=await this.discover();if(!auth)throw new Error('CLIENT_UNAVAILABLE');
    return this.request(auth.port,'/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex='+Math.max(0,Math.min(19,count-1)),auth.password);
  }
  async readMatch(gameId){
    if(!/^\d{1,20}$/.test(String(gameId)))throw new Error('INVALID_GAME_ID');
    const auth=await this.discover();if(!auth)throw new Error('CLIENT_UNAVAILABLE');
    return this.request(auth.port,'/lol-match-history/v1/games/'+gameId,auth.password);
  }
}
module.exports={LeagueReader,localGet};
