const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const {quotePurchase,conflicts}=require('./inventory.cjs');
const mechanics=require('../data/mechanics.json');
const synergy=require('./synergy-graph.cjs');
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const finite = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const inSet = (name, csv) => csv.split(' ').includes(name);
function championId(player, data) {
  if (!player) return '';
  const raw = (player.rawChampionName || '').replace(/^game_character_displayname_/, '');
  return data.champions[raw] ? raw : Object.keys(data.champions).find(id => normalize(id) === normalize(player.championName) || normalize(data.champions[id].name) === normalize(player.championName)) || raw || player.championName || '';
}
function profile(id, data, override = 'auto') {
  const c = data.champions[id]; const tags = c?.tags || [];
  let role = ({Marksman:'adc',Mage:'mage',Tank:'tank',Assassin:'assassin',Fighter:'fighter',Support:'support'})[tags[0]] || 'fighter';
  if (inSet(id, 'Sona Soraka Janna Nami Lulu Milio Yuumi Renata Ivern Karma Taric')) role = 'support';
  if (inSet(id, 'Kayle Kaisa KogMaw Vayne Varus Kalista MasterYi')) role = 'onhit';
  if (inSet(id, 'Amumu Maokai Sejuani Leona Rell Nautilus Braum Alistar Rammus Malphite Zac TahmKench DrMundo Sion Chogath Ornn Shen KSante')) role = 'tank';
  if (inSet(id, 'Akali Katarina Diana Fizz Ekko Evelynn Gwen Vladimir Lillia Singed Kennen Gragas Teemo')) role = 'mage';
  if (override !== 'auto') role = override;
  return { id, role, ranged: (c?.stats?.attackrange || 125) > 300, magic: ['mage', 'support'].includes(role),
    mana: (c?.stats?.mp || 0) > 200,
    healer: inSet(id, 'Sona Soraka Janna Nami Lulu Milio Yuumi Renata Ivern Karma Taric Seraphine Senna Nidalee Kayle'),
    sustain: inSet(id, 'Aatrox Briar Warwick Vladimir Mundo DrMundo Swain Olaf Sylas Zac Rhaast Fiora Illaoi'),
    cc: inSet(id, 'Amumu Maokai Sejuani Leona Rell Nautilus Braum Alistar Rammus Malphite Zac TahmKench Morgana Lux Lissandra Neeko Kennen Galio Gragas Sion Chogath Ashe Rakan Thresh Blitzcrank Veigar Pantheon Singed Anivia'),
    dash: inSet(id, 'Akali Irelia Yasuo Yone Riven Fiora Lucian Kalista Vayne Fizz Ekko Diana Katarina Pyke LeeSin Renekton Kaisa Samira Nilah Gwen'),
    dot: inSet(id, 'Brand Zyra Malzahar Teemo Cassiopeia Singed Swain Lillia Rumble'),
    longRangeSpell: inSet(id, 'Lux Xerath Ziggs Velkoz Zoe Jayce Nidalee Ezreal Jhin Varus Ashe Caitlyn Kaisa KogMaw Seraphine Hwei AurelionSol'),
    pets: inSet(id, 'Zyra Malzahar Heimerdinger Yorick Annie Ivern Shaco'),
    stacks: inSet(id, 'Veigar Nasus Sion Chogath Senna Smolder Thresh AurelionSol Kindred') };
}
const roles = { adc: 'Xạ thủ chí mạng', onhit: 'Đánh thường / đòn đánh', mage: 'Sát thương phép', tank: 'Chống chịu', fighter: 'Đấu sĩ', assassin: 'Sát lực', support: 'Hồi máu / tạo khiên' };
function findSelf(snapshot){
  const active=snapshot?.activePlayer;
  if(!active)return null;
  return (snapshot.allPlayers||[]).find(p=>
    (active.riotId&&playerKey(p)===active.riotId)||
    (active.summonerName&&p.summonerName===active.summonerName))||null;
}
function inferRole(champ,data,snapshot,override='auto',augments=[]){
  if(override!=='auto')return override;
  const base=profile(champ,data).role;
  const self=findSelf(snapshot);
  const items=(self?.items||[]).map(i=>data.items[String(i.itemID)]).filter(Boolean);
  const ap=items.reduce((n,i)=>n+finite(i.stats?.FlatMagicDamageMod),0),ad=items.reduce((n,i)=>n+finite(i.stats?.FlatPhysicalDamageMod),0);
  const tankItems=items.filter(i=>finite(i.stats?.FlatHPPoolMod)>=250&&(finite(i.stats?.FlatArmorMod)>=40||finite(i.stats?.FlatSpellBlockMod)>=40)).length;
  if(augments.includes('ARAM_ADAPt'))return 'mage';
  if(tankItems>=2&&ap<80&&ad<70)return 'tank';
  if(items.some(i=>['3124','3153'].includes(i.id))&&ap<160)return 'onhit';
  if(ap>=80&&ap>ad*1.6&&base!=='support')return 'mage';
  if(ad>=70&&ad>ap*1.5&&base==='mage')return 'adc';
  const groups=augments.map(id=>ruleFor(data.augments.find(a=>a.id===id)||{id})?.key);
  if(ap<80&&ad<70&&groups.filter(g=>g==='durable').length>=2)return 'tank';
  if(ap<80&&ad<70&&groups.filter(g=>g==='ap'||g==='spell').length>=2&&base!=='support')return 'mage';
  if(augments.includes('ARAM_DualWield')&&['adc','onhit'].includes(base)&&!items.some(i=>finite(i.stats?.FlatCritChanceMod)>0))return 'onhit';
  return base;
}

// This is an explicitly labelled heuristic library, not a statistical tier list.
const augmentGroups = [
  { ids: 'Deft ScopedWeapons ScopierWeapons ScopiestWeapons Typhoon TapDancer LightemUp DoubleTap Firebrand FanTheHammer SymphonyofWar DualWield', key: 'attack', label: 'Tận dụng đánh thường liên tục', fit: p => ['adc','onhit'].includes(p.role) ? 90 : p.role === 'fighter' ? 69 : 34 },
  { ids: 'WitchfulThinking BigBrain Eureka Archmage PhenomenalEvil', key: 'ap', label: 'Khai thác sức mạnh phép thuật', fit: p => p.magic ? 88 : p.role === 'onhit' ? 62 : 30 },
  { ids: 'JeweledGauntlet MagicMissile InfernalConduit SkilledSniper Purist_Caster', key: 'spell', label: 'Tận dụng sát thương kỹ năng', fit: p => p.role === 'mage' ? 87 : ['fighter','assassin'].includes(p.role) ? 70 : 52 },
  { ids: 'FirstAidKit CriticalHealing AllForYou WindspeakersBlessing SonicBoom', key: 'heal', label: 'Cần hồi máu hoặc tạo khiên cho đồng đội', fit: p => p.healer ? 93 : 23 },
  { ids: 'Goliath CourageoftheColossus CelestialBody Perseverance TankEngine DawnbringersResolve', key: 'durable', label: 'Tăng độ bền khi giao tranh dài', fit: p => p.role === 'tank' ? 87 : p.role === 'fighter' ? 74 : 54 },
  { ids: 'Cruelty SlapAround Impassable Terror', key: 'cc', label: 'Cần khống chế phù hợp để kích hoạt', fit: p => p.cc ? 90 : 27 },
  { ids: 'Dashing Earthwake OutlawsGrit ShadowRunner', key: 'dash', label: 'Cần lướt hoặc dịch chuyển để khai thác', fit: p => p.dash ? 88 : 28 },
  { ids: 'BluntForce', key: 'ad', label: 'Phù hợp hướng sát thương vật lý', fit: p => ['adc','fighter','assassin'].includes(p.role) ? 83 : 35 },
  { ids: 'ThreadtheNeedle', key: 'penetration', label: 'Xuyên giáp và kháng phép khi gây sát thương', fit: p => ['mage','assassin','adc','fighter','onhit'].includes(p.role) ? 83 : 65 },
  { ids: 'BurstingTeeth', key: 'teeth', label: 'Đánh trúng để lấy cộng dồn xuyên kháng phép', fit: p => p.magic ? 77 : p.role === 'fighter' ? 72 : 61 },
  { ids: 'ItsCritical SoulSiphon', key: 'crit', label: 'Phù hợp hướng chí mạng', fit: p => p.role === 'adc' ? 84 : 49 },
  { ids: 'Recursion WithHaste', key: 'haste', label: 'Cần tận dụng kỹ năng thường xuyên', fit: p => ['mage','support','fighter','tank'].includes(p.role) ? 78 : 62 },
  { ids: 'ApexInventor', key: 'itemhaste', label: 'Giảm hồi chiêu hiệu ứng trang bị; cần món có hồi chiêu để phát huy', fit: p => ['mage','support','tank'].includes(p.role) ? 66 : 54 },
  { ids: 'BangBang', key: 'snipe', label: 'Trúng kỹ năng từ ít nhất 600 tầm để hoàn thành nhiệm vụ và gọi thiên thạch', fit: p => p.longRangeSpell && p.role === 'mage' ? 91 : p.longRangeSpell ? 82 : p.ranged && p.role === 'mage' ? 71 : 43 },
  { ids: 'Minionmancer', key: 'pets', label: 'Cần kỹ năng triệu hồi tương thích', fit: p => p.pets ? 89 : 20 },
  { ids: 'StackosaurusRex', key: 'stacks', label: 'Cần cơ chế cộng dồn tương thích', fit: p => p.stacks ? 90 : 24 },
  { ids: 'Vulnerability', key: 'dot', label: 'Ưu tiên sát thương theo thời gian phù hợp', fit: p => p.dot ? 86 : 54 },
  { ids: 'Marksmage', key: 'apattack', label: 'Cần SMPT và có thể đánh thường an toàn', fit: p => p.magic ? 76 : p.role === 'onhit' ? 80 : 40 },
  { ids: 'GlassCannon', key: 'glass', label: 'Tăng sát thương nhưng cần giữ vị trí an toàn', fit: p => p.ranged && ['adc','mage','onhit'].includes(p.role) ? 84 : p.ranged ? 73 : 62 },
  { ids: 'OmniSoul', key: 'soul', label: 'Nhận lợi ích đa dụng từ các linh hồn rồng', fit: () => 80 }
];
function ruleFor(a) { return augmentGroups.find(g => g.ids.split(' ').includes(a.id.replace(/^ARAM_/, ''))); }
const tierFromScore=score=>score>=89?'S':score>=77?'A':score>=61?'B':score>=43?'C':'D';
function assessAugment(a, p, owned = [], data) {
  if(!mechanics.patches.includes(data.patch))return {...a,tier:'?',score:null,reason:'Chưa rà soát cơ chế lõi cho bản vá này.',confidence:'Thấp · patch chưa xác minh',synergy:[]};
  const rule = ruleFor(a);
  if (!rule) return { ...a, tier: '?', score: null, reason: 'Chưa có quy tắc đánh giá cho lõi này; xem mô tả trong game.', confidence: 'Chưa đánh giá', synergy: [] };
  const synergies = owned.map(id => data.augments.find(x => x.id === id)).filter(Boolean).filter(x => x.id !== a.id && ruleFor(x)?.key === rule.key).map(x => x.name);
  const base=a.id==='ARAM_DualWield'?(p.role==='onhit'?91:p.role==='adc'?84:p.role==='fighter'?66:36):rule.fit(p);
  const score = clamp(base + (synergies.length ? 3 : 0));
  return { ...a, score, tier: tierFromScore(score), reason: rule.label,
    confidence: 'Ước tính theo cơ chế', synergy: synergies, group: rule.key };
}
function augmentAdvice(data, champion, owned = [], offered = [], override = 'auto', context = {}) {
  const p = profile(champion, data, override);
  const enemyControl=(context.enemyThreats||[]).filter(t=>profile(t.champion,data).cc).length;
  const reference=context.referenceAugments?.champion===champion&&context.referenceAugments?.patch===data.patch?context.referenceAugments:null;
  const rows = data.augments.map(a => {
    let assessed=assessAugment(a,p,owned,data);
    const rank=reference?.ranks?.[a.id];
    const sourceTier=reference?.tiers?.[a.id];
    if(['S','A','B','C','D','E'].includes(sourceTier)){
      const sourceScore={S:96,A:84,B:69,C:52,D:35,E:18}[sourceTier];
      const score=assessed.score===null?sourceScore:Math.round(sourceScore*.7+assessed.score*.3);
      assessed={...assessed,score,tier:sourceTier,sourceTier,contextTier:tierFromScore(score),icon:reference.icons?.[a.id]||a.icon,confidence:'Tier trực tiếp từ OP.GG',sourceRank:rank,sourceTotal:reference.total,
        reason:`OP.GG ${reference.patch}: tier ${sourceTier} cho ${data.champions[champion]?.name||champion}.${assessed.score===null?'':` ${assessed.reason}.`} Ưu tiên chọn có xét thêm hướng chơi và lõi đã có.`};
    }
    if(a.id!=='GlassCannon'||!p.ranged||enemyControl<2||assessed.score===null)return assessed;
    const score=clamp(assessed.score-Math.min(12,(enemyControl-1)*4));
    return {...assessed,score,tier:assessed.sourceTier||tierFromScore(score),contextTier:tierFromScore(score),reason:assessed.reason+` Đội địch có ${enemyControl} tướng nhiều khống chế/áp sát.`};
  });
  const offers = offered.map(id => rows.find(a => a.id === id) || null);
  const scored = offers.filter(a => a && a.score !== null);
  const full = offers.length === 3 && scored.length === 3;
  const best = [...scored].sort((a,b) => b.score-a.score)[0];
  const bestIds=full?scored.filter(a=>a.score===best.score).map(a=>a.id):[];
  const bestNames=full?scored.filter(a=>a.score===best.score).map(a=>a.name).join(' hoặc '):'';
  const bestPositions=full?offers.map((a,i)=>a?.score===best.score?i+1:null).filter(Boolean).join(' hoặc '):'';
  const advice = !full ? 'Chưa đủ đánh giá cho cả ba thẻ; chưa kết luận giữ hay xoay.' : best.score >= 77 ? `Nên chọn thẻ ${bestPositions}: ${bestNames} (${best.tier}) theo dữ liệu và cơ chế hiện có; kiểm tra điều kiện lõi trong game.` : 'Các lựa chọn hiện tại hợp ít hơn; có thể cân nhắc xoay nếu còn lượt. Không dự đoán lõi sẽ ra.';
  const combos = augmentGroups.map(g => ({ title: g.label, items: rows.filter(a => a.group === g.key && a.score >= 75).sort((a,b)=>b.score-a.score).slice(0,3) })).filter(g=>g.items.length>=2).slice(0,4);
  return { offers, rows: rows.sort((a,b)=>(b.score ?? -1)-(a.score ?? -1)), advice, bestIds, combos, role: p.role };
}
function itemValid(item, champ, map = 12) {
  return !!item && !!item.maps?.[String(map)] && item.inStore !== false && item.hideFromAll !== true && item.gold?.purchasable !== false && item.gold?.total > 0 && (!item.requiredChampion || normalize(item.requiredChampion) === normalize(champ)) && !item.requiredAlly;
}
function playerKey(p) { return p.riotId || (p.riotIdGameName ? p.riotIdGameName + '#' + p.riotIdTagLine : p.summonerName) || p.championName; }
function damageProfile(player, data, augmentIds=[]) {
  const p = profile(championId(player,data),data); let ad=0, ap=0, armor=0, mr=0, hp=0, crit=0, healing=0, shield=0, cost=0;
  for (const inv of player.items || []) {
    const i=data.items[String(inv.itemID)]; if (!i) continue;
    const s=i.stats||{}; ad+=finite(s.FlatPhysicalDamageMod); ap+=finite(s.FlatMagicDamageMod); armor+=finite(s.FlatArmorMod); mr+=finite(s.FlatSpellBlockMod); hp+=finite(s.FlatHPPoolMod); crit+=finite(s.FlatCritChanceMod); cost+=finite(i.gold?.total);
    if (/life ?steal|omnivamp|heal for|restore.*health/i.test(i.english)) healing++;
    if (/gain.*shield|grant.*shield|lifeline|shield yourself/i.test(i.english)) shield++;
  }
  let magic = p.magic ? .8 : p.role === 'onhit' ? .4 : p.role === 'tank' ? .5 : .15;
  if (ap > ad * 1.3 && ap > 90) magic=.85;
  if (ad > ap && ad > 90) magic=.15;
  const knownHealing=augmentIds.some(id=>['ARAM_Perseverance','ARAM_Goredrink','ARAM_SoulSiphon','NatureIsHealing','Equilibrium','ARAM_CriticalHealing'].includes(id));
  const knownShield=augmentIds.some(id=>['MightyShield','ARAM_CourageoftheColossus'].includes(id));
  if(augmentIds.includes('ARAM_ADAPt'))magic=.9;
  return { ad,ap,armor,mr,hp,crit,cost,healing: healing + (p.sustain || p.healer ? 2 : 0)+(knownHealing?2:0), shield:shield+(p.healer?1:0)+(knownShield?2:0), magic, profile:p,knownHealing,knownShield };
}
function threats(snapshot, data, enemyAugments = {}) {
  const self=findSelf(snapshot);
  if(!self) return [];
  const enemies=snapshot.allPlayers.filter(p=>p.team!==self.team);
  const meanCost = enemies.reduce((s,p)=>s+damageProfile(p,data).cost,0)/Math.max(1,enemies.length);
  return enemies.map(p=>{
    const k=playerKey(p), champ=championId(p,data), aug=enemyAugments[k] || {ids:[], observedAt:0},d=damageProfile(p,data,aug.ids);
    const knownAug=aug.ids.map(id=>data.augments.find(a=>a.id===id)).filter(Boolean);
    // Observed augments are displayed as evidence. No arbitrary numeric threat bonus for unknown effects.
    const score=Math.round(clamp(30 + (finite(p.level)-finite(self.level))*4 + clamp((d.cost-meanCost)/350,-20,20) + Math.min(15,finite(p.scores?.kills)*1.8) + (['adc','onhit','mage','assassin'].includes(d.profile.role)?12:5) + (d.profile.cc?5:0)));
    const reasons=[];
    if(d.cost>meanCost+1000) reasons.push('Trang bị đắt hơn trung bình đội địch');
    if(finite(p.level)>finite(self.level)) reasons.push('Hơn bạn '+(p.level-self.level)+' cấp');
    if(d.profile.cc) reasons.push('Có công cụ khống chế / mở giao tranh');
    if(d.healing>=2) reasons.push('Có khả năng hồi phục đáng chú ý');
    if(d.knownHealing)reasons.push('Lõi hồi phục đã được xác nhận');
    if(d.knownShield)reasons.push('Lõi tạo khiên đã được xác nhận');
    if(d.crit>=.4) reasons.push('Nhiều trang bị chí mạng');
    const strategy=p.isDead?'Đang bị hạ gục; không phải mục tiêu hiện tại.':d.profile.role==='tank'?'Có thể đánh khi trong tầm an toàn; tránh vượt tuyến để đuổi chủ lực.':d.profile.healer?'Có thể ưu tiên nếu tiếp cận được an toàn; hạn chế hồi phục cho đội địch.':'Ưu tiên khống chế nếu tiếp cận an toàn; giữ vị trí và không đuổi xuyên tuyến trước.';
    return {key:k,champion:champ,name:data.champions[champ]?.name||p.championName,icon:data.champions[champ]?.icon,score,isDead:!!p.isDead,level:p.level,scores:p.scores,items:p.items||[],reasons,strategy,damage:d,augments:knownAug,augmentObservedAt:aug.observedAt,augmentSource:aug.source||''};
  }).sort((a,b)=>Number(a.isDead)-Number(b.isDead)||b.score-a.score);
}
function consumed(itemId, owned, data, seen=new Set()) {
  if(owned.has(String(itemId))) return true;
  if(seen.has(String(itemId))) return false; seen.add(String(itemId));
  return (data.items[String(itemId)]?.into||[]).some(id=>consumed(id,owned,data,new Set(seen)));
}
const exclusive = mechanics.exclusiveItemGroups;
function buildAdvice(snapshot,data,champ,ownedAugments=[],override='auto',enemyAugments={},reference=null,options={}) {
  const suppliedAugments=ownedAugments;
  if(!mechanics.patches.includes(data.patch))ownedAugments=[];
  const p=profile(champ,data,inferRole(champ,data,snapshot,override,ownedAugments)), enemies=options.threats||threats(snapshot,data,enemyAugments);
  const self=findSelf(snapshot),inventory=self?.items||[];
  const owned = new Set((self?.items||[]).map(i=>String(i.itemID)));
  const completed=inventory.filter(i=>finite(data.items[String(i.itemID)]?.gold?.total)>=2200 && !data.items[String(i.itemID)]?.tags?.includes('Boots')).length;
  const bootsOwned=[...owned].some(id=>id!=='1001'&&data.items[id]?.tags?.includes('Boots'));
  const allies=(snapshot.allPlayers||[]).filter(a=>self&&a!==self&&a.team===self.team);
  const antihealIds=['3123','3076','3916','3033','3165','3075','6609','3011'];
  const teamAntiheal=allies.filter(a=>(a.items||[]).some(i=>antihealIds.includes(String(i.itemID))));
  const hasAntiheal=[...owned].some(id=>antihealIds.includes(id));
  const teamShred=allies.filter(a=>(a.items||[]).some(i=>String(i.itemID)==='3071'));
  const physicalAllies=allies.filter(a=>damageProfile(a,data,enemyAugments[playerKey(a)]?.ids||[]).magic<.45).length;
  const graph=options.graphContext||synergy.context(data,champ,suppliedAugments,p,enemies,options.community);
  const notes=graph.warnings.map(w=>w.message);
  const magical=enemies.reduce((a,e)=>a+e.damage.magic,0)/Math.max(1,enemies.length), healing=enemies.filter(e=>e.damage.healing>=2).length, shielding=enemies.filter(e=>e.damage.shield>=2).length, armor=enemies.filter(e=>e.damage.armor>=60).length, mr=enemies.filter(e=>e.damage.mr>=40).length, crit=enemies.filter(e=>e.damage.crit>=.4).length;
  const baseline={adc:[6672,3006,3031,3036,3072,3085],onhit:[3153,3006,3124,6672,3091,3072],mage:[6655,3020,4645,3089,3135,3157],tank:magical>.65?[2504,3111,3065,4401,3083,8020]:[2502,3047,3065,3083,3143],fighter:[6692,3047,3071,3053,6333,3065],assassin:[3142,3158,6692,6694,6695,3156],support:[6617,3158,3504,3107,6621,3222]}[p.role];
  const candidates=new Map();
  const add=(id,score,reason)=>{id=String(id);const item=data.items[id]; if(!itemValid(item,champ,snapshot.gameData?.mapNumber||12)||consumed(id,owned,data))return;
    if(item.tags?.includes('Boots') && bootsOwned) return;
    if(conflicts(id,owned,data))return;
    const old=candidates.get(id);if(!old||score>old.score)candidates.set(id,{id,name:item.name,icon:item.icon,total:item.gold.total,score,reason,description:item.plain});};
  const referencePaths=reference?.patch===data.patch&&reference.champion===champ?reference.builds
    .map((ids,rank)=>({ids:ids.filter(id=>itemValid(data.items[id],champ,snapshot.gameData?.mapNumber||12)),rank}))
    .filter(path=>path.ids.length>=2&&path.ids.some(id=>!consumed(id,owned,data)))
    .filter(path=>p.role!=='tank'||path.ids.filter(id=>{const s=data.items[id].stats||{};return finite(s.FlatHPPoolMod)>=150&&(finite(s.FlatArmorMod)>=25||finite(s.FlatSpellBlockMod)>=25);}).length>=2)
    .filter(path=>p.role!=='support'||path.ids.some(id=>['6617','3504','3107','6621','3222','4005','6616','6620'].includes(id)))
    .filter(path=>{const stats=path.ids.map(id=>data.items[id].stats||{}),ap=stats.reduce((n,s)=>n+finite(s.FlatMagicDamageMod),0),ad=stats.reduce((n,s)=>n+finite(s.FlatPhysicalDamageMod),0);return !(['adc','onhit','fighter','assassin'].includes(p.role)&&ap>80&&ap>ad*1.5||['mage','support'].includes(p.role)&&ad>80&&ad>ap*1.5);}):[];
  const sourcePath=referencePaths.sort((a,b)=>{const fit=path=>path.ids.reduce((n,id)=>n+(owned.has(id)?10:quotePurchase(id,inventory,data).credit/300),0)-path.rank;return fit(b)-fit(a);})[0];
  if(sourcePath){let step=0;for(const id of sourcePath.ids){if(consumed(id,owned,data))continue;add(id,91-step*6,`OP.GG ARAM Hỗn Loạn ${reference.patch}: hướng trang bị phổ biến theo ${data.champions[champ]?.name||champ}; điều chỉnh theo lõi và đồ địch.`);step++;}}
  baseline.forEach((id,i)=>add(id,sourcePath?74-i*4:78-i*4,'Hướng '+roles[p.role].toLowerCase()+'; thứ tự tham khảo theo quy tắc.'));
  const focus=synergy.FOCUSES[options.focus]?options.focus:'auto';
  for(const id of synergy.pool(focus,p))add(id,79,'Ứng viên phù hợp hướng '+synergy.FOCUSES[focus].name+'.');
  if(focus==='experimental')for(const id of graph.active)for(const item of synergy.AUG[id].items||[])add(item,79,'Nhánh thử nghiệm từ lõi đã chọn.');
  const observedAugments=ownedAugments.map(id=>data.augments.find(a=>a.id===id)).filter(Boolean);
  const groups=[...new Set(observedAugments.map(a=>ruleFor(a)?.key).filter(Boolean))];
  const coreReason=(group)=>'Lõi đã ghi nhận thuộc nhóm '+augmentGroups.find(g=>g.key===group).label.toLowerCase()+'; đối chiếu mô tả lõi trong game.';
  for(const group of groups){
    if(group==='attack'){
      if(p.role==='onhit'){add(3153,88,coreReason(group));add(3124,84,coreReason(group));}
      if(p.role==='adc'){add(6672,88,coreReason(group));add(3085,84,coreReason(group));}
    }
    if(group==='ap'&&p.role==='mage'){add(p.mana?6655:3152,86,coreReason(group));if(completed>=2)add(3089,91,coreReason(group));}
    if(group==='spell'&&p.role==='mage'){add(p.mana?6655:3152,85,coreReason(group));if(completed>=1)add(4645,84,coreReason(group));}
    if(group==='snipe'&&p.role==='mage'&&p.longRangeSpell)add(4628,completed>=1?90:84,'Lõi yêu cầu trúng kỹ năng từ ít nhất 600 tầm; Kính Nhắm Ma Pháp có cùng ngưỡng kích hoạt, cho điểm hồi kỹ năng và tầm nhìn, không cộng thêm sát thương trực tiếp.');
    if(group==='haste'&&p.role==='mage'&&p.longRangeSpell)add(4628,86,'Bứt Tốc tận dụng điểm hồi kỹ năng; Kính Nhắm Ma Pháp cho 25 điểm hồi và hỗ trợ phát hiện mục tiêu trúng kỹ năng từ xa.');
    if(group==='itemhaste'&&p.role==='mage'){add(3157,enemies.some(e=>e.damage.profile.role==='assassin')?92:84,'Nhà Phát Minh Đỉnh Chóp giảm hồi chiêu trang bị; Đồng Hồ Cát Zhonya có kích hoạt phòng thủ khi bị áp sát.');if(magical>.5)add(3102,89,'Nhà Phát Minh Đỉnh Chóp giúp hồi lại hiệu ứng khiên phép của Dây Chuyền Chữ Thập nhanh hơn trước đội hình nhiều phép.');}
    if(group==='heal'&&p.healer){add(6617,90,coreReason(group));add(3504,84,coreReason(group));}
    if(group==='durable'&&['tank','fighter'].includes(p.role)){add(2502,88,coreReason(group));if(magical>.5)add(3065,86,coreReason(group));}
    if(group==='crit'&&p.role==='adc')add(3031,90,coreReason(group));
    if(group==='dot'&&p.role==='mage'){add(6653,90,coreReason(group));add(3116,80,coreReason(group));}
    if(group==='glass'&&completed>=1){if(p.role==='adc')add(3072,88,'Lõi tăng sát thương nhưng cần sống sót: cân nhắc hút máu và lá chắn.');if(p.role==='mage')add(3157,86,'Lõi tăng sát thương nhưng dễ bị hạ: cân nhắc bảo vệ khi bị áp sát.');}
  }
  if(p.role==='mage' && p.magic && !p.mana) { candidates.delete('6655'); candidates.delete('3003'); add(3152,82,'Tướng không dùng năng lượng: ưu tiên món không tốn chỉ số năng lượng.'); }
  if(p.role==='mage'&&p.dot){add(6653,89,'Bộ kỹ năng có sát thương kéo dài: cân nhắc hiệu ứng đốt.');add(3116,77,'Cân nhắc làm chậm để duy trì sát thương kéo dài.');}
  // A cheap wound component already provides the same listed reduction. Do
  // not automatically spend a full slot on Morello/Thornmail for this alone.
  if(healing){
    notes.push(teamAntiheal.length?`Đồng đội đã có Vết Thương Sâu (${teamAntiheal.map(a=>a.championName).join(', ')}); cần họ đánh trúng đúng mục tiêu, hiệu ứng không cộng dồn.`:'Đội chưa ghi nhận trang bị Vết Thương Sâu.');
    if(hasAntiheal)notes.push('Bạn đã có Vết Thương Sâu: giữ mảnh hiện có; chỉ nâng cấp khi cần chỉ số hoặc thiếu ô đồ.');
    const component=p.role==='tank'?3076:p.magic?3916:3123;
    const reactive=component===3076;
    const reason=`${healing} nguồn hồi phục ở địch. Mua mảnh 800 vàng rồi tiếp tục món chính; ${reactive?'chỉ áp Vết Thương Sâu lên tướng đánh thường vào bạn.':p.magic?'cần gây sát thương phép lên mục tiêu.':'cần gây sát thương vật lý lên mục tiêu.'}`;
    if(!hasAntiheal&&(!reactive||enemies.some(e=>e.damage.healing>=2&&['adc','onhit','fighter'].includes(e.damage.profile.role))))add(component,teamAntiheal.length?62:healing>=2||completed>=1?100:80,reason);
    else if(reactive&&!hasAntiheal)notes.push('Áo Choàng Gai không chủ động giảm hồi máu của pháp sư đứng xa; ưu tiên đồng đội có thể áp hiệu ứng.');
    if(completed>=3)add(p.role==='tank'?3075:p.magic?3165:p.role==='fighter'?6609:3033,hasAntiheal?76:84,'Nâng cấp giảm hồi máu khi cần chỉ số/ô đồ; không tăng mức Vết Thương Sâu chỉ nhờ hoàn thành.');
  }
  if(shielding && ['assassin','fighter'].includes(p.role)) add(6695,91,'Nhiều nguồn lá chắn: cân nhắc Kiếm Ác Xà.');
  if(armor && ['adc','onhit','fighter','assassin'].includes(p.role))add(p.role==='fighter'?3071:healing&&!teamAntiheal.length?3033:p.role==='assassin'?6694:3036,armor>=2&&completed>=1?95:completed>=2?84:71,'Địch có '+armor+' tướng đã mua giáp; xuyên giáp chỉ giúp bản thân, Rìu Đen giảm giáp cho cả đội và cần cộng dồn.');
  if(armor&&p.role==='fighter'&&physicalAllies>=2&&!teamShred.length)add(3071,99,'Đội có nhiều sát thương vật lý và chưa có Rìu Đen: giảm giáp để cả đội hưởng lợi nếu bạn duy trì sát thương vật lý.');
  if(teamShred.length)notes.push('Đồng đội đã có Rìu Đen; không ưu tiên mua trùng chỉ để thêm giảm giáp.');
  if(teamShred.length&&candidates.has('3071'))candidates.get('3071').score-=12;
  if(mr && p.magic && p.role==='mage')add(3135,mr>=2&&completed>=1?95:completed>=2?84:69,'Địch có '+mr+' tướng đã mua kháng phép; cân nhắc xuyên kháng phép theo tiến độ đồ.');
  if(magical>.6){add(p.role==='tank'?3065:p.role==='mage'?3102:3156,completed>=2?88:completed>=1?82:68,'Đội địch thiên về sát thương phép theo tướng và trang bị.');add(3111,completed>=2?82:68,'Cân nhắc kháng phép và kháng hiệu ứng; đối chiếu loại khống chế.');}
  if(magical<.35 && enemies.length){add(p.role==='tank'?3143:p.role==='mage'?3157:['adc','onhit'].includes(p.role)?3072:6333,completed>=2?88:completed>=1?82:68,'Đội địch thiên về sát thương vật lý theo tướng và trang bị.');add(3047,completed>=2?82:68,'Cân nhắc phòng thủ trước sát thương vật lý.');}
  if(crit && p.role==='tank')add(3143,94,'Địch có nhiều chí mạng; cân nhắc Khiên Băng Randuin.');
  if(p.role==='tank' && p.mana && enemies.filter(e=>['adc','onhit'].includes(e.damage.profile.role)).length>=2)add(3110,93,'Nhiều nguồn đánh thường: cân nhắc Tim Băng.');
  if(ownedAugments.includes('ARAM_Upgrade_IE'))add(3031,98,'Bạn đã ghi nhận lõi nâng cấp Vô Cực Kiếm.');
  if(ownedAugments.includes('ARAM_Upgrade_ZH'))add(3157,98,'Bạn đã ghi nhận lõi nâng cấp Zhonya.');
  if(ownedAugments.includes('ARAM_Upgrade_Immolate'))add(3068,98,'Bạn đã ghi nhận lõi nâng cấp Hiến Tế.');
  if(ownedAugments.includes('ARAM_Upgrade_Collector'))add(6676,98,'Bạn đã ghi nhận lõi nâng cấp Súng Hải Tặc.');
  if(ownedAugments.includes('ARAM_Quest_SteelYourHeart'))add(3084,103,'Lõi Trái Tim Sắt Đá cần Trái Tim Khổng Thần để hoàn thành nhiệm vụ; cân nhắc khả năng tiếp cận.');
  if(ownedAugments.includes('ARAM_Marksmage')&&p.magic){add(3115,92,'Xạ Thủ Ma Pháp cần SMPT và đánh thường: Nanh Nashor là hướng tùy chọn nếu bạn đánh được an toàn.');}
  if(champ==='Evelynn'&&p.role==='mage'&&!sourcePath){
    add(3152,85,'Evelynn cần tiếp cận để dồn sát thương; Đai Tên Lửa là hướng tham khảo, cân nhắc trước đội hình nhiều khống chế.');
    if(completed>=1)add(3100,86,'Evelynn có thể xen đòn đánh sau kỹ năng; cân nhắc Kiếm Tai Ương khi tiếp cận được mục tiêu.');
    if(completed>=2)add(3089,89,'Đã có nền SMPT: cân nhắc Mũ Phù Thủy cho hướng dồn sát thương.');
  }
  const leading=enemies.find(e=>!e.isDead);
  if(leading&&completed>=1&&leading.score>=60){
    const magic=leading.damage.magic>.65;
    const id=p.role==='tank'?(magic?3065:3143):p.magic?(magic?3102:3157):(magic?3156:3072);
    add(id,90,`${leading.name} đang là mối đe dọa theo cấp/trang bị; cân nhắc sống sót trước nguồn ${magic?'phép':'vật lý'} này.`);
  }
  if(!allies.some(a=>profile(championId(a,data),data).role==='tank')&&p.role==='tank')notes.push('Đội thiếu tuyến trước khác: ưu tiên khả năng sống sót và bảo vệ chủ lực.');
  if(p.role==='support')notes.push(`Chọn đồ hỗ trợ theo đồng đội: ${physicalAllies>=2?'nhiều nguồn đánh thường, cân nhắc Lư Hương.':'ưu tiên hồi máu/khiên và bảo vệ nguồn sát thương chính.'}`);
  for(const c of candidates.values()){
    c.baseScore=c.score;const scored=synergy.scoreItem(data.items[c.id],graph,focus,p);
    c.graphReasons=scored.reasons;c.graphBonus=mechanics.antihealComponents.includes(c.id)?0:scored.value;
    c.score+=c.graphBonus;if(c.graphBonus)c.reason+=' '+scored.reasons.map(r=>r.reason).join(' ');
  }
  const beforeFocus=new Map([...candidates].map(([id,c])=>[id,c.score]));
  for(const c of candidates.values()){
    if(mechanics.antihealComponents.includes(c.id))continue;
    const item=data.items[c.id],stats=item.stats||{};
    const defense=finite(stats.FlatArmorMod)+finite(stats.FlatSpellBlockMod)>0||['3157','3102','3072','3053','6333'].includes(c.id);
    const offense=p.magic?finite(stats.FlatMagicDamageMod)>0:finite(stats.FlatPhysicalDamageMod)>0||finite(stats.PercentAttackSpeedMod)>0;
    if(focus==='survival'&&defense){c.score+=14;c.reason+=' Bạn ưu tiên sống sót; có thể chậm mốc sát thương.';}
    if(focus==='damage'&&offense&&!defense){c.score+=9;c.reason+=' Bạn ưu tiên sát thương; đánh đổi một phần chống chịu.';}
    if(focus==='augment'&&/Lõi|lõi|Xạ Thủ Ma Pháp|Nhà Phát Minh|Bứt Tốc/.test(c.reason)){c.score+=12;c.reason+=' Ưu tiên khai thác lõi đã ghi nhận.';}
    c.focusBonus=c.score-beforeFocus.get(c.id);
  }
  if(!mechanics.patches.includes(data.patch))notes.push(`Quy tắc cơ chế ${mechanics.version} chưa xác minh bản ${data.patch}; đối chiếu mô tả trong game.`);
  const targetId=String(options.targetItem||'');
  const learned=options.historyAdvice;
  // Personal observations only break close ties between independently valid candidates.
  // Never use them as a new item path, a source tier, or a reason to override the user's target.
  if(targetId&&itemValid(data.items[targetId],champ,snapshot.gameData?.mapNumber||12)&&!consumed(targetId,owned,data))add(targetId,108,'Bạn đã chọn món này làm mục tiêu. Các mảnh khắc chế vẫn được hiển thị riêng để cân nhắc.');
  for(const c of candidates.values()){
    const q=quotePurchase(c.id,inventory,data);c.remaining=q.remaining;c.credit=q.credit;
    if(c.id!==targetId&&c.total>=1800&&q.credit>0){c.score+=Math.min(14,q.credit/140);c.reason+=` Đã đầu tư ${Math.round(q.credit)} vàng vào thành phần.`;}
    if(c.id==='3083'&&damageProfile(self||{},data).hp+1000<2000){c.score-=22;c.reason+=' Chưa đủ ngưỡng máu cộng thêm theo trang bị đã thấy; kiểm tra chỉ số trong game.';}
    if(c.id===targetId)c.score=1000;
  }
  // Focus is a preference, not permission to displace an already prioritized
  // cheap counter purchase. Compare the same candidates before focus bonuses.
  const baseLeader=[...candidates.values()].filter(c=>beforeFocus.has(c.id)).sort((a,b)=>
    (b.score-(b.focusBonus||0)-(b.graphBonus||0))-(a.score-(a.focusBonus||0)-(a.graphBonus||0)))[0];
  if(baseLeader&&mechanics.antihealComponents.includes(baseLeader.id)){
    for(const c of candidates.values())if(c.id!==targetId&&c.id!==baseLeader.id&&(c.focusBonus||c.graphBonus))c.score=Math.min(c.score,baseLeader.score-.01);
  }
  if(learned?.qualified){
    const first=[...candidates.values()].sort((a,b)=>b.score-a.score)[0];
    const protect=first&&['3123','3916','3076'].includes(first.id)?first.score-.01:Infinity;
    for(const sample of learned.items||[]){const c=candidates.get(sample.id);if(c&&c.id!==targetId&&c.total>=1800&&sample.bonus>0){const bonus=Math.max(0,Math.min(5,sample.bonus,protect-c.score));if(bonus){c.score+=bonus;c.reason+=` Lịch sử của bạn: xuất hiện trong ${sample.count}/${sample.games} trận có mẫu cùng tướng/hướng/bản vá (tham khảo).`;}}}
    notes.push(`Có ${learned.sampleCount} trận tham khảo cùng tướng, hướng chơi và bản vá; không phải tỷ lệ thắng hoặc kết luận nhân quả.`);
  }
  for(const c of candidates.values()){
    c.explanation={score:c.score,label:'Điểm ưu tiên nội bộ; không phải phần trăm',breakdown:{base:c.baseScore??108,synergy:c.graphBonus||0,preference:c.focusBonus||0,contextAndConstraints:c.score-(c.baseScore??108)-(c.graphBonus||0)-(c.focusBonus||0)},reasons:c.graphReasons||[],confidence:!graph.current||!graph.detailed||graph.warnings.length>0||focus==='experimental'?'Thấp':'Vừa',limitations:['Chưa mô phỏng sát thương, vị trí hoặc cơ hội đánh thực tế.',...(!graph.detailed?['Chưa có hồ sơ kỹ năng chi tiết đúng bản vá cho tướng này.']:[])],sources:[{label:'Riot Data Dragon · chỉ số',url:`https://ddragon.leagueoflegends.com/cdn/${data.version}/data/en_US/item.json`,patch:data.patch},{label:synergy.RULE_SOURCE,url:graph.source,patch:require('../data/ability-profiles.json').patch},...(sourcePath?[{label:'OP.GG · hướng phổ biến',url:reference.url,patch:reference.patch}]:[])]};
  }
  const list=[...candidates.values()].sort((a,b)=>b.score-a.score||b.credit-a.credit);
  const planned=[];for(const i of list){if(conflicts(i.id,new Set(planned.map(j=>j.id)),data))continue;if(data.items[i.id].tags?.includes('Boots')&&planned.some(j=>data.items[j.id].tags?.includes('Boots')))continue;planned.push(i);if(planned.length===6)break;}
  const next=list[0]; const gold=finite(snapshot.activePlayer?.currentGold);
  const goal=list.find(i=>i.total>=1800&&!data.items[i.id].tags?.includes('Boots'))||next;
  const fullBag=inventory.filter(i=>i.slot===undefined||i.slot<6).length>=6;
  const quote=next?quotePurchase(next.id,inventory,data):{remaining:0,missing:[]};
  const affordable=quote.missing.filter(i=>i.id!==next?.id&&i.remaining>0&&i.remaining<=gold&&(!fullBag||i.consumes)&&itemValid(data.items[i.id],champ,snapshot.gameData?.mapNumber||12))
    .sort((a,b)=>b.total-a.total).filter((i,n,arr)=>arr.findIndex(j=>i.id===j.id)===n).slice(0,3);
  if(fullBag)notes.push('Túi đồ đầy: chỉ mua được khi ghép hoặc giải phóng ô; ứng dụng không tự bán đồ.');
  const recommendationGraph=structuredClone(graph.graph);
  recommendationGraph.nodes.push({id:'archetype:'+focus,type:'BuildArchetype',label:synergy.FOCUSES[focus].name},{id:'preference:'+focus,type:'UserPreference',label:synergy.FOCUSES[focus].name});
  recommendationGraph.edges.push({from:'preference:'+focus,to:'archetype:'+focus,type:'prefers'});
  for(const c of list){recommendationGraph.nodes.push({id:'item:'+c.id,type:'Item',label:c.name});for(const r of c.graphReasons||[])recommendationGraph.edges.push(r);}
  const lockedFeatures=synergy.itemFeatures(data.items[targetId]);
  const lockedTradeoffs=[];
  if(targetId&&!p.mana&&lockedFeatures.has('mana'))lockedTradeoffs.push('Món khóa có năng lượng nhưng tướng không dùng: giữ theo yêu cầu, một phần chỉ số bị lãng phí.');
  if(targetId&&p.magic&&lockedFeatures.has('ad')&&!lockedFeatures.has('ap'))lockedTradeoffs.push('Món khóa thiên vật lý trong hướng phép: cần đổi cách gây sát thương để tận dụng.');
  const lockedRejected=targetId&&!list.some(i=>i.id===targetId)&&!consumed(targetId,owned,data)?['Món khóa không hợp lệ hoặc xung đột với đồ đã có; không ép mua.']:[];
  return {graph:recommendationGraph,confidence:next?.explanation.confidence||'Thấp',observations:graph.observations,conflicts:[...graph.warnings.map(w=>w.message),...lockedRejected,...lockedTradeoffs],focus,role:p.role,roleLabel:roles[p.role],roleReason:override!=='auto'?'Bạn chọn hướng thủ công.':'Suy ra từ trang bị đã đầu tư, lõi đã ghi nhận và cơ chế tướng.',goal,targetItem:targetId,historySamples:learned?.sampleCount||0,
    next:next?{...next,remaining:quote.remaining,canFinish:gold>=quote.remaining&&(!fullBag||quote.credit>0)}:null,
    alternatives:list.filter(i=>i.id!==next?.id&&i.id!==goal?.id&&i.total>=1800).slice(0,3),tactical:list.filter(i=>['3123','3916','3076'].includes(i.id)),notes,path:planned,
    components:affordable.map(i=>({id:i.id,name:data.items[i.id].name,icon:data.items[i.id].icon,total:i.remaining,fullPrice:i.total})),gold,enemyMagic:magical,healing,armor,mr,completed,
    reference:sourcePath?{source:reference.source,patch:reference.patch,url:reference.url,fetchedAt:reference.fetchedAt}:null,
    note:`Hướng ${roles[p.role].toLowerCase()}; ${observedAugments.length} lõi đã ghi nhận. ${sourcePath?'Có đối chiếu các hướng OP.GG đúng bản vá.':'Đang dùng quy tắc cục bộ; chưa có hướng OP.GG phù hợp.'} Mỗi thành phần là lựa chọn mua riêng; chưa mô phỏng sát thương đầy đủ.`};
}
function editDistance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const n=[i];for(let j=1;j<=b.length;j++)n[j]=Math.min(n[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=n;}return row[b.length];}
function matchAugment(text, augments) {
  const input=normalize(text); if(input.length<4)return {match:null,confidence:0,candidates:[]};
  const lines=String(text).split(/\n+/).map(normalize).filter(x=>x.length>=4);
  const scores=augments.map(a=>{const score=Math.max(...[a.name,a.en].filter(Boolean).flatMap(name=>{const n=normalize(name);return lines.map(l=>l===n?1:1-editDistance(l,n)/Math.max(l.length,n.length));}));return {id:a.id,name:a.name,score};}).sort((a,b)=>b.score-a.score);
  const best=scores[0], gap=(best?.score||0)-(scores[1]?.score||0);
  return {match: best && best.score>=.88 && gap>=.07 ? augments.find(a=>a.id===best.id):null,confidence:best?.score||0,candidates:scores.slice(0,3),ambiguous:gap<.07};
}
module.exports={normalize,championId,profile,roles,inferRole,findSelf,assessAugment,augmentAdvice,itemValid,playerKey,damageProfile,threats,buildAdvice,matchAugment,consumed,clamp};
