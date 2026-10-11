/** Bounded headless CPU comparison, not GPU or frame-rate evidence.
 * Run each grouping in a separate process from the repository root:
 * NODE_OPTIONS=--max-old-space-size=448 node --expose-gc --import tsx scripts/benchmark-mountain-camera.mjs grouped
 * NODE_OPTIONS=--max-old-space-size=448 node --expose-gc --import tsx scripts/benchmark-mountain-camera.mjs consolidated
 * Both arrangements are reconstructed from the SAME current scene. The older
 * arrangement groups exact faces by assembly/kind; it is not the historical
 * original Mountain runtime, which supplied no camera blockers.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {cpus,platform,arch} from 'node:os';
import {buildMountainSceneGeometry} from '../src/mountain-scenery.ts';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain.ts';
import {safeLandCamera,cameraMeshCandidateIds} from '../src/land-camera.ts';
import {chaseCamera} from '../src/race-camera.ts';
const mode=process.argv[2];if(!['grouped','consolidated'].includes(mode))throw new Error('Choose grouped or consolidated; run each in a separate process');
const hash=data=>createHash('sha256').update(data).digest('hex');
const stats=a=>{const v=[...a].sort((a,b)=>a-b);return{min:v[0],median:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length};};
const memory=()=>{global.gc?.();const m=process.memoryUsage();return{heapUsedMiB:m.heapUsed/1048576,rssMiB:m.rss/1048576,maxRSSMiB:process.resourceUsage().maxRSS/1024};};
const before=memory(),start=performance.now(),geometry=buildMountainSceneGeometry(track),buildMs=performance.now()-start,afterBuild=memory();
const mesh=geometry.cameraObstacles.find(b=>b.triangles),fields=geometry.cameraObstacles.filter(b=>b.heightfield),groups=new Map();let face=0;
for(const c of geometry.components){if(c.kind==='connected-contour-terrain')continue;const key=c.assembly??(c.role==='road'?'preserved-road-surfaces':c.kind),g=groups.get(key)??{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],triangles:[]},count=(c.indexEnd-c.indexStart)/3;
 for(let i=0;i<count;i++)g.triangles.push(mesh.triangles[face++]);for(let k=0;k<3;k++){g.min[k]=Math.min(g.min[k],c.min[k]);g.max[k]=Math.max(g.max[k],c.max[k]);}groups.set(key,g);
}
if(face!==mesh.triangles.length)throw new Error('Every emitted mesh face must have exactly one component owner');
const arrangements={grouped:[...fields,...groups.values()],consolidated:geometry.cameraObstacles},blockers=arrangements[mode];
const triangleHash=triangles=>{const bytes=Buffer.alloc(72),list=[];for(const t of triangles){let n=0;for(const p of t)for(const v of p)bytes.writeDoubleLE(v,n++*8);list.push(hash(bytes));}return hash(list.sort().join('\n'));};
const multiset=Object.fromEntries(Object.entries(arrangements).map(([name,bs])=>[name,triangleHash(bs.flatMap(b=>b.triangles??[]))]));
if(multiset.grouped!==multiset.consolidated)throw new Error('Exact Float64 triangle multiset or winding changed');
for(const bs of Object.values(arrangements))if(bs.filter(b=>b.heightfield).length!==1||bs.find(b=>b.heightfield).heightfield!==geometry.terrainGrid)throw new Error('Exact shared heightfield changed');
const inputs=Array.from({length:1200},(_,i)=>{const d=i/1200*track.length,f=track.sample(d,((i%3)-1)*track.laneLimitAt(d));return{anchor:{x:f.p.x,y:f.p.y+1.45,z:f.p.z},desired:chaseCamera({position:f.p,tangent:f.t,view:i%2,rearView:i%7===0,orbit:{yaw:(i%24)*Math.PI/12,pitch:[-.5,0,.5,1.15][i%4]}}).position};});
const setupStart=performance.now();for(const b of blockers)if(b.triangles)cameraMeshCandidateIds(b.triangles,inputs[0].anchor,inputs[0].desired,.45);const setupMs=performance.now()-setupStart,afterSetup=memory();
for(let i=0;i<120;i++)safeLandCamera(inputs[i].anchor,inputs[i].desired,blockers);
const bytes=Buffer.alloc(24),append=(h,p)=>{for(const [i,v]of [p.x,p.y,p.z].entries())bytes.writeDoubleLE(v,i*8);h.update(bytes);},times=[],rounds=[],outputs=createHash('sha256');
for(let r=0;r<3;r++){const round=[];for(const {anchor,desired}of inputs){const t=performance.now(),p=safeLandCamera(anchor,desired,blockers);round.push(performance.now()-t);append(outputs,p);}times.push(...round);rounds.push(stats(round));}
const outputSHA256=outputs.digest('hex'),afterQueries=memory();
// Equality checking is outside all setup/query timing and memory samples above.
const other=arrangements[mode==='grouped'?'consolidated':'grouped'],check=createHash('sha256');for(let r=0;r<3;r++)for(const {anchor,desired}of inputs)append(check,safeLandCamera(anchor,desired,other));const equivalentOutputSHA256=check.digest('hex');
if(outputSHA256!==equivalentOutputSHA256)throw new Error('Grouping changed a sampled Float64 safe-camera output');
console.log(JSON.stringify({mode,environment:{node:process.version,platform:platform(),architecture:arch(),cpu:cpus()[0]?.model,heapLimitMiB:448,explicitGC:!!global.gc},sourceSHA256:Object.fromEntries(['../src/mountain-scenery.ts','../src/land-camera.ts','../src/race-camera.ts'].map(p=>[p,hash(readFileSync(new URL(p,import.meta.url)))])),blockers:blockers.length,triangles:mesh.triangles.length,exactTriangleMultisetSHA256:multiset.grouped,heightfieldSHA256:hash(JSON.stringify(geometry.terrainGrid)),inputSHA256:hash(JSON.stringify(inputs)),outputSHA256,equivalentOutputSHA256,samples:3600,uniqueInputs:1200,warmupQueries:120,buildMs,setupMs,queryMs:stats(times),rounds,memory:{before,afterBuild,afterSetup,afterQueries},notice:'Separate-process bounded headless CPU setup/query sample. Both groupings contain the same current enriched geometry. This is neither original-empty-blocker comparison nor GPU/FPS or universal performance evidence.'},null,2));
