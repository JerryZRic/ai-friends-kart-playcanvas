/** Exact enriched runtime source, with the sealed baseline camera/light package.
 * node --max-old-space-size=512 --import tsx scripts/export-mountain-enrichment-preview.ts OUTPUT BASELINE BASELINE_EXTENSION
 * Use only after acceptance and an explicit serial numerical handoff. Public
 * posters and previous provenance are intentionally outside this exporter.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import * as pc from 'playcanvas';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain.ts';
import {buildMountainSceneGeometry} from '../src/mountain-scenery.ts';
import {landTexturePixels} from '../src/land-scenery.ts';
import {MOUNTAIN_SCENE_THEME as theme} from '../src/land-scene.ts';
const output=resolve(process.argv[2]),baseline=resolve(process.argv[3]),extension=resolve(process.argv[4]);
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const fileHash=(path:string)=>hash(readFileSync(path));
for(const [root,manifest] of [[baseline,'BASELINE-SHA256.json'],[extension,'EXTENSION-SHA256.json']]){
  const sealed=JSON.parse(readFileSync(join(root,manifest),'utf8'));
  for(const [path,digest] of Object.entries(sealed))if(fileHash(join(root,path))!==digest)throw new Error('Sealed baseline changed: '+path);
}
const files=['src/closed-circuit.ts','src/land-track.ts','src/maps/mountain.ts','src/land-scenery.ts','src/mountain-scenery.ts','src/alpine-props.ts','src/generated/alpine-props.json','src/land-mesh-builder.ts','src/land-road-mesh.ts','src/land-scene.ts','src/land-course.ts','src/game.ts','src/land-camera.ts','src/race-camera.ts'];
const sourceHashes=Object.fromEntries(files.map(path=>[path,fileHash(path)]));
const originalCameras=JSON.parse(readFileSync(join(baseline,'frozen-cameras.json'),'utf8'));
for(const path of ['src/closed-circuit.ts','src/land-track.ts','src/maps/mountain.ts','src/race-camera.ts'])if(sourceHashes[path]!==originalCameras.baselineSourceHashes[path])throw new Error('Protected route/chase source changed: '+path);
if(JSON.stringify(theme)!==JSON.stringify(originalCameras.runtimeTheme))throw new Error('Runtime theme changed; retain baseline equal-light comparison and declare a separate lighting study');
const geometry=buildMountainSceneGeometry(track);
const batches=geometry.batches.map(b=>({...b,normals:Array.from(new Float32Array(pc.calculateNormals(b.positions,b.indices)))}));
const textures=Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
const route={length:track.length,label:track.label,tag:track.tag,sections:track.sections,points:Array.from({length:1200},(_,i)=>track.sample(i/1200*track.length).p.toArray())};
const content={geometry:{...geometry,batches},textures,route,theme},contentSha256=hash(JSON.stringify(content));
for(const [root,suffix] of [[baseline,''],[extension,'-extension']]){
  const out=output+suffix;if(existsSync(join(out,'mountain-geometry.json')))throw new Error('Refusing to overwrite prior exported comparison: '+out);mkdirSync(out,{recursive:true});
  const cameras=JSON.parse(readFileSync(join(root,'frozen-cameras.json'),'utf8'));
  const record={kind:'offline-native-geometry-render',description:'Exact enriched Mountain runtime geometry. All source batches enabled; frozen pre-enrichment camera and equal light retained. No gameplay/GPU or frame-rate claim.',sourceHashes,...content,cameras,cameraPackageSha256:hash(JSON.stringify(cameras)),contentSha256};
  writeFileSync(join(out,'mountain-geometry.json'),JSON.stringify(record));
  copyFileSync(join(root,'frozen-cameras.json'),join(out,'comparison-cameras.json'));
  copyFileSync(join(root,'frozen-render-settings.json'),join(out,'comparison-render-settings.json'));
  writeFileSync(join(out,'source-snapshot-manifest.json'),JSON.stringify({sourceHashes,contentSha256,cameraPackageSha256:record.cameraPackageSha256,baselineSettingsSha256:fileHash(join(root,'frozen-render-settings.json')),exporterSha256:fileHash('scripts/export-mountain-enrichment-preview.ts')},null,2)+'\n');
}
for(const [path,digest] of Object.entries(sourceHashes))if(fileHash(path)!==digest)throw new Error('Source changed during export: '+path);
console.log(JSON.stringify({output,extensionOutput:output+'-extension',batches:batches.length,vertices:batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:batches.reduce((n,b)=>n+b.indices.length/3,0),contentSha256,sourceHashes}));
