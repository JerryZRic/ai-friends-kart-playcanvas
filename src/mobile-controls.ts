import {bindControlPreferenceSelect, controlPreference, CONTROL_PREFERENCE_EVENT, resolveControlMode, type ControlCapabilities, type EffectiveControlMode} from './control-mode';
export {resolveControlMode, type ControlMode} from './control-mode';
export const CONTROL_MODE_EVENT = 'racecontrolmodechange';
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
  const toolbar = doc.getElementById('raceSystemTools');
  const toggle = doc.getElementById('mobileControlModeToggle');
  const popover = doc.getElementById('mobileControlModePopover');
  doc.body.appendChild(panel); doc.body.appendChild(toolbar ?? modePanel);
  function closePopover() { if (popover) popover.hidden = true; toggle?.setAttribute('aria-expanded', 'false'); }
  function togglePopover() {
    if (!popover) return;
    const open = popover.hidden;
    if (open) {
      const perfToggle = doc.getElementById('perf-toggle');
      if (perfToggle?.getAttribute('aria-expanded') === 'true') perfToggle.click();
    }
    popover.hidden = !open; toggle?.setAttribute('aria-expanded', String(open));
    if (open) selector?.focus?.();
  }
  function outside(event: Event) {
    if (!modePanel?.contains?.(event.target as Node)) closePopover();
  }
  function dismiss(event: KeyboardEvent) {
    if (event.code === 'Escape' && popover && !popover.hidden) {
      event.preventDefault(); event.stopImmediatePropagation(); closePopover(); toggle?.focus?.();
    }
  }
  toggle?.addEventListener('click', togglePopover);
  selector.addEventListener('change', closePopover);
  doc.addEventListener('click', outside, true);
  win.addEventListener('keydown', dismiss, true);
  win.addEventListener('resize', closePopover);
  win.addEventListener('blur', closePopover);
  const query = (value: string) => { try { return win.matchMedia?.(value); } catch { return undefined; } };
  const media = {
    coarse: query('(pointer: coarse)'), fine: query('(pointer: fine)'),
    hover: query('(hover: hover)'), anyCoarse: query('(any-pointer: coarse)'),
  };
  let observed: EffectiveControlMode | null = null, lastTouch = -Infinity, disposed = false;
  const selectors = [selector, doc.getElementById('pauseControlMode') as HTMLSelectElement | null].filter((node): node is HTMLSelectElement => !!node);
  const unbind = selectors.map(node => bindControlPreferenceSelect(doc, node));
  function update() {
    if (disposed) return;
    const capabilities: ControlCapabilities = {touchPoints: win.navigator.maxTouchPoints || 0,
      coarse: media.coarse?.matches ?? false, fine: media.fine?.matches ?? false,
      hover: media.hover?.matches ?? false, anyCoarse: media.anyCoarse?.matches ?? false,
      pointerMedia: Object.values(media).some(Boolean)};
    const mode = resolveControlMode(controlPreference(doc), capabilities, observed);
    if (doc.body.dataset.inputMode === mode) return;
    doc.body.dataset.inputMode = mode;
    doc.dispatchEvent(new Event(CONTROL_MODE_EVENT));
  }
  function preferenceChanged() { observed = null; update(); }
  function capabilityChanged() { observed = null; update(); }
  function pointer(event: PointerEvent) {
    // Do not move/hide a UI target between its pointerdown and click.
    if ((event.target as Element | null)?.closest?.('button,a,input,select,textarea,[contenteditable],.mobile-control-popover,#perf-body,.pause-panel')) return;
    const now = Date.now();
    if (event.pointerType === 'touch') { lastTouch = now; observed = 'touch'; }
    else if (event.pointerType === 'mouse' && !(event as PointerEvent & {sourceCapabilities?: {firesTouchEvents?: boolean}}).sourceCapabilities?.firesTouchEvents && now - lastTouch > 900) observed = 'desktop';
    else return;
    update();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        (event.target as Element | null)?.closest?.('input,select,textarea,button,a,[contenteditable]')) return;
    if (!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(event.code)) return;
    observed = 'desktop'; update();
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const stop of unbind) stop();
    doc.removeEventListener('pointerdown', pointer, {capture: true});
    win.removeEventListener('keydown', keyboard, {capture: true});
    doc.removeEventListener(CONTROL_PREFERENCE_EVENT, preferenceChanged);
    for (const query of Object.values(media)) query?.removeEventListener?.('change', capabilityChanged);
    win.removeEventListener('pagehide', pagehide);
    toggle?.removeEventListener('click', togglePopover);
    selector!.removeEventListener('change', closePopover);
    doc.removeEventListener('click', outside, {capture: true});
    win.removeEventListener('keydown', dismiss, {capture: true});
    win.removeEventListener('resize', closePopover);
    win.removeEventListener('blur', closePopover);
    panel!.remove(); (toolbar ?? modePanel)!.remove();
    delete doc.body.dataset.inputMode;
    mounts.delete(doc);
  }
  function pagehide(event: PageTransitionEvent) { if (!event.persisted) dispose(); }
  doc.addEventListener(CONTROL_PREFERENCE_EVENT, preferenceChanged);
  // Capture phase changes mode and clears old holds before the new input is read.
  // Pointerdown expresses intent; hover motion never causes mode oscillation.
  doc.addEventListener('pointerdown', pointer, {capture: true});
  win.addEventListener('keydown', keyboard, {capture: true});
  for (const query of Object.values(media)) query?.addEventListener?.('change', capabilityChanged);
  win.addEventListener('pagehide', pagehide);
  update();
  const mounted = {dispose}; mounts.set(doc, mounted); return mounted;
}

/** Release a race view without synthesizing a document-wide pagehide. */
export function disposeMobileControls(doc: Document) {
  mounts.get(doc)?.dispose();
}
