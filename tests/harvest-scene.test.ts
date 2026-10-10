import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildHarvestSceneGeometry,HARVEST_SCENE_THEME} from '../src/harvest-scenery';
import {HARVEST_COURSE,HARVEST_ROAD_EDGES} from '../src/maps/harvest';
import {cameraTerrainHeight,safeLandCamera} from '../src/land-camera';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,roadFootprint,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildHarvestSceneGeometry(HARVEST_COURSE),sourceIndex=new RoadFootprintIndex(sampleRoadFootprints(HARVEST_ROAD_EDGES,1.65));
const vec=(p:readonly number[])=>new pc.Vec3(...p),byName=new Map(geometry.batches.map(b=>[b.name,b]));
const components=(kind:string)=>geometry.components.filter(c=>c.kind===kind);
const points=(c:typeof geometry.components[number])=>{const b=byName.get(c.batch)!;return Array.from({length:c.vertexEnd-c.vertexStart},(_,i)=>b.positions.slice((c.vertexStart+i)*3,(c.vertexStart+i)*3+3));};
const intersects=(a:typeof geometry.components[number],b:typeof a)=>[0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6);
test('complete original harvest scenery is finite, indexed and under the hard budget',()=>{
  assert.equal(geometry.trackId,'harvest');let vertices=0,triangles=0;for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
  assert.deepEqual(geometry.budget,{batches:21,triangles,vertices});assert.ok(triangles>85000&&triangles<110000);assert.ok(vertices<200000);assert.equal(geometry.landmarks.length,5);assert.ok(geometry.cropRows.length>=35);assert.ok(geometry.trees.length>=15);assert.equal(HARVEST_SCENE_THEME.textureLabel,'amberwind original farm textures');
});
test('road samples and source-owned upper/underside geometry preserve physical edge metres',()=>{
  assert.equal(geometry.routeRoadSamples.length,HARVEST_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/1.65),0));for(const s of geometry.routeRoadSamples){const e=HARVEST_ROAD_EDGES.find(e=>e.id===s.edgeId)!;for(const [l,p]of [[-e.halfWidthAt(s.distance),s.left],[e.halfWidthAt(s.distance),s.right]] as const)assert.ok(e.sample(s.distance,l).p.distance(vec(p))<1e-8);}
  assert.equal(geometry.roadFaces.length,geometry.roadUndersideFaces.length);for(let i=0;i<geometry.roadFaces.length;i++)for(let j=0;j<3;j++){const a=geometry.roadFaces[i].points[j],b=geometry.roadUndersideFaces[i].points[2-j];assert.ok(Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])<1e-8);assert.ok(Math.abs(a[1]-b[1]-.22)<1e-8);}
  const faces=geometry.roadFaces.map(f=>roadFootprint(HARVEST_ROAD_EDGES.find(e=>e.id===f.edgeId)!,f.distance,f.points.map(vec))),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((f,i)=>[f,i]));let checked=0;for(const a of faces)for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){if(a.edge===b.edge||ids.get(a)!>=ids.get(b)!)continue;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-6);checked++;}assert.ok(checked>100);
});
test('one terrain heightfield exactly matches its emitted cell diagonals',()=>{
  const f=geometry.terrainGrid,b=byName.get('Harvest connected contour earth')!;assert.equal(f.heights.length,b.positions.length/3);for(let i=0;i<f.heights.length;i++)assert.equal(f.heights[i],b.positions[i*3+1]);let k=0;for(let z=0;z<f.rows-1;z++)for(let x=0;x<f.columns-1;x++){const i=z*f.columns+x;assert.deepEqual(b.indices.slice(k,k+6),[i,i+f.columns,i+1,i+1,i+f.columns,i+f.columns+1]);k+=6;}
  for(const x of [254.6,256.6,280.6,304.6,306.6])for(const z of [-28,0,28])assert.ok(cameraTerrainHeight(f,x,z)!<=16);
});
test('whole foundations and rooted details descend below all exact footprint terrain intersections',()=>{
  const field=geometry.terrainGrid,b=byName.get('Harvest connected contour earth')!;const extrema=(polygon:number[][])=>{const poly=polygon.map(vec),x0=Math.max(0,Math.floor((Math.min(...poly.map(p=>p.x))-field.minX)/field.dx)),x1=Math.min(field.columns-2,Math.floor((Math.max(...poly.map(p=>p.x))-field.minX)/field.dx)),z0=Math.max(0,Math.floor((Math.min(...poly.map(p=>p.z))-field.minZ)/field.dz)),z1=Math.min(field.rows-2,Math.floor((Math.max(...poly.map(p=>p.z))-field.minZ)/field.dz));let low=Infinity,high=-Infinity;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*field.columns+x;for(const ids of [[i,i+field.columns,i+1],[i+1,i+field.columns,i+field.columns+1]])for(const p of intersectRoadFootprint(ids.map(i=>vec(b.positions.slice(i*3,i*3+3))),poly)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};};
  assert.ok(geometry.groundedDetails.length>150);for(const d of geometry.groundedDetails){const e=extrema(d.footprint);assert.ok(d.bottom<e.low+1e-8,d.kind);assert.equal(d.terrainY,cameraTerrainHeight(field,d.x,d.z));}for(const f of geometry.foundations){const e=extrema(f.footprint);assert.ok(Math.abs(f.terrainLow-e.low)<1e-8);assert.ok(Math.abs(f.terrainHigh-e.high)<1e-8);assert.ok(f.bottom<e.low);assert.ok(f.top>=e.high,f.kind);}
});
test('all source components expose truthful bounds and reserved full landmark volumes',()=>{
  for(const c of geometry.components){const p=points(c);for(let k=0;k<3;k++){assert.equal(c.min[k],Math.min(...p.map(p=>p[k])));assert.equal(c.max[k],Math.max(...p.map(p=>p[k])));}}
  for(const l of geometry.landmarks){assert.ok(sourceIndex.clearAt(l.position[0],l.position[2],l.radius+19.9));for(const c of geometry.components.filter(c=>c.landmark===l.kind))for(const p of points(c)){assert.ok(Math.hypot(p[0]-l.position[0],p[2]-l.position[2])<=l.radius+1e-8,`${l.kind}/${c.kind} footprint`);assert.ok(p[1]<=l.position[1]+l.height+1e-8,`${l.kind}/${c.kind} height`);}}
});
test('barn has genuine 48 metre open portals and 18 metre unobstructed architectural headroom',()=>{
  assert.equal(geometry.barn.portalWidth,48);assert.equal(geometry.barn.headroom,18);assert.ok(geometry.barn.triangles.length>2000);for(const c of geometry.components.filter(c=>c.landmark==='open-threshing-barn')){if(c.min[0]<304.6-1e-7&&c.max[0]>256.6+1e-7)assert.ok(c.min[1]>=34-1e-7,`${c.kind} enters aperture`);}
  const b=geometry.cameraObstacles.find(o=>o.kind==='barn-exact-architecture-triangles')!;assert.ok(b.triangles);assert.ok(!geometry.cameraObstacles.some(o=>!o.triangles&&!o.heightfield));for(const x of [263,280.6,298])for(const y of [18,25,32]){const a={x,y,z:38},d={x,y,z:-38};assert.deepEqual(safeLandCamera(a,d,[b]),d);}const above={x:280.6,y:46,z:0},below={x:280.6,y:31,z:0};assert.ok(safeLandCamera(above,below,[b]).y>42.8);
});
test('barn plinths, posts, seated ties, rafters and ridge form explicit physical contact chains',()=>{
  const plinths=components('barn-side-plinth-foundation-cap'),posts=components('barn-load-bearing-post'),ties=components('barn-post-seated-tie-beam'),rafters=components('barn-tie-seated-rafter'),ridge=components('barn-continuous-supported-ridge');assert.equal(posts.length,10);assert.equal(ties.length,5);assert.equal(rafters.length,10);
  for(const p of posts){assert.ok(plinths.some(f=>intersects(p,f)),'post seated in plinth');assert.ok(ties.some(t=>intersects(p,t)),'post touches tie');}for(const t of ties)assert.equal(posts.filter(p=>intersects(t,p)).length,2);for(const r of rafters){assert.ok(ties.some(t=>intersects(r,t)));assert.ok(ridge.some(t=>intersects(r,t)));}
});
test('barn tools are in front of supported racks and remain outside the clear interior',()=>{
  const racks=components('barn-tool-supported-rack'),pegs=components('barn-tool-peg'),handles=components('barn-visible-fork-handle');assert.equal(racks.length,6);assert.equal(pegs.length,12);assert.equal(handles.length,12);for(const p of pegs){assert.ok(racks.some(r=>intersects(p,r)));assert.ok(handles.some(h=>intersects(p,h)));}for(const h of handles){assert.ok(h.max[0]<=256.6||h.min[0]>=304.6);const rack=racks.find(r=>Math.abs((r.min[2]+r.max[2])/2-(h.min[2]+h.max[2])/2)<3&&Math.abs(r.min[0]-h.min[0])<1)!;assert.ok(rack);if(h.min[0]<280.6)assert.ok(h.min[0]>rack.max[0]);else assert.ok(h.max[0]<rack.min[0]);}
});
test('four original static slatted mill sails join a supported shaft, hub and tower collar',()=>{
  assert.equal(geometry.sails.length,4);assert.ok(geometry.sails.every(s=>s.slats===12));assert.equal(components('mill-sail-separate-slat').length,48);assert.equal(components('mill-sail-continuous-spar').length,8);assert.equal(components('mill-sail-partial-cloth-panel').length,16);
  const shaft=components('mill-static-hub-axle')[0],member=components('mill-supported-axle-crossmember')[0],posts=components('mill-bearing-support-upright'),collar=components('mill-tower-top-collar')[0],hub=components('mill-raised-iron-hub')[0];assert.ok(intersects(shaft,member));assert.ok(intersects(shaft,hub));assert.equal(posts.filter(p=>intersects(member,p)&&intersects(p,collar)).length,2);assert.equal(components('mill-recessed-window-back').length,16);assert.equal(components('mill-window-stone-jamb').length,32);
});
test('agricultural craft details are modeled and remain physically supported',()=>{
  for(const kind of ['grain-scale-supported-column','grain-scale-horizontal-balance','grain-scale-suspension','grain-scale-pan','press-static-horizontal-threaded-spindle','press-spindle-bearing-collar','press-dry-stone-trough-floor','silo-raised-horizontal-band','silo-visible-seam-bolt','market-scalloped-cloth-edge','cart-open-wheel-rim','cart-joined-wheel-spoke','crate-visible-fruit','wheat-modeled-seed-head'])assert.ok(components(kind).length,kind);
  const spindles=components('press-static-horizontal-threaded-spindle'),posts=components('press-spindle-bearing-upright');assert.equal(spindles.length,2);for(const s of spindles)assert.equal(posts.filter(p=>intersects(s,p)).length,2);
  for(const wheel of components('cart-open-wheel-rim')){const base=geometry.foundations.find(f=>f.kind===wheel.landmark)!;assert.ok(base);assert.ok(wheel.min[1]<base.top+.03&&wheel.min[1]>=base.top-.17);}
});
test('grounded orchard crowns and sparse crop rows protect road and reveal corridors',()=>{
  assert.ok(new Set(geometry.cropRows.map(r=>r.kind)).size===4);for(const tree of geometry.trees)assert.ok(sourceIndex.clearAt(tree.position[0],tree.position[2],tree.radius+23));for(const row of geometry.cropRows){assert.ok(row.height<=1.15);for(const p of row.points)assert.ok(sourceIndex.clearAt(p[0],p[2],12));}assert.equal(geometry.props.filter(p=>p.kind==='harvest-fork-wayfinding').length,2);
});
test('visible barn tool racks join wall cladding through actual transverse mounting brackets',()=>{
  const racks=components('barn-tool-supported-rack'),brackets=components('barn-rack-wall-bracket'),cladding=components('barn-recessed-side-plank');assert.equal(brackets.length,12);for(const rack of racks){const supports=brackets.filter(b=>intersects(b,rack));assert.equal(supports.length,2);for(const support of supports)assert.ok(cladding.some(c=>intersects(c,support)),'wall bracket penetrates real cladding');}
});
test('roof rafters visibly bridge the farm shelter support gaps',()=>{
  for(const [rafters,base,roof]of [['granary-wall-seated-roof-rafter','granary-solid-plaster-body','granary-pitched-tile-roof'],['press-beam-seated-roof-rafter','press-post-seated-crossbeam','press-supported-pitched-roof'],['market-beam-seated-canopy-rafter','market-post-seated-beam','market-asymmetric-cloth-roof']])for(const r of components(rafters)){assert.ok(components(base).some(c=>intersects(c,r)),rafters+' support');assert.ok(components(roof).some(c=>intersects(c,r)),rafters+' roof');}
});
test('every emitted coping face has upward winding on both lateral sides',()=>{
  const b=byName.get('Harvest pale yard pavers and coping')!,ranges=new Map<number,typeof geometry.components[number]>();for(const c of components('road-edge-coping'))for(let i=c.vertexStart;i<c.vertexEnd;i++)ranges.set(i,c);for(let i=0;i<b.indices.length;i+=3){const ids=b.indices.slice(i,i+3),c=ranges.get(ids[0]);if(!c)continue;assert.ok(ids.every(v=>ranges.get(v)===c));const [a,v,w]=ids.map(k=>vec(b.positions.slice(k*3,k*3+3)));assert.ok(new pc.Vec3().cross(v.sub(a),w.sub(a)).y>0);}
});
test('fork boards use exact rendered camera triangles in the outer orbit corridor',()=>{
  const blocker=geometry.cameraObstacles.find(o=>o.kind==='fork-wayfinding-exact-triangles')!;assert.ok(blocker?.triangles&&blocker.triangles.length>70);
  const anchor={x:78.4749218968,y:17.3296434184,z:118.8635685598},desired={x:89.4037291356,y:19.4655912143,z:130.9875627817};const safe=safeLandCamera(anchor,desired,[blocker]);assert.ok(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.05);
});
