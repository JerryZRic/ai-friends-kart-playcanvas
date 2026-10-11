/** Immutable exact-source Mountain001 before/after geometry and camera export.
 * Baseline: node --max-old-space-size=512 --import tsx scripts/export-mountain-comparison.ts OUTPUT SOURCE_ROOT
 * Comparison: same, followed by the baseline camera package path. This never
 * updates public assets or old provenance and never reselects comparison poses.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as pc from 'playcanvas';
const out=resolve(process.argv[2]),root=resolve(process.argv[3]??'.');
mkdirSync(out,{recursive:true});
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const imp=async(path:string)=>import(pathToFileURL(join(root,path)).href);
const {MOUNTAIN_TRACK:track}=await imp('src/maps/mountain.ts');
const {buildLandSceneGeometry,landTexturePixels}=await imp('src/land-scenery.ts');
const {MOUNTAIN_SCENE_THEME:theme}=await imp('src/land-scene.ts');
const {chaseCamera}=await imp('src/race-camera.ts');
const files=['src/closed-circuit.ts','src/land-track.ts','src/maps/mountain.ts','src/land-scenery.ts','src/land-scene.ts','src/land-course.ts','src/game.ts','src/land-camera.ts','src/race-camera.ts'];
const sourceHashes=Object.fromEntries(files.map(path=>[path,hash(readFileSync(join(root,path)))]));
const geometry=buildLandSceneGeometry(track);
const batches=geometry.batches.map((b:any)=>({...b,normals:Array.from(new Float32Array(pc.calculateNormals(b.positions,b.indices)))}));
const textures=Object.fromEntries(['stone','asphalt','wood','grass'].map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
const tuple=(p:any)=>[p.x,p.y,p.z];
const quat=(position:number[],target:number[])=>new pc.Quat().setFromMat4(new pc.Mat4().setLookAt(new pc.Vec3(...position),new pc.Vec3(...target),pc.Vec3.UP)).toArray();
let cameras:any;
if(process.argv[4])cameras=JSON.parse(readFileSync(resolve(process.argv[4]),'utf8'));
else {
  if(existsSync(join(out,'frozen-cameras.json')))throw new Error('Refusing to overwrite existing immutable cameras');
  const selected=[
    ['mountain-valley-chalet',.025,0],['mountain-eastern-hairpin',.145,1],['mountain-summit',.27,2],['mountain-upper-viaduct',.405,3],
    ['mountain-western-esses',.535,4],['mountain-pine-switchback',.685,5],['mountain-basin-hairpin',.79,6],['mountain-lower-underpass',.91,7],
  ] as const;
  const poses=selected.map(([id,fraction,index])=>{
    const s=fraction*track.length,lane=0,support=track.sample(s,lane);
    const pose=chaseCamera({position:support.p,tangent:support.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
    const position=tuple(pose.position),target=tuple(pose.look);
    return {id,section:track.sections[index],roadS:s,lapFraction:fraction,lane,physicalRoadPosition:tuple(support.p),physicalTangent:tuple(support.t),physicalBank:support.bank,
      projection:'PERSP',positionSource:position,targetSource:target,quaternionSourceXYZW:quat(position,target),verticalFovDegrees:56,aspect:16/9,resolution:[768,432],nearClip:.12,farClip:2200,
      sharedChase:{view:0,rearView:false,orbit:{yaw:0,pitch:0},steadyState:true,smoothingApplied:false},cameraSafety:'Base Mountain land-course has no cameraObstacles; exact shared chase target. Any later safety-adjusted view must be additional, not replace this frozen camera.',description:'Source-derived steady-state shared default chase pose at real road support. No kart, HUD, gameplay capture, GPU appearance or frame-rate claim.'};
  });
  const chalet=geometry.props.find((p:any)=>p.kind==='lookout-chalet');
  const samples=Array.from({length:1200},(_,i)=>track.sample(i/1200*track.length).p);
  const nearest=samples.reduce((best:number,p:any,i:number)=>Math.hypot(p.x-chalet.x,p.z-chalet.z)<Math.hypot(samples[best].x-chalet.x,samples[best].z-chalet.z)?i:best,0);
  const sampleIndex=(nearest-8+samples.length)%samples.length,p=samples[sampleIndex];
  const position=[p.x,p.y+2.1,p.z],target=[chalet.x,chalet.y+3.2,chalet.z];
  const architecture={id:'mountain-chalet-architecture',projection:'PERSP',positionSource:position,targetSource:target,quaternionSourceXYZW:quat(position,target),lensMillimetres:36,sensorWidthMillimetres:36,aspect:1.6,resolution:[800,500],nearClip:.12,farClip:2200,roadS:sampleIndex/1200*track.length,lane:0,heightAboveRoadMetres:2.1,baselineNearestChaletSampleIndex:nearest,baselineCameraSampleIndex:sampleIndex,baselineChalet:chalet,description:'Additional fixed 36 mm roadside architectural aim, 2.1 m above sampled road; not a gameplay chase camera. Nearest chalet selection occurs only once before enrichment.'};
  const sunRotation=new pc.Quat().setFromEulerAngles(...theme.sunEuler),sunDirection=sunRotation.transformVector(new pc.Vec3(0,-1,0));
  cameras={version:1,baselineSourceHashes:sourceHashes,coordinateTransform:'PlayCanvas (x,y,z) -> Blender (x,-z,y); source quaternion XYZW, Blender quaternion WXYZ',runtimeTheme:theme,runtimeExposure:1,runtimeToneMapping:'ACES, gamma SRGB',
    offlineTranslation:{renderer:'Blender Cycles CPU',threads:2,samples:12,seed:17,viewTransform:'AgX',exposure:0,gamma:1,worldColorSource:theme.ambient,worldEnergy:.7,backgroundColorSource:theme.sky,sunColorSource:theme.sunColor,sunEnergy:theme.sunIntensity,sunDirectionSource:tuple(sunDirection),sunAngleRadians:.09,fogEnabled:false,notice:'Exact source geometry, UVs, texture pixels and float32 runtime normals. Offline PBR/material response, shadows, ambient, fog and color transform differ from PlayCanvas. Identical settings and camera package must be used for paired scenery comparisons.'},
    overview:{id:'mountain-overview',projection:'ORTHO',directionBlender:[.12,-.60,.80],fit:'All original road edges with 6% safety margin; every source batch remains enabled including peripheral scenery',resolution:[960,540],aspect:16/9,nearClip:.12,farClip:10000},poses,architecture};
  writeFileSync(join(out,'frozen-cameras.json'),JSON.stringify(cameras,null,2)+'\n');
}
const route={length:track.length,label:track.label,tag:track.tag,sections:track.sections,points:Array.from({length:1200},(_,i)=>track.sample(i/1200*track.length).p.toArray())};
const record={kind:'offline-native-geometry-render',description:'Exact static runtime mesh source. Comparison cameras and lighting are frozen independently of scenery. No source mesh may be hidden, moved or repaired solely for the render.',sourceHashes,theme,geometry:{...geometry,batches},textures,route,cameras,cameraPackageSha256:hash(JSON.stringify(cameras)),contentSha256:hash(JSON.stringify({geometry:{...geometry,batches},textures,route,theme}))};
writeFileSync(join(out,'mountain-geometry.json'),JSON.stringify(record));
for(const [path,digest] of Object.entries(sourceHashes))if(hash(readFileSync(join(root,path)))!==digest)throw new Error('Source changed during export: '+path);
console.log(JSON.stringify({output:out,batches:batches.length,vertices:batches.reduce((n:number,b:any)=>n+b.positions.length/3,0),triangles:batches.reduce((n:number,b:any)=>n+b.indices.length/3,0),cameras:cameras.poses.map((p:any)=>({id:p.id,roadS:p.roadS,position:p.positionSource,target:p.targetSource})),contentSha256:record.contentSha256}));
