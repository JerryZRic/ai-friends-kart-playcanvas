/** Exact current palette and append ownership, separate from frozen enrichment recipes.
 * These checks do not certify new support graphs or interpenetration safety.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GARDEN_ROAD_EDGES} from '../../src/maps/garden';
import {RoadFootprintIndex,sampleRoadFootprints} from '../../src/land-road-mesh';
type Scene='garden';
const pins={garden:'853811e8e5d58ff9f84ae6422070960cae2268256fb76f92c2cd8debe0cbc844'};
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex'),digest=(value:unknown)=>sha(JSON.stringify(value));
function ledger(scene:Scene){const text=readFileSync(`tests/helpers/${scene}-current-polish.json`,'utf8');assert.equal(sha(text),pins[scene],scene+' exact separately scoped current record');const row=JSON.parse(text);assert.equal(sha(readFileSync(`src/${scene}-scenery.ts`)),row.sourceSha256,scene+' exact source for explicit palette and appended payload');return row;}
export function assertCurrentGardenMaterial(index:number,actual:unknown,historical:unknown){
 const scene:Scene='garden';
 const row=ledger(scene),before=row.historicalMaterials[index],after=row.materials[index];
 assert.deepEqual(historical,before,scene+' unchanged historical material evidence');
 assert.deepEqual({...after,color:before.color},before,scene+' only enumerated color changes; order, texture and material properties remain exact');
 assert.deepEqual(actual,after,scene+' explicit current palette');
}
export function assertCurrentGardenPolish(g:any){
 const scene:Scene='garden';
 const row=ledger(scene),components=g.components.filter((c:any)=>c.kind.startsWith(scene+'-polish-'));
 assert.equal(components.length,row.componentCount,'Exact enumerated polish component count');
 const payload=components.map((c:any)=>{const b=g.batches.find((b:any)=>b.name===c.batch);assert.ok(b);assert.ok(!c.landmark,'Polish does not acquire original landmark ownership');const indices=b.indices.slice(c.indexStart,c.indexEnd);assert.ok(indices.every((i:number)=>Number.isInteger(i)&&i>=c.vertexStart&&i<c.vertexEnd));return{component:c,positions:b.positions.slice(c.vertexStart*3,c.vertexEnd*3),uvs:b.uvs.slice(c.vertexStart*2,c.vertexEnd*2),indices};});
 assert.equal(digest(payload),row.payloadSha256,'Every current polish component/range/position/UV/index exactly accounted for');
 const road=new RoadFootprintIndex(sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65));
 for(const part of payload)for(let i=0;i<part.positions.length;i+=3)assert.ok(road.clearAt(part.positions[i],part.positions[i+2],18),part.component.kind+' current road/camera reservation');
 const ownership=new Map<any,any[]>(),seen=new Set<any>();
 for(const group of row.groups){const members=group.componentIndices.map((i:number)=>{const c=g.components[i];assert.ok(components.includes(c),'Exact polish owner index');assert.ok(!seen.has(c),'Unique polish blocker ownership');seen.add(c);return c;});
  const solids=g.cameraObstacles.filter((o:any)=>o.kind===group.id+'-exact-triangles');assert.equal(solids.length,1,'One explicit actual triangle blocker per polish group');
  const faces=members.flatMap((c:any)=>{const b=g.batches.find((b:any)=>b.name===c.batch);return Array.from({length:(c.indexEnd-c.indexStart)/3},(_,i)=>b.indices.slice(c.indexStart+i*3,c.indexStart+i*3+3).map((v:number)=>b.positions.slice(v*3,v*3+3)));});
  assert.deepEqual(solids[0].triangles,faces,'Actual polish blocker contains every emitted face in exact order');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const face of faces)for(const v of face)for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}assert.deepEqual(solids[0].min,min);assert.deepEqual(solids[0].max,max);ownership.set(solids[0],members);
 }
 assert.equal(seen.size,components.length,'All polish components have one actual blocker');
 assert.equal(g.cameraObstacles.filter((o:any)=>o.kind.startsWith(scene+'-polish-')).length,ownership.size,'Unknown polish blockers rejected');
 return ownership;
}
