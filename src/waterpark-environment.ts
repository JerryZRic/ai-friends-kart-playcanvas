import * as pc from 'playcanvas';
import {waterparkLayout, type WaterparkGeometryOptions, type MeshData} from './waterpark-design';
import type {WaterparkSurface} from './waterpark-materials';

export type EnvironmentMesh = MeshData & {surface: WaterparkSurface; depthBand: 'near' | 'middle' | 'far'};
export const WATERPARK_DETAIL_BUDGET = {batches: 10, triangles: 12000} as const;
const v = (x = 0, y = 0, z = 0) => new pc.Vec3(x, y, z);
const box = new pc.BoxGeometry();
const cylinder = new pc.CylinderGeometry({radius: .5, height: 1, capSegments: 8, heightSegments: 1});
const shrub = new pc.SphereGeometry({latitudeBands: 5, longitudeBands: 8});

class DetailBatch {
  data: EnvironmentMesh;
  constructor(name: string, color: string, surface: WaterparkSurface, depthBand: EnvironmentMesh['depthBand']) {
    this.data = {name, color, surface, depthBand, positions: [], indices: [], uvs: []};
  }
  add(geometry: pc.Geometry, position: pc.Vec3, scale: pc.Vec3, rotation = v()) {
    const transform = new pc.Mat4().setTRS(position, new pc.Quat().setFromEulerAngles(rotation.x, rotation.y, rotation.z), scale);
    const offset = this.data.positions.length / 3;
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const point = transform.transformPoint(v(geometry.positions[i], geometry.positions[i + 1], geometry.positions[i + 2]));
      this.data.positions.push(point.x, point.y, point.z);
    }
    for (const index of geometry.indices) this.data.indices.push(offset + index);
  }
  quad(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3, d: pc.Vec3) {
    const offset = this.data.positions.length / 3;
    for (const p of [a, b, c, d]) this.data.positions.push(p.x, p.y, p.z);
    this.data.indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
}

/** Original static details, merged by depth/material instead of one draw per prop. */
export function createWaterparkEnvironmentDetails(options: WaterparkGeometryOptions = {}): EnvironmentMesh[] {
  const {sample, start, end, closed} = waterparkLayout(options);
  const landmarks = (distances: number[]) => closed ? [...distances, ...distances.map(d => d + (end - start) / 2)] : distances;
  const batches: DetailBatch[] = [];
  const batch = (name: string, color: string, surface: WaterparkSurface, depth: EnvironmentMesh['depthBand']) => {
    const result = new DetailBatch(name, color, surface, depth); batches.push(result); return result;
  };
  const joints = batch('Near coping and promenade joints', '#c2b59c', 'sandstone', 'near');
  const wetStone = batch('Near darkened wet stone waterline', '#adbcb5', 'wetStone', 'near');
  const grates = batch('Near brushed drainage and pool ladders', '#b6ccd1', 'metal', 'near');
  const recess = batch('Near drainage recesses', '#466a70', 'stone', 'near');
  const stone = batch('Middle stone planters and bench feet', '#eadbbd', 'stone', 'middle');
  const wood = batch('Middle timber bench slats', '#bb8c66', 'wood', 'middle');
  const hardware = batch('Middle brushed bridge and walkway hardware', '#c5dbe0', 'metal', 'middle');
  const foliage = batch('Middle planted foliage clusters', '#70ad79', 'foliage', 'middle');
  const distant = batch('Far pale resort terraces', '#c1d8e1', 'stone', 'far');
  const windows = batch('Far blue resort glazing', '#548498', 'glass', 'far');

  function point(distance: number, lateral: number, y: number) {
    const p = sample(distance, lateral).p; p.y = y; return p;
  }
  function place(target: DetailBatch, geometry: pc.Geometry, distance: number, lateral: number, y: number, scale: pc.Vec3, localRotation = v()) {
    const yaw = sample(distance).angle * 180 / Math.PI;
    target.add(geometry, point(distance, lateral, y), scale, v(localRotation.x, yaw + localRotation.y, localRotation.z));
  }

  for (const side of [-1, 1]) {
    // Five millimetres in front of the coping wall prevents z-fighting.
    // This thin visual coating is not a collision/handling change.
    for (let d = start; d < end; d += 2) wetStone.quad(
      point(d, side * 11.995, -.16), point(d, side * 11.995, .1),
      point(Math.min(end, d + 2), side * 11.995, -.16), point(Math.min(end, d + 2), side * 11.995, .1),
    );
    // Expansion joints read in the foreground only. Long quiet gaps are kept
    // between fixtures so the track silhouette remains the primary cue.
    for (let d = closed ? 0 : -24; d < end - 7; d += 4) {
      joints.quad(point(d, side * 12.72, .288), point(d, side * 13.1, .288), point(d + .025, side * 12.72, .288), point(d + .025, side * 13.1, .288));
      if (d % 8 === 0) joints.quad(point(d, side * 13.14, .29), point(d, side * 17.12, .29), point(d + .035, side * 13.14, .29), point(d + .035, side * 17.12, .29));
    }
    for (let d = 8; d < end - 15; d += 44) {
      place(recess, box, d, side * 13.5, .285, v(.43, .025, 1.25));
      for (let slot = 0; slot < 8; slot++) place(grates, box, d - .52 + slot * .15, side * 13.5, .303, v(.37, .025, .05));
    }
    for (const d of landmarks([53, 137, 263])) {
      for (const z of [-.48, .48]) {
        place(grates, cylinder, d + z, side * 12.35, .68, v(.085, 1.16, .085));
        place(grates, cylinder, d + z, side * 12.72, .8, v(.085, .82, .085));
        place(grates, cylinder, d + z, side * 12.54, 1.22, v(.08, .4, .08), v(0, 0, 90));
      }
      for (const y of [.31, .63, .95]) place(grates, cylinder, d, side * 12.35, y, v(.07, .96, .07), v(90, 0, 0));
    }

    for (const d of landmarks([35, 91, 151, 225, 285])) {
      const lateral = side * 22.7;
      for (const z of [-1, 1]) place(stone, box, d + z, lateral, 2.7, v(.75, .9, .28));
      for (const x of [-.28, 0, .28]) place(wood, box, d, lateral + x, 3.19, v(.21, .15, 2.85));
      for (const y of [3.55, 3.87]) place(wood, box, d, lateral + side * .47, y, v(.14, .22, 2.85), v(0, 0, side * -9));
      for (const z of [-1.1, 1.1]) place(hardware, box, d + z, lateral + side * .43, 3.4, v(.09, 1.22, .09));
      const pd = d + 4.3, pl = lateral + side * .4;
      place(stone, box, pd, pl, 2.8, v(2.3, 1.1, 2.3));
      for (let i = 0; i < 3; i++) place(foliage, shrub, pd + Math.sin(i * 2.1) * .52, pl + Math.cos(i * 2.1) * .5, 3.44 + (i % 2) * .3, v(1.45, 1.14, 1.4));
    }
    for (let d = 18; d < end - 10; d += 44) {
      place(hardware, cylinder, d, side * 16.35, .88, v(.16, 1.2, .16));
      place(stone, cylinder, d, side * 16.35, 1.48, v(.26, .14, .26));
    }
  }

  // Sparse bridge ribs and arch keystones give readable scale in the underpass.
  const bridge = sample(183), yaw = bridge.angle * 180 / Math.PI;
  const bp = (l: number, y: number, z: number) => v(bridge.p.x + bridge.n.x * l + bridge.t.x * z, y, bridge.p.z + bridge.n.z * l + bridge.t.z * z);
  for (const front of [-1, 1]) {
    stone.add(box, bp(0, 6.87, front * 3.29), v(.75, .64, .18), v(0, yaw, 0));
    for (const l of [-14.8, 14.8]) hardware.add(box, bp(l, 5.4, front * 3.13), v(1.5, .11, .12), v(0, yaw, 0));
  }

  // Only four restrained, untextured background volumes. No high frequency
  // window grid: broad setback bands keep the landmark tower legible.
  for (const [d, lateral, width, height] of [[104, 57, 17, 13], [152, -61, 21, 10], [240, 61, 20, 16], [304, -55, 24, 11]]) {
    place(distant, box, d, lateral, 2.25 + height / 2, v(width, height, 11));
    for (const y of [height * .38, height * .72]) {
      place(windows, box, d - 5.54, lateral, 2.25 + y, v(width * .8, 1.15, .08));
      place(distant, box, d - 5.85, lateral, 1.62 + y, v(width * .91, .22, 1));
    }
    place(distant, box, d + .8, lateral, 2.25 + height + .85, v(width * .63, 1.7, 7.5));
  }
  return batches.map(b => b.data);
}
