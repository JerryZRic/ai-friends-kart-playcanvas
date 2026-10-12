import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from 'playcanvas';
import {GARDEN_ROAD_EDGES,GARDEN_LANDMARKS,GARDEN_COURSE,GARDEN_ARBOR,gardenArborPlan} from '../src/maps/garden';
import {sampleRoadFootprints,RoadFootprintIndex,intersectRoadFootprint,subtractRoadFootprint,footprintArea,roadFootprint,type RoadFootprint} from '../src/land-road-mesh';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
/** Heights are evaluated at every exact intersection vertex, never nearest centers. */
function heightAt(points:readonly Vec3[],x:number,z:number){
  const [a,b,c]=points,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
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
function layer(a:RoadFootprint,b:RoadFootprint,overlap:Vec3[]){
  const max=Math.max(...overlap.map(p=>Math.abs(heightAt(a.points,p.x,p.z)-heightAt(b.points,p.x,p.z))));
  assert.ok(max<1e-10,`unexpected noncoplanar crossing ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
  return 'coplanar' as string;
}
function auditSourceRibbon(spacing:number){
  const faces=sampleRoadFootprints(GARDEN_ROAD_EDGES,spacing),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((face,i)=>[face,i]));
  let pairs=0,splitPairs=0,mergePairs=0,crossingPairs=0,maxPlanarError=0,overlapArea=0;
  const lowerCrossings=new Set<string>(),branchOverlap={split:{alley:0,boulevard:0},merge:{alley:Infinity,boulevard:Infinity}};
  for(let i=0;i<faces.length;i++){
    const a=faces[i];
    for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){
      if(ids.get(b)!<=i || a.edge.id===b.edge.id&&Math.abs(a.distance-b.distance)<30)continue;
      const overlap=intersectRoadFootprint(a.points,b.points),area=footprintArea(overlap);
      if(overlap.length<3||area<1e-7)continue;
      if(layer(a,b,overlap)==='height-separated'){crossingPairs++;lowerCrossings.add(a.edge.id==='finish'?b.edge.id:a.edge.id);continue;}
      const joint=junction(a,b),maxError=Math.max(...overlap.map(p=>Math.abs(heightAt(b.points,p.x,p.z)-heightAt(a.points,p.x,p.z))));
      assert.ok(joint,`unintended same-height source overlap ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
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
  return{faces,index,pairs,splitPairs,mergePairs,crossingPairs,lowerCrossings,maxPlanarError,overlapArea,branchOverlap};
}

test('full-width ribbons retain the complete coplanar fork union without any road crossing',()=>{
  const a=auditSourceRibbon(1.65);
  assert.equal(a.faces.length,3820);assert.equal(a.pairs,747);assert.equal(a.splitPairs,302);assert.equal(a.mergePairs,445);assert.equal(a.crossingPairs,0);
  assert.deepEqual([...a.lowerCrossings],[]);assert.ok(a.maxPlanarError<8e-15);
  near(a.branchOverlap.split.alley,28.007714926656913);near(a.branchOverlap.split.boulevard,26.34145259134585);
  near(a.branchOverlap.merge.alley,321.26496533518224);near(a.branchOverlap.merge.boulevard,372.07301785276013);
  for(const id of ['alley','boulevard'] as const){
    assert.ok(a.branchOverlap.split[id]>26);
    assert.ok(GARDEN_COURSE.edges[id].length-a.branchOverlap.merge[id]>GARDEN_COURSE.sharedMergeLength!+29,
      'the 40m interaction tail never defines pavement or rail union extent');
  }
});

test('independent coarser ribbons also reject all unintended source crossings',()=>{
  const a=auditSourceRibbon(2);
  assert.ok(a.faces.length>3100);assert.ok(a.pairs>500);assert.ok(a.crossingPairs===0);assert.ok(a.maxPlanarError<1e-10);
  assert.deepEqual([...a.lowerCrossings],[]);
});

test('every banked source triangle has positive area and upward winding',()=>{
  let minArea=Infinity,minNormalY=Infinity;
  for(const face of sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65)){
    const [a,b,c]=face.points,normal=b.clone().sub(a).cross(b.clone().sub(a),c.clone().sub(a)).normalize();
    minArea=Math.min(minArea,footprintArea(face.points));minNormalY=Math.min(minNormalY,normal.y);
    assert.ok(normal.y>.996);assert.ok(footprintArea(face.points)>8.07);
  }
  near(minArea,8.070966030260024);near(minNormalY,.9964746145325973);
});

test('full spatial clipping gives exactly one pavement owner without removing source union area',()=>{
  const a=auditSourceRibbon(1.65),{faces,index}=a,ids=new Map(faces.map((f,i)=>[f,i]));
  let sourceArea=0,ownedArea=0,clippedFaces=0,upperSourceArea=0,upperOwnedArea=0,crossingsRetained=0;
  for(const face of faces){
    sourceArea+=footprintArea(face.points);
    const cutters=index.query(face.minX,face.maxX,face.minZ,face.maxZ).filter(f=>ids.get(f)!<ids.get(face)!&&f.edge.id!==face.edge.id).filter(f=>{
      const overlap=intersectRoadFootprint(face.points,f.points);
      if(overlap.length<3||footprintArea(overlap)<1e-7)return false;
      if(layer(face,f,overlap)==='height-separated'){crossingsRetained++;return false;}
      return true;
    });
    let fragments=[face.points];
    for(const cutter of cutters)fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,cutter.points));
    const area=fragments.reduce((n,poly)=>n+footprintArea(poly),0);ownedArea+=area;
    if(footprintArea(face.points)-area>1e-7)clippedFaces++;
    if(face.edge.id==='finish'){upperSourceArea+=footprintArea(face.points);upperOwnedArea+=area;}
    for(const poly of fragments){
      for(const p of poly)near(p.y,heightAt(face.points,p.x,p.z));
      for(const cutter of cutters)assert.ok(footprintArea(intersectRoadFootprint(poly,cutter.points))<1e-7,'clipped fragment has multiple coplanar owners');
    }
  }
  assert.ok(clippedFaces>100);assert.ok(a.overlapArea>1500);assert.equal(crossingsRetained,0);
  near(sourceArea-ownedArea,a.overlapArea,1e-6);near(upperSourceArea,upperOwnedArea);
  // Exact source-union math only. Emitted terrain, support, rails and camera
  // geometry remain separate scene certification requirements.
});

test('five complete landmark reservations clear all full-width ribbons by at least20m',()=>{
  const index=new RoadFootprintIndex(sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65)),plots=GARDEN_LANDMARKS.plots;
  assert.equal(plots.length,5);assert.equal(new Set(plots.map(p=>p.id)).size,5);
  for(let i=0;i<plots.length;i++){
    const p=plots[i];assert.ok(index.clearAt(p.x,p.z,p.radius+20),p.id);
    for(const q of plots.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+3);
  }
});

test('nearby strips have no hidden local folds or duplicate same-edge area',()=>{
  const faces=sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((face,i)=>[face,i]));let tested=0;
  for(let i=0;i<faces.length;i++)for(const b of index.query(faces[i].minX,faces[i].maxX,faces[i].minZ,faces[i].maxZ)){
    const a=faces[i];if(ids.get(b)!<=i||a.edge.id!==b.edge.id||Math.abs(a.distance-b.distance)>=30)continue;
    tested++;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-7,`local fold ${a.edge.id}/${a.distance}/${b.distance}`);
  }
  assert.ok(tested>5000);
});

test('open timber plan retains all93 named opaque members and twelve complete footprint reservations',()=>{
  const plan=gardenArborPlan(),spec=GARDEN_ARBOR,index=new RoadFootprintIndex(sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65));
  assert.equal(plan.frames.length,6);assert.equal(plan.members.length,93);assert.equal(plan.supports.length,12);
  assert.equal(new Set(plan.members.map(m=>m.id)).size,93);
  const expected={post:12,tie:6,rafter:12,web:18,purlin:25,'roof-lattice':20};
  for(const [kind,count]of Object.entries(expected))assert.equal(plan.members.filter(m=>m.kind===kind).length,count);
  const nodes=new Map<string,Vec3>();
  for(const member of plan.members){
    assert.ok(member.halfWidth>0);assert.equal(member.endExtension,.08);assert.ok(member.a.distance(member.b)>3); 
    for(const [name,p]of [[member.aNode,member.a],[member.bNode,member.b]] as const){
      if(nodes.has(name))assert.deepEqual(p.toArray(),nodes.get(name)!.toArray());else nodes.set(name,p);
    }
  }
  for(const foot of plan.supports){
    assert.equal(foot.footprint.length,4);near(footprintArea(foot.footprint),12.96);
    for(const road of index.query(Math.min(...foot.footprint.map(p=>p.x)),Math.max(...foot.footprint.map(p=>p.x)),Math.min(...foot.footprint.map(p=>p.z)),Math.max(...foot.footprint.map(p=>p.z))))assert.ok(footprintArea(intersectRoadFootprint([...foot.footprint],road.points))<1e-8);
    assert.equal(foot.seedY,16); // Provisional only; actual terrain grounding belongs to scene QA.
  }
  near(spec.tieHeight-spec.memberHalfWidth,22.95);assert.equal(spec.minimumRailOffsetBeyondRoadEdge,3.25);
  assert.equal(spec.physicalS[1]-spec.physicalS[0],80);
  assert.deepEqual(plan.frames.map(f=>f.s),spec.supportStations);
});

test('spatial pavement ownership keeps every source triangle interior and all full-width graph endpoints',()=>{
  const source=sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65),index=new RoadFootprintIndex(source),ids=new Map(source.map((f,i)=>[f,i]));
  const owned:RoadFootprint[]=[];
  for(const face of source){
    let fragments=[face.points];
    for(const cutter of index.query(face.minX,face.maxX,face.minZ,face.maxZ).filter(f=>ids.get(f)!<ids.get(face)!&&f.edge.id!==face.edge.id))fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,cutter.points));
    for(const poly of fragments)owned.push(roadFootprint(face.edge,face.distance,poly));
  }
  const ownership=new RoadFootprintIndex(owned);
  const covers=(x:number,z:number)=>ownership.query(x-1e-7,x+1e-7,z-1e-7,z+1e-7).filter(f=>{
    const turns=f.points.map((a,i)=>{const b=f.points[(i+1)%f.points.length];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);});
    return turns.every(t=>t>=-1e-7)||turns.every(t=>t<=1e-7);
  });
  for(const face of source){
    const x=face.points.reduce((s,p)=>s+p.x,0)/3,z=face.points.reduce((s,p)=>s+p.z,0)/3;
    assert.ok(covers(x,z).length>0,`lost source interior ${face.edge.id}/${face.distance}`);
  }
  for(const edge of GARDEN_ROAD_EDGES)for(const s of [0,edge.length])for(const ratio of [-1,-.5,0,.5,1]){
    const p=edge.sample(s,ratio*edge.halfWidthAt(s)).p;
    assert.ok(covers(p.x,p.z).length>0,`lost endpoint ${edge.id}/${s}/${ratio}`);
  }
  // Exact endpoint ownership includes start, split, both full-width branch ends,
  // merge and lap closure. Forty certified metres never clip the spatial union.
});
