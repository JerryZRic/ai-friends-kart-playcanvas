import {createOrbit, bindMouseLook} from './mouse-look.js';
import {keyCode} from './vehicle-controls.js';

export type RaceControlState = 'active' | 'paused' | 'menu' | 'finished' | 'loading';
export type RaceLookStatus = 'free' | 'drag' | 'locked';
export type RaceControlsOptions = {
  state: () => RaceControlState;
  /** Toggle active/paused. Escape and interruption call this only while active. */
  pause: () => void;
  useItem: () => void;
  switchCamera: () => void;
  /** Feedback only: Q has already recentered the shared orbit. */
  recenter: () => void;
  start: () => void;
  status: (status: RaceLookStatus) => void;
  onClear?: () => void;
  orbit?: ReturnType<typeof createOrbit>;
  document?: Document;
  window?: Window;
  buttons?: Iterable<HTMLButtonElement>;
  signal?: AbortSignal;
};

const handledCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyZ', 'KeyC', 'KeyP', 'KeyQ', 'Escape']);

/** Keep text entry and native button/link activation working during a race. */
export function isNativeRaceKey(target: EventTarget | null, code: string, state: RaceControlState) {
  const element = target as Element | null;
  if (element?.closest?.('input,select,textarea,[contenteditable]')) return true;
  return !!element?.closest?.('button,a') && ((state === 'paused' && code !== 'KeyP' && code !== 'Escape') || state === 'menu' || state === 'finished' || state === 'loading' || code === 'Space' || code === 'Enter');
}

/**
 * One browser binding for all maps. Maps adapt race state and actions, never
 * rebuild the keyboard, touch, rear-view or pointer-lock lifecycle themselves.
 * `keys` is a stable plain record compatible with driveInput(). Call clear()
 * on reset/pause instead of assigning keys directly: input sources are separate.
 */
export function bindRaceControls(canvas: HTMLCanvasElement, options: RaceControlsOptions) {
  const doc = options.document ?? document, win = options.window ?? window;
  const keys: Record<string, boolean> = {};
  const orbit = options.orbit ?? createOrbit();
  const keyboard = new Set<string>(), pointers = new Map<number, {code: string; target: HTMLElement}>();
  const removeListeners: Array<() => void> = [];
  let rearMouse = false, disposed = false;
  const active = () => !disposed && options.state() === 'active';
  function on(target: EventTarget, type: string, listener: (event: any) => void) {
    target.addEventListener(type, listener);
    removeListeners.push(() => target.removeEventListener(type, listener));
  }
  function sync(code: string) {
    keys[code] = keyboard.has(code) || [...pointers.values()].some(pointer => pointer.code === code) || (code === 'RearView' && rearMouse);
  }
  function clear() {
    keyboard.clear(); rearMouse = false;
    const captured = [...pointers.entries()]; pointers.clear();
    for (const code in keys) keys[code] = false;
    for (const [id, {target}] of captured) {
      try { if (target.hasPointerCapture?.(id)) target.releasePointerCapture?.(id); } catch { /* The browser may already have released it. */ }
    }
    options.onClear?.();
  }
  let mouseLook: ReturnType<typeof bindMouseLook>;
  function release() {
    clear();
    if (active()) options.pause();
    mouseLook?.release();
  }
  on(win, 'keydown', (event: KeyboardEvent) => {
    const code = keyCode(event), state = options.state();
    if (disposed || isNativeRaceKey(event.target, code, state)) return;
    if (handledCodes.has(code)) event.preventDefault();
    if (!event.repeat) {
      if (code === 'KeyE') options.useItem();
      if (code === 'KeyP' && (state === 'active' || state === 'paused')) {
        if (state === 'active') { clear(); mouseLook.release(); }
        options.pause();
      }
      if (code === 'Escape') release();
      if (code === 'KeyQ') { orbit.recenter(); options.recenter(); }
      if (code === 'KeyZ' || code === 'KeyC') options.switchCamera();
      if (code === 'Enter' && (state === 'menu' || state === 'finished')) options.start();
    }
    if (active() && handledCodes.has(code)) { keyboard.add(code); sync(code); }
  });
  on(win, 'keyup', (event: KeyboardEvent) => {
    const code = keyCode(event);
    if (!isNativeRaceKey(event.target, code, options.state()) && handledCodes.has(code)) event.preventDefault();
    // A key released over a newly focused control must still clear its source.
    keyboard.delete(code); sync(code);
  });
  on(win, 'blur', release);
  on(doc, 'visibilitychange', () => { if (doc.hidden) release(); });
  on(win, 'pagehide', release);
  on(canvas, 'contextmenu', (event: Event) => event.preventDefault());
  on(canvas, 'pointerdown', (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.button !== 2 || !active()) return;
    event.preventDefault(); rearMouse = true; sync('RearView');
    if (doc.pointerLockElement !== canvas) {
      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Capture can be denied after lock/visibility changes. */ }
    }
  });
  // Mouse events report individual chorded button releases; pointerup only
  // fires when the final mouse button is released.
  on(canvas, 'mousedown', (event: MouseEvent) => {
    if (event.button === 2 && active()) { event.preventDefault(); rearMouse = true; sync('RearView'); }
  });
  on(doc, 'mouseup', (event: MouseEvent) => { if (event.button === 2) { rearMouse = false; sync('RearView'); } });
  on(canvas, 'pointermove', (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && typeof event.buttons === 'number') {
      rearMouse = !!(event.buttons & 2) && active(); sync('RearView');
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    on(canvas, type, () => { rearMouse = false; sync('RearView'); });
  }
  for (const button of options.buttons ?? doc.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    const code = button.dataset.key;
    if (!code) continue;
    on(button, 'pointerdown', (event: PointerEvent) => {
      if (!active() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      const previous = pointers.get(event.pointerId);
      pointers.set(event.pointerId, {code, target: button});
      if (previous) sync(previous.code);
      sync(code);
      try { button.setPointerCapture?.(event.pointerId); } catch { /* Clearing below remains safe without capture. */ }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      on(button, type, (event: PointerEvent) => {
        const pointer = pointers.get(event.pointerId);
        if (!pointer || pointer.target !== button) return;
        pointers.delete(event.pointerId); sync(pointer.code);
      });
    }
  }
  mouseLook = bindMouseLook(canvas, doc, {
    orbit, isActive: active,
    activate: () => { if (!disposed && options.state() === 'paused') options.pause(); },
    onRelease: release, onStatus: options.status, canMove: () => !keys.RearView,
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear(); mouseLook.dispose();
    for (const remove of removeListeners.splice(0)) remove();
    options.signal?.removeEventListener('abort', dispose);
  }
  options.signal?.addEventListener('abort', dispose, {once: true});
  if (options.signal?.aborted) dispose();
  return {keys, orbit, mouseLook, clear, release, dispose};
}
