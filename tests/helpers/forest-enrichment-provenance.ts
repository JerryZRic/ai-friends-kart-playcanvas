/** Test-only emitted-index provenance. No production inputs are rewritten. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOREST_COURSE} from '../../src/maps/forest';
import type {ForestSceneGeometry} from '../../src/forest-scenery';
import type {Provenance} from './emitted-scene-oracle';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
export type ForestPrimitive=Provenance&{id:string;method:string;phase:string;scope?:string;args:any[]};
export type ForestScope={id:string;kind:string;args:any[]};
export type InstrumentedForest={geometry:ForestSceneGeometry;theme:unknown;components:ForestPrimitive[];scopes:ForestScope[]};
export async function instrumentForest(source=readFileSync(new URL('../../src/forest-scenery.ts',import.meta.url),'utf8')):Promise<InstrumentedForest>{
 const files=createInstrumentedSourceFiles(undefined,process.env.FOREST_ENRICHMENT_INSTRUMENT_MANIFEST);
 const replace=(a:string,b:string,required=true)=>{if(required)assert.ok(source.includes(a),'Forest instrumentation marker missing: '+a);source=source.replace(a,b);};
 replace('LandMeshBatch as Batch','LandMeshBatch as OriginalBatch');
 const tracer=String.raw`
const __primitives:any[]=[],__scopes:any[]=[],__stack:any[]=[];let __phase='road',__depth=0;
const __copy=(v:any):any=>v&&typeof v==='object'&&'x'in v?[v.x,v.y,v.z]:Array.isArray(v)?v.map(__copy):v&&typeof v==='object'&&'positions'in v?{batch:v.name}:typeof v==='function'?null:v;
function __begin(kind:string,args:any[]){const id=kind+'#'+__scopes.filter(s=>s.kind===kind).length,scope={id,kind,args:args.map(__copy)};__scopes.push(scope);__stack.push(scope);}
function __end(args:any[]){const scope=__stack.pop();scope.args=args.map(__copy);}
function __record(batch:any,kind:string,method:string,start:number,args:any[]){if(batch.positions.length/3<=start)return;const scope=__stack.at(-1);__primitives.push({id:'primitive#'+__primitives.length,kind,batch:batch.name,vertexStart:start,vertexEnd:batch.positions.length/3,indexStart:0,indexEnd:0,role:kind,assembly:scope?.id,scope:scope?.id,method,solid:method==='box'||method==='beam'||method==='bough',phase:__phase,args:args.map(__copy)});}
function __emit(batch:any,kind:string,method:string,args:any[],fn:()=>any){const outer=__depth++===0,start=batch.positions.length/3;try{return fn();}finally{__depth--;if(outer)__record(batch,kind,method,start,args);}}
class Batch extends OriginalBatch{
 box(...args:any[]){return __emit(this,'unwrapped-box','box',args,()=>super.box(...args as any));}
 quad(...args:any[]){return __emit(this,'unwrapped-quad','quad',args,()=>super.quad(...args as any));}
 tri(...args:any[]){return __emit(this,'unwrapped-tri','tri',args,()=>super.tri(...args as any));}
 cone(...args:any[]){return __emit(this,'unwrapped-cone','cone',args,()=>super.cone(...args as any));}
}
export {__primitives,__scopes,__stack};
`;
 replace('export interface ForestSceneGeometry',tracer+'\nexport interface ForestSceneGeometry');
 let wrappers='';
 for(const name of ['box','beam','tube','bough','cedarCrown']){if(name==='cedarCrown'&&!source.includes('  const cedarCrown='))continue;replace(`  const ${name}=`,`  const __original_${name}=`);wrappers+=`function ${name}(...args:any[]){return __emit(args[1],args[0],'${name}',args,()=>__original_${name}(...args as any));}\n`;}
 replace('  const tree=','  const __original_tree=');wrappers+=`function tree(...args:any[]){__begin('tree',args);try{return __original_tree(...args as any);}finally{__end(args);}}\n`;
 replace('  const moss=new Batch',wrappers+'  const moss=new Batch');
 replace('    components.push({kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,min,max});',`    if(__depth===0&&!__primitives.some(q=>q.batch===b.name&&q.vertexStart<b.positions.length/3&&q.vertexEnd>start))__record(b,kind,'indexed-manual',start,[]);\n    components.push({kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,min,max});`);
 for(const [marker,phase]of [['  const plotData=','landmark'],['  const upper=course.commonFinish','bridge'],['  const groups=','foliage'],['  const findPlot=','fork'],['  // Low paired fern and shale groups','lowmass']])replace(marker,`  __phase='${phase}';\n`+marker);
 try{
  const entry=files.write('forest-enrichment-provenance',source),module=await import(entry.url.href),geometry:ForestSceneGeometry=module.buildForestSceneGeometry(FOREST_COURSE),raw:ForestPrimitive[]=module.__primitives,components:ForestPrimitive[]=[];
  for(const batch of geometry.batches){
   const owners=new Array<ForestPrimitive>(batch.positions.length/3);
   for(const p of raw.filter(p=>p.batch===batch.name))for(let i=p.vertexStart;i<p.vertexEnd;i++){assert.equal(owners[i],undefined,'duplicate vertex ownership');owners[i]=p;}
   const gaps=new Set(batch.indices.filter(i=>!owners[i]));
   if(gaps.size){assert.equal(batch.name,'Forest connected moss ridge terrain','untraced emitted indexed geometry');const p:ForestPrimitive={id:'terrain',kind:'terrain',batch:batch.name,vertexStart:Math.min(...gaps),vertexEnd:Math.max(...gaps)+1,indexStart:0,indexEnd:0,role:'terrain',method:'indexed-grid',phase:'road',args:[]};for(const i of gaps)owners[i]=p;}
   let last:ForestPrimitive|undefined;
   for(let i=0;i<batch.indices.length;i+=3){const p=owners[batch.indices[i]];assert.ok(p);assert.ok(batch.indices.slice(i,i+3).every(j=>owners[j]===p),'triangle crosses primitive ownership');if(p!==last){assert.ok(!components.includes(p),'noncontiguous indexed emission');p.indexStart=i;p.indexEnd=i+3;components.push(p);last=p;}else p.indexEnd=i+3;}
  }
  assert.equal(module.__stack.length,0,'balanced tree emission scopes');return{geometry,theme:module.FOREST_SCENE_THEME,components,scopes:module.__scopes};
 }finally{files.cleanup();}
}
