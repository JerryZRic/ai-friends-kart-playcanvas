import * as pc from 'playcanvas';
import { createItemModel, type ItemDisplay } from './item-models';

export interface PickupVisual {
  mesh: pc.Entity;
  models: Record<ItemDisplay, pc.Entity>;
}

type Resources = {
  shell: pc.Mesh;
  frame: pc.Mesh;
  glass: pc.StandardMaterial;
  glow: pc.StandardMaterial;
};
const sceneResources = new WeakMap<pc.Entity, Resources>();
const displays: readonly ItemDisplay[] = ['boost', 'shield', 'pulse', 'mystery'];

/** Keep one glass/frame allocation per scene, including when all its pooled
 * boxes are temporarily disabled or removed. The scene owns their lifetime;
 * item-model meshes/materials retain their existing application-level cache. */
function resourcesFor(app: pc.AppBase, parent: pc.Entity): Resources {
  const cached = sceneResources.get(parent);
  if (cached) return cached;

  const shell = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry({ halfExtents: new pc.Vec3(.625, .625, .625) }));
  const glass = new pc.StandardMaterial();
  glass.name = 'Shared translucent pickup glass';
  glass.diffuse = new pc.Color().fromString('#b9e7f8');
  glass.useMetalness = true; glass.metalness = .05; glass.gloss = .8;
  // Only the front shell overlays the opaque contents. Back-face culling
  // avoids double blending; depth writes must not hide the enclosed model.
  glass.opacity = .16; glass.blendType = pc.BLEND_NORMAL;
  glass.depthWrite = false; glass.depthTest = true;
  glass.cull = pc.CULLFACE_BACK; glass.twoSidedLighting = false; glass.update();

  // Twelve thin native boxes form the original coast outline in one draw call.
  const positions: number[] = [], indices: number[] = [];
  for (let axis = 0; axis < 3; axis++) for (const a of [-.64, .64]) for (const b of [-.64, .64]) {
    const dimensions = [.026, .026, .026]; dimensions[axis] = 1.31;
    const location = axis === 0 ? [0, a, b] : axis === 1 ? [a, 0, b] : [a, b, 0];
    const geometry = new pc.BoxGeometry({ halfExtents: new pc.Vec3(dimensions[0] / 2, dimensions[1] / 2, dimensions[2] / 2) });
    const offset = positions.length / 3;
    for (let i = 0; i < geometry.positions.length; i++) positions.push(geometry.positions[i] + location[i % 3]);
    for (const index of geometry.indices) indices.push(offset + index);
  }
  const frame = new pc.Mesh(app.graphicsDevice);
  frame.setPositions(positions); frame.setNormals(pc.calculateNormals(positions, indices));
  frame.setIndices(indices); frame.update(pc.PRIMITIVE_TRIANGLES);
  const glow = new pc.StandardMaterial();
  glow.name = 'Shared luminous pickup edges';
  glow.diffuse.set(0, 0, 0); glow.emissive = new pc.Color().fromString('#fff6ba');
  glow.useLighting = false; glow.useMetalness = true; glow.metalness = 0; glow.gloss = .22;
  glow.cull = pc.CULLFACE_NONE; glow.twoSidedLighting = true;
  glow.blendType = pc.BLEND_NONE; glow.depthWrite = true; glow.update();

  // Render components release their references before the parent's destroy
  // event. Retaining one cache reference also makes zero-instance reuse safe.
  shell.incRefCount(); frame.incRefCount();
  const resources = { shell, frame, glass, glow };
  sceneResources.set(parent, resources);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    parent.off('destroy', dispose); app.off('destroy', dispose);
    for (const mesh of [shell, frame]) { mesh.decRefCount(); mesh.destroy(); }
    glass.destroy(); glow.destroy(); sceneResources.delete(parent);
  };
  parent.once('destroy', dispose); app.once('destroy', dispose);
  return resources;
}

/** Shared land/water pickup visual. Move/rotate/disable the returned parent as
 * one unit; toggle models by display. Call a scene's reflection.exclude(mesh)
 * after creation when its moving objects use a main-camera-only render layer. */
export function createPickupVisual(app: pc.AppBase, parent: pc.Entity): PickupVisual {
  const { shell, frame, glass, glow } = resourcesFor(app, parent);
  const mesh = new pc.Entity('Energy item box', app);
  parent.addChild(mesh);
  for (const [name, geometry, material] of [
    ['Translucent pickup glass', shell, glass], ['Luminous edges', frame, glow],
  ] as const) {
    const entity = new pc.Entity(name, app);
    entity.addComponent('render', { meshInstances: [new pc.MeshInstance(geometry, material)], castShadows: false, receiveShadows: true });
    mesh.addChild(entity);
  }
  const models = {} as Record<ItemDisplay, pc.Entity>;
  for (const kind of displays) {
    const model = models[kind] = createItemModel(app, kind);
    model.enabled = kind === 'mystery';
    mesh.addChild(model);
  }
  return { mesh, models };
}
