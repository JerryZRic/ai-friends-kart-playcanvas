const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
// Positive yaw looks to the driver's right. Positive pitch looks down.
export function createOrbit() {
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
  return {
    move(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      // Clamp abnormal one-event jumps caused by cursor warps / lock acquisition.
      targetYaw += clamp(x, -300, 300) * .003;
      targetPitch = clamp(targetPitch + clamp(y, -300, 300) * .0025, -.28, .78);
      // Keep an unlimited orbit numerically stable without a seam in smoothing.
      const turns = Math.trunc(targetYaw / TAU);
      if (turns) { targetYaw -= turns * TAU; yaw -= turns * TAU; }
    },
    step(dt) { const a = 1 - Math.exp(-Math.max(0, dt) * 18); yaw += (targetYaw - yaw) * a; pitch += (targetPitch - pitch) * a; return {yaw, pitch}; },
    recenter(snap = false) { targetYaw = yaw + Math.atan2(-Math.sin(yaw), Math.cos(yaw)); targetPitch = 0; if (snap) yaw = pitch = targetYaw = 0; },
    get: () => ({yaw, pitch, targetYaw, targetPitch}),
  };
}

// Browser input is kept separate from camera math so lock-loss races and fallback
// behavior can be regression-tested without mocking Three.js geometry.
export function bindMouseLook(canvas, doc, {orbit, isActive, activate, onRelease, onStatus, canMove = () => true, signal = undefined}) {
  let locked = false, pending = false, wanted = false, fallback = !canvas.requestPointerLock;
  let dragging = false, pointer = null, lastX = 0, lastY = 0, disposed = false;
  const listeners = [];
  const listen = (target, type, listener) => {
    target.addEventListener(type, listener);
    listeners.push(() => target.removeEventListener?.(type, listener));
  };
  const status = () => { if (!disposed) onStatus(locked ? 'locked' : fallback ? 'drag' : 'free'); };
  function release() {
    wanted = false;
    dragging = false;
    const captured = pointer; pointer = null;
    try { if (captured !== null && canvas.hasPointerCapture?.(captured)) canvas.releasePointerCapture?.(captured); } catch { /* Capture may already be gone. */ }
    if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    status();
  }
  function failed() {
    pending = false;
    if (disposed || !wanted || !isActive() || doc.pointerLockElement === canvas) return;
    fallback = true;
    status();
  }
  function request() {
    if (disposed) return;
    wanted = true;
    if (doc.pointerLockElement === canvas || pending || !canvas.requestPointerLock) { status(); return; }
    pending = true;
    try {
      const promise = canvas.requestPointerLock();
      promise?.then(() => { if (disposed && doc.pointerLockElement === canvas) doc.exitPointerLock?.(); }, failed);
    }
    catch { failed(); }
  }
  listen(doc, 'pointerlockchange', () => {
    const wasLocked = locked;
    locked = doc.pointerLockElement === canvas;
    pending = false;
    if (locked) fallback = false;
    dragging = false;
    pointer = null;
    if (locked && (!wanted || !isActive())) { release(); return; }
    status();
    // Unexpected release (including browser Escape) pauses exactly once.
    if (wasLocked && !locked && wanted) { wanted = false; onRelease(); }
  });
  listen(doc, 'pointerlockerror', failed);
  listen(canvas, 'pointerdown', e => {
    if (disposed || e.button !== 0 || e.pointerType === 'touch') return;
    activate();
    if (!isActive()) return;
    e.preventDefault();
    request();
    if (fallback) { dragging = true; pointer = e.pointerId; lastX = e.clientX; lastY = e.clientY; try { canvas.setPointerCapture?.(e.pointerId); } catch { /* Drag also works while the cursor remains over the canvas. */ } }
  });
  listen(doc, 'mousemove', e => {
    if (!disposed && locked && isActive() && canMove()) orbit.move(e.movementX, e.movementY);
  });
  listen(doc, 'mouseup', e => { if (e.button === 0) { dragging = false; pointer = null; } });
  listen(canvas, 'pointermove', e => {
    if (e.pointerType !== 'touch' && typeof e.buttons === 'number' && !(e.buttons & 1)) { dragging = false; pointer = null; }
    if (!disposed && dragging && e.pointerId === pointer && isActive()) {
      if (canMove()) orbit.move(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, event, e => {
    if (e.pointerId === pointer) { dragging = false; pointer = null; }
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    const awaitingLock = pending;
    release(); locked = false;
    for (const remove of listeners.splice(0)) remove();
    signal?.removeEventListener('abort', dispose);
    // Legacy implementations return no request promise. Retain only a one-shot
    // cancellation guard until an in-flight browser request resolves, so leaving
    // a scene cannot acquire a stale pointer lock after all game listeners stop.
    if (awaitingLock) {
      const settle = () => {
        pending = false;
        doc.removeEventListener?.('pointerlockchange', settle);
        doc.removeEventListener?.('pointerlockerror', settle);
        if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
      };
      doc.addEventListener('pointerlockchange', settle);
      doc.addEventListener('pointerlockerror', settle);
    }
  }
  signal?.addEventListener('abort', dispose, {once: true});
  if (signal?.aborted) dispose(); else status();
  return {release, dispose, get: () => ({locked, pending, fallback, dragging})};
}
