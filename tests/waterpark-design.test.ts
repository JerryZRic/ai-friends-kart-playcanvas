import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterparkDesign,sampleWaterpark,sampleCamera,SAMPLE_LENGTH,SAMPLE_SECONDS} from '../src/waterpark-design';
test('waterpark original mesh batches are finite, indexed, deterministic and stay within sample budget',()=>{
 const a=createWaterparkDesign(),b=createWaterparkDesign();assert.deepEqual(a,b);assert.ok(a.length<=18);
 let triangles=0;for(const m of a){assert.equal(m.positions.length%3,0);assert.equal(m.indices.length%3,0);assert.ok(m.positions.every(Number.isFinite));assert.ok(m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<m.positions.length/3));triangles+=m.indices.length/3;}
 assert.ok(triangles<60000,`${triangles} exceeds environment geometry budget`);assert.equal(a.filter(m=>m.water).length,1);
 for(const name of['Orchid landmark tower','Palm jade leaves','Rose tower roofs and canopies','Ivory coping and bridge stone'])assert.ok(a.some(m=>m.name===name));
});
test('straight, wide bend and exit remain continuous with a bounded 18 second camera path',()=>{
 assert.equal(SAMPLE_SECONDS,18);assert.equal(SAMPLE_LENGTH,285);
 for(let d=0;d<SAMPLE_LENGTH;d+=.5){const a=sampleWaterpark(d),b=sampleWaterpark(d+.5);assert.ok(a.p.distance(b.p)<=.501);assert.ok(Math.abs(a.n.dot(a.t))<1e-10);assert.ok(Math.abs(a.t.length()-1)<1e-10);const c=sampleCamera(d);assert.ok(c.position.every(Number.isFinite));assert.ok(c.position[1]>.1);}
 assert.equal(sampleWaterpark(20).angle,0);assert.ok(sampleWaterpark(180).angle>1);assert.equal(sampleWaterpark(270).angle,1.75);
});
