import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildSnowSceneGeometry,SNOW_SCENE_THEME} from '../src/snow-scenery';
import {SNOW_COURSE,SNOW_ROAD_EDGES} from '../src/maps/snow';
import {cameraTerrainHeight,safeLandCamera} from '../src/land-camera';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,roadFootprint,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildSnowSceneGeometry(SNOW_COURSE),sourceIndex=new RoadFootprintIndex(sampleRoadFootprints(SNOW_ROAD_EDGES,1.65));
const vec=(p:readonly number[])=>new pc.Vec3(...p),byName=new Map(geometry.batches.map(b=>[b.name,b]));
const components=(kind:string)=>geometry.components.filter(c=>c.kind===kind);
const points=(c:typeof geometry.components[number])=>{const b=byName.get(c.batch)!;return Array.from({length:c.vertexEnd-c.vertexStart},(_,i)=>b.positions.slice((c.vertexStart+i)*3,(c.vertexStart+i)*3+3));};
const intersects=(a:typeof geometry.components[number],b:typeof a)=>[0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6);
const terrainExtrema=(polygon:number[][])=>{const f=geometry.terrainGrid,b={positions:geometry.terrainVertices},poly=polygon.map(vec),x0=Math.max(0,Math.floor((Math.min(...poly.map(p=>p.x))-f.minX)/f.dx)),x1=Math.min(f.columns-2,Math.floor((Math.max(...poly.map(p=>p.x))-f.minX)/f.dx)),z0=Math.max(0,Math.floor((Math.min(...poly.map(p=>p.z))-f.minZ)/f.dz)),z1=Math.min(f.rows-2,Math.floor((Math.max(...poly.map(p=>p.z))-f.minZ)/f.dz));let low=Infinity,high=-Infinity;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*f.columns+x;for(const ids of [[i,i+f.columns,i+1],[i+1,i+f.columns,i+f.columns+1]])for(const p of intersectRoadFootprint(ids.map(i=>vec(b.positions.slice(i*3,i*3+3))),poly)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};};

test('original snow geometry is finite, fully indexed and inside every protected budget',()=>{
 assert.equal(geometry.trackId,'snow');let vertices=0,triangles=0;for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}assert.deepEqual(geometry.budget,{batches:23,triangles,vertices});assert.ok(triangles>70000&&triangles<120000);assert.ok(vertices<200000);assert.equal(geometry.terrainTriangles.length,33500);assert.equal(geometry.landmarks.length,5);assert.equal(SNOW_SCENE_THEME.textureLabel,'frostloop original snow slate and depot textures');
});
test('source road samples preserve exact banked full width and physical distance',()=>{
 assert.equal(geometry.routeRoadSamples.length,SNOW_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/1.65),0));for(const s of geometry.routeRoadSamples){const e=SNOW_ROAD_EDGES.find(e=>e.id===s.edgeId)!;for(const [l,p]of [[-e.halfWidthAt(s.distance),s.left],[e.halfWidthAt(s.distance),s.right]] as const)assert.ok(e.sample(s.distance,l).p.distance(vec(p))<1e-8);}
 assert.equal(geometry.roadFaces.length,geometry.roadUndersideFaces.length);for(let i=0;i<geometry.roadFaces.length;i++)for(let j=0;j<3;j++){const a=geometry.roadFaces[i].points[j],b=geometry.roadUndersideFaces[i].points[2-j];assert.ok(Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])<1e-8);assert.ok(Math.abs(a[1]-b[1]-.22)<1e-8);}
});
test('road spatial union and shoulders have one owner across the complete fork and merge lobes',()=>{
 const faces=geometry.roadFaces.map(f=>roadFootprint(SNOW_ROAD_EDGES.find(e=>e.id===f.edgeId)!,f.distance,f.points.map(vec))),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((f,i)=>[f,i]));let checked=0;for(const a of faces)for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){if(a.edge===b.edge||ids.get(a)!>=ids.get(b)!)continue;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-6);checked++;}assert.ok(checked>100);
 for(const s of geometry.shoulderFaces){const poly=s.points.map(vec);for(const r of sourceIndex.query(Math.min(...poly.map(p=>p.x)),Math.max(...poly.map(p=>p.x)),Math.min(...poly.map(p=>p.z)),Math.max(...poly.map(p=>p.z))))assert.ok(footprintArea(intersectRoadFootprint(poly,r.points))<1e-6,'shoulder enters full source union');}
});
test('whole foundations and tree/post footings match exact emitted triangle extrema',()=>{
 for(const d of geometry.groundedDetails){const e=terrainExtrema(d.footprint);assert.ok(d.bottom<e.low+1e-8,d.kind);assert.equal(d.terrainY,cameraTerrainHeight(geometry.terrainGrid,d.x,d.z));}for(const f of geometry.foundations){const e=terrainExtrema(f.footprint);assert.ok(Math.abs(f.terrainLow-e.low)<1e-8);assert.ok(Math.abs(f.terrainHigh-e.high)<1e-8);assert.ok(f.bottom<e.low);assert.ok(f.top>=e.high,f.kind);}
});
test('complete source component provenance covers every emitted triangle exactly once',()=>{
 for(const b of geometry.batches){const uses=new Uint8Array(b.indices.length/3);for(const c of geometry.components.filter(c=>c.batch===b.name)){for(let i=c.indexStart;i<c.indexEnd;i+=3){assert.equal(uses[i/3]++,0,c.kind+' overlaps primitive range');for(const id of b.indices.slice(i,i+3))assert.ok(id>=c.vertexStart&&id<c.vertexEnd,c.kind+' false index range');}const p=points(c);for(let k=0;k<3;k++){assert.equal(c.min[k],Math.min(...p.map(p=>p[k])));assert.equal(c.max[k],Math.max(...p.map(p=>p[k])));}}assert.ok(uses.every(n=>n===1),b.name+' has unowned triangles');}
});
test('connected heightfield is exact at every diagonal and creates opposing relief with an open basin',()=>{
 const f=geometry.terrainGrid;assert.equal(f.heights.length,geometry.terrainVertices.length/3);for(let i=0;i<f.heights.length;i++)assert.equal(f.heights[i],geometry.terrainVertices[i*3+1]);let k=0;for(let z=0;z<f.rows-1;z++)for(let x=0;x<f.columns-1;x++){const i=z*f.columns+x;for(const ids of [[i,i+f.columns,i+1],[i+1,i+f.columns,i+f.columns+1]]){assert.deepEqual(geometry.terrainTriangles[k++],ids.map(i=>geometry.terrainVertices.slice(i*3,i*3+3)));}}
 assert.ok(Math.max(...f.heights)-Math.min(...f.heights)>43);const h=(x:number,z:number)=>cameraTerrainHeight(f,x,z)!;assert.ok(h(-200,-55)>h(-120,-275)+10);assert.ok(h(220,200)>h(220,15)+20);assert.ok(h(-405,-785)>h(-50,-610)+15);assert.ok(components('split-ridge-connected-snow-slate-surface').length>=2);
});
test('five hero assemblies remain inside their complete surveyed road-safe footprint disks',()=>{
 for(const l of geometry.landmarks){assert.ok(sourceIndex.clearAt(l.position[0],l.position[2],l.radius+19.9),l.kind);for(const c of geometry.components.filter(c=>c.landmark===l.kind))for(const p of points(c)){assert.ok(Math.hypot(p[0]-l.position[0],p[2]-l.position[2])<=l.radius+1e-8,`${l.kind}/${c.kind} footprint`);assert.ok(p[1]<=l.position[1]+l.height+1e-8,`${l.kind}/${c.kind} height`);}}
});
test('actual wheel minima sit on platforms or rails and every open rim exposes eight joined spokes',()=>{
 assert.equal(geometry.wheelContacts.length,14);for(const w of geometry.wheelContacts){const c=geometry.components[w.component],p=points(c),low=Math.min(...p.map(p=>p[1]));assert.ok(Math.abs(low-w.supportY)<1e-8,w.kind);assert.equal(w.signedGap,low-w.supportY);assert.ok(w.points.length>=2);assert.ok(w.points.every(p=>Math.abs(p[1]-low)<1e-9));const b=byName.get(c.batch)!,edges=new Map<string,number>(),key=(i:number)=>b.positions.slice(i*3,i*3+3).map(x=>x.toFixed(6)).join(',');for(let i=c.indexStart;i<c.indexEnd;i+=3){const t=b.indices.slice(i,i+3).map(key);for(let j=0;j<3;j++){const k=[t[j],t[(j+1)%3]].sort().join('|');edges.set(k,(edges.get(k)??0)+1);}}assert.ok([...edges.values()].every(n=>n===2),w.kind+' open periodic seam');}
 assert.equal(components('parcels-cart-actual-wheel-eight-joined-spoke').length,64);assert.equal(components('inspection-trolley-flanged-wheel-eight-joined-spoke').length,32);assert.equal(components('snowplow-open-eight-spoke-wheel-eight-joined-spoke').length,16);
});
test('named support pairs overlap or meet within physical bearing tolerance',()=>{
 for(const j of geometry.structuralContacts){const a=geometry.components[j.first],b=geometry.components[j.second];assert.ok(a&&b,j.kind+' missing primitive');const d=Math.sqrt([0,1,2].reduce((n,k)=>n+Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])**2,0));assert.ok(d<=.020001,`${j.kind}: ${a.kind} / ${b.kind} gap ${d}`);}
});
test('closed source solids retain outward volume and upward road/coping winding',()=>{
 for(const c of geometry.components.filter(c=>c.solid)){const b=byName.get(c.batch)!,o=b.positions.slice(c.vertexStart*3,c.vertexStart*3+3);let volume=0;for(let i=c.indexStart;i<c.indexEnd;i+=3){const p=b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3).map((v,j)=>v-o[j]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}assert.ok(volume>1e-12,c.kind+' non-positive solid volume');}
 for(const c of components('road-edge-coping')){const b=byName.get(c.batch)!;for(let i=c.indexStart;i<c.indexEnd;i+=3){const [a,v,w]=b.indices.slice(i,i+3).map(k=>vec(b.positions.slice(k*3,k*3+3)));assert.ok(new pc.Vec3().cross(v.sub(a),w.sub(a)).y>0);}}
});
test('open bays, recesses, continuous rack piers and original machinery remain actual geometry',()=>{
 for(const kind of ['signal-turret-slit-mullion','clock-twelve-original-radial-tick','clock-dial-seated-hand-arbor','roundhouse-continuous-bay-pier','roundhouse-visible-bearing-tie','inspection-trolley-flanged-wheel','snowplow-thick-curved-wedge-blade','snowplow-blade-seated-rear-rib','snowplow-ground-seated-adjustable-skid','plow-rack-continuous-pier'])assert.ok(components(kind).length,kind);
 assert.equal(components('plow-rack-continuous-pier').length,4);assert.equal(components('plow-rack-pier-seated-shelf').length,3);assert.equal(components('roundhouse-continuous-bay-pier').length,4);assert.equal(components('clock-twelve-original-radial-tick').length,12);assert.ok(geometry.cameraObstacles.every(b=>b.triangles||b.heightfield));assert.equal(geometry.structures.length,0);
});
test('continuous material contours partition baseline terrain triangles without moving their physical surfaces',()=>{
 assert.equal(geometry.terrainExposure.length,geometry.terrainVertices.length/3);assert.ok(geometry.terrainExposure.every(Number.isFinite));
 const pieces=new Map<number,pc.Vec3[][]>();let divided=0,actualFaces=0;
 for(const partition of geometry.terrainPartitions){const b=byName.get(partition.material==='snow'?'Snow connected wind sculpted terrain':'Snow connected blue slate ribs')!,faces=pieces.get(partition.sourceTriangle)??[];for(let i=partition.indexStart;i<partition.indexEnd;i+=3){faces.push(b.indices.slice(i,i+3).map(k=>vec(b.positions.slice(k*3,k*3+3))));actualFaces++;}pieces.set(partition.sourceTriangle,faces);}
 assert.equal(pieces.size,33500);assert.ok(actualFaces>33500);assert.ok(actualFaces<39500);
 for(let id=0;id<geometry.terrainTriangles.length;id++){const original=geometry.terrainTriangles[id].map(vec),[a,b,c]=original,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),normal=new pc.Vec3().cross(b.clone().sub(a),c.clone().sub(a)).normalize(),faces=pieces.get(id)!;if(faces.length>1)divided++;assert.ok(Math.abs(faces.reduce((sum,t)=>sum+footprintArea(t),0)-footprintArea(original))<1e-6);
  for(const face of faces){const n=new pc.Vec3().cross(face[1].clone().sub(face[0]),face[2].clone().sub(face[0])).normalize();assert.ok(normal.dot(n)>1-1e-10);for(const p of face){const u=((p.x-a.x)*(c.z-a.z)-(p.z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x))/den;assert.ok(u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10);assert.ok(Math.abs(p.y-a.y-u*(b.y-a.y)-v*(c.y-a.y))<1e-10);}}
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++)assert.ok(footprintArea(intersectRoadFootprint(faces[i],faces[j]))<1e-6);
 }
 assert.ok(divided>100&&divided<3000,'only contour-crossed baseline faces subdivide');
});
