import React,{useState} from 'react';
export default function RerollCalibration({state,cmd}){
 const [draft,setDraft]=useState(null);
 const regions=draft||state.display?.effectiveRerollRegions||state.settings.rerollRegions||[];
 return <details className="reroll-calibration"><summary>Hiệu chỉnh vùng nút xoay nếu không nhận được nhấp</summary><p className="panel-intro">Ba ô nằm quanh các nút xoay dưới thẻ. Tỷ lệ từ góc trên trái khung game, từ 0 đến 1. Chỉ cần sửa khi HUD/vị trí khác mẫu; không phải vùng đọc tên lõi.</p><div className="region-grid">{regions.map((r,i)=><div key={i}><b>Nút xoay {i+1}</b>{[['x','Trái'],['y','Trên'],['w','Rộng'],['h','Cao']].map(([k,label])=><label key={k}>{label}<input type="number" min="0" max="1" step="0.005" value={r[k]} onChange={e=>{const next=regions.map(r=>({...r}));next[i][k]=Number(e.target.value);setDraft(next);}}/></label>)}</div>)}</div><div className="settings-actions"><button onClick={()=>{cmd('settings',{rerollRegions:regions});setDraft(null);}}>Lưu vùng nút xoay</button><button onClick={()=>{cmd('reroll-regions-reset');setDraft(null);}}>Dùng mẫu theo màn hình</button></div></details>;
}
