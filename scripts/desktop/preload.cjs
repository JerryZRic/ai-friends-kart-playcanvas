// Desktop-only menu exit integration. AGPL-3.0-only.
// No arbitrary IPC, Node API, renderer data, or remote navigation is exposed.
const { contextBridge, ipcRenderer } = require('electron');
function isHome() {
  try { const u = new URL(window.location.href); return u.protocol === 'kart:' && u.host === 'game' && !u.username && !u.password && (u.pathname === '/' || u.pathname === '/index.html'); } catch { return false; }
}
const quit = () => { if (isHome()) ipcRenderer.send('kart:quit'); };
contextBridge.exposeInMainWorld('kartDesktop', Object.freeze({ quit }));
document.addEventListener('click', event => {
  if (!event.isTrusted || !isHome()) return;
  const button = event.target?.closest?.('button[data-screen="exit"]');
  if (!button || button.disabled || button.matches(':disabled')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  quit();
}, true);
