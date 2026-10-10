import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildForestSceneGeometry,FOREST_SCENE_THEME} from '../src/forest-scenery';
import {FOREST_COURSE,FOREST_ROAD_EDGES,FOREST_LANDMARKS} from '../src/maps/forest';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,roadFootprint,sampleRoadFootprints} from '../src/land-road-mesh';
import {cameraTerrainHeight,safeLandCamera} from '../src/land-camera';
const geometry=buildForestSceneGeometry(FOREST_COURSE);
const sourceFaces=sampleRoadFootprints(FOREST_ROAD_EDGES),sourceIndex=new RoadFootprintIndex(sourceFaces);
const ground=geometry.batches.find(b=>b.name==='Forest connected moss ridge terrain')!;
const field=geometry.cameraObstacles.find(b=>b.heightfield)!.heightfield!;
const vec=(p:number[])=>new pc.Vec3(...p);
const height=(x:number,z:number)=>cameraTerrainHeight(field,x,z)!;
function planeY(p:number[],tri:number[][]){const [a,b,c]=tri,d=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),u=((p[0]-a[0])*(c[2]-a[2])-(p[2]-a[2])*(c[0]-a[0]))/d,v=((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]))/d;return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);}

test('original forest uses finite indexed source meshes under hard static budgets',()=>{
  assert.equal(geometry.trackId,'forest');assert.equal(geometry.batches.length,21);
  let vertices=0,triangles=0;
  for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));assert.ok(b.roughness>=0&&b.roughness<=1);}
  assert.ok(vertices<200000,`vertices ${vertices}`);assert.ok(triangles<110000,`triangles ${triangles}`);
  assert.equal(new Set(geometry.batches.filter(b=>b.texture!=='none').map(b=>b.texture)).size,4);
  assert.ok(geometry.batches.filter(b=>b.metalness>.4).length>=3);assert.equal(FOREST_SCENE_THEME.sky,'#c6d8ce');
  for(const kind of ['abandoned-observatory','root-cathedral','cedar-bowl-fan','broken-meridian-armillary','canopy-viaduct-lookout','old-forestry-station','canopy-root-viaduct'])assert.equal(geometry.landmarks.filter(l=>l.kind===kind).length,1,kind);
  assert.ok(geometry.trees.length>=85);assert.equal(geometry.props.filter(p=>p.kind==='forest-fork-wayfinding').length,2);
});
test('four exact support ribbons retain a paired underside and every source junction has one owner',()=>{
  assert.equal(geometry.routeRoadSamples.length,FOREST_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/1.65),0));
  for(const sample of geometry.routeRoadSamples){const e=FOREST_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;for(const [l,p]of [[-e.halfWidthAt(sample.distance),sample.left],[e.halfWidthAt(sample.distance),sample.right]] as const)assert.ok(e.sample(sample.distance,l).p.distance(vec(p))<1e-8);}
  assert.equal(geometry.roadFaces.length,geometry.roadUndersideFaces.length);
  for(let i=0;i<geometry.roadFaces.length;i++)for(let j=0;j<3;j++){const p=geometry.roadFaces[i].points[j],q=geometry.roadUndersideFaces[i].points[2-j];assert.ok(Math.hypot(p[0]-q[0],p[2]-q[2])<1e-8);assert.ok(Math.abs(p[1]-q[1]-.45)<1e-8);}
  const faces=geometry.roadFaces.map(f=>roadFootprint(FOREST_ROAD_EDGES.find(e=>e.id===f.edgeId)!,f.distance,f.points.map(vec))),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((f,i)=>[f,i]));let checked=0;
  for(const a of faces)for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){if(ids.get(a)!>=ids.get(b)!||a.edge===b.edge||Math.max(a.maxY,b.maxY)-Math.min(a.minY,b.minY)>.005)continue;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-6);checked++;}assert.ok(checked>100);
  for(const e of FOREST_ROAD_EDGES)for(let s=1;s<e.length;s+=4.7)for(const l of [-.95,0,.95]){const p=e.sample(s,l*e.halfWidthAt(s)).p;assert.ok(index.query(p.x-.2,p.x+.2,p.z-.2,p.z+.2).some(f=>f.minY<p.y+.2&&f.maxY>p.y-.2&&!new RoadFootprintIndex([f]).clearAt(p.x,p.z,.08)),`road hole ${e.id}:${s}:${l}`);}
});
test('every emitted terrain triangle stays below every intersecting source ribbon, not only sampled lanes',()=>{
  const v=(i:number)=>new pc.Vec3(...ground.positions.slice(i*3,i*3+3));let overlaps=0,minimum=Infinity;
  for(let i=0;i<ground.indices.length;i+=3){const tri=ground.indices.slice(i,i+3).map(v),xs=tri.map(p=>p.x),zs=tri.map(p=>p.z);for(const road of sourceIndex.query(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs))){const overlap=intersectRoadFootprint(tri,road.points);if(footprintArea(overlap)<1e-8)continue;for(const p of overlap){const gap=planeY([p.x,p.y,p.z],road.points.map(p=>[p.x,p.y,p.z]))-p.y;minimum=Math.min(minimum,gap);assert.ok(gap>=1.24999,`terrain enters ${road.edge.id}:${road.distance}: ${gap}`);}overlaps++;}}
  assert.ok(overlaps>10000);assert.ok(minimum>=1.24999);assert.ok(height(30,0)<FOREST_LANDMARKS.crossing.lowerY-1.25);
  // Real elevation variation is continuous through the long western ridge.
  assert.ok(height(-287,155)>38);assert.ok(height(-255,310)>40);assert.ok(height(30,0)<11);
});
test('camera heightfield is byte-for-number identical to the emitted row-major triangle mesh',()=>{
  assert.equal(field.heights.length,ground.positions.length/3);for(let i=0;i<field.heights.length;i++)assert.equal(field.heights[i],ground.positions[i*3+1]);
  let i=0;for(let z=0;z<field.rows-1;z++)for(let x=0;x<field.columns-1;x++){const k=z*field.columns+x;assert.deepEqual(ground.indices.slice(i,i+6),[k,k+field.columns,k+1,k+1,k+field.columns,k+field.columns+1]);i+=6;}
  for(let n=0;n<300;n++){const x=field.minX+((n*37)%91+.37)*field.dx,z=field.minZ+((n*61)%142+.43)*field.dz,h=height(x,z),anchor={x,y:h+10,z},desired={x,y:h-10,z},safe=safeLandCamera(anchor,desired,[geometry.cameraObstacles[0]]);assert.ok(safe.y>=h+.45);assert.ok(safe.y<h+2);}
});
test('foundation full footprints reach exact emitted terrain with no duplicated internal cap interface',()=>{
  const masonry=geometry.batches.find(b=>b.name==='Forest observatory foundation masonry')!,coping=geometry.batches.find(b=>b.name==='Forest pale road coping and foundation caps')!;
  for(const f of geometry.foundations){const [a,b,,d]=f.footprint;for(let u=0;u<=16;u++)for(let v=0;v<=16;v++){const x=a[0]+(b[0]-a[0])*u/16+(d[0]-a[0])*v/16,z=a[2]+(b[2]-a[2])*u/16+(d[2]-a[2])*v/16;assert.ok(f.bottom<height(x,z)-.49999);assert.ok(f.top>height(x,z)+.15999);assert.ok(sourceIndex.clearAt(x,z,0));}
    const topCount=(batch:typeof masonry,start:number,y:number)=>{let n=0;for(let i=0;i<batch.indices.length;i+=3){const ids=batch.indices.slice(i,i+3);if(ids.every(j=>j>=start&&j<start+24)&&ids.every(j=>Math.abs(batch.positions[j*3+1]-y)<1e-8))n++;}return n;};
    assert.equal(topCount(masonry,f.masonryVertexStart,f.top-.12),0);assert.equal(topCount(coping,f.pavingVertexStart,f.top),2);assert.equal(topCount(coping,f.pavingVertexStart,f.top-.12),0);
  }
});
test('landmarks and whole cedar crowns keep road margins while root tips meet exact soil',()=>{
  for(const p of geometry.props)assert.ok(sourceIndex.clearAt(p.x,p.z,p.radius+4.999),`${p.kind} road clearance`);
  for(const t of geometry.trees){assert.ok(sourceIndex.clearAt(t.position[0],t.position[2],t.radius+17.9),`${t.kind} crown clearance`);}
  for(const d of geometry.groundedDetails){assert.ok(Math.abs(d.terrainY-height(d.x,d.z))<1e-8);assert.ok(d.bottom<d.terrainY,`${d.kind} floats`);}
  assert.ok(geometry.groundedDetails.filter(d=>d.kind==='cedar-root-toe').length>=270);
});
test('all component camera AABBs are derived from actual generated vertices',()=>{
  const byName=new Map(geometry.batches.map(b=>[b.name,b]));for(const c of geometry.components){const batch=byName.get(c.batch)!,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=c.vertexStart*3;i<c.vertexEnd*3;i++){const k=i%3;min[k]=Math.min(min[k],batch.positions[i]);max[k]=Math.max(max[k],batch.positions[i]);}assert.deepEqual(c.min,min);assert.deepEqual(c.max,max);}
  assert.ok(!geometry.cameraObstacles.some(o=>o.kind==='canopy-root-viaduct'));assert.ok(geometry.cameraObstacles.some(o=>o.kind==='canopy-open-knee-brace'));
});
test('full-width canopy crossing keeps every low structural member outside the lower road plus five metres',()=>{
  assert.equal(geometry.structures.length,1);assert.ok(geometry.structures[0].overheadClearance>=21.4);
  const lowerIndex=new RoadFootprintIndex(sourceFaces.filter(f=>f.edge!==FOREST_COURSE.commonFinish));let posts=0;
  for(const m of geometry.trestleMembers){if(m.kind.startsWith('outside-corridor')){for(const p of m.points)assert.ok(lowerIndex.clearAt(p[0],p[2],4.999,f=>f.maxY<p[1]+5),`${m.kind} obstructs lower road`);if(m.kind==='outside-corridor-post')posts++;}else for(const p of m.points){for(const f of lowerIndex.query(p[0]-.01,p[0]+.01,p[2]-.01,p[2]+.01)){if(f.maxY>p[1]-10)continue;assert.ok(p[1]-f.maxY>21.4);}}}assert.ok(posts>=12);
});
test('observatory has a real open radial slit, articulated edges and a visible forked telescope',()=>{
  assert.ok(geometry.dome.faces.length>500);const {center,slitYaw,slitHalfAngle}=geometry.dome;
  for(const tri of geometry.dome.faces){const p=tri.reduce((a,p)=>a.map((v,i)=>v+p[i]/3),[0,0,0]),angle=Math.atan2(p[2]-center[2],p[0]-center[0]),delta=Math.atan2(Math.sin(angle-slitYaw),Math.cos(angle-slitYaw));assert.ok(Math.abs(delta)>=slitHalfAngle-1e-6);}
  for(const name of ['observatory-articulated-shutter-edge','observatory-offset-shutter-rib','observatory-double-fork-arm','observatory-original-telescope','observatory-real-stair-tread','forestry-supported-cut-log','lookout-real-stair-tread','armillary-broken-meridian'])assert.ok(geometry.components.some(c=>c.kind===name),name);
});

test('grounded fork signs stand above the approach road with their full boards visible',()=>{
  const roadY=FOREST_COURSE.commonStart.sample(FOREST_COURSE.commonStart.length-88).p.y,boards=geometry.components.filter(c=>c.kind==='fork-sign-cream-board');assert.equal(boards.length,2);for(const b of boards){assert.ok(b.min[1]>roadY+2.89);assert.ok(b.max[1]>roadY+4.69);}
});

test('bounded cedar composition redistributes existing trees into broad near-route groups without more geometry',()=>{
  assert.equal(geometry.trees.length,99);assert.equal(geometry.batches.reduce((n,b)=>n+b.indices.length/3,0),107780);
  const near=geometry.trees.filter(t=>t.kind.startsWith('near-route-'));assert.ok(near.length>=45);assert.ok(near.every(t=>t.radius>10.4));
  for(const kind of ['root-valley','outer-bowl','canopy-return','sunbreak-shoulder'])assert.ok(near.filter(t=>t.kind==='near-route-'+kind).length>=6,kind);
  assert.ok(geometry.trees.filter(t=>t.kind.startsWith('ridge-cluster-')).length>=35,'retain connected distant screens and negative space');
});
