// Executing actual desktop main in VM mocks. This is not native Electron verification.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {isLocal}=require('./protocol.cjs');
async function harness(){
 const capture={events:{},windowEvents:{},ipc:{}};
 class BrowserWindow{
  constructor(options){capture.options=options;capture.window=this;this.webContents={mainFrame:{url:'kart://game/'},getURL(){return this.mainFrame.url;},setWindowOpenHandler(fn){capture.open=fn;},on(name,fn){capture.windowEvents[name]=fn;}};}
  loadURL(url){capture.loaded=url;return Promise.resolve();}
  once(){} show(){} isDestroyed(){return false;}
 }
 const session={setPermissionRequestHandler(fn){capture.permissionRequest=fn;},setPermissionCheckHandler(fn){capture.permissionCheck=fn;},webRequest:{onBeforeRequest(filter,fn){capture.requestFilter=filter;capture.request=fn;}}};
 const electron={BrowserWindow,app:{setName(){},enableSandbox(){capture.sandboxEnabled=true;},whenReady:()=>Promise.resolve(),quit(){capture.quit=true;},on(name,fn){capture.events[name]=fn;}},protocol:{registerSchemesAsPrivileged(s){capture.schemes=s;},handle(s,h){capture.handler=h;capture.scheme=s;}},session:{defaultSession:session},Menu:{setApplicationMenu(){},buildFromTemplate(x){capture.menu=x;return x;}},dialog:{showErrorBox(){throw Error('Unexpected startup error');}},ipcMain:{on(name,fn){capture.ipc[name]=fn;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),{__dirname,URL,require(name){if(name==='electron')return electron;if(name==='node:path')return path;if(name==='./protocol.cjs')return require('./protocol.cjs');throw Error(name);}});
 await new Promise(resolve=>setImmediate(resolve));return capture;
}
test('renderer keeps all security boundaries and standard secure local origin',async()=>{
 const c=await harness(),p=c.options.webPreferences;
 for(const key of ['contextIsolation','sandbox','webSecurity'])assert.equal(p[key],true,key);
 for(const key of ['nodeIntegration','nodeIntegrationInWorker','allowRunningInsecureContent','webviewTag'])assert.equal(p[key],false,key);
 assert.equal(c.sandboxEnabled,true);assert.equal(c.loaded,'kart://game/');assert.equal(c.scheme,'kart');
 assert.equal(c.schemes.length,1);assert.equal(c.schemes[0].scheme,'kart');
 for(const key of ['standard','secure','supportFetchAPI','corsEnabled'])assert.equal(c.schemes[0].privileges[key],true,key);
 assert.equal(c.schemes[0].privileges.bypassCSP,undefined);
});
test('HTTP HTTPS WebSocket and FTP requests are cancelled',async()=>{
 const c=await harness();assert.deepEqual(Array.from(c.requestFilter.urls),['http://*/*','https://*/*','ws://*/*','wss://*/*','ftp://*/*']);
 let cancel=false;c.request({},value=>cancel=value.cancel);assert.equal(cancel,true);
});
test('only local pointer lock permitted and all unrelated permissions denied',async()=>{
 const c=await harness();
 for(const url of ['kart://game/','kart://game/coast.html','kart://game/waterpark.html','https://evil.example/','kart://evil/'])for(const permission of ['pointerLock','camera','microphone','notifications','geolocation','clipboard-read','media']){
  const contents={getURL:()=>url};const expected=isLocal(url)&&permission==='pointerLock';
  assert.equal(c.permissionCheck(contents,permission),expected);let value;c.permissionRequest(contents,permission,x=>value=x);assert.equal(value,expected);
 }
 assert.equal(c.permissionCheck(null,'pointerLock'),false);
});
test('remote navigation popups and webviews blocked while local races stay accessible',async()=>{
 const c=await harness();assert.equal(c.open({url:'https://evil.example/'}).action,'deny');
 for(const url of ['kart://game/coast.html','kart://game/waterpark.html','kart://game/garage.html','file:///outside','https://evil.example/']){let prevented=false;c.windowEvents['will-navigate']({preventDefault(){prevented=true;}},url);assert.equal(prevented,!isLocal(url));}
 let prevented=false;c.windowEvents['will-attach-webview']({preventDefault(){prevented=true;}});assert.equal(prevented,true);
});
test('race Back to main menu links remain navigation and app close still quits',async()=>{
 const c=await harness();assert.equal(Object.keys(c.ipc).join(','),'kart:quit');
 c.events['window-all-closed']();assert.equal(c.quit,true);
 const game=path.resolve(process.argv[2]||path.join(__dirname,'../source'));
 for(const name of ['coast.html','waterpark.html'])assert.match(fs.readFileSync(path.join(game,'dist',name),'utf8'),/<a id="raceMainMenu" href="index.html">返回主菜单<\/a>/);
});
