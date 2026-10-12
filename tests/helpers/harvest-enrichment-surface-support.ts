/** Whole projected surfaces are clipped against actual named support triangles. */
import assert from 'node:assert/strict';
import {MeshOracle,area,clipPolygon,cross2,height,hullXZ,projectedInterval,supportCoverage,segmentDistanceSquared,type V,type Triangle,type Provenance,ComponentOracle} from './emitted-scene-oracle';
export function emittedRange(parts:ComponentOracle,part:Provenance,start:number,end:number,label:string){
 assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&start%3===0&&end%3===0&&start>=part.indexStart&&end<=part.indexEnd&&start<end,label+' owns a nonempty complete actual indexed range');const faces=parts.triangles.get(part)!.filter(q=>q.indexStart!>=start&&q.indexStart!<end);assert.equal(faces.length,(end-start)/3,label+' source range maps one-to-one to rendered faces');return faces;
}
export function wholeSurfaceSupport(mesh:MeshOracle,faces:readonly Triangle[],supportIds:ReadonlySet<number>,lowGap:number,highGap:number,label:string){
 let coveredFaces=0,intersections=0,minimum=Infinity,maximum=-Infinity,projectedArea=0;
 for(const face of faces){const polygon=[face.a,face.b,face.c],size=area(polygon);if(size<1e-10)continue;coveredFaces++;projectedArea+=size;
  const coverage=supportCoverage(mesh,polygon,(support,overlap)=>{
   if(!supportIds.has(support.id))return false;assert.ok(Math.abs(cross2(support.a,support.b,support.c))>1e-10);const gaps=overlap.map(p=>height(face,p[0],p[2])-height(support,p[0],p[2]));minimum=Math.min(minimum,...gaps);maximum=Math.max(maximum,...gaps);assert.ok(gaps.every(g=>g>=lowGap-1e-6&&g<=highGap+1e-6),label+' full indexed plane leaves its permitted supporting-surface offset: '+JSON.stringify({face:face.indexStart,support:support.indexStart,gaps,lowGap,highGap,overlap}));intersections++;return true;
  });assert.ok(coverage.uncovered<1e-5,label+' leaves '+coverage.uncovered+'m² of its actual full support');
 }
 assert.ok(coveredFaces>0&&projectedArea>1e-6,label+' has measurable full projected support');return{faces:coveredFaces,intersections,projectedArea,minimum,maximum};
}
export function actualSupportExtrema(mesh:MeshOracle,footprint:V[],supportIds:ReadonlySet<number>,label:string){
 let low=Infinity,high=-Infinity;const coverage=supportCoverage(mesh,footprint,(q,poly)=>{if(!supportIds.has(q.id))return false;for(const p of poly){const y=height(q,p[0],p[2]);low=Math.min(low,y);high=Math.max(high,y);}return true;});assert.ok(coverage.uncovered<1e-6,label+' complete footprint remains over actual named support');return{low,high,intersections:coverage.intersections};
}
export function pointFootprintDistance(point:V,footprint:V[]){
 const hull=hullXZ(footprint),signs=hull.map((a,i)=>cross2(a,hull[(i+1)%hull.length],point));if(signs.every(n=>n>=-1e-8)||signs.every(n=>n<=1e-8))return 0;
 const p=[point[0],0,point[2]];return Math.sqrt(Math.min(...hull.map((a,i)=>{const b=hull[(i+1)%hull.length];return segmentDistanceSquared(p,p,[a[0],0,a[2]],[b[0],0,b[2]]);})));}
export function rayFootprintDistance(a:V,b:V,footprint:V[]){
 if(pointFootprintDistance(a,footprint)===0||pointFootprintDistance(b,footprint)===0)return 0;return Math.sqrt(Math.min(...footprint.map((p,i)=>{const q=footprint[(i+1)%footprint.length];return segmentDistanceSquared([a[0],0,a[2]],[b[0],0,b[2]],[p[0],0,p[2]],[q[0],0,q[2]]);})));}

/** Full projected overlap, including a containing triangle and vertical faces. */
export function triangleTouchesFootprint(face:Triangle,footprint:V[]){
 const points=[face.a,face.b,face.c];return area(points)>1e-10&&area(clipPolygon(footprint,face))>1e-8||points.some((a,i)=>rayFootprintDistance(a,points[(i+1)%3],footprint)<=1e-7);
}
