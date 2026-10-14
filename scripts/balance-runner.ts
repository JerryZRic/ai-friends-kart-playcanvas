import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync,existsSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LAND_SIMULATION_MAPS,loadLandSimulationCourse,type LandSimulationMap} from '../src/land-simulation-course';
import {runCpuRace,cpuSeed,type CpuSimulationOptions,type CpuRaceResult} from '../src/land-cpu-simulation';
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,'').split('=');return [key,rest.join('=')||true];}));
const allowed=new Set(['worker','maps','blocks','workers','domain','out','difficulty','equipment','items','timeout','identity-control','profiles','rotation','overwrite','seed']);
for(const key of Object.keys(args))if(!allowed.has(key))throw new Error(`Unknown option --${key}`);
if(args.worker){
 process.on('message',async(message:any)=>{try{const course=await loadLandSimulationCourse(message.map);const results:CpuRaceResult[]=[];const start=performance.now();for(const rotation of message.rotations)results.push(runCpuRace(course,{...message.options,seed:message.seed,rotation}));process.send!({index:message.index,map:message.map,block:message.block,seconds:(performance.now()-start)/1000,results});}catch(error){process.send!({error:error instanceof Error?error.stack:String(error)});}});
 process.send!({ready:true});
}else{
 const maps=(args.maps?String(args.maps).split(','):LAND_SIMULATION_MAPS) as LandSimulationMap[],blocks=Number(args.blocks??1),workers=Number(args.workers??6),domain=String(args.domain??'development-pilot'),out=resolve(String(args.out??'balance-results/pilot'));
 if(!Number.isInteger(blocks)||blocks<1||!Number.isInteger(workers)||workers<1||workers>16||maps.some(id=>!LAND_SIMULATION_MAPS.includes(id)))throw new Error('Invalid maps, blocks or workers');
 const options:Partial<CpuSimulationOptions>={difficulty:String(args.difficulty??'normal') as any,equipment:String(args.equipment??'equal') as any,items:args.items!=='off',timeoutSeconds:Number(args.timeout??600),identityControl:args['identity-control']===true};
 if(args.profiles)options.profiles=JSON.parse(readFileSync(String(args.profiles),'utf8'));
 if(!['easy','normal','hard'].includes(options.difficulty!)||!['equal','mixed'].includes(options.equipment!))throw new Error('Invalid difficulty/equipment');
 const rotations=args.rotation===undefined?[0,1,2,3,4,5]:[Number(args.rotation)];
 if(rotations.some(n=>!Number.isInteger(n)||n<0||n>5))throw new Error('Rotation must be 0–5');
 if(args.items!==undefined&&!['on','off'].includes(String(args.items)))throw new Error('Items must be on or off');
 const explicitSeed=args.seed===undefined?undefined:Number(args.seed);
 if(explicitSeed!==undefined&&(!Number.isInteger(explicitSeed)||explicitSeed<0||explicitSeed>0xffffffff||maps.length!==1||blocks!==1))throw new Error('Explicit --seed requires one map, one block and a uint32 seed');
 // Interleave maps so progress monitoring covers every course early; seed/block results are unchanged.
 const jobs=Array.from({length:blocks},(_,block)=>maps.map(map=>({map,block,index:0,seed:explicitSeed??cpuSeed(domain,map,block),rotations,options}))).flat().map((job,index)=>({...job,index}));
 mkdirSync(dirname(out),{recursive:true});
 if(existsSync(out+'.jsonl')&&!args.overwrite)throw new Error('Output already exists; choose a new --out or explicitly pass --overwrite');
 const sourceFiles=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(directory+'/'+entry.name):[directory+'/'+entry.name]);
 const files=[...sourceFiles('src'),'scripts/balance-runner.ts','package.json','package-lock.json','docs/cpu-balance-protocol.md'].sort();
 const sourceHashes=Object.fromEntries(files.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 const metadata={schema:1,instrumentationVersion:2,schedule:'block-major',baseCommit:'33988b49dee01547238c08df4684cce93fae9497',created:new Date().toISOString(),domain,...(explicitSeed===undefined?{}:{explicitSeed}),maps,blocks,rotations,options,sourceHashes,dt:1/60,laps:3,plannedRaces:jobs.length*rotations.length};
 writeFileSync(out+'.manifest.json',JSON.stringify(metadata,null,2)+'\n');writeFileSync(out+'.jsonl','');
 writeFileSync(out+'.csv','map,block,seed,rotation,character,seat,phase,rank,winner,finishedAt,dnf,laps,lap1,lap2,lap3,pickups,uses,collisions,slowSeconds,railContacts,driftSeconds,maxSpeed,invalidSteps,rejectionReasons,branches\n');
 let next=0,completed=0,races=0;const start=performance.now(),children=new Set<ReturnType<typeof fork>>();
 await new Promise<void>((resolveDone,reject)=>{
  const fail=(error:unknown)=>{for(const child of children)child.kill();reject(error);};
  const assign=(child:ReturnType<typeof fork>)=>{if(next<jobs.length)child.send(jobs[next++]);else{child.kill();children.delete(child);if(completed===jobs.length)resolveDone();}};
  for(let i=0;i<Math.min(workers,jobs.length);i++){
   const child=fork(fileURLToPath(import.meta.url),['--worker'],{execArgv:['--import','tsx'],stdio:['ignore','inherit','inherit','ipc']});children.add(child);
   child.on('error',fail);child.on('message',(message:any)=>{
    if(message.error){fail(new Error(message.error));return;}if(message.ready){assign(child);return;}
    for(const result of message.results){appendFileSync(out+'.jsonl',JSON.stringify({...result,block:message.block})+'\n');for(const racer of result.racers)appendFileSync(out+'.csv',[result.map,message.block,result.seed,result.rotation,racer.characterId,racer.seat,racer.phase,racer.rank,Number(result.winner===racer.characterId),racer.finishedAt??'',Number(racer.dnf),racer.laps,...[0,1,2].map(i=>racer.lapTimes[i]??''),racer.pickups,racer.uses,racer.collisionCount,racer.slowSeconds,racer.railContacts,racer.driftSeconds,racer.maxObservedSpeed,racer.invalidSteps,Object.entries(racer.rejectionReasons).map(([k,v])=>k+':'+v).join('|'),racer.branches.join('|')].join(',')+'\n');}
    completed++;races+=message.results.length;console.log(JSON.stringify({completedBlocks:completed,totalBlocks:jobs.length,races,map:message.map,block:message.block,blockSeconds:+message.seconds.toFixed(2),wallSeconds:+((performance.now()-start)/1000).toFixed(2)}));assign(child);
   });
   child.on('exit',(code,signal)=>{if(children.has(child))fail(new Error(`Worker exited before completing its assigned block: ${code}/${signal}`));});
  }
 });
 writeFileSync(out+'.complete.json',JSON.stringify({races,blocks:completed,wallSeconds:(performance.now()-start)/1000,completed:new Date().toISOString()},null,2)+'\n');
}
