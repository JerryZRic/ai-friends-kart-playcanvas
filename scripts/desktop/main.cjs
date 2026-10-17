// Windows desktop packaging addition, 2026-10-07. AGPL-3.0-only.
const {app, BrowserWindow, protocol, session, Menu, dialog, ipcMain} = require('electron');
const path = require('node:path');
const {createHandler, isLocal} = require('./protocol.cjs');
app.setName('AI Friends Kart');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{scheme:'kart',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let mainWindow;
app.whenReady().then(async () => {
  protocol.handle('kart', createHandler(path.join(__dirname, 'dist')));
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(isLocal(contents.getURL()) && permission === 'pointerLock'));
  session.defaultSession.setPermissionCheckHandler((contents, permission) => !!contents && isLocal(contents.getURL()) && permission === 'pointerLock');
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','ftp://*/*']}, (_details, callback) => callback({cancel:true}));
  mainWindow = new BrowserWindow({width:1440,height:900,minWidth:960,minHeight:640,title:'AI Friends Kart · PlayCanvas',backgroundColor:'#102b37',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}});
  ipcMain.on('kart:quit', (event, ...args) => {
    if (args.length || !mainWindow || mainWindow.isDestroyed()) return;
    const contents = mainWindow.webContents;
    const frame = event.senderFrame;
    if (event.sender !== contents || !frame || frame !== contents.mainFrame || !isLocal(frame.url)) return;
    const url = new URL(frame.url);
    if (url.pathname !== '/' && url.pathname !== '/index.html') return;
    app.quit();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Game',submenu:[{label:'Back to game',click:()=>mainWindow.loadURL('kart://game/')},{type:'separator'},{role:'quit'}]},{label:'View',submenu:[{role:'togglefullscreen',accelerator:'F11'},{role:'reload'},{role:'toggleDevTools'}]}]));
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  await mainWindow.loadURL('kart://game/');
}).catch(error=>{dialog.showErrorBox('AI Friends Kart could not start',String(error));app.quit();});
app.on('window-all-closed',()=>app.quit());
