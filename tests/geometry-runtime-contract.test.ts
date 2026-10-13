import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRuntimeAppendGeometry} from '../src/geometry-runtime-contract';
const mesh=()=>({name:'fixture',color:'#fff',roughness:1,metalness:0,texture:'none' as const,positions:[0,0,0,1,0,0,0,1,0,0,0,1],uvs:[0,0,1,0,0,1,1,1],indices:[0,1,2,0,3,1,0,2,3,1,3,2]});
test('runtime accepts actual valid triangulation counts without an offline exact golden',()=>{
 assert.doesNotThrow(()=>assertRuntimeAppendGeometry('Snow',[mesh()],3,1,12));
 const alternate=mesh();alternate.indices.push(0,1,3);
 assert.doesNotThrow(()=>assertRuntimeAppendGeometry('Snow',[alternate],4,1,12));
});
test('runtime retains independent enrichment cap with actual values',()=>{
 assert.throws(()=>assertRuntimeAppendGeometry('Snow',[mesh()],1,3,2),/enrichment budget.*original=1, enrichment=3, enrichmentLimit=2/);
});
test('runtime rejects invalid counts, append accounting, attributes and indices',()=>{
 for(const original of [NaN,Infinity,0,2.5])assert.throws(()=>assertRuntimeAppendGeometry('Snow',[mesh()],original,1,12),/invalid original/);
 assert.throws(()=>assertRuntimeAppendGeometry('Snow',[mesh()],2,1,12),/accounting mismatch; emitted=4/);
 const badIndex=mesh();badIndex.indices[0]=4;assert.throws(()=>assertRuntimeAppendGeometry('Snow',[badIndex],3,1,12),/index out of range/);
 const badPosition=mesh();badPosition.positions[0]=NaN;assert.throws(()=>assertRuntimeAppendGeometry('Snow',[badPosition],3,1,12),/non-finite/);
 const badUv=mesh();badUv.uvs.pop();assert.throws(()=>assertRuntimeAppendGeometry('Snow',[badUv],3,1,12),/attribute lengths/);
});
