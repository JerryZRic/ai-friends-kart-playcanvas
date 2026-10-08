import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {readFileSync} from 'node:fs';
import {WATERPARK_WAVES,WATER_SURFACE_GLSL,sampleWaterSurface,MAX_WATER_HEIGHT,waterSurfaceRotation} from '../src/waterpark-surface';
import {waterparkEffectGeometry,WAKE_SEGMENTS,SPRAY_DROPLETS} from '../src/waterpark-wake';
import {WATERPARK_WATER_VERTEX_SHADER,WATERPARK_WATER_FRAGMENT_SHADER} from '../src/waterpark-water';
import {sampleWaterpark} from '../src/waterpark-design';
test('CPU surface and both shader stages share the exact generated wave field',()=>{
 assert.ok(WATERPARK_WATER_VERTEX_SHADER.includes(WATER_SURFACE_GLSL));assert.ok(WATERPARK_WATER_FRAGMENT_SHADER.includes(WATER_SURFACE_GLSL));
 assert.ok(MAX_WATER_HEIGHT<.13);assert.equal(WATERPARK_WAVES.length,3);
 for(let t=0;t<22;t+=.7)for(let d=0;d<286;d+=3.7){const p=sampleWaterpark(d,Math.sin(d)*11).p,s=sampleWaterSurface(p.x,p.z,t),e=.0001;
  assert.ok(Math.abs(s.height)<=MAX_WATER_HEIGHT);assert.ok(Math.abs(Math.hypot(s.normal.x,s.normal.y,s.normal.z)-1)<1e-12);assert.ok(s.normal.y>.99);
  assert.ok(Math.abs((sampleWaterSurface(p.x+e,p.z,t).height-sampleWaterSurface(p.x-e,p.z,t).height)/(2*e)-s.dx)<1e-8);
  assert.ok(Math.abs((sampleWaterSurface(p.x,p.z+e,t).height-sampleWaterSurface(p.x,p.z-e,t).height)/(2*e)-s.dz)<1e-8);
 }
 for(const bad of[NaN,Infinity,-Infinity])assert.ok(Object.values(sampleWaterSurface(bad,bad,bad)).filter(v=>typeof v==='number').every(Number.isFinite));
});
test('wake/spray geometry is bounded, deterministic, surface-following and responds to turning',()=>{
 for(const speed of[0,.5,12,30,NaN,Infinity])for(const lane of[-10.5,0,10.5])for(const lateral of[-8,0,8]){
 const data=waterparkEffectGeometry(183,lane,speed,5,lateral);
 assert.equal(data.positions.length,2*(WAKE_SEGMENTS+1)*2*3);assert.equal(data.spray.length,SPRAY_DROPLETS*12);
 assert.ok([...data.positions,...data.spray].every(Number.isFinite));assert.ok(data.strength>=0&&data.strength<=.88);assert.ok(data.sprayStrength>=0&&data.sprayStrength<=.8);
 for(let i=0;i<data.positions.length;i+=3)assert.ok(Math.abs(data.positions[i+1]-sampleWaterSurface(data.positions[i],data.positions[i+2],5).height-.035)<1e-9);
 assert.deepEqual(data,waterparkEffectGeometry(183,lane,speed,5,lateral));
 }
 assert.notDeepEqual(waterparkEffectGeometry(130,0,22,3,0),waterparkEffectGeometry(130,0,22,3,5));
 const invalid=waterparkEffectGeometry(NaN,Infinity,NaN,Infinity,NaN);assert.equal(invalid.enabled,false);assert.ok([...invalid.positions,...invalid.spray].every(Number.isFinite));
});
test('surface following is presentation-only and uses final simulation state',()=>{
 const source=readFileSync('src/waterpark-play.ts','utf8');
 assert.match(source,/sampleWaterSurface\(s.p.x,s.p.z,clock\)/);assert.match(source,/mount.root.setPosition\(s.p.x,surface.height,s.p.z\)/);
 assert.doesNotMatch(readFileSync('src/waterpark-motion.ts','utf8'),/sampleWaterSurface|waterpark-surface|waterpark-wake/);
 assert.match(WATERPARK_WATER_FRAGMENT_SHADER,/0.0204 \+ 0.9796/);
 assert.match(WATERPARK_WATER_FRAGMENT_SHADER,/texture2D\(waterReflectionMap/);
});

test('surface orientation retains the correct normal through the whole bend and steering yaw',()=>{
 for(let d=0;d<=285;d+=3)for(const turn of[-.3,0,.3]){const p=sampleWaterpark(d),surface=sampleWaterSurface(p.p.x,p.p.z,4),q=waterSurfaceRotation(surface.normal,p.angle+turn),up=new pc.Quat(q.x,q.y,q.z,q.w).transformVector(pc.Vec3.UP);
  assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-12);
  assert.ok(Math.hypot(up.x-surface.normal.x,up.y-surface.normal.y,up.z-surface.normal.z)<1e-12);
 }
});
test('ballistic spray fades out before recycling instead of popping in midair',()=>{
 const width=(time:number)=>{const p=waterparkEffectGeometry(100,0,30,time,8).spray;return Math.hypot(p[3]-p[0],p[4]-p[1],p[5]-p[2]);};
 assert.equal(width(0),0);assert.equal(width(.999),0);assert.ok(width(.3)>.01);
});
