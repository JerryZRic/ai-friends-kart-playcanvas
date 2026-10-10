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
  mounts.get(doc)?.dispose();
  doc.body.insertBefore(canvas, root);
  const vignette = doc.getElementById('vignette');
  if (vignette) doc.body.insertBefore(vignette, root);
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
