import assert from 'node:assert/strict';
import test from 'node:test';
import {WHALE_COVER_SIZE,createCoverGrid,deformCoverPoint,coverBlink,COVER_MAX_FPS} from '../src/home-cover-deformation';
test('grid uses source-space geometry, fixed 1181x1331 canvas, and 1927 vertices',()=>{
 const grid=createCoverGrid();assert.equal(grid.points.length/2,1927);assert.equal(grid.uvs.length,grid.points.length);assert.equal(grid.indices.length,40*46*6);
 assert.deepEqual(grid.points.slice(0,2),[0,0]);assert.deepEqual(grid.points.slice(-2),[1181,1331]);
 for(const index of grid.indices)assert.ok(index>=0&&index<1927);
 assert.equal(COVER_MAX_FPS,24);assert.equal(WHALE_COVER_SIZE.height,1331);
});
test('approved face, framing corners and hem are pinned, while hair and chest deform locally',()=>{
 for(const time of [0,.5,1,2,3,4,5])for(const [x,y] of [[0,0],[1181,0],[0,1331],[1181,1331],[478,385],[602,328],[560,440],[580,1300]])assert.deepEqual(deformCoverPoint(x,y,time),[x,y]);
 assert.notDeepEqual(deformCoverPoint(180,760,1),[180,760]);assert.notDeepEqual(deformCoverPoint(550,680,1),[550,680]);
 const grid=createCoverGrid();
 for(let t=0;t<8;t+=.2)for(let i=0;i<grid.points.length;i+=2){const x=grid.points[i],y=grid.points[i+1],[a,b]=deformCoverPoint(x,y,t);assert.ok(Math.abs(a-x)<3.5);assert.ok(Math.abs(b-y)<2);}
});
test('blink is short, bounded, and leaves a long open-eye interval',()=>{
 assert.equal(coverBlink(0),0);assert.equal(coverBlink(3.55),1);assert.equal(coverBlink(3.8),0);
 for(let t=0;t<20;t+=.01)assert.ok(coverBlink(t)>=0&&coverBlink(t)<=1);
});
