import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from 'playcanvas';
import {CALDERA_ROAD_EDGES,CALDERA_LANDMARKS,CALDERA_COURSE,CALDERA_VIADUCT,calderaViaductDepthAt,calderaViaductUndersideAt} from '../src/maps/caldera';
import {sampleRoadFootprints,RoadFootprintIndex,intersectRoadFootprint,subtractRoadFootprint,footprintArea,type RoadFootprint} from '../src/land-road-mesh';

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
  const diff=overlap.map(p=>heightAt(a.points,p.x,p.z)-heightAt(b.points,p.x,p.z)),max=Math.max(...diff.map(Math.abs));
  if(max<1e-10)return 'coplanar';
  const separated=diff.every(v=>v>=28)||diff.every(v=>v<=-28);
  const paired=a.edge.id==='finish'&&CALDERA_VIADUCT.lowerEdges.some(id=>id===b.edge.id)||b.edge.id==='finish'&&CALDERA_VIADUCT.lowerEdges.some(id=>id===a.edge.id);
  assert.ok(paired&&separated,`unintended noncoplanar overlap ${a.edge.id}/${a.distance} and ${b.edge.id}/${b.distance}`);
  for(let i=0;i<diff.length;i++)assert.ok(a.edge.id==='finish'?diff[i]>28:diff[i]<-28,'finish is always the upper layer');
  return 'height-separated';
}
function auditSourceRibbon(spacing:number){
  const faces=sampleRoadFootprints(CALDERA_ROAD_EDGES,spacing),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((face,i)=>[face,i]));
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

test('full-width ribbons retain coplanar fork union and both real height-separated crossings',()=>{
  const a=auditSourceRibbon(1.65);
  assert.equal(a.faces.length,5078);assert.equal(a.pairs,750);assert.equal(a.splitPairs,290);assert.equal(a.mergePairs,460);assert.equal(a.crossingPairs,1048);
  assert.deepEqual([...a.lowerCrossings].sort(),['alley','boulevard']);assert.ok(a.maxPlanarError<8e-15);
  near(a.branchOverlap.split.alley,26.304687011818668);near(a.branchOverlap.split.boulevard,26.32270133139162);
  near(a.branchOverlap.merge.alley,371.5537040419387);near(a.branchOverlap.merge.boulevard,434.3245719679617);
  for(const id of ['alley','boulevard'] as const){
    assert.ok(a.branchOverlap.split[id]>26);
    assert.ok(CALDERA_COURSE.edges[id].length-a.branchOverlap.merge[id]>CALDERA_COURSE.sharedMergeLength!+34,
      'the 40m interaction tail never defines pavement or rail union extent');
  }
});

test('independent coarser ribbons reject unintended overlaps while retaining the legitimate viaduct',()=>{
  const a=auditSourceRibbon(2);
  assert.ok(a.faces.length>4100);assert.ok(a.pairs>500);assert.ok(a.crossingPairs>700);assert.ok(a.maxPlanarError<1e-10);
  assert.deepEqual([...a.lowerCrossings].sort(),['alley','boulevard']);
});

test('every banked source triangle has positive area and upward winding',()=>{
  let minArea=Infinity,minNormalY=Infinity;
  for(const face of sampleRoadFootprints(CALDERA_ROAD_EDGES,1.65)){
    const [a,b,c]=face.points,normal=b.clone().sub(a).cross(b.clone().sub(a),c.clone().sub(a)).normalize();
    minArea=Math.min(minArea,footprintArea(face.points));minNormalY=Math.min(minNormalY,normal.y);
    assert.ok(normal.y>.996);assert.ok(footprintArea(face.points)>7.78);
  }
  near(minArea,7.785296147849294);near(minNormalY,.9960178958459847);
});

test('height-classified clipping gives one coplanar owner and never deletes upper bridge pavement',()=>{
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
  assert.ok(clippedFaces>100);assert.ok(a.overlapArea>1500);assert.equal(crossingsRetained,1048);
  near(sourceArea-ownedArea,a.overlapArea,1e-6);near(upperSourceArea,upperOwnedArea);
  // Exact source-union math only. Emitted terrain, support, rails and camera
  // geometry remain separate scene certification requirements.
});

test('five complete landmark reservations clear all full-width ribbons by at least20m',()=>{
  const index=new RoadFootprintIndex(sampleRoadFootprints(CALDERA_ROAD_EDGES,1.65)),plots=CALDERA_LANDMARKS.plots;
  assert.equal(plots.length,5);assert.equal(new Set(plots.map(p=>p.id)).size,5);
  for(let i=0;i<plots.length;i++){
    const p=plots[i];assert.ok(index.clearAt(p.x,p.z,p.radius+20),p.id);
    for(const q of plots.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+3);
  }
});

test('nearby strips have no hidden local folds or duplicate same-edge area',()=>{
  const faces=sampleRoadFootprints(CALDERA_ROAD_EDGES,1.65),index=new RoadFootprintIndex(faces),ids=new Map(faces.map((face,i)=>[face,i]));let tested=0;
  for(let i=0;i<faces.length;i++)for(const b of index.query(faces[i].minX,faces[i].maxX,faces[i].minZ,faces[i].maxZ)){
    const a=faces[i];if(ids.get(b)!<=i||a.edge.id!==b.edge.id||Math.abs(a.distance-b.distance)>=30)continue;
    tested++;assert.ok(footprintArea(intersectRoadFootprint(a.points,b.points))<1e-7,`local fold ${a.edge.id}/${a.distance}/${b.distance}`);
  }
  assert.ok(tested>5000);
});

test('frozen thick underside reservation clears exact banked lower full-width triangles',()=>{
  const v=CALDERA_VIADUCT,[from,to]=v.upperPhysicalS,stations:number[]=[from];
  for(let s=from+v.sourceStationSpacing;s<to;s+=v.sourceStationSpacing)stations.push(s);
  stations.push(to,...v.supportStations);stations.sort((a,b)=>a-b);
  const underside:Vec3[][]=[];
  for(let i=0;i<stations.length-1;i++){
    const a=stations[i],b=stations[i+1];if(b-a<1e-8)continue;
    const l=calderaViaductUndersideAt(a,-v.deckHalfWidth),r=calderaViaductUndersideAt(a,v.deckHalfWidth),L=calderaViaductUndersideAt(b,-v.deckHalfWidth),R=calderaViaductUndersideAt(b,v.deckHalfWidth);
    underside.push([l,L,r],[r,L,R]);
  }
  let pairs=0,minGap=Infinity;const byEdge={alley:Infinity,boulevard:Infinity};
  for(const face of sampleRoadFootprints([CALDERA_COURSE.edges.alley,CALDERA_COURSE.edges.boulevard],1.65))for(const u of underside){
    const poly=intersectRoadFootprint(face.points,u);if(poly.length<3||footprintArea(poly)<1e-8)continue;
    const gap=Math.min(...poly.map(p=>heightAt(u,p.x,p.z)-heightAt(face.points,p.x,p.z)));
    pairs++;minGap=Math.min(minGap,gap);byEdge[face.edge.id as 'alley'|'boulevard']=Math.min(byEdge[face.edge.id as 'alley'|'boulevard'],gap);
  }
  assert.equal(pairs,1248);near(minGap,26.88434620571539);near(byEdge.alley,27.74471238670082);near(byEdge.boulevard,26.88434620571539);
  assert.ok(minGap>v.minimumRoadUndersideClearance);assert.ok(minGap-v.bodyHeight>23.68);
  for(let i=0;i<v.supportStations.length-1;i++)near(calderaViaductDepthAt((v.supportStations[i]+v.supportStations[i+1])/2),2.4);
  for(const s of v.supportStations)near(calderaViaductDepthAt(s),12.4);
  assert.equal(v.groundLayer,'lower-branches');assert.equal(v.upperLayer,'physical-viaduct-deck');
  // Planned source underside only, never an emitted-structure/terrain/camera proof.
});
