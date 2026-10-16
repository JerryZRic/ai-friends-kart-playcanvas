import assert from 'node:assert/strict';
import type {buildForestSceneGeometry} from '../../src/forest-scenery';

/** The e2f20299 visual pass documented these counts in
 * docs/forest-visual-polish-20261014.json. Keep the old core separately
 * accountable instead of treating the current total as a new baseline. */
export function assertForestReviewedComposition(geometry:ReturnType<typeof buildForestSceneGeometry>){
  const details=geometry.components.filter(c=>c.kind.startsWith('forest-polish-'));
  assert.equal(details.length,352,'reviewed cosmetic component count');
  let coreTriangles=0,detailTriangles=0,coreVertices=0,detailVertices=0;
  for(const batch of geometry.batches){
    const ranges=details.filter(c=>c.batch===batch.name).sort((a,b)=>a.vertexStart-b.vertexStart);
    const boundary=ranges[0]?.vertexStart??batch.positions.length/3;
    let end=boundary;
    for(const range of ranges){
      assert.equal(range.vertexStart,end,`${batch.name}: cosmetic ranges form one append-only suffix`);
      end=range.vertexEnd;
    }
    assert.equal(end,batch.positions.length/3,`${batch.name}: no unaccounted appended vertices`);
    coreVertices+=boundary;detailVertices+=end-boundary;
    let reachedAppend=false;
    for(let i=0;i<batch.indices.length;i+=3){
      const face=batch.indices.slice(i,i+3),isDetail=face.every(v=>v>=boundary);
      assert.ok(isDetail||face.every(v=>v<boundary),`${batch.name}: no mixed core/detail topology`);
      if(isDetail){reachedAppend=true;detailTriangles++;}
      else{assert.ok(!reachedAppend,`${batch.name}: original faces remain a prefix`);coreTriangles++;}
    }
  }
  assert.deepEqual({coreTriangles,detailTriangles,coreVertices,detailVertices},
    {coreTriangles:108772,detailTriangles:5536,coreVertices:138214,detailVertices:10994});
  assert.equal(geometry.batches.length,21,'no added material batches');
  assert.ok(coreTriangles+detailTriangles<116000,'existing visual-polish budget');
}
