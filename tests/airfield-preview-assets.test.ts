import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {AIRFIELD_COURSE} from '../src/maps/airfield';
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
test('airfield menu poster derives from current original runtime geometry with both physical branches framed',()=>{
 const p=JSON.parse(readFileSync('docs/airfield-preview-provenance.json','utf8'));
 assert.equal(p.kind,'offline-native-geometry-render');
 assert.match(p.renderer,/No gameplay\/GPU or FPS claim/);
 for(const [path,digest] of Object.entries({...p.sourceHashes,...p.generatorHashes}))assert.equal(sha(path),digest,path);
 assert.ok(p.batches<=24&&p.triangles<110000&&p.vertices<200000);
 assert.deepEqual(Object.keys(p.views).sort(),['airfield-overview','airfield-topdown','airfield-driver-reveal','airfield-hangar-architecture','airfield-rotor-detail'].sort());
 assert.match(p.normalShading.shader,/Backfacing/);
 const architecture=p.views['airfield-hangar-architecture'];
 assert.equal(architecture.opaqueSteelAndLiteralOpenRidgeSlot,true);
 assert.equal(architecture.roofThicknessMetres,.35);assert.deepEqual(architecture.ridgeSlotLateralMetres,[2,8]);
 assert.equal(architecture.heightAboveSampledRoadMetres,1.6);
 assert.ok(Math.min(...architecture.firstPortalScreenBounds.slice(0,2))>=.025&&Math.max(...architecture.firstPortalScreenBounds.slice(2))<=.975);
 for(const view of [architecture,p.views['airfield-driver-reveal']]){
  const road=AIRFIELD_COURSE.edges[view.roadEdge as 'start'|'alley'].sample(view.roadDistanceMetres).p;
  assert.ok(Math.abs(view.cameraPositionBlender[0]-road.x)<1e-4);
  assert.ok(Math.abs(view.cameraPositionBlender[1]+road.z)<1e-4);
  assert.ok(Math.abs(view.cameraPositionBlender[2]-road.y-1.6)<1e-4);
 }
 assert.match(architecture.description,/differ.*gameplay/);
 assert.equal(p.views['airfield-rotor-detail'].originalStaticMechanicalAssembly,true);
 assert.equal(p.views['airfield-topdown'].projection,'ORTHO');
 const topQuaternion=p.views['airfield-topdown'].cameraQuaternionBlender;
 // A roll around the viewing axis does not change a genuine downward camera.
 assert.ok(topQuaternion.length===4&&topQuaternion.every(Number.isFinite));
 assert.ok(Math.abs(topQuaternion[1])<1e-6&&Math.abs(topQuaternion[2])<1e-6);
 assert.ok(Math.abs(topQuaternion[0]**2+topQuaternion[3]**2-1)<1e-6);
 const driver=p.views['airfield-driver-reveal'];
 assert.equal(driver.roadEdge,'start');assert.equal(driver.roadDistanceMetres,AIRFIELD_COURSE.commonStart.length*.10);assert.equal(driver.heightAboveSampledRoadMetres,1.6);
 assert.deepEqual(driver.lookTargetSourceCoordinates,driver.sourceSightline.target);
 assert.equal(driver.sourceSightline.targetId,'twinboom-courier');
 assert.equal(p.menuAsset.file,'public/map-previews/airfield.webp');
 const image=readFileSync(p.menuAsset.file);
 assert.equal(sha(p.menuAsset.file),p.menuAsset.sha256);
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
 assert.equal(image.readUInt16LE(26)&0x3fff,1280);assert.equal(image.readUInt16LE(28)&0x3fff,720);
 assert.ok(image.length>10000&&image.length<500000);
 for(const key of ['airfield-overview','airfield-topdown']){
  const bounds=p.views[key].routeScreenBounds;
  assert.equal(bounds.length,4);assert.ok(bounds.every(Number.isFinite));
  assert.ok(Math.min(...bounds.slice(0,2))>=.059&&Math.max(...bounds.slice(2))<=.941,key);
  for(const edge of ['alley','boulevard']){const b=p.views[key].physicalBranchScreenBounds[edge];assert.equal(b.length,4);assert.ok(b.every(Number.isFinite));assert.ok(Math.min(...b.slice(0,2))>=.059&&Math.max(...b.slice(2))<=.941,`${key}:${edge}`);}
 }
 assert.ok(AIRFIELD_COURSE.edges.alley.length<AIRFIELD_COURSE.edges.boulevard.length);
 assert.ok(p.sourceHashes['src/airfield-scenery.ts']);assert.ok(p.sourceHashes['src/maps/airfield.ts']);
});
