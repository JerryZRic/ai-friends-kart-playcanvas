/** New Desert pieces are audited from actual triangles, never their claimed AABBs. */
import assert from 'node:assert/strict';
import {MeshOracle,ComponentOracle,area3D,sub,dot,hitFraction,pointTriangleDistanceSquared,coincidentOutwardPolygon,subtractTerrainBurial,subtractConvexSolid,convexPlanes,clipPlane,type Provenance,type Triangle,type V} from './emitted-scene-oracle';
export function desertSignedVolume(faces:readonly Triangle[]){const o=faces[0].a;return faces.reduce((sum,q)=>{const [a,b,c]=[q.a,q.b,q.c].map(p=>sub(p,o));return sum+dot(a,[b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]])/6;},0);}
/** A point on a support face is contact, never positive-volume penetration. */
export function desertStrictlyInside(parts:ComponentOracle,p:V,part:Provenance,epsilon=1e-6){return parts.inside(p,part)&&(parts.triangles.get(part)??[]).every(q=>pointTriangleDistanceSquared(p,q)>epsilon*epsilon);}
export function desertPairIntrusion(parts:ComponentOracle,a:Provenance,b:Provenance){
 const x=parts.bounds.get(a)!,y=parts.bounds.get(b)!;if(x.min.some((v,k)=>v>=y.max[k]-1e-7)||x.max.some((v,k)=>v<=y.min[k]+1e-7))return null;
 const af=parts.triangles.get(a)!,bf=parts.triangles.get(b)!;
 for(const [owner,other,faces]of [[a,b,af],[b,a,bf]] as const){
  const planes=convexPlanes(parts,other);if(planes)for(const q of faces){let polygon=[q.a,q.b,q.c];for(const plane of planes){polygon=clipPlane(polygon,p=>-dot(plane.n,sub(p,plane.a))-1e-7);if(!polygon.length)break;}if(area3D(polygon)>1e-7)return{kind:'indexed surface polygon strictly inside convex solid',owner:owner.kind,other:other.kind,face:q.indexStart,polygon};}
  for(const q of faces){for(const point of [q.a,q.b,q.c,[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3)])if(desertStrictlyInside(parts,point,other))return{kind:'indexed point strictly inside closed solid',owner:owner.kind,other:other.kind,point,face:q.indexStart};}
 }
 // Interleaved thin solids can cross without either mesh owning an interior
 // vertex. Split each actual edge at every opposing-face hit and inspect the
 // entire remaining interval pieces, including the middle of a narrow crossing.
 for(const [owner,other,faces,opposing]of [[a,b,af,bf],[b,a,bf,af]] as const)for(const q of faces)for(const [p,r]of [[q.a,q.b],[q.b,q.c],[q.c,q.a]]){
  const cuts=[0,1];for(const t of opposing){if(t.min.some((v,k)=>v>Math.max(p[k],r[k])+1e-7)||t.max.some((v,k)=>v<Math.min(p[k],r[k])-1e-7))continue;const u=hitFraction(t,p,r);if(u!==null&&u>1e-9&&u<1-1e-9)cuts.push(u);}cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>1e-9){const u=(cuts[i]+cuts[i-1])/2,point=p.map((v,k)=>v+(r[k]-v)*u);if(desertStrictlyInside(parts,point,other))return{kind:'actual indexed edge interval inside closed solid',owner:owner.kind,other:other.kind,point,edge:[p,r],interval:[cuts[i-1],cuts[i]]};}
 }
 return null;
}
export function desertCoflushChecks(mesh:MeshOracle,parts:ComponentOracle,added:ReadonlySet<Provenance>,terrainIds:ReadonlySet<number>){
 const exposed:any[]=[],buried:any[]=[];let facePairs=0,oppositeContactPatches=0;
 for(const q of mesh.triangles){if(!added.has(parts.owner.get(q.id)!))continue;
  for(const r of mesh.query(q.min,q.max)){if(r.id===q.id||added.has(parts.owner.get(r.id)!)&&r.id<q.id||r.min.some((v,k)=>v>q.max[k]+1e-7)||r.max.some((v,k)=>v<q.min[k]-1e-7))continue;facePairs++;
   const patch=coincidentOutwardPolygon(q,r);if(!patch){if(coincidentOutwardPolygon(q,{...r,b:r.c,c:r.b}))oppositeContactPatches++;continue;}
   // Even within one piece, repeated outward skins are real duplicates.
   const normalOffset=patch.polygon.map(p=>p.map((v,k)=>v+patch.normal[k]*1e-5));let remaining=subtractTerrainBurial(mesh,terrainIds,normalOffset);const covering:string[]=[];
   for(const owner of new Set(mesh.query(q.min,q.max,.0001).map(t=>parts.owner.get(t.id)!))){if(owner===parts.owner.get(q.id)||owner===parts.owner.get(r.id))continue;const planes=convexPlanes(parts,owner);if(!planes)continue;const before=remaining.reduce((n,p)=>n+area3D(p),0);remaining=remaining.flatMap(p=>subtractConvexSolid(p,planes));if(remaining.reduce((n,p)=>n+area3D(p),0)<before-1e-9)covering.push(owner.kind);if(!remaining.length)break;}
   const witness={kind:parts.owner.get(q.id)!.kind,other:parts.owner.get(r.id)!.kind,face:q.indexStart,otherFace:r.indexStart,batch:q.batch,otherBatch:r.batch,points:[q.a,q.b,q.c],otherPoints:[r.a,r.b,r.c],area:area3D(patch.polygon),exposedArea:remaining.reduce((n,p)=>n+area3D(p),0),remaining,covering};(witness.exposedArea>1e-7?exposed:buried).push(witness);
  }
 }
 return{facePairs,exposed,buried,oppositeContactPatches};
}
