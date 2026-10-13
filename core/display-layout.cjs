const presets=require('../data/display-presets.json');
const DEFAULT_DISPLAY={monitorId:'auto',screenResolution:'auto',clientResolution:'auto',gameResolution:'auto',gameMode:'borderless',overlayScale:'auto',showOnStartup:true};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function resolution(value){const m=/^(\d{3,5})x(\d{3,5})$/.exec(String(value));return m?{width:Number(m[1]),height:Number(m[2])}:null;}
function sanitizeDisplay(input={}){
 const out={...DEFAULT_DISPLAY};
 if(input&&typeof input==='object'){
  if(input.monitorId==='auto'||/^-?\d+$/.test(String(input.monitorId)))out.monitorId=String(input.monitorId);
  for(const key of ['screenResolution','gameResolution','clientResolution']){
   const options=key==='clientResolution'?presets.clients:presets.screens;
   if(input[key]==='auto'||options.some(p=>p.id===input[key]))out[key]=input[key];
  }
  if(['fullscreen','borderless','windowed'].includes(input.gameMode))out.gameMode=input.gameMode;
  if([.65,.75,.85,1,1.15,1.25,1.5].includes(input.overlayScale))out.overlayScale=input.overlayScale;
  if(typeof input.showOnStartup==='boolean')out.showOnStartup=input.showOnStartup;
 }
 return out;
}
function gameSize(config,display,actual){
 if(actual?.width>200&&actual?.height>200)return {width:actual.width,height:actual.height};
 return resolution(config.gameResolution)||resolution(config.screenResolution)||{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)};
}
function captureSize(size){const ratio=Math.min(1,2560/size.width,1600/size.height);return {width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio))};}
function clientCrop(image,client,outer){
 if(!client||!outer||outer.width<=0||outer.height<=0||client.width<=0||client.height<=0)return null;
 const aspect=image.width/image.height;
 // Some capture backends already return client pixels. Do not crop those a second time.
 if(Math.abs(aspect-client.width/client.height)<=Math.abs(aspect-outer.width/outer.height)+.002)return null;
 const sx=image.width/outer.width,sy=image.height/outer.height;
 const x=Math.max(0,Math.round((client.x-outer.x)*sx)),y=Math.max(0,Math.round((client.y-outer.y)*sy));
 const width=Math.min(image.width-x,Math.round(client.width*sx)),height=Math.min(image.height-y,Math.round(client.height*sy));
 return width>200&&height>200?{x,y,width,height}:null;
}
function intersect(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return right-x>=240&&bottom-y>=200?{x,y,width:right-x,height:bottom-y}:b;}
function overlayLayout(area,config,side='right'){
 const margin=Math.min(16,Math.round(area.width*.012));
 const fit=Math.min((area.width-2*margin)/378,(area.height-2*margin)/980);
 const requested=config.overlayScale==='auto'?Math.min(1,fit):config.overlayScale;
 const zoom=Math.max(.4,Math.min(requested,(area.width-2*margin)/378));
 const width=Math.round(378*zoom),height=Math.max(160,Math.min(Math.round(980*zoom),area.height-2*margin));
 return {zoom,bounds:{x:Math.round(side==='left'?area.x+margin:area.x+area.width-width-margin),y:Math.round(area.y+margin),width,height}};
}
function mainLayout(display,config,clientRect){
 const area=display.workArea;
 const size=resolution(config.clientResolution);
 const desired=size?{width:size.width/display.scaleFactor,height:size.height/display.scaleFactor}:clientRect||{width:1240,height:850};
 const width=Math.round(Math.min(Math.max(860,desired.width),area.width-24));
 const height=Math.round(Math.min(Math.max(620,desired.height),area.height-24));
 return {x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),width,height};
}
// The template is calibrated for a centered 16:9 card canvas. Manually saved ROIs are already normalized to the game window.
function adaptRegions(regions,size,manual=false){
 if(manual||!size?.width||!size?.height)return regions;
 const aspect=size.width/size.height,base=16/9;
 const sx=aspect>base?base/aspect:1,sy=aspect<base?aspect/base:1;
 return regions.map(r=>({x:(1-sx)/2+r.x*sx,y:(1-sy)/2+r.y*sy,w:r.w*sx,h:r.h*sy}));
}
module.exports={DEFAULT_DISPLAY,sanitizeDisplay,resolution,gameSize,captureSize,clientCrop,intersect,overlayLayout,mainLayout,adaptRegions};
