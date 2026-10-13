import React,{useState,useEffect,useRef} from 'react';
import presets from '../data/display-presets.json';

export default function DisplaySetup({settings,display,onSave,onCancel}){
 const [form,setForm]=useState(()=>({...settings.display})),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const dialogRef=useRef(null);
 useEffect(()=>{const prior=document.activeElement;const el=dialogRef.current;const onKey=e=>{if(e.key==='Escape'){e.preventDefault();onCancel?.();}if(e.key==='Tab'){const list=[...el.querySelectorAll('button:not(:disabled),input,select')];const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};el.addEventListener('keydown',onKey);return()=>{el.removeEventListener('keydown',onKey);prior?.focus?.();};},[]);
 const change=(key,value)=>setForm(old=>({...old,[key]:value}));
 const selected=display?.monitors?.find(m=>m.id===(form.monitorId==='auto'?display.selectedId:form.monitorId));
 const resolution=(key,label,options,help)=><label className="display-field"><span>{label}</span><select value={form[key]||'auto'} onChange={e=>change(key,e.target.value)} aria-label={label}><option value="auto">Tự nhận diện (khuyên dùng)</option>{options.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select><small>{help}</small></label>;
 async function save(){setSaving(true);setError('');try{await onSave(form);}catch(e){setError(e.message||'Chưa lưu được.');}finally{setSaving(false);}}
 return <div className="display-backdrop"><section ref={dialogRef} className="display-dialog" role="dialog" aria-modal="true" aria-labelledby="display-title">
  <div className="display-heading"><span className="brand-symbol">◈</span><div><span className="eyebrow">THIẾT LẬP HIỂN THỊ</span><h2 id="display-title">Vừa màn hình. Đúng vị trí.</h2></div></div>
  <p>Chọn cấu hình bạn chơi. App ưu tiên khung game thực tế khi nhận được; các lựa chọn dưới đây dùng để bố trí và dự phòng.</p>
  <div className="display-detected"><b>Đang nhận: {selected?`${selected.label} · ${selected.width} × ${selected.height}`:'Đang kiểm tra màn hình'}</b><span>{selected?`Windows scale ${Math.round(selected.scale*100)}%`:'Tự theo game khi vào trận'}{display?.gameRect?` · Game ${display.gameRect.width} × ${display.gameRect.height}`:''}</span></div>
  <div className="display-grid">
   <label className="display-field"><span>Màn hình chơi game</span><select autoFocus value={form.monitorId||'auto'} onChange={e=>change('monitorId',e.target.value)} aria-label="Màn hình chơi game"><option value="auto">Tự theo cửa sổ game</option>{display?.monitors?.map(m=><option key={m.id} value={m.id}>{m.label} · {m.width} × {m.height}{m.primary?' · chính':''}</option>)}</select><small>Hỗ trợ laptop + màn hình ngoài. Nếu bạn chuyển game, overlay đi theo cửa sổ thật.</small></label>
   {resolution('screenResolution','Độ phân giải màn hình',presets.screens,'Kích thước inch không quyết định vị trí; độ phân giải và Windows scale mới quyết định.')}
   {resolution('clientResolution','Kích thước client LMHT',presets.clients,'Dùng để chọn kích thước bảng điều khiển trước trận; giới hạn trong màn hình hiện tại.')}
   <label className="display-field"><span>Chế độ trong game</span><select value={form.gameMode||'borderless'} onChange={e=>change('gameMode',e.target.value)} aria-label="Chế độ trong game"><option value="borderless">Không viền (khuyên dùng)</option><option value="windowed">Cửa sổ</option><option value="fullscreen">Toàn màn hình</option></select><small>Chọn đúng chế độ trong Video của game. App không thay đổi cài đặt game hoặc Windows.</small></label>
   {resolution('gameResolution','Độ phân giải trong game',presets.screens,'Khung game được đo thực tế luôn được ưu tiên hơn cấu hình dự phòng này.')}
   <label className="display-field"><span>Cỡ overlay</span><select value={form.overlayScale??'auto'} onChange={e=>change('overlayScale',e.target.value==='auto'?'auto':Number(e.target.value))} aria-label="Cỡ overlay"><option value="auto">Tự vừa khung game</option>{[.85,1,1.15,1.25,1.5].map(v=><option key={v} value={v}>{Math.round(v*100)}%</option>)}</select><small>Áp dụng cho bảng gợi ý. Thanh điều khiển giữ cỡ đọc rõ; tier trên thẻ tự căn theo khung game.</small></label>
  </div>
  {form.gameMode==='fullscreen'&&<div className="warning">Toàn màn hình độc quyền có thể che overlay hoặc làm ảnh chụp đen. Nếu gặp lỗi, dùng Không viền.</div>}
  <p className="display-note">Vùng đọc lõi được căn theo tỉ lệ màn hình. Với HUD tùy chỉnh hoặc ultrawide, có thể cần chỉnh lại trong Thiết lập → Vùng đọc ba thẻ.</p>
  {error&&<p role="alert" className="warning">{error}</p>}
  <div className="display-actions"><label><input type="checkbox" checked={form.showOnStartup!==false} onChange={e=>change('showOnStartup',e.target.checked)}/> Hiện thiết lập này mỗi lần mở app</label><button onClick={onCancel} disabled={saving}>Để sau</button><button className="primary" disabled={saving} onClick={save}>{saving?'Đang áp dụng…':'Lưu & tiếp tục'}</button></div>
 </section></div>;
}
