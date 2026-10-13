const {app}=require('electron');
app.whenReady().then(()=>{console.log('PROFILE',app.getPath('userData'));app.quit();});
