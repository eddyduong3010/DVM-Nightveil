import React from 'react';
const money=n=>new Intl.NumberFormat('vi-VN').format(Math.round(n||0));
const focusNames={auto:'Cân bằng',damage:'Sát thương',survival:'Sống sót',augment:'Theo lõi',antitank:'Phá tank',sustain:'Hồi phục',utility:'Hỗ trợ',experimental:'Thử nghiệm'};
function Pic({src,name,size=26}){return <img src={src} alt={name||''} width={size} height={size} onError={e=>e.currentTarget.style.visibility='hidden'}/>;}
function Grade({a}){return <b className={'tier tier-'+(a?.tier||'?')} aria-label={'Tier '+(a?.tier||'chưa rõ')}>{a?.tier||'?'}</b>;}
export function OverlayControls({state,cmd}){
 const mode=state.overlayUX?.mode||state.settings.overlayMode||'compact';
 return <div className="overlay-controls nv-controls" aria-label="Điều khiển overlay">
  <div className="mode-segment" aria-label="Kích thước overlay">{[['mini','M','Mini'],['compact','C','Compact'],['expanded','E','Expanded']].map(([id,short,label])=><button key={id} title={label+' · Ctrl + Shift + Space đổi chế độ'} aria-label={label} aria-pressed={mode===id} onClick={()=>cmd('settings',{overlayMode:id})}>{short}</button>)}</div>
  <button onClick={()=>cmd('overlay-toggle')} title="Ẩn/hiện · Ctrl + Shift + O">{state.settings.overlayEnabled?'Ẩn':'Hiện'}</button>
  <button onClick={()=>cmd('overlay-interaction')} aria-pressed={!state.settings.overlayClickThrough} title="Đổi chuột xuyên / tương tác · Ctrl + Shift + I">{state.settings.overlayClickThrough?'Xuyên':'Chạm'}</button>
  <button onClick={()=>cmd('main')} title="Mở bảng · Ctrl + Shift + C">Bảng</button>
 </div>;
}
export default function GameOverlay({state:s,cmd}){
 if(s.policy){const b=s.staticReference,session=s.visibleSession,mode=s.overlayUX?.mode||'compact',widgets=s.settings.overlayWidgets||['items','augments','notes'],self=session?.players?.find(p=>p.side==='Bạn');return <section className={'nv-overlay nv-'+mode} style={{opacity:s.settings.overlayOpacity||1}} aria-label="Tham khảo và quan sát trận"><header className="nv-head"><b>DVM · {self?.name||b?.championName||'Nightveil'}</b><span>{session?(s.stale?'KẾT NỐI LẠI':'QUAN SÁT'):'THAM KHẢO'}</span></header><div className="nv-content"><strong>{b?.name||'Ghim build từ Build Lab trước trận'}</strong>{mode!=='mini'&&widgets.map(id=><div key={id}>{id==='items'?<p>{b?.itemDetails?.map(i=>i.name).join(' · ')||'Chưa ghim trang bị'}</p>:id==='augments'?<small>{b?.augmentDetails?.map(a=>a.name).join(' · ')||'Chưa ghim lõi'}</small>:mode==='expanded'?<p>{b?.notes?.slice(0,350)||'Nội dung cố định; không phân tích đối thủ hoặc đề xuất quyết định trong trận.'}</p>:null}</div>)}{mode!=='mini'&&self&&<p>Đồ hiện có: {self.items.map(i=>i.name).join(' · ')||'Chưa có'}</p>}{mode==='expanded'&&session?.players?.filter(p=>p.side==='Đối thủ').map((p,i)=><p key={i}>{p.name}: {p.items.map(item=>item.name).join(' · ')||'Chưa quan sát trang bị'}</p>)}</div><footer className="nv-foot"><span>Ctrl Shift O · Ẩn/hiện</span><span>Patch {b?.patch||'—'}</span></footer></section>;}
 const mode=s.overlayUX?.mode||s.settings.overlayMode||'compact',build=s.build,champ=s.champion,next=build?.next;
 const offers=s.assessment?.offers||[],hasOffers=offers.some(Boolean),best=s.assessment?.bestIds||[];
 const threats=s.threats||[],threat=threats.find(t=>!t.isDead),interactive=!s.settings.overlayClickThrough;
 return <section className={'nv-overlay nv-'+mode+(interactive?' nv-interactive':'')} aria-label={'DVM Nightveil '+mode}>
  <header className="nv-head"><Pic src={champ?.icon} name={champ?.name} size={24}/><b>{champ?.name||'Nightveil'}</b><span>{s.mode==='demo'?'DEMO':s.stale?'MẤT KẾT NỐI':'LIVE'}</span><small>{focusNames[build?.focus]||'Cân bằng'}</small></header>
  <div className="nv-content" key={mode}>
   <div className="nv-purchase"><Pic src={next?.icon} name={next?.name} size={mode==='mini'?28:34}/><div><strong>{next?.name||'Chờ trang bị'}</strong><small>{next?`${money(next.remaining)} vàng${next.canFinish?' · ĐỦ VÀNG':''}`:'Đang kết nối trận'}</small></div>{interactive&&<button aria-label="Xem hướng trang bị" onClick={()=>cmd('main')}>Xem</button>}</div>
   {mode==='expanded'&&<p className="nv-reason">{build?.next?.reason||'Gợi ý xuất hiện khi có thông tin trận.'}</p>}
   {mode==='expanded'&&build?.goal?.id!==next?.id&&build?.goal&&<p className="nv-goal">Tiếp theo <b>{build.goal.name}</b></p>}
   {hasOffers?<div className="nv-offers">{[0,1,2].map(i=>{const a=offers[i],recommended=best.includes(a?.id);return <div key={i} className={'nv-offer '+(recommended?'nv-best':'')}><span>{i+1}</span><Grade a={a}/>{a?.icon&&<Pic src={a.icon} size={22}/>}<div><b>{a?.name||'Đang đọc…'}</b>{mode!=='mini'&&<small>{recommended?'Nên chọn · ':''}{a?.sourceTier?'OP.GG':a?.tier&&a.tier!=='?'?'Ước tính':'Chưa có tier'}</small>}</div></div>;})}</div>:mode!=='mini'&&<div className="nv-wait">Chờ bảng lõi · Quét bằng <kbd>F8</kbd></div>}
   {mode!=='mini'&&<div className="nv-threat">{threat?<><Pic src={threat.icon} size={24}/><div><small>CẦN DÈ CHỪNG</small><b>{threat.name}</b></div><span>{threat.reasons?.[0]||'Theo trang bị'}</span></>:<span>Chờ thông tin đối thủ</span>}</div>}
   {mode==='expanded'&&<div className="nv-roster" aria-label="Trang bị đối thủ">{threats.slice(0,5).map(t=><div key={t.key} className={t.isDead?'nv-dead':''}><Pic src={t.icon} name={t.name} size={24}/><b>{t.name}</b><div>{t.items.slice(0,6).map((i,n)=><Pic key={n} src={s.itemDetails?.[i.itemID]?.icon} name={s.itemDetails?.[i.itemID]?.name} size={23}/>)}</div></div>)}<small>Lõi người khác: bổ sung sau trận khi có dữ liệu.</small></div>}
   {mode==='expanded'&&<div className="nv-owned"><small>LÕI ĐÃ CHỌN</small><span>{s.ownedNames?.join(' · ')||'Chưa ghi nhận'}</span></div>}
  </div>
  <footer className="nv-foot"><span>{s.stale?'Dữ liệu cũ · đang kết nối lại':s.overlayUX?.reason||s.scan?.status||'Sẵn sàng'}</span><b>{interactive?'CHẠM':'XUYÊN'}</b></footer>
 </section>;
}
