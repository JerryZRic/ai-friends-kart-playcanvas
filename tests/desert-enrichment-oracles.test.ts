import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {MeshOracle,ComponentOracle,area3D,prismIntersection,supportCoverage,coincidentOutwardPolygon,type V} from './helpers/emitted-scene-oracle';
import {desertPairIntrusion,desertSignedVolume,desertCoflushChecks} from './helpers/desert-enrichment-solids';
import {inspectDesertBoom} from './helpers/desert-enrichment-camera-checks';
import {desertOpposingContactArea} from './helpers/desert-enrichment-assemblies';
const tri=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Desert support proof uses the full union of actual terrain triangles and detects unsupported corners',()=>{
 const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]],positions=[0,0,0,4,0,0,0,0,4,4,0,4],full=new MeshOracle([{name:'terrain',positions,indices:[0,2,1,1,2,3]}]),half=new MeshOracle([{name:'terrain',positions,indices:[0,2,1]}]);
 assert.ok(supportCoverage(full,footprint,()=>true).uncovered<1e-8);assert.ok(supportCoverage(half,footprint,()=>true).uncovered>7.99);
 const wall=tri([1,.2,0,1,3,0,1,.2,3]);assert.ok(area3D(prismIntersection(wall,full.triangles[0],.15,3.2))>0,'Exactly vertical wall intrudes into full kart prism');
});
test('Desert indexed-solid oracle separates support contact from thin crossing and nested positive volumes',()=>{
 const batches:LandMeshBatch[]=[],provenance:any[]=[];
 const box=(name:string,center:number[],size:number[])=>{const b=new LandMeshBatch(name,'#ffffff');b.box(new pc.Vec3(...center),new pc.Vec3(...size));batches.push(b);const p={kind:name,batch:name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'test',solid:true};provenance.push(p);return p;};
 const a=box('west',[0,0,0],[2,2,2]),b=box('seated',[0,2,0],[2,2,2]),c=box('nested',[0,0,0],[.2,.2,.2]),d=box('thin-horizontal',[5,0,0],[4,.1,.1]),e=box('thin-vertical',[5,0,0],[.1,4,.1]),edgeOnly=box('edge-only',[2,2,0],[2,2,2]);
 const mesh=new MeshOracle(batches),parts=new ComponentOracle(mesh,provenance);
 assert.ok(parts.closedShell(a));assert.ok(desertSignedVolume(parts.triangles.get(a)!)>0);assert.ok(parts.contact(a,b));assert.equal(desertPairIntrusion(parts,a,b),null);assert.ok(desertPairIntrusion(parts,a,c));assert.ok(desertPairIntrusion(parts,d,e));
 assert.ok(desertOpposingContactArea(parts,a,b)>3.99);assert.ok(parts.contact(a,edgeOnly));assert.equal(desertOpposingContactArea(parts,a,edgeOnly),0,'Geometric edge contact is insufficient as a load-bearing seat');
 const reversed=parts.triangles.get(a)!.map(q=>({...q,b:q.c,c:q.b}));assert.ok(desertSignedVolume(reversed)<0,'Reversed shell must fail outward volume');
});
test('Desert duplicate skins count across materials while real opposite-facing supports stay distinguishable',()=>{
 const a=tri([0,0,0,4,0,0,0,0,4],'sandstone'),b=tri([0,0,0,4,0,0,0,0,4],'pale-strata');assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>1);assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null);
});
test('Desert strict camera oracle sees thin interior spikes, opposite winding and actual voids',()=>{
 const mesh=new MeshOracle([{name:'wall',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]);let failures:any[]=[];inspectDesertBoom(mesh,[-1,0,0],[1,0,0],w=>failures.push(w));assert.equal(failures.length,1);failures=[];inspectDesertBoom(mesh,[-.299,0,0],[-.299,0,0],w=>failures.push(w));assert.equal(failures.length,1);
 const voidMesh=new MeshOracle([{name:'real triangle',positions:[0,0,0,10,0,0,0,0,10],indices:[0,1,2]}]);failures=[];inspectDesertBoom(voidMesh,[8,-1,8],[8,1,8],w=>failures.push(w));assert.equal(failures.length,0,'Filled AABB would incorrectly obstruct the triangle void');
 const above=new MeshOracle([{name:'Desert connected sculpted dune terrain',positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]);failures=[];inspectDesertBoom(above,[-.1,0,0],[.1,0,0],w=>failures.push(w));assert.ok(failures.some(w=>w.kind==='below-terrain'&&w.gap===-10));
});
