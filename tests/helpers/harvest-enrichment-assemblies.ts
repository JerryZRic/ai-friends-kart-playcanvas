/** Every new farm group is accepted from actual indexed solids and full contacts. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {HarvestSceneGeometry} from '../../src/harvest-scenery';
import type {HarvestPart} from './harvest-enrichment-contract';
import {MeshOracle,ComponentOracle,hullXZ,area,area3D,cross2,boundsOf,supportCoverage,height,convexPlanes,type V} from './emitted-scene-oracle';
import {pointFootprintDistance} from './harvest-enrichment-surface-support';
import {triangleInsideConvex} from './town-enrichment-geometry';
/** Independent reviewed names, roles and support graph, never selected by candidate labels. */
export function harvestFarmRecipe(id:string){
 const rows:{id:string;role:string;supportOwner:string[]}[]=[],add=(name:string,role:string,owners:string[])=>rows.push({id:id+'/'+name,role,supportOwner:owners.map(owner=>owner==='terrain'?'terrain':id+'/'+owner)});
 assert.ok(['mill-shelter','silo-loading','orchard-hay-yard','contour-hay-yard'].includes(id),'Only four reviewed assembly identities');
 add('continuous-foundation','terrain-grounded-base',['terrain']);add('foundation-cap','continuous-cap',['continuous-foundation']);
 if(id.endsWith('hay-yard')){
  const bale=(name:string,role:string,owners:string[])=>{add(name,role,owners);for(let i=0;i<2;i++)add(name+'-tie-'+i,'hay-binding-tie',[name]);};
  for(let i=0;i<3;i++)bale('lower-bale-'+i,'stored-harvest-mass',['foundation-cap']);
  for(let i=0;i<2;i++)bale('middle-bale-'+i,'stacked-harvest-mass',['lower-bale-'+i,'lower-bale-'+(i+1)]);
  bale('top-bale','stacked-harvest-mass',['middle-bale-0','middle-bale-1']);
 }else{
  for(let x=0;x<3;x++)for(let z=0;z<2;z++)add('post-'+x+'-'+z,'grounded-upright',['foundation-cap']);
  for(let z=0;z<2;z++)add('wall-plate-'+z,'load-bearing-frame',[0,1,2].map(x=>'post-'+x+'-'+z));
  for(let x=0;x<3;x++)for(const side of ['north','south'])add('rafter-'+x+'-'+side,'load-bearing-frame',['wall-plate-'+(side==='north'?0:1)]);
  add('supported-ridge','load-bearing-frame',[0,1,2].flatMap(x=>['north','south'].map(side=>'rafter-'+x+'-'+side)));
  for(const side of ['north','south'])add('thin-roof-'+side,'thin-supported-roof',[0,1,2].map(x=>'rafter-'+x+'-'+side));
  if(id==='mill-shelter'){for(const side of ['west','east'])add('lower-hay-rick-'+side,'stored-harvest-mass',['foundation-cap']);add('upper-hay-rick','stacked-harvest-mass',['lower-hay-rick-west']);}
  else for(let i=0;i<2;i++){add('grain-bulk-'+i,'stored-harvest-mass',['foundation-cap']);for(const side of ['front','back'])add('crib-plank-'+i+'-'+side,'retaining-crib-wall',['foundation-cap']);}
 }
 return rows;
}
export function assertHarvestFarmRecipe(id:string,pieces:readonly {id:string;role:string;supportOwner:string[]}[]){assert.deepEqual(pieces.map(({id,role,supportOwner})=>({id,role,supportOwner})),harvestFarmRecipe(id),'Every new farm role and complete support graph matches the independent reviewed recipe');}
export function harvestAssemblyChecks(g:HarvestSceneGeometry,mesh:MeshOracle,parts:ComponentOracle,provenance:HarvestPart[],receipt:any,baseline:boolean){
 const assemblies=(g as any).enrichmentAssemblies??[];
 if(baseline){assert.equal(assemblies.length,0);return{assemblies:0,pieces:0,contacts:0,grounded:0,cameraFaces:0,unrelatedIntersections:[],groundWitnesses:[]};}
 assert.deepEqual(assemblies.map((a:any)=>a.id).sort(),receipt.approvedAssemblies.map((a:any)=>a.id).sort(),'Only precisely reviewed farm groups exist');
 const members=provenance.filter(p=>p.scope==='assembly'),byPiece=new Map<string,HarvestPart>(),declared=new Set<HarvestPart>(),assemblyOf=new Map<HarvestPart,string>(),rootParts=new Set<HarvestPart>();
 let contacts=0,grounded=0,cameraFaces=0,wholeSeatContacts=0;const groundWitnesses:any[]=[],unrelatedIntersections:any[]=[];
 const terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Harvest connected contour earth').map(q=>q.id));
 for(const assembly of assemblies){
  const approved=receipt.approvedAssemblies.find((a:any)=>a.id===assembly.id);assert.ok(approved&&assembly.label&&assembly.pieces.length&&assembly.groundContacts.length);
  assert.deepEqual(assembly.pieces.map((p:any)=>p.id),approved.pieceIds,'Exact approved original assembly recipe');assertHarvestFarmRecipe(assembly.id,assembly.pieces);assert.deepEqual(assembly.groundContacts.map((p:any)=>p.pieceId),[assembly.id+'/continuous-foundation'],'Exactly the reviewed continuous foundation owns the whole ground contact');
  const roots=new Set(assembly.groundContacts.map((c:any)=>c.pieceId)),prior=new Map<string,HarvestPart>(),owned:HarvestPart[]=[];
  for(const item of assembly.pieces){
   assert.ok(item.role&&Array.isArray(item.supportOwner)&&item.supportOwner.length&&item.id.startsWith(assembly.id+'/'));assert.ok(!byPiece.has(item.id),'Stable new assembly piece ids unique');
   const found=members.filter(p=>p.batch===item.batch&&p.vertexStart===item.vertexStart&&p.vertexEnd===item.vertexEnd&&p.indexStart===item.indexStart&&p.indexEnd===item.indexEnd);assert.equal(found.length,1,'New piece has exact full indexed ownership');const p=found[0];assert.equal(item.kind,p.kind);assert.equal(p.kind,'harvest-enrichment-'+assembly.id+'-'+item.id.slice(assembly.id.length+1));assert.ok(!declared.has(p),'No component belongs to two assemblies');
   assert.equal(g.components[p.sourceComponent!].landmark,undefined,'New group cannot borrow original landmark reservation');assert.deepEqual(parts.bounds.get(p),{min:item.min,max:item.max});assert.ok(parts.closedShell(p),'New farm member is a closed consistently wound indexed solid');assert.ok(convexPlanes(parts,p),'Reviewed simple farm member remains an actual convex solid');
   if(roots.has(item.id)){assert.deepEqual(item.supportOwner,['terrain']);rootParts.add(p);}else{for(const owner of item.supportOwner){const support=prior.get(owner);assert.ok(support,'Every elevated member names a previous physical member');assert.ok(parts.attachment(p,support),item.id+' has real indexed contact with declared support '+owner);contacts++;}}
   if(['continuous-cap','grounded-upright','stored-harvest-mass','stacked-harvest-mass','retaining-crib-wall'].includes(item.role)){
    const bottom=parts.bounds.get(p)!.min[1],foot=hullXZ(parts.points(p).filter(v=>Math.abs(v[1]-bottom)<1e-8)),supportIds=new Set(item.supportOwner.flatMap((id:string)=>parts.triangles.get(prior.get(id)!)!.map(q=>q.id)));assert.ok(area(foot)>1e-7);
    const coverage=supportCoverage(mesh,foot,(q,poly)=>supportIds.has(q.id)&&cross2(q.a,q.b,q.c)<-1e-9&&poly.every(v=>Math.abs(height(q,v[0],v[2])-bottom)<.025));assert.ok(coverage.uncovered<1e-6,item.id+' entire indexed lower seat is carried by actual declared support');wholeSeatContacts++;
   }
   byPiece.set(item.id,p);prior.set(item.id,p);owned.push(p);declared.add(p);assemblyOf.set(p,assembly.id);
  }
  for(const contact of assembly.groundContacts){
   const p=prior.get(contact.pieceId);assert.ok(p);const points=parts.points(p),bottom=parts.bounds.get(p)!.min[1],foot=hullXZ(points.filter(v=>Math.abs(v[1]-bottom)<1e-8));assert.ok(area(foot)>1e-6);assert.ok(Math.abs(contact.bottom-bottom)<1e-8);const cs=Math.cos(approved.yaw),sn=Math.sin(approved.yaw),[cx,cz]=approved.centerXZ,[w,d]=approved.foundationDimensions,expected=hullXZ([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>[cx+x*cs+z*sn,0,cz-x*sn+z*cs]));assert.equal(foot.length,4);for(let i=0;i<foot.length;i++)assert.ok(Math.hypot(foot[i][0]-expected[i][0],foot[i][2]-expected[i][2])<1e-7,'Exact reviewed full compound footprint dimensions and yaw');
   const authored=hullXZ(contact.footprint);assert.equal(authored.length,foot.length);for(let i=0;i<foot.length;i++)assert.ok(Math.hypot(authored[i][0]-foot[i][0],authored[i][2]-foot[i][2])<1e-7,'Whole declared contact equals indexed base');
   let low=Infinity,high=-Infinity;const coverage=supportCoverage(mesh,foot,(q,poly)=>{if(!terrainIds.has(q.id))return false;for(const v of poly){const y=height(q,v[0],v[2]);low=Math.min(low,y);high=Math.max(high,y);assert.ok(bottom<y-1e-7,'Entire emitted new foundation base is buried in actual terrain');}return true;});assert.ok(coverage.uncovered<1e-6);assert.ok(parts.bounds.get(p)!.max[1]>high+.01,'Foundation reaches above highest terrain');assert.ok(Math.abs(bottom-(low-.22))<1e-7,'Original foundation method burial depth stays exact');assert.ok(Math.abs(low-contact.terrainLow)<1e-7&&Math.abs(high-contact.terrainHigh)<1e-7,'Authored extrema equal whole actual emitted terrain intersections');grounded++;groundWitnesses.push({assembly:assembly.id,piece:contact.pieceId,bottom,terrainLow:low,terrainHigh:high,footprint:foot,intersections:coverage.intersections});
  }
  const blockers=g.cameraObstacles.filter(o=>o.kind==='harvest-enrichment-'+assembly.id+'-exact-triangles');assert.equal(blockers.length,1,'Each new group owns one exact mesh blocker');assert.ok(blockers[0].triangles&&!blockers[0].heightfield);
  const actual=owned.flatMap(p=>parts.triangles.get(p)!.map(q=>[q.a,q.b,q.c])),key=(q:readonly V[])=>JSON.stringify(q),counts=(qs:readonly (readonly V[])[])=>{const counts=new Map<string,number>();for(const q of qs){const k=key(q);counts.set(k,(counts.get(k)??0)+1);}return[...counts].sort(([a],[b])=>a.localeCompare(b));};assert.deepEqual(counts(blockers[0].triangles!),counts(actual),'Full new group camera payload equals emitted face multiplicity');assert.deepEqual({min:blockers[0].min,max:blockers[0].max},boundsOf(actual.flat()));cameraFaces+=actual.length;
  const prop=g.props.filter(p=>p.kind==='harvest-enrichment-'+assembly.id);assert.equal(prop.length,1,'Independent group has one actual prop identity');assert.deepEqual([prop[0].x,prop[0].z],approved.centerXZ,'Exact reviewed compound placement');for(const point of actual.flat())assert.ok(Math.hypot(point[0]-prop[0].x,point[2]-prop[0].z)<=prop[0].radius+1e-7,'Prop radius covers complete emitted group');
  for(const landmark of g.landmarks)assert.ok(pointFootprintDistance(landmark.position,hullXZ(actual.flat()))>landmark.radius+3-1e-7,'Whole actual new group footprint leaves original reserved landmark volume intact');
 }
 assert.equal(declared.size,members.length,'Every emitted new piece has one declared reviewed assembly');
 for(const p of members){
  const planes=convexPlanes(parts,p)!,box=parts.bounds.get(p)!;
  for(const q of mesh.query(box.min,box.max)){
   const owner=parts.owner.get(q.id)!;if(assemblyOf.get(owner as HarvestPart)===assemblyOf.get(p)||rootParts.has(p)&&terrainIds.has(q.id)||q.min.some((v,k)=>v>box.max[k]+1e-7)||q.max.some((v,k)=>v<box.min[k]-1e-7))continue;
   const polygon=triangleInsideConvex(q,planes);if(area3D(polygon)>1e-7)unrelatedIntersections.push({piece:p.kind,other:owner.kind,batch:q.batch,indexStart:q.indexStart,polygon});
  }
  for(const owner of new Set(mesh.query(box.min,box.max).map(q=>parts.owner.get(q.id)!))){if(assemblyOf.get(owner as HarvestPart)===assemblyOf.get(p)||owner.kind==='source-terrain')continue;for(const point of parts.points(p))if(parts.inside(point,owner)){unrelatedIntersections.push({piece:p.kind,other:owner.kind,point,reason:'New indexed vertex inside unrelated original closed component'});break;}}
 }
 assert.equal(unrelatedIntersections.length,0,'New farm groups intersect unrelated source geometry: '+JSON.stringify(unrelatedIntersections.slice(0,16)));
 const viewManifest=JSON.parse(readFileSync('docs/harvest-enrichment-cameras.json','utf8')),forwardVisibility:any[]=[];
 for(const view of viewManifest.views.filter((v:any)=>v.name.startsWith('harvest-chase-'))){
  const eye:V=view.sourceEye,target:V=view.sourceTarget,forward=target.map((v,k)=>v-eye[k]),length=Math.hypot(...forward);forward.forEach((v,k)=>forward[k]=v/length);const right=[-forward[2],0,forward[0]],rightLength=Math.hypot(...right);right.forEach((v,k)=>right[k]=v/rightLength);const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]],rows=assemblies.map((a:any)=>({assembly:a.id,inFrustumFaceCenters:0,visibleFaceCenterRays:0,firstSurfaceWitness:null as any}));
  for(const p of members)for(const q of parts.triangles.get(p)!){const point=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3),ray=point.map((v,k)=>v-eye[k]),dot=(axis:V)=>axis.reduce((n,v,k)=>n+v*ray[k],0),depth=dot(forward),tan=Math.tan(28*Math.PI/180);if(depth<=0||Math.abs(dot(right))>=depth*tan*16/9||Math.abs(dot(up))>=depth*tan)continue;const id=assemblyOf.get(p),row=rows.find((r:any)=>r.assembly===id)!;row.inFrustumFaceCenters++;const hit=mesh.firstHit(eye,point);if(hit&&assemblyOf.get(parts.owner.get(hit.triangle.id) as HarvestPart)===id){row.visibleFaceCenterRays++;row.firstSurfaceWitness??={batch:hit.triangle.batch,indexStart:hit.triangle.indexStart,eye,rayTarget:point,vertices:[hit.triangle.a,hit.triangle.b,hit.triangle.c]};}}
  forwardVisibility.push({view:view.name,rows});
 }
 const unseenAssemblies=assemblies.filter((a:any)=>!forwardVisibility.some(v=>v.rows.some((r:any)=>r.assembly===a.id&&r.visibleFaceCenterRays>0))).map((a:any)=>a.id);assert.deepEqual(unseenAssemblies,[],'Every new farm composition is visible in a genuine frozen forward chase view');
 const revealWitnesses=g.sightlines.map(s=>{const hit=mesh.firstHit(s.eye,s.target);assert.ok(hit,s.name+' targets actual emitted surface');const owner=parts.owner.get(hit.triangle.id) as HarvestPart;assert.equal(g.components[owner.sourceComponent!]?.landmark,s.targetId,s.name+' first actual hit remains the original authored landmark');return{name:s.name,targetId:s.targetId,batch:hit.triangle.batch,indexStart:hit.triangle.indexStart,vertices:[hit.triangle.a,hit.triangle.b,hit.triangle.c]};});
 return{forwardChaseVisibility:{scope:'Finite actual indexed face-center rays in15original frozen forward chase views; no full-silhouette or GPU claim',views:forwardVisibility,unseenAssemblies},revealWitnesses,assemblies:assemblies.length,pieces:members.length,contacts,grounded,wholeSeatContacts,cameraFaces,unrelatedIntersections,groundWitnesses};
}
