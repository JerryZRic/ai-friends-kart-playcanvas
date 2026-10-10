import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseLocalGLB, disposeDriverAsset, RUNTIME_MODELS, WHEEL_AXIS, validateDriverContract, type DriverAsset } from '../src/assets';
import { createModularRacer, validateModularDriverContract } from '../src/kart-driver';
import type { KartAssembly } from '../src/kart-assembly';
import {foodKartManifest as manifest, foodKartFixtureBytes as canonicalPart} from './helpers/food-kart-fixture';

/** Real public payloads and the real PlayCanvas skin/animation pipeline. Only
 * texture pixel decoding is stubbed. This is CPU evidence, not browser GPU QA. */
function headlessApp() {
  const canvas = {id: 'modular-driver-test', width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1, height: 1};}} as any;
  const device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = device; options.componentSystems = [pc.RenderComponentSystem, pc.AnimComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler]; options.devtools = false; app.init(options);
  app.assets.on('add', (asset: pc.Asset) => {if (asset.type === 'container') (asset.options as any).image = {processAsync(_image: unknown, done: Function) {
    const texture = new pc.Asset('null-test-texture', 'texture'); texture.resource = new pc.Texture(device, {width: 1, height: 1}); texture.loaded = true; app.assets.add(texture); done(null, texture);
  }};});
  return app;
}
const arrayBuffer = (bytes: Buffer) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const meshes = (root: pc.Entity) => (root.findComponents('render') as pc.RenderComponent[]).flatMap(render => render.meshInstances);
function assemblyFor(app: pc.AppBase, asset: DriverAsset) {
  const root = new pc.Entity('Test six-slot assembly', app), chassis = asset.resource.instantiateRenderEntity(); root.addChild(chassis);
  let disposals = 0;
  const assembly = {root, parts: {chassis}, bounds: new pc.BoundingBox(), build: {}, dispose() {disposals++; root.destroy();}} as KartAssembly;
  return {assembly, disposals: () => disposals};
}
function meshBytes(mesh: pc.Mesh) {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [], uvs: number[] = [];
  mesh.getPositions(positions); mesh.getIndices(indices); mesh.getNormals(normals); mesh.getUvs(0, uvs);
  return createHash('sha256').update(JSON.stringify([positions, indices, normals, uvs])).digest('hex');
}

function handSurfaceDistances(model: pc.Entity) {
  const distances = [Infinity, Infinity], grips = ['L', 'R'].map(side => model.findByName(`Grip.${side}`)!.getPosition().clone());
  for (const mesh of meshes(model)) {
    const skin = mesh.skinInstance; if (!skin) continue;
    // This is the exact root argument used by PlayCanvas Renderer, not the
    // skeleton lookup root (which differs for some imported character rigs).
    skin.updateMatrixPalette(mesh.node, 999999);
    const positions: number[] = [], joints: number[] = [], weights: number[] = [];
    mesh.mesh.getPositions(positions); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, joints); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights);
    const handBones = ['L', 'R'].map(side => new Set(skin.bones.map((bone, index) => ({bone, index})).filter(({bone}) => /^(Hand|Thumb|Index|Middle|Ring|Little|Fingers)/.test(bone.name) && bone.name.endsWith(`.${side}`)).map(({index}) => index)));
    const point = new pc.Vec3(), result = new pc.Vec3(), transformed = new pc.Vec3();
    for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let side = 0; side < 2; side++) {
      let handWeight = 0; for (let k = 0; k < 4; k++) if (handBones[side].has(joints[vertex * 4 + k])) handWeight += weights[vertex * 4 + k];
      if (handWeight < .7) continue;
      point.set(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]); result.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {skin.matrices[joints[vertex * 4 + k]].transformPoint(point, transformed); result.add(transformed.mulScalar(weights[vertex * 4 + k]));}
      mesh.node.getWorldTransform().transformPoint(result, result); distances[side] = Math.min(distances[side], result.distance(grips[side]));
    }
  }
  return distances;
}

test('all 55 food chassis fit all six unchanged drivers through five steering poses', async () => {
  const app = headlessApp();
  const chassisRecords = manifest.parts.filter((part: any) => part.slot === 'chassis');
  assert.equal(chassisRecords.length, 55); assert.ok(chassisRecords.every((part: any) => part.available));
  const drivers = new Map<string, DriverAsset>(); let poses = 0, maxGripError = 0, minSeat = Infinity, maxSeat = 0, maxRuntimeMeshBytes = 0, maxRuntimeMeshes = 0;
  try {
    for (const record of RUNTIME_MODELS) drivers.set(record.id, await parseLocalGLB(app, arrayBuffer(gunzipSync(readFileSync(`public/${record.path}`)))));
    for (const record of chassisRecords) {
      const asset = await parseLocalGLB(app, canonicalPart(record));
      try {
        const source = asset.resource.instantiateRenderEntity(), sourceMeshes = meshes(source).map(mi => ({mesh: mi.mesh, hash: meshBytes(mi.mesh)})); source.destroy();
        for (const [id, driver] of drivers) {
          const fixture = assemblyFor(app, asset), racer = createModularRacer(app, driver, fixture.assembly, {id});
          const fit = racer.getState().fit, grips = ['L', 'R'].map(side => racer.model.findByName(`Grip.${side}`)!);
          if (record.kitNumber === '000') {
            const driverMeshes = new Set(meshes(racer.model));
            const colored = meshes(racer.root).filter(mi => !driverMeshes.has(mi) && (mi.material as pc.StandardMaterial).diffuseVertexColor);
            assert.ok(colored.length >= 4, 'rice static, steering and column materials use vertex color');
            for (const mi of colored) {
              const values: number[] = []; mi.mesh.getColors(values);
              const format = mi.mesh.vertexBuffer.format.elements.find(element => element.name === pc.SEMANTIC_COLOR);
              assert.ok(format, `split rice mesh retains COLOR: ${mi.node.name}`);
              assert.equal(values.length, mi.mesh.vertexBuffer.numVertices * format.numComponents);
              assert.ok(values.every(Number.isFinite)); assert.ok(new Set(values).size > 2, 'authored rice colors remain present');
            }
          }

          const center = new pc.Vec3(...fit.wheelCenter), neutral = grips.map(grip => grip.getPosition().clone().sub(center));
          const upperLengths = ['L', 'R'].map(side => racer.model.findByName(`UpperArm.${side}`)!.getPosition().distance(racer.model.findByName(`Forearm.${side}`)!.getPosition()));
          const lowerLengths = ['L', 'R'].map(side => racer.model.findByName(`Forearm.${side}`)!.getPosition().distance(racer.model.findByName(`Hand.${side}`)!.getPosition()));
          assert.equal(fit.staticTriangles + fit.movingTriangles, record.triangles, `${record.id} conserves every original triangle`);
          assert.ok(fit.wheelPieces >= 2 && fit.columnPieces >= 1); assert.ok(fit.rimRadius >= .10 && fit.rimRadius <= .25);
          maxRuntimeMeshBytes = Math.max(maxRuntimeMeshBytes, fit.runtimeMeshBytes); maxRuntimeMeshes = Math.max(maxRuntimeMeshes, fit.runtimeMeshCount);
          minSeat = Math.min(minSeat, fit.seatHeight); maxSeat = Math.max(maxSeat, fit.seatHeight);
          assert.ok(Math.abs(racer.model.findByName('Pelvis')!.getPosition().y - fit.seatHeight - fit.hipClearance) < 1e-5);
          for (const steering of [-1, -.5, 0, .5, 1]) {
            racer.update(10, steering); const state = racer.getState(); assert.equal(state.steering, steering);
            const rotation = new pc.Quat().setFromAxisAngle(WHEEL_AXIS, -steering * 18);
            for (let side = 0; side < grips.length; side++) {
              const expected = rotation.transformVector(neutral[side]).add(center), error = grips[side].getPosition().distance(expected);
              maxGripError = Math.max(maxGripError, error); assert.ok(error < .002, `${record.id}/${id} grip remains on actual food rim through steering`);
              assert.ok(Math.abs(grips[side].getPosition().clone().sub(center).dot(WHEEL_AXIS) - neutral[side].dot(WHEEL_AXIS)) < .002);
              const suffix = ['L', 'R'][side];
              assert.ok(Math.abs(racer.model.findByName(`UpperArm.${suffix}`)!.getPosition().distance(racer.model.findByName(`Forearm.${suffix}`)!.getPosition()) - upperLengths[side]) < 1e-5, 'upper arm never stretched');
              assert.ok(Math.abs(racer.model.findByName(`Forearm.${suffix}`)!.getPosition().distance(racer.model.findByName(`Hand.${suffix}`)!.getPosition()) - lowerLengths[side]) < 1e-5, 'forearm never stretched');
            }
            const physicalAxis = racer.wheel.getRotation().transformVector(new pc.Vec3(0, 0, 1));
            assert.ok(physicalAxis.distance(WHEEL_AXIS) < 1e-6); poses++;
          }
          for (const mesh of meshes(racer.model)) if (mesh.skinInstance) {const skin = mesh.skinInstance; skin.updateMatrixPalette(mesh.node, poses + 1); assert.ok([...skin.matrixPalette].every(Number.isFinite), 'retargeted skin palette remains finite');}
          if (record.kitNumber === '054' || record.kitNumber === '000') {const contact = handSurfaceDistances(racer.model); assert.ok(contact.every(distance => distance < .035), `${id} actual deformed hand surfaces reach the physical food grips: ${contact}`); console.log(JSON.stringify({id, handSurfaceDistanceMillimeters: contact.map(value => value * 1000)}));}
          racer.root.setPosition(3, 1.5, -7); racer.root.setEulerAngles(0, 47, 0); racer.update(10, -.5);
          assert.ok(racer.getState().fit.maxGripError < .002, 'world-transformed race actor remains fitted');
          racer.root.setLocalScale(.8, .8, .8); racer.update(10, .5); assert.ok(racer.getState().fit.maxGripError < .002, 'uniformly scaled race actor remains fitted');
          const paused = grips[0].getPosition().clone(); racer.update(10, 1, true); assert.ok(grips[0].getPosition().distance(paused) < 1e-8);
          racer.reset(); assert.equal(racer.getState().steering, 0); racer.dispose(); racer.dispose(); assert.equal(fixture.disposals(), 1);
          assert.equal(racer.getState().status, 'disposed');
        }
        for (const source of sourceMeshes) assert.equal(meshBytes(source.mesh), source.hash, 'all borrowed source vertex/index/normal/UV data stay unchanged');
      } finally {disposeDriverAsset(asset);}
    }
    assert.equal(poses, 55 * 6 * 5);
    console.log(JSON.stringify({chassis: 55, drivers: 6, measuredSteeringPoses: poses, maxGripErrorMillimeters: maxGripError * 1000, seatSurfaceRangeMeters: [minSeat, maxSeat], maxRuntimeMeshBytes, maxRuntimeMeshes, evidence: 'PlayCanvas NullGraphicsDevice CPU pipeline'}));
  } finally {for (const driver of drivers.values()) disposeDriverAsset(driver); app.destroy();}
});

test('modular actors retain independent skins, borrowed food materials, and safe disposal', async () => {
  const app = headlessApp();
  const chassis = await parseLocalGLB(app, canonicalPart(manifest.parts.find((part: any) => part.kitNumber === '054' && part.slot === 'chassis')));
  const driver = await parseLocalGLB(app, arrayBuffer(gunzipSync(readFileSync('public/assets/drivers/whale-driver.glb.gz'))));
  const tires = await parseLocalGLB(app, canonicalPart(manifest.parts.find((part: any) => part.kitNumber === '054' && part.slot === 'wheels')));
  try {
    const aFixture = assemblyFor(app, chassis), bFixture = assemblyFor(app, chassis);
    for (const fixture of [aFixture, bFixture]) {fixture.assembly.parts.wheels = tires.resource.instantiateRenderEntity(); fixture.assembly.root.addChild(fixture.assembly.parts.wheels);}
    const a = createModularRacer(app, driver, aFixture.assembly, {id: 'a', color: '#ff0000'}), b = createModularRacer(app, driver, bFixture.assembly, {id: 'b', color: '#00ff00'});
    const aSkin = meshes(a.model).find(mesh => mesh.skinInstance)!.skinInstance, bSkin = meshes(b.model).find(mesh => mesh.skinInstance)!.skinInstance;
    assert.notEqual(aSkin, bSkin); assert.notEqual(aSkin.bones[0], bSkin.bones[0]);
    const aGrip = a.model.findByName('Grip.L')!, bGrip = b.model.findByName('Grip.L')!, neutral = bGrip.getPosition().clone();
    const front = aFixture.assembly.parts.wheels.findByName('Wheel_LF_pivot')!, rear = aFixture.assembly.parts.wheels.findByName('Wheel_LR_pivot')!;
    a.update(1, 1, false, .435); assert.ok(Math.abs(a.getState().wheelSpin - 1) < 1e-6);
    const frontAxle = front.getLocalRotation().transformVector(pc.Vec3.RIGHT), rearAxle = rear.getLocalRotation().transformVector(pc.Vec3.RIGHT);
    assert.ok(frontAxle.distance(new pc.Quat().setFromAxisAngle(pc.Vec3.UP, -18).transformVector(pc.Vec3.RIGHT)) < 1e-5); assert.ok(rearAxle.distance(pc.Vec3.RIGHT) < 1e-6);
    a.update(10, 1); assert.ok(aGrip.getPosition().distance(neutral) > .02); assert.ok(bGrip.getPosition().distance(neutral) < 1e-7);
    const aFood = meshes(a.wheel), bFood = meshes(b.wheel); assert.equal(aFood.length, bFood.length);
    aFood.forEach((mesh, i) => {assert.equal(mesh.material, bFood[i].material, 'original food materials never recolored'); assert.notEqual(mesh.mesh, bFood[i].mesh, 'runtime steering buffers have instance ownership');});
    aSkin.updateMatrixPalette(aSkin.rootBone, 2); assert.ok([...aSkin.matrixPalette].every(Number.isFinite));
    const ownedWheelMeshes = aFood.map(instance => instance.mesh);
    a.dispose(); ownedWheelMeshes.forEach(mesh => {assert.equal(mesh.vertexBuffer, null, 'instance GPU vertex buffers released'); assert.ok(mesh.indexBuffer[0] == null, 'instance GPU index buffers released');}); b.update(10, -1); assert.ok(bGrip.getPosition().distance(neutral) > .02); assert.ok(b.getState().fit.maxGripError < .002); b.dispose();
  } finally {disposeDriverAsset(driver); disposeDriverAsset(chassis); disposeDriverAsset(tires); app.destroy();}
});


test('local imports reject unsupported cockpit bones before touching a live assembly', async () => {
  const app = headlessApp(), source = await parseLocalGLB(app, arrayBuffer(gunzipSync(readFileSync('public/assets/drivers/whale-driver.glb.gz'))));
  let destroyed = 0;
  const animations = ['Idle', 'Steer_Left', 'Steer_Right'].map((name, i) => {
    const track = source.animations.map(asset => asset.resource as pc.AnimTrack).find(track => track.name === ['DriveIdle', 'SteerLeft', 'SteerRight'][i])!;
    const asset = new pc.Asset(name, 'animation'); asset.resource = new pc.AnimTrack(name, track.duration, track.inputs, track.outputs, track.curves); return asset;
  });
  const resource = Object.create(source.resource); resource.instantiateRenderEntity = () => {
    const model = source.resource.instantiateRenderEntity(); model.findByName('Pelvis')!.name = 'CustomHip';
    const destroy = model.destroy.bind(model); model.destroy = () => {destroyed++; destroy();}; return model;
  };
  const unsupported = {...source, resource, animations};
  try {
    assert.equal(validateDriverContract(unsupported), true, 'old generic skinned-animation contract is valid');
    assert.throws(() => validateModularDriverContract(unsupported), /needs a Pelvis bone/);
    assert.equal(destroyed, 2, 'both validation instances cleaned up');
    assert.equal(validateModularDriverContract(source), true, 'original character asset remains usable');
  } finally {disposeDriverAsset(source); app.destroy();}
});
