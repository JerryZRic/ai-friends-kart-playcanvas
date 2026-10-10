import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from 'playcanvas';
import {HARVEST_ROAD_EDGES,HARVEST_LANDMARKS,HARVEST_COURSE,HARVEST_BARN} from '../src/maps/harvest';
import {sampleRoadFootprints,RoadFootprintIndex,intersectRoadFootprint,subtractRoadFootprint,footprintArea,type RoadFootprint} from '../src/land-road-mesh';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
/** Heights are evaluated at exact intersection vertices, not nearest centers. */
function heightAt(face:RoadFootprint,x:number,z:number){
  const [a,b,c]=face.points,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
  assert.ok(Math.abs(den)>1e-9);
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;
  return u*a.y+v*b.y+(1-u-v)*c.y;
}
function junction(a:RoadFootprint,b:RoadFootprint){
  const ae=a.edge.id,be=b.edge.id,ab=ae==='alley'||ae==='boulevard',bb=be==='alley'||be==='boulevard';
  if(ae==='start'&&bb&&a.edge.length-a.distance<130&&b.distance<130 || be==='start'&&ab&&b.edge.length-b.distance<130&&a.distance<130)return 'split';
  if(ae==='finish'&&bb&&a.distance<160&&b.edge.length-b.distance<160 || be==='finish'&&ab&&b.distance<160&&a.edge.length-a.distance<160)return 'merge';
  if(ab&&bb&&ae!==be&&a.distance<130&&b.distance<130)return 'split-branches';
  if(ab&&bb&&ae!==be&&a.edge.length-a.distance<160&&b.edge.length-b.distance<160)return 'merge-branches';
  if(ae==='start'&&be==='finish'&&a.distance<70&&b.edge.length-b.distance<70 || be==='start'&&ae==='finish'&&b.distance<70&&a.edge.length-a.distance<70)return 'lap-seam';
  return null;
}
function auditSourceRibbon(spacing:number){
  const faces=sampleRoadFootprints(HARVEST_ROAD_EDGES,spacing),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((face,i)=>[face,i]));
  let pairs=0,splitPairs=0,mergePairs=0,maxPlanarError=0,overlapArea=0;
  const branchOverlap={split:{alley:0,boulevard:0},merge:{alley:Infinity,boulevard:Infinity}};
  for(let i=0;i<faces.length;i++){
    const a=faces[i];
    for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){
      if(ids.get(b)!<=i || a.edge.id===b.edge.id&&Math.abs(a.distance-b.distance)<30)continue;
      const overlap=intersectRoadFootprint(a.points,b.points),area=footprintArea(overlap);
      if(overlap.length<3||area<1e-7)continue;
      const joint=junction(a,b),maxError=Math.max(...overlap.map(p=>Math.abs(heightAt(b,p.x,p.z)-heightAt(a,p.x,p.z))));
      assert.ok(joint,`unintended full-width source overlap ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
      assert.ok(maxError<1e-10,`road crossing or noncoplanar junction ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
      pairs++;maxPlanarError=Math.max(maxPlanarError,maxError);overlapArea+=area;
      if(joint==='split-branches'||joint==='merge-branches'){
        if(joint==='split-branches')splitPairs++;else mergePairs++;
        for(const face of [a,b]){
          assert.ok(face.edge.id==='alley'||face.edge.id==='boulevard');
          if(joint==='split-branches')branchOverlap.split[face.edge.id]=Math.max(branchOverlap.split[face.edge.id],face.distance);
          else branchOverlap.merge[face.edge.id]=Math.min(branchOverlap.merge[face.edge.id],face.distance);
        }
      }
    }
  }
  return{faces,index,pairs,splitPairs,mergePairs,maxPlanarError,overlapArea,branchOverlap};
}

test('exact 1.65m full-width source triangles have only coplanar split and merge overlap, no forced crossing',()=>{
  const audit=auditSourceRibbon(1.65);
  assert.equal(audit.faces.length,3900);assert.equal(audit.pairs,889);assert.equal(audit.splitPairs,398);assert.equal(audit.mergePairs,491);assert.ok(audit.maxPlanarError<6e-15);
  near(audit.branchOverlap.split.alley,72.42174504446596);near(audit.branchOverlap.split.boulevard,74.05608054721378);
  near(audit.branchOverlap.merge.alley,339.06544270818154);near(audit.branchOverlap.merge.boulevard,427.879576495013);
  for(const id of ['alley','boulevard'] as const){
    assert.ok(audit.branchOverlap.split[id]>HARVEST_COURSE.sharedMergeLength!+30);
    assert.ok(HARVEST_COURSE.edges[id].length-audit.branchOverlap.merge[id]>HARVEST_COURSE.sharedMergeLength!+45,
      'road ownership must follow exact triangle overlaps, not the 40m interaction tail');
  }
});

test('coarser independent ribbon sampling still rejects all unintended nonlocal overlaps',()=>{
  const audit=auditSourceRibbon(2);
  assert.ok(audit.faces.length<3900);assert.ok(audit.pairs>600);assert.ok(audit.maxPlanarError<1e-10);
});

test('every banked source road triangle has positive area and upward winding',()=>{
  let minArea=Infinity,minNormalY=Infinity;
  for(const face of sampleRoadFootprints(HARVEST_ROAD_EDGES,1.65)){
    const [a,b,c]=face.points,normal=b.clone().sub(a).cross(b.clone().sub(a),c.clone().sub(a)).normalize();
    minArea=Math.min(minArea,footprintArea(face.points));minNormalY=Math.min(minNormalY,normal.y);
    assert.ok(normal.y>.994);assert.ok(footprintArea(face.points)>7);
  }
  near(minArea,7.020894201890769);near(minNormalY,.9944690182448152);
});

test('exact coplanar clipping assigns one source owner without holes or residual duplicate road area',()=>{
  const audit=auditSourceRibbon(1.65),{faces,index}=audit;
  let sourceArea=0,ownedArea=0,clippedFaces=0;
  for(const face of faces){
    sourceArea+=footprintArea(face.points);
    if(face.edge.id!=='boulevard'){ownedArea+=footprintArea(face.points);continue;}
    const cutters=index.query(face.minX,face.maxX,face.minZ,face.maxZ).filter(f=>f.edge.id==='alley');
    let fragments=[face.points];
    for(const cutter of cutters)fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,cutter.points));
    const area=fragments.reduce((n,poly)=>n+footprintArea(poly),0);ownedArea+=area;
    if(footprintArea(face.points)-area>1e-7)clippedFaces++;
    for(const poly of fragments){
      for(const p of poly)near(p.y,heightAt(face,p.x,p.z));
      for(const cutter of cutters)assert.ok(footprintArea(intersectRoadFootprint(poly,cutter.points))<1e-7,'clipped fragment has multiple owners');
    }
  }
  assert.ok(clippedFaces>150);assert.ok(audit.overlapArea>1500);
  near(sourceArea-ownedArea,audit.overlapArea,1e-6);
  // This certifies exact source-union ownership math. Emitted terrain, rail
  // exposure and complete scenery support are independently tested by the scene.
});

test('five complete landmark reservations clear all full-width source ribbons by at least20m',()=>{
  const index=new RoadFootprintIndex(sampleRoadFootprints(HARVEST_ROAD_EDGES,1.65)),plots=HARVEST_LANDMARKS.plots;
  assert.equal(plots.length,5);assert.equal(new Set(plots.map(p=>p.id)).size,5);
  for(let i=0;i<plots.length;i++){
    const p=plots[i];assert.ok(index.clearAt(p.x,p.z,p.radius+20),p.id);
    for(const q of plots.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+3);
  }
});

test('barn source walls never intersect road and roof footprint has genuine 18m lane clearance',()=>{
  const faces=sampleRoadFootprints(HARVEST_ROAD_EDGES,1.65);let roofIntersections=0;
  for(const solid of HARVEST_BARN.solids){
    const [x0,y0,z0]=solid.min,[x1,,z1]=solid.max,box=[new Vec3(x0,y0,z0),new Vec3(x1,y0,z0),new Vec3(x1,y0,z1),new Vec3(x0,y0,z1)];
    for(const face of faces){
      const overlap=intersectRoadFootprint(face.points,box);
      if(overlap.length<3||footprintArea(overlap)<1e-7)continue;
      assert.equal(solid.id,'roof-and-tie-envelope','barn side wall blocks full-width road');assert.equal(face.edge.id,'alley');
      for(const p of overlap)near(y0-heightAt(face,p.x,p.z),18);
      roofIntersections++;
    }
  }
  assert.equal(roofIntersections,70);
});
