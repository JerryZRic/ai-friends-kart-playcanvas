import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import {QUARRY_COURSE,QUARRY_ROAD_EDGES} from '../src/maps/quarry';
import {buildQuarrySceneGeometry} from '../src/quarry-scenery';
import {landTexturePixels} from '../src/land-scenery';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildQuarrySceneGeometry(QUARRY_COURSE);
const receipt=JSON.parse(readFileSync('tests/fixtures/quarry-enrichment-preservation.json','utf8'));
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fileSha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const point=(p:number[])=>new pc.Vec3(...p as [number,number,number]);
const xzCross=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
const contains=(poly:number[][],p:number[])=>{const c=poly.map((a,i)=>xzCross(a,poly[(i+1)%poly.length],p));return c.every(v=>v>=-1e-7)||c.every(v=>v<=1e-7);};
const planeY=(poly:number[][],p:number[])=>{const [a,b,c]=poly.map(point),normal=new pc.Vec3().cross(b.clone().sub(a),c.clone().sub(a));return a.y-(normal.x*(p[0]-a.x)+normal.z*(p[2]-a.z))/normal.y;};

test('Quarry enrichment preserves physical source, road meshes, terrain, trestle and primary landmark anchors exactly',()=>{
 for(const [path,hash]of Object.entries(receipt.preservationSourceHashes))assert.equal(fileSha(path),hash,path);
 assert.equal(fileSha('docs/scene-baselines/quarry-scenery.ts.txt'),receipt.sourceHashes['src/quarry-scenery.ts']);
 for(const [key,hash]of Object.entries(receipt.geometryHashes))assert.equal(sha(geometry[key as keyof typeof geometry]),hash,key);
 for(const [name,hash]of Object.entries(receipt.batchGeometryHashes)){
  const b=geometry.batches.find(b=>b.name===name)!;assert.equal(sha({positions:b.positions,indices:b.indices,uvs:b.uvs}),hash,name);
 }
 const textures=Object.fromEntries((['stone','asphalt','wood','grass']as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
 assert.equal(sha(textures),receipt.texturesSha256);
 assert.equal(sha(geometry.cameraObstacles.find(o=>o.heightfield)),receipt.terrainBlockerSha256);
 assert.equal(sha(geometry.cameraObstacles.filter(o=>o.kind.startsWith('trestle'))),receipt.trestleBlockersSha256);
 assert.equal(sha(geometry.landmarks.filter(l=>l.kind!=='extraction-bench')),receipt.primaryLandmarksSha256);
});

test('all 22 complete extraction terraces are convex, road-clear and supported by actual lower caps',()=>{
 const road=new RoadFootprintIndex(sampleRoadFootprints(QUARRY_ROAD_EDGES));
 const distance=(p:number[],a:number[],b:number[])=>{const x=b[0]-a[0],z=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z||1)));return Math.hypot(p[0]-a[0]-t*x,p[2]-a[2]-t*z);};
 assert.equal(geometry.extractionTerraces.length,22);
 for(const t of geometry.extractionTerraces){
  const poly=t.bottom;assert.ok(poly.length>=6);assert.ok(footprintArea(poly.map(point))>1);
  for(let i=0;i<poly.length;i++)assert.ok(contains(poly,poly[i]),`${t.site}:${t.level} convex footprint`);
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[2]);
  for(const f of road.query(Math.min(...xs)-5,Math.max(...xs)+5,Math.min(...zs)-5,Math.max(...zs)+5)){
   const roadPoly=f.points.map(p=>[p.x,p.y,p.z]);assert.ok(footprintArea(intersectRoadFootprint(poly.map(point),f.points))<1e-8);
   for(const [a,b]of [[poly,roadPoly],[roadPoly,poly]])for(const p of a)for(let i=0;i<b.length;i++)assert.ok(distance(p,b[i],b[(i+1)%b.length])>5,`${t.site}:${t.level} full-footprint road buffer`);
  }
  for(const p of t.top)assert.ok(contains(poly,p),'battered upper cap stays on its base');
  for(let i=0;i<poly.length;i++)assert.ok(t.oxideTop[i][1]>poly[i][1]+.15,'no inverted underground band');
  for(const p of t.top)assert.ok(p[1]>planeY(t.oxideTop,p)+.15,'stone body has positive depth');
  if(t.level){
   const lower=geometry.extractionTerraces.find(q=>q.site===t.site&&q.level===t.level-1)!;
   for(const p of poly){assert.ok(contains(lower.top,p),`${t.site}:${t.level} unsupported terrace corner`);assert.ok(Math.abs(p[1]-planeY(lower.top,p))<.061,'no floating tier gap');}
  }
 }
});

test('expanded extraction footprints remain on the emitted terrain and reach beneath every covered source triangle',()=>{
 const ground=geometry.batches.find(b=>b.name==='Quarry continuous dry working floor')!;
 const grid=geometry.terrainGrid;
 for(const f of geometry.extractionFootprints){
  const poly=f.footprint.map(point);
  for(const p of poly)assert.ok(p.x>=grid.minX&&p.x<=grid.minX+grid.dx*(grid.columns-1)&&p.z>=grid.minZ&&p.z<=grid.minZ+grid.dz*(grid.rows-1),'rock footprint remains inside actual terrain bounds');
  let covered=0;
  for(let i=0;i<ground.indices.length;i+=3){
   const triangle=ground.indices.slice(i,i+3).map(j=>point(ground.positions.slice(j*3,j*3+3)));
   const xs=triangle.map(p=>p.x),zs=triangle.map(p=>p.z);
   if(Math.max(...xs)<Math.min(...poly.map(p=>p.x))||Math.min(...xs)>Math.max(...poly.map(p=>p.x))||Math.max(...zs)<Math.min(...poly.map(p=>p.z))||Math.min(...zs)>Math.max(...poly.map(p=>p.z)))continue;
   for(const p of intersectRoadFootprint(triangle,poly)){assert.ok(f.bottom<=p.y-.499999,'no floating rock toe');covered++;}
  }
  assert.ok(covered>3);
 }
});

test('open industrial yards use individual members and geological camera blockers contain actual source triangles',()=>{
 for(const kind of ['hopper-service-shelter','derrick-service-shelter','conveyor-receiving-shelter'])assert.equal(geometry.props.filter(p=>p.kind===kind).length,1,kind);
 assert.ok(geometry.props.filter(p=>p.kind==='roadside-stone-workset').length>=20);
 assert.ok(!geometry.cameraObstacles.some(o=>['hopper-service-shelter','derrick-service-shelter','conveyor-receiving-shelter'].includes(o.kind)),'no opaque open-shed box');
 assert.equal(geometry.cameraObstacles.filter(o=>o.kind==='service-shelter-weathered-cover').length,3);
 const source=new Set<string>();
 for(const b of geometry.batches)for(let i=0;i<b.indices.length;i+=3)source.add(JSON.stringify(b.indices.slice(i,i+3).map(j=>b.positions.slice(j*3,j*3+3))));
 for(const o of geometry.cameraObstacles.filter(o=>o.kind.startsWith('extraction-bench'))){
  assert.ok(o.triangles?.length,'irregular rock must not become a giant solid AABB');
  for(const t of o.triangles!)assert.ok(source.has(JSON.stringify(t)),'camera face must be a visible-source triangle');
 }
});
