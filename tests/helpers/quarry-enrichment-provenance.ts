/** Exact test-only indexed emission provenance. Production geometry is untouched. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QUARRY_COURSE} from '../../src/maps/quarry';
import type {QuarrySceneGeometry} from '../../src/quarry-scenery';
import type {Provenance} from './emitted-scene-oracle';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
export type QuarryPrimitive=Provenance&{id:string;method:string;phase:string;scope?:string;args:any[]};
export type QuarryScope={id:string;kind:string;assembly:string;args:any[];parent?:string};
export type InstrumentedQuarry={geometry:QuarrySceneGeometry;components:QuarryPrimitive[];scopes:QuarryScope[]};
export async function instrumentQuarry(source=readFileSync(new URL('../../src/quarry-scenery.ts',import.meta.url),'utf8')):Promise<InstrumentedQuarry>{
 const files=createInstrumentedSourceFiles(undefined,process.env.QUARRY_ENRICHMENT_INSTRUMENT_MANIFEST);
 const replace=(a:string,b:string,required=true)=>{if(required)assert.ok(source.includes(a),'Quarry instrumentation marker missing: '+a);source=source.replace(a,b);};
 replace('LandMeshBatch as Batch','LandMeshBatch as OriginalBatch');
 const tracer=String.raw`
const __primitives:any[]=[],__scopes:any[]=[],__stack:any[]=[];let __phase='road',__depth=0;
const __copy=(v:any):any=>v&&typeof v==='object'&&'x'in v?[v.x,v.y,v.z]:Array.isArray(v)?v.map(__copy):v&&typeof v==='object'&&'positions'in v?{batch:v.name}:typeof v==='function'?null:v;
function __begin(kind:string,args:any[]){const parent=__stack.at(-1),id=kind+'#'+__scopes.filter(s=>s.kind===kind).length,scope={id,kind,assembly:parent?.assembly??id,args:args.map(__copy),parent:parent?.id};__scopes.push(scope);__stack.push(scope);}
function __end(args?:any[]){const s=__stack.pop();if(args)s.args=args.map(__copy);}
function __emit(batch:any,kind:string,method:string,args:any[],fn:()=>any){const outer=__depth++===0,start=batch.positions.length/3,scope=__stack.at(-1);try{return fn();}finally{__depth--;if(outer&&batch.positions.length/3>start)__primitives.push({id:'primitive#'+__primitives.length,kind,batch:batch.name,vertexStart:start,vertexEnd:batch.positions.length/3,indexStart:0,indexEnd:0,role:kind,assembly:scope?.assembly,scope:scope?.id,method,solid:method==='box'||method==='beam',phase:__phase,args:args.map(__copy)});}}
class Batch extends OriginalBatch{
 box(...args:any[]){return __emit(this,'unwrapped-box','box',args,()=>super.box(...args as any));}
 quad(...args:any[]){return __emit(this,'unwrapped-quad','quad',args,()=>super.quad(...args as any));}
 tri(...args:any[]){return __emit(this,'unwrapped-tri','tri',args,()=>super.tri(...args as any));}
 cone(...args:any[]){return __emit(this,'unwrapped-cone','cone',args,()=>super.cone(...args as any));}
}
export {__primitives,__scopes,__stack};
`;
 replace('export interface QuarrySceneGeometry',tracer+'\nexport interface QuarrySceneGeometry');
 let wrappers='';
 for(const name of ['box','beam','solid']){replace(`  const ${name}=`,`  const __original_${name}=`);wrappers+=`function ${name}(...args:any[]){return __emit(args[1],args[0],'${name}',args,()=>__original_${name}(...args as any));}\n`;}
 replace('  const groundPad=','  const __original_groundPad=');wrappers+=`function groundPad(...args:any[]){__begin('groundPad',args);try{return __original_groundPad(...args as any);}finally{__end(args);}}\n`;
 replace('  const haul=new Batch',wrappers+'  const haul=new Batch');
 for(const [marker,phase]of [['  const benchSites=','extraction'],['  const placements=','machinery'],['  const upper=course.commonFinish','trestle'],['  const findPlot=','scenery'],['  for(const side of [-1,1]){\n    const e=course.commonStart','fork'],['  for(let i=0;i<58;i++){','scenery']])replace(marker,`  __phase='${phase}';\n`+marker);
 replace("    groundPad(plot.kind,p,yaw,plot.w,plot.d);","    __begin(plot.kind,[p,yaw]);groundPad(plot.kind,p,yaw,plot.w,plot.d);");
 replace('    record(plot.kind,p,plot.r,plot.label);','    record(plot.kind,p,plot.r,plot.label);__end([p,yaw]);');
 replace("groundPad(plot.label,p,yaw,21*sx,14*sz);","__begin(plot.label,[p,yaw,sx,sz]);groundPad(plot.label,p,yaw,21*sx,14*sz);",false);
 replace('    record(plot.label,p,r);','    record(plot.label,p,r);__end([p,yaw,sx,sz]);',false);
 replace("groundPad('roadside-stone-workset',p,yaw,6.8,5.4);","__begin('roadside-stone-workset',[p,yaw,i]);groundPad('roadside-stone-workset',p,yaw,6.8,5.4);");
 replace("    record('roadside-stone-workset',p,4.5);","    record('roadside-stone-workset',p,4.5);__end([p,yaw,i]);");
 replace("    groundPad('haul-distance-board',p,yaw,2.8,2.1);","    __begin('haul-distance-board',[p,yaw,i]);groundPad('haul-distance-board',p,yaw,2.8,2.1);");
 replace("record('haul-distance-board',p,r);","record('haul-distance-board',p,r);__end([p,yaw,i]);");
 replace("    groundPad('quarry-fork-wayfinding',p,yaw,5.7,1.5);","    __begin('quarry-fork-wayfinding',[p,yaw,side]);groundPad('quarry-fork-wayfinding',p,yaw,5.7,1.5);");
 replace("side>0?'Carved Shelf: narrow, shorter S route':'Haul Road: broad outer working ramp');","side>0?'Carved Shelf: narrow, shorter S route':'Haul Road: broad outer working ramp');__end([p,yaw,side]);");
 try{
  const entry=files.write('quarry-enrichment-provenance',source),module=await import(entry.url.href),geometry:QuarrySceneGeometry=module.buildQuarrySceneGeometry(QUARRY_COURSE),raw:QuarryPrimitive[]=module.__primitives,components:QuarryPrimitive[]=[];
  assert.equal(module.__scopes.filter((s:QuarryScope)=>s.kind==='groundPad').length,geometry.foundations.length);
  for(const batch of geometry.batches){
   const owners=new Array<QuarryPrimitive>(batch.positions.length/3);
   for(const p of raw.filter(p=>p.batch===batch.name))for(let i=p.vertexStart;i<p.vertexEnd;i++){assert.equal(owners[i],undefined,'duplicate vertex ownership');owners[i]=p;}
   const gaps=new Set(batch.indices.filter(i=>!owners[i]));
   if(gaps.size){assert.equal(batch.name,'Quarry continuous dry working floor');const p:QuarryPrimitive={id:'terrain',kind:'terrain',batch:batch.name,vertexStart:Math.min(...gaps),vertexEnd:Math.max(...gaps)+1,indexStart:0,indexEnd:0,role:'terrain',method:'indexed-grid',phase:'road',args:[]};for(const i of gaps)owners[i]=p;}
   let last:QuarryPrimitive|undefined;
   for(let i=0;i<batch.indices.length;i+=3){const p=owners[batch.indices[i]];assert.ok(p);assert.ok(batch.indices.slice(i,i+3).every(j=>owners[j]===p),'triangle crosses primitive ownership');if(p!==last){assert.ok(!components.includes(p),'noncontiguous indexed emission');p.indexStart=i;p.indexEnd=i+3;components.push(p);last=p;}else p.indexEnd=i+3;}
  }
  assert.equal(module.__stack.length,0,'balanced emission scopes');return{geometry,components,scopes:module.__scopes};
 }finally{files.cleanup();}
}
