/** Independent review aid: derives indexed exposure/opening witnesses for the fixed composition. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {CALDERA_COURSE} from '../../src/maps/caldera';
import {MeshOracle,ComponentOracle,area3D,hullXZ,type V} from './emitted-scene-oracle';
import {pointFootprintDistance} from './harvest-enrichment-surface-support';
import {calderaSha as sha,calderaFrozenBaseline,assertCalderaPreservation} from './caldera-enrichment-contract';
const input=process.argv[2];assert.ok(input);const exported=JSON.parse(readFileSync(input,'utf8')),g=exported.geometry;assert.equal(exported.sourceHashes['src/caldera-scenery.ts'],sha(readFileSync('src/caldera-scenery.ts')));const added=assertCalderaPreservation(g,exported.theme,calderaFrozenBaseline());
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,g.components),ids=['enrichment-rim-near-buttress','enrichment-rim-middle-buttress','enrichment-rim-receding-buttress','enrichment-north-rim-near-buttress','enrichment-north-rim-receding-buttress','enrichment-archive-store-wing','enrichment-archive-open-portico'];assert.deepEqual(g.enrichmentAssemblies.map((a:any)=>a.id),ids);
const transform=(x:number,z:number,yaw:number,p:V)=>[x+p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],z-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];
const assemblies=g.enrichmentAssemblies.map((a:any)=>{
 const members=a.pieces.map((p:any)=>added.find((q:any)=>q.batch===p.batch&&q.indexStart===p.indexStart&&q.indexEnd===p.indexEnd));assert.ok(members.every(Boolean));
 const pieces=a.pieces.map(({id,kind,supportOwner}:any)=>({id,kind,supportOwner}));
 const roots=a.groundContacts.map((r:any)=>r.pieceId),flatFeet=a.pieces.filter((p:any)=>p.supportOwner.length&&!p.kind.endsWith('open-bay-lintel')&&!p.kind.endsWith('thick-seated-roof')).map((p:any)=>p.id),roofSeats=a.pieces.filter((p:any)=>p.kind.endsWith('thick-seated-roof')).map((p:any)=>({pieceId:p.id,supportOwner:p.supportOwner}));
 const visibleSurfaces=members.map((p:any,i:number)=>{const faces=[...parts.triangles.get(p)!].sort((a,b)=>area3D([b.a,b.b,b.c])-area3D([a.a,a.b,a.c]));for(const q of faces){const u=q.b.map((v,k)=>v-q.a[k]),v=q.c.map((v,k)=>v-q.a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross);if(length<1e-8)continue;const n=cross.map(v=>v/length),center=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3),eye=center.map((v,k)=>v+n[k]*2),target=center.map((v,k)=>v-n[k]*.01),hit=mesh.firstHit(eye,target);if(hit&&parts.owner.get(hit.triangle.id)===p)return{pieceId:a.pieces[i].id,eye,target,indexStart:q.indexStart,batch:q.batch,actualFaceArea:length/2};}throw Error('No real exposed surface '+a.pieces[i].id);});
 const openings:any[]=[];
 if(a.id.includes('archive-')){const open=a.id.endsWith('open-portico'),cx=open?-209:-167,cz=open?-624:-602,w=open?23:29,d=open?12:13,yaw=open?.1:Math.PI+.1,root=members[0],top=parts.bounds.get(root)!.max[1],bay=(w-1.1)/3;assert.equal(roofSeats.length,1);assert.equal(roots.length,2);
  for(let i=0;i<3;i++){const x=-w/2+.55+(i+.5)*bay,start=transform(cx,cz,yaw,[x,top+3,-d/2-1]),end=transform(cx,cz,yaw,[x,top+3,open?d/2+1:d/2-2.5]);assert.equal(mesh.firstHit(start,end),null,a.id+' literal bay '+i);openings.push({label:a.id+' literal bay '+i,a:start,b:end});}
 }else{assert.equal(pieces.length,1);assert.equal(roots.length,1);assert.equal(roofSeats.length,0);assert.equal(pieces[0].kind,'enrichment-jointed-basalt-buttress');}
 return{id:a.id,pieces,groundRoots:roots,flatFeet,fullSeats:[],fullSeatSupports:{},roofSeats,openings,visibleSurfaces};
});
const recipes={schema:'caldera-enrichment-assembly-recipes-v1',sourceSha256:exported.sourceHashes['src/caldera-scenery.ts'],assemblies};writeFileSync('tests/fixtures/caldera-enrichment-assembly-recipes.json',JSON.stringify(recipes,null,2)+'\n');
const windows:any[]=[],stations:any[]=[],keys=new Set<string>();
for(const [i,a]of g.enrichmentAssemblies.entries()){
 const actual=a.pieces.flatMap((p:any)=>{const part=added.find((q:any)=>q.batch===p.batch&&q.indexStart===p.indexStart)!;return parts.points(part);}),footprint=hullXZ(actual);
 for(const edge of Object.values(CALDERA_COURSE.edges)){
  let low=Infinity,high=-Infinity;for(let s=0;s<=edge.length;s+=1){const p=edge.sample(s).p;if(pointFootprintDistance([p.x,p.y,p.z],footprint)<=50){low=Math.min(low,s);high=Math.max(high,s);}}
  if(!Number.isFinite(low))continue;const from=Math.max(0,low-12),to=Math.min(edge.length,high+12);windows.push({assembly:a.id,edge:edge.id,from,to,actualFootprint:footprint,fullFootprintDistanceMetres:50});
  for(let s=Math.ceil(from/3)*3;s<=to;s+=3){const key=edge.id+':'+s;if(!keys.has(key)){keys.add(key);stations.push({name:key,edge:edge.id,s});}}
 }
}
assert.ok(windows.length>=2&&stations.length>20);const dense={schema:'caldera-enrichment-camera-windows-v1',sourceSha256:recipes.sourceSha256,spacingMetres:3,windowExpansionMetres:12,windows,stations,expectedStaticPoses:stations.length*3*2*33};writeFileSync('tests/fixtures/caldera-enrichment-camera-windows.json',JSON.stringify(dense,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:recipes.sourceSha256,assemblies:assemblies.length,pieces:added.length,openings:assemblies.reduce((n:any,a:any)=>n+a.openings.length,0),visibleSurfaces:assemblies.reduce((n:any,a:any)=>n+a.visibleSurfaces.length,0),windows:windows.length,denseStations:stations.length,densePoses:dense.expectedStaticPoses}));
