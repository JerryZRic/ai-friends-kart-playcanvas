/** Exact indexed protection for Harvest's explicitly reviewed agricultural edit. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import type {HarvestSceneGeometry} from '../../src/harvest-scenery';
import type {Provenance} from './emitted-scene-oracle';
export const harvestFileHash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export const harvestDigest=(v:unknown)=>harvestFileHash(JSON.stringify(v));
export const HARVEST_FIELD_BATCHES=new Set(['Harvest ripe wheat rows','Harvest dry crop stems','Harvest olive orchard leaves']);
export const HARVEST_MUTABLE_KINDS=new Set(['wheat-grounded-stem','wheat-modeled-seed-head','orchard-supported-branch','orchard-original-lobed-canopy','orchard-visible-apples']);
export type HarvestPart=Provenance&{id:string;scope:'protected'|'field'|'orchard'|'assembly'|'landform'|'raised-field'|'vegetation';sourceComponent?:number};
export function harvestParts(g:HarvestSceneGeometry):HarvestPart[]{
 const out:HarvestPart[]=[],occurrences=new Map<string,number>();
 const records=new Map<string,{scope:HarvestPart['scope'];item:any}>(),key=(c:any)=>[c.batch,c.vertexStart,c.vertexEnd].join(':');
 const own=(scope:HarvestPart['scope'],item:any)=>{assert.ok(!records.has(key(item)),'New metadata ownership is exclusive');records.set(key(item),{scope,item});};
 for(const a of g.enrichmentAssemblies??[])for(const p of a.pieces)own('assembly',p);
 for(const p of g.enrichmentLandforms??[])own('landform',p);
 for(const p of g.enrichmentFieldBands??[])own('raised-field',p);
 for(const a of g.enrichmentVegetation??[])for(const p of a.pieces)own('vegetation',p);

 for(const b of g.batches){
  const owners=new Array<HarvestPart>(b.positions.length/3);
  for(const [ci,c]of g.components.entries())if(c.batch===b.name){
   const n=occurrences.get(c.kind)??0;occurrences.set(c.kind,n+1);
   const record=records.get(key(c));if(c.kind.startsWith('harvest-enrichment-'))assert.ok(record,'Every appended component has exact explicit record ownership');else assert.equal(record,undefined,'New metadata cannot claim original geometry');
   const part:HarvestPart={...c,id:c.kind+'#'+n,indexStart:-1,indexEnd:-1,role:c.kind,scope:record?record.scope:HARVEST_MUTABLE_KINDS.has(c.kind)?c.kind.startsWith('orchard-')?'orchard':'field':'protected',sourceComponent:ci};
   assert.ok(Number.isInteger(c.vertexStart)&&Number.isInteger(c.vertexEnd)&&c.vertexStart>=0&&c.vertexEnd<=owners.length&&c.vertexStart<c.vertexEnd);
   for(let i=c.vertexStart;i<c.vertexEnd;i++){assert.equal(owners[i],undefined,'Components cannot claim overlapping vertex ownership');owners[i]=part;}
  }
  let previous:HarvestPart|undefined;
  for(let index=0;index<b.indices.length;index+=3){
   const ids=b.indices.slice(index,index+3);let part=owners[ids[0]];
   assert.ok(ids.every(i=>owners[i]===part),'Every emitted indexed triangle has one complete component owner');
   if(!part){
    let kind:string,scope:HarvestPart['scope']='protected';
    if(b.name==='Harvest connected contour earth')kind='source-terrain';
    else if(['Harvest packed ochre racing earth','Harvest pale yard pavers and coping'].includes(b.name))kind='source-road';
    else if(b.name==='Harvest dark cultivated soil and road support')kind='source-road-support';
    else if(b.name==='Harvest recesses and warm joints')kind='source-road-inlays';
    else if(b.name==='Harvest cream canopy and sail cloth'){assert.ok(index<96&&ids.every(i=>i<64),'Only16 original unowned checker quads exist');kind='source-start-checkers';}
    else{assert.ok(HARVEST_FIELD_BATCHES.has(b.name),'Unknown unowned emission in '+b.name);kind='field-surface';scope='field';}
    if(previous&&previous.sourceComponent===undefined&&previous.kind===kind)part=previous;
    else part={id:kind+':'+b.name+':'+index,kind,batch:b.name,vertexStart:Math.min(...ids),vertexEnd:Math.max(...ids)+1,indexStart:index,indexEnd:index+3,role:kind,scope};
    part.vertexStart=Math.min(part.vertexStart,...ids);part.vertexEnd=Math.max(part.vertexEnd,...ids.map(i=>i+1));
   }
   if(part!==previous){assert.ok(!out.includes(part),'Primitive index ranges must be contiguous');part.indexStart=index;out.push(part);}part.indexEnd=index+3;previous=part;
  }
 }
 for(const p of out){const record=records.get(key(p));if(record){assert.equal(record.item.kind,p.kind);assert.equal(record.item.indexStart,p.indexStart);assert.equal(record.item.indexEnd,p.indexEnd);records.delete(key(p));}}assert.equal(records.size,0,'All declared new ownership exists in emitted components');
 assert.equal(out.filter(p=>p.sourceComponent!==undefined).length,g.components.length,'Every declared component owns real indexed triangles');return out;
}
export function harvestPartPayload(g:HarvestSceneGeometry,p:HarvestPart,normals?:Map<string,number[]>){
 const b=g.batches.find(b=>b.name===p.batch)!;const indices=b.indices.slice(p.indexStart,p.indexEnd);assert.ok(indices.every(i=>i>=p.vertexStart&&i<p.vertexEnd));
 return{kind:p.kind,batch:p.batch,positions:b.positions.slice(p.vertexStart*3,p.vertexEnd*3),uvs:b.uvs.slice(p.vertexStart*2,p.vertexEnd*2),indices:indices.map(i=>i-p.vertexStart),...(normals?{normals:normals.get(p.batch)!.slice(p.vertexStart*3,p.vertexEnd*3)}:{})};
}
export const harvestMaterial=(b:any)=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture});
export function harvestProtection(g:HarvestSceneGeometry,parts:HarvestPart[],theme:unknown){
 const normals=new Map(g.batches.map(b=>[b.name,pc.calculateNormals(b.positions,b.indices)]));
 const keys=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','railMembers','barn','sails','sightlines','terrainGrid'] as const;
 return{metadata:Object.fromEntries(keys.map(k=>[k,harvestDigest(g[k])])),theme,foundations:g.foundations.filter(f=>!f.kind.startsWith('harvest-enrichment-')),protectedParts:parts.filter(p=>p.scope==='protected').map(p=>harvestDigest(harvestPartPayload(g,p,normals))),groundedDetails:g.groundedDetails.filter(d=>d.kind!=='wheat-grounded-stem'&&!d.kind.startsWith('harvest-enrichment-')),props:g.props.filter(p=>p.kind!=='orchard-tree'&&!p.kind.startsWith('harvest-enrichment-')),treeRoots:g.trees.slice(0,27).map(t=>t.position),originalCameraPayloads:harvestDigest(g.cameraObstacles.filter(o=>!o.kind.startsWith('harvest-enrichment-')))};
}
