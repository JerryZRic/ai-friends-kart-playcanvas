import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {LandMeshBatch} from '../src/land-mesh-builder';
import {MeshOracle,ComponentOracle,convexPlanes,subtractConvexSolid,coincidentOutwardPolygon,area3D,prismIntersection,supportCoverage,type V} from './helpers/emitted-scene-oracle';
const triangle=(p:number[],name='sentinel')=>new MeshOracle([{name,positions:p,indices:[0,1,2]}]).triangles[0];
test('Workshop architectural source oracles reject cross-material coflush skins and vertical driving-prism intrusions',()=>{
 const a=triangle([0,0,0,4,0,0,0,0,4],'sage'),b=triangle([0,0,0,4,0,0,0,0,4],'maple');
 assert.ok(area3D(coincidentOutwardPolygon(a,b)!.polygon)>0,'Coincident exposed faces count across materials');
 assert.ok(area3D(coincidentOutwardPolygon(a,{...b,batch:'sage'})!.polygon)>0,'Same-batch duplicate skin also counts');
 assert.equal(coincidentOutwardPolygon(a,{...b,b:b.c,c:b.b}),null,'Opposite-facing actual support touch is not an exposed duplicate skin');
 const wall=triangle([1,.2,0,1,2,0,1,.2,3]);assert.ok(area3D(prismIntersection(wall,a,.15,2.3))>0,'Exactly vertical triangles cannot escape the road prism');
 const support=new MeshOracle([{name:'thin support',positions:[0,0,0,4,0,0,0,0,4],indices:[0,1,2]}]);const footprint:V[]=[[0,0,0],[4,0,0],[4,0,4],[0,0,4]];
 const covered=supportCoverage(support,footprint,()=>true);assert.ok(covered.uncovered>7.99,'Center/bounds agreement cannot prove full footprint support');
});

test('Workshop hidden coflush proof requires whole outward polygon coverage inside a third actual closed solid',()=>{
 const b=new LandMeshBatch('actual covering pier','#ffffff');b.box(new pc.Vec3(0,0,0),new pc.Vec3(2,2,2));
 const mesh=new MeshOracle([b]),part={kind:'pier',batch:b.name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'cover'},parts=new ComponentOracle(mesh,[part]),planes=convexPlanes(parts,part)!;assert.ok(planes);
 const covered:V[]=[[0,0,0],[.5,0,0],[0,.5,0]];assert.equal(subtractConvexSolid(covered,planes).length,0,'Entire patch is inside the emitted third pier');
 const partlyExposed:V[]=[[0,0,0],[2,0,0],[0,.5,0]];assert.ok(subtractConvexSolid(partlyExposed,planes).reduce((n,p)=>n+area3D(p),0)>0,'A covered center cannot hide an exposed corner');
 const boundary:V[]=[[1,0,0],[1,.5,0],[1,0,.5]];assert.ok(subtractConvexSolid(boundary,planes).length>0,'A third coflush boundary face does not bury the outward skin');
});
