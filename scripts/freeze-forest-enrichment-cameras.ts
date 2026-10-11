/** Freeze source-derived before/after cameras before any Forest scenery edits.
 * Usage: node --import tsx scripts/freeze-forest-enrichment-cameras.ts BASELINE_DIR VERIFIED_PUBLIC_COMMIT VERIFIED_PUBLIC_TREE
 * This reads a previously exported unchanged baseline, never candidate geometry.
 * Baseline-source provenance must name the parent's verified remote Quarry head.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import * as pc from 'playcanvas';
import {FOREST_COURSE} from '../src/maps/forest.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';

const [directory,commit,publicTree]=process.argv.slice(2),output='docs/forest-enrichment-cameras.json';
assert.ok(directory&&/^[0-9a-f]{40}$/.test(commit)&&/^[0-9a-f]{40}$/.test(publicTree),'Provide baseline directory and verified public commit/tree');
assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),publicTree,'Local baseline tree differs from parent-verified public tree');
assert.ok(!existsSync(output),'Frozen camera manifest already exists; never silently overwrite it');
const baseline=resolve(directory),sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const hash=(path:string)=>sha(readFileSync(path));
const data=JSON.parse(readFileSync(join(baseline,'forest-geometry.json'),'utf8'));
const old=JSON.parse(readFileSync('docs/forest-preview-provenance.json','utf8'));
const protectedFiles=['src/race-camera.ts','src/land-camera.ts','src/game.ts','src/land-driving.ts','src/land-course.ts','src/land-course-pickups.ts','src/land-race-route.ts','src/land-routes.ts','src/race-controls.ts','src/vehicle-controls.js','src/mouse-look.js','src/npc-difficulty.ts','src/npc-tactics.ts','src/maps/forest.ts'];
const additionalProtectedSourceHashes=Object.fromEntries(protectedFiles.map(path=>[path,hash(path)]));
for(const [path,digest] of Object.entries({...data.sourceHashes,...additionalProtectedSourceHashes})){
  assert.equal(hash(path),digest,'Current source differs from baseline: '+path);
  assert.equal(sha(execFileSync('git',['show','HEAD:'+path])),digest,'Public baseline commit differs: '+path);
}
assert.equal(hash('docs/scene-baselines/forest-scenery.ts.txt'),data.sourceHashes['src/forest-scenery.ts']);
const tuple=(p:{x:number;y:number;z:number})=>[p.x,p.y,p.z];
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]);
const settings={projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,720],samples:24,renderByDefault:true};
function pose(name:string,eye:number[],target:number[],extra:Record<string,unknown>){
  const position=xyz(eye),matrix=new pc.Mat4().setLookAt(position,xyz(target),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(matrix).normalize();
  return {name,...settings,sourceEye:eye,sourceTarget:target,cameraPositionBlender:position.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),...extra};
}
const stations=[
  ['root-valley-underpass','start',406.2366530619097],['cedar-bowl-entry','start',650],['bowl-exit-reveal','start',850],
  ['fork-decision','start',1030],['service-observatory','alley',110],['rim-summit','boulevard',160],
  ['upper-canopy-crossing','finish',417.3205033850164],['sunbreak-return','finish',840],['forestry-station-approach','finish',1182],
] as const;
const edges={start:FOREST_COURSE.commonStart,alley:FOREST_COURSE.alternates.alley,boulevard:FOREST_COURSE.alternates.boulevard,finish:FOREST_COURSE.commonFinish};
const views=stations.map(([name,id,s])=>{
  const frame=edges[id].sample(s),desired=chaseCamera({position:frame.p,tangent:frame.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
  const anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles);
  return pose('forest-chase-'+name,tuple(safe),tuple(desired.look),{roadEdge:id,roadDistanceMetres:s,sourceRoad:frame.p.toArray(),sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),description:'Unchanged shared chaseCamera view=0, center lane, yaw/pitch=0, rearView=false; baseline safeLandCamera against all original scenery. Frozen pose and target, vertical FOV 56 degrees, 16:9. Static offline source geometry only, no gameplay capture.'});
});
for(const sight of data.geometry.sightlines)views.push(pose('forest-landmark-'+sight.name.replaceAll(' ','-'),sight.eye,sight.target,{description:'Authored landmark-directed road-eye view, source road+1.6m aiming at original dome target. This is not a shared chase view.',sightlineName:sight.name}) as typeof views[number]);
const catalogViews=Object.entries(old.views).map(([name,value])=>{
  const view=value as Record<string,any>;
  return {name,...view,sensorFit:'HORIZONTAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:50,clipStart:.1,clipEnd:10000,samples:48,renderByDefault:true,poseSource:'Exact pre-enrichment docs/forest-preview-provenance.json pose; no refit'};
});
const common=JSON.parse(readFileSync('docs/quarry-enrichment-cameras.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'forest-frozen-camera-manifest-v1',notice:'Frozen before/after source geometry. Static offline CPU rendering, approximate light/material response. No driver, vehicle, HUD, gameplay, GPU or performance claim. Normal shared-chase poses and authored landmark-directed road-eye views are explicitly distinct.',baselineSourceCommit:commit,baselineSourceTree:publicTree,baselineManifestSha256:hash('docs/forest-preview-provenance.json'),render:common.render,lighting:{worldColorHex:data.theme.sky,worldStrength:.7,sunEulerRadians:[-35*Math.PI/180,0,-16*Math.PI/180],sunEnergy:2.25,sunAngleRadians:.09,sunColorLinear:[1,.945,.83]},views,catalogViews,baselineGeometryContract:{geometryJsonSha256:hash(join(baseline,'forest-geometry.json')),glbSha256:hash(join(baseline,'forest-original-scene.glb')),sourceHashes:data.sourceHashes,scenerySnapshot:'docs/scene-baselines/forest-scenery.ts.txt',additionalProtectedSourceHashes}},null,2)+'\n');
console.log('Frozen Forest cameras:',views.length+catalogViews.length,'public baseline:',commit);
