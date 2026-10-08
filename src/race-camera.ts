/** Engine-independent chase geometry shared by every playable map. */
export type RaceVector = { x: number; y: number; z: number };
export type RaceCameraOptions = {
  position: RaceVector;
  tangent: RaceVector;
  view: number;
  rearView: boolean;
  orbit: { yaw: number; pitch: number };
};

/**
 * The coast camera is the reference: both modes use its exact distance, height,
 * look-ahead, pitch clamps and right-positive mouse yaw. Rear view temporarily
 * overrides the orbit, so releasing it restores the user's previous direction.
 */
export function chaseCamera({position, tangent, view, rearView, orbit}: RaceCameraOptions) {
  const yaw = rearView ? Math.PI : orbit.yaw, pitch = rearView ? 0 : orbit.pitch;
  const behind = view ? 15 : 10.5, height = view ? 7.9 : 4.6;
  const length = Math.hypot(tangent.x, tangent.z);
  const x = length ? tangent.x / length : 0, z = length ? tangent.z / length : 0;
  const forward = {x: x * Math.cos(yaw) - z * Math.sin(yaw), z: x * Math.sin(yaw) + z * Math.cos(yaw)};
  const radius = Math.hypot(behind, height - 1);
  const elevation = Math.max(.08, Math.min(1.15, Math.atan2(height - 1, behind) + pitch));
  const distance = -radius * Math.cos(elevation), ahead = (view ? 12 : 16) * Math.cos(elevation);
  return {
    position: {x: position.x + forward.x * distance, y: position.y + 1 + radius * Math.sin(elevation), z: position.z + forward.z * distance},
    look: {x: position.x + forward.x * ahead, y: position.y + 1 - Math.sin(pitch) * 8, z: position.z + forward.z * ahead},
  };
}
