const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mayhem',{
  getState:()=>ipcRenderer.invoke('state:get'),
  command:(type,payload)=>ipcRenderer.invoke('command',{type,payload}),
  subscribe:callback=>{const fn=(_event,data)=>callback(data);ipcRenderer.on('state:changed',fn);return()=>ipcRenderer.removeListener('state:changed',fn);}
});
