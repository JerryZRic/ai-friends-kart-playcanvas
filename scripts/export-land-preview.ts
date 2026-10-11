/** Export exactly the original static meshes and pixel textures used at runtime.
 * node --import tsx scripts/export-land-preview.ts /path/to/output
 * Offline input only: no GPU/gameplay capture and no third-party character data.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import * as pc from 'playcanvas';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain.ts';
import {landTexturePixels} from '../src/land-scenery.ts';
import {buildMountainSceneGeometry} from '../src/mountain-scenery.ts';
import {MOUNTAIN_SCENE_THEME as theme} from '../src/land-scene.ts';
const output=resolve(process.argv[2] ?? '../land-map-artifacts/mountain');
mkdirSync(output,{recursive:true});
const files=['src/closed-circuit.ts','src/land-track.ts','src/maps/mountain.ts','src/land-scenery.ts','src/mountain-scenery.ts','src/alpine-props.ts','src/generated/alpine-props.json','src/land-mesh-builder.ts','src/land-road-mesh.ts','src/land-scene.ts','src/land-course.ts','src/land-camera.ts','src/race-camera.ts'];
const sourceHashes=Object.fromEntries(files.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const geometry=buildMountainSceneGeometry(track);
const textures=Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
const points=Array.from({length:1200},(_,i)=>track.sample(i/1200*track.length).p.toArray());
const record={kind:'offline-native-geometry-render',description:'Exact original static runtime mesh positions, triangle indices, UVs, material values and procedural texture pixels. Lighting and renderer differ from PlayCanvas. Includes two selected original Alpine props with authoring provenance in ALPINE-PROP-NOTICE.txt. No racing driver, vehicle, third-party model or gameplay/GPU claim.',sourceHashes,theme,geometry:{...geometry,batches:geometry.batches.map(b=>({...b,normals:Array.from(new Float32Array(pc.calculateNormals(b.positions,b.indices)))}))},textures,route:{length:track.length,label:track.label,tag:track.tag,points,sections:track.sections}};
writeFileSync(join(output,'mountain-geometry.json'),JSON.stringify({...record,contentSha256:createHash('sha256').update(JSON.stringify({geometry:record.geometry,textures:record.textures,route:record.route,theme:record.theme})).digest('hex')}));
console.log(JSON.stringify({output,batches:geometry.batches.length,triangles:geometry.batches.reduce((n,b)=>n+b.indices.length/3,0),bounds:geometry.bounds,structures:geometry.structures,props:geometry.props.filter(p=>p.kind==='lookout-chalet')}));
