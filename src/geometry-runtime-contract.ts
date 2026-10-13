import type {LandGeometryBatch} from './land-scenery';

/** Runtime safety checks use this engine's emitted mesh, not a frozen offline
 * triangle count: floating-point clipping can triangulate boundary slivers
 * differently across JS engines. Exact reference counts remain audit tests. */
export function assertRuntimeAppendGeometry(label:string,batches:readonly LandGeometryBatch[],originalTriangles:number,enrichmentTriangles:number,maxEnrichment:number) {
  const fail=(reason:string):never=>{throw new Error(`${label} geometry invalid: ${reason}; original=${originalTriangles}, enrichment=${enrichmentTriangles}, enrichmentLimit=${maxEnrichment}`);};
  if(!Number.isSafeInteger(originalTriangles)||originalTriangles<=0)fail('invalid original triangle count');
  if(!Number.isSafeInteger(enrichmentTriangles)||enrichmentTriangles<0||enrichmentTriangles>maxEnrichment)fail('enrichment budget');
  let triangles=0;
  for(const b of batches){
    const vertices=b.positions.length/3;
    if(!Number.isInteger(vertices)||b.indices.length%3||b.uvs.length!==vertices*2)fail(`attribute lengths in ${b.name}`);
    if(!b.positions.every(Number.isFinite)||!b.uvs.every(Number.isFinite))fail(`non-finite attributes in ${b.name}`);
    if(!b.indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<vertices))fail(`index out of range in ${b.name}`);
    triangles+=b.indices.length/3;
  }
  if(triangles!==originalTriangles+enrichmentTriangles)fail(`append accounting mismatch; emitted=${triangles}`);
}
