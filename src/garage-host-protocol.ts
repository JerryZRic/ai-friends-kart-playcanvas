/** Only our same-origin menu-owned frame may opt out of owning music/navigation. */
export function isMenuGarageFrame(host: Window = window): boolean {
  try { return host.parent !== host && new URLSearchParams(host.location.search).get('embedded') === 'menu' && host.frameElement?.getAttribute('data-menu-garage') === 'true'; }
  catch { return false; }
}
export function sendGarageNavigation(href: string, host: Window = window): boolean {
  if (!isMenuGarageFrame(host)) return false;
  const url = new URL(href, host.location.href);
  if (url.origin !== host.location.origin) return false;
  host.parent.postMessage({type:'kart-garage:navigate', href:url.href}, host.location.origin === 'null' ? '*' : host.location.origin);
  return true;
}
declare global {interface Window {__disposeEmbeddedGarage?: () => void;}}

export function sendGarageState(host: Window = window): void {
  if(isMenuGarageFrame(host))host.parent.postMessage({type:'kart-garage:state',href:host.location.href},host.location.origin==='null'?'*':host.location.origin);
}
