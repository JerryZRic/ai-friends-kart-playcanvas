import type {BackgroundMusic} from './background-music';

/** Keep the audio document alive; only the garage rendering document is replaced. */
export function createMenuGarageHost(options: {document: Document; window: Window; music: BackgroundMusic | null; suspend(): void; resume(): void; depart(href: string): void; cancelDeparture(): void}) {
  const {document: doc, window: win, music} = options;
  let frame: HTMLIFrameElement | undefined, panel: HTMLElement | undefined, current = '', disposed = false;
  let attachGesture: (() => void) | undefined;
  let releaseGesture: (() => void) | undefined;
  const base = () => new URL(win.location.href);
  const directory = new URL('./',win.location.href).pathname;
  const menuUrl = (url: URL) => { const result = new URL('./index.html', url); result.search = url.search; result.searchParams.delete('embedded'); result.searchParams.delete('garage'); return result; };
  const close = () => {
    releaseGesture?.(); releaseGesture = undefined; attachGesture=undefined;
    try {frame?.contentWindow?.__disposeEmbeddedGarage?.();} catch { /* Already unloaded. */ }
    frame?.remove(); panel?.remove(); frame = undefined; panel = undefined; current = '';
  };
  function show(url: URL) {
    if (disposed || current === url.href && frame) return;
    close(); options.suspend(); music?.setPhase('menu');
    current = url.href;
    frame = doc.createElement('iframe'); frame.title = '卡丁车改装车库';
    frame.setAttribute('data-menu-garage', 'true');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:100;background:#285e61';
    const childUrl = new URL(url); childUrl.searchParams.set('embedded','menu');
    frame.src = childUrl.href;
    panel = doc.createElement('section'); panel.setAttribute('role','status');
    panel.style.cssText = 'position:fixed;inset:0;z-index:101;display:grid;place-content:center;gap:16px;background:#163f49;color:white;text-align:center;font:18px sans-serif';
    const label = doc.createElement('p'); label.textContent = '正在打开车库，音乐继续播放…';
    const back = doc.createElement('button'); back.textContent = '返回菜单';
    back.onclick = () => {const target = menuUrl(url); target.searchParams.set('screen','characters'); navigate(target.href);};
    panel.append(label,back);
    const owned = frame;
    attachGesture = () => {
      if (frame !== owned) return;
      releaseGesture?.();
      // Real child gestures invoke resume synchronously, never through postMessage.
      try {
        const child = owned.contentDocument;
        const unlock = (event: Event) => {
          if(frame!==owned)return;
          music?.unlock();
          if(event.type==='keydown'||(event.target as Element)?.closest?.('button,input,select'))options.cancelDeparture();
        };
        for (const type of ['pointerdown','pointerup','touchend','keydown','click']) child?.addEventListener(type,unlock,{capture:true});
        releaseGesture = () => {for (const type of ['pointerdown','pointerup','touchend','keydown','click']) child?.removeEventListener(type,unlock,{capture:true});};
      } catch { /* Restricted frame cannot unlock the optional music. */ }
    };
    frame.addEventListener('load',attachGesture);
    doc.body.append(frame,panel); back.focus();
  }
  function navigate(href: string): boolean {
    if (disposed) return false;
    const url = new URL(href, base());
    if (url.origin !== win.location.origin) return false;
    if (url.pathname === directory+'garage.html') {
      url.searchParams.delete('embedded');
      const route = menuUrl(url); route.searchParams.set('garage','1');
      win.history.pushState(null,'',route.href); show(url); return true;
    }
    if (frame && url.pathname === directory+'index.html') {
      url.searchParams.delete('embedded'); url.searchParams.delete('garage');
      win.history.pushState(null,'',url.href); close(); options.resume(); return true;
    }
    return false;
  }
  const message = (event: MessageEvent) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== win.location.origin || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type === 'kart-garage:ready' && Object.keys(data).length === 1) {attachGesture?.();panel?.remove();panel=undefined;frame.focus();return;}
    if (!['kart-garage:navigate','kart-garage:state'].includes(data.type) || Object.keys(data).length !== 2 || typeof data.href !== 'string' || data.href.length > 12000) return;
    let url: URL; try {url = new URL(data.href);} catch {return;}
    if (url.origin !== win.location.origin || !['index','garage','coast','waterpark','source'].some(name=>url.pathname===directory+name+'.html')) return;
    if(data.type==='kart-garage:state'){
      if(url.pathname!==directory+'garage.html')return;
      url.searchParams.delete('embedded');current=url.href;
      const route=menuUrl(url);route.searchParams.set('garage','1');win.history.replaceState(null,'',route.href);return;
    }
    if (navigate(url.href)) return;
    // Actual race/source departure still uses the established fade and full navigation.
    options.depart(url.href);
  };
  win.addEventListener('message',message);
  return {
    navigate,
    restore() {
      if (new URLSearchParams(win.location.search).get('garage') === '1') {
        const url = new URL('./garage.html',base()); url.search=win.location.search;url.searchParams.delete('garage');show(url);return true;
      }
      close();return false;
    },
    get active() {return !!frame;},
    dispose() {disposed=true;close();win.removeEventListener('message',message);},
  };
}
