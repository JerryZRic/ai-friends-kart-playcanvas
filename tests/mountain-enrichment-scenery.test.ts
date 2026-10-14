import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMountainSceneGeometry} from '../src/mountain-scenery';
import {buildLandSceneGeometry} from '../src/land-scenery';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
import {cameraTerrainHeight,safeLandCamera} from '../src/land-camera';
import {MeshOracle,ComponentOracle} from './helpers/emitted-scene-oracle';

const scene=buildMountainSceneGeometry(MOUNTAIN_TRACK);

test('Mountain enrichment preserves original road, shoulders, rails and marking geometry exactly',()=>{
  const original=buildLandSceneGeometry(MOUNTAIN_TRACK);
  for(const name of ['Mountain banked tarmac','Weathered aggregate tarmac','Underpass dressed stone roadway','Crushed limestone shoulders','Galvanized double guardrail']){
    const before=original.batches.find(b=>b.name===name)!,after=scene.batches.find(b=>b.name===name)!;
    assert.deepEqual(after.positions,before.positions,name+' vertices');assert.deepEqual(after.indices,before.indices,name+' triangles');
  }
  assert.deepEqual(scene.roadSamples,original.roadSamples);assert.deepEqual(scene.structures,original.structures);
});
test('enriched Mountain remains bounded and every emitted triangle has one component owner',()=>{
  const polishTriangles=scene.components.filter(c=>c.kind.startsWith('polish-mountain-')).reduce((n,c)=>n+(c.indexEnd-c.indexStart)/3,0);
  // Keep the original geometry's historical budget, with a separate small
  // allowance for the explicitly scoped 2026 lookout furnishings.
  assert.ok(scene.budget.batches<=24);assert.ok(scene.budget.triangles-polishTriangles<110000,JSON.stringify(scene.budget));
  assert.ok(polishTriangles<=2000,`lookout polish triangles ${polishTriangles}`);assert.ok(scene.budget.vertices<190000,JSON.stringify(scene.budget));
  for(const b of scene.batches){
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);
    const components=scene.components.filter(c=>c.batch===b.name).sort((a,b)=>a.indexStart-b.indexStart);let end=0;
    for(const c of components){assert.equal(c.indexStart,end,c.kind);assert.ok(c.indexEnd>c.indexStart,c.kind);end=c.indexEnd;assert.ok(b.indices.slice(c.indexStart,c.indexEnd).every(i=>i>=c.vertexStart&&i<c.vertexEnd),c.kind);}
    assert.equal(end,b.indices.length,b.name);
  }
});
test('exact heightfield remains below complete original racing widths and the lower crossing',()=>{
  for(let i=0;i<1920;i++){const d=i/1920*MOUNTAIN_TRACK.length,w=MOUNTAIN_TRACK.halfWidthAt(d);for(const lateral of [-w,-w/2,0,w/2,w]){const p=MOUNTAIN_TRACK.sample(d,lateral).p;assert.ok(cameraTerrainHeight(scene.terrainGrid,p.x,p.z)!<p.y-2,`road ${i} lateral ${lateral}`);}}
  assert.ok(scene.structures[0].overheadClearance>29);
});
test('connected terrain uses actual clipped source-plane ownership and metric vertical UVs',()=>{
  const originalTriangles=(scene.terrainGrid.columns-1)*(scene.terrainGrid.rows-1)*2,seen=new Set<number>();let partitions=0;
  for(const p of scene.terrainPartitions){const c=scene.components.find(c=>c.kind==='connected-contour-terrain'&&c.batch===p.batch);if(!c)continue;assert.equal(p.sourceTriangles.length,(c.indexEnd-c.indexStart)/3);p.sourceTriangles.forEach(i=>seen.add(i));partitions+=p.sourceTriangles.length;}
  assert.equal(seen.size,originalTriangles);assert.ok(partitions>originalTriangles,'bands should split at least some cells');
  assert.ok(scene.landforms.length>=5);assert.ok(scene.landforms.every(r=>r.knots.length>=3));
  assert.ok(!scene.props.some(p=>p.kind==='distant-ridge'),'no isolated distant rock ring');
});
test('eight original sections have different intentional grounded vegetation rhythms',()=>{
  assert.equal(scene.sectionRhythms.length,8);assert.deepEqual(scene.sectionRhythms.map(s=>s.name),MOUNTAIN_TRACK.sections.map(s=>s.name));
  assert.ok(scene.sectionRhythms[4].trees>scene.sectionRhythms[2].trees);assert.ok(scene.sectionRhythms[5].trees>scene.sectionRhythms[3].trees);
  assert.equal(scene.sectionRhythms[3].rocks,0);
  for(const p of scene.props)assert.ok(MOUNTAIN_TRACK.clearAt(p.x,p.z,p.radius),p.kind);
  for(const detail of scene.groundedDetails)assert.ok(detail.bottom<=detail.terrainLow+1e-8,detail.kind);
});
test('chalet and selected full-detail props expose actual foundations and exact source provenance',()=>{
  assert.equal(scene.props.filter(p=>p.kind==='lookout-chalet').length,1);assert.equal(scene.reusedProps.length,2);
  assert.ok(scene.components.some(c=>c.kind==='lookout-solid-asymmetric-gable'));assert.ok(scene.components.some(c=>c.kind==='lookout-canopy-grounded-timber-post'));
  for(const p of scene.reusedProps){assert.ok(p.primitives.length>0);assert.ok(p.footprint.length>=4);assert.ok(p.groundContacts.length>=2);assert.match(p.sourceSha256,/^[0-9a-f]{64}$/);const pad=scene.components[p.pad];assert.ok(p.supportBand.every(q=>q[1]>=pad.min[1]-.001&&q[1]<=pad.max[1]+.021));}
  assert.equal(scene.reusedProps.flatMap(p=>p.primitives).reduce((n,p)=>n+(scene.components[p.component].indexEnd-scene.components[p.component].indexStart)/3,0),6152);
});
test('camera safety uses exact rendered surfaces and preserves the open lower deck',()=>{
  assert.equal(scene.cameraObstacles.length,2);assert.ok(scene.cameraObstacles.every(b=>b.triangles||b.heightfield));
  assert.ok(scene.cameraObstacles.some(b=>b.heightfield===scene.terrainGrid));
  for(const fraction of [.895,.905,.915]){const d=fraction*MOUNTAIN_TRACK.length,p=MOUNTAIN_TRACK.sample(d).p,q=MOUNTAIN_TRACK.sample(d-8).p,anchor={x:p.x,y:p.y+1.5,z:p.z},desired={x:q.x,y:q.y+4.5,z:q.z},safe=safeLandCamera(anchor,desired,scene.cameraObstacles,.3);assert.ok(Math.hypot(safe.x-anchor.x,safe.y-anchor.y,safe.z-anchor.z)>2,'open underpass must not become a solid box');}
});

test('all authored closed solids and declared joints connect in emitted triangle geometry',()=>{
  const mesh=new MeshOracle(scene.batches),parts=new ComponentOracle(mesh,scene.components);
  for(const [id,c]of scene.components.entries())if(c.solid)assert.ok(parts.closedShell(c),c.kind+' '+id);
  for(const c of scene.contacts)assert.ok(parts.attachment(scene.components[c.first],scene.components[c.second]),c.kind+' '+c.first+'→'+c.second);
});

test('consolidated Mountain camera mesh retains every emitted non-heightfield face exactly once and in source order',()=>{
  const mesh=scene.cameraObstacles.find(b=>b.triangles)!;let triangle=0;
  for(const c of scene.components){if(c.kind==='connected-contour-terrain')continue;const b=scene.batches.find(b=>b.name===c.batch)!;
    for(let i=c.indexStart;i<c.indexEnd;i+=3)assert.deepEqual(mesh.triangles![triangle++],b.indices.slice(i,i+3).map(v=>b.positions.slice(v*3,v*3+3)),c.kind+' emitted face '+i);
  }
  assert.equal(triangle,mesh.triangles!.length);assert.equal(scene.cameraObstacles.filter(b=>b.heightfield).length,1);
  assert.equal(scene.cameraObstacles.find(b=>b.heightfield)!.heightfield,scene.terrainGrid);
});
