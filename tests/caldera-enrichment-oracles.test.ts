import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {calderaFrozenBaseline,assertCalderaOriginalComponents} from './helpers/caldera-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,supportCoverage,prismIntersection,coincidentOutwardPolygon,type V} from './helpers/emitted-scene-oracle';
import {calderaPairIntrusion,calderaSignedVolume,calderaCoflushChecks} from './helpers/caldera-enrichment-solids';
const tri=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Caldera certified-original projection rejects changed,removed,reordered and shortened original records',()=>{
 const old=calderaFrozenBaseline(),original=old.components,index=original.findIndex(c=>!['connected-contour-basalt-heightfield','connected-contour-ash-heightfield'].includes(c.kind));assert.ok(index>=0);assert.equal(assertCalderaOriginalComponents(original,old).length,2715);
 for(const field of ['kind','role','landmark','batch','vertexStart','vertexEnd','indexStart','indexEnd'] as const){const changed=structuredClone(original);(changed[index] as any)[field]=typeof changed[index][field]==='number'?(changed[index][field] as number)+1:'mutation';assert.throws(()=>assertCalderaOriginalComponents(changed,old),undefined,field+' mutation must fail');}
 const removed=structuredClone(original);removed.splice(index,1);assert.throws(()=>assertCalderaOriginalComponents(removed,old));
 const reordered=structuredClone(original);[reordered[index],reordered[index+1]]=[reordered[index+1],reordered[index]];assert.throws(()=>assertCalderaOriginalComponents(reordered,old));
});
test('Caldera full-footprint support rejects missing corners and floating broad caps',()=>{
 const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]],positions=[0,0,0,4,0,0,0,0,4,4,0,4],full=new MeshOracle([{name:'terrain',positions,indices:[0,2,1,1,2,3]}]),half=new MeshOracle([{name:'terrain',positions,indices:[0,2,1]}]);
 assert.ok(supportCoverage(full,footprint,()=>true).uncovered<1e-8);assert.ok(supportCoverage(half,footprint,()=>true).uncovered>7.99);
 const floating=footprint.map(p=>[p[0],.026,p[2]]);assert.equal(supportCoverage(full,floating,(q,p)=>p.every(v=>Math.abs(v[1])<=.025)).uncovered,16,'A broad cap above original .025m tolerance has no support');
 assert.ok(area3D(prismIntersection(tri([1,.2,0,1,3,0,1,.2,3]),full.triangles[0],.15,3.2))>0,'Exactly vertical face intrudes into full kart prism');
});
test('Caldera indexed ownership and closed-solid proof reject missing owners,slits,reversal and buried pieces',()=>{
 const batches:LandMeshBatch[]=[],records:any[]=[];
 const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const c={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const body=box('body',[0,0,0],[2,2,2]),cap=box('cap',[0,2,0],[2,2,2]),buried=box('buried',[0,0,0],[.2,.2,.2]),floating=box('floating',[5,3,0],[2,2,2]);const mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(parts.closedShell(body));assert.ok(calderaSignedVolume(parts.triangles.get(body)!)>0);assert.ok(parts.contact(body,cap,.025));assert.equal(calderaPairIntrusion(parts,body,cap),null);assert.ok(calderaPairIntrusion(parts,body,buried));assert.equal(parts.contact(body,floating,.025),false);
 assert.throws(()=>new ComponentOracle(mesh,records.slice(1)));assert.throws(()=>new ComponentOracle(mesh,[...records,{...body}]));
 const broken=batches.map(b=>({...b,indices:b.name==='body'?b.indices.slice(3):b.indices})),brokenRecords=records.map(p=>p===body?{...p,indexStart:0,indexEnd:p.indexEnd-3}:p),brokenParts=new ComponentOracle(new MeshOracle(broken),brokenRecords);assert.equal(brokenParts.closedShell(brokenRecords[0]),false,'Open slit cannot be accepted as solid');
 assert.ok(calderaSignedVolume(parts.triangles.get(body)!.map(q=>({...q,b:q.c,c:q.b})))<0,'Inward shell fails positive volume');
});
test('Caldera exposed duplicate skins remain failures across materials',()=>{
 const a=tri([0,0,0,4,0,0,0,0,4],'caldera'),b=tri([0,0,0,4,0,0,0,0,4],'slate');assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>1);assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null);
 const batches=[{name:'caldera',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]},{name:'slate',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}],records=batches.map(b=>({kind:b.name,batch:b.name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false})),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);assert.equal(calderaCoflushChecks(mesh,parts,new Set(records),new Set()).exposed.length,1);
});
test('Caldera local camera oracle detects thin faces,opposite winding and under-terrain paths while preserving true openings',async()=>{
 const {inspectCalderaBoom}=await import('./helpers/caldera-enrichment-camera-checks');
 const wall=new MeshOracle([{name:'wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]);let failures:any[]=[];inspectCalderaBoom(wall,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);failures=[];inspectCalderaBoom(wall,[-.299,0,0],[-.299,0,0],w=>failures.push(w));assert.equal(failures.length,1,'Entire .3m safety margin includes zero-length poses');
 const reversed=new MeshOracle([{name:'reverse wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,2,1]}]);failures=[];inspectCalderaBoom(reversed,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);
 const hole=new MeshOracle([{name:'real face',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]);failures=[];inspectCalderaBoom(hole,[8,-1,8],[8,1,8],w=>failures.push(w));assert.equal(failures.length,0,'A whole AABB would incorrectly fill this real opening');
 for(const name of ['Caldera connected dark basalt rim','Caldera connected cooled ash terraces']){const terrain=new MeshOracle([{name,positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]);failures=[];inspectCalderaBoom(terrain,[-.1,0,0],[.1,0,0],w=>failures.push(w));assert.ok(failures.some(w=>w.kind==='below-terrain'&&w.gap===-10),name+' actual source terrain underpass is blocked');}
});
test('Caldera whole roof bearing rejects an omitted seat corner and a lifted underside',async()=>{
 const {calderaRoofBearing,assertCalderaOpaquePayload}=await import('./helpers/caldera-enrichment-assemblies');
 const batch=new LandMeshBatch('seat-mutation','#ffffff'),records:any[]=[];
 const box=(kind:string,p:number[],size:number[])=>{const vertexStart=batch.positions.length/3,indexStart=batch.indices.length;batch.box(new pc.Vec3(...p),new pc.Vec3(...size));const c={kind,batch:batch.name,vertexStart,vertexEnd:batch.positions.length/3,indexStart,indexEnd:batch.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const seat=box('seat',[0,0,0],[4,2,4]),roof=box('roof',[0,2,0],[4,2,4]),mesh=new MeshOracle([batch]),parts=new ComponentOracle(mesh,records);assert.equal(calderaRoofBearing(mesh,parts,roof,[seat]).projectedArea,16);
 const cut={...batch,indices:batch.indices.slice()},faces=parts.triangles.get(roof)!.filter(q=>q.a[1]===1&&q.b[1]===1&&q.c[1]===1);assert.equal(faces.length,2);cut.indices.splice(faces[0].indexStart!,3);const shortened={...roof,indexEnd:roof.indexEnd-3},cutMesh=new MeshOracle([cut]),cutParts=new ComponentOracle(cutMesh,[seat,shortened]);assert.throws(()=>calderaRoofBearing(cutMesh,cutParts,shortened,[seat]),undefined,'Missing actual underside triangle exposes a seat corner');
 const lifted={...batch,positions:[...batch.positions]};for(let i=roof.vertexStart*3+1;i<roof.vertexEnd*3;i+=3)lifted.positions[i]+=.026;const liftedMesh=new MeshOracle([lifted]),liftedParts=new ComponentOracle(liftedMesh,records);assert.throws(()=>calderaRoofBearing(liftedMesh,liftedParts,roof,[seat]));
 const opaque=parts.triangles.get(roof)!.map(q=>[q.a,q.b,q.c]),bounds={min:[-2,1,-2],max:[2,3,2]};assertCalderaOpaquePayload(opaque,{...bounds,triangles:opaque});assert.throws(()=>assertCalderaOpaquePayload(opaque,{...bounds,triangles:opaque.slice(1)}),'Omitted camera wall must fail');
});

test('Caldera literal architectural opening sentinel rejects an actual inserted opaque face',async()=>{
 const {inspectCalderaBoom}=await import('./helpers/caldera-enrichment-camera-checks');
 const open=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]),filled=new MeshOracle([{name:'opening-boundary',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]},{name:'illegal-opening-fill',positions:[7,0,7,10,0,7,7,0,10],indices:[0,1,2]}]);
 let clear:any[]=[];inspectCalderaBoom(open,[8,-1,8],[8,1,8],w=>clear.push(w));assert.equal(clear.length,0);let blocked:any[]=[];inspectCalderaBoom(filled,[8,-1,8],[8,1,8],w=>blocked.push(w));assert.ok(blocked.length>0,'An inserted actual face closes the literal opening');
});
