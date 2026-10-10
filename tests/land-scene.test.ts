import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildLandSceneGeometry,createLandScene,landTexturePixels} from '../src/land-scene';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
import {DYNAMIC_PICKUP_CAPACITY} from '../src/dynamic-pickups';

const geometry=buildLandSceneGeometry(MOUNTAIN_TRACK);
function application(){
  const canvas={id:'mountain-test',width:1280,height:720,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}} as any;
  const app=new pc.AppBase(canvas),options=new pc.AppOptions();options.graphicsDevice=new pc.NullGraphicsDevice(canvas);
  options.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];options.devtools=false;app.init(options);return app;
}

test('mountain original geometry has bounded material batches, finite triangles, UVs and world bounds',()=>{
  assert.equal(geometry.trackId,'mountain');assert.ok(geometry.batches.length<=24);
  let vertices=0,triangles=0;
  for(const batch of geometry.batches){
    assert.ok(batch.positions.length%3===0);assert.ok(batch.indices.length%3===0);
    assert.equal(batch.uvs.length,batch.positions.length/3*2);
    assert.ok(batch.positions.every(Number.isFinite));assert.ok(batch.uvs.every(Number.isFinite));
    assert.ok(batch.indices.every(i=>Number.isInteger(i)&&i>=0&&i<batch.positions.length/3));
    assert.ok(batch.roughness>=0&&batch.roughness<=1);
    vertices+=batch.positions.length/3;triangles+=batch.indices.length/3;
  }
  assert.ok(vertices<190_000,`vertices ${vertices}`);assert.ok(triangles<110_000,`triangles ${triangles}`);
  assert.ok(geometry.bounds.min.every(Number.isFinite));assert.ok(geometry.bounds.max.every(Number.isFinite));
  assert.ok(geometry.bounds.max[0]-geometry.bounds.min[0]<1800);
  assert.ok(geometry.bounds.max[2]-geometry.bounds.min[2]<1800);
  assert.ok(!geometry.batches.some(batch=>/water|ocean|reservoir/i.test(batch.name)));
});

test('rendered road follows exact width, grade and bank from shared source sampler',()=>{
  assert.equal(geometry.roadSamples.length,960);
  let banked=0;
  for(const s of geometry.roadSamples){
    const w=MOUNTAIN_TRACK.halfWidthAt(s.distance);
    for(const [lateral,actual] of [[-w,s.left],[w,s.right]] as const){
      const p=MOUNTAIN_TRACK.sample(s.distance,lateral).p;
      assert.ok(p.distance(new pc.Vec3(...actual))<1e-8);
    }
    if(Math.abs(s.left[1]-s.right[1])>.25)banked++;
  }
  assert.ok(banked>100);
  const roadBatches=geometry.batches.filter(b=>/banked tarmac|aggregate tarmac|stone roadway/.test(b.name));
  assert.equal(roadBatches.reduce((n,b)=>n+b.positions.length/12,0),960);
});

test('original roadside props respect all racing corridors and contain detailed land landmarks',()=>{
  const counts=new Map<string,number>();
  for(const p of geometry.props){
    assert.ok(MOUNTAIN_TRACK.clearAt(p.x,p.z,p.radius),`${p.kind} intrudes at ${p.x},${p.z}`);
    counts.set(p.kind,(counts.get(p.kind)??0)+1);
  }
  assert.ok(counts.get('roadside-rock')!>=55);assert.ok(counts.get('spruce')!>=180);
  assert.ok(counts.get('viaduct-pier')!>=20);assert.equal(counts.get('lookout-chalet'),1);
  assert.ok(geometry.structures.some(s=>s.kind==='viaduct'));
  assert.ok(!geometry.structures.some(s=>s.kind==='gallery'),'no tunnel may be invented without a matching track section');
});

test('mountain procedural textures are deterministic, original and nonuniform',()=>{
  for(const kind of ['stone','asphalt','wood','grass'] as const){
    const pixels=landTexturePixels(kind);assert.equal(pixels.length,64*64*4);
    assert.deepEqual(pixels,landTexturePixels(kind));assert.ok(new Set(pixels.filter((_,i)=>i%4===0)).size>15);
    assert.ok(pixels.filter((_,i)=>i%4===3).every(v=>v===255));
  }
});

test('NullGraphicsDevice preview stays within 24 static draws and does not allocate gameplay pools',()=>{
  const app=application();try{
    const world=createLandScene(app as pc.Application,MOUNTAIN_TRACK,{preview:true});
    assert.equal(world.boxes.length,0);assert.equal(world.flames.length,0);assert.equal(world.particles.length,0);assert.equal(world.shield.enabled,false);
    const renders=world.root.findComponents('render') as pc.RenderComponent[];
    assert.equal(renders.length,geometry.batches.length);assert.ok(renders.length<=24);
    for(const r of renders)for(const mi of r.meshInstances){
      assert.ok([mi.aabb.center.x,mi.aabb.center.y,mi.aabb.center.z,mi.aabb.halfExtents.x,mi.aabb.halfExtents.y,mi.aabb.halfExtents.z].every(Number.isFinite));
      assert.ok(mi.mesh.vertexBuffer.getNumVertices()>0);
    }
    assert.equal(world.buildProps(new Map()),world.buildProps(new Map()));
    const textureMaterials=renders.map(r=>r.meshInstances[0].material as pc.StandardMaterial).filter(m=>m.diffuseMap);
    assert.ok(textureMaterials.length>=8);assert.equal(new Set(textureMaterials.map(m=>m.diffuseMap)).size,4);
    world.oceanMaterial.setParameter('time',4);assert.equal((world.oceanMaterial.getParameter('time') as {data:number}).data,4);
    world.destroy();assert.ok(!app.root.findByName('Alpine chase camera'));assert.ok(!app.root.findByName('Alpine afternoon key light'));
  }finally{app.destroy();}
});

test('NullGraphicsDevice race allocates source-derived pickups and bounded reusable effects',()=>{
  const app=application();try{
    const world=createLandScene(app as pc.Application,MOUNTAIN_TRACK);
    assert.equal(world.boxes.length,MOUNTAIN_TRACK.pickups.length+DYNAMIC_PICKUP_CAPACITY);
    for(const b of world.boxes.filter(b=>!b.dynamic)) {
      const p=MOUNTAIN_TRACK.sample(b.d,b.lateral).p;p.y+=1.25;
      assert.ok(b.mesh.getPosition().distance(p)<1e-4);assert.equal(b.base,p.y);
    }
    assert.ok(world.boxes.filter(b=>b.dynamic).every(b=>!b.mesh.enabled));
    assert.equal(world.flames.length,2);assert.equal(world.particles.length,160);assert.ok(world.particles.every(p=>!p.enabled));
    world.destroy();
  }finally{app.destroy();}
});

test('terrain stays below both racing levels and viaduct leaves real underpass headroom',()=>{
  const terrain=geometry.batches.find(b=>b.name==='Forest valley floor')!;
  const ps=terrain.positions,x0=ps[0],z0=ps[2],dx=ps[3]-x0;
  let columns=1;while(columns<ps.length/3&&ps[columns*3+2]===z0)columns++;
  const dz=ps[columns*3+2]-z0;
  const y=(x:number,z:number)=>{
    const gx=(x-x0)/dx,gz=(z-z0)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
    const i=iz*columns+ix,a=ps[i*3+1],b=ps[(i+1)*3+1],c=ps[(i+columns)*3+1],d=ps[(i+columns+1)*3+1];
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  };
  for(let i=0;i<1000;i++){
    const d=i/1000*MOUNTAIN_TRACK.length,w=MOUNTAIN_TRACK.halfWidthAt(d);
    for(const lateral of [-w,0,w]){const p=MOUNTAIN_TRACK.sample(d,lateral).p;assert.ok(y(p.x,p.z)<p.y-2,`terrain intersects road at ${d},${lateral}`);}
  }
  const bridge=geometry.structures.find(s=>s.kind==='viaduct')!;
  assert.ok(bridge.overheadClearance>29,`underpass headroom ${bridge.overheadClearance}`);
});
