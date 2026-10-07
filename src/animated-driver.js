import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export const CHASSIS_ASSET = 'assets/kart-r12-chassis.glb';
export const DRIVER_CLIPS = Object.freeze(['DriveIdle', 'SteerLeft', 'SteerRight', 'SteeringDemo', 'SteeringRange']);
export const MAX_WHEEL_ANGLE = Math.PI / 10;
export const WHEEL_CENTER = new THREE.Vector3(0, 1.105, .30);
export const WHEEL_AXIS = new THREE.Vector3(0, Math.cos(43 * Math.PI / 180), Math.sin(43 * Math.PI / 180));
const validated = new WeakSet();
const materialList = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
function identity(object) {
  return object.position.length() < 1e-6 && object.quaternion.angleTo(new THREE.Quaternion()) < 1e-6 && object.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-6;
}

export function validateDriverContract(driver) {
  if (!driver?.scene?.isObject3D || !Array.isArray(driver.animations)) throw new Error('GLB has no driver scene and animations');
  if (validated.has(driver.scene)) return true;
  if (!identity(driver.scene)) throw new Error('Driver root must have identity transform, +Y up and +Z forward');
  let skinnedMeshes = 0;
  const nodes = new Set(); driver.scene.traverse(node => {
    if (![...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()].every(Number.isFinite)) throw new Error('Driver node transform contains non-finite values');
    nodes.add(node);
  });
  driver.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    skinnedMeshes++;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    if (!position || !skinIndex || !skinWeight || skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4 || skinIndex.count !== position.count || skinWeight.count !== position.count || !mesh.skeleton?.bones.length) throw new Error('Driver is missing valid four-influence skin attributes');
    if (!mesh.skeleton.bones.every(bone => nodes.has(bone))) throw new Error('Driver skin refers to bones outside its scene');
    if (!mesh.skeleton.boneInverses.every(matrix => matrix.elements.every(Number.isFinite))) throw new Error('Driver bind matrices contain non-finite values');
    for (const value of position.array) if (!Number.isFinite(value)) throw new Error('Driver geometry contains non-finite positions');
    for (let i = 0; i < position.count; i++) {
      let total = 0;
      for (let k = 0; k < 4; k++) {
        const index = skinIndex.getComponent(i, k), weight = skinWeight.getComponent(i, k);
        if (!Number.isInteger(index) || index < 0 || index >= mesh.skeleton.bones.length || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Driver skin contains invalid bone indices or weights');
        total += weight;
      }
      if (Math.abs(total - 1) > .01) throw new Error('Driver skin weights must be normalized');
    }
  });
  if (!skinnedMeshes) throw new Error('Driver needs at least one rigged SkinnedMesh');
  for (const name of DRIVER_CLIPS) {
    const clip = THREE.AnimationClip.findByName(driver.animations, name);
    if (!clip?.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Driver is missing the ${name} animation`);
    for (const track of clip.tracks) {
      if (!track.times.length || !track.values.length || !Array.from(track.times).every(Number.isFinite) || !Array.from(track.values).every(Number.isFinite)) throw new Error(`Invalid animation data in ${name}`);
    }
  }
  const range = THREE.AnimationClip.findByName(driver.animations, 'SteeringRange');
  if (Math.abs(range.duration - 2) > 1e-6) throw new Error('SteeringRange must be exactly two seconds');
  const model = cloneSkeleton(driver.scene);
  const grips = ['L', 'R'].map(side => model.getObjectByName(`Grip${side}`) || model.getObjectByName(`Grip.${side}`));
  if (!grips.every(Boolean)) throw new Error('Driver needs authored GripL/GripR (or Grip.L/Grip.R) markers');
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(range).setLoop(THREE.LoopOnce, 1).play();
  action.paused = true; action.clampWhenFinished = true;
  const sample = time => { action.time = time; mixer.update(0); model.updateMatrixWorld(true); return grips.map(grip => grip.getWorldPosition(new THREE.Vector3())); };
  try {
    const neutral = sample(1).map(point => point.sub(WHEEL_CENTER));
    if (neutral.some(offset => offset.clone().addScaledVector(WHEEL_AXIS, -offset.dot(WHEEL_AXIS)).length() < .01)) throw new Error('Grip markers must be offset from the steering axis');
    for (const time of [0, .5, 1, 1.5, 2]) {
      const positions = sample(time);
      for (let i = 0; i < grips.length; i++) {
        const expected = neutral[i].clone().applyAxisAngle(WHEEL_AXIS, -(time - 1) * MAX_WHEEL_ANGLE).add(WHEEL_CENTER);
        if (!positions[i].toArray().every(Number.isFinite) || positions[i].distanceTo(expected) > .02) throw new Error('SteeringRange grip motion must follow the original wheel through ±18 degrees');
      }
    }
  } finally { mixer.stopAllAction(); mixer.uncacheRoot(model); model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.dispose(); }); }
  validated.add(driver.scene);
  return true;
}

export function createAnimatedRacer(driver, kart, { id = 'driver', color = '#d2ff53' } = {}) {
  validateDriverContract(driver);
  const root = new THREE.Group(), model = driver.scene, chassis = kart.scene;
  root.name = `Driver_${id}`; root.userData.driverId = id;
  const wheel = chassis.getObjectByName('SteeringPivot');
  if (!wheel) throw new Error('Chassis is missing SteeringPivot');
  model.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.isSkinnedMesh) mesh.frustumCulled = false; } });
  chassis.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
    const recolor = material => { const copy = material.clone(); if (/^(body|paint)$/i.test(copy.name)) copy.color.set(color); return copy; };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material);
  });
  root.add(chassis, model); root.updateMatrixWorld(true);
  const wheelBase = wheel.quaternion.clone(), wheelTurn = new THREE.Quaternion();
  const wheelAxis = WHEEL_AXIS.clone().applyQuaternion(wheel.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
  const mixer = new THREE.AnimationMixer(model);
  const range = THREE.AnimationClip.findByName(driver.animations, 'SteeringRange');
  const action = mixer.clipAction(range).setLoop(THREE.LoopOnce, 1).play();
  action.paused = true; action.clampWhenFinished = true;
  let steering = 0, disposed = false;
  function apply() { action.time = steering + 1; action.setEffectiveWeight(1); wheelTurn.setFromAxisAngle(wheelAxis, -steering * MAX_WHEEL_ANGLE); wheel.quaternion.copy(wheelBase).multiply(wheelTurn); }
  function update(dt, input = 0, paused = false) {
    if (paused || disposed) return;
    const delta = Math.max(0, Number.isFinite(dt) ? dt : 0), target = THREE.MathUtils.clamp(Number.isFinite(input) ? input : 0, -1, 1);
    steering = THREE.MathUtils.damp(steering, target, 12, delta); if (Math.abs(steering - target) < 1e-5) steering = target;
    apply(); mixer.update(delta);
  }
  function reset() { if (disposed) return; steering = 0; action.reset().play(); action.paused = true; apply(); mixer.update(0); }
  reset();
  return {
    root, model, chassis, mixer, wheel, update, reset,
    getState: () => ({ status: disposed ? 'disposed' : 'ready', id, steering, wheelAngle: -steering * MAX_WHEEL_ANGLE, rangeTime: action.time, animationTime: mixer.time, animationMode: 'sampled-range', weights: { DriveIdle: 0, SteerLeft: 0, SteerRight: 0, SteeringDemo: 0, SteeringRange: 1 } }),
    dispose() {
      if (disposed) return; disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(model);
      chassis.traverse(mesh => { if (mesh.isMesh) for (const material of materialList(mesh)) material.dispose(); });
      model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.dispose(); });
      root.removeFromParent();
    },
  };
}

export function createImportedRacer(driver, chassis, slot) {
  // Skeleton-aware clone preserves bindings while each race actor owns its bones,
  // mixer and paint. Immutable imported geometry/material/texture stay shared.
  validateDriverContract(driver);
  const scene = cloneSkeleton(driver.scene); validated.add(scene);
  return createAnimatedRacer({ scene, animations: driver.animations }, { scene: chassis.scene.clone(true) }, slot);
}

export function disposeDriverAsset(asset) {
  const disposed = new Set();
  for (const scene of new Set([asset?.scene, ...(asset?.scenes || [])].filter(Boolean))) scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh && !disposed.has(mesh.skeleton)) { mesh.skeleton.dispose(); disposed.add(mesh.skeleton); }
    for (const material of materialList(mesh)) {
      for (const value of Object.values(material)) if (value?.isTexture && !disposed.has(value)) { value.dispose(); if (value.image && !disposed.has(value.image)) { value.image.close?.(); disposed.add(value.image); } disposed.add(value); }
      if (!disposed.has(material)) { material.dispose(); disposed.add(material); }
    }
    if (!disposed.has(mesh.geometry)) { mesh.geometry.dispose(); disposed.add(mesh.geometry); }
  });
}
