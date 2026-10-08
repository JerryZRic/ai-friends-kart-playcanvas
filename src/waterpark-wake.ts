import * as pc from 'playcanvas';
import {waterparkLayout, WATER_HALF_WIDTH, type WaterparkGeometryOptions} from './waterpark-design';
import {sampleWaterSurface, finiteWaterValue} from './waterpark-surface';

export const WAKE_SEGMENTS = 24, SPRAY_DROPLETS = 28, CONTACT_SEGMENTS = 20;
export const WATERPARK_WAKE_BUDGET = Object.freeze({draws: 2, triangles: WAKE_SEGMENTS * 4 + CONTACT_SEGMENTS * 2 + SPRAY_DROPLETS * 2});
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const waterLane = (lane: number) => clamp(lane, -WATER_HALF_WIDTH + .06, WATER_HALF_WIDTH - .06);

/** Deterministic fixed-size visual geometry. Contact foam hugs the bow waterline,
 * twin trails curve with lateral speed, and spray follows gravity. This changes
 * no mount, rider, movement state or collision response. */
export function waterparkEffectGeometry(distance: number, lane: number, speed: number, time: number, lateralSpeed = 0, options: WaterparkGeometryOptions = {}) {
  const {sample, closed, start, end} = waterparkLayout(options);
  distance = closed ? finiteWaterValue(distance) : clamp(finiteWaterValue(distance), Math.max(0, start), Math.min(285, end)); lane = clamp(finiteWaterValue(lane), -10.5, 10.5);
  speed = clamp(finiteWaterValue(speed), 0, 30); time = Math.max(0, finiteWaterValue(time)); lateralSpeed = clamp(finiteWaterValue(lateralSpeed), -8, 8);
  const positions: number[] = [], contact: number[] = [], spray: number[] = [];
  const effort = speed / 30, turn = Math.abs(lateralSpeed) / 8, length = 3 + effort * 15;
  const bow = sample(distance + .65, lane), surface = sampleWaterSurface(bow.p.x, bow.p.z, time);
  const incomingSlope = surface.dx * (bow.t.x * speed + bow.n.x * lateralSpeed) + surface.dz * (bow.t.z * speed + bow.n.z * lateralSpeed);
  const impact = clamp(incomingSlope * .65, 0, .4);
  for (const side of [-1, 1]) for (let i = 0; i <= WAKE_SEGMENTS; i++) {
    const f = i / WAKE_SEGMENTS, d = distance - 1.5 - f * length, lag = f * length / Math.max(speed, 4);
    const center = lane - lateralSpeed * lag * .55 + side * (.65 + f * (1.25 + turn * .9));
    const width = .19 + f * (.58 + turn * .25);
    for (const offset of [-width, width]) {
      const p = sample(d, waterLane(center + offset)).p;
      positions.push(p.x, sampleWaterSurface(p.x, p.z, time).height + .035, p.z);
    }
  }
  // A soft horseshoe at the actual bow contact line connects the outgoing
  // trails and droplets to the hull. It shares the wake draw using a UV tag.
  const heading = lateralSpeed * 2.3 * Math.PI / 180, sin = Math.sin(heading), cos = Math.cos(heading);
  for (let i = 0; i <= CONTACT_SEGMENTS; i++) {
    const angle = (i / CONTACT_SEGMENTS - .5) * Math.PI * 1.5;
    const across = Math.sin(angle), forward = Math.cos(angle);
    const pressure = 1 + Math.sign(across) * lateralSpeed / 8 * .3;
    const width = (.085 + effort * .19 + turn * .08 + impact * .1) * pressure;
    for (const outside of [0, 1]) {
      const x = across * (.7 + outside * width), z = .18 + forward * (1.23 + outside * width);
      const d = distance + z * cos - x * sin, l = waterLane(lane + x * cos + z * sin);
      const p = sample(d, l).p;
      contact.push(p.x, sampleWaterSurface(p.x, p.z, time).height + .042, p.z);
    }
  }
  for (let i = 0; i < SPRAY_DROPLETS; i++) {
    const side = i % 2 ? 1 : -1, phase = (time + i * .61803398875) % 1;
    const outward = side * lateralSpeed / 8, variation = .82 + (i * .754877666 % 1) * .32;
    const launchVelocity = clamp((2.35 + effort * 1.1 + turn * .55 + impact) * variation, 1.8, 4.35);
    const flight = 2 * launchVelocity / 9.8, age = phase;
    const height = launchVelocity * age - 4.9 * age * age;
    // A full dead interval before recycling removes the old midair reset pop.
    const visibility = clamp(age / .035, 0, 1) * clamp((flight - age) / .12, 0, 1);
    const longitudinalVelocity = -(speed * .56 + 1.2);
    const sidewaysVelocity = side * (1.4 + effort * 2 + turn * 1.6) * (1 + outward * .24) - lateralSpeed * .2;
    const d = distance + .8 + age * longitudinalVelocity, l = waterLane(lane + side * .63 + age * sidewaysVelocity);
    const s = sample(d, l), waterHeight = sampleWaterSurface(s.p.x, s.p.z, time).height;
    const y = waterHeight + .04 + Math.max(0, height);
    const size = (.027 + effort * .04 + turn * .025 + impact * .025) * (1 - phase * .7) * visibility;
    // Tapered short streaks lean along the actual trajectory. Each droplet is
    // still just two triangles; no particle entities, billboards or bodies.
    const tailTime = size * .38;
    const tail = sample(d - longitudinalVelocity * tailTime, waterLane(l - sidewaysVelocity * tailTime));
    const tailY = Math.max(sampleWaterSurface(tail.p.x, tail.p.z, time).height + .04, y - (launchVelocity - 9.8 * age) * tailTime);
    for (const sideWidth of [-1, 1]) spray.push(s.p.x + s.n.x * sideWidth * size, y, s.p.z + s.n.z * sideWidth * size);
    for (const sideWidth of [-.32, .32]) spray.push(tail.p.x + tail.n.x * sideWidth * size, tailY, tail.p.z + tail.n.z * sideWidth * size);
  }
  return {
    positions, contact, spray, impact,
    strength: clamp(speed / 18, 0, .88), sprayStrength: clamp((speed - 2) / 20 + turn * .22 + impact * .15, 0, .8), enabled: speed > .6,
  };
}

export const WATERPARK_EFFECT_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec2 uv;
void main() { uv = aUv0; gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0); }
`;
export const WATERPARK_WAKE_FRAGMENT_SHADER = `
#include "gammaPS"
varying vec2 uv;
uniform float strength;
uniform float time;
void main() {
  float edge = sin(uv.x * 3.14159265);
  float contact = 1.0 - step(0.0, uv.y);
  float trail = max(0.0, uv.y);
  float streak = .68 + .32 * sin(trail * 48.0 - time * 9.0 + uv.x * 8.0);
  float fade = pow(max(0.0, 1.0 - trail), 1.4);
  float bow = sin(clamp(-uv.y - 1.0, 0.0, 1.0) * 3.14159265);
  float breakup = .76 + .24 * sin(uv.y * 47.0 + time * 5.0 + uv.x * 9.0);
  float alpha = edge * strength * mix(fade * streak, bow * breakup, contact);
  gl_FragColor = vec4(gammaCorrectOutput(pow(vec3(.86, .98, 1.0), vec3(2.2))), alpha);
}
`;
export const WATERPARK_SPRAY_FRAGMENT_SHADER = `
#include "gammaPS"
varying vec2 uv;
uniform float strength;
void main() {
  float edge = sin(uv.x * 3.14159265);
  float taper = sin(uv.y * 3.14159265);
  gl_FragColor = vec4(gammaCorrectOutput(pow(vec3(.93, .99, 1.0), vec3(2.2))), edge * taper * strength);
}
`;

/** Two batched draws including the bow collar; topology is allocated once and
 * shared for every update. Runtime resources also release on parent teardown. */
export function createWaterparkWake(app: pc.Application, parent: pc.Entity, options: WaterparkGeometryOptions = {}) {
  const mesh = new pc.Mesh(app.graphicsDevice), sprayMesh = new pc.Mesh(app.graphicsDevice);
  const indices: number[] = [], uvs: number[] = [];
  function strip(offset: number, segments: number, contact: boolean) {
    for (let i = 0; i <= segments; i++) {
      const f = i / segments, v = contact ? -1 - f : f;
      uvs.push(0, v, 1, v);
      if (i < segments) { const n = offset + i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
  }
  for (let side = 0; side < 2; side++) strip(side * (WAKE_SEGMENTS + 1) * 2, WAKE_SEGMENTS, false);
  strip(2 * (WAKE_SEGMENTS + 1) * 2, CONTACT_SEGMENTS, true);
  mesh.setPositions(new Array(uvs.length / 2 * 3).fill(0)); mesh.setUvs(0, uvs); mesh.setIndices(indices); mesh.update(pc.PRIMITIVE_TRIANGLES);
  const sprayIndices: number[] = [], sprayUvs: number[] = [];
  for (let i = 0; i < SPRAY_DROPLETS; i++) {
    const n = i * 4; sprayIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); sprayUvs.push(0, 0, 1, 0, 0, 1, 1, 1);
  }
  sprayMesh.setPositions(new Array(SPRAY_DROPLETS * 12).fill(0)); sprayMesh.setUvs(0, sprayUvs); sprayMesh.setIndices(sprayIndices); sprayMesh.update(pc.PRIMITIVE_TRIANGLES);
  function material(name: string, fragmentGLSL: string) {
    const mat = new pc.ShaderMaterial({uniqueName: name, attributes: {aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0}, vertexGLSL: WATERPARK_EFFECT_VERTEX_SHADER, fragmentGLSL});
    mat.blendType = pc.BLEND_NORMAL; mat.depthWrite = false; mat.cull = pc.CULLFACE_NONE;
    mat.setParameter('strength', 0); mat.setParameter('time', 0); return mat;
  }
  const mat = material('waterpark-surface-following-wake', WATERPARK_WAKE_FRAGMENT_SHADER);
  const sprayMat = material('waterpark-ballistic-spray', WATERPARK_SPRAY_FRAGMENT_SHADER);
  const entity = new pc.Entity('Twin white water-mount wake');
  entity.addComponent('render', {meshInstances: [new pc.MeshInstance(mesh, mat), new pc.MeshInstance(sprayMesh, sprayMat)], castShadows: false, receiveShadows: false});
  parent.addChild(entity); entity.enabled = false;
  let disposed = false;
  function update(distance: number, lane: number, speed: number, time: number, lateralSpeed = 0) {
    if (disposed) return;
    const data = waterparkEffectGeometry(distance, lane, speed, time, lateralSpeed, options);
    mesh.setPositions([...data.positions, ...data.contact]); mesh.update(pc.PRIMITIVE_TRIANGLES);
    sprayMesh.setPositions(data.spray); sprayMesh.update(pc.PRIMITIVE_TRIANGLES);
    mat.setParameter('strength', data.strength); mat.setParameter('time', finiteWaterValue(time));
    sprayMat.setParameter('strength', data.sprayStrength); entity.enabled = data.enabled;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    app.off('destroy', dispose); parent.off('destroy', dispose);
    // Render-component removal drops the final mesh-instance references and
    // destroys these unshared meshes. Materials remain explicitly owned here.
    entity.destroy(); mat.destroy(); sprayMat.destroy();
  }
  app.once('destroy', dispose); parent.once('destroy', dispose);
  return {entity, update, dispose};
}
