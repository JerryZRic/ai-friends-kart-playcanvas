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

test('HTML texture upload and bottom-origin UVs share one explicit upright convention',async()=>{
 const {readFileSync}=await import('node:fs');
 const adapter=readFileSync(new URL('../src/home-cover-playcanvas.ts',import.meta.url),'utf8');
 assert.match(adapter,/new pc\.Texture\(app!\.graphicsDevice,\{flipY:true,/);
 const grid=createCoverGrid();assert.deepEqual(grid.uvs.slice(0,2),[0,1]);assert.deepEqual(grid.uvs.slice(-2),[1,0]);
 assert.match(adapter,/uv\.push\(x\/rig\.blink!\.width,1-y\/rig\.blink!\.height\)/);
 assert.match(adapter,/addLayer\(portrait,0\)/);assert.match(adapter,/addLayer\(eyelids!,\.001,geometry,true\)/);
});

test('all six source-sized rigs start neutral and keep face, framing and feet fixed',async()=>{
 const {COVER_RIGS}=await import('../src/home-cover-rigs');assert.equal(COVER_RIGS.length,6);
 for(const rig of COVER_RIGS){
  const grid=createCoverGrid(40,46,rig);assert.deepEqual(grid.points.slice(-2),[rig.width,rig.height]);
  for(let i=0;i<grid.points.length;i+=2){const x=grid.points[i],y=grid.points[i+1];assert.deepEqual(deformCoverPoint(x,y,0,rig),[x,y]);}
  for(const t of [0,.25,.65,1,3,5])for(const [u,v] of [[0,0],[1,0],[0,1],[1,1],[.5,.2],[.5,.9]]){const x=u*rig.width,y=v*rig.height;assert.deepEqual(deformCoverPoint(x,y,t,rig),[x,y]);}
 }
 assert.equal(COVER_RIGS.filter(r=>r.blink).length,1);
});
test('whale eyelid patches and neighboring mesh samples remain pinned to the same face pixels',async()=>{
 const {WHALE_RIG}=await import('../src/home-cover-rigs');
 for(const [l,t,r,b] of WHALE_RIG.blink!.patches)for(let x=l-30;x<=r+30;x+=10)for(let y=t-30;y<=b+30;y+=10)for(const time of [0,.3,1,2,3,5])assert.deepEqual(deformCoverPoint(x,y,time),[x,y]);
 assert.equal(WHALE_RIG.blink!.height,1332);assert.equal(WHALE_RIG.height,1331);
});
test('authored staff and books stay fixed; local motion is bounded and continuous',async()=>{
 const {COVER_RIGS}=await import('../src/home-cover-rigs');
 for(const [model,u,v] of [['grok-mesh-v1',.28,.5],['claude-mesh-v1',.38,.35],['glm-mesh-v1',.5,.4]] as const){const rig=COVER_RIGS.find(r=>r.model===model)!;for(let t=0;t<6;t+=.1)assert.deepEqual(deformCoverPoint(u*rig.width,v*rig.height,t,rig),[u*rig.width,v*rig.height]);}
 for(const rig of COVER_RIGS){const grid=createCoverGrid(12,14,rig);for(let i=0;i<grid.points.length;i+=2){const x=grid.points[i],y=grid.points[i+1];let previous=[x,y];for(let t=0;t<6;t+=1/24){const current=deformCoverPoint(x,y,t,rig);assert.ok(Math.abs(current[0]-x)<3.5&&Math.abs(current[1]-y)<2);assert.ok(Math.hypot(current[0]-previous[0],current[1]-previous[1])<.7);previous=current;}}}
});
