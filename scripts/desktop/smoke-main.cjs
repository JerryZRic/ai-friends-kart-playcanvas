// CI-only native Windows renderer startup smoke. Never part of normal startup.
// SPDX-License-Identifier: AGPL-3.0-only
const {app} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.KART_SMOKE_OUTPUT;
if (!output || !path.isAbsolute(output)) throw Error('Absolute KART_SMOKE_OUTPUT is required');
let completed = false;
const fail = error => {
  if (completed) return;
  completed = true;
  fs.writeFileSync(output, JSON.stringify({status:'failed', error:String(error)}, null, 2));
  app.exit(1);
};
const deadline = setTimeout(() => fail('Native startup timed out after 60 seconds'), 60000);
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('render-process-gone', (_event, detail) => fail(JSON.stringify(detail)));
  window.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) fail(`${code}: ${description}: ${url}`);
  });
  window.webContents.once('did-finish-load', async () => {
    try {
      const page = await window.webContents.executeJavaScript('({href:location.href,readyState:document.readyState,title:document.title})');
      if (page.href !== 'kart://game/' || page.readyState !== 'complete') throw Error('Unexpected startup page: ' + JSON.stringify(page));
      completed = true; clearTimeout(deadline);
      fs.writeFileSync(output, JSON.stringify({status:'passed', page, platform:process.platform, arch:process.arch,
        electron:process.versions.electron, note:'Native Electron window/renderer document startup only; no gameplay, GPU, performance or pointer-lock certification.'}, null, 2));
      app.quit();
    } catch (error) { fail(error); }
  });
});
require('./main.cjs');
