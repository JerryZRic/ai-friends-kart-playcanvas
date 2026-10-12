/** Freeze source-derived before/after cameras before any Harvest scenery edits.
 * Usage: node --import tsx scripts/freeze-harvest-enrichment-cameras.ts BASELINE_DIR LOCAL_COMMIT LAST_VERIFIED_PUBLIC_COMMIT
 * This reads a previously exported unchanged baseline, never candidate geometry.
 * Baseline-source provenance distinguishes the local sealed candidate and last verified public dev head.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import * as pc from 'playcanvas';
import {HARVEST_COURSE} from '../src/maps/harvest.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';

const [directory,commit,publicCommit]=process.argv.slice(2),output='docs/harvest-enrichment-cameras.json';
assert.ok(directory&&/^[0-9a-f]{40}$/.test(commit)&&/^[0-9a-f]{40}$/.test(publicCommit),'Provide baseline directory, local commit and last verified public commit');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Local baseline commit differs');
const localTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
assert.ok(!existsSync(output),'Frozen camera manifest already exists; never silently overwrite it');
const baseline=resolve(directory),sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const hash=(path:string)=>sha(readFileSync(path));
const data=JSON.parse(readFileSync(join(baseline,'harvest-geometry.json'),'utf8'));
const old=JSON.parse(readFileSync('docs/harvest-preview-provenance.json','utf8'));
const protectedFiles=['src/race-camera.ts','src/land-camera.ts','src/game.ts','src/land-driving.ts','src/land-course.ts','src/land-course-pickups.ts','src/land-race-route.ts','src/land-routes.ts','src/race-controls.ts','src/vehicle-controls.js','src/mouse-look.js','src/npc-difficulty.ts','src/npc-tactics.ts','src/maps/harvest.ts'];
const additionalProtectedSourceHashes=Object.fromEntries(protectedFiles.map(path=>[path,hash(path)]));
for(const [path,digest] of Object.entries({...data.sourceHashes,...additionalProtectedSourceHashes})){
  assert.equal(hash(path),digest,'Current source differs from baseline: '+path);
  assert.equal(sha(execFileSync('git',['show','HEAD:'+path])),digest,'Local baseline commit differs: '+path);
}
assert.equal(hash('docs/scene-baselines/harvest-scenery.ts.txt'),data.sourceHashes['src/harvest-scenery.ts']);
const tuple=(p:{x:number;y:number;z:number})=>[p.x,p.y,p.z];
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]);
const settings={projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[960,540],samples:48,renderByDefault:true};
function pose(name:string,eye:number[],target:number[],extra:Record<string,unknown>){
  const position=xyz(eye),matrix=new pc.Mat4().setLookAt(position,xyz(target),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(matrix).normalize();
  return {name,...settings,sourceEye:eye,sourceTarget:target,cameraPositionBlender:position.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),...extra};
}
// Exact source-road stations fixed before art changes; no private planning input.
const stations:{id:string;edge:'start'|'alley'|'boulevard'|'finish';s:number}[]=[
  {
    "id": "launch-fields",
    "edge": "start",
    "s": 100
  },
  {
    "id": "terrace-mill-reveal",
    "edge": "start",
    "s": 334.75895627672134
  },
  {
    "id": "ridge-exterior-fields",
    "edge": "start",
    "s": 600
  },
  {
    "id": "orchard-descent",
    "edge": "start",
    "s": 873.28423376536
  },
  {
    "id": "press-approach",
    "edge": "start",
    "s": 901
  },
  {
    "id": "fork-signs",
    "edge": "start",
    "s": 1310.4737229422667
  },
  {
    "id": "decision-input-zone",
    "edge": "start",
    "s": 1375.4737229422667
  },
  {
    "id": "barn-historical-approach",
    "edge": "alley",
    "s": 94.23489743943789
  },
  {
    "id": "barn-north-portal",
    "edge": "alley",
    "s": 125.11487126700081
  },
  {
    "id": "barn-interior",
    "edge": "alley",
    "s": 157.71487126710332
  },
  {
    "id": "barn-south-exit",
    "edge": "alley",
    "s": 190.31487126720583
  },
  {
    "id": "contour-silo-approach",
    "edge": "boulevard",
    "s": 198
  },
  {
    "id": "granary-return",
    "edge": "finish",
    "s": 146
  },
  {
    "id": "market-home-straight",
    "edge": "finish",
    "s": 391.08262039325814
  },
  {
    "id": "market-late-approach",
    "edge": "finish",
    "s": 379
  }
];
const edges={start:HARVEST_COURSE.commonStart,alley:HARVEST_COURSE.alternates.alley,boulevard:HARVEST_COURSE.alternates.boulevard,finish:HARVEST_COURSE.commonFinish};
const views=stations.map(({id:name,edge:id,s})=>{
  const frame=edges[id].sample(s),desired=chaseCamera({position:frame.p,tangent:frame.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
  const anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles);
  return pose('harvest-chase-'+name,tuple(safe),tuple(desired.look),{roadEdge:id,roadDistanceMetres:s,sourceRoad:frame.p.toArray(),sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),description:'Unchanged shared chaseCamera view=0, center lane, yaw/pitch=0, rearView=false; baseline safeLandCamera against all original scenery. Frozen pose and target, vertical FOV 56 degrees, 16:9. Static offline source geometry only, no gameplay capture.'});
});
for(const station of stations){const e=edges[station.edge],eye=e.sample(station.s).p.clone().add(new pc.Vec3(0,1.6,0)),target=e.sample(Math.min(e.length,station.s+40)).p.clone().add(new pc.Vec3(0,1.6,0));views.push(pose('harvest-road-eye-'+station.id,tuple(eye),tuple(target),{roadEdge:station.edge,roadDistanceMetres:station.s,description:'Forward driver-height view, source road +1.6m looking 40m ahead on the same physical edge. Separate from shared chase and target-facing landmark views.'}) as typeof views[number]);}
for(const sight of data.geometry.sightlines)views.push(pose('harvest-landmark-'+sight.name.replaceAll(' ','-'),sight.eye,sight.target,{description:'Authored landmark-directed road-eye view, source road+1.6m aiming at original emitted landmark target. This is not a shared chase view.',sightlineName:sight.name}) as typeof views[number]);
const catalogViews=Object.entries(old.views).map(([name,value])=>{
  const view=value as Record<string,any>;
  return {name,...view,sensorFit:'HORIZONTAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:view.lensMillimetres??50,clipStart:.1,clipEnd:10000,samples:48,renderByDefault:true,poseSource:'Exact pre-enrichment docs/harvest-preview-provenance.json pose; no refit'};
});
const firstGate=['terrace-mill-reveal','orchard-descent','barn-historical-approach','contour-silo-approach'],additional=['press-approach','barn-interior','fork-signs','granary-return','market-late-approach'];
const wanted=new Set([...firstGate.flatMap(id=>['harvest-chase-'+id,'harvest-road-eye-'+id]),...additional.map(id=>'harvest-chase-'+id)]);
for(const view of views)view.renderByDefault=wanted.has(view.name);
const common=JSON.parse(readFileSync('docs/quarry-enrichment-cameras.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'harvest-frozen-camera-manifest-v1',reviewSelection:'Eight first-gate shared-chase/forward-eye views, five additional district chase views and five original catalog poses. All 39 fixed cameras remain available; unrendered transforms are not pixel evidence.',notice:'Frozen before/after source geometry. Static offline CPU rendering, approximate light/material response. No driver, vehicle, HUD, gameplay, GPU or performance claim. Normal shared-chase, forward driver-height and authored landmark-directed road-eye views are explicitly distinct.',baselineSourceCommit:commit,baselineSourceTree:localTree,lastVerifiedPublicDevCommit:publicCommit,baselineIdentity:'Local sealed Workshop candidate; not published. Harvest source unchanged from last verified public dev commit.',baselineManifestSha256:hash('docs/harvest-preview-provenance.json'),render:common.render,lighting:{worldColorHex:data.theme.sky,worldStrength:.7,sunEulerRadians:[-35*Math.PI/180,0,-16*Math.PI/180],sunEnergy:2.25,sunAngleRadians:.09,sunColorLinear:[1,.945,.83]},views,catalogViews,baselineGeometryContract:{geometryJsonSha256:hash(join(baseline,'harvest-geometry.json')),glbSha256:hash(join(baseline,'harvest-original-scene.glb')),sourceHashes:data.sourceHashes,scenerySnapshot:'docs/scene-baselines/harvest-scenery.ts.txt',additionalProtectedSourceHashes}},null,2)+'\n');
console.log('Frozen Harvest cameras:',views.length+catalogViews.length,'local baseline:',commit);
