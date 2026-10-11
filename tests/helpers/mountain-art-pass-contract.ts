import {createHash} from 'node:crypto';
import type {MountainComponent,MountainSceneGeometry} from '../../src/mountain-scenery';
import {binaryDigest} from './mountain-baseline-contract';

/** Source-diff families for the second visual pass. The complement is pinned to
 * the sealed first pass, so new/changed buffers outside this list cannot escape
 * the targeted tests by a missing name or a changed component index. */
export const mountainArtFamilies=[
 'spruce-', 'rooted-low-layered-talus', 'rowan-',
 'planting-island-grounded-granite', 'autumn-copper-rooted-shrub', 'watch-platform-',
] as const;
export const mountainArtComponent=(c:Pick<MountainComponent,'kind'>)=>mountainArtFamilies.some(prefix=>c.kind.startsWith(prefix));

export function mountainArtComponentBuffer(scene:MountainSceneGeometry,c:MountainComponent){
 const b=scene.batches.find(b=>b.name===c.batch)!;
 return {kind:c.kind,batch:c.batch,assembly:c.assembly??null,role:c.role,solid:c.solid,
  vertices:c.vertexEnd-c.vertexStart,triangles:(c.indexEnd-c.indexStart)/3,
  positions:binaryDigest(b.positions.slice(c.vertexStart*3,c.vertexEnd*3)),
  indices:binaryDigest(b.indices.slice(c.indexStart,c.indexEnd).map(i=>i-c.vertexStart),'u32'),
  uvs:binaryDigest(b.uvs.slice(c.vertexStart*2,c.vertexEnd*2))};
}
export function mountainArtMemberIds(scene:MountainSceneGeometry){
 const ordinals=new Map<string,number>();
 return new Map(scene.components.map(c=>{const ordinal=ordinals.get(c.kind)??0;ordinals.set(c.kind,ordinal+1);return[c,c.assembly??`${c.kind}#${ordinal}`];}));
}
export function mountainArtUnchangedContract(scene:MountainSceneGeometry){
 const records=scene.components.filter(c=>!mountainArtComponent(c)).map(c=>mountainArtComponentBuffer(scene,c));
 return {components:records.length,vertices:records.reduce((n,r)=>n+r.vertices,0),
  triangles:records.reduce((n,r)=>n+r.triangles,0),
  componentBufferSHA256:createHash('sha256').update(records.map(r=>JSON.stringify(r)).sort().join('\n')).digest('hex')};
}
