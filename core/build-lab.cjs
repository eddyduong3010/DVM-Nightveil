'use strict';
const {itemFeatures,AUG}=require('./synergy-graph.cjs');
const mechanics=require('../data/mechanics.json');
const abilities=require('../data/ability-profiles.json');
const {confidence}=require('./evidence.cjs');
const ARCHETYPES=[['ad-burst','AD Burst',['ad','penetration']],['ad-onhit','AD On-hit',['attack','onhit']],['crit','Critical Strike',['crit','attack']],['ap-burst','AP Burst',['ap','penetration']],['ap-burn','AP Burn',['ap','dot']],['ap-dps','AP DPS',['ap','attack']],['armor-tank','Armor Tank',['armor','health']],['mr-tank','Magic Resist Tank',['mr','health']],['bruiser','Bruiser',['ad','health']],['sustain','Sustain',['sustain','health']],['heal-shield','Shield & Heal',['heal','utility']],['haste','Ability Haste',['haste']],['anti-tank','Anti-Tank',['penetration','dot']],['anti-heal','Anti-Heal',['antiheal']],['poke','Poke',['ap','mana']],['hypercarry','Hypercarry',['crit','attack']],['utility','Utility',['utility']],['hybrid','Hybrid',['ap','ad']],['augment','Augment-Centric',[]],['experimental','Experimental',[]]].map(([id,name,tags])=>({id,name,tags,source:'dvm',type:'EDITORIAL',tradeoff:'Ưu tiên '+(tags.join(', ')||'tương tác lõi')+'; đánh đổi ngân sách và ô trang bị cho các hướng còn lại.'}));
function validateBuild(raw,catalog){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Build sai cấu trúc.');
 if(!catalog.champions[raw.champion])throw Error('Tướng không có trong danh mục.');
 const ids=(value,type,max)=>{if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!type(x)))throw Error('Danh sách '+max+' ô không hợp lệ.');if(new Set(value).size!==value.length)throw Error('Trùng lựa chọn.');return value;};
 const items=ids(raw.items||[],id=>!!catalog.items[id],6),augments=ids(raw.augments||[],id=>catalog.augments.some(a=>a.id===id),6);
 if(raw.archetype&&!ARCHETYPES.some(a=>a.id===raw.archetype))throw Error('Hướng chơi không hợp lệ.');
 return {champion:raw.champion,items,augments,archetype:raw.archetype||'ap-burst',patch:String(raw.patch||catalog.patch).slice(0,32),name:String(raw.name||'Build mới').slice(0,120),notes:String(raw.notes||'').slice(0,4000),tags:(Array.isArray(raw.tags)?raw.tags:[]).slice(0,12).map(t=>String(t).slice(0,40)),favorite:raw.favorite===true,archived:raw.archived===true,assumptions:raw.assumptions&&typeof raw.assumptions==='object'?raw.assumptions:{},sources:(Array.isArray(raw.sources)?raw.sources:[]).slice(0,12).map(x=>String(x).slice(0,2048))};
}
function conflicts(items,catalog,champion){
 const result=[];for(const id of items){const x=catalog.items[id];if(!x||!x.gold?.purchasable||x.maps?.['12']===false)result.push({type:'UNAVAILABLE',ids:[id],reason:'Không có hoặc không mua được trong ARAM.'});if(x?.requiredAlly||x?.requiredChampion&&x.requiredChampion!==champion)result.push({type:'RESTRICTION',ids:[id],reason:'Có điều kiện tướng/đồng minh cần xác minh.'});}
 for(const group of mechanics.exclusiveItemGroups){const ids=items.filter(id=>group.includes(id));if(ids.length>1)result.push({type:'EXCLUSIVE',ids,reason:'Cùng nhóm trang bị độc quyền theo quy tắc đã ghi nhận.'});}
 return result;
}
function itemGraph(catalog,id,seen=new Set()){
 if(seen.has(id))return {id,error:'CYCLE'};const x=catalog.items[id];if(!x)return {id,error:'MISSING'};const next=new Set(seen).add(id);
 return {id,name:x.name,cost:x.gold?.total||0,combineCost:x.gold?.base||0,restrictions:[x.requiredChampion,x.requiredAlly].filter(Boolean),components:(x.from||[]).map(c=>itemGraph(catalog,c,next)),upgrades:x.into||[]};
}
function analyze(catalog,raw={},constraints={}){
 const build=validateBuild(raw,catalog),archetype=ARCHETYPES.find(a=>a.id===build.archetype),current=mechanics.patches.includes(catalog.patch)&&build.patch===catalog.patch;
 const locked=[...new Set(constraints.locked||[])],banned=new Set(constraints.banned||[]);if(locked.length>6||locked.some(id=>!catalog.items[id]||banned.has(id)))throw Error('Khóa/cấm trang bị mâu thuẫn.');
 const traits=abilities.patch===catalog.patch?abilities.champions[build.champion]?.abilities||[]:[];
 const features=new Set(traits.flatMap(x=>x.tags));
 const graph={nodes:[{id:'champion:'+build.champion,type:'Champion',label:build.champion}],edges:[]};
 for(const a of traits){const id='ability:'+a.slot;graph.nodes.push({id,type:'ChampionAbility',label:a.slot+' · '+a.name});graph.edges.push({from:graph.nodes[0].id,to:id,type:'HAS_ABILITY',source:'dvm',verification:'EDITORIAL'});}
 const missing=[];
 for(const id of build.augments){const a=catalog.augments.find(a=>a.id===id),rule=current?AUG[id]:null;graph.nodes.push({id:'augment:'+id,type:'Augment',label:a.name});if(!rule)missing.push(a.name+': chưa có mô hình tương tác của patch này.');else if(rule.need&&!rule.need.some(t=>features.has(t)))missing.push(a.name+': cần '+rule.need.join('/')+'; chưa xác minh điều kiện.');else graph.edges.push({from:graph.nodes[0].id,to:'augment:'+id,type:'SUPPORTS_BUILD',source:'dvm',verification:'EDITORIAL',reason:rule.reason});}
 const ranked=Object.values(catalog.items).filter(i=>i.gold?.purchasable&&i.gold.total>=500&&i.maps?.['12']!==false&&!banned.has(i.id)&&!conflicts([...locked.filter(id=>id!==i.id),i.id],catalog,build.champion).length).map(i=>{
 const tags=itemFeatures(i);if(mechanics.antihealComponents.includes(i.id)||['3033','3165','3075'].includes(i.id))tags.add('antiheal');
 const reasons=[];let score=0;for(const tag of archetype.tags)if(tags.has(tag)){score+=10;reasons.push('Chỉ số/cơ chế '+tag+' phù hợp hướng '+archetype.name);}
 if(current)for(const id of build.augments){const rule=AUG[id];if(rule&&(!rule.need||rule.need.some(t=>features.has(t)))&&(rule.items?.includes(i.id)||rule.tag&&tags.has(rule.tag))){score+=7;reasons.push(rule.reason);graph.edges.push({from:'augment:'+id,to:'item:'+i.id,type:'SYNERGIZES_WITH',source:'dvm',verification:'EDITORIAL'});}}
 if(locked.includes(i.id)){score+=100;reasons.push('Người dùng khóa món này.');}
 const evidence={type:'EDITORIAL',source:'dvm',patch:current?catalog.patch:mechanics.patches[0],reliability:.5,recency:.7,completeness:.4,verified:false,agreement:0,uncertainty:.2};
 return {id:i.id,name:i.name,icon:i.icon,score,reasons:reasons.length?reasons:['Chưa có quy tắc phù hợp; không khẳng định đây là món tốt.'],tradeoff:archetype.tradeoff,source:'dvm',patch:catalog.patch,confidence:confidence(evidence,catalog.patch),cost:i.gold.total,graph:itemGraph(catalog,i.id)};
 }).sort((a,b)=>b.score-a.score||a.cost-b.cost||a.id.localeCompare(b.id));
 return {build,archetype,ranked:ranked.slice(0,16),conflicts:conflicts(build.items,catalog,build.champion),missing,graph,patchVerified:current,objective:'Điểm tương thích editorial; không phải tối đa DPS hoặc tỉ lệ thắng',limitations:['Nội tại chưa mô hình hóa không được cộng sát thương.','Nhóm độc quyền ngoài bộ quy tắc hiện có có thể chưa được phát hiện.','Hướng Ability Haste chưa có chỉ số có cấu trúc đủ để xếp hạng.']};
}
function stats(catalog,build,level=1){
 const s=catalog.champions[build.champion]?.stats||{},growth=(.7025+.0175*level)*(level-1),out={ad:(s.attackdamage||0)+(s.attackdamageperlevel||0)*growth,ap:0,selfHP:(s.hp||0)+(s.hpperlevel||0)*growth,selfArmor:(s.armor||0)+(s.armorperlevel||0)*growth,selfMR:(s.spellblock||0)+(s.spellblockperlevel||0)*growth,crit:s.crit||0,attackRate:s.attackspeed||0};
 const map={FlatPhysicalDamageMod:'ad',FlatMagicDamageMod:'ap',FlatHPPoolMod:'selfHP',FlatArmorMod:'selfArmor',FlatSpellBlockMod:'selfMR',FlatCritChanceMod:'crit'};let attackSpeed=(s.attackspeedperlevel||0)*growth/100;
 for(const id of build.items||[]){const it=catalog.items[id]?.stats||{};for(const [key,to] of Object.entries(map))out[to]+=it[key]||0;attackSpeed+=it.PercentAttackSpeedMod||0;}
 out.attackRate*=1+attackSpeed;out.crit=Math.min(1,out.crit);return out;
}
module.exports={ARCHETYPES,validateBuild,conflicts,itemGraph,analyze,stats};
