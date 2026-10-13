// Centers from the observed 16:9 Mayhem choice screen. Remap with adaptRegions.
const REROLL_REGIONS=[.282,.472,.662].map(x=>({x,y:.681,w:.056,h:.058}));
function clickedReroll(x,y,game,regions=REROLL_REGIONS){
 if(!game||game.width<=0||game.height<=0)return -1;
 const rx=(x-game.x)/game.width,ry=(y-game.y)/game.height;
 return regions.findIndex(r=>rx>=r.x&&rx<=r.x+r.w&&ry>=r.y&&ry<=r.y+r.h);
}
class RerollQueue{
 constructor(){this.serial=0;this.clear();}
 clear(){this.serial++;this.indices=[];this.attempts=0;this.dueAt=0;this.expiresAt=0;this.inFlight=false;}
 get pending(){return this.indices.length>0;}
 request(index,now){
  if(!Number.isInteger(index)||index<0||index>2)return;
  this.serial++;this.indices=[...new Set([...this.indices,index])];this.attempts=0;this.dueAt=now+550;this.expiresAt=now+24000;this.inFlight=false;
 }
 take(now,{busy=false,focused=true,enabled=true}={}){
  if(!this.pending)return null;
  if(now>=this.expiresAt||!enabled){this.clear();return {expired:true};}
  if(busy||!focused||this.inFlight||now<this.dueAt)return null;
  this.inFlight=true;this.attempts++;return {serial:this.serial,indices:[...this.indices],attempt:this.attempts};
 }
 finish(ticket,offers,now){
  if(ticket.serial!==this.serial)return 'stale';
  this.inFlight=false;
  if(offers?.length===3&&offers.every(Boolean)){this.clear();return 'complete';}
  if(this.attempts>=4||now>=this.expiresAt){this.clear();return 'exhausted';}
  this.dueAt=now+900;return 'retry';
 }
}
module.exports={REROLL_REGIONS,clickedReroll,RerollQueue};
