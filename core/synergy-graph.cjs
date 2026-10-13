const abilities=require('../data/ability-profiles.json');
const mechanics=require('../data/mechanics.json');
const RULE_SOURCE='DVM · quy tắc tương tác, không phải mô phỏng sát thương';
const FOCUSES={auto:{name:'Cân bằng',tradeoff:'Dung hòa nhiều nhu cầu; không tối đa một chỉ số.'},damage:{name:'Damage · Sát thương',tradeoff:'Ít chống chịu hơn; cần có cơ hội gây sát thương.'},survival:{name:'Survivability · Sống sót',tradeoff:'Chậm ngưỡng sát thương; không bảo đảm thoát mọi khống chế.'},antitank:{name:'Anti-Tank · Phá chống chịu',tradeoff:'Đổi sức mạnh dồn sát thương lấy khả năng xử lý giáp, kháng phép hoặc máu.'},sustain:{name:'Sustain · Duy trì',tradeoff:'Cần thời gian đánh hoặc dùng kỹ năng; giảm hiệu quả khi bị giảm hồi máu.'},utility:{name:'Utility · Hỗ trợ đội',tradeoff:'Hy sinh một phần sát thương cá nhân; phụ thuộc đồng đội tận dụng hiệu ứng.'},experimental:{name:'Experimental · Thử nghiệm',tradeoff:'Phụ thuộc điều kiện lõi và cách đánh; độ tin cậy thấp, chưa kiểm chứng trong trận.'},augment:{name:'Theo lõi đã chọn',tradeoff:'Ưu tiên khai thác lõi; có thể lệch nhịp trang bị thông thường.'}};
const AUG={
 ARAM_Marksmage:{need:['ap'],items:['3115','3100'],tag:'attack',reason:'Có SMPT và cần xen đánh thường an toàn.'},
 ARAM_DualWield:{need:['attack','onhit'],items:['3153','3124','3115'],tag:'onhit',reason:'Tận dụng đòn đánh liên tục; cần kiểm tra điều kiện proc của lõi.'},
 ARAM_WitchfulThinking:{need:['ap','spell'],tag:'ap',reason:'SMPT hỗ trợ các kỹ năng có hướng phép.'},
 ARAM_JeweledGauntlet:{need:['spell'],tag:'ap',reason:'Lõi sát thương kỹ năng phù hợp hướng phép; không giả định mọi hiệu ứng đều chí mạng.'},
 ARAM_Vulnerability:{need:['dot'],items:['6653'],tag:'dot',reason:'Có sát thương kéo dài phù hợp; phải kiểm tra từng hiệu ứng có được lõi áp dụng.'},
 ARAM_FirstAidKit:{need:['heal','shield'],items:['6617','3107','3504'],tag:'heal',reason:'Bộ kỹ năng có hồi máu hoặc lá chắn hỗ trợ đồng đội.'},
 ARAM_Cruelty:{need:['cc'],items:['2502'],tag:'defense',reason:'Có khống chế để khai thác lõi; không coi làm chậm là bất động.'},
 ARAM_Earthwake:{need:['dash'],items:['3152','6692'],tag:'damage',reason:'Có lướt hoặc dịch chuyển; còn phụ thuộc tầm và nhịp sử dụng.'},
 ARAM_Minionmancer:{need:['pets'],tag:'ap',reason:'Có triệu hồi; cần đối chiếu loại đơn vị được lõi hỗ trợ.'},
 ARAM_StackosaurusRex:{need:['stacks'],tag:'damage',reason:'Có cơ chế cộng dồn; kiểm tra loại cộng dồn tương thích.'},
 ARAM_ApexInventor:{items:['3157','3102','3107'],reason:'Trang bị có hồi chiêu có thể tận dụng hồi trang bị.'},
 ARAM_Goliath:{tag:'health',reason:'Hướng tăng độ bền; đánh đổi khả năng né và tiếp cận.'},
 ARAM_ThreadtheNeedle:{tag:'penetration',reason:'Có nền xuyên kháng; tiếp tục cân nhắc lượng kháng thực tế của địch.'}
};
function itemFeatures(item){const s=item?.stats||{},id=String(item?.id);const tags=new Set();if(s.FlatMagicDamageMod>0)tags.add('ap');if(s.FlatPhysicalDamageMod>0)tags.add('ad');if(s.PercentAttackSpeedMod>0)tags.add('attack');if(s.FlatCritChanceMod>0)tags.add('crit');if(s.FlatHPPoolMod>0)tags.add('health');if(s.FlatArmorMod>0)tags.add('armor');if(s.FlatSpellBlockMod>0)tags.add('mr');if(s.FlatMPPoolMod>0)tags.add('mana');
 for(const [tag,ids] of Object.entries({onhit:['3153','3124','3115','3091'],penetration:['3135','3137','3036','3033','6694','3071'],sustain:['3072','3153','3065','6617','3107','4633'],heal:['6617','3107','3504','3222','6621'],utility:['3116','3071','3107','3222','6617','3110'],dot:['6653'],defense:['3157','3102','3053','3156','3143','4401','3065']}))if(ids.includes(id))tags.add(tag);
 if(tags.has('armor')||tags.has('mr'))tags.add('defense');if(tags.has('ap')||tags.has('ad')||tags.has('attack'))tags.add('damage');return tags;}
function context(data,champ,owned,profile,enemies=[],community=null){
 const current=mechanics.patches.includes(data.patch)&&abilities.patch===data.patch;
 const detailed=current?abilities.champions[champ]:null;
 const features=new Set(detailed?.abilities.flatMap(a=>a.tags)||[]);
 if(!detailed){if(profile.magic)features.add('ap');features.add('spell');if(['adc','onhit','fighter'].includes(profile.role))features.add('attack');if(profile.role==='onhit')features.add('onhit');if(profile.healer)features.add('heal');if(profile.dot)features.add('dot');if(profile.cc)features.add('cc');if(profile.dash)features.add('dash');}
 const nodes=[{id:'champion:'+champ,type:'Champion',label:champ}],edges=[],warnings=[];
 if(detailed)for(const a of detailed.abilities){const id='ability:'+champ+':'+a.slot;nodes.push({id,type:'Ability',label:a.slot+' · '+a.name,source:detailed.source,features:a.tags});edges.push({from:nodes[0].id,to:id,type:'hasAbility'});}
 const known=[...new Set(owned)],active=[];
 for(const id of known){nodes.push({id:'augment:'+id,type:'Augment',label:data.augments.find(a=>a.id===id)?.name||id});const r=current?AUG[id]:null;
  if(!r){warnings.push({code:'unmodeled',subject:id,message:'Chưa mô hình hóa tương tác lõi '+id+' cho bản này.'});continue;}
  if(r.need&&!r.need.some(t=>features.has(t))){warnings.push({code:'unmet-condition',subject:id,message:'Lõi '+id+' cần '+r.need.join(' / ')+'; chưa tìm thấy cơ chế tương ứng của tướng.'});continue;}
  active.push(id);for(const n of nodes.filter(n=>n.type==='Ability'&&(!r.need||n.features.some(t=>r.need.includes(t)))))edges.push({from:n.id,to:'augment:'+id,type:'enables',reason:r.reason,source:detailed.source});
 }
 if(!current)warnings.push({code:'patch-unverified',message:'Patch mới: tắt bonus tương tác đã gắn bản cũ; cần rà soát lại cơ chế.'});
 const combos=[];
 if(active.includes('ARAM_Marksmage')&&active.includes('ARAM_WitchfulThinking'))combos.push({id:'ap-attacks',ids:['ARAM_Marksmage','ARAM_WitchfulThinking'],items:['3115','3100'],reason:'SMPT cộng với lõi đòn đánh tạo hướng xen đánh thường; chỉ mạnh nếu tiếp cận an toàn.'});
 for(const c of combos){nodes.push({id:'combo:'+c.id,type:'AugmentCombo',label:c.reason});for(const id of c.ids)edges.push({from:'augment:'+id,to:'combo:'+c.id,type:'combines'});}
 const sourceOK=community?.patch===data.patch&&community?.license==='CC BY 4.0'&&community?.source==='https://arammayhem.com/data/';
 const observations=sourceOK?known.flatMap(id=>{const x=community.popularity?.[id];return Number.isFinite(x?.pickRate)&&x.pickRate>=0&&x.pickRate<=100?[{id,pickRate:x.pickRate,meaning:'Tỷ lệ chọn toàn nguồn, không phải sức mạnh theo tướng',source:community.source,statsDate:community.statsDate,patch:data.patch}]:[]}):[];
 if(sourceOK)for(const c of community.combos||[])if(c.champion===champ&&c.ids.length>1&&c.ids.every(id=>known.includes(id))){nodes.push({id:'community-combo:'+c.id,type:'AugmentCombo',label:'Combo cộng đồng',source:community.source});for(const id of c.ids)edges.push({from:'augment:'+id,to:'community-combo:'+c.id,type:'observedTogether',source:community.source});if(c.types.some(t=>['trap','bug'].includes(t)))warnings.push({code:'community-warning',message:'Combo cộng đồng có nhãn bẫy/lỗi; không cộng điểm tương tác.'});}
 return {current,detailed:!!detailed,features:[...features],active,combos,warnings,observations,graph:{nodes,edges},source:detailed?.source||'https://developer.riotgames.com/docs/lol#data-dragon',enemies};
}
function scoreItem(item,ctx,focus,profile){const tags=itemFeatures(item),reasons=[];let value=0;const add=(points,reason,from,type='supports')=>{value+=points;reasons.push({points,reason,from,type,to:'item:'+item.id,source:RULE_SOURCE});};
 if(ctx.current){for(const id of ctx.active){const r=AUG[id];if(r.items?.includes(String(item.id))||r.tag&&tags.has(r.tag))add(7,r.reason,'augment:'+id);}for(const c of ctx.combos)if(c.items.includes(String(item.id)))add(9,c.reason,'combo:'+c.id);}
 if(!profile.mana&&tags.has('mana'))add(-18,'Không dùng năng lượng: phần chỉ số năng lượng bị lãng phí.','champion:'+profile.id,'conflicts');
 if(ctx.current&&focus==='antitank'&&(tags.has('penetration')||tags.has('dot')||item.id==='3153'))add(20,'Ưu tiên xử lý kháng hoặc máu; chưa có số liệu để mô phỏng DPS.','archetype:antitank');
 if(ctx.current&&focus==='sustain'&&tags.has('sustain'))add(18,'Ưu tiên hồi phục trong giao tranh kéo dài.','archetype:sustain');
 if(ctx.current&&focus==='utility'&&tags.has('utility'))add(17,'Ưu tiên hiệu ứng mà đội có thể tận dụng.','archetype:utility');
 if(ctx.current&&focus==='experimental'&&ctx.active.some(id=>AUG[id].items?.includes(item.id)))add(18,'Thử nhánh trang bị tương tác với lõi đã chọn.','archetype:experimental');
 return {value:Math.max(-25,Math.min(35,value)),reasons,tags:[...tags]};}
function eligible(ctx,p){return ['auto','damage','survival',...((['mage','adc','onhit','fighter','assassin'].includes(p.role))?['antitank']:[]),...((p.healer||p.sustain||['adc','onhit','fighter','tank'].includes(p.role))?['sustain']:[]),...((p.healer||p.cc||p.dot||['tank','support','fighter'].includes(p.role))?['utility']:[]),...(ctx.active.length?['experimental','augment']:[])];}
function pool(focus,p){if(focus==='antitank')return p.magic?[3135,3137,6653]:p.role==='fighter'?[3071,3153]:[3036,3153,6694];if(focus==='sustain')return p.healer?[6617,3107]:p.magic?[4633,3065]:p.role==='tank'?[3065,3083]:[3072,3153,3065];if(focus==='utility')return p.healer?[6617,3107,3222,3504]:p.magic?[3116,3137]:p.role==='tank'?[3110,3107]:[3071];return [];}
module.exports={FOCUSES,AUG,context,scoreItem,itemFeatures,eligible,pool,RULE_SOURCE};
