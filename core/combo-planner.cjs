const LABELS={god:'Cực mạnh · cộng đồng',strong:'Mạnh · cộng đồng',blackTech:'Tương tác đặc biệt',entertainment:'Giải trí',trap:'Bẫy · cần tránh',bug:'Tương tác có lỗi game'};
function sanitizeDraft(raw={},data){return {champion:data.champions[raw.champion]?raw.champion:'Evelynn',ids:[...new Set((Array.isArray(raw.ids)?raw.ids:[]).filter(id=>data.augments.some(a=>a.id===id)))].slice(0,6)};}
function planCombos(data,community,draft){
 const clean=sanitizeDraft(draft,data),selected=new Set(clean.ids),byId=new Map(data.augments.map(a=>[a.id,a]));
 const combos=(community?.patch===data.patch?community.combos||[]:[]).filter(c=>c.champion===clean.champion).map(c=>{
   const missing=c.ids.filter(id=>!selected.has(id)),matched=c.ids.length-missing.length;
   return {...c,items:c.ids.map(id=>({...byId.get(id),selected:selected.has(id)})),matched,missing:missing.map(id=>byId.get(id)).filter(Boolean),complete:missing.length===0,warning:c.types.includes('trap')?'Cộng đồng đánh dấu bẫy; kiểm tra tương tác trước khi chọn.':c.types.includes('bug')?'Có nhãn lỗi game; tương tác có thể đã được sửa.':'',labels:c.types.map(t=>LABELS[t]).filter(Boolean)};
 }).sort((a,b)=>Number(b.matched>0)-Number(a.matched>0)||Number(b.complete)-Number(a.complete)||b.matched-a.matched||a.missing.length-b.missing.length);
 return {draft:clean,combos,source:community?.source||null,releaseId:community?.releaseId||null,patch:data.patch,selected:clean.ids.map(id=>byId.get(id)),warnings:combos.filter(c=>c.complete&&c.warning).map(c=>c.warning)};
}
module.exports={planCombos,sanitizeDraft,LABELS};
