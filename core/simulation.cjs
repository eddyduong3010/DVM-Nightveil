'use strict';
// All coefficients are supplied by the scenario; no champion-specific formula is invented.
const VERSION='1.0-assumption-model';
function number(v,defaultValue,min,max){if(v===undefined)return defaultValue;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Thông số mô phỏng ngoài giới hạn.');return v;}
function resistance(r){return r>=0?100/(100+r):2-100/(100-r);}
function effectiveResistance(base,percentReduction=0,flatReduction=0,percentPen=0,flatPen=0){
 const reduced=base*(1-percentReduction)-flatReduction;
 return reduced<=0?reduced:Math.max(0,reduced*(1-percentPen)-flatPen);
}
function simulate(raw={}){
 const n=(key,d,min=0,max=1e7)=>number(raw[key],d,min,max);
 const duration=n('duration',5,.1,600),hitRate=n('hitRate',1,0,1),uptime=n('uptime',1,0,1),targets=n('targets',1,1,10);
 const hp=n('targetHP',3000,1),shield=n('targetShield',0),reduction=n('reduction',0,0,.99),amp=n('amplification',0,0,10);
 const armor=effectiveResistance(n('armor',100,-1000,1e5),n('armorReductionPercent',0,0,1),n('armorReductionFlat',0),n('armorPenPercent',0,0,1),n('armorPenFlat',0));
 const mr=effectiveResistance(n('mr',80,-1000,1e5),n('mrReductionPercent',0,0,1),n('mrReductionFlat',0),n('magicPenPercent',0,0,1),n('magicPenFlat',0));
 const ad=n('ad',0),ap=n('ap',0),crit=n('crit',0,0,1),critMultiplier=n('critMultiplier',1.75,1,10),attackRate=n('attackRate',0,0,20),haste=n('haste',0,0,1000);
 const attacks=Math.floor(duration*attackRate*uptime+1e-8),warnings=['Giá trị mô phỏng lý thuyết — không phải tỉ lệ thắng thực tế.','Mọi hệ số là giả định đầu vào; chưa xác minh toàn bộ cơ chế Mayhem.'];
 const breakdown=[{id:'attacks',label:'Đánh thường (kỳ vọng chí mạng)',type:'physical',raw:attacks*ad*(1+crit*(critMultiplier-1)),count:attacks}];
 if(raw.effects!==undefined&&!Array.isArray(raw.effects))throw Error('Danh sách hiệu ứng không hợp lệ.');
 const unique=new Set();const effects=Array.isArray(raw.effects)?raw.effects:[];if(effects.length>64)throw Error('Tối đa 64 hiệu ứng.');
 for(const effect of effects){
  if(!effect||!['physical','magic','true','heal','shield'].includes(effect.type))throw Error('Loại hiệu ứng không hợp lệ.');
  if(effect.unsupported){warnings.push('Unsupported: '+String(effect.id).slice(0,80));continue;}
  if(effect.unique&&unique.has(effect.unique)){warnings.push('Bỏ hiệu ứng unique trùng: '+effect.unique);continue;}if(effect.unique)unique.add(effect.unique);
  if(effect.condition===false){warnings.push('Điều kiện chưa đạt: '+effect.id);continue;}
  const cooldown=number(effect.cooldown,0,0,600)/(1+haste/100),icd=number(effect.icd,0,0,600),interval=Math.max(cooldown,icd);
  // Half-open time window [0,duration); no proc exactly at the end.
  const requested=effect.trigger==='attack'?attacks:number(effect.count,1,0,10000);
  const count=Math.min(requested,interval>0?Math.ceil(duration*uptime/interval):requested);
  const value=number(effect.base,0,0,1e7)+number(effect.apRatio,0,0,100)*ap+number(effect.adRatio,0,0,100)*ad+number(effect.hpRatio,0,0,10)*hp;
  const stacks=number(effect.stacks,1,0,1000),maxStacks=number(effect.maxStacks,1,0,1000);
  breakdown.push({id:String(effect.id||'effect').slice(0,80),label:String(effect.label||effect.id||'Hiệu ứng').slice(0,120),type:effect.type,count,raw:value*count*Math.min(stacks,maxStacks),source:effect.source||'USER_ASSUMPTION'});
 }
 let physical=0,magic=0,trueDamage=0,healing=0,shielding=0;
 for(const row of breakdown){const damage=['physical','magic','true'].includes(row.type);row.value=row.raw*(damage?hitRate*targets:1);if(row.type==='physical')row.value*=resistance(armor)*(1+amp)*(1-reduction);if(row.type==='magic')row.value*=resistance(mr)*(1+amp)*(1-reduction);if(row.type==='physical')physical+=row.value;else if(row.type==='magic')magic+=row.value;else if(row.type==='true')trueDamage+=row.value;else if(row.type==='heal')healing+=row.value;else shielding+=row.value;}
 const total=physical+magic+trueDamage,afterShield=Math.max(0,total-shield*targets),selfHP=n('selfHP',2000,1),selfArmor=n('selfArmor',50,-1000,1e5),selfMR=n('selfMR',50,-1000,1e5);
 const result={version:VERSION,status:'APPROXIMATE',duration,total,dps:total/duration,afterShield,physical,magic,trueDamage,healing,shielding,physicalEHP:(selfHP+shielding)/resistance(selfArmor),magicEHP:(selfHP+shielding)/resistance(selfMR),armor,mr,attacks,breakdown,warnings,assumptions:raw};
 for(const v of Object.values(result))if(typeof v==='number'&&!Number.isFinite(v))throw Error('Kết quả không hữu hạn.');return result;
}
function sensitivity(raw){return [0,50,100,150,200,300].map(r=>({resistance:r,dps:simulate({...raw,armor:r,mr:r}).dps}));}
module.exports={VERSION,simulate,sensitivity,resistance,effectiveResistance};
