import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {airfieldFrozenBaseline,assertAirfieldOriginalComponents} from './helpers/airfield-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,supportCoverage,prismIntersection,coincidentOutwardPolygon,type V} from './helpers/emitted-scene-oracle';
import {airfieldPairIntrusion,airfieldSignedVolume,airfieldCoflushChecks} from './helpers/airfield-enrichment-solids';
const tri=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Airfield certified-original projection rejects changed,removed,reordered and shortened original records',()=>{
 const old=airfieldFrozenBaseline(),original=old.components,index=original.findIndex(c=>!['connected-contour-ochre-heightfield','connected-contour-sage-heightfield','connected-contour-clay-heightfield'].includes(c.kind));assert.ok(index>=0);assert.equal(assertAirfieldOriginalComponents(original,old).length,1585);
 for(const field of ['kind','role','landmark','batch','vertexStart','vertexEnd','indexStart','indexEnd'] as const){const changed=structuredClone(original);(changed[index] as any)[field]=typeof changed[index][field]==='number'?(changed[index][field] as number)+1:'mutation';assert.throws(()=>assertAirfieldOriginalComponents(changed,old),undefined,field+' mutation must fail');}
 const removed=structuredClone(original);removed.splice(index,1);assert.throws(()=>assertAirfieldOriginalComponents(removed,old));
 const reordered=structuredClone(original);[reordered[index],reordered[index+1]]=[reordered[index+1],reordered[index]];assert.throws(()=>assertAirfieldOriginalComponents(reordered,old));
});
test('Airfield full-footprint support rejects missing corners and floating broad caps',()=>{
 const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]],positions=[0,0,0,4,0,0,0,0,4,4,0,4],full=new MeshOracle([{name:'terrain',positions,indices:[0,2,1,1,2,3]}]),half=new MeshOracle([{name:'terrain',positions,indices:[0,2,1]}]);
 assert.ok(supportCoverage(full,footprint,()=>true).uncovered<1e-8);assert.ok(supportCoverage(half,footprint,()=>true).uncovered>7.99);
 const floating=footprint.map(p=>[p[0],.026,p[2]]);assert.equal(supportCoverage(full,floating,(q,p)=>p.every(v=>Math.abs(v[1])<=.025)).uncovered,16,'A broad cap above original .025m tolerance has no support');
 assert.ok(area3D(prismIntersection(tri([1,.2,0,1,3,0,1,.2,3]),full.triangles[0],.15,3.2))>0,'Exactly vertical face intrudes into full kart prism');
});
test('Airfield indexed ownership and closed-solid proof reject missing owners,slits,reversal and buried pieces',()=>{
 const batches:LandMeshBatch[]=[],records:any[]=[];
 const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const c={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const body=box('body',[0,0,0],[2,2,2]),cap=box('cap',[0,2,0],[2,2,2]),buried=box('buried',[0,0,0],[.2,.2,.2]),floating=box('floating',[5,3,0],[2,2,2]);const mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(parts.closedShell(body));assert.ok(airfieldSignedVolume(parts.triangles.get(body)!)>0);assert.ok(parts.contact(body,cap,.025));assert.equal(airfieldPairIntrusion(parts,body,cap),null);assert.ok(airfieldPairIntrusion(parts,body,buried));assert.equal(parts.contact(body,floating,.025),false);
 assert.throws(()=>new ComponentOracle(mesh,records.slice(1)));assert.throws(()=>new ComponentOracle(mesh,[...records,{...body}]));
 const broken=batches.map(b=>({...b,indices:b.name==='body'?b.indices.slice(3):b.indices})),brokenRecords=records.map(p=>p===body?{...p,indexStart:0,indexEnd:p.indexEnd-3}:p),brokenParts=new ComponentOracle(new MeshOracle(broken),brokenRecords);assert.equal(brokenParts.closedShell(brokenRecords[0]),false,'Open slit cannot be accepted as solid');
 assert.ok(airfieldSignedVolume(parts.triangles.get(body)!.map(q=>({...q,b:q.c,c:q.b})))<0,'Inward shell fails positive volume');
});
test('Airfield exposed duplicate skins remain failures across materials',()=>{
 const a=tri([0,0,0,4,0,0,0,0,4],'airfield'),b=tri([0,0,0,4,0,0,0,0,4],'slate');assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>1);assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null);
 const batches=[{name:'airfield',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]},{name:'slate',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}],records=batches.map(b=>({kind:b.name,batch:b.name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false})),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);assert.equal(airfieldCoflushChecks(mesh,parts,new Set(records),new Set()).exposed.length,1);
});
test('Airfield local camera oracle detects thin faces,opposite winding and under-terrain paths while preserving true openings',async()=>{
 const {inspectAirfieldBoom}=await import('./helpers/airfield-enrichment-camera-checks');
 const wall=new MeshOracle([{name:'wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]);let failures:any[]=[];inspectAirfieldBoom(wall,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);failures=[];inspectAirfieldBoom(wall,[-.299,0,0],[-.299,0,0],w=>failures.push(w));assert.equal(failures.length,1,'Entire .3m safety margin includes zero-length poses');
 const reversed=new MeshOracle([{name:'reverse wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,2,1]}]);failures=[];inspectAirfieldBoom(reversed,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);
 const hole=new MeshOracle([{name:'real face',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]);failures=[];inspectAirfieldBoom(hole,[8,-1,8],[8,1,8],w=>failures.push(w));assert.equal(failures.length,0,'A whole AABB would incorrectly fill this real opening');
 for(const name of ['Airfield connected dry ochre uplands','Airfield connected muted sage banks','Airfield connected warm clay contours']){const terrain=new MeshOracle([{name,positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]);failures=[];inspectAirfieldBoom(terrain,[-.1,0,0],[.1,0,0],w=>failures.push(w));assert.ok(failures.some(w=>w.kind==='below-terrain'&&w.gap===-10),name+' actual source terrain underpass is blocked');}
});
test('Airfield whole roof bearing rejects an omitted seat corner and a lifted underside',async()=>{
 const {airfieldRoofBearing,assertAirfieldOpaquePayload}=await import('./helpers/airfield-enrichment-assemblies');
 const batch=new LandMeshBatch('seat-mutation','#ffffff'),records:any[]=[];
 const box=(kind:string,p:number[],size:number[])=>{const vertexStart=batch.positions.length/3,indexStart=batch.indices.length;batch.box(new pc.Vec3(...p),new pc.Vec3(...size));const c={kind,batch:batch.name,vertexStart,vertexEnd:batch.positions.length/3,indexStart,indexEnd:batch.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const seat=box('seat',[0,0,0],[4,2,4]),roof=box('roof',[0,2,0],[4,2,4]),mesh=new MeshOracle([batch]),parts=new ComponentOracle(mesh,records);assert.equal(airfieldRoofBearing(mesh,parts,roof,[seat]).projectedArea,16);
 const cut={...batch,indices:batch.indices.slice()},faces=parts.triangles.get(roof)!.filter(q=>q.a[1]===1&&q.b[1]===1&&q.c[1]===1);assert.equal(faces.length,2);cut.indices.splice(faces[0].indexStart!,3);const shortened={...roof,indexEnd:roof.indexEnd-3},cutMesh=new MeshOracle([cut]),cutParts=new ComponentOracle(cutMesh,[seat,shortened]);assert.throws(()=>airfieldRoofBearing(cutMesh,cutParts,shortened,[seat]),undefined,'Missing actual underside triangle exposes a seat corner');
 const lifted={...batch,positions:[...batch.positions]};for(let i=roof.vertexStart*3+1;i<roof.vertexEnd*3;i+=3)lifted.positions[i]+=.026;const liftedMesh=new MeshOracle([lifted]),liftedParts=new ComponentOracle(liftedMesh,records);assert.throws(()=>airfieldRoofBearing(liftedMesh,liftedParts,roof,[seat]));
 const opaque=parts.triangles.get(roof)!.map(q=>[q.a,q.b,q.c]),bounds={min:[-2,1,-2],max:[2,3,2]};assertAirfieldOpaquePayload(opaque,{...bounds,triangles:opaque});assert.throws(()=>assertAirfieldOpaquePayload(opaque,{...bounds,triangles:opaque.slice(1)}),'Omitted camera wall must fail');
});

test('Airfield literal architectural opening sentinel rejects an actual inserted opaque face',async()=>{
 const {inspectAirfieldBoom}=await import('./helpers/airfield-enrichment-camera-checks');
 const open=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]),filled=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]},{name:'illegal-opening-fill',positions:[7,0,7,10,0,7,7,0,10],indices:[0,1,2]}]);
 let clear:any[]=[];inspectAirfieldBoom(open,[8,-1,8],[8,1,8],w=>clear.push(w));assert.equal(clear.length,0);let blocked:any[]=[];inspectAirfieldBoom(filled,[8,-1,8],[8,1,8],w=>blocked.push(w));assert.ok(blocked.length>0,'An inserted actual face closes the literal opening');
});

test('Airfield multi-material shell union rejects removed and reversed patches without a convex proxy',()=>{
 const b=new LandMeshBatch('leaf-shell-sentinel','#ffffff');b.box(new pc.Vec3(0,0,0),new pc.Vec3(3,.18,6));
 const shells=(mutate:'none'|'removed'|'reversed')=>{
  const batches=Array.from({length:3},(_,i)=>({name:'material-'+i,positions:[...b.positions],indices:b.indices.slice(i*12,(i+1)*12)}));
  if(mutate==='removed')batches[1].indices.splice(0,3);
  if(mutate==='reversed')for(let i=0;i<batches[1].indices.length;i+=3)[batches[1].indices[i+1],batches[1].indices[i+2]]=[batches[1].indices[i+2],batches[1].indices[i+1]];
  const mesh=new MeshOracle(batches),records=batches.map(v=>({kind:v.name,batch:v.name,vertexStart:0,vertexEnd:v.positions.length/3,indexStart:0,indexEnd:v.indices.length,role:'sentinel',solid:false})),parts=new ComponentOracle(mesh,records),union={...records[0],kind:'literal-three-material-shell'};
  parts.triangles.set(union,mesh.triangles);return{parts,union,mesh};
 };
 const valid=shells('none');assert.ok(valid.parts.closedShell(valid.union));assert.ok(airfieldSignedVolume(valid.mesh.triangles)>0);
 for(const mutation of ['removed','reversed'] as const){const invalid=shells(mutation);assert.equal(invalid.parts.closedShell(invalid.union),false,mutation+' actual indexed patch cannot become closed through grouping');}
});

test('Airfield complete aperture rejects an off-axis wall missed by its central ray',async()=>{
 const {airfieldOpeningVolume}=await import('./helpers/airfield-enrichment-assemblies');
 const corners=[[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2],[-2,4,-2],[2,4,-2],[2,4,2],[-2,4,2]];
 const data=[{name:'off-axis-opaque-wall',positions:[1,1,-1,1,3,-1,1,2,1],indices:[0,1,2]}],mesh=new MeshOracle(data),parts=new ComponentOracle(mesh,[{kind:data[0].name,batch:data[0].name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false}]);
 assert.equal(mesh.firstHit([0,2,-2],[0,2,2]),null);assert.throws(()=>airfieldOpeningVolume(mesh,parts,corners),undefined,'Whole aperture catches side intrusion');
 const empty=new MeshOracle([]),noParts=new ComponentOracle(empty,[]);assert.equal(airfieldOpeningVolume(empty,noParts,corners).candidates,0);
});

test('Airfield buried-joint proof rejects real overlap outside a shared support and certifies only complete coverage',async()=>{
 const {airfieldBuriedConvexJoin}=await import('./helpers/airfield-enrichment-assemblies');
 const batches:any[]=[],records:any[]=[];const box=(name:string,p:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...p),new pc.Vec3(...size));batches.push(b);const part={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(part);return part;};
 const a=box('first-overlapping-shell',[-.5,1,0],[2,2,2]),b=box('second-overlapping-shell',[.5,1,0],[2,2,2]),cover=box('complete-bearing',[0,1,0],[1.2,2.2,2.2]),small=box('incomplete-bearing',[0,1,0],[.3,2.2,2.2]),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(airfieldPairIntrusion(parts,a,b));assert.ok(airfieldBuriedConvexJoin(parts,a,b,cover));const failures:any[]=[];assert.equal(airfieldBuriedConvexJoin(parts,a,b,small,w=>failures.push(w)),null);assert.ok(failures.length&&failures[0].outsideSupportMetres>0,'Actual overlap beyond support is never waived for siblings');
});


test('Airfield certified original assembly counts reject omitted,reordered,modified and reowned records',async()=>{
 const {airfieldOriginalAssemblyFixture,assertAirfieldOriginalAssemblyRecords}=await import('./helpers/airfield-enrichment-original-assemblies'),original=airfieldOriginalAssemblyFixture(),components=airfieldFrozenBaseline().components;
 assert.equal(assertAirfieldOriginalAssemblyRecords(original,components).length,16);
 const removed=structuredClone(original);removed.splice(3,1);assert.throws(()=>assertAirfieldOriginalAssemblyRecords(removed,components));
 const reordered=structuredClone(original);[reordered[2],reordered[3]]=[reordered[3],reordered[2]];assert.throws(()=>assertAirfieldOriginalAssemblyRecords(reordered,components));
 const modified=structuredClone(original);modified[2].id+='-changed';assert.throws(()=>assertAirfieldOriginalAssemblyRecords(modified,components));
 const reowned=structuredClone(original);reowned[2].components[0]=reowned[3].components[0];assert.throws(()=>assertAirfieldOriginalAssemblyRecords(reowned,components));
 assert.throws(()=>assertAirfieldOriginalAssemblyRecords([...original,{...original[0],id:'new-illegal-owner'}],components));
});

test('Airfield complete planar hub and blade-root bearings reject partial seats and reversed contact faces',async()=>{
 const {airfieldPlaneBearing}=await import('./helpers/airfield-enrichment-assemblies');
 const make=(width:number)=>{const batches:LandMeshBatch[]=[],records:any[]=[];const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#fff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const c={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(c);return c;};const hub=box('hub',[0,0,0],[2,2,2]),stand=box('stand',[0,0,2],[width,2,2]),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);return{parts,hub,stand};};
 const full=make(2);assert.equal(airfieldPlaneBearing(full.parts,full.hub,full.stand,2).area,4);const partial=make(1);assert.throws(()=>airfieldPlaneBearing(partial.parts,partial.hub,partial.stand,2),undefined,'Partial overlapping cap is not a complete finite bearing');
 const reversed=make(2),faces=reversed.parts.triangles.get(reversed.stand)!;reversed.parts.triangles.set(reversed.stand,faces.map(q=>({...q,b:q.c,c:q.b})));assert.throws(()=>airfieldPlaneBearing(reversed.parts,reversed.hub,reversed.stand,2));
});

test('Airfield whole aperture requires positive real edge margins beyond mere nonintersection',async()=>{
 const {airfieldOpeningVolume}=await import('./helpers/airfield-enrichment-assemblies'),corners=[[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2],[-2,4,-2],[2,4,-2],[2,4,2],[-2,4,2]];
 const at=(x:number)=>{const b={name:'real-wall',positions:[x,0,-2,x,4,-2,x,4,2,x,0,2],indices:[0,1,2,0,2,3]},mesh=new MeshOracle([b]),parts=new ComponentOracle(mesh,[{kind:b.name,batch:b.name,vertexStart:0,vertexEnd:4,indexStart:0,indexEnd:6,role:'sentinel',solid:false}]);return{mesh,parts};};
 const touches=at(2),near=at(2.05),clear=at(2.2);assert.throws(()=>airfieldOpeningVolume(touches.mesh,touches.parts,corners));assert.throws(()=>airfieldOpeningVolume(near.mesh,near.parts,corners));assert.ok(airfieldOpeningVolume(clear.mesh,clear.parts,corners).minimumClearanceMetres>.19);
});
