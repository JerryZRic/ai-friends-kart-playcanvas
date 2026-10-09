/** Export the native menu scene's world-space meshes without WebGL.
 * These are inputs for offline thumbnails, never browser/gameplay captures.
 * Run from the repository root: node --import tsx scripts/export-map-previews.ts /tmp/map-previews
 */
import * as pc from 'playcanvas';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createMenuWorld} from '../src/menu-backdrop.ts';
import {DEFAULT_SETTINGS} from '../src/game-settings.ts';
import {sample as sampleCoast, LENGTH as COAST_LENGTH, halfWidthAt} from '../src/track.ts';
import {sampleWaterparkLoop, WATER_RACE_LENGTH} from '../src/waterpark-design.ts';

const output = resolve(process.argv[2] || '/tmp/ai-friends-map-previews');
mkdirSync(output, {recursive: true});
const sourceFiles = [
  'src/closed-circuit.ts', 'src/track.ts', 'src/scene.ts', 'src/menu-backdrop.ts',
  'src/waterpark-design.ts', 'src/waterpark-scene.ts', 'src/waterpark-environment.ts',
  'src/waterpark-bed.ts', 'src/waterpark-materials.ts', 'src/waterpark-water.ts',
];
const sourceHashes = Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const canvas = {id: 'offline-map-export', width: 1280, height: 720,
  addEventListener() {}, removeEventListener() {},
  getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};},
} as any;
const app = new pc.AppBase(canvas), options = new pc.AppOptions();
options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
options.devtools = false;
app.init(options);

for (const map of ['coast', 'waterpark'] as const) {
  const world = createMenuWorld(app as any, map, {...DEFAULT_SETTINGS, quality: 'low'});
  const meshes: {name: string; color: string; positions: number[]; normals: number[]; indices: number[]; water: boolean; roughness: number; metalness: number}[] = [];
  const omitted: string[] = [];
  for (const render of app.root.findComponents('render') as pc.RenderComponent[]) for (const instance of render.meshInstances) {
    const name = instance.node.name;
    // Distant atmospheric meshes have no useful role in an overhead route card.
    // Keep every road, bank, bridge, landmark, terrain and local scenery mesh.
    if (/gradient sky|sun disc|distant mountains|cloud/i.test(name)) {omitted.push(name); continue;}
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    instance.mesh.getPositions(positions); instance.mesh.getNormals(normals); instance.mesh.getIndices(indices);
    if (!indices.length) continue;
    const transform = instance.node.getWorldTransform(), normal = new pc.Mat4().copy(transform).invert().transpose();
    for (let i = 0; i < positions.length; i += 3) {
      const p = transform.transformPoint(new pc.Vec3(positions[i], positions[i + 1], positions[i + 2]));
      positions[i] = p.x; positions[i + 1] = p.y; positions[i + 2] = p.z;
    }
    for (let i = 0; i < normals.length; i += 3) {
      const p = normal.transformVector(new pc.Vec3(normals[i], normals[i + 1], normals[i + 2])).normalize();
      normals[i] = p.x; normals[i + 1] = p.y; normals[i + 2] = p.z;
    }
    const material = instance.material as pc.StandardMaterial;
    const water = /ocean|flowing canal/i.test(name);
    const color = material.diffuse?.toString(false) ?? (/ocean/i.test(name) ? '#21888f' : /canal/i.test(name) ? '#14bde6' : '#cccccc');
    meshes.push({name, color, positions, normals, indices, water,
      roughness: water ? .35 : 1 - (material.gloss ?? .2), metalness: material.metalness ?? 0});
  }
  const sampler = map === 'coast' ? sampleCoast : sampleWaterparkLoop;
  const length = map === 'coast' ? COAST_LENGTH : WATER_RACE_LENGTH;
  const points: number[][] = [], anchors: number[][] = [];
  for (let i = 0; i < 720; i++) {
    const distance = i / 720 * length;
    points.push(sampler(distance).p.toArray());
    const edge = map === 'coast' ? halfWidthAt(distance) + 2 : 16;
    for (const lateral of [-edge, edge]) anchors.push(sampler(distance, lateral).p.toArray());
  }
  // Include high landmarks, the bridge and resort buildings in the safe frame.
  for (const mesh of meshes) if (/tower|roofs|canopies|bridge stone|resort terraces|resort glazing/i.test(mesh.name)) {
    for (let i = 0; i < mesh.positions.length; i += 3) anchors.push(mesh.positions.slice(i, i + 3));
  }
  const min = [0, 1, 2].map(axis => Math.min(...points.map(p => p[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...points.map(p => p[axis])));
  const record = {map, kind: 'offline-native-geometry-render', sourceHashes,
    source: 'Actual PlayCanvas menu scene meshes, using the playable closed-loop race geometry. Offline CPU render with approximate materials and lighting; not a browser or GPU gameplay screenshot.',
    omittedAtmosphere: [...new Set(omitted)], meshes, route: {length, min, max, points, anchors}};
  writeFileSync(join(output, `${map}.json`), JSON.stringify(record));
  console.log(`${map}: ${meshes.length} mesh batches, ${meshes.reduce((n, mesh) => n + mesh.indices.length / 3, 0)} triangles`);
  world.destroy();
}
app.destroy();
