// Drive inputs use physical KeyboardEvent.code so Shift/Caps Lock/IME do not
// change the WASD layout. The fallback also supports touch buttons and tests.
export function keyCode(event) {
  if (event.code) return event.code;
  const aliases = {' ': 'Space', Shift: 'ShiftLeft', Control: 'ControlLeft'};
  return aliases[event.key] || (/^[a-z]$/i.test(event.key) ? `Key${event.key.toUpperCase()}` : event.key);
}
export function driveInput(keys) {
  return {
    steer: Number(!!(keys.KeyD || keys.ArrowRight)) - Number(!!(keys.KeyA || keys.ArrowLeft)),
    throttle: !!(keys.KeyW || keys.ArrowUp),
    reverse: !!(keys.KeyS || keys.ArrowDown),
    brake: !!keys.Space,
    handbrake: !!(keys.ShiftLeft || keys.ShiftRight),
    rearView: !!keys.RearView,
  };
}
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
export function driveSpeed(speed, input, dt, limit) {
  // Space only stops the kart. S first brakes, then reverses while held.
  if (input.brake || (input.throttle && input.reverse)) return approach(speed, 0, 38 * dt);
  if (input.reverse) {
    if (speed > 0) return approach(speed, 0, 32 * dt);
    return approach(speed, -Math.min(11, limit * .3), (input.handbrake ? 4 : 9) * dt);
  }
  if (input.throttle) {
    if (speed < 0) return approach(speed, 0, 28 * dt);
    const target = limit * (input.handbrake ? .76 : 1);
    return approach(speed, target, (speed > target ? 22 : 18) * dt);
  }
  return approach(speed, 0, (input.handbrake ? 18 : 6) * dt);
}
export function lateralInput(steer, speed, maxSpeed, drifting, dt) {
  // Track +lane is camera-left. D is right-positive, so subtract it. Signed
  // speed naturally reverses steering travel when backing up.
  return -steer * (drifting ? 8 : 7) * speed / maxSpeed * dt;
}
export function steeringYaw(steer, speed, drifting) {
  return -steer * (speed < 0 ? -1 : 1) * (drifting ? .36 : .12) * Math.min(1, Math.abs(speed) / 5);
}
