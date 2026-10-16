// Host-side regression tests: executes the shipped wrapper in a VM with Electron/DOM mocks.
// This is NOT Windows-native Electron or GUI execution.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const protocolModule = require('./protocol.cjs');

function execute(filename, electron, extra = {}) {
  const context = vm.createContext({
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'node:path') return path;
      if (name === './protocol.cjs') return protocolModule;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    __dirname, URL, console, ...extra,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, filename), 'utf8'), context, {filename});
  return context;
}

async function loadMain() {
  const ipc = new Map();
  const windows = [];
  const errors = [];
  let quits = 0;
  const app = {
    setName() {}, enableSandbox() {}, on() {},
    whenReady: () => Promise.resolve(), quit: () => { quits++; },
  };
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.webContents = {
        mainFrame: {url: 'kart://game/'},
        setWindowOpenHandler() {}, on() {},
        getURL() { return this.mainFrame.url; },
        isDestroyed: () => false,
      };
      windows.push(this);
    }
    once() {}
    show() {}
    isDestroyed() { return false; }
    loadURL() { return Promise.resolve(); }
  }
  execute('main.cjs', {
    app, BrowserWindow,
    ipcMain: {on: (channel, listener) => ipc.set(channel, listener)},
    protocol: {registerSchemesAsPrivileged() {}, handle() {}},
    session: {defaultSession: {setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, webRequest: {onBeforeRequest() {}}}},
    Menu: {setApplicationMenu() {}, buildFromTemplate: value => value},
    dialog: {showErrorBox: (...args) => errors.push(args)},
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, [], 'main startup must succeed');
  assert.equal(windows.length, 1);
  assert.equal(typeof ipc.get('kart:quit'), 'function', 'fixed quit IPC must be registered');
  return {window: windows[0], ipc, quits: () => quits, quit: (...args) => ipc.get('kart:quit')(...args)};
}

function loadPreload(url = 'kart://game/') {
  const listeners = [];
  const sends = [];
  const exposed = new Map();
  class Element {
    constructor(button = null) { this.button = button; this.nodeType = 1; }
    closest(selector) {
      assert.equal(selector, 'button[data-screen="exit"]');
      return this.button;
    }
  }
  const location = new URL(url);
  const document = {
    addEventListener: (type, listener, options) => listeners.push({type, listener, options}),
    location,
  };
  const window = {document, location};
  window.top = window;
  window.self = window;
  execute('preload.cjs', {
    ipcRenderer: {send: (...args) => sends.push(args)},
    contextBridge: {exposeInMainWorld: (name, value) => exposed.set(name, value)},
  }, {document, window, location, Element, HTMLElement: Element, HTMLButtonElement: Element});
  function click({exit = true, disabled = false, fieldsetDisabled = false, trusted = true, nested = false, nullTarget = false} = {}) {
    const button = new Element();
    button.disabled = disabled;
    button.matches = selector => selector === ':disabled' ? (disabled || fieldsetDisabled) : exit;
    button.getAttribute = name => name === 'data-screen' ? (exit ? 'exit' : 'play') : null;
    button.dataset = {screen: exit ? 'exit' : 'play'};
    button.button = exit ? button : null;
    const target = nullTarget ? null : nested ? new Element(exit ? button : null) : button;
    const event = {
      isTrusted: trusted, target,
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      stopPropagation() { this.stopped = true; },
    };
    for (const registration of listeners.filter(item => item.type === 'click')) registration.listener(event);
    return event;
  }
  return {listeners, sends, exposed, click};
}

test('main window retains sandbox and uses desktop preload', async () => {
  const harness = await loadMain();
  const prefs = harness.window.options.webPreferences;
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.preload, path.join(__dirname, 'preload.cjs'));
  assert.equal(harness.quits(), 0);
});

for (const url of ['kart://game/', 'kart://game/index.html']) {
  test(`main accepts argument-free quit from its main frame at ${url}`, async () => {
    const harness = await loadMain();
    const sender = harness.window.webContents;
    sender.mainFrame.url = url;
    harness.quit({sender, senderFrame: sender.mainFrame});
    assert.equal(harness.quits(), 1);
  });
}

for (const url of ['https://game/', 'https://evil.example/', 'file:///index.html', 'kart://evil/', 'kart://user@game/', 'kart://game:123/', 'kart://game/assets/app.js', 'kart://game/other.html', 'about:blank', 'not a URL', '']) {
  test(`main rejects quit origin/path ${JSON.stringify(url)}`, async () => {
    const harness = await loadMain();
    const sender = harness.window.webContents;
    sender.mainFrame.url = url;
    harness.quit({sender, senderFrame: sender.mainFrame});
    assert.equal(harness.quits(), 0);
  });
}

test('main rejects subframes, other senders, absent frames, and arguments', async () => {
  const harness = await loadMain();
  const sender = harness.window.webContents;
  for (const event of [
    {sender, senderFrame: {url: 'kart://game/'}},
    {sender: {mainFrame: sender.mainFrame}, senderFrame: sender.mainFrame},
    {sender, senderFrame: null},
    {sender},
  ]) harness.quit(event);
  for (const args of [[null], [undefined], ['kart://game/'], [{url: 'kart://game/'}], [1, 2]]) {
    harness.quit({sender, senderFrame: sender.mainFrame}, ...args);
  }
  assert.equal(harness.quits(), 0);
});

test('preload captures a trusted enabled Exit click before the web handler', () => {
  const harness = loadPreload();
  const capture = harness.listeners.find(item => item.type === 'click');
  assert.ok(capture && (capture.options === true || capture.options?.capture === true));
  const event = harness.click();
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(harness.sends, [['kart:quit']]);
});

test('preload also handles a trusted click on a child of Exit', () => {
  const harness = loadPreload();
  const event = harness.click({nested: true});
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(harness.sends, [['kart:quit']]);
});

for (const [label, options] of [
  ['disabled Exit', {disabled: true}],
  ['Exit inside a disabled fieldset', {fieldsetDisabled: true}],
  ['untrusted scripted Exit', {trusted: false}],
  ['non-Exit control', {exit: false}],
  ['child of non-Exit control', {exit: false, nested: true}],
  ['null target', {nullTarget: true}],
]) {
  test(`preload ignores ${label}`, () => {
    const harness = loadPreload();
    const event = harness.click(options);
    assert.deepEqual(harness.sends, []);
    assert.equal(event.prevented, false);
    assert.equal(event.stopped, false);
  });
}

test('optional desktop bridge exposes only a frozen fixed-channel quit capability', () => {
  const harness = loadPreload();
  if (harness.exposed.size === 0) return; // Click-only integration does not require a page API.
  assert.deepEqual([...harness.exposed.keys()], ['kartDesktop']);
  const bridge = harness.exposed.get('kartDesktop');
  assert.deepEqual(Object.keys(bridge), ['quit']);
  assert.equal(Object.isFrozen(bridge), true);
  bridge.quit('arbitrary-channel', {unexpected: true});
  assert.deepEqual(harness.sends, [['kart:quit']]);
});


test('main rejects quit after the window is destroyed', async () => {
  const harness = await loadMain();
  const sender = harness.window.webContents;
  harness.window.isDestroyed = () => true;
  harness.quit({sender, senderFrame: sender.mainFrame});
  assert.equal(harness.quits(), 0);
});

for (const url of ['https://evil.example/', 'kart://evil/', 'kart://user@game/', 'kart://game/assets/app.js', 'about:blank']) {
  test(`preload refuses both click and bridge quit from ${url}`, () => {
    const harness = loadPreload(url);
    const event = harness.click();
    harness.exposed.get('kartDesktop')?.quit();
    assert.deepEqual(harness.sends, []);
    assert.equal(event.prevented, false);
    assert.equal(event.stopped, false);
  });
}

test('complete desktop Exit click reaches actual main handler and app.quit', async () => {
  const main = await loadMain(), preload = loadPreload('kart://game/index.html?screen=main');
  const sender = main.window.webContents;
  sender.mainFrame.url = 'kart://game/index.html?screen=main';
  preload.click({nested:true});
  for (const [channel, ...args] of preload.sends) main.ipc.get(channel)({sender,senderFrame:sender.mainFrame}, ...args);
  assert.equal(main.quits(), 1);
});
