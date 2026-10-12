import test from 'node:test';
import assert from 'node:assert/strict';
import {harvestParts} from './helpers/harvest-enrichment-contract';
import {harvestCameraOracleSentinels,harvestWitnessKey,inheritedHarvestCameraWitness} from './helpers/harvest-enrichment-camera-oracle';
import {MeshOracle,coincidentOutwardPolygon,area3D,supportCoverage,prismIntersection,type V} from './helpers/emitted-scene-oracle';
test('Harvest indexed agricultural ownership rejects hidden faces and overlapping component claims',()=>{
 const batch={name:'Harvest ripe wheat rows',positions:[0,1,0,1,1,0,0,1,1],indices:[0,1,2],uvs:[0,0,1,0,0,1]},geometry={batches:[batch],components:[]} as any;
 const actual=harvestParts(geometry);assert.equal(actual.length,1);assert.equal(actual[0].kind,'field-surface');assert.equal(actual[0].scope,'field');assert.equal(actual[0].indexEnd,3);
 assert.throws(()=>harvestParts({...geometry,batches:[{...batch,name:'unreviewed decorative batch'}]}),/Unknown unowned emission/);
 assert.throws(()=>harvestParts({...geometry,batches:[{...batch,name:'Harvest pale straw ears and bales'}]}),/Unknown unowned emission/,'New straw bands require explicit component ownership, never anonymous crop exemption');
 const c={kind:'orchard-supported-branch',batch:batch.name,vertexStart:0,vertexEnd:3,min:[0,1,0],max:[1,1,1]};assert.throws(()=>harvestParts({...geometry,components:[c,c]}),/overlapping vertex ownership/);
 assert.throws(()=>harvestParts({...geometry,components:[{...c,vertexEnd:2}]}),/complete component owner/);
 const protectedRoad=harvestParts({...geometry,batches:[{...batch,name:'Harvest packed ochre racing earth'}]});assert.equal(protectedRoad[0].scope,'protected');
});
test('Harvest independent camera math checks whole booms and exact inherited witness identity',()=>{
 harvestCameraOracleSentinels();const a=[0,1,0],b=[10,1,0],key=harvestWitnessKey('fixed','face-clearance','face#0',a,b),old={[key]:.2};assert.ok(inheritedHarvestCameraWitness(false,key,.2,old));assert.ok(!inheritedHarvestCameraWitness(true,key,.2,old));assert.ok(!inheritedHarvestCameraWitness(false,key,.19,old));assert.ok(!inheritedHarvestCameraWitness(false,harvestWitnessKey('fixed','face-clearance','face#1',a,b),.2,old));assert.ok(!inheritedHarvestCameraWitness(false,harvestWitnessKey('fixed','face-clearance','face#0',a,[10,1,.001]),.2,old));
});
test('Harvest all-material skin and full-support oracles cannot be replaced by bounds or midpoint checks',()=>{
 const face=(name:string,positions:number[])=>new MeshOracle([{name,positions,indices:[0,1,2]}]).triangles[0],a=face('crop',[0,0,0,4,0,0,0,0,4]),b=face('limestone',[0,0,0,4,0,0,0,0,4]);assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>0);const upright=face('post',[1,.2,0,1,2,0,1,.2,3]);assert.ok(area3D(prismIntersection(upright,a,.15,2.3))>0);
 const terrain=new MeshOracle([{name:'actual terrain',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}]),foot:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]];assert.ok(supportCoverage(terrain,foot,()=>true).uncovered>7.99);
});

test('Harvest whole-surface support catches interior terrain peaks despite matching outer vertices',async()=>{
 const {wholeSurfaceSupport}=await import('./helpers/harvest-enrichment-surface-support');
 const mesh=new MeshOracle([{name:'support',positions:[0,0,0,4,0,0,4,0,4,0,0,4,2,1,2],indices:[0,4,1,1,4,2,2,4,3,3,4,0]},{name:'flat above corners',positions:[0,.2,0,4,.2,0,4,.2,4,0,.2,4],indices:[0,2,1,0,3,2]}]);
 const ids=new Set(mesh.triangles.filter(q=>q.batch==='support').map(q=>q.id));assert.throws(()=>wholeSurfaceSupport(mesh,mesh.triangles.filter(q=>q.batch==='flat above corners'),ids,.2,.2,'sentinel crop'),/full indexed plane/);
});

test('Harvest actual closed-shell winding rejects an inward side even when all bounds are unchanged',async()=>{
 const {ComponentOracle,convexPlanes}=await import('./helpers/emitted-scene-oracle');
 const positions=[0,0,0,1,0,0,0,1,0,0,0,1],indices=[0,2,1,0,1,3,0,3,2,1,2,3],part={kind:'new closed solid',batch:'new',vertexStart:0,vertexEnd:4,indexStart:0,indexEnd:12,role:'solid'};
 const closed=new ComponentOracle(new MeshOracle([{name:'new',positions,indices}]),[part]);assert.ok(closed.closedShell(part));assert.ok(convexPlanes(closed,part));
 const reversed=[...indices];[reversed[0],reversed[1]]=[reversed[1],reversed[0]];const malformed=new ComponentOracle(new MeshOracle([{name:'new',positions,indices:reversed}]),[part]);assert.deepEqual(closed.bounds.get(part),malformed.bounds.get(part));assert.ok(!malformed.closedShell(part));assert.equal(convexPlanes(malformed,part),null);
});

test('Harvest full crop exclusion catches crossing and enclosing faces with all vertices outside',async()=>{
 const {triangleTouchesFootprint}=await import('./helpers/harvest-enrichment-surface-support'),foot:V[]=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1]],face=(positions:number[])=>new MeshOracle([{name:'crop',positions,indices:[0,1,2]}]).triangles[0];
 assert.ok(triangleTouchesFootprint(face([-10,1,-10,10,1,-10,0,1,10]),foot),'Containing projected triangle');
 assert.ok(triangleTouchesFootprint(face([-3,0,0,3,0,0,3,2,0]),foot),'Exactly vertical crossing triangle');
 assert.ok(!triangleTouchesFootprint(face([-3,0,3,3,0,3,3,2,3]),foot),'Disjoint vertical triangle remains outside');
});

test('Harvest farm metadata cannot relabel seated masses or remove declared support owners',async()=>{
 const {harvestFarmRecipe,assertHarvestFarmRecipe}=await import('./helpers/harvest-enrichment-assemblies');
 for(const id of ['mill-shelter','silo-loading','orchard-hay-yard','contour-hay-yard'])assertHarvestFarmRecipe(id,harvestFarmRecipe(id));
 const renamed=harvestFarmRecipe('orchard-hay-yard');renamed.find(p=>p.id.endsWith('/middle-bale-0'))!.role='load-bearing-frame';assert.throws(()=>assertHarvestFarmRecipe('orchard-hay-yard',renamed),/independent reviewed recipe/);
 const omitted=harvestFarmRecipe('mill-shelter');omitted.find(p=>p.id.endsWith('/supported-ridge'))!.supportOwner.pop();assert.throws(()=>assertHarvestFarmRecipe('mill-shelter',omitted),/independent reviewed recipe/);
});
