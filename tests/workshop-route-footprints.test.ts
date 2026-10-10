import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_ROAD_EDGES,WORKSHOP_LANDMARKS,WORKSHOP_COURSE} from '../src/maps/workshop';
import {sampleRoadFootprints,RoadFootprintIndex,intersectRoadFootprint,footprintArea,type RoadFootprint} from '../src/land-road-mesh';

const near=(a:number,b:number,t=1e-8) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
/** Independent barycentric height lookup on each source triangle. XZ proximity
 * alone cannot certify a high crossing or coplanar junction ownership. */
function heightAt(face:RoadFootprint,x:number,z:number){
  const [a,b,c]=face.points,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
  assert.ok(Math.abs(den)>1e-9,'source road triangle has nonzero projected area');
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den;
  const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;
  return u*a.y+v*b.y+(1-u-v)*c.y;
}
function junction(a:RoadFootprint,b:RoadFootprint){
  const ae=a.edge.id,be=b.edge.id,ab=ae==='alley'||ae==='boulevard',bb=be==='alley'||be==='boulevard';
  if(ae==='start'&&bb&&a.edge.length-a.distance<130&&b.distance<130 ||
    be==='start'&&ab&&b.edge.length-b.distance<130&&a.distance<130)return 'split';
  if(ae==='finish'&&bb&&a.distance<160&&b.edge.length-b.distance<160 ||
    be==='finish'&&ab&&b.distance<160&&a.edge.length-a.distance<160)return 'merge';
  if(ab&&bb&&ae!==be&&a.distance<130&&b.distance<130)return 'split-branches';
  if(ab&&bb&&ae!==be&&a.edge.length-a.distance<160&&b.edge.length-b.distance<160)return 'merge-branches';
  if(ae==='start'&&be==='finish'&&a.distance<70&&b.edge.length-b.distance<70 ||
    be==='start'&&ae==='finish'&&b.distance<70&&a.edge.length-a.distance<70)return 'lap-seam';
  return null;
}
function auditSourceRibbon(spacing:number){
  const faces=sampleRoadFootprints(WORKSHOP_ROAD_EDGES,spacing),index=new RoadFootprintIndex(faces);
  const ids=new Map(faces.map((face,i)=>[face,i]));
  let crossings=0,junctions=0,minClearance=Infinity,maxPlanarError=0;
  const crossingBounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  const branchOverlap={split:{alley:0,boulevard:0},merge:{alley:Infinity,boulevard:Infinity}};
  for(let i=0;i<faces.length;i++){
    const a=faces[i];
    for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){
      if(ids.get(b)!<=i || a.edge.id===b.edge.id&&Math.abs(a.distance-b.distance)<30)continue;
      const overlap=intersectRoadFootprint(a.points,b.points);
      if(overlap.length<3||footprintArea(overlap)<1e-7)continue;
      const differences=overlap.map(p=>heightAt(b,p.x,p.z)-heightAt(a,p.x,p.z));
      const maxError=Math.max(...differences.map(Math.abs)),joint=junction(a,b);
      if(joint&&maxError<1e-8){
        junctions++;maxPlanarError=Math.max(maxPlanarError,maxError);
        if(joint==='split-branches'||joint==='merge-branches')for(const face of [a,b]){
          assert.ok(face.edge.id==='alley'||face.edge.id==='boulevard');
          if(joint==='split-branches')branchOverlap.split[face.edge.id]=Math.max(branchOverlap.split[face.edge.id],face.distance);
          else branchOverlap.merge[face.edge.id]=Math.min(branchOverlap.merge[face.edge.id],face.distance);
        }
        continue;
      }
      assert.equal(a.edge.id,'start',`unintended source-ribbon overlap ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
      assert.equal(b.edge.id,'start',`unintended source-ribbon overlap ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
      for(const difference of differences){
        const clearance=difference-WORKSHOP_LANDMARKS.crossing.structuralDepth;
        assert.ok(clearance>=WORKSHOP_LANDMARKS.crossing.minUndersideClearance,`crossing underside ${clearance}`);
        minClearance=Math.min(minClearance,clearance);
      }
      for(const p of overlap){
        const reserved=WORKSHOP_LANDMARKS.crossing.noFillBounds;
        assert.ok(p.x>reserved.minX&&p.x<reserved.maxX&&p.z>reserved.minZ&&p.z<reserved.maxZ,'crossing escaped its authored no-fill envelope');
        crossingBounds.minX=Math.min(crossingBounds.minX,p.x);crossingBounds.maxX=Math.max(crossingBounds.maxX,p.x);
        crossingBounds.minZ=Math.min(crossingBounds.minZ,p.z);crossingBounds.maxZ=Math.max(crossingBounds.maxZ,p.z);
      }
      crossings++;
    }
  }
  return {faces:faces.length,crossings,junctions,minClearance,maxPlanarError,crossingBounds,branchOverlap};
}

test('measured source triangles intersect only at exact planar fork overlaps and the elevated crossing',()=>{
  const audit=auditSourceRibbon(2);
  assert.equal(audit.faces,3012);assert.equal(audit.crossings,422);assert.equal(audit.junctions,731);
  near(audit.minClearance,24.130857465470363);assert.ok(audit.maxPlanarError<2e-14);
  near(audit.crossingBounds.minX,97.03225747373358);near(audit.crossingBounds.maxX,122.5198792842239);
  near(audit.crossingBounds.minZ,-79.50000000000006);near(audit.crossingBounds.maxZ,-60.49999999999996);
  near(audit.branchOverlap.split.alley,93.85534500391958);near(audit.branchOverlap.split.boulevard,99.73092134866162);
  near(audit.branchOverlap.merge.alley,271.5814238411289);near(audit.branchOverlap.merge.boulevard,319.1389483157172);
  for(const id of ['alley','boulevard'] as const){
    assert.ok(audit.branchOverlap.split[id]>WORKSHOP_COURSE.sharedMergeLength!);
    assert.ok(WORKSHOP_COURSE.edges[id].length-audit.branchOverlap.merge[id]>WORKSHOP_COURSE.sharedMergeLength!+35,
      'source overlap ownership must not be clipped at the interaction certificate distance');
  }
});

test('every source road triangle is nondegenerate and upward across banked full-width strips',()=>{
  let minArea=Infinity,minNormalY=Infinity;
  for(const face of sampleRoadFootprints(WORKSHOP_ROAD_EDGES,2)){
    const [a,b,c]=face.points,normal=b.clone().sub(a).cross(b.clone().sub(a),c.clone().sub(a)).normalize();
    minArea=Math.min(minArea,footprintArea(face.points));minNormalY=Math.min(minNormalY,normal.y);
    assert.ok(normal.y>.993,'road source winding must stay upward even on the spool');
    assert.ok(footprintArea(face.points)>7.78,'full-width strip must retain positive projected area');
  }
  near(minArea,7.783597508860112);near(minNormalY,.9931407034665283);
});

test('default finer source-road tessellation retains crossing clearance and legal planar overlap',()=>{
  const audit=auditSourceRibbon(1.65);
  assert.ok(audit.faces>3012);assert.ok(audit.crossings>422);assert.ok(audit.junctions>731);
  assert.ok(audit.minClearance>=24.130);assert.ok(audit.maxPlanarError<3e-14);
});

test('all six reserved complete landmark plots clear every source ribbon by at least20m',()=>{
  const index=new RoadFootprintIndex(sampleRoadFootprints(WORKSHOP_ROAD_EDGES,1.65));
  const plots=WORKSHOP_LANDMARKS.plots;
  assert.equal(plots.length,6);assert.equal(new Set(plots.map(p=>p.id)).size,6);
  for(let i=0;i<plots.length;i++){
    const p=plots[i];
    assert.ok(index.clearAt(p.x,p.z,p.radius+20),`${p.id}: complete circumradius must clear every road`);
    for(const q of plots.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+3);
  }
  // This only certifies source-level horizontal reservations. The scene must
  // independently ground all emitted member footprints on actual terrain.
});
