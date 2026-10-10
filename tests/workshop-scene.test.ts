import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildWorkshopSceneGeometry,WORKSHOP_SCENE_THEME} from '../src/workshop-scenery';
import {WORKSHOP_COURSE,WORKSHOP_ROAD_EDGES} from '../src/maps/workshop';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,roadFootprint,sampleRoadFootprints} from '../src/land-road-mesh';
import {cameraTerrainHeight,safeLandCamera} from '../src/land-camera';
const geometry=buildWorkshopSceneGeometry(WORKSHOP_COURSE),sourceIndex=new RoadFootprintIndex(sampleRoadFootprints(WORKSHOP_ROAD_EDGES,2));
const vec=(p:number[])=>new pc.Vec3(...p),floor=geometry.batches.find(b=>b.name==='Workshop joined maple room floor')!;
test('original workshop finite indexed static geometry obeys actual hard scene budgets',()=>{
  assert.equal(geometry.trackId,'workshop');assert.equal(geometry.batches.length,21);let vertices=0,triangles=0;
  for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
  assert.deepEqual(geometry.budget,{batches:21,triangles,vertices});assert.ok(triangles<110000);assert.ok(vertices<200000);assert.ok(triangles>85000);assert.equal(WORKSHOP_SCENE_THEME.textureLabel,'clockwind handmade maple');
  assert.equal(geometry.landmarks.length,6);assert.equal(geometry.props.filter(p=>p.kind==='workshop-fork-wayfinding').length,2);
});
test('road is exact sampled support with paired underside and one coplanar source owner',()=>{
  assert.equal(geometry.routeRoadSamples.length,WORKSHOP_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/2),0));
  for(const s of geometry.routeRoadSamples){const e=WORKSHOP_ROAD_EDGES.find(e=>e.id===s.edgeId)!;for(const [l,p]of [[-e.halfWidthAt(s.distance),s.left],[e.halfWidthAt(s.distance),s.right]] as const)assert.ok(e.sample(s.distance,l).p.distance(vec(p))<1e-8);}
  assert.equal(geometry.roadFaces.length,geometry.roadUndersideFaces.length);for(let i=0;i<geometry.roadFaces.length;i++)for(let j=0;j<3;j++){const a=geometry.roadFaces[i].points[j],b=geometry.roadUndersideFaces[i].points[2-j];assert.ok(Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])<1e-8);assert.ok(Math.abs(a[1]-b[1]-.45)<1e-8);}
  const faces=geometry.roadFaces.map(f=>roadFootprint(WORKSHOP_ROAD_EDGES.find(e=>e.id===f.edgeId)!,f.distance,f.points.map(vec))),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((f,i)=>[f,i]));let count=0;
  for(const a of faces)for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){if(ids.get(a)!>=ids.get(b)!||a.edge===b.edge||Math.max(a.maxY,b.maxY)-Math.min(a.minY,b.minY)>.005)continue;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-6);count++;}assert.ok(count>200);
});
test('floor camera support is identical to the emitted joined panel triangulation',()=>{
  const f=geometry.terrainGrid;assert.equal(f.heights.length,floor.positions.length/3);for(let i=0;i<f.heights.length;i++)assert.equal(f.heights[i],floor.positions[i*3+1]);
  let index=0;for(let z=0;z<f.rows-1;z++)for(let x=0;x<f.columns-1;x++){const i=z*f.columns+x;assert.deepEqual(floor.indices.slice(index,index+6),[i,i+f.columns,i+1,i+1,i+f.columns,i+f.columns+1]);index+=6;}
  const ground=geometry.cameraObstacles.find(o=>o.heightfield)!;for(let n=0;n<120;n++){const x=-480+n*7.8,z=-380+(n*19)%570,h=cameraTerrainHeight(f,x,z)!;assert.ok(safeLandCamera({x,y:h+10,z},{x,y:h-10,z},[ground]).y>h+.45);}
});
test('all leg footprints actually penetrate the exact floor surface',()=>{
  assert.ok(geometry.groundedDetails.length>70);for(const d of geometry.groundedDetails){assert.ok(d.bottom<d.terrainY);for(const p of d.footprint)assert.ok(d.bottom<cameraTerrainHeight(geometry.terrainGrid,p[0],p[2])!);}
});
test('whole landmark vertices remain inside surveyed road-clear cylinders and height reservations',()=>{
  const byName=new Map(geometry.batches.map(b=>[b.name,b]));for(const l of geometry.landmarks){assert.ok(sourceIndex.clearAt(l.position[0],l.position[2],l.radius+19.9));const parts=geometry.components.filter(c=>c.landmark===l.kind);assert.ok(parts.length>8,l.kind);for(const c of parts){const batch=byName.get(c.batch)!;for(let i=c.vertexStart*3;i<c.vertexEnd*3;i+=3){const x=batch.positions[i],y=batch.positions[i+1],z=batch.positions[i+2];assert.ok(Math.hypot(x-l.position[0],z-l.position[2])<=l.radius+1e-8,`${l.kind} ${c.kind} radial footprint`);assert.ok(y<=l.position[1]+l.height+1e-8,`${l.kind} ${c.kind} height`);}}}
});
test('clock teeth and spokes, drawers, vise, square and lamp are actual source details',()=>{
  assert.deepEqual(geometry.gears.map(g=>g.teeth),[24,18,30,36]);assert.ok(geometry.gears.every(g=>g.innerRadius>g.radius*.5&&g.spokes>=5));assert.equal(geometry.drawers.filter(d=>d.kind==='cabinet-bank').length,9);assert.equal(geometry.drawers.filter(d=>d.kind==='return-terrace').length,9);assert.ok(geometry.drawers.every(d=>d.recess>0&&d.handleDepth>1));
  for(const name of ['modeled-tooth-gear-ring','open-gear-spoke','clock-dial-raised-tick','drawer-rounded-loop-handle','vise-modeled-threaded-screw','vise-leather-jaw-pad','drafting-square-hypotenuse','hand-plane-coiled-wood-shaving','lamp-turned-shaft','lamp-copper-lower-arm','lamp-recessed-amber-diffuser','return-grade-following-drawer-fascia'])assert.ok(geometry.components.some(c=>c.kind===name),name);
});
test('open crossing preserves thin elevated structure and no phantom full-height camera volume',()=>{
  assert.equal(geometry.bridgeMembers.length,2);for(const m of geometry.bridgeMembers)for(const p of m.points)assert.ok(p[1]>=33.6);
  const bridge=geometry.cameraObstacles.find(o=>o.triangles)!;assert.ok(bridge.triangles!.length>3000);
  const a={x:110.81068432623896,y:11,z:-70},d={x:114,y:23,z:-68};assert.deepEqual(safeLandCamera(a,d,[bridge]),d);
  const up={x:110.81068432623896,y:38,z:-70},upD={x:110.81068432623896,y:25,z:-70};assert.ok(safeLandCamera(up,upD,[bridge]).y>35.5);
});
test('source component bounds and affine rail camera pieces match actual thin geometry',()=>{
  const byName=new Map(geometry.batches.map(b=>[b.name,b]));for(const c of geometry.components){const b=byName.get(c.batch)!,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=c.vertexStart*3;i<c.vertexEnd*3;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}assert.deepEqual(c.min,min);assert.deepEqual(c.max,max);}
  const rails=geometry.cameraObstacles.filter(o=>o.kind==='exposed-workshop-road-rail-camera-piece');assert.ok(rails.length>3000);assert.ok(rails.every(o=>Math.hypot(o.max[0]-o.min[0],o.max[2]-o.min[2])<1.65));assert.ok(!geometry.cameraObstacles.some(o=>o.kind==='exposed-workshop-road-rail'));
});
test('exact source rail faces protect the three near-edge poses hidden by expanded AABB escape',()=>{
  const exact=geometry.cameraObstacles.find(o=>o.kind==='exact-exposed-rail-triangles')!;assert.ok(exact.triangles!.length>4000);
  const cases=[['boulevard',296,-1,-Math.PI/2],['finish',624,-1,-Math.PI/2],['finish',624,1,Math.PI/2]] as const;
  for(const [id,s,lane,yaw]of cases){const edge=WORKSHOP_COURSE.edges[id],f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},n=Math.hypot(f.t.x,f.t.z),x=f.t.x/n,z=f.t.z/n,forward={x:x*Math.cos(yaw)-z*Math.sin(yaw),z:x*Math.sin(yaw)+z*Math.cos(yaw)},radius=Math.hypot(10.5,3.6),elevation=Math.max(.08,Math.atan2(3.6,10.5)-.28),desired={x:f.p.x-forward.x*radius*Math.cos(elevation),y:f.p.y+1+radius*Math.sin(elevation),z:f.p.z-forward.z*radius*Math.cos(elevation)};
    const boxesOnly=safeLandCamera(anchor,desired,geometry.cameraObstacles.filter(o=>o!==exact)),safe=safeLandCamera(anchor,desired,geometry.cameraObstacles),distance=(p:{x:number;y:number;z:number})=>Math.hypot(p.x-anchor.x,p.y-anchor.y,p.z-anchor.z);
    assert.ok(distance(boxesOnly)-distance(safe)>.15,`${id}:${s}:${lane} retains true source margin`);
  }
});
test('clock gear and dial shafts physically join rear crossmembers carried by turned columns',()=>{
  const members=geometry.components.filter(c=>c.kind==='clock-supported-rear-crossmember'),shafts=geometry.components.filter(c=>c.kind==='gear-axle'||c.kind==='clock-dial-frame-shaft'),columns=geometry.components.filter(c=>c.kind==='clock-turned-frame-column');assert.equal(members.length,5);assert.equal(shafts.length,6);
  const intersects=(a:typeof members[number],b:typeof members[number])=>[0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-5);
  const byName=new Map(geometry.batches.map(b=>[b.name,b]));
  for(const shaft of shafts){const frame=members.find(m=>intersects(m,shaft));assert.ok(frame,shaft.kind+' lacks frame connection');const b=byName.get(shaft.batch)!,points=Array.from({length:shaft.vertexEnd-shaft.vertexStart},(_,i)=>b.positions.slice((shaft.vertexStart+i)*3,(shaft.vertexStart+i)*3+3));assert.ok(points.some(p=>[0,1,2].every(k=>p[k]>=frame!.min[k]&&p[k]<=frame!.max[k])),'shaft source cap must penetrate crossmember volume');}
  for(const member of members){assert.ok(columns.filter(c=>intersects(c,member)).length>=2,'both ends of every frame crossmember are carried by original turned columns');const b=byName.get(member.batch)!;for(const side of [-1,1]){const x=side<0?member.min[0]:member.max[0],p=[x,(member.min[1]+member.max[1])/2,(member.min[2]+member.max[2])/2];assert.ok(columns.some(c=>[0,1,2].every(k=>p[k]>=c.min[k]&&p[k]<=c.max[k])));}}
});
test('complete cabinet tool zone clears every crown and actual peg caps join both tools and the supported board',()=>{
  const parts=geometry.components.filter(c=>c.landmark==='tool-cabinet-bank'),board=parts.find(c=>c.kind==='cabinet-joined-backboard')!,crowns=parts.filter(c=>c.kind==='cabinet-crown-lip'),pegs=parts.filter(c=>c.kind==='pegboard-modeled-peg-collar'),tools=parts.filter(c=>/^pegboard-(ruler-tool|mallet-|caliper-)/.test(c.kind)),holes=parts.filter(c=>c.kind==='pegboard-recessed-hole'),crownY=Math.max(...crowns.map(c=>c.max[1]));
  assert.equal(pegs.length,4);assert.equal(tools.length,6);assert.equal(holes.length,85);assert.equal(board.max[1]-board.min[1],45);
  for(const c of [...tools,...pegs,...holes])assert.ok(c.min[1]>crownY+1,`${c.kind} must be fully above all drawer crowns`);
  const byName=new Map(geometry.batches.map(b=>[b.name,b]));
  const contains=(c:typeof board,p:number[])=>{
    const b=byName.get(c.batch)!,center=c.min.map((n,k)=>(n+c.max[k])/2),dot=(a:number[],v:number[])=>a.reduce((sum,n,k)=>sum+n*v[k],0),sub=(a:number[],v:number[])=>a.map((n,k)=>n-v[k]);
    for(let i=0;i<b.indices.length;i+=3){const ids=b.indices.slice(i,i+3);if(!ids.every(k=>k>=c.vertexStart&&k<c.vertexEnd))continue;const [a,v,w]=ids.map(k=>b.positions.slice(k*3,k*3+3)),u=sub(v,a),q=sub(w,a),n=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]],inside=dot(n,sub(center,a)),probe=dot(n,sub(p,a));if(inside*probe< -1e-7)return false;}
    return true;
  };
  for(const peg of pegs){const b=byName.get(peg.batch)!,root=b.positions.slice((peg.vertexEnd-2)*3,(peg.vertexEnd-2)*3+3),tip=b.positions.slice((peg.vertexEnd-1)*3,(peg.vertexEnd-1)*3+3);assert.ok(contains(board,root),'actual rear peg cap must penetrate supported board');assert.ok(tools.some(c=>contains(c,tip)),'actual forward peg cap must penetrate a tool');}
  const plinth=parts.find(c=>c.kind==='cabinet-bottom-plinth')!;assert.ok(contains(plinth,[(board.min[0]+board.max[0])/2,board.min[1]+.1,(board.min[2]+board.max[2])/2]),'continuous board reaches its existing mounted plinth');
});
