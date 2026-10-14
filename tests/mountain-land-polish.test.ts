/** Finite 2026 visual-polish checks; historical golden fixtures are unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMountainSceneGeometry} from '../src/mountain-scenery';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain';
import {safeLandCamera} from '../src/land-camera';
const scene=buildMountainSceneGeometry(track);
const additions=scene.components.filter(c=>c.kind.startsWith('polish-mountain-'));
test('Mountain polish is a bounded lookout group reusing existing batches',()=>{
  assert.equal(scene.budget.batches,24);
  assert.ok(scene.budget.triangles<=112000,JSON.stringify(scene.budget));
  assert.ok(scene.budget.vertices<190000);
  assert.ok(additions.length>=100);
  assert.ok(additions.some(c=>c.kind==='polish-mountain-telescope-barrel'));
  assert.ok(additions.some(c=>c.kind==='polish-mountain-geology-display'));
  assert.ok(additions.every(c=>c.assembly==='polish-mountain-lookout'));
  for(const b of scene.batches){
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    const owners=scene.components.filter(c=>c.batch===b.name).sort((a,b)=>a.indexStart-b.indexStart);let end=0;
    for(const c of owners){assert.equal(c.indexStart,end);end=c.indexEnd;assert.ok(b.indices.slice(c.indexStart,c.indexEnd).every(i=>i>=c.vertexStart&&i<c.vertexEnd));}
    assert.equal(end,b.indices.length);
  }
});
test('Mountain additions retain road clearance and finite adjusted arrival camera',()=>{
  for(const c of additions){const b=scene.batches.find(b=>b.name===c.batch)!;
    for(let i=c.vertexStart*3;i<c.vertexEnd*3;i+=3)assert.ok(track.clearAt(b.positions[i],b.positions[i+2],3),c.kind);
  }
  for(let i=0;i<=40;i++){
    const d=(.01+i*.002)*track.length,p=track.sample(d).p,q=track.sample(d-9).p;
    const anchor={x:p.x,y:p.y+1.5,z:p.z},desired={x:q.x,y:q.y+4.5,z:q.z};
    const camera=safeLandCamera(anchor,desired,scene.cameraObstacles,.3);
    assert.ok(Object.values(camera).every(Number.isFinite));
    assert.ok(Math.hypot(camera.x-anchor.x,camera.y-anchor.y,camera.z-anchor.z)>2);
  }
});
