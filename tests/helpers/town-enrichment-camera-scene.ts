/** Camera-only emitted target ownership. Index ranges come from emission calls,
 * never nearest centers, source bounds, camera obstacles or radius guesses. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {TOWN_COURSE} from '../../src/maps/town';
import type {TownSceneGeometry} from '../../src/town-scenery';
export type TargetScope={kind:string;ordinal:number;position:number[];yaw:number;archStart?:number;archEnd?:number;ranges:{batch:string;start:number;end:number}[]};
export async function cameraScene(baseline:boolean,manifest?:string):Promise<{geometry:TownSceneGeometry;targets:TargetScope[]}>{
 let source=readFileSync(new URL(baseline?'./town-enrichment-camera-baseline-source.txt':'../../src/town-scenery.ts',import.meta.url),'utf8');
 const inject=(needle:string,replacement:string)=>{assert.equal(source.split(needle).length,2,'unique camera instrumentation anchor '+needle);source=source.replace(needle,replacement);};
 inject('  const edges=edgesOf(course)',`  const cameraTargets:any[]=[];let cameraActive:any;
  const cameraBegin=(kind:string,p:pc.Vec3,yaw:number)=>{if(cameraActive)throw Error('Nested target scope');cameraActive={kind,ordinal:cameraTargets.filter(s=>s.kind===kind).length,position:tuple(p),yaw,starts:batches.map(b=>b.indices.length)};};
  const cameraEnd=()=>{cameraTargets.push({...cameraActive,ranges:batches.map((b,i)=>({batch:b.name,start:cameraActive.starts[i],end:b.indices.length})).filter(r=>r.start<r.end)});cameraActive=null;};
  const edges=edgesOf(course)`);
 for(const kind of ['clock-tower','parked-market-tram','fork-wayfinding-board','open-arcade-bay','potted-citrus-tree','copper-street-lantern']){
  const begin=`groundPad('${kind}',`,at=source.indexOf(begin);assert.ok(at>=0);source=source.slice(0,at)+`cameraBegin('${kind}',p,${kind==='potted-citrus-tree'||kind==='copper-street-lantern'?'0':'yaw'});`+source.slice(at);
  const ending=new RegExp(`record\\('${kind}',p,[^;]+;`);assert.equal([...source.matchAll(new RegExp(ending.source,'g'))].length,1);
  source=source.replace(ending,match=>match+'cameraEnd();');
 }
 // Isolate the actual curved opening band from the foundations/cap/pillars.
 const archLoop='for(let j=0;j<10;j++)';assert.equal(source.split(archLoop).length,2);
 let at=source.indexOf(archLoop),open=source.indexOf('{',at),depth=1,end=open+1;
 while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}
 assert.equal(depth,0);source=source.slice(0,end)+'cameraActive.archEnd=paving.indices.length;'+source.slice(end);
 source=source.slice(0,at)+'cameraActive.archStart=paving.indices.length;'+source.slice(at);
 inject('return {version:1,trackId:course.id,batches:used,','return {cameraTargets,version:1,trackId:course.id,batches:used,');
 const files=createInstrumentedSourceFiles(undefined,manifest);
 try{const module=files.write('town-enrichment-camera-scene',source),loaded=await import(module.url.href),geometry=loaded.buildTownSceneGeometry(TOWN_COURSE),targets=geometry.cameraTargets;delete geometry.cameraTargets;assert.equal(targets.filter(s=>s.kind==='clock-tower').length,1);assert.equal(targets.filter(s=>s.kind==='parked-market-tram').length,1);assert.equal(targets.filter(s=>s.kind==='fork-wayfinding-board').length,2);assert.equal(targets.filter(s=>s.kind==='open-arcade-bay').length,9);return {geometry,targets};}finally{files.cleanup();}
}
