/** Review new indexed shell/support identities; never regenerates historical originals. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {MeshOracle,ComponentOracle,boundsOf,cross2,sub,dot,height,projectedInterval,type V} from './emitted-scene-oracle';
import {airfieldSceneData} from './airfield-enrichment-scene';
import {airfieldSha,airfieldFrozenBaseline,assertAirfieldPreservation} from './airfield-enrichment-contract';
const path=process.argv[2]??'tests/fixtures/airfield-enrichment-assembly-recipes.json',ledger=process.argv[3];assert.ok(ledger,'Explicit cleanup ledger is required');
const source=airfieldSha(readFileSync('src/airfield-scenery.ts')),{geometry:g,theme}=await airfieldSceneData(false,ledger),old=airfieldFrozenBaseline();assertAirfieldPreservation(g,theme,old);
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,g.components),terrainIds=new Set(mesh.triangles.filter(q=>parts.owner.get(q.id)!.role==='terrain').map(q=>q.id));
const normative=[
 {id:'airfield-enrichment-runway-workshop',modules:['airfield-enrichment-runway-high-workshop','airfield-enrichment-runway-low-wing'],terraces:['airfield-enrichment-runway-loading-terrace'],screens:[]},
 {id:'airfield-enrichment-perimeter-court',modules:['airfield-enrichment-perimeter-low-bay','airfield-enrichment-perimeter-high-bay'],terraces:['airfield-enrichment-perimeter-low-apron','airfield-enrichment-perimeter-return-apron'],screens:['airfield-enrichment-perimeter-high-bay']},
 {id:'airfield-enrichment-return-terrace',modules:['airfield-enrichment-return-low-shelter'],terraces:['airfield-enrichment-return-long-terrace','airfield-enrichment-return-short-terrace'],screens:['airfield-enrichment-return-low-shelter']},
];
assert.deepEqual((g as any).enrichmentAssemblies.map((a:any)=>a.id),normative.map(r=>r.id),'Three independently reviewed service compositions');
const assemblies=(g as any).enrichmentAssemblies.map((assembly:any)=>{
 const spec=normative.find(s=>s.id===assembly.id)!;
 const expected=new Map<string,string[]>();
 for(const module of spec.modules){const pad=module+'-complete-working-pad-whole-footprint-foundation';expected.set(pad,[]);for(let row=0;row<3;row++){const posts:string[]=[];for(let col=0;col<(row===1?2:3);col++){const shoe=module+'-complete-column-shoe-'+row+'-'+col,post=module+'-blue-steel-column-'+row+'-'+col;expected.set(shoe,[pad]);expected.set(post,[shoe]);posts.push(post);}expected.set(module+'-roof-bearing-'+row,posts);}expected.set(module+'-thick-opaque-shed-roof',[0,1,2].map(i=>module+'-roof-bearing-'+i));if(spec.screens.includes(module))expected.set(module+'-founded-short-end-screen',[pad]);}
 if(assembly.id==='airfield-enrichment-runway-workshop'){const module='airfield-enrichment-runway-low-wing';for(const side of ['rear','return']){const wall=module+'-'+side+'-cream-service-wall';expected.set(wall,[module+'-complete-working-pad-whole-footprint-foundation']);expected.set(module+'-'+side+'-teal-service-band',[wall]);}}
 if(assembly.id==='airfield-enrichment-perimeter-court'){const cart='airfield-enrichment-perimeter-propeller-overhaul-cart',pad=cart+'-whole-maintenance-pad-whole-footprint-foundation',deck=cart+'-blue-steel-working-deck',stand=cart+'-broad-propeller-service-stand',hub=cart+'-octagonal-propeller-hub';expected.set(pad,[]);const wheels=[0,1,2,3].map(i=>cart+'-flat-contact-wheel-'+i);for(const wheel of wheels)expected.set(wheel,[pad]);expected.set(deck,wheels);expected.set(stand,[deck]);expected.set(hub,[stand]);for(let i=0;i<4;i++)expected.set(cart+'-swept-spare-propeller-blade-'+i,[hub]);}
 for(const name of spec.terraces)expected.set(name+'-whole-footprint-foundation',[]);
 assert.deepEqual(assembly.pieces.map((p:any)=>p.kind).sort(),[...expected.keys()].sort(),'Exact independently reviewed physical member inventory, never guessed producer flags');
 const kindById=new Map(assembly.pieces.map((p:any)=>[p.id,p.kind]));for(const item of assembly.pieces)assert.deepEqual(item.supportOwner.map((id:string)=>kindById.get(id)).sort(),[...expected.get(item.kind)!].sort(),item.kind+' complete intended ground-to-pad-to-shoe-to-column-to-beam-to-roof chain');

 const byId=new Map(assembly.pieces.map((p:any)=>[p.id,p])),pieces=assembly.pieces.map((item:any)=>({id:item.id,kind:item.kind,supportOwner:item.supportOwner,componentRecords:item.componentIndices.map((componentIndex:number)=>({componentIndex,component:g.components[componentIndex]}))}));
 const flatFeet=assembly.pieces.filter((p:any)=>/complete-column-shoe-|blue-steel-column-|founded-short-end-screen|cream-service-wall$|teal-service-band$|flat-contact-wheel-|broad-propeller-service-stand$/.test(p.kind)).map((p:any)=>p.id);
 const roofSeats=[...new Set<string>(assembly.roofSeats.map((r:any)=>r.roofPieceId))].map(pieceId=>({pieceId,supportOwner:(byId.get(pieceId) as any).supportOwner}));
 const openings=assembly.openBayWitnesses.map((w:any)=>{assert.ok(w.top-w.bottom>.5,'Meaningful full-height architectural aperture');assert.ok(w.width>=5&&w.depth>=8);assert.equal(w.corners.length,8);for(let i=0;i<4;i++){assert.ok(Math.abs(w.corners[i][1]-w.bottom)<1e-7);assert.ok(Math.abs(w.corners[i+4][1]-w.top)<1e-7);for(const axis of [0,2])assert.ok(Math.abs(w.corners[i][axis]-w.corners[i+4][axis])<1e-7);}const widthEdge=sub(w.corners[1],w.corners[0]),depthEdge=sub(w.corners[2],w.corners[1]);assert.ok(Math.abs(Math.hypot(...widthEdge)-w.width)<1e-7&&Math.abs(Math.hypot(...depthEdge)-w.depth)<1e-7,'Declared opening dimensions equal actual full-prism edges');assert.ok(Math.abs(dot(widthEdge,depthEdge))<1e-7,'Full aperture has perpendicular width/depth');const average=(ids:number[])=>[0,1,2].map(k=>ids.reduce((n,i)=>n+w.corners[i][k],0)/ids.length);return{...w,a:average([0,1,4,5]),b:average([2,3,6,7])};});
 const visibleSurfaces=assembly.pieces.map((item:any)=>{
  const components=item.componentIndices.map((i:number)=>g.components[i]),triangles=components.flatMap((p:any)=>parts.triangles.get(p)!);let witness:any=null;
  outer:for(const q of triangles){const e=sub(q.b,q.a),f=sub(q.c,q.a),raw=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]],size=Math.hypot(...raw);if(size<1e-9)continue;const n=raw.map(v=>v/size),center=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);
   for(const distance of [1,2,4,.35]){const eye=center.map((v,k)=>v+n[k]*distance),target=center.map((v,k)=>v-n[k]*.002),hit=mesh.firstHit(eye,target);if(!hit||!components.includes(parts.owner.get(hit.triangle.id)!))continue;
    if(mesh.query(eye,eye).some(t=>terrainIds.has(t.id)&&projectedInterval(t,eye,eye)&&height(t,eye[0],eye[2])>eye[1]-.01))continue;
    if([...new Set(mesh.query(eye,eye).map(t=>parts.owner.get(t.id)!))].some(p=>parts.inside(eye,p)))continue;
    witness={pieceId:item.id,eye,target,faceBatch:q.batch,faceIndexStart:q.indexStart};break outer;
   }
  }
  assert.ok(witness,item.id+' has no independently verified external visible face');return witness;
 });
 const columnSeats=assembly.pieces.filter((p:any)=>/-roof-bearing-[012]$/.test(p.kind)).map((p:any)=>({pieceId:p.id,supportOwner:p.supportOwner}));
 const cartDeckSeats=assembly.pieces.filter((p:any)=>p.kind.endsWith('-blue-steel-working-deck')).map((p:any)=>({pieceId:p.id,supportOwner:p.supportOwner})),planeSeats=assembly.pieces.filter((p:any)=>/octagonal-propeller-hub$|swept-spare-propeller-blade-/.test(p.kind)).map((p:any)=>({pieceId:p.id,supportOwner:p.supportOwner,requiredCompletePlaneFaces:p.kind.endsWith('-octagonal-propeller-hub')?8:2}));
 return{id:assembly.id,pieces,columnSeats,cartDeckSeats,planeSeats,groundRoots:assembly.groundContacts.map((g:any)=>g.pieceId),fullSeats:[],fullSeatSupports:{},flatFeet,roofSeats,openings,visibleSurfaces};
});
assert.equal(airfieldSha(readFileSync('src/airfield-scenery.ts')),source,'Scenery changed during recipe review');writeFileSync(path,JSON.stringify({schema:'airfield-enrichment-reviewed-recipes-v1',sourceSha256:source,assemblies},null,2)+'\n');console.log(JSON.stringify({sourceSha256:source,assemblies:assemblies.length,pieces:assemblies.reduce((n,a)=>n+a.pieces.length,0),openings:assemblies.reduce((n,a)=>n+a.openings.length,0),recipeSha256:airfieldSha(readFileSync(path))}));
