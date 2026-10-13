const MODES=['mini','compact','expanded'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function sanitizeOverlay(input={}){
 return {overlayOpacity:Number.isFinite(input.overlayOpacity)?clamp(input.overlayOpacity,.5,1):1,overlayWidgets:Array.isArray(input.overlayWidgets)?[...new Set(input.overlayWidgets.filter(x=>['items','augments','notes'].includes(x)))]:['items','augments','notes'],overlayMode:MODES.includes(input.overlayMode)?input.overlayMode:'compact',overlayClickThrough:input.overlayClickThrough!==false,overlayAutoHideTab:input.overlayAutoHideTab!==false,overlayAutoHideChoices:input.overlayAutoHideChoices!==false,overlayVertical:Number.isFinite(input.overlayVertical)?clamp(input.overlayVertical,0,1):0,overlayInset:Number.isFinite(input.overlayInset)?clamp(input.overlayInset,8,64):12};
}
function nextMode(mode){return MODES[(MODES.indexOf(mode)+1)%MODES.length];}
function visibility({enabled=true,demo=false,hasGame=false,focused=false,tabHeld=false,choices=false,autoTab=true,autoChoices=true}={}){
 // The game window itself is enough to show the pinned reference panel. The
 // client and live endpoints can lag behind launch or be temporarily offline.
 const active=demo||focused,tab=active&&tabHeld&&autoTab;
 return {panel:active&&enabled&&!tab&&!(choices&&autoChoices&&!demo),badges:active&&enabled&&!tab&&choices,controls:active&&!tab};
}
function layout(area,display={},options={}){
 const prefs=sanitizeOverlay(options),offers=options.hasOffers!==false;
 const top=Math.max(42,Math.round(area.height*.10)),bottom=Math.round(area.height*.30),toolbar=30;
 const available=Math.max(80,area.height-top-bottom-toolbar);
 const margin=prefs.overlayInset;
 const desired=display.overlayScale==='auto'||!Number.isFinite(display.overlayScale)?1:clamp(display.overlayScale,.85,1.5);
 const dims={mini:{width:264,height:offers?128:94},compact:{width:304,height:offers?302:196},expanded:{width:352,height:offers?544:438}};
 let mode=prefs.overlayMode;
 // Preserve readable type. Reduce information, not text, on short/high-DPI screens.
 while(mode!=='mini'&&(dims[mode].height*desired>available||dims[mode].width*desired>area.width*.32))mode=MODES[MODES.indexOf(mode)-1];
 const zoom=Math.min(desired,(area.width-2*margin)/dims[mode].width,available/dims[mode].height);
 const width=Math.round(dims[mode].width*zoom),height=Math.round(dims[mode].height*zoom);
 const safeBottom=Math.max(top+toolbar,area.height-bottom-height);
 const y=area.y+top+toolbar+Math.round(Math.max(0,safeBottom-top-toolbar)*prefs.overlayVertical);
 const x=options.side==='left'?area.x+margin:area.x+area.width-width-margin;
 return {zoom,mode,requested:prefs.overlayMode,reason:mode!==prefs.overlayMode?'Tự thu gọn để chừa HUD và giữ chữ rõ.':'',bounds:{x:Math.round(x),y:Math.round(y),width,height},controls:{x:Math.round(x),y:Math.round(y-toolbar),width,height:toolbar},safe:{top,bottom}};
}
module.exports={MODES,sanitizeOverlay,nextMode,visibility,layout};
