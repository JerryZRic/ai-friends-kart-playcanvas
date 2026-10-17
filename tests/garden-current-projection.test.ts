/** Reviewed current palette/payload acceptance keeps historical evidence immutable. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGardenSceneGeometry} from '../src/garden-scenery';
import {GARDEN_COURSE} from '../src/maps/garden';
import {gardenRuntimeBaseline,gardenMaterial,assertGardenOriginalProjection} from './helpers/garden-enrichment-contract';
import {assertCurrentGardenMaterial,assertCurrentGardenPolish} from './helpers/current-garden-polish';
const g=buildGardenSceneGeometry(GARDEN_COURSE);
test('Garden current palette accepts only reviewed colors and preserves every original indexed prefix',()=>{
 const old=gardenRuntimeBaseline();assert.equal(assertGardenOriginalProjection(g,old).length,1813);
 for(const [i,b]of g.batches.entries()){
  const material=gardenMaterial(b);assertCurrentGardenMaterial(i,material,old.batches[i].material);
  assert.throws(()=>assertCurrentGardenMaterial(i,{...material,color:'#010203'},old.batches[i].material));
  assert.throws(()=>assertCurrentGardenMaterial(i,{...material,roughness:-1},old.batches[i].material));
 }
 const b=g.batches[0],value=b.positions[0];try{b.positions[0]+=1;assert.throws(()=>assertGardenOriginalProjection(g,old));}finally{b.positions[0]=value;}
});
test('Garden reviewed polish has exact indexed ownership and camera triangles, rejecting payload mutation',()=>{
 const ownership=assertCurrentGardenPolish(g);assert.equal(ownership.size,1);assert.equal([...ownership.values()].flat().length,86);
 const component=[...ownership.values()][0][0],b=g.batches.find(b=>b.name===component.batch)!,i=component.vertexStart*3,value=b.positions[i];
 try{b.positions[i]+=.01;assert.throws(()=>assertCurrentGardenPolish(g));}finally{b.positions[i]=value;}
 const solid=[...ownership.keys()][0],saved=solid.triangles[0][0][0];try{solid.triangles[0][0][0]+=.01;assert.throws(()=>assertCurrentGardenPolish(g));}finally{solid.triangles[0][0][0]=saved;}
});
