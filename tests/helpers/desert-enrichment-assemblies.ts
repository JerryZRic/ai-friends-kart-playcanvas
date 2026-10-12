/** Independent fixed assembly recipe, full surface support and exact blockers. */
import assert from 'node:assert/strict';
import type {DesertSceneGeometry} from '../../src/desert-scenery';
import {safeLandCamera} from '../../src/land-camera';
import {MeshOracle,ComponentOracle,area,area3D,boundsOf,cross2,height,hullXZ,supportCoverage,prismIntersection,coincidentOutwardPolygon,convexPlanes,clipPlane,dot,sub,type Provenance,type Triangle,type V} from './emitted-scene-oracle';
import {emittedRange,wholeSurfaceSupport,pointFootprintDistance} from './harvest-enrichment-surface-support';
import {desertPairIntrusion} from './desert-enrichment-solids';
type Part=DesertSceneGeometry['components'][number];
export const DESERT_ASSEMBLY_IDS=['desert-enrichment-eastern-crown-bench','desert-enrichment-inner-descent-bench','desert-enrichment-crescent-near-bay','desert-enrichment-crescent-high-bay','desert-enrichment-crescent-west-bay'];
export function desertAssemblyRecipe(id:string){
 assert.ok(DESERT_ASSEMBLY_IDS.includes(id));const rows:{id:string;kind:string;supportOwner:string[]}[]=[],add=(kind:string,supports:number[])=>rows.push({id:id+':'+rows.length,kind:'desert-enrichment-'+kind,supportOwner:supports.map(n=>id+':'+n)});
 if(id.endsWith('-bench'))for(let i=0;i<9;i++)add('joined-bench-course-'+i,i?[i-1]:[]);
 else{
  add('court-conforming-platform',[]);for(let i=0;i<4;i++){add('court-stone-post-shoe',[0]);add('court-load-bearing-post',[1+i*2]);}add('court-transverse-eave',[2,6]);add('court-transverse-eave',[4,8]);add('court-longitudinal-eave',[9,10]);add('court-longitudinal-eave',[9,10]);for(let i=0;i<4;i++){add('court-seated-knee-brace',[2+i*2,i%2?10:9]);add('court-seated-knee-brace',[2+i*2,i<2?11:12]);}add('court-sagging-closed-cloth',[9,10,11,12]);for(let i=0;i<3;i++)add('court-seated-roof-seam',[21]);add('court-low-rear-workbench',[0]);add('court-seated-stone-worktop',[25]);
  add('court-low-entry-edge',[0]);add('court-entry-edge-cap',[27]);add('court-low-entry-edge',[0]);add('court-entry-edge-cap',[29]);
  add('court-attached-contrasting-valance',[9]);
  if(id==='desert-enrichment-crescent-near-bay'){
   for(let i=0;i<4;i++)add('loading-table-leg',[0]);add('loading-table-bearer',[32,34]);add('loading-table-bearer',[33,35]);for(let i=0;i<16;i++)add('loading-table-deck-slat',[36,37]);
   const deck=(x:number,r:number)=>Array.from({length:16},(_,i)=>i).filter(i=>Math.abs((i-7.5)*1.07-x)<r+.515-1e-5).map(i=>38+i);
   add('loading-stacked-crate',deck(-4.8,2.1));add('loading-crate-bound-front-stave',[54]);add('loading-crate-bound-front-stave',[54]);add('loading-stacked-covered-textile',[54]);
   add('loading-stacked-crate',deck(0,2));add('loading-crate-bound-front-stave',[58]);add('loading-crate-bound-front-stave',[58]);add('loading-stacked-covered-textile',[58]);
   add('loading-open-amphora',deck(4.8,1.75*.53));add('loading-amphora-attached-handle',[62]);add('loading-amphora-attached-handle',[62]);
  }
 }
 return rows;
}
export function desertOpposingContactArea(parts:ComponentOracle,a:Provenance,b:Provenance){let area=0;for(const q of parts.triangles.get(a)!)for(const r of parts.triangles.get(b)!){if(q.min.some((v,k)=>v>r.max[k]+1e-7)||q.max.some((v,k)=>v<r.min[k]-1e-7))continue;const patch=coincidentOutwardPolygon(q,{...r,b:r.c,c:r.b});if(patch)area+=area3D(patch.polygon);}return area;}
/** For two convex braces, prove the complete positive-volume intersection's
 * boundary vertices lie in their actual shared upright. A center is insufficient. */
function buriedConvexJoin(parts:ComponentOracle,a:Provenance,b:Provenance,cover:Provenance){
 const ap=convexPlanes(parts,a),bp=convexPlanes(parts,b),cp=convexPlanes(parts,cover);if(!ap||!bp||!cp)return null;const polygons:V[][]=[];
 for(const [faces,planes]of [[parts.triangles.get(a)!,bp],[parts.triangles.get(b)!,ap]] as const)for(const q of faces){let p=[q.a,q.b,q.c];for(const plane of planes){p=clipPlane(p,v=>-dot(plane.n,sub(v,plane.a)));if(!p.length)break;}if(area3D(p)>1e-9)polygons.push(p);}
 if(!polygons.length||polygons.flat().some(p=>cp.some(plane=>dot(plane.n,sub(p,plane.a))>1e-7)))return null;
 return{cover:cover.kind,polygonCount:polygons.length,intersectionVertices:polygons.flat(),proof:'Entire convex intersection boundary inside actual closed shared support'};
}
export function desertAssemblyChecks(g:DesertSceneGeometry,mesh:MeshOracle,parts:ComponentOracle,added:Part[],old:any){
 assert.deepEqual(g.enrichmentAssemblies.map(a=>a.id),DESERT_ASSEMBLY_IDS,'Two large benches and three reviewed open court compositions only');
 const byId=new Map<string,Part>(),itemByPart=new Map<Provenance,any>(),assemblyOf=new Map<Provenance,string>(),grounded=new Set<Provenance>(),declared=new Set<Part>(),contacts:any[]=[],groundWitnesses:any[]=[],intrusions:any[]=[],buriedJoints:any[]=[],intentionalJoins:any[]=[];
 const terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Desert connected sculpted dune terrain').map(q=>q.id));let cameraFaces=0,roadPrisms=0,seatedFaces=0;const openBayWitnesses:any[]=[],potteryOpenings:any[]=[];
 for(const assembly of g.enrichmentAssemblies){
  assert.deepEqual(assembly.pieces.map(({id,kind,supportOwner})=>({id,kind,supportOwner})),desertAssemblyRecipe(assembly.id),'Full independent support graph: '+assembly.id);assert.equal(assembly.groundContacts.length,1);assert.equal(assembly.groundContacts[0].pieceId,assembly.id+':0');
  const members:Part[]=[];
  for(const item of assembly.pieces){const matched=added.filter(p=>p.batch===item.batch&&p.vertexStart===item.vertexStart&&p.vertexEnd===item.vertexEnd&&p.indexStart===item.indexStart&&p.indexEnd===item.indexEnd);assert.equal(matched.length,1,'Exact whole indexed range ownership');const p=matched[0];assert.ok(!declared.has(p));declared.add(p);members.push(p);byId.set(item.id,p);itemByPart.set(p,item);assemblyOf.set(p,assembly.id);assert.deepEqual({min:item.min,max:item.max},parts.bounds.get(p));assert.equal(p.kind,item.kind);assert.equal(p.landmark,undefined);
   for(const id of item.supportOwner){const support=byId.get(id);assert.ok(support&&support!==p,'Supports are preceding physical members');const faceArea=desertOpposingContactArea(parts,p,support),penetration=desertPairIntrusion(parts,p,support);assert.ok(faceArea>1e-7||penetration,item.id+' must have positive-area or actual penetrating structural contact with '+id);contacts.push({id,supported:item.id,faceArea,penetration});}
   if(item.supportOwner.length&&item.supportIndexStart!==undefined){const faces=emittedRange(parts,p,item.supportIndexStart,item.supportIndexEnd,'full stratum lower cap'),supportIds=new Set(item.supportOwner.flatMap(id=>parts.triangles.get(byId.get(id)!)!.filter(q=>cross2(q.a,q.b,q.c)<-1e-9).map(q=>q.id))),result=wholeSurfaceSupport(mesh,faces,supportIds,0,0,item.id+' complete joined stratum interface');seatedFaces+=result.faces;}
   if(['desert-enrichment-court-stone-post-shoe','desert-enrichment-court-load-bearing-post','desert-enrichment-court-low-rear-workbench','desert-enrichment-court-low-entry-edge','desert-enrichment-loading-table-leg'].includes(p.kind)){
    const bottom=parts.bounds.get(p)!.min[1],foot=hullXZ(parts.points(p).filter(v=>Math.abs(v[1]-bottom)<1e-8)),supportIds=new Set(item.supportOwner.flatMap(id=>parts.triangles.get(byId.get(id)!)!.map(q=>q.id))),coverage=supportCoverage(mesh,foot,(q,poly)=>supportIds.has(q.id)&&cross2(q.a,q.b,q.c)<-1e-9&&poly.every(v=>Math.abs(height(q,v[0],v[2])-bottom)<1e-7));assert.ok(area(foot)>1e-7&&coverage.uncovered<1e-6,item.id+' complete lower seat carried by actual support');seatedFaces++;
   }
  }
  for(const contact of assembly.groundContacts){const p=byId.get(contact.pieceId)!;grounded.add(p);assert.deepEqual(itemByPart.get(p).supportOwner,[]);const faces=emittedRange(parts,p,contact.bottomIndexStart,contact.bottomIndexEnd,contact.pieceId+' terrain-conforming bottom');assert.ok(faces.every(q=>cross2(q.a,q.b,q.c)>1e-9),'Every actual bottom support face points down');assert.equal(contact.terrainPenetrationMetres,.04);const result=wholeSurfaceSupport(mesh,faces,terrainIds,-.04,-.04,contact.pieceId+' full actual terrain-following bottom');
   const bottomIds=new Set(faces.map(q=>q.id)),coverage=supportCoverage(mesh,contact.footprint,(q)=>bottomIds.has(q.id));assert.ok(coverage.uncovered<1e-6,contact.pieceId+' declared full footprint equals actual ground-contact face union: '+JSON.stringify({uncovered:coverage.uncovered,intersections:coverage.intersections,actualArea:faces.reduce((n,q)=>n+area([q.a,q.b,q.c]),0),declaredArea:area(contact.footprint)}));assert.ok(Math.abs(faces.reduce((n,q)=>n+area([q.a,q.b,q.c]),0)-area(contact.footprint))<1e-5,contact.pieceId+' ground-contact faces cannot overlap or claim unmodeled footprint');
   let low=Infinity,high=-Infinity;for(const q of faces)for(const p of [q.a,q.b,q.c]){low=Math.min(low,p[1]+.04);high=Math.max(high,p[1]+.04);}assert.ok(Math.abs(low-contact.terrainLow)<1e-7&&Math.abs(high-contact.terrainHigh)<1e-7);assert.ok(Math.abs(contact.bottom-(low-.04))<1e-7);groundWitnesses.push({pieceId:contact.pieceId,...result,terrainLow:low,terrainHigh:high});
  }
  const actual=members.flatMap(p=>parts.triangles.get(p)!.map(q=>[q.a,q.b,q.c])),blockers=g.cameraObstacles.filter(o=>o.kind===assembly.id+'-exact-triangles');assert.equal(blockers.length,1);assert.ok(blockers[0].triangles&&!blockers[0].heightfield,'New roofs and arches use actual face payloads,never filled AABBs');assert.deepEqual(blockers[0].triangles,actual,'Complete ordered camera payload includes every emitted new face once');assert.deepEqual({min:blockers[0].min,max:blockers[0].max},boundsOf(actual.flat()));cameraFaces+=actual.length;
  if(assembly.id.endsWith('-bay')&&!assembly.id.endsWith('-near-bay')){
   const y=parts.bounds.get(members[0])!.max[1]+4,centers=members.filter(p=>p.kind==='desert-enrichment-court-transverse-eave').map(p=>{const b=parts.bounds.get(p)!;return[(b.min[0]+b.max[0])/2,y,(b.min[2]+b.max[2])/2];});assert.equal(centers.length,2);const [a,b]=centers;assert.equal(mesh.firstHit(a,b),null,'Two unoccupied bays retain actual open post-to-post passage');const point=(p:V)=>({x:p[0],y:p[1],z:p[2]});assert.deepEqual(safeLandCamera(point(a),point(b),blockers),point(b),'Exact triangle blocker must retain the open fabric bay,unlike a filled box');openBayWitnesses.push({assembly:assembly.id,a,b});
  }
  for(const vessel of members.filter(p=>p.kind==='desert-enrichment-loading-open-amphora')){
   const box=parts.bounds.get(vessel)!,x=(box.min[0]+box.max[0])/2,z=(box.min[2]+box.max[2])/2,a=[x,box.max[1]+.2,z],b=[x,box.min[1]-.1,z],hit=mesh.firstHit(a,b);assert.ok(hit&&parts.owner.get(hit.triangle.id)===vessel,'Open amphora center ray reaches its own actual deep floor');const hitY=a[1]+(b[1]-a[1])*hit.fraction;assert.ok(hitY<box.min[1]+.25&&hitY>box.min[1]+.20,'New pottery cavity remains genuinely deep');assert.equal(parts.inside([x,(box.min[1]+box.max[1])/2,z],vessel),false,'Hollow cavity is outside the material volume');potteryOpenings.push({piece:itemByPart.get(vessel).id,a,b,hitY,depth:box.max[1]-hitY});
  }
  for(const landmark of g.landmarks)assert.ok(pointFootprintDistance(landmark.position,hullXZ(actual.flat()))>landmark.radius+1e-7,assembly.id+' outside complete original hero cylinder');
 }
 assert.equal(declared.size,added.length);assert.equal(added.length,147);assert.equal(g.cameraObstacles.length,old.prefixes.cameraObstacles.count+5,'Exactly five appended actual mesh camera groups');
 const roadIds=new Set(mesh.triangles.filter(q=>parts.owner.get(q.id)!.role==='road').map(q=>q.id));
 for(const p of added)for(const q of parts.triangles.get(p)!)for(const road of mesh.query(q.min,q.max))if(roadIds.has(road.id)&&road.min[1]+.15<=q.max[1]&&road.max[1]+3.2>=q.min[1]){roadPrisms++;assert.ok(area3D(prismIntersection(q,road,.15,3.2))<1e-7,p.kind+' actual vertical/oblique triangle cannot enter complete3.2m road body prism');}
 const seen=new Set<string>();
 for(const p of added){const box=parts.bounds.get(p)!;for(const other of new Set(mesh.query(box.min,box.max).map(q=>parts.owner.get(q.id)!))){if(other===p||!other.solid||grounded.has(p)&&other.kind==='dune-body-connected-terrain')continue;const key=[g.components.indexOf(p),g.components.indexOf(other as Part)].sort((a,b)=>a-b).join(':');if(seen.has(key))continue;seen.add(key);const intrusion=desertPairIntrusion(parts,p,other);if(!intrusion)continue;
   const own=itemByPart.get(p),them=itemByPart.get(other),direct=own.supportOwner.includes(them?.id)||them?.supportOwner.includes(own.id);
   if(direct){intentionalJoins.push({piece:own.id,other:them?.id,witness:intrusion,scope:'Explicit individually named structural support pair'});continue;}
   const shared=them?own.supportOwner.filter((id:string)=>them.supportOwner.includes(id)):[],proof=shared.map((id:string)=>buriedConvexJoin(parts,p,other,byId.get(id)!)).find(Boolean);if(proof){buriedJoints.push({piece:own.id,other:them.id,proof});continue;}
   intrusions.push({piece:own.id,other:them?.id??other.kind,witness:intrusion});
  }}
 assert.equal(openBayWitnesses.length,2);assert.equal(potteryOpenings.length,1);
 return{assemblies:g.enrichmentAssemblies.length,pieces:added.length,cameraFaces,roadPrisms,seatedFaces,contacts,groundWitnesses,openBayWitnesses,potteryOpenings,intentionalJoins,buriedJoints,intrusions};
}
