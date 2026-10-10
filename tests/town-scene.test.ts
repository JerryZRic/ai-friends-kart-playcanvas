import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildTownSceneGeometry,TOWN_SCENE_THEME} from '../src/town-scenery';
import {TOWN_COURSE,TOWN_TRACK,TOWN_ROAD_EDGES} from '../src/maps/town';
import {createLandScene,MOUNTAIN_SCENE_THEME,buildLandSceneGeometry} from '../src/land-scene';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
const geometry=buildTownSceneGeometry(TOWN_COURSE);
function application(){
  const canvas={id:'town-test',width:1280,height:720,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}} as any;
  const app=new pc.AppBase(canvas),options=new pc.AppOptions();options.graphicsDevice=new pc.NullGraphicsDevice(canvas);
  options.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];options.devtools=false;app.init(options);return app;
}
test('town is original detailed architecture within static mesh and texture budgets',()=>{
  assert.equal(geometry.trackId,'town');assert.ok(geometry.batches.length<=24);
  let vertices=0,triangles=0;
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  assert.ok(vertices<190000,`vertices ${vertices}`);assert.ok(triangles<110000,`triangles ${triangles}`);
  assert.equal(new Set(geometry.batches.filter(b=>b.texture!=='none').map(b=>b.texture)).size,4);
  assert.ok(!geometry.batches.some(b=>/mountain|alpine|spruce|granite|chalet|ocean|water/i.test(b.name)));
  const counts=geometry.props.reduce((result,p)=>({...result,[p.kind]:(result[p.kind]??0)+1}),{} as Record<string,number>);
  assert.ok(counts['terrace-house']>=40);assert.ok(counts['terrace-house']<=60);
  assert.equal(counts['clock-tower'],1);assert.equal(counts['parked-market-tram'],1);
  assert.ok(counts['open-arcade-bay']>=8);assert.ok(counts['striped-market-stall']>=10);
  assert.ok(counts['potted-citrus-tree']>=20);assert.ok(counts['copper-street-lantern']>=20);
  assert.equal(counts['fork-wayfinding-board'],2);
});
test('both real town choices render exact source-derived width grade and banking',()=>{
  assert.equal(geometry.routeRoadSamples.length,TOWN_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/1.65),0));
  const ids=new Set(geometry.routeRoadSamples.map(s=>s.edgeId));assert.deepEqual([...ids].sort(),['alley','boulevard','finish','start']);
  for(const s of geometry.routeRoadSamples){
    const edge=TOWN_ROAD_EDGES.find(e=>e.id===s.edgeId)!,w=edge.halfWidthAt(s.distance);
    for(const [lateral,actual] of [[-w,s.left],[w,s.right]] as const)assert.ok(edge.sample(s.distance,lateral).p.distance(new pc.Vec3(...actual))<1e-8);
  }
  const road=geometry.batches.filter(b=>/cobbled road|paved road|warm stone road/.test(b.name));
  assert.equal(road.reduce((n,b)=>n+b.positions.length/9,0),geometry.roadFaces.length);
});
test('all original town props clear the UNION of common and both alternate road corridors',()=>{
  for(const p of geometry.props)assert.ok(TOWN_TRACK.clearAt(p.x,p.z,p.radius),`${p.kind} at ${p.x},${p.z} intrudes`);
  for(const obstacle of geometry.cameraObstacles){assert.ok([...obstacle.min,...obstacle.max].every(Number.isFinite));assert.ok(obstacle.min.every((n,i)=>n<obstacle.max[i]));}
  assert.ok(geometry.cameraObstacles.some(o=>o.kind==='clock-tower'));
  assert.ok(geometry.cameraObstacles.some(o=>o.kind==='parked-market-tram'));
  const bridge=geometry.structures.filter(s=>s.kind==='viaduct');assert.equal(bridge.length,1);assert.ok(bridge[0].overheadClearance>16,`bridge clearance ${bridge[0].overheadClearance}`);
});
test('town terrain stays below BOTH levels and every alternate ribbon',()=>{
  const b=geometry.batches.find(b=>b.name==='Town garden earth and distant terraces')!,ps=b.positions,x0=ps[0],z0=ps[2],dx=ps[3]-x0;
  let columns=1;while(columns<ps.length/3&&ps[columns*3+2]===z0)columns++;
  const dz=ps[columns*3+2]-z0;
  const y=(x:number,z:number)=>{const gx=(x-x0)/dx,gz=(z-z0)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*columns+ix,a=ps[i*3+1],b=ps[(i+1)*3+1],c=ps[(i+columns)*3+1],d=ps[(i+columns+1)*3+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};
  for(const edge of TOWN_ROAD_EDGES)for(let s=0;s<=edge.length;s+=2.3)for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){
    const p=edge.sample(s,lateral).p;assert.ok(y(p.x,p.z)<p.y-1,`terrain intersects ${edge.id} ${s} ${lateral}`);
  }
});
test('one shared NullGraphicsDevice lifecycle swaps original town and unchanged mountain themes',()=>{
  const app=application();try{
    const mountain=buildLandSceneGeometry(MOUNTAIN_TRACK),before=JSON.stringify(mountain);
    for(let pass=0;pass<3;pass++){
      const town=pass!==1,track=town?TOWN_TRACK:MOUNTAIN_TRACK;
      const world=createLandScene(app as pc.Application,track,{preview:true,...(town?{geometry,theme:TOWN_SCENE_THEME}:{})});
      assert.equal(world.boxes.length,0);assert.equal(world.flames.length,0);assert.equal(world.particles.length,0);
      const renders=world.root.findComponents('render') as pc.RenderComponent[];
      assert.equal(renders.length,town?geometry.batches.length:mountain.batches.length);
      const textures=new Set(renders.map(r=>(r.meshInstances[0].material as pc.StandardMaterial).diffuseMap).filter(Boolean));
      assert.equal(textures.size,4);for(const t of textures){assert.equal(t!.width,64);assert.equal(t!.height,64);}
      const theme=town?TOWN_SCENE_THEME:MOUNTAIN_SCENE_THEME;
      assert.equal(world.camera.name,theme.cameraName);assert.equal(world.sun.name,theme.sunName);
      assert.equal(app.root.findComponents('light').length,1);assert.equal(app.scene.fog.start,theme.fogStart);
      assert.equal(world.buildProps(new Map()),world.buildProps(new Map()));
      world.destroy();assert.equal(app.root.findComponents('render').length,0);assert.equal(app.root.findComponents('light').length,0);assert.equal(app.root.findComponents('camera').length,0);
    }
    assert.equal(JSON.stringify(buildLandSceneGeometry(MOUNTAIN_TRACK)),before,'default mountain source output changed');
  }finally{app.destroy();}
});


test('merge road top and underside use one owner for overlapping source footprints',()=>{
  const alley=geometry.roadFaces.filter(f=>f.edgeId==='alley'&&f.distance>TOWN_COURSE.alternates.alley.length-100);
  const owner=geometry.roadFaces.filter(f=>f.edgeId==='boulevard'&&f.distance>TOWN_COURSE.alternates.boulevard.length-110);
  const cross=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
  function areaIntersection(subject:number[][],cutter:number[][]){
    let poly=subject;const sign=Math.sign(cross(cutter[0],cutter[1],cutter[2]));
    for(let i=0;i<3;i++){
      const a=cutter[i],b=cutter[(i+1)%3],out:number[][]=[];
      for(let j=0;j<poly.length;j++){
        const p=poly[j],q=poly[(j+1)%poly.length],dp=cross(a,b,p)*sign,dq=cross(a,b,q)*sign;
        if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
      }poly=out;
    }return Math.abs(poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p[0]*q[2]-q[0]*p[2];},0))/2;
  }
  for(const a of alley)for(const b of owner){
    const area=areaIntersection(a.points,b.points);assert.ok(area<1e-6,`duplicate merge footprint ${area} m2 at alley ${a.distance}`);
  }
  assert.ok(geometry.routeRoadSamples.some(s=>s.edgeId==='alley'&&!s.rendered&&TOWN_COURSE.alternates.alley.length-s.distance>50),'source dedup must extend beyond the obsolete35m cutoff');
  const roadVertices=geometry.roadFaces.length*3;
  assert.ok(geometry.batches.find(b=>/soffit/.test(b.name))!.positions.length/3>=roadVertices,'every retained top triangle has a paired underside');
});

test('every town prop has a foundation reaching actual rendered terrain over its whole footprint',()=>{
  const ground=geometry.batches.find(b=>b.name==='Town garden earth and distant terraces')!,ps=ground.positions,x0=ps[0],z0=ps[2],dx=ps[3]-x0;
  let columns=1;while(ps[columns*3+2]===z0)columns++;const dz=ps[columns*3+2]-z0;
  const height=(x:number,z:number)=>{const gx=(x-x0)/dx,gz=(z-z0)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*columns+ix,a=ps[i*3+1],b=ps[(i+1)*3+1],c=ps[(i+columns)*3+1],d=ps[(i+columns+1)*3+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};
  for(const p of geometry.props.filter(p=>p.kind!=='street-bridge-abutment')){
    assert.ok(geometry.foundations.some(f=>f.kind===p.kind&&Math.hypot((f.footprint[0][0]+f.footprint[2][0])/2-p.x,(f.footprint[0][2]+f.footprint[2][2])/2-p.z)<1e-6),`${p.kind} has no source foundation`);
  }
  for(const f of geometry.foundations){
    for(let i=0;i<=16;i++)for(let j=0;j<=16;j++){
      const [a,b,,d]=f.footprint,u=i/16,v=j/16,x=a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,z=a[2]+(b[2]-a[2])*u+(d[2]-a[2])*v;
      assert.ok(f.bottom<height(x,z)-.35,`${f.kind} floating at ${x},${z}`);
    }
    assert.ok(geometry.cameraObstacles.some(o=>o.kind===f.kind+'-foundation'&&Math.abs(o.min[1]-f.bottom)<1e-8),'camera must see the actual support base');
  }
});


test('all129 support caps have separate visible tops and outward top winding',()=>{
  assert.equal(geometry.foundations.length,129);
  const masonry=geometry.batches.find(b=>b.name==='Ochre terrace retaining masonry')!;
  const paving=geometry.batches.find(b=>b.name==='Cream sidewalk coping and civic columns')!;
  for(const f of geometry.foundations){
    const inspect=(batch:typeof masonry,start:number)=>{
      const points=Array.from({length:24},(_,i)=>new pc.Vec3(...batch.positions.slice((start+i)*3,(start+i+1)*3)));
      const top=Math.max(...points.map(p=>p.y)),bottom=Math.min(...points.map(p=>p.y));let topFaces=0;
      for(let i=0;i<24;i+=4)if(points.slice(i,i+4).every(p=>Math.abs(p.y-top)<1e-8)){
        const normal=new pc.Vec3().cross(points[i+2].clone().sub(points[i]),points[i+1].clone().sub(points[i])).normalize();
        assert.ok(normal.y>.999999,`${f.kind} inverted top face`);topFaces++;
      }
      assert.equal(topFaces,1);return {top,bottom};
    };
    const base=inspect(masonry,f.masonryVertexStart),cap=inspect(paving,f.pavingVertexStart);
    assert.ok(Math.abs(cap.top-f.top)<1e-8,`${f.kind} support top changed`);
    assert.ok(Math.abs(base.top-cap.bottom)<1e-8,`${f.kind} layers must meet`);
    assert.ok(cap.top-base.top>.0799,`${f.kind} duplicate coplanar visible tops`);
    assert.ok(Math.abs(base.bottom-f.bottom)<1e-8,`${f.kind} grounding changed`);
  }
});
