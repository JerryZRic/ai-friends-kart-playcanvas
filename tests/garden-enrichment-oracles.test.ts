import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {gardenFrozenBaseline,assertGardenOriginalComponents} from './helpers/garden-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,supportCoverage,prismIntersection,coincidentOutwardPolygon,type V} from './helpers/emitted-scene-oracle';
import {gardenPairIntrusion,gardenSignedVolume,gardenCoflushChecks} from './helpers/garden-enrichment-solids';
const tri=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Garden certified-original projection rejects changed,removed,reordered and shortened original records',()=>{
 const old=gardenFrozenBaseline(),original=old.components,index=original.findIndex(c=>!['connected-contour-meadow-heightfield','connected-contour-fern-heightfield'].includes(c.kind));assert.ok(index>=0);assert.equal(assertGardenOriginalComponents(original,old).length,1813);
 for(const field of ['kind','role','landmark','batch','vertexStart','vertexEnd','indexStart','indexEnd'] as const){const changed=structuredClone(original);(changed[index] as any)[field]=typeof changed[index][field]==='number'?(changed[index][field] as number)+1:'mutation';assert.throws(()=>assertGardenOriginalComponents(changed,old),undefined,field+' mutation must fail');}
 const removed=structuredClone(original);removed.splice(index,1);assert.throws(()=>assertGardenOriginalComponents(removed,old));
 const reordered=structuredClone(original);[reordered[index],reordered[index+1]]=[reordered[index+1],reordered[index]];assert.throws(()=>assertGardenOriginalComponents(reordered,old));
});
test('Garden full-footprint support rejects missing corners and floating broad caps',()=>{
 const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]],positions=[0,0,0,4,0,0,0,0,4,4,0,4],full=new MeshOracle([{name:'terrain',positions,indices:[0,2,1,1,2,3]}]),half=new MeshOracle([{name:'terrain',positions,indices:[0,2,1]}]);
 assert.ok(supportCoverage(full,footprint,()=>true).uncovered<1e-8);assert.ok(supportCoverage(half,footprint,()=>true).uncovered>7.99);
 const floating=footprint.map(p=>[p[0],.026,p[2]]);assert.equal(supportCoverage(full,floating,(q,p)=>p.every(v=>Math.abs(v[1])<=.025)).uncovered,16,'A broad cap above original .025m tolerance has no support');
 assert.ok(area3D(prismIntersection(tri([1,.2,0,1,3,0,1,.2,3]),full.triangles[0],.15,3.2))>0,'Exactly vertical face intrudes into full kart prism');
});
test('Garden indexed ownership and closed-solid proof reject missing owners,slits,reversal and buried pieces',()=>{
 const batches:LandMeshBatch[]=[],records:any[]=[];
 const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const c={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const body=box('body',[0,0,0],[2,2,2]),cap=box('cap',[0,2,0],[2,2,2]),buried=box('buried',[0,0,0],[.2,.2,.2]),floating=box('floating',[5,3,0],[2,2,2]);const mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(parts.closedShell(body));assert.ok(gardenSignedVolume(parts.triangles.get(body)!)>0);assert.ok(parts.contact(body,cap,.025));assert.equal(gardenPairIntrusion(parts,body,cap),null);assert.ok(gardenPairIntrusion(parts,body,buried));assert.equal(parts.contact(body,floating,.025),false);
 assert.throws(()=>new ComponentOracle(mesh,records.slice(1)));assert.throws(()=>new ComponentOracle(mesh,[...records,{...body}]));
 const broken=batches.map(b=>({...b,indices:b.name==='body'?b.indices.slice(3):b.indices})),brokenRecords=records.map(p=>p===body?{...p,indexStart:0,indexEnd:p.indexEnd-3}:p),brokenParts=new ComponentOracle(new MeshOracle(broken),brokenRecords);assert.equal(brokenParts.closedShell(brokenRecords[0]),false,'Open slit cannot be accepted as solid');
 assert.ok(gardenSignedVolume(parts.triangles.get(body)!.map(q=>({...q,b:q.c,c:q.b})))<0,'Inward shell fails positive volume');
});
test('Garden exposed duplicate skins remain failures across materials',()=>{
 const a=tri([0,0,0,4,0,0,0,0,4],'garden'),b=tri([0,0,0,4,0,0,0,0,4],'slate');assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>1);assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null);
 const batches=[{name:'garden',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]},{name:'slate',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}],records=batches.map(b=>({kind:b.name,batch:b.name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false})),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);assert.equal(gardenCoflushChecks(mesh,parts,new Set(records),new Set()).exposed.length,1);
});
test('Garden local camera oracle detects thin faces,opposite winding and under-terrain paths while preserving true openings',async()=>{
 const {inspectGardenBoom}=await import('./helpers/garden-enrichment-camera-checks');
 const wall=new MeshOracle([{name:'wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]);let failures:any[]=[];inspectGardenBoom(wall,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);failures=[];inspectGardenBoom(wall,[-.299,0,0],[-.299,0,0],w=>failures.push(w));assert.equal(failures.length,1,'Entire .3m safety margin includes zero-length poses');
 const reversed=new MeshOracle([{name:'reverse wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,2,1]}]);failures=[];inspectGardenBoom(reversed,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);
 const hole=new MeshOracle([{name:'real face',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]);failures=[];inspectGardenBoom(hole,[8,-1,8],[8,1,8],w=>failures.push(w));assert.equal(failures.length,0,'A whole AABB would incorrectly fill this real opening');
 for(const name of ['Garden connected sunlit meadow','Garden connected deep fern terraces']){const terrain=new MeshOracle([{name,positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]);failures=[];inspectGardenBoom(terrain,[-.1,0,0],[.1,0,0],w=>failures.push(w));assert.ok(failures.some(w=>w.kind==='below-terrain'&&w.gap===-10),name+' actual source terrain underpass is blocked');}
});
test('Garden whole roof bearing rejects an omitted seat corner and a lifted underside',async()=>{
 const {gardenRoofBearing,assertGardenOpaquePayload}=await import('./helpers/garden-enrichment-assemblies');
 const batch=new LandMeshBatch('seat-mutation','#ffffff'),records:any[]=[];
 const box=(kind:string,p:number[],size:number[])=>{const vertexStart=batch.positions.length/3,indexStart=batch.indices.length;batch.box(new pc.Vec3(...p),new pc.Vec3(...size));const c={kind,batch:batch.name,vertexStart,vertexEnd:batch.positions.length/3,indexStart,indexEnd:batch.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const seat=box('seat',[0,0,0],[4,2,4]),roof=box('roof',[0,2,0],[4,2,4]),mesh=new MeshOracle([batch]),parts=new ComponentOracle(mesh,records);assert.equal(gardenRoofBearing(mesh,parts,roof,[seat]).projectedArea,16);
 const cut={...batch,indices:batch.indices.slice()},faces=parts.triangles.get(roof)!.filter(q=>q.a[1]===1&&q.b[1]===1&&q.c[1]===1);assert.equal(faces.length,2);cut.indices.splice(faces[0].indexStart!,3);const shortened={...roof,indexEnd:roof.indexEnd-3},cutMesh=new MeshOracle([cut]),cutParts=new ComponentOracle(cutMesh,[seat,shortened]);assert.throws(()=>gardenRoofBearing(cutMesh,cutParts,shortened,[seat]),undefined,'Missing actual underside triangle exposes a seat corner');
 const lifted={...batch,positions:[...batch.positions]};for(let i=roof.vertexStart*3+1;i<roof.vertexEnd*3;i+=3)lifted.positions[i]+=.026;const liftedMesh=new MeshOracle([lifted]),liftedParts=new ComponentOracle(liftedMesh,records);assert.throws(()=>gardenRoofBearing(liftedMesh,liftedParts,roof,[seat]));
 const opaque=parts.triangles.get(roof)!.map(q=>[q.a,q.b,q.c]),bounds={min:[-2,1,-2],max:[2,3,2]};assertGardenOpaquePayload(opaque,{...bounds,triangles:opaque});assert.throws(()=>assertGardenOpaquePayload(opaque,{...bounds,triangles:opaque.slice(1)}),'Omitted camera wall must fail');
});

test('Garden literal architectural opening sentinel rejects an actual inserted opaque face',async()=>{
 const {inspectGardenBoom}=await import('./helpers/garden-enrichment-camera-checks');
 const open=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]),filled=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]},{name:'illegal-opening-fill',positions:[7,0,7,10,0,7,7,0,10],indices:[0,1,2]}]);
 let clear:any[]=[];inspectGardenBoom(open,[8,-1,8],[8,1,8],w=>clear.push(w));assert.equal(clear.length,0);let blocked:any[]=[];inspectGardenBoom(filled,[8,-1,8],[8,1,8],w=>blocked.push(w));assert.ok(blocked.length>0,'An inserted actual face closes the literal opening');
});

test('Garden multi-material shell union rejects removed and reversed patches without a convex proxy',()=>{
 const b=new LandMeshBatch('leaf-shell-sentinel','#ffffff');b.box(new pc.Vec3(0,0,0),new pc.Vec3(3,.18,6));
 const shells=(mutate:'none'|'removed'|'reversed')=>{
  const batches=Array.from({length:3},(_,i)=>({name:'material-'+i,positions:[...b.positions],indices:b.indices.slice(i*12,(i+1)*12)}));
  if(mutate==='removed')batches[1].indices.splice(0,3);
  if(mutate==='reversed')for(let i=0;i<batches[1].indices.length;i+=3)[batches[1].indices[i+1],batches[1].indices[i+2]]=[batches[1].indices[i+2],batches[1].indices[i+1]];
  const mesh=new MeshOracle(batches),records=batches.map(v=>({kind:v.name,batch:v.name,vertexStart:0,vertexEnd:v.positions.length/3,indexStart:0,indexEnd:v.indices.length,role:'sentinel',solid:false})),parts=new ComponentOracle(mesh,records),union={...records[0],kind:'literal-three-material-shell'};
  parts.triangles.set(union,mesh.triangles);return{parts,union,mesh};
 };
 const valid=shells('none');assert.ok(valid.parts.closedShell(valid.union));assert.ok(gardenSignedVolume(valid.mesh.triangles)>0);
 for(const mutation of ['removed','reversed'] as const){const invalid=shells(mutation);assert.equal(invalid.parts.closedShell(invalid.union),false,mutation+' actual indexed patch cannot become closed through grouping');}
});

test('Garden complete aperture rejects an off-axis wall missed by its central ray',async()=>{
 const {gardenOpeningVolume}=await import('./helpers/garden-enrichment-assemblies');
 const corners=[[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2],[-2,4,-2],[2,4,-2],[2,4,2],[-2,4,2]];
 const data=[{name:'off-axis-opaque-wall',positions:[1,1,-1,1,3,-1,1,2,1],indices:[0,1,2]}],mesh=new MeshOracle(data),parts=new ComponentOracle(mesh,[{kind:data[0].name,batch:data[0].name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false}]);
 assert.equal(mesh.firstHit([0,2,-2],[0,2,2]),null);assert.throws(()=>gardenOpeningVolume(mesh,parts,corners),undefined,'Whole aperture catches side intrusion');
 const empty=new MeshOracle([]),noParts=new ComponentOracle(empty,[]);assert.equal(gardenOpeningVolume(empty,noParts,corners).candidates,0);
});

test('Garden buried-joint proof rejects real overlap outside a shared support and certifies only complete coverage',async()=>{
 const {gardenBuriedConvexJoin}=await import('./helpers/garden-enrichment-assemblies');
 const batches:any[]=[],records:any[]=[];const box=(name:string,p:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...p),new pc.Vec3(...size));batches.push(b);const part={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(part);return part;};
 const a=box('first-overlapping-shell',[-.5,1,0],[2,2,2]),b=box('second-overlapping-shell',[.5,1,0],[2,2,2]),cover=box('complete-bearing',[0,1,0],[1.2,2.2,2.2]),small=box('incomplete-bearing',[0,1,0],[.3,2.2,2.2]),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(gardenPairIntrusion(parts,a,b));assert.ok(gardenBuriedConvexJoin(parts,a,b,cover));const failures:any[]=[];assert.equal(gardenBuriedConvexJoin(parts,a,b,small,w=>failures.push(w)),null);assert.ok(failures.length&&failures[0].outsideSupportMetres>0,'Actual overlap beyond support is never waived for siblings');
});


test('Garden certified original assembly counts reject omitted,reordered,modified and reowned records',async()=>{
 const {gardenOriginalAssemblyFixture,assertGardenOriginalAssemblyRecords}=await import('./helpers/garden-enrichment-original-assemblies'),original=gardenOriginalAssemblyFixture(),components=gardenFrozenBaseline().components;
 assert.equal(assertGardenOriginalAssemblyRecords(original,components).length,118);
 const removed=structuredClone(original);removed.splice(3,1);assert.throws(()=>assertGardenOriginalAssemblyRecords(removed,components));
 const reordered=structuredClone(original);[reordered[2],reordered[3]]=[reordered[3],reordered[2]];assert.throws(()=>assertGardenOriginalAssemblyRecords(reordered,components));
 const modified=structuredClone(original);modified[2].id+='-changed';assert.throws(()=>assertGardenOriginalAssemblyRecords(modified,components));
 const reowned=structuredClone(original);reowned[2].components[0]=reowned[3].components[0];assert.throws(()=>assertGardenOriginalAssemblyRecords(reowned,components));
 assert.throws(()=>assertGardenOriginalAssemblyRecords([...original,{...original[0],id:'new-illegal-owner'}],components));
});
