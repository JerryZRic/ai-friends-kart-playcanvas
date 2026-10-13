import { mountUiLayout, mountUiViewportNotice } from './ui-layout';

type RaceUiMount = { dispose(): void };
const mounts = new WeakMap<Document, RaceUiMount>();

/** Mount the HTML-only race composition before either renderer starts.
 * The WebGL canvas must remain outside the transformed containing block:
 * its resolution, pointer-lock coordinates and camera aspect use the viewport.
 */
export function mountRaceUiLayout(doc: Document, canvas: HTMLCanvasElement) {
  const root = doc.getElementById('raceUi'), host = doc.defaultView;
  // Headless map/shell consumers can omit the browser's presentation root.
  if (!root || !host) return null;
  // SPA scenes live under #app-scene; the reference must belong to this parent.
  // Keep physical layers beside (not inside) the transformed race UI, so they
  // also leave with their scene instead of leaking into the persistent body.
  const scene = root.parentElement;
  if (!scene) return null;
  mounts.get(doc)?.dispose();
  scene.insertBefore(canvas, root);
  const vignette = doc.getElementById('vignette');
  if (vignette) scene.insertBefore(vignette, root);
  root.classList.add('fixed-ui-root');
  const layout = mountUiLayout(root, undefined, host);
  const notice = mountUiViewportNotice(root, host);
  let disposed = false;

  function pagehide(event: PageTransitionEvent) {
    if (!event.persisted) dispose();
  }
  function pageshow() { layout.update(); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    layout.dispose(); notice.dispose();
    host!.removeEventListener('pagehide', pagehide);
    host!.removeEventListener('pageshow', pageshow);
    if (mounts.get(doc)?.dispose === dispose) mounts.delete(doc);
  }
  host.addEventListener('pagehide', pagehide);
  host.addEventListener('pageshow', pageshow);
  const mounted = { dispose, get layout() { return layout.layout; } };
  mounts.set(doc, mounted);
  return mounted;
}

export function disposeRaceUiLayout(doc: Document) {
  mounts.get(doc)?.dispose();
}
