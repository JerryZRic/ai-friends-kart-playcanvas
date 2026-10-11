/** Exact protection extracts actual emitted buffers, including mixed batches. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {FOREST_COURSE,FOREST_ROAD_EDGES,FOREST_LANDMARKS} from '../../src/maps/forest';
import {landTexturePixels} from '../../src/land-scenery';
import type {ForestPrimitive,InstrumentedForest} from './forest-enrichment-provenance';
export const forestDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const forestFileDigest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export function forestPrimitivePayload(scene:InstrumentedForest,part:ForestPrimitive,normals?:Map<string,number[]>){
 const b=scene.geometry.batches.find(b=>b.name===part.batch)!;
 const indices=b.indices.slice(part.indexStart,part.indexEnd);assert.ok(indices.every(i=>i>=part.vertexStart&&i<part.vertexEnd));
 return{phase:part.phase,kind:part.kind,batch:part.batch,method:part.method,positions:b.positions.slice(part.vertexStart*3,part.vertexEnd*3),uvs:b.uvs.slice(part.vertexStart*2,part.vertexEnd*2),indices:indices.map(i=>i-part.vertexStart),...(normals?{normals:normals.get(b.name)!.slice(part.vertexStart*3,part.vertexEnd*3)}:{})};
}
export function forestProtectedContract(scene:InstrumentedForest){
 const g=scene.geometry,normals=new Map(g.batches.map(b=>[b.name,pc.calculateNormals(b.positions,b.indices)]));
 const protectedParts=scene.components.filter(c=>!['foliage','lowmass'].includes(c.phase));
 const geometryKeys=['roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','foundations','landmarks','structures','trestleMembers','sightlines','dome','terrainGrid'] as const;
 const geometry=Object.fromEntries(geometryKeys.map(key=>[key,forestDigest(g[key])]));
 const treeKinds=new Set(['ridge-cedar-cluster','near-route-cedar-cluster']);
 const edges=FOREST_ROAD_EDGES.map(edge=>{const count=Math.ceil(edge.length/1.5);return{id:edge.id,length:edge.length,samples:Array.from({length:count+1},(_,i)=>{const s=edge.length*i/count,f=edge.sample(s),w=edge.halfWidthAt(s);return{s,p:f.p.toArray(),t:f.t.toArray(),n:f.n.toArray(),halfWidth:w,left:edge.sample(s,-w).p.toArray(),right:edge.sample(s,w).p.toArray()};})};});
 return{geometry,protectedParts:protectedParts.map(c=>forestDigest(forestPrimitivePayload(scene,c,normals))),originalLandmarkTrees:g.trees.slice(0,9),props:g.props.filter(p=>!treeKinds.has(p.kind)&&!p.kind.startsWith('woodland-')),terrainBlocker:forestDigest(g.cameraObstacles.find(o=>o.heightfield)),nonFoliageBlockers:forestDigest(g.cameraObstacles.filter(o=>!o.kind.startsWith('cedar-')&&!o.kind.startsWith('woodland-'))),theme:scene.theme,materials:g.batches.map(b=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture})),textures:forestDigest(Object.fromEntries((['stone','asphalt','wood','grass']as const).map(kind=>[kind,[...landTexturePixels(kind)]]))),route:forestDigest({canonicalLength:FOREST_COURSE.canonicalLength,edges,landmarks:FOREST_LANDMARKS,checkpoints:FOREST_COURSE.checkpointGates})};
}
