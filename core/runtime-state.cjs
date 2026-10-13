const {EventEmitter}=require('node:events');
class RuntimeState extends EventEmitter {
 constructor(){super();this.state='DISCONNECTED';this.phase=null;this.focused=false;this.failures=0;this.nextClient=0;this.nextLive=0;this.stopped=false;}
 dispatch(type,payload,now=Date.now()){
  if(this.stopped&&type!=='STOP')return;
  const previous=this.state;
  if(type==='STOP'){this.stopped=true;this.state='STOPPED';}
  else if(type==='SUSPEND')this.state='SUSPENDED';
  else if(type==='RESUME'){this.state='RECONNECTING';this.nextClient=0;this.nextLive=0;this.failures=0;}
  else if(type==='DEMO')this.state='DEMO';
  else if(type==='FOCUS'){this.focused=!!payload;if(this.focused)this.nextLive=Math.min(this.nextLive,now);}
  else if(!this.stopped&&this.state!=='SUSPENDED'){
   if(type==='LIVE_OK'){this.state='LIVE';this.failures=0;}
   if(type==='LIVE_FAIL'){this.failures=Math.min(5,this.failures+1);if(['LIVE','RECONNECTING','LOADING'].includes(this.state))this.state='RECONNECTING';}
   if(type==='CLIENT'){
    this.phase=payload?.phase||null;
    if(['WaitingForStats','PreEndOfGame','EndOfGame'].includes(this.phase))this.state='POSTGAME';
    else if(this.phase==='ChampSelect')this.state='CHAMP_SELECT';
    else if(['GameStart','InProgress','Reconnect'].includes(this.phase)){if(!['LIVE','RECONNECTING'].includes(this.state))this.state='LOADING';}
    else if(payload)this.state='CLIENT';
    else if(this.state!=='LIVE'&&this.state!=='RECONNECTING')this.state='DISCONNECTED';
   }
  }
  if(['LIVE_OK','LIVE_FAIL'].includes(type))this.nextLive=now+this.intervals().live;
  if(previous!==this.state){this.nextClient=Math.min(this.nextClient,now+this.intervals().client);if(!['LIVE_OK','LIVE_FAIL'].includes(type))this.nextLive=Math.min(this.nextLive,now);this.emit('transition',{from:previous,to:this.state,event:type,at:now});}
 }
 intervals(){
  const backoff=Math.min(8000,1000*2**Math.max(0,this.failures-1));
  return {client:({DISCONNECTED:12000,CLIENT:5000,CHAMP_SELECT:1000,LOADING:2000,LIVE:10000,RECONNECTING:4000,POSTGAME:3000})[this.state]||12000,
   live:({DISCONNECTED:15000,CLIENT:8000,CHAMP_SELECT:3000,LOADING:1000,LIVE:this.focused?1000:2500,RECONNECTING:backoff,POSTGAME:10000})[this.state]||15000};
 }
 due(kind,now=Date.now()){if(this.stopped||['SUSPENDED','DEMO'].includes(this.state))return false;const key=kind==='client'?'nextClient':'nextLive';if(now<this[key])return false;this[key]=now+this.intervals()[kind];return true;}
 delay(now=Date.now()){if(this.stopped||['SUSPENDED','DEMO'].includes(this.state))return null;return Math.max(250,Math.min(this.nextClient,this.nextLive)-now);}
}
class StatePublisher {
 constructor(){this.previous=new WeakMap();this.sent=0;this.skipped=0;}
 send(win,state){if(!win||win.isDestroyed())return;const previous=this.previous.get(win),parts={},delta={__partial:true};let changed=false;
  for(const [key,value] of Object.entries(state)){parts[key]=JSON.stringify(value);if(!previous||previous[key]!==parts[key]){delta[key]=value;changed=true;}}
  if(previous)for(const key of Object.keys(previous))if(!(key in parts)){delta[key]=null;changed=true;}
  if(!changed){this.skipped++;return;}this.previous.set(win,parts);win.webContents.send('state:changed',previous?delta:state);this.sent++;
 }
 invalidate(win){this.previous.delete(win);}
}
function validLive(value){return !!value&&Array.isArray(value.allPlayers)&&value.allPlayers.length>0&&value.allPlayers.length<=20&&value.allPlayers.every(p=>p&&typeof p==='object'&&Array.isArray(p.items))&&!!value.activePlayer&&Number.isFinite(value.gameData?.gameTime)&&value.gameData.gameTime>=0;}
module.exports={RuntimeState,StatePublisher,validLive};
