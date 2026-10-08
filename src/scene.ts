import * as pc from 'playcanvas';
import { HALF, LENGTH, sample, scaled, degrees } from './track';
import { instantiateRenderEntity, type DriverAsset } from './assets';
import { createItemModel, type ItemDisplay } from './item-models';
import { resetPickup, type PickupState } from './item-pickups';

export const color = (hex: string) => new pc.Color().fromString(hex);
export function material(hex: string, options: { emissive?: string; opacity?: number; metalness?: number; roughness?: number; unlit?: boolean } = {}) {
  const m = new pc.StandardMaterial();
  m.diffuse = color(hex);
  m.useMetalness = true;
  m.metalness = options.metalness ?? 0;
  m.gloss = 1 - (options.roughness ?? .78);
  m.cull = pc.CULLFACE_NONE;
  m.twoSidedLighting = true;
  if (options.emissive) m.emissive = color(options.emissive);
  if (options.unlit) { m.useLighting = false; m.emissive = color(hex); m.diffuse.set(0, 0, 0); }
  if (options.opacity !== undefined) { m.opacity = options.opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
  m.update();
  return m;
}

/** A small native PlayCanvas mesh assembler. Static circuit details share draw calls. */
class MeshBuilder {
  positions: number[] = [];
  indices: number[] = [];
  add(geometry: pc.Geometry, position = new pc.Vec3(), scale = new pc.Vec3(1, 1, 1), yaw = 0) {
    const matrix = new pc.Mat4().setTRS(position, new pc.Quat().setFromEulerAngles(0, degrees(yaw), 0), scale);
    const offset = this.positions.length / 3;
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const p = matrix.transformPoint(new pc.Vec3(geometry.positions[i], geometry.positions[i + 1], geometry.positions[i + 2]));
      this.positions.push(p.x, p.y, p.z);
    }
    for (const i of geometry.indices) this.indices.push(offset + i);
  }
  quad(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3, d: pc.Vec3) {
    const offset = this.positions.length / 3;
    for (const p of [a, b, c, d]) this.positions.push(p.x, p.y, p.z);
    this.indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
  entity(app: pc.Application, name: string, mat: pc.Material, target: pc.Entity, cast = false) {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(this.positions);
    mesh.setNormals(pc.calculateNormals(this.positions, this.indices));
    mesh.setIndices(this.indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    return meshEntity(name, mesh, mat, target, cast);
  }
}
export function meshEntity(name: string, mesh: pc.Mesh, mat: pc.Material, target: pc.Entity, cast = false) {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, mat)], castShadows: cast, receiveShadows: true });
  target.addChild(entity);
  return entity;
}
export function eachMesh(root: pc.Entity, callback: (mesh: pc.MeshInstance) => void) {
  for (const render of root.findComponents('render') as pc.RenderComponent[]) for (const mesh of render.meshInstances) callback(mesh);
}
export function placeKart(entity: pc.Entity, distance: number, lateral: number, angle = 0) {
  const s = sample(distance, lateral);
  entity.setPosition(s.p.x, s.p.y + .11, s.p.z);
  // The models face +Z; PlayCanvas's camera faces -Z. Keep these separate.
  const yaw = new pc.Quat().setFromEulerAngles(0, degrees(Math.atan2(s.t.x, s.t.z) + angle), 0);
  yaw.mul(new pc.Quat().setFromEulerAngles(degrees(-Math.asin(s.t.y)), 0, 0));
  entity.setRotation(yaw);
  return s;
}
export interface ItemBox extends PickupState { d: number; lateral: number; mesh: pc.Entity; base: number; models: Record<ItemDisplay, pc.Entity> }
export interface Spark { p: pc.Vec3; v: pc.Vec3; t: number; max: number }

export function createCoastScene(app: pc.Application, options: { preview?: boolean } = {}) {
  const root = new pc.Entity('Sunset coast circuit');
  app.root.addChild(root);
  app.scene.ambientLight = color('#adbdd2');
  app.scene.exposure = 1.25;
  app.scene.fog.type = pc.FOG_LINEAR;
  app.scene.fog.color = color('#eabbb2');
  app.scene.fog.start = 210;
  app.scene.fog.end = 650;
  const camera = new pc.Entity('Chase camera');
  camera.addComponent('camera', { fov: 53, nearClip: .1, farClip: 1500, clearColor: color('#f9cdb5'), toneMapping: pc.TONEMAP_ACES, gammaCorrection: pc.GAMMA_SRGB });
  app.root.addChild(camera);
  camera.setPosition(30, 15, -150);
  camera.lookAt(0, 2, -140);
  const sun = new pc.Entity('Warm sunset key light');
  sun.addComponent('light', { type: 'directional', color: color('#ffe1b6'), intensity: 2.7, castShadows: true, shadowDistance: 130, shadowResolution: 2048, shadowBias: .15, normalOffsetBias: .08, numCascades: 2 });
  sun.setEulerAngles(53, -39, 0);
  app.root.addChild(sun);

  // Let PlayCanvas inject the same device precision into both shader stages.
  // A fragment-only default can make shared uniforms fail WebGL2 linking.
  const skyMaterial = new pc.ShaderMaterial({
    uniqueName: 'coast-gradient-sky', attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexGLSL: 'attribute vec3 aPosition; uniform mat4 matrix_model; uniform mat4 matrix_viewProjection; varying vec3 vPos; void main(){vPos=aPosition; gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.);}',
    fragmentGLSL: ' varying vec3 vPos; void main(){float t=smoothstep(-.03,.7,normalize(vPos).y);gl_FragColor=vec4(mix(vec3(.976,.804,.71),vec3(.38,.463,.71),t),1.);}',
  });
  skyMaterial.cull = pc.CULLFACE_FRONT;
  skyMaterial.depthWrite = false;
  const skyMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: 1100, latitudeBands: 20, longitudeBands: 32 }));
  meshEntity('Gradient sky', skyMesh, skyMaterial, root);
  const sunBall = meshEntity('Sun disc', pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: 38, latitudeBands: 20, longitudeBands: 32 })), material('#ffdda2', { unlit: true }), root);
  sunBall.setPosition(-360, 115, -650);
  const oceanMaterial = new pc.ShaderMaterial({
    uniqueName: 'coast-water', attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexGLSL: `attribute vec3 aPosition;uniform mat4 matrix_model;uniform mat4 matrix_viewProjection;uniform mat4 matrix_view;uniform float time;varying vec3 wp;varying float depth;void main(){vec3 p=aPosition;p.y+=sin(p.x*.038+time*.4)*.18+cos(p.z*.045+time*.3)*.13;vec4 w=matrix_model*vec4(p,1.);wp=w.xyz;depth=-(matrix_view*w).z;gl_Position=matrix_viewProjection*w;}`,
    fragmentGLSL: `varying vec3 wp;varying float depth;uniform float time;void main(){float a=sin(wp.x*.22+wp.z*.34+time*.9);float b=sin(wp.x*.13-wp.z*.17+time*.5);float glint=pow(max(0.,a*b),14.);vec3 col=mix(vec3(.08,.41,.5),vec3(.12,.61,.63),.5+.2*a);col+=vec3(.4,.5,.43)*glint*.45;col=mix(col,vec3(.918,.733,.698),smoothstep(140.,650.,depth));gl_FragColor=vec4(col,1.);}`,
  });
  oceanMaterial.cull = pc.CULLFACE_NONE;
  oceanMaterial.setParameter('time', 0);
  const ocean = meshEntity('Animated ocean', pc.Mesh.fromGeometry(app.graphicsDevice, new pc.PlaneGeometry({ halfExtents: new pc.Vec2(1050, 1050), widthSegments: 130, lengthSegments: 130 })), oceanMaterial, root);
  ocean.setPosition(0, -1.8, 0);
  const sand = material('#edcca0'), grass = material('#bbd395');
  function land(x: number, z: number, radius: number, sx: number, sz: number) {
    for (const [r, y, h, m] of [[radius, -2, 4, sand], [radius * .94, -.4, 2, grass]] as const) {
      const entity = meshEntity('Island', pc.Mesh.fromGeometry(app.graphicsDevice, new pc.CylinderGeometry({ radius: r, height: h, capSegments: 64 })), m, root);
      entity.setPosition(x, y, z); entity.setLocalScale(sx, 1, sz);
    }
  }
  land(-12, 5, 135, 1.05, 1.03); land(70, -50, 85, 1.02, .85); land(-90, 68, 65, 1, 1.1);
  const mountains = new MeshBuilder();
  for (let i = 0; i < 17; i++) {
    const a = i / 17 * Math.PI * 2, r = 420 + Math.sin(i * 3) * 70;
    mountains.add(new pc.ConeGeometry({ baseRadius: 32 + i % 3 * 15, peakRadius: 0, height: 55 + i % 5 * 15, capSegments: 5 }), new pc.Vec3(Math.cos(a) * r, 8, Math.sin(a) * r), new pc.Vec3(1, 1, 1.4), i);
  }
  mountains.entity(app, 'Distant mountains', material('#a2adc0'), root);

  function ribbon(inner: number, outer: number, height: number, mat: pc.Material) {
    const builder = new MeshBuilder();
    for (let i = 0; i < 720; i++) {
      const points: pc.Vec3[] = [];
      for (const [d, lateral] of [[i, inner], [i, outer], [i + 1, inner], [i + 1, outer]]) { const p = sample(d / 720 * LENGTH, lateral).p; p.y += height; points.push(p); }
      builder.quad(points[0], points[1], points[2], points[3]);
    }
    return builder.entity(app, 'Circuit ribbon', mat, root);
  }
  ribbon(-HALF, HALF, 0, material('#455461', { roughness: .94 }));
  const curbs = [new MeshBuilder(), new MeshBuilder()];
  for (let i = 0; i < 720; i++) for (const side of [-1, 1]) {
    const vertices = [[i, HALF], [i, HALF + .75], [i + 1, HALF], [i + 1, HALF + .75]].map(([d, lateral]) => { const p = sample(d / 720 * LENGTH, side * lateral).p; p.y += .045; return p; });
    curbs[Math.floor(i / 3) % 2].quad(vertices[0], vertices[1], vertices[2], vertices[3]);
  }
  curbs[0].entity(app, 'Coral kerbs', material('#e9776a'), root);
  curbs[1].entity(app, 'Cream kerbs', material('#f8ead6'), root);
  for (const side of [-1, 1]) {
    ribbon(side * (HALF + .75), side * (HALF + .95), -.1, material('#597485'));
    const tube = new MeshBuilder();
    const count = 500, sides = 5;
    for (let i = 0; i <= count; i++) {
      const s = sample(i / count * LENGTH, side * (HALF + .95));
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const p = scaled(s.p.clone(), s.n, Math.cos(angle) * .075); p.y += .74 + Math.sin(angle) * .075;
        tube.positions.push(p.x, p.y, p.z);
        if (i < count) { const a = i * sides + j, b = i * sides + (j + 1) % sides; tube.indices.push(a, b, a + sides, b, b + sides, a + sides); }
      }
    }
    tube.entity(app, 'Coastal guardrail', material(side < 0 ? '#d1eced' : '#f9ebd8', { metalness: .3 }), root);
  }
  const dashes = new MeshBuilder(), posts = new MeshBuilder(), supports = new MeshBuilder(), grid = new MeshBuilder();
  for (let i = 0; i < 240; i++) {
    const s = sample(i / 240 * LENGTH), yaw = Math.atan2(s.t.x, s.t.z);
    if (i % 2 === 0) {
      for (const lateral of [-2.4, 2.4]) { const p = scaled(s.p.clone(), s.n, lateral); p.y += .012; dashes.add(new pc.PlaneGeometry({ halfExtents: new pc.Vec2(.055, 1.05) }), p, new pc.Vec3(1, 1, 1), yaw); }
      for (const side of [-1, 1]) { const p = scaled(s.p.clone(), s.n, side * (HALF + .95)); p.y += .34; posts.add(new pc.CylinderGeometry({ radius: .09, height: .78, capSegments: 5 }), p); }
    }
    if (i % 7 === 0) supports.add(new pc.CylinderGeometry({ radius: 1.3, height: s.p.y + 2, capSegments: 8 }), new pc.Vec3(s.p.x, (s.p.y - 2) / 2 - .1, s.p.z));
  }
  for (let row = 0; row < 2; row++) for (let col = 0; col < 16; col++) if ((row + col) % 2 === 0) {
    const s = sample(row * .75, col * .9 - HALF + .45); s.p.y += .02;
    grid.add(new pc.PlaneGeometry({ halfExtents: new pc.Vec2(.45, .375) }), s.p, new pc.Vec3(1, 1, 1), Math.atan2(s.t.x, s.t.z));
  }
  dashes.entity(app, 'Lane markings', material('#e7e4ca'), root);
  posts.entity(app, 'Guardrail supports', material('#b5d3d9'), root, true);
  supports.entity(app, 'Elevated road piers', material('#93acaa'), root, true);
  grid.entity(app, 'Checkered starting line', material('#fffcde'), root);

  // The title screen shares the circuit, but never allocates gameplay pickups,
  // item-model caches, shields or particle pools. Render components own meshes;
  // these procedural materials need an explicit scene-lifetime owner.
  if (options.preview) {
    const materials = new Set<pc.Material>();
    eachMesh(root, instance => materials.add(instance.material));
    root.once('destroy', () => { for (const mat of materials) mat.destroy(); });
    const shield = new pc.Entity('Unused preview shield'); shield.enabled = false; root.addChild(shield);
    return { root, camera, sun, oceanMaterial, boxes: [] as ItemBox[], shield,
      flames: [] as { mesh: pc.Entity; side: number }[], particles: [] as pc.Entity[], buildProps };
  }

  const itemMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry({ halfExtents: new pc.Vec3(.625, .625, .625) }));
  const itemMat = material('#b9e7f8', { opacity: .16, metalness: .05, roughness: .2 });
  // Only the front shell overlays the opaque contents. No transparent depth writes,
  // double-sided blending or custom shaders that can hide the enclosed model.
  itemMat.cull = pc.CULLFACE_BACK; itemMat.twoSidedLighting = false; itemMat.update();
  const edges = new MeshBuilder();
  const edgeMaterial = material('#fff6ba', { unlit: true });
  // Twelve thin native boxes draw a crisp luminous outline, batched into one mesh.
  for (let axis = 0; axis < 3; axis++) for (const a of [-.64, .64]) for (const b of [-.64, .64]) {
    const dimensions = [.026, .026, .026]; dimensions[axis] = 1.31;
    const location = axis === 0 ? [0, a, b] : axis === 1 ? [a, 0, b] : [a, b, 0];
    edges.add(new pc.BoxGeometry({ halfExtents: new pc.Vec3(dimensions[0] / 2, dimensions[1] / 2, dimensions[2] / 2) }), new pc.Vec3(...location));
  }
  const edgeMesh = new pc.Mesh(app.graphicsDevice); edgeMesh.setPositions(edges.positions); edgeMesh.setNormals(pc.calculateNormals(edges.positions, edges.indices)); edgeMesh.setIndices(edges.indices); edgeMesh.update();
  const boxes: ItemBox[] = [];
  for (let j = 0; j < 15; j++) for (const lateral of [-4.2, 0, 4.2]) {
    const d = 45 + j * LENGTH / 15, p = sample(d, lateral).p; p.y += 1.25;
    const entity = new pc.Entity('Energy item box'); root.addChild(entity); entity.setPosition(p);
    meshEntity('Translucent pickup glass', itemMesh, itemMat, entity);
    meshEntity('Luminous edges', edgeMesh, edgeMaterial, entity);
    const models = Object.fromEntries((['boost', 'shield', 'pulse', 'mystery'] as ItemDisplay[]).map(kind => {
      const model = createItemModel(app, kind); entity.addChild(model); return [kind, model];
    })) as Record<ItemDisplay, pc.Entity>;
    const box: ItemBox = { d, lateral, mesh: entity, cool: 0, base: p.y, display: 'mystery', models };
    resetPickup(box); boxes.push(box);
  }
  const shield = meshEntity('Energy shield', pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: 2.4, latitudeBands: 16, longitudeBands: 24 })), material('#84e8fa', { opacity: .18, roughness: .1, metalness: .2, emissive: '#123f45' }), root);
  shield.enabled = false;
  const flameMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.ConeGeometry({ baseRadius: .22, peakRadius: 0, height: 1.5, capSegments: 7 }));
  const flameMat = material('#a6f9ff', { unlit: true, opacity: .8 });
  const flames = [-1, 1].map(side => { const mesh = meshEntity('Turbo flame', flameMesh, flameMat, root); mesh.enabled = false; return { mesh, side }; });
  const sparkMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: .065, latitudeBands: 3, longitudeBands: 4 }));
  const sparkMat = material('#ffc36c', { unlit: true });
  const particles = Array.from({ length: 160 }, () => { const entity = meshEntity('Drift spark', sparkMesh, sparkMat, root); entity.enabled = false; return entity; });

  function textMaterial(text: string, background: string, foreground: string) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = foreground; ctx.font = '900 56px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 65);
    const texture = new pc.Texture(app.graphicsDevice, { width: 512, height: 128, mipmaps: true }); texture.setSource(canvas);
    const mat = new pc.StandardMaterial(); mat.diffuse.set(0, 0, 0); mat.emissive.set(1, 1, 1); mat.emissiveMap = texture; mat.useLighting = false; mat.cull = pc.CULLFACE_NONE; mat.update(); return mat;
  }
  function sign(target: pc.Entity, distance: number, lateral: number, height: number, width: number, h: number, mat: pc.Material) {
    const e = meshEntity('Circuit sign', pc.Mesh.fromGeometry(app.graphicsDevice, new pc.PlaneGeometry({ halfExtents: new pc.Vec2(width / 2, h / 2) })), mat, target);
    const s = sample(distance, lateral); e.setPosition(s.p.x, s.p.y + height, s.p.z);
    e.setEulerAngles(90, degrees(Math.atan2(s.t.x, s.t.z)) + 180, 0); return e;
  }
  function buildProps(assets: Map<string, DriverAsset>) {
    const props = new pc.Entity('Original course props');
    let batchId: number | null = null;
    const prop = (id: string) => { const mount = new pc.Entity(id + ' placement'); mount.addChild(instantiateRenderEntity(assets.get(id)!)); props.addChild(mount); return mount; };
    try {
    for (let i = 0; i < 94; i++) {
      const p = sample(i / 94 * LENGTH, (i % 2 ? 1 : -1) * (HALF + 6 + i % 4 * 3)).p; p.y = .4;
      const entity = prop('palm'); entity.setPosition(p); entity.setEulerAngles(0, degrees(i * 2.4), 0); const scale = .82 + i % 4 * .09; entity.setLocalScale(scale, scale, scale);
    }
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, entity = prop('rock'); entity.setPosition(Math.cos(a) * (100 + i % 3 * 10) - 12, .35, Math.sin(a) * (90 + i % 4 * 7)); entity.setEulerAngles(0, degrees(i), 0); const scale = .6 + i % 3 * .23; entity.setLocalScale(scale, scale, scale);
    }
    const arch = prop('arch'); const s = sample(1); arch.setPosition(s.p); arch.setEulerAngles(0, degrees(Math.atan2(s.t.x, s.t.z)), 0);
    eachMesh(props, mesh => { mesh.castShadow = true; mesh.receiveShadow = true; });
    // Native static batching merges GLB prop pieces by material on desktop/mobile.
    const batch = app.batcher.addGroup('Coastal props', false, 80); batchId = batch.id;
    for (const render of props.findComponents('render') as pc.RenderComponent[]) render.batchGroupId = batch.id;
    sign(props, 1, 0, 7.1, 13, 2.1, textMaterial('NEON KART', '#183b45', '#edffd0'));
    const arrow = textMaterial('› › ›', '#ed806d', '#fff8de');
    for (const distance of [145, 320, 550, 740]) sign(props, distance, -HALF - 2.5, 2, 6.2, 1.6, arrow);
    root.addChild(props);
    app.batcher.generate([batch.id]);
    return props;
    } catch (error) {
      props.destroy(); if (batchId !== null) app.batcher.removeGroup(batchId); throw error;
    }
  }
  return { root, camera, sun, oceanMaterial, boxes, shield, flames, particles, buildProps };
}
