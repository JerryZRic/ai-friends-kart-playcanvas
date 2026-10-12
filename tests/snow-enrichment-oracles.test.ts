import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {snowFrozenBaseline,assertSnowOriginalComponents} from './helpers/snow-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,supportCoverage,prismIntersection,coincidentOutwardPolygon,type V} from './helpers/emitted-scene-oracle';
import {snowPairIntrusion,snowSignedVolume,snowCoflushChecks} from './helpers/snow-enrichment-solids';
const tri=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Snow certified-original projection rejects changed,removed,reordered and shortened original non-macro records',()=>{
 const old=snowFrozenBaseline(),original=old.components,index=original.findIndex(c=>!['connected-snow-bowl-heightfield','connected-slate-exposures-heightfield'].includes(c.kind));assert.ok(index>=0);assert.equal(assertSnowOriginalComponents(original,old).length,6339);
 for(const field of ['kind','role','landmark','batch','vertexStart','vertexEnd','indexStart','indexEnd'] as const){const changed=structuredClone(original);(changed[index] as any)[field]=typeof changed[index][field]==='number'?(changed[index][field] as number)+1:'mutation';assert.throws(()=>assertSnowOriginalComponents(changed,old),undefined,field+' mutation must fail');}
 const removed=structuredClone(original);removed.splice(index,1);assert.throws(()=>assertSnowOriginalComponents(removed,old));
 const reordered=structuredClone(original);[reordered[index],reordered[index+1]]=[reordered[index+1],reordered[index]];assert.throws(()=>assertSnowOriginalComponents(reordered,old));
});
test('Snow full-footprint support rejects missing corners and floating broad caps',()=>{
 const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]],positions=[0,0,0,4,0,0,0,0,4,4,0,4],full=new MeshOracle([{name:'terrain',positions,indices:[0,2,1,1,2,3]}]),half=new MeshOracle([{name:'terrain',positions,indices:[0,2,1]}]);
 assert.ok(supportCoverage(full,footprint,()=>true).uncovered<1e-8);assert.ok(supportCoverage(half,footprint,()=>true).uncovered>7.99);
 const floating=footprint.map(p=>[p[0],.026,p[2]]);assert.equal(supportCoverage(full,floating,(q,p)=>p.every(v=>Math.abs(v[1])<=.025)).uncovered,16,'A broad cap above original .025m tolerance has no support');
 assert.ok(area3D(prismIntersection(tri([1,.2,0,1,3,0,1,.2,3]),full.triangles[0],.15,3.2))>0,'Exactly vertical face intrudes into full kart prism');
});
test('Snow indexed ownership and closed-solid proof reject missing owners,slits,reversal and buried pieces',()=>{
 const batches:LandMeshBatch[]=[],records:any[]=[];
 const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const c={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'sentinel',solid:true};records.push(c);return c;};
 const body=box('body',[0,0,0],[2,2,2]),cap=box('cap',[0,2,0],[2,2,2]),buried=box('buried',[0,0,0],[.2,.2,.2]),floating=box('floating',[5,3,0],[2,2,2]);const mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);
 assert.ok(parts.closedShell(body));assert.ok(snowSignedVolume(parts.triangles.get(body)!)>0);assert.ok(parts.contact(body,cap,.025));assert.equal(snowPairIntrusion(parts,body,cap),null);assert.ok(snowPairIntrusion(parts,body,buried));assert.equal(parts.contact(body,floating,.025),false);
 assert.throws(()=>new ComponentOracle(mesh,records.slice(1)));assert.throws(()=>new ComponentOracle(mesh,[...records,{...body}]));
 const broken=batches.map(b=>({...b,indices:b.name==='body'?b.indices.slice(3):b.indices})),brokenRecords=records.map(p=>p===body?{...p,indexStart:0,indexEnd:p.indexEnd-3}:p),brokenParts=new ComponentOracle(new MeshOracle(broken),brokenRecords);assert.equal(brokenParts.closedShell(brokenRecords[0]),false,'Open slit cannot be accepted as solid');
 assert.ok(snowSignedVolume(parts.triangles.get(body)!.map(q=>({...q,b:q.c,c:q.b})))<0,'Inward shell fails positive volume');
});
test('Snow exposed duplicate skins remain failures across materials',()=>{
 const a=tri([0,0,0,4,0,0,0,0,4],'snow'),b=tri([0,0,0,4,0,0,0,0,4],'slate');assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>1);assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null);
 const batches=[{name:'snow',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]},{name:'slate',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}],records=batches.map(b=>({kind:b.name,batch:b.name,vertexStart:0,vertexEnd:3,indexStart:0,indexEnd:3,role:'sentinel',solid:false})),mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,records);assert.equal(snowCoflushChecks(mesh,parts,new Set(records),new Set()).exposed.length,1);
});
test('Snow local camera oracle detects thin faces,opposite winding and under-terrain paths while preserving true openings',async()=>{
 const {inspectSnowBoom}=await import('./helpers/snow-enrichment-camera-checks');
 const wall=new MeshOracle([{name:'wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]);let failures:any[]=[];inspectSnowBoom(wall,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);failures=[];inspectSnowBoom(wall,[-.299,0,0],[-.299,0,0],w=>failures.push(w));assert.equal(failures.length,1,'Entire .3m safety margin includes zero-length poses');
 const reversed=new MeshOracle([{name:'reverse wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,2,1]}]);failures=[];inspectSnowBoom(reversed,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);
 const hole=new MeshOracle([{name:'real face',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]);failures=[];inspectSnowBoom(hole,[8,-1,8],[8,1,8],w=>failures.push(w));assert.equal(failures.length,0,'A whole AABB would incorrectly fill this real opening');
 for(const name of ['Snow connected wind sculpted terrain','Snow connected blue slate ribs']){const terrain=new MeshOracle([{name,positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]);failures=[];inspectSnowBoom(terrain,[-.1,0,0],[.1,0,0],w=>failures.push(w));assert.ok(failures.some(w=>w.kind==='below-terrain'&&w.gap===-10),name+' actual source terrain underpass is blocked');}
});
