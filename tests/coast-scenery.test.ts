import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCoastScenery,COAST_PALETTE} from '../src/coast-scenery';
import {coastGroundHeightAt} from '../src/scene';
import {LENGTH,sample,halfWidthAt} from '../src/track';

test('coast scenery remains deterministic, bounded and shared in eight material batches',()=>{
 const scene=buildCoastScenery(coastGroundHeightAt);
 assert.deepEqual(buildCoastScenery(coastGroundHeightAt),scene);
 assert.equal(scene.batches.length,8);assert.equal(Object.keys(COAST_PALETTE).length,8);
 assert.ok(scene.batches.reduce((n,b)=>n+b.indices.length/3,0)<=6000);
 for(const batch of scene.batches){assert.ok(batch.indices.length>0);assert.ok(batch.positions.every(Number.isFinite));assert.equal(batch.indices.length%3,0);assert.ok(batch.indices.every(i=>Number.isInteger(i)&&i>=0&&i<batch.positions.length/3));}
 const kinds=new Set(scene.props.map(p=>p.kind));for(const kind of ['beach-cabana-cluster','coastal-picnic-grove','harbour-lighthouse','timber-marina','anchored-sailboat'])assert.ok(kinds.has(kind));
});
test('all coast decoration footprints stay outside the full racing corridor',()=>{
 const {props}=buildCoastScenery(coastGroundHeightAt);
 for(const prop of props)for(let d=0;d<LENGTH;d+=1){const p=sample(d).p;assert.ok(Math.hypot(p.x-prop.x,p.z-prop.z)>halfWidthAt(d)+prop.radius+1.7,prop.kind+' road clearance');}
});
