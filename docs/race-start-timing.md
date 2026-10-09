# Race startup timing

Both race entrypoints use `createRaceFrameClock`.

Previously an engine frame longer than 250 ms opened the pause dialog even
while the race was only entering its countdown. The interval could include
model preparation or initial rendering. A deterministic 800 ms first-frame
regression reproduced the unwanted dialog in both actual entrypoints.

- Start, replay, restart and resume rebase the first active frame to zero.
- Subsequent slow countdown frames advance by at most 250 ms and cannot spill
  into active racing. Ordinary countdown overflow is retained.
- Once racing, ordinary deltas remain intact for fixed-step simulation. A frame
  longer than 250 ms still pauses rather than running unbounded catch-up work.
- Escape, P, pause controls, blur, hidden tabs, pagehide and unexpected pointer
  lock loss continue to use the existing immediate interruption handlers.
- Pointer-lock denial still falls back to dragging; it does not pause a race.

Coverage includes the real coast and water entrypoints on PlayCanvas
NullGraphicsDevice, their DOM/input adapters, repeated slow startup frames,
restart/replay/resume, 30/60/120 Hz timing, hidden tabs, blur, Escape and mouse
lock fallback/loss. These are CPU/DOM regression checks, not browser GPU or
physical-device performance verification.
