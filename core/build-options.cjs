const engine=require('./engine.cjs');
const synergy=require('./synergy-graph.cjs');
const {FOCUSES}=synergy;
function buildOptions(snapshot,data,champ,owned=[],role='auto',enemyAugments={},reference=null,options={}){
 const p=engine.profile(champ,data,engine.inferRole(champ,data,snapshot,role,require('../data/mechanics.json').patches.includes(data.patch)?owned:[]));
 const threats=options.threats||engine.threats(snapshot,data,enemyAugments);
 const graphContext=synergy.context(data,champ,owned,p,threats,options.community);
 const keys=synergy.eligible(graphContext,p);
 const rows=keys.map(focus=>({id:focus,...FOCUSES[focus],...engine.buildAdvice(snapshot,data,champ,owned,role,enemyAugments,reference,{...options,threats,graphContext,focus})}));
 const selected=rows.find(p=>p.id===options.focus)||rows[0];
 if(options.focus&&!keys.includes(options.focus))selected.notes.push('Hướng đã chọn chưa phù hợp dữ liệu hiện tại; đang dùng Cân bằng.');
 return {selected,plans:rows};
}
module.exports={buildOptions,FOCUSES};
