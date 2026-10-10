/** Export exactly the original static meshes and pixel textures used at runtime.
 * node --import tsx scripts/export-land-preview.ts /path/to/output
 * Offline input only: no GPU/gameplay capture and no third-party character data.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import * as pc from 'playcanvas';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain.ts';
import {buildLandSceneGeometry, landTexturePixels} from '../src/land-scenery.ts';
const output=resolve(process.argv[2] ?? '../land-map-artifacts/mountain');
mkdirSync(output,{recursive:true});
const files=['src/closed-circuit.ts','src/land-track.ts','src/maps/mountain.ts','src/land-scenery.ts','src/land-scene.ts'];
const sourceHashes=Object.fromEntries(files.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const geometry=buildLandSceneGeometry(track);
const textures=Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
const points=Array.from({length:1200},(_,i)=>track.sample(i/1200*track.length).p.toArray());
const record={kind:'offline-native-geometry-render',description:'Exact original static runtime mesh positions, triangle indices, UVs, material values and procedural texture pixels. Lighting and renderer differ from PlayCanvas. No driver, vehicle, downloaded or third-party model assets.',sourceHashes,geometry:{...geometry,batches:geometry.batches.map(b=>({...b,normals:pc.calculateNormals(b.positions,b.indices)}))},textures,route:{length:track.length,label:track.label,tag:track.tag,points,sections:track.sections}};
writeFileSync(join(output,'mountain-geometry.json'),JSON.stringify(record));
console.log(JSON.stringify({output,batches:geometry.batches.length,triangles:geometry.batches.reduce((n,b)=>n+b.indices.length/3,0),bounds:geometry.bounds,structures:geometry.structures,props:geometry.props.filter(p=>p.kind==='lookout-chalet')}));
