import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {buildDesertSceneGeometry} from '../../src/desert-scenery';
import {DESERT_ROAD_EDGES} from '../../src/maps/desert';
import {sampleRoadFootprints,RoadFootprintIndex} from '../../src/land-road-mesh';

/** The 75465d87 art pass intentionally preserved camera solids; the separate
 * render-only suffix is recorded in docs/desert-visual-polish-20261014.json.
 * This is an exact reviewed exception, never a generic detail-role exemption. */
export function reviewedDesertCosmetics(geometry:ReturnType<typeof buildDesertSceneGeometry>){
  const details=geometry.components.filter(c=>c.kind.startsWith('desert-polish-'));
  assert.equal(details.length,128);
  assert.equal(details.reduce((n,c)=>n+(c.indexEnd-c.indexStart)/3,0),2840);
  assert.equal(details.reduce((n,c)=>n+c.vertexEnd-c.vertexStart,0),3164);
  const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(digest(geometry.cameraObstacles),'206fb9654c4921b3af0958ba0226d7276135cfdcc4ba41afe59f8cc7e6e66bb8','reviewed camera solids remain exact');
  const emittedDetails=details.map(c=>{
    const batch=geometry.batches.find(b=>b.name===c.batch)!;
    return {...c,positions:batch.positions.slice(c.vertexStart*3,c.vertexEnd*3),indices:batch.indices.slice(c.indexStart,c.indexEnd),uvs:batch.uvs.slice(c.vertexStart*2,c.vertexEnd*2)};
  });
  assert.equal(digest(emittedDetails),'8b0808ab2c29537e2e989390796e6cdd893fdd7d923e707adf5b9543e5bf783d','only the exact reviewed cosmetic geometry may omit blockers');
  const roadIndex=new RoadFootprintIndex(sampleRoadFootprints(DESERT_ROAD_EDGES));
  for(const c of details){
    const x=(c.min[0]+c.max[0])/2,z=(c.min[2]+c.max[2])/2,r=Math.hypot(c.max[0]-c.min[0],c.max[2]-c.min[2])/2;
    assert.ok(roadIndex.clearAt(x,z,r+8),`${c.kind}: full bounds retain eight-metre road reservation`);
  }
  let coreTriangles=0,coreVertices=0;
  for(const batch of geometry.batches){
    const ranges=details.filter(c=>c.batch===batch.name).sort((a,b)=>a.indexStart-b.indexStart);
    let vertex=ranges[0]?.vertexStart??batch.positions.length/3,index=ranges[0]?.indexStart??batch.indices.length;
    coreVertices+=vertex;coreTriangles+=index/3;
    for(const c of ranges){
      assert.equal(c.vertexStart,vertex);assert.equal(c.indexStart,index);
      assert.ok(batch.indices.slice(c.indexStart,c.indexEnd).every(i=>i>=c.vertexStart&&i<c.vertexEnd));
      vertex=c.vertexEnd;index=c.indexEnd;
    }
    assert.equal(vertex,batch.positions.length/3);assert.equal(index,batch.indices.length);
  }
  assert.equal(coreTriangles,118490);assert.equal(coreVertices,154180);
  return new Set(details);
}
