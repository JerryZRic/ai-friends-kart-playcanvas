/** Capability detection, independent of UA strings and viewport width. */
export type ControlMode = 'auto' | 'touch' | 'desktop';
export const CONTROL_MODE_EVENT = 'racecontrolmodechange';
export function resolveControlMode(preference: ControlMode, touchPoints: number, coarse: boolean, observedTouch = false) {
  return preference === 'auto' ? ((touchPoints > 0 && coarse) || observedTouch ? 'touch' : 'desktop') : preference;
}
export function touchHint(text: string) {
  return text.replace(/左 Shift \+ A \/ D|Shift \+ A \/ D/g, '漂移 + 左右转向')
    .replace(/左 Shift|Shift/g, '漂移').replace(/按住 W 油门/g, '按住油门').replace(/按住 W/g, '按住油门').replace(/按 E|E 使用/g, '点击道具');
}
const mounts = new WeakMap<Document, {dispose(): void}>();
/** Physical-size touch targets sit outside the proportional HUD transform. */
export function mountMobileControls(doc: Document, canvas: HTMLCanvasElement) {
  const win = doc.defaultView;
  if (!win || !doc.body?.appendChild) return null;
  mounts.get(doc)?.dispose();
  const panel = doc.getElementById('mobileTouchControls');
  const modePanel = doc.getElementById('mobileControlModePanel');
  const selector = doc.getElementById('mobileControlMode') as HTMLSelectElement | null;
  if (!panel || !modePanel || !selector) return null;
  doc.body.appendChild(panel); doc.body.appendChild(modePanel);
  const coarse = win.matchMedia?.('(any-pointer: coarse)');
  let preference: ControlMode = 'auto', observedTouch = false, disposed = false;
  try { const saved = win.localStorage.getItem('kart-control-mode'); if (saved === 'touch' || saved === 'desktop') preference = saved; } catch { /* Private browsing can disable storage. */ }
  selector.value = preference;
  function update() {
    const mode = resolveControlMode(preference, win.navigator.maxTouchPoints || 0, coarse?.matches ?? false, observedTouch);
    if (doc.body.dataset.inputMode === mode) return;
    doc.body.dataset.inputMode = mode;
    doc.dispatchEvent(new Event(CONTROL_MODE_EVENT));
  }
  function change() {
    preference = selector!.value === 'touch' || selector!.value === 'desktop' ? selector!.value : 'auto';
    try { win.localStorage.setItem('kart-control-mode', preference); } catch { /* Optional preference only. */ }
    update();
  }
  function touch(event: PointerEvent) { if (event.pointerType === 'touch' && !observedTouch) { observedTouch = true; update(); } }
  function dispose() {
    if (disposed) return; disposed = true;
    selector!.removeEventListener('change', change);
    canvas.removeEventListener('pointerdown', touch, true);
    coarse?.removeEventListener?.('change', update);
    win.removeEventListener('pagehide', pagehide);
    panel!.remove(); modePanel!.remove();
    delete doc.body.dataset.inputMode;
    mounts.delete(doc);
  }
  function pagehide(event: PageTransitionEvent) { if (!event.persisted) dispose(); }
  selector.addEventListener('change', change);
  // Capture phase ensures first touch selects controls before gesture handling.
  canvas.addEventListener('pointerdown', touch, {capture: true});
  coarse?.addEventListener?.('change', update);
  win.addEventListener('pagehide', pagehide);
  update();
  const mounted = {dispose}; mounts.set(doc, mounted); return mounted;
}
