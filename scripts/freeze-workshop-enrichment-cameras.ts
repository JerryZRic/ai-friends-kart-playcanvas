/** Freeze source-derived before/after cameras before any Workshop scenery edits.
 * Usage: node --import tsx scripts/freeze-workshop-enrichment-cameras.ts BASELINE_DIR VERIFIED_PUBLIC_COMMIT VERIFIED_PUBLIC_TREE
 * This reads a previously exported unchanged baseline, never candidate geometry.
 * Baseline-source provenance names the parent-verified public baseline head.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import * as pc from 'playcanvas';
import {WORKSHOP_COURSE} from '../src/maps/workshop.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';

const [directory,commit,publicTree]=process.argv.slice(2),output='docs/workshop-enrichment-cameras.json';
assert.ok(directory&&/^[0-9a-f]{40}$/.test(commit)&&/^[0-9a-f]{40}$/.test(publicTree),'Provide baseline directory and verified public commit/tree');
assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),publicTree,'Local baseline tree differs from parent-verified public tree');
assert.ok(!existsSync(output),'Frozen camera manifest already exists; never silently overwrite it');
const baseline=resolve(directory),sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const hash=(path:string)=>sha(readFileSync(path));
const data=JSON.parse(readFileSync(join(baseline,'workshop-geometry.json'),'utf8'));
const old=JSON.parse(readFileSync('docs/workshop-preview-provenance.json','utf8'));
const protectedFiles=['src/race-camera.ts','src/land-camera.ts','src/game.ts','src/land-driving.ts','src/land-course.ts','src/land-course-pickups.ts','src/land-race-route.ts','src/land-routes.ts','src/race-controls.ts','src/vehicle-controls.js','src/mouse-look.js','src/npc-difficulty.ts','src/npc-tactics.ts','src/maps/workshop.ts'];
const additionalProtectedSourceHashes=Object.fromEntries(protectedFiles.map(path=>[path,hash(path)]));
for(const [path,digest] of Object.entries({...data.sourceHashes,...additionalProtectedSourceHashes})){
  assert.equal(hash(path),digest,'Current source differs from baseline: '+path);
  assert.equal(sha(execFileSync('git',['show','HEAD:'+path])),digest,'Public baseline commit differs: '+path);
}
assert.equal(hash('docs/scene-baselines/workshop-scenery.ts.txt'),data.sourceHashes['src/workshop-scenery.ts']);
const tuple=(p:{x:number;y:number;z:number})=>[p.x,p.y,p.z];
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]);
const settings={projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,720],samples:24,renderByDefault:true};
function pose(name:string,eye:number[],target:number[],extra:Record<string,unknown>){
  const position=xyz(eye),matrix=new pc.Mat4().setLookAt(position,xyz(target),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(matrix).normalize();
  return {name,...settings,sourceEye:eye,sourceTarget:target,cameraPositionBlender:position.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),...extra};
}
const stations: {id:string;edge:'start'|'alley'|'boulevard'|'finish';s:number}[]=[{"id":"launch-room-depth","edge":"start","s":120},{"id":"vise-apron","edge":"start","s":220},{"id":"lower-crossing-approach","edge":"start","s":483.0803465091211},{"id":"clock-entry-side-view","edge":"start","s":596.0671069703933},{"id":"spool-north-architecture","edge":"start","s":750},{"id":"spool-west-architecture","edge":"start","s":930.4462157586628},{"id":"upper-crossing-approach","edge":"start","s":1269.6328964491433},{"id":"fork-signs","edge":"start","s":1308.8222121229105},{"id":"decision-input-zone","edge":"start","s":1373.8222121229105},{"id":"cabinet-run","edge":"alley","s":90},{"id":"rim-drafting-approach","edge":"boulevard","s":90},{"id":"lamp-return","edge":"finish","s":180},{"id":"drawer-return","edge":"finish","s":500}];
const edges={start:WORKSHOP_COURSE.commonStart,alley:WORKSHOP_COURSE.alternates.alley,boulevard:WORKSHOP_COURSE.alternates.boulevard,finish:WORKSHOP_COURSE.commonFinish};
const views=stations.map(({id:name,edge:id,s})=>{
  const frame=edges[id].sample(s),desired=chaseCamera({position:frame.p,tangent:frame.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
  const anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles);
  return pose('workshop-chase-'+name,tuple(safe),tuple(desired.look),{roadEdge:id,roadDistanceMetres:s,sourceRoad:frame.p.toArray(),sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),description:'Unchanged shared chaseCamera view=0, center lane, yaw/pitch=0, rearView=false; baseline safeLandCamera against all original scenery. Frozen pose and target, vertical FOV 56 degrees, 16:9. Static offline source geometry only, no gameplay capture.'});
});
for(const station of stations){const e=edges[station.edge],eye=e.sample(station.s).p.clone().add(new pc.Vec3(0,1.6,0)),target=e.sample(Math.min(e.length,station.s+40)).p.clone().add(new pc.Vec3(0,1.6,0));views.push(pose('workshop-road-eye-'+station.id,tuple(eye),tuple(target),{roadEdge:station.edge,roadDistanceMetres:station.s,description:'Forward driver-height view, source road +1.6m looking 40m ahead on the same physical edge. Separate from shared chase and target-facing landmark views.'}) as typeof views[number]);}
for(const sight of data.geometry.sightlines)views.push(pose('workshop-landmark-'+sight.name.replaceAll(' ','-'),sight.eye,sight.target,{description:'Authored landmark-directed road-eye view, source road+1.6m aiming at original dome target. This is not a shared chase view.',sightlineName:sight.name}) as typeof views[number]);
const catalogViews=Object.entries(old.views).map(([name,value])=>{
  const view=value as Record<string,any>;
  return {name,...view,sensorFit:'HORIZONTAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:50,clipStart:.1,clipEnd:10000,samples:48,renderByDefault:true,poseSource:'Exact pre-enrichment docs/workshop-preview-provenance.json pose; no refit'};
});
const firstGate=['lower-crossing-approach','spool-north-architecture','fork-signs','lamp-return'],additional=['launch-room-depth','spool-west-architecture','cabinet-run','drawer-return'];
const wanted=new Set([...firstGate.flatMap(id=>['workshop-chase-'+id,'workshop-road-eye-'+id]),...additional.map(id=>'workshop-chase-'+id)]);
for(const view of views)view.renderByDefault=wanted.has(view.name);
const common=JSON.parse(readFileSync('docs/quarry-enrichment-cameras.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'workshop-frozen-camera-manifest-v1',reviewSelection:'18 representative pairs: eight first-gate chase/forward-eye views, four additional district chase views and six original catalog poses. All 36 fixed cameras remain available; unrendered optional transforms are not pixel evidence.',notice:'Frozen before/after source geometry. Static offline CPU rendering, approximate light/material response. No driver, vehicle, HUD, gameplay, GPU or performance claim. Normal shared-chase, forward driver-height and authored landmark-directed road-eye views are explicitly distinct.',baselineSourceCommit:commit,baselineSourceTree:publicTree,baselineManifestSha256:hash('docs/workshop-preview-provenance.json'),render:common.render,lighting:{worldColorHex:data.theme.sky,worldStrength:.7,sunEulerRadians:[-35*Math.PI/180,0,-16*Math.PI/180],sunEnergy:2.25,sunAngleRadians:.09,sunColorLinear:[1,.945,.83]},views,catalogViews,baselineGeometryContract:{geometryJsonSha256:hash(join(baseline,'workshop-geometry.json')),glbSha256:hash(join(baseline,'workshop-original-scene.glb')),sourceHashes:data.sourceHashes,scenerySnapshot:'docs/scene-baselines/workshop-scenery.ts.txt',additionalProtectedSourceHashes}},null,2)+'\n');
console.log('Frozen Workshop cameras:',views.length+catalogViews.length,'public baseline:',commit);
