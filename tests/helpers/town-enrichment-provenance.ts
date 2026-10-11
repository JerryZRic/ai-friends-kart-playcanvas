/** Test-only exact emission provenance. No production API or buffers change. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOWN_COURSE} from '../../src/maps/town';
import type {TownSceneGeometry} from '../../src/town-scenery';
import type {Provenance} from './emitted-scene-oracle';
import {createInstrumentedSourceFiles} from './instrumented-source-files';

export type TownScope={id:string;kind:string;assembly:string;args:any[];parent?:string};
export type TownPrimitive=Provenance&{id:string;method:string;scope?:string;changed:boolean;args:any[]};
export type InstrumentedTown={geometry:TownSceneGeometry;components:TownPrimitive[];scopes:TownScope[]};
export async function instrumentTown(source=readFileSync(new URL('../../src/town-scenery.ts',import.meta.url),'utf8')):Promise<InstrumentedTown>{
 const files=createInstrumentedSourceFiles(undefined,process.env.TOWN_ENRICHMENT_INSTRUMENT_MANIFEST);
 const replace=(a:string,b:string,required=true)=>{if(required)assert.ok(source.includes(a),`Town instrumentation marker missing: ${a}`);source=source.replace(a,b);};
 replace('LandMeshBatch as Batch','LandMeshBatch as OriginalBatch');
 const tracer=String.raw`
const __primitives:any[]=[],__scopes:any[]=[],__stack:any[]=[];let __phase=false,__depth=0;
const __copy=(v:any):any=>v&&typeof v==='object'&&'x'in v?[v.x,v.y,v.z]:Array.isArray(v)?v.map(__copy):v;
function __begin(kind:string,args:any[]){const parent=__stack.at(-1),id=kind+'#'+__scopes.filter(s=>s.kind===kind).length;const scope={id,kind,assembly:parent?.assembly??id,args:args.map(__copy),parent:parent?.id};__scopes.push(scope);__stack.push(scope);return scope;}
function __end(args?:any[]){const s=__stack.pop();if(args)s.args=args.map(__copy);}
function __with(kind:string,args:any[],fn:()=>any){__begin(kind,args);try{return fn();}finally{__end(args);}}
class Batch extends OriginalBatch {
 __emit(method:string,args:any[],fn:()=>any){const outer=__depth++===0,start=this.positions.length/3,scope=__stack.at(-1);try{return fn();}finally{__depth--;if(outer&&this.positions.length/3>start)__primitives.push({id:'primitive#'+__primitives.length,kind:scope?.kind??'scene',batch:this.name,vertexStart:start,vertexEnd:this.positions.length/3,indexStart:0,indexEnd:0,role:scope?.kind??'scene',assembly:scope?.assembly,scope:scope?.id,method,solid:method==='box',changed:__phase,args:args.map(__copy)});}}
 box(...args:any[]){return this.__emit('box',args,()=>super.box(...args as any));}
 quad(...args:any[]){return this.__emit('quad',args,()=>super.quad(...args as any));}
 tri(...args:any[]){return this.__emit('tri',args,()=>super.tri(...args as any));}
 cone(...args:any[]){return this.__emit('cone',args,()=>super.cone(...args as any));}
}
export {__primitives,__scopes};
`;
 source=source.replace('/** Structural contract',tracer+'\n/** Structural contract');
 for(const name of ['house','groundPad','marketStall']){
  if(!source.includes(`function ${name}(`))continue;
  replace(`function ${name}(`,`function __original_${name}(`);
  source+=`\nfunction ${name}(...args:any[]){return __with('${name}',args,()=>__original_${name}(...args as any));}\n`;
 }
 // Helpers are lexical to buildTownSceneGeometry, so put wrappers into its
 // scope, not module scope. Both versions have this stable first declaration.
 const wrappers=source.slice(source.indexOf('\nfunction house(...args:any[])'));
 source=source.slice(0,source.indexOf('\nfunction house(...args:any[])'));
 replace('  const cobble=new Batch',wrappers+'\n  const cobble=new Batch');
 replace('  legacyPlanning=false;','  legacyPlanning=false;__phase=true;',false);
 replace('    for(const [i,{p,yaw}] of row.entries()){','    for(const [i,{p,yaw}] of row.entries()){__begin("arcade",[p,yaw,run,i]);',false);
 replace("      record('open-arcade-bay',p,radius,5.95);","      record('open-arcade-bay',p,radius,5.95);__end([p,yaw,run,i]);",false);
 replace('      const face=frontSide===1?1:0;','      __begin("recess",[p,yaw,width,depth,height,padWidth,frontSide]);const face=frontSide===1?1:0;',false);
 replace('    put(wall,0,height/2,0,width,height,depth);','    if(__stack.at(-1)?.kind==="recess")__end();\n    put(wall,0,height/2,0,width,height,depth);',false);
 // The immutable original has inline arcade and stall builders.
 if(!source.includes('legacyPlanning=false;')){
  replace("    groundPad('open-arcade-bay',p,yaw,6.8,5.2);","    __begin('arcade',[p,yaw,i]);groundPad('open-arcade-bay',p,yaw,6.8,5.2);");
  replace("    record('open-arcade-bay',p,4.4,5.4);","    record('open-arcade-bay',p,4.4,5.4);__end([p,yaw,i]);");
  replace("    groundPad('striped-market-stall',p,yaw,5.2,3.3);","    __begin('marketStall',[p,yaw]);groundPad('striped-market-stall',p,yaw,5.2,3.3);");
  replace("record('striped-market-stall',p,3.5,3.7);","record('striped-market-stall',p,3.5,3.7);__end([p,yaw]);");
 }
 // Distant architecture, when present, uses this dedicated authoring helper.
 if(source.includes('function skylineHouse(')){
  replace('function skylineHouse(','function __original_skylineHouse(');
  replace('  const cobble=new Batch',"function skylineHouse(...args:any[]){return __with('skyline',args,()=>__original_skylineHouse(...args as any));}\n  const cobble=new Batch");
 }
 try{
  const entry=files.write('town-enrichment-provenance',source),module=await import(entry.url.href);
  const geometry:TownSceneGeometry=module.buildTownSceneGeometry(TOWN_COURSE),raw:TownPrimitive[]=module.__primitives,components:TownPrimitive[]=[];
  assert.equal(module.__scopes.filter((s:TownScope)=>s.kind==='groundPad').length,geometry.foundations.length);
  for(const batch of geometry.batches){
   const owners=new Array<TownPrimitive>(batch.positions.length/3);
   for(const p of raw.filter(p=>p.batch===batch.name))for(let i=p.vertexStart;i<p.vertexEnd;i++){assert.equal(owners[i],undefined,'duplicate vertex ownership');owners[i]=p;}
   // The one direct-indexed heightfield bypasses primitive methods. Assign it
   // exactly by its indexed contiguous vertices, never by nearest prop.
   const gaps=new Set(batch.indices.filter(i=>!owners[i]));
   if(gaps.size){assert.match(batch.name,/^Town garden earth/);const p:TownPrimitive={id:'terrain',kind:'terrain',batch:batch.name,vertexStart:Math.min(...gaps),vertexEnd:Math.max(...gaps)+1,indexStart:0,indexEnd:0,role:'terrain',method:'indexed-grid',changed:false,args:[]};for(const i of gaps)owners[i]=p;}
   let last:TownPrimitive|undefined;
   for(let i=0;i<batch.indices.length;i+=3){
    const p=owners[batch.indices[i]];assert.ok(p);assert.ok(batch.indices.slice(i,i+3).every(j=>owners[j]===p),'triangle spans distinct primitive emissions');
    if(p!==last){assert.ok(!components.includes(p),'noncontiguous final primitive index span');p.indexStart=i;p.indexEnd=i+3;components.push(p);last=p;}else p.indexEnd=i+3;
   }
  }
  return {geometry,components,scopes:module.__scopes};
 }finally{files.cleanup();}
}
