import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import AdvancedApp from './AdvancedApp.jsx';
import GameOverlay,{OverlayControls,OverlayBadges} from './GameOverlay.jsx';
import './style.css';import './nightveil.css';import './compact-ux.css';import './card-badges.css';
const params=new URLSearchParams(location.search),overlay=params.has('overlay'),badges=params.has('badges'),control=params.has('control');
if(overlay)document.documentElement.classList.add('overlay-document');
if(badges)document.documentElement.classList.add('badge-document');
if(control)document.documentElement.classList.add('control-document');
function App(){
 const [state,setState]=useState(null),[error,setError]=useState('');
 useEffect(()=>{if(!window.mayhem){setError('Hãy mở ứng dụng Windows để sử dụng.');return;}window.mayhem.getState().then(setState).catch(e=>setError(e.message));return window.mayhem.subscribe(next=>setState(old=>{if(!next.__partial)return next;const {__partial,...patch}=next;return {...old,...patch};}));},[]);
 const cmd=async(type,payload)=>{try{return await window.mayhem.command(type,payload);}catch(e){setError(e.message);}};
 if(!state)return <div className="dv-loading">{error||'Đang mở DVM Nightveil…'}</div>;
 if(badges)return <OverlayBadges state={state}/>;
 if(control)return <OverlayControls state={state} cmd={cmd}/>;
 if(overlay)return <GameOverlay state={state} cmd={cmd}/>;
 return <>{error&&<div role="alert">{error}<button onClick={()=>setError('')}>Đóng</button></div>}<AdvancedApp state={state} cmd={cmd}/></>;
}
createRoot(document.getElementById('root')).render(<App/>);
