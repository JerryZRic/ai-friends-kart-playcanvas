import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createWaterparkDesign, sampleWaterpark, sampleWaterparkLoop, SAMPLE_LENGTH, WATER_HALF_WIDTH, WATER_RACE_LENGTH, WATER_RACE_POINTS, waterCircuit, waterparkCurvature, createWaterparkRaceLand, WATER_RACE_LAND_CENTER, WATER_RACE_BRIDGE_DISTANCE, WATER_RACE_PICKUPS, waterparkBridgeDistance} from '../src/waterpark-design';
import {createWaterparkBedDesign, sampleWaterparkBedDepth, WATERPARK_BED_LANES} from '../src/waterpark-bed';
import {createWaterparkEnvironmentDetails} from '../src/waterpark-environment';
import {createWaterparkScene} from '../src/waterpark-scene';
import {createWaterparkWake, waterparkEffectGeometry} from '../src/waterpark-wake';

const race = {race: true};
const near = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const same = (a: number[], b: number[], tolerance = 1e-9) => {assert.equal(a.length, b.length); a.forEach((value, index) => near(value, b[index], tolerance));};
const xyz = (p: pc.Vec3) => [p.x, p.y, p.z];

function fixture() {
  const canvas = {id: 'waterpark-loop-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.devtools = false; app.init(options); return app;
}

test('the beginner canal has two true S sequences, metre travel and a smooth closed seam', () => {
  assert.equal(SAMPLE_LENGTH, 285, 'study route is preserved');
  assert.equal(sampleWaterpark(270).angle, 1.75);
  assert.ok(WATER_RACE_LENGTH>700&&WATER_RACE_LENGTH<780);
  const joins=Array.from({length:WATER_RACE_POINTS.length},(_,i)=>waterCircuit.arcs[i*waterCircuit.arcSteps/WATER_RACE_POINTS.length]);
  for (const lane of [-WATER_HALF_WIDTH,-9.8,0,9.8,WATER_HALF_WIDTH]) {
    for (const d of [-1000,-3,0,91,183,330,480,WATER_RACE_LENGTH,1000]) {
      const a=sampleWaterparkLoop(d,lane),b=sampleWaterparkLoop(d+WATER_RACE_LENGTH,lane);
      same(xyz(a.p),xyz(b.p));same(xyz(a.t),xyz(b.t));same(xyz(a.n),xyz(b.n));
      near(a.t.length(),1);near(a.n.length(),1);near(a.t.dot(a.n),0);
    }
    for (const d of [0,...joins,WATER_RACE_LENGTH]) {
      const before=sampleWaterparkLoop(d-1e-5,lane),at=sampleWaterparkLoop(d,lane),after=sampleWaterparkLoop(d+1e-5,lane);
      assert.ok(before.p.distance(after.p)<.00004);
      assert.ok(before.t.distance(after.t)<.000002);
      assert.ok(after.p.clone().sub(before.p).normalize().dot(at.t)>.99999,'no reversed/cusped water bank at a join');
    }
  }
  let negativeLength=0,negativeAngle=0,readableCounterTurns=0;
  const finishCounterTurn=()=>{if(negativeLength>25&&negativeAngle>.25)readableCounterTurns++;negativeLength=negativeAngle=0;};
  for(let d=0;d<WATER_RACE_LENGTH;d+=.5){
    const a=sampleWaterparkLoop(d),b=sampleWaterparkLoop(d+.25);
    assert.ok(Math.abs(a.p.distance(b.p)-.25)<.002,'travel is metres, including control knots');
    assert.equal(a.p.y,0);assert.ok(Math.abs(waterCircuit.curvature(d,1))<1/32,'beginner curve radius stays above32m');
    const bend=waterparkCurvature(d);if(bend<-.001){negativeLength+=.5;negativeAngle-=bend*.5;}else finishCounterTurn();
  }
  finishCounterTurn();assert.equal(readableCounterTurns,2,'two distinct left/right S sequences change actual driving geometry');
  for (const invalid of [NaN,Infinity,-Infinity]) assert.ok(xyz(sampleWaterparkLoop(invalid,invalid).p).every(Number.isFinite));
});

test('race meshes are deterministic, finite and keep one gapless non-inverted canal', () => {
  const design = createWaterparkDesign(race), details = createWaterparkEnvironmentDetails(race), bed = createWaterparkBedDesign(race);
  assert.deepEqual(design, createWaterparkDesign(race));
  assert.deepEqual(details, createWaterparkEnvironmentDetails(race));
  assert.deepEqual(bed, createWaterparkBedDesign(race));
  const meshes = [...design, ...details, ...bed];
  assert.equal(meshes.filter(mesh => mesh.water).length, 1);
  assert.ok(meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0) < 125000);
  for (const mesh of meshes) {
    assert.equal(mesh.positions.length % 3, 0); assert.equal(mesh.indices.length % 3, 0);
    assert.ok(mesh.positions.every(Number.isFinite)); assert.ok(mesh.uvs.every(Number.isFinite));
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
    assert.ok(mesh.positions.length / 3 < 65536, 'every merged batch retains 16-bit indices');
  }
  const water = design.find(mesh => mesh.water)!, rows = Math.ceil(WATER_RACE_LENGTH / 1.3);
  assert.equal(water.positions.length, 24 * rows * 12);
  assert.equal(water.uvs.length, water.positions.length / 3 * 2);
  let area = 0;
  for (let lane = 0; lane < 24; lane++) {
    const first = lane * rows * 12, last = first + (rows - 1) * 12;
    same(water.positions.slice(first, first + 6), water.positions.slice(last + 6, last + 12));
    for (let row = 0; row < rows; row++) {
      const i = first + row * 12;
      if (row + 1 < rows) same(water.positions.slice(i + 6, i + 12), water.positions.slice(i + 12, i + 18));
      if (lane + 1 < 24) {
        const adjacent = i + rows * 12;
        same(water.positions.slice(i + 3, i + 6), water.positions.slice(adjacent, adjacent + 3));
        same(water.positions.slice(i + 9, i + 12), water.positions.slice(adjacent + 6, adjacent + 9));
      }
    }
  }
  for (let i = 0; i < water.indices.length; i += 3) {
    const [a, b, c] = water.indices.slice(i, i + 3).map(index => new pc.Vec3(...water.positions.slice(index * 3, index * 3 + 3) as [number, number, number]));
    const normal = new pc.Vec3().cross(b.sub(a), c.sub(a)); assert.ok(normal.y > 0, 'every water triangle faces up'); area += normal.y / 2;
  }
  near(area / (WATER_RACE_LENGTH * WATER_HALF_WIDTH * 2), 1, .0001);
});

test('submerged basin closes at identical depths and covers every lane for the whole lap', () => {
  const floor = createWaterparkBedDesign(race)[0], columns = WATERPARK_BED_LANES.length, rows = Math.ceil(WATER_RACE_LENGTH / 2) + 1;
  assert.equal(floor.positions.length, rows * columns * 3);
  same(floor.positions.slice(0, columns * 3), floor.positions.slice(-columns * 3));
  const normals = pc.calculateNormals(floor.positions, floor.indices);
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const d = Math.min(WATER_RACE_LENGTH, row * 2), lane = WATERPARK_BED_LANES[col], p = sampleWaterparkLoop(d, lane).p, i = (row * columns + col) * 3;
    same(floor.positions.slice(i, i + 3), [p.x, -sampleWaterparkBedDepth(d, lane, race), p.z]);
    assert.ok(normals[i + 1] > .5, 'no inverted shoulders or bottom');
  }
  for (const lane of WATERPARK_BED_LANES) {
    near(sampleWaterparkBedDepth(0, lane, race), sampleWaterparkBedDepth(WATER_RACE_LENGTH, lane, race));
    near(sampleWaterparkBedDepth(-1e-4, lane, race), sampleWaterparkBedDepth(1e-4, lane, race), 1e-6);
  }
});

test('wake geometry crosses the finish without teleporting or clamping at the study limit', () => {
  for (const distance of [0, 285, 400, WATER_RACE_LENGTH - .05, WATER_RACE_LENGTH + .05]) {
    const a = waterparkEffectGeometry(distance, 7, 28, 6.25, -5, race), b = waterparkEffectGeometry(distance + WATER_RACE_LENGTH, 7, 28, 6.25, -5, race);
    for (const key of ['positions', 'contact', 'spray'] as const) {assert.ok(a[key].every(Number.isFinite)); same(a[key], b[key]);}
  }
  const before = waterparkEffectGeometry(WATER_RACE_LENGTH - .001, 0, 28, 4, 0, race);
  const after = waterparkEffectGeometry(WATER_RACE_LENGTH + .001, 0, 28, 4, 0, race);
  same(before.positions, after.positions, .003);
  assert.notDeepEqual(waterparkEffectGeometry(285, 0, 28, 4, 0, race).positions, waterparkEffectGeometry(400, 0, 28, 4, 0, race).positions);
});

test('race scene camera and runtime wake wrap and safely release on repeated exit', () => {
  const app = fixture();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const scene = createWaterparkScene(app as pc.Application, race), wake = createWaterparkWake(app as pc.Application, scene.root, race);
      assert.equal(scene.root.name, 'Waterpark closed-loop race'); assert.ok(scene.triangles < 125000);
      scene.setCamera(0); const position = scene.camera.getPosition().clone(), rotation = scene.camera.getRotation().clone();
      scene.setCamera(WATER_RACE_LENGTH); same(xyz(position), xyz(scene.camera.getPosition())); near(Math.abs(rotation.dot(scene.camera.getRotation())), 1);
      for (const d of [WATER_RACE_LENGTH - 1, WATER_RACE_LENGTH, WATER_RACE_LENGTH + 1]) wake.update(d, 0, 28, 3);
      assert.equal(wake.entity.enabled, true);
      scene.root.destroy(); wake.dispose(); wake.update(2, 0, 28, 4);
      assert.equal(app.scene.layers.getLayerByName('Waterpark reflected static scenery'), null);
    }
  } finally {app.destroy();}
});

test('filled garden and exterior terrain stay upright, gapless and clear of the whole canal',()=>{
 const grass=createWaterparkRaceLand(),rows=Math.ceil(WATER_RACE_LENGTH/2);
 const count=grass.indices.length,route=Array.from({length:Math.ceil(WATER_RACE_LENGTH/3)},(_,i)=>sampleWaterparkLoop(i*3));
 const cross=(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 const inside=(p:pc.Vec3,a:pc.Vec3,b:pc.Vec3,c:pc.Vec3)=>{
  const signs=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];
  return signs.every(v=>v>1e-7)||signs.every(v=>v< -1e-7);
 };
 for(let i=0;i<count;i+=3){
  const [a,b,c]=grass.indices.slice(i,i+3).map(index=>new pc.Vec3(...grass.positions.slice(index*3,index*3+3) as [number,number,number]));
  assert.ok(new pc.Vec3().cross(b.clone().sub(a),c.clone().sub(a)).y>0,'grass cannot fold through an S bend');
  for(const frame of route)for(const lane of[-11.8,0,11.8]){
   const p=frame.p.clone().add(frame.n.clone().mulScalar(lane));
   assert.equal(inside(p,a,b,c),false,'land cannot cover another section of water');
  }
 }
 const intersects=(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3,d:pc.Vec3)=>cross(a,b,c)*cross(a,b,d)<-1e-7&&cross(c,d,a)*cross(c,d,b)<-1e-7;
 const edges=[-1,1].map(side=>Array.from({length:rows},(_,i)=>{
  const d=i/rows*WATER_RACE_LENGTH,p=sampleWaterparkLoop(d,side*18.15).p;
  if(side<0){p.x=WATER_RACE_LAND_CENTER.x+(p.x-WATER_RACE_LAND_CENTER.x)*1.55;p.z=WATER_RACE_LAND_CENTER.z+(p.z-WATER_RACE_LAND_CENTER.z)*1.55;}
  return p;
 }));
 // Shared geometric edges are exact, including the seam: the garden has one
 // continuous fan and the exterior has one continuous closed apron.
 for(let i=0;i<rows;i++){
  const next=(i+1)%rows,at=i*21,to=next*21;
  same(grass.positions.slice(at+6,at+9),grass.positions.slice(to+3,to+6));
  same(grass.positions.slice(at+15,at+21),grass.positions.slice(to+9,to+15));
 }

 for(const [side,edge]of edges.entries())for(let i=0;i<rows;i++){
  for(let j=i+2;j<rows;j++)if(!(i===0&&j===rows-1))assert.equal(intersects(edge[i],edge[(i+1)%rows],edge[j],edge[(j+1)%rows]),false,'a land edge cannot cross itself');
  if(side===0)for(let j=0;j<rows;j++)assert.equal(intersects(edge[i],edge[(i+1)%rows],edges[1][j],edges[1][(j+1)%rows]),false,'facing land margins cannot overlap');
 }
});

test('the bridge has one straight anchor and authored pickup lines stay fair and inside banks',()=>{
 assert.equal(waterparkBridgeDistance(),183,'study bridge is unchanged');
 assert.equal(waterparkBridgeDistance(race),WATER_RACE_BRIDGE_DISTANCE);
 assert.ok(Math.abs(waterparkCurvature(WATER_RACE_BRIDGE_DISTANCE))<.006,'bridge sits on a calm approach');
 assert.ok(Object.isFrozen(WATER_RACE_PICKUPS));assert.equal(WATER_RACE_PICKUPS.length,14);
 assert.ok(WATER_RACE_PICKUPS.some(p=>p.lateral===0)&&WATER_RACE_PICKUPS.some(p=>p.lateral< -4)&&WATER_RACE_PICKUPS.some(p=>p.lateral>4));
 for(const pickup of WATER_RACE_PICKUPS){assert.ok(Object.isFrozen(pickup));assert.ok(pickup.d>0&&pickup.d<WATER_RACE_LENGTH);assert.ok(Math.abs(pickup.lateral)<=5.2);}
 const app=fixture();try{
  const scene=createWaterparkScene(app as pc.Application,race);
  near((scene.waterMaterial.getParameter('bridgeShadow') as {data:Float32Array}).data[0],WATER_RACE_BRIDGE_DISTANCE,.0001);
  assert.ok(scene.triangles<125000,`actual scene including sky has ${scene.triangles} triangles`);
  scene.root.destroy();
 }finally{app.destroy();}
});

test('race land honors an adapter sampler instead of leaving terrain at the default route',()=>{
 const base=createWaterparkRaceLand(),offset=new pc.Vec3(70,0,-40);
 const sampler=(d:number,lane=0)=>{const frame=sampleWaterparkLoop(d,lane);frame.p.add(offset);return frame;};
 const shifted=createWaterparkRaceLand({race:true,sampler});assert.deepEqual(shifted.indices,base.indices);
 for(let i=0;i<base.positions.length;i+=3)same(shifted.positions.slice(i,i+3),[base.positions[i]+70,base.positions[i+1],base.positions[i+2]-40]);
 const design=createWaterparkDesign({race:true,sampler}),grass=design.find(mesh=>mesh.name==='Mint green planted banks')!;
 same(grass.positions.slice(0,shifted.positions.length),shifted.positions);
 assert.throws(()=>createWaterparkRaceLand({race:true,extent:{start:0,end:200}}),/closed sampler/,'partial open geometry must not pretend to be a closed land island');
});
