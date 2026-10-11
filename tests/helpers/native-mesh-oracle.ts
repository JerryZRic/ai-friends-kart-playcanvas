/** Native audit helpers. Bounds are refreshed by the actual PlayCanvas renderer before use. */
import * as pc from 'playcanvas';
import assert from 'node:assert/strict';
export function intersects(triangle:readonly (readonly number[])[],minimum:number[],maximum:number[]) {
 const center=minimum.map((v,i)=>(v+maximum[i])/2),half=minimum.map((v,i)=>(maximum[i]-v)/2);
 const v=triangle.map(p=>p.map((n,i)=>n-center[i])),sub=(a:number[],b:number[])=>a.map((n,i)=>n-b[i]);
 const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:number[],b:number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);
 const edges=[sub(v[1],v[0]),sub(v[2],v[1]),sub(v[0],v[2])],axes=[[1,0,0],[0,1,0],[0,0,1],cross(edges[0],edges[1]),...edges.flatMap(edge=>[[1,0,0],[0,1,0],[0,0,1]].map(axis=>cross(edge,axis)))];
 return axes.every(axis=>{const projection=v.map(p=>dot(p,axis)),radius=half.reduce((sum,h,i)=>sum+h*Math.abs(axis[i]),0);return Math.min(...projection)<=radius+1e-8&&Math.max(...projection)>=-radius-1e-8;});
}
export const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

export function actualWorldGeometry(instance:pc.MeshInstance){
 assert.equal(instance.morphInstance,null,'this exact native certificate expects the original non-morphed driver assets');
 const positions:number[]=[],indices:number[]=[],weights:number[]=[],joints:number[]=[];instance.mesh.getPositions(positions);instance.mesh.getIndices(indices);
 if(instance.skinInstance){instance.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT,weights);instance.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES,joints);}
 const weightFormat=instance.mesh.vertexBuffer.format.elements.find(e=>e.name===pc.SEMANTIC_BLENDWEIGHT),divisor=weightFormat?.normalize?(weightFormat.dataType===pc.TYPE_UINT8?255:weightFormat.dataType===pc.TYPE_UINT16?65535:1):1;
 const world=instance.node.getWorldTransform(),vertices=new Float64Array(positions.length),point=new pc.Vec3(),local=new pc.Vec3(),weighted=new pc.Vec3();
 for(let i=0;i<positions.length/3;i++){
  point.set(positions[i*3],positions[i*3+1],positions[i*3+2]);local.set(0,0,0);
  if(instance.skinInstance){let sum=0;for(let k=0;k<4;k++){const weight=weights[i*4+k]/divisor;sum+=weight;if(weight)local.add(instance.skinInstance.matrices[joints[i*4+k]].transformPoint(point,weighted).mulScalar(weight));}assert.ok(Math.abs(sum-1)<1e-5,'exact original vertex weights sum to one');}
  else local.copy(point);
  world.transformPoint(local,weighted);vertices[i*3]=weighted.x;vertices[i*3+1]=weighted.y;vertices[i*3+2]=weighted.z;
 }
 const lo=instance.aabb.getMin().toArray(),hi=instance.aabb.getMax().toArray();
 assert.ok(vertices.every((x,i)=>x>=lo[i%3]-1e-4&&x<=hi[i%3]+1e-4),'actual weighted/skinned vertices stay inside the unchanged refreshed PlayCanvas bound');
 return {vertices,indices};
}
export function triangleMeshContact(triangle:readonly (readonly number[])[],mesh:{vertices:Float64Array;indices:number[]}){
 const sub=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n-b[i]),cross=(a:readonly number[],b:readonly number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);
 const normal=cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0]));if(normal[1]<0)normal.forEach((v,i)=>normal[i]=-v);const length=Math.hypot(...normal);
 let minPlaneDistance=Infinity,maxPlaneDistance=-Infinity,testedTriangles=0,intersections=0;for(let i=0;i<mesh.vertices.length;i+=3){const d=((mesh.vertices[i]-triangle[0][0])*normal[0]+(mesh.vertices[i+1]-triangle[0][1])*normal[1]+(mesh.vertices[i+2]-triangle[0][2])*normal[2])/length;minPlaneDistance=Math.min(minPlaneDistance,d);maxPlaneDistance=Math.max(maxPlaneDistance,d);}
 if(minPlaneDistance<=1e-7&&maxPlaneDistance>=-1e-7)for(let i=0;i<mesh.indices.length;i+=3){
  const t=mesh.indices.slice(i,i+3).map(k=>[mesh.vertices[k*3],mesh.vertices[k*3+1],mesh.vertices[k*3+2]]),min=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...t.map(p=>p[k])));if(!intersects(triangle,min,max))continue;testedTriangles++;
  const a=[sub(triangle[1],triangle[0]),sub(triangle[2],triangle[1]),sub(triangle[0],triangle[2])],b=[sub(t[1],t[0]),sub(t[2],t[1]),sub(t[0],t[2])],na=cross(a[0],a[1]),nb=cross(b[0],b[1]);
  const axes=[na,nb,...a.flatMap(x=>b.map(y=>cross(x,y))),...a.map(e=>cross(na,e)),...b.map(e=>cross(nb,e))];
  if(axes.every(axis=>{if(Math.hypot(...axis)<1e-10)return true;const x=triangle.map(p=>dot(p,axis)),y=t.map(p=>dot(p,axis)),epsilon=1e-7*Math.hypot(...axis);return Math.max(...x)>=Math.min(...y)-epsilon&&Math.max(...y)>=Math.min(...x)-epsilon;}))intersections++;
 }
 return {vertexCount:mesh.vertices.length/3,meshTriangleCount:mesh.indices.length/3,minPlaneDistance,maxPlaneDistance,testedTriangles,intersections};
}
