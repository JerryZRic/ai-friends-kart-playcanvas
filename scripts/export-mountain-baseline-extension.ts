/** Additive .875 shared-chase baseline extension. Never rewrites sealed baseline.
 * Run only in an explicitly granted serial numerical slot:
 * node --max-old-space-size=512 --import tsx scripts/export-mountain-baseline-extension.ts BASELINE OUTPUT
 * Then use render-mountain-comparison.py OUTPUT OUTPUT/frozen-render-settings.json.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as pc from 'playcanvas';
const baseline=resolve(process.argv[2]),out=resolve(process.argv[3]);
if(baseline===out)throw new Error('Extension must be separate from sealed baseline');
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const fileHash=(path:string)=>hash(readFileSync(path));
const requiredSettingsHash='d12474530e048491a81746d809107bfe6e9dd0ba0bb1b5c8cf3a45def4c901e7';
const sealed=JSON.parse(readFileSync(join(baseline,'BASELINE-SHA256.json'),'utf8'));
for(const [path,digest] of Object.entries(sealed))if(fileHash(join(baseline,path))!==digest)throw new Error('Sealed baseline changed: '+path);
if(fileHash(join(baseline,'frozen-render-settings.json'))!==requiredSettingsHash)throw new Error('Original camera/light settings changed');
if(existsSync(join(out,'mountain-geometry.json')))throw new Error('Refusing to overwrite prior additive extension');
mkdirSync(out,{recursive:true});
const root=join(baseline,'source');
const {MOUNTAIN_TRACK:track}=await import(pathToFileURL(join(root,'src/maps/mountain.ts')).href);
const {chaseCamera}=await import(pathToFileURL(join(root,'src/race-camera.ts')).href);
const fraction=.875,lane=0,s=fraction*track.length,support=track.sample(s,lane);
const pose=chaseCamera({position:support.p,tangent:support.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
const tuple=(p:any)=>[p.x,p.y,p.z];const position=tuple(pose.position),target=tuple(pose.look);
const sourceQ=new pc.Quat().setFromMat4(new pc.Mat4().setLookAt(new pc.Vec3(...position),new pc.Vec3(...target),pc.Vec3.UP));
const q=new pc.Quat().setFromEulerAngles(90,0,0).mul(sourceQ);
const transform=(p:number[])=>[p[0],-p[2],p[1]];
const spec={id:'mountain-lower-underpass-approach',section:track.sections[7],roadS:s,lapFraction:fraction,lane,physicalRoadPosition:tuple(support.p),physicalTangent:tuple(support.t),physicalBank:support.bank,
  projection:'PERSP',positionSource:position,targetSource:target,quaternionSourceXYZW:sourceQ.toArray(),verticalFovDegrees:56,aspect:16/9,resolution:[768,432],nearClip:.12,farClip:2200,
  sharedChase:{view:0,rearView:false,orbit:{yaw:0,pitch:0},steadyState:true,smoothingApplied:false},cameraSafety:'Base Mountain land-course has no cameraObstacles; exact shared chase target. Keep this pose unchanged for scenery comparison.',
  description:'Additive earlier .875 lower-road approach toward the upper viaduct. Exact shared default chase camera, not an architectural upward aim. Original ten views remain sealed and unchanged.',
  cameraPositionBlender:transform(position),cameraQuaternionBlenderWXYZ:[q.w,q.x,q.y,q.z],targetBlender:transform(target)};
const original=JSON.parse(readFileSync(join(baseline,'mountain-geometry.json'),'utf8'));
const originalSettings=JSON.parse(readFileSync(join(baseline,'frozen-render-settings.json'),'utf8'));
const cameras={version:1,baselineSourceHashes:original.sourceHashes,coordinateTransform:original.cameras.coordinateTransform,runtimeTheme:original.cameras.runtimeTheme,runtimeExposure:original.cameras.runtimeExposure,runtimeToneMapping:original.cameras.runtimeToneMapping,offlineTranslation:original.cameras.offlineTranslation,poses:[spec],
  additiveBaselineExtension:{sealedBaselineSettingsSha256:requiredSettingsHash,sealedBaselineFileManifestSha256:fileHash(join(baseline,'BASELINE-SHA256.json')),preserveOriginalTenViews:true,purpose:'One extra earlier shared-chase lower-underpass approach at lap fraction .875'}};
const cameraPackageSha256=hash(JSON.stringify(cameras));
const settings={...originalSettings,cameraPackageSha256,views:{[spec.id]:spec},additiveBaselineExtension:cameras.additiveBaselineExtension};
writeFileSync(join(out,'frozen-cameras.json'),JSON.stringify(cameras,null,2)+'\n');
writeFileSync(join(out,'frozen-render-settings.json'),JSON.stringify(settings,null,2)+'\n');
writeFileSync(join(out,'mountain-geometry.json'),JSON.stringify({...original,cameras,cameraPackageSha256}));
writeFileSync(join(out,'extension-source-manifest.json'),JSON.stringify({baselineCommit:'769911cc562b9330a57f043e9a7f9a2f0a976dac',sourceHashes:original.sourceHashes,geometryContentSha256:original.contentSha256,originalGeometryFileSha256:fileHash(join(baseline,'mountain-geometry.json')),extensionGeneratorSha256:fileHash('scripts/export-mountain-baseline-extension.ts'),additiveBaselineExtension:cameras.additiveBaselineExtension,lockedPose:spec},null,2)+'\n');
for(const [path,digest] of Object.entries(sealed))if(fileHash(join(baseline,path))!==digest)throw new Error('Sealed baseline modified during extension: '+path);
console.log(JSON.stringify({out,pose:spec,sealedBaselineFilesUnchanged:Object.keys(sealed).length}));
