/** Narrow second-pass audit. Production code and all first-pass golden fixtures
 * remain untouched. This adds coverage; it does not replace the full independent
 * structure/camera or native six-build tests. */
import test,{after,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain';
import {buildMountainSceneGeometry} from '../src/mountain-scenery';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../src/land-camera';
import {mountainPierContract} from './helpers/mountain-baseline-contract';
import {mountainArtFamilies,mountainArtComponent,mountainArtUnchangedContract,mountainArtMemberIds,mountainArtComponentBuffer} from './helpers/mountain-art-pass-contract';
import {mountainArtCylinderSnapshot} from './helpers/mountain-art-cylinder-oracle';
import {MeshOracle,ComponentOracle,segmentTriangleDistance,tuple,sub,
 projectedInterval,lerp,height,convexPlanes,coincidentOutwardPolygon,area3D,
 boundsOf,weldedTriangleShells,subtractConvexSolid,subtractTerrainBurial,
 type V,type Triangle,type Provenance} from './helpers/emitted-scene-oracle';

const sourceFiles=['src/mountain-scenery.ts','src/maps/mountain.ts','src/land-camera.ts','src/race-camera.ts',
 'tests/mountain-art-pass-clearance.test.ts','tests/helpers/mountain-art-pass-contract.ts',
 'tests/helpers/emitted-scene-oracle.ts','tests/helpers/mountain-baseline-contract.ts','tests/helpers/mountain-art-cylinder-oracle.ts',
 'tests/fixtures/mountain-first-pass-unaffected.json','tests/fixtures/mountain-source-baseline.json','tests/fixtures/mountain-first-pass-cylinder.json'];
const hashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const sourceHashes=hashes(),startedAt=new Date().toISOString(),start=performance.now();
const report:any={startedAt,sourceHashes,checks:[],metrics:{},limitations:[
 'Finite emitted-geometry/shared-camera simulation; native integration is a separate gate',
 'No browser/GPU pixels, frame rate, universal angle/animation or custom-build claim',
 'The inherited exact-pier unretracted-cylinder negative remains a negative',
]};
const geometry=buildMountainSceneGeometry(track),mesh=new MeshOracle(geometry.batches),parts=new ComponentOracle(mesh,geometry.components);
// The reviewed October append is part of current safety coverage, while the
// sealed first-pass family list and complement golden remain untouched.
const polish=geometry.components.filter(c=>c.kind.startsWith('polish-mountain-'));
const polishSet=new Set(polish);
const selected=geometry.components.filter(c=>mountainArtComponent(c)||polishSet.has(c)),selectedSet=new Set<Provenance>(selected);
const terrainIds=new Set(mesh.triangles.filter(q=>parts.owner.get(q.id)!.kind==='connected-contour-terrain').map(q=>q.id));
const selectedFaceIds=new Set(selected.flatMap(c=>(parts.triangles.get(c)??[]).map(q=>q.id)));
function audit(name:string,fn:(t:TestContext)=>void){test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});}
after(()=>{
 report.sourceHashesAfter=hashes();report.stable=JSON.stringify(sourceHashes)===JSON.stringify(report.sourceHashesAfter);
 report.seconds=(performance.now()-start)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,v8HeapUsedMiB:process.memoryUsage().heapUsed/1048576,configuredOldSpaceMiB:448,concurrency:1};
 if(process.env.MOUNTAIN_AUDIT_DIR){mkdirSync(process.env.MOUNTAIN_AUDIT_DIR,{recursive:true});const body=JSON.stringify(report,null,2)+'\n';for(const name of ['art-pass-clearance-report.json',startedAt.replaceAll(':','-')+'-art-pass-clearance-report.json'])writeFileSync(resolve(process.env.MOUNTAIN_AUDIT_DIR,name),body);}
 assert.ok(report.stable,'audited sources changed during run');
});

audit('Mountain second-pass selected families cover every changed or added emitted buffer',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/mountain-first-pass-unaffected.json',import.meta.url),'utf8'));
 assert.equal(fixture.baselineCommit,'f42be1c415143089bbc0b6d8b6215e404d9ddf24');
 assert.equal(fixture.baselineBuilderSHA256,'847253b5accf6121ef086c6f111c82f8db93e6fe93a497c1bae287c2a3af9009');
 assert.deepEqual(fixture.selectedFamilies,mountainArtFamilies);
 assert.equal(polish.length,148);assert.equal(polish.reduce((n,c)=>n+(c.indexEnd-c.indexStart)/3,0),1704);assert.equal(polish.reduce((n,c)=>n+c.vertexEnd-c.vertexStart,0),3772);
 const unchanged=mountainArtUnchangedContract({...geometry,components:geometry.components.filter(c=>!polishSet.has(c))});assert.deepEqual(unchanged,fixture.unchanged,'all non-selected component positions, normalized indices, UVs and identities must remain exactly first-pass; extend audited coverage rather than waiving a changed family');
 const byKind:Record<string,{components:number;faces:number}>={};
 for(const c of selected){const count=(c.indexEnd-c.indexStart)/3,r=byKind[c.kind]??={components:0,faces:0};r.components++;r.faces+=count;assert.ok(c.solid&&parts.closedShell(c),'every changed/new scenery component must be a closed emitted solid: '+c.kind);}
 for(const prefix of mountainArtFamilies)assert.ok(selected.some(c=>c.kind.startsWith(prefix)),prefix+' is included in target coverage');
 assert.equal(selectedFaceIds.size,selected.reduce((n,c)=>n+(c.indexEnd-c.indexStart)/3,0));
 report.metrics.completeness={unchanged,selectedComponents:selected.length,selectedFaces:selectedFaceIds.size,byKind,scope:'Exact first-pass complement of emitted position/index/UV buffers. Material colors are not geometry; their visible change is separately reviewed.'};
});

audit('Mountain retains inherited raw-cylinder negatives without new sampled scenery intrusion or worse margins',()=>{
 const golden=JSON.parse(readFileSync(new URL('./fixtures/mountain-source-baseline.json',import.meta.url),'utf8'));
 assert.deepEqual(mountainPierContract(geometry),golden.originalPiers,'all original pier buffers remain exact before classifying their inherited negative');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/mountain-first-pass-cylinder.json',import.meta.url),'utf8'));
 assert.equal(fixture.baselineCommit,'f42be1c415143089bbc0b6d8b6215e404d9ddf24');
 assert.equal(fixture.baselineBuilderSHA256,'847253b5accf6121ef086c6f111c82f8db93e6fe93a497c1bae287c2a3af9009');
 const snapshot=mountainArtCylinderSnapshot(geometry,track,mesh,parts),old=fixture.snapshot;
 for(const key of ['routeFractions','stationStep','stations','radius','margin','betweenStations'])assert.deepEqual(snapshot[key],old[key],key+' cannot relax the inherited diagnostic');
 const baselineGroups=new Map<string,any>(old.sceneryGroups.map((g:any)=>[g.identity,g]));
 const baselineStations=new Map<string,any>(old.stationGroups.map((r:any)=>[r.identity+'@'+r.station,r]));
 const added:any[]=[],worsened:any[]=[],relocated:any[]=[];
 for(const group of snapshot.sceneryGroups){
  const before=baselineGroups.get(group.identity);
  if(!before){relocated.push({identity:group.identity,reason:'new scenery identity in the inherited raw envelope'});continue;}
  if(JSON.stringify(group.groundedEvidence)!==JSON.stringify(before.groundedEvidence))relocated.push({identity:group.identity,reason:'grounded emitted member differs from historical placement/shape evidence',before:before.groundedEvidence,after:group.groundedEvidence});
 }
 for(const row of snapshot.stationGroups){const before=baselineStations.get(row.identity+'@'+row.station);
  if(!before)added.push(row);else if(row.minimumMargin<before.minimumMargin-1e-6)worsened.push({...row,baselineMinimumMargin:before.minimumMargin,delta:row.minimumMargin-before.minimumMargin});
 }
 const ids=mountainArtMemberIds(geometry),restorationFailures:any[]=[];
 for(const [identity,expected]of Object.entries(fixture.exactRestoredBuffers)){
  const buffers=geometry.components.filter(c=>ids.get(c)===identity&&(c.kind==='spruce-attached-bough-tier'||c.kind==='rooted-low-layered-talus')).map(c=>mountainArtComponentBuffer(geometry,c));
  if(JSON.stringify(buffers)!==JSON.stringify(expected))restorationFailures.push({identity,expected,actual:buffers});
 }
 report.metrics.changedSceneryCylinder={...snapshot,baselineSceneryContacts:old.sceneryContacts,baselineStationAssemblyPairs:old.stationGroups.length,stationAssemblyPairs:snapshot.stationGroups.length,added,worsened,relocated,exactRestoredIdentities:Object.keys(fixture.exactRestoredBuffers),restorationFailures,
  scope:'Finite .5 m station diagnostic over route fractions .875–.935, with original radius and strict margin. All source-diff-family faces and all exact original piers remain included. Historical first-pass scenery and pier negatives are retained; raw face counts are diagnostic because tessellation differs. Per-station minima and identities are compared to independent first-pass emitted faces; no analytic continuous/unrestricted-orbit clearance claim. Other unchanged scenery remains outside this narrow cylinder audit, while strict adjusted-camera tests use all rendered geometry.'};
 assert.ok(snapshot.maxAdjacentLaneTravel<snapshot.betweenStations);
 assert.equal(snapshot.pierContacts,1359,'retain the historical exact-pier raw negative');
 assert.equal(snapshot.originalPierEnvelopeClear,false);assert.equal(snapshot.sceneryEnvelopeClear,false);
 assert.equal(relocated.length,0,'new or relocated scenery cannot borrow an inherited-contact allowance: '+JSON.stringify(relocated));
 assert.equal(added.length,0,'new sampled assembly/station contacts: '+JSON.stringify(added));
 assert.equal(worsened.length,0,'worse sampled physical minimum margins: '+JSON.stringify(worsened));
 assert.equal(restorationFailures.length,0,'restored original crown/talus position/index/UV buffers must match exactly: '+JSON.stringify(restorationFailures));
});

audit('Mountain changed scenery has no exposed coflush skin against any emitted scene face',()=>{
 const planes=new Map<Provenance,ReturnType<typeof convexPlanes>>(),certificate=(c:Provenance)=>{if(!planes.has(c))planes.set(c,convexPlanes(parts,c));return planes.get(c)!;};
 const shells:{ids:Set<number>;bounds:{min:number[];max:number[]};planes:NonNullable<ReturnType<typeof convexPlanes>>}[]=[];
 for(const prop of geometry.reusedProps)for(const primitive of prop.primitives)for(const qs of weldedTriangleShells(parts.triangles.get(geometry.components[primitive.component])!)){
  const b={name:'exact imported shell',positions:qs.flatMap(q=>[...q.a,...q.b,...q.c]),indices:Array.from({length:qs.length*3},(_,i)=>i)},m=new MeshOracle([b]);
  const c:Provenance={kind:b.name,batch:b.name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:'detail'},p=convexPlanes(new ComponentOracle(m,[c]),c);
  if(p)shells.push({ids:new Set(qs.map(q=>q.id)),bounds:boundsOf(qs.flatMap(q=>[q.a,q.b,q.c])),planes:p});
 }
 let candidatePairs=0,rawPairs=0,buriedPairs=0,exposedPairs=0;const failures:any[]=[];
 for(const c of selected)for(const a of parts.triangles.get(c)??[])for(const b of mesh.query(a.min,a.max)){
  const other=parts.owner.get(b.id)!;
  if(c===other||(selectedSet.has(other)&&b.id<=a.id)||a.min.some((v,k)=>v>b.max[k]+1e-7)||a.max.some((v,k)=>v<b.min[k]-1e-7))continue;
  candidatePairs++;const overlap=coincidentOutwardPolygon(a,b);if(!overlap||area3D(overlap.polygon)<1e-7)continue;rawPairs++;
  let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const box=boundsOf(exposed[0]);
  for(const occluder of new Set(mesh.query(box.min,box.max,.001).map(q=>parts.owner.get(q.id)!))){
   if(occluder===c||occluder===other)continue;const p=certificate(occluder);if(!p)continue;exposed=exposed.flatMap(fragment=>subtractConvexSolid(fragment,p));if(!exposed.length)break;
  }
  for(const shell of shells){if(shell.ids.has(a.id)||shell.ids.has(b.id)||shell.bounds.min.some((v,k)=>v>a.max[k]+1e-7)||shell.bounds.max.some((v,k)=>v<a.min[k]-1e-7))continue;exposed=exposed.flatMap(fragment=>subtractConvexSolid(fragment,shell.planes));if(!exposed.length)break;}
  exposed=exposed.flatMap(fragment=>subtractTerrainBurial(mesh,terrainIds,fragment));const exposedArea=exposed.reduce((n,p)=>n+area3D(p),0);
  if(exposedArea>1e-7){exposedPairs++;if(failures.length<40)failures.push({first:a.id,second:b.id,firstKind:c.kind,secondKind:other.kind,exposedArea,polygon:overlap.polygon});}else buriedPairs++;
 }
 report.metrics.changedCoflush={selectedComponents:selected.length,selectedFaces:selectedFaceIds.size,candidatePairs,rawPairs,buriedPairs,exposedPairs,failures,scope:'Each selected changed/new solid versus every other emitted component, including unchanged structures, terrain, spruce and unassembled shrub/rock parts. Same positive-interior closed-convex or exact higher-terrain burial proof as the first-pass oracle; a third coincident outer skin does not count as burial.'};
 assert.equal(exposedPairs,0,JSON.stringify(failures.slice(0,12)));
});

audit('Mountain arrival and planting pockets retain all-face boom and motion clearance through finite camera histories',()=>{
 const intervals=[[.018,.095],[.137,.170],[.239,.271],[.529,.626],[.646,.751],[.789,.821]];
 const pockets=[.035,.040,.060,.083,.153,.255,.545,.575,.610,.662,.705,.737,.805];
 for(const fraction of pockets)assert.ok(intervals.some(([a,b])=>fraction>a&&fraction<b),'all authored planting pocket centers enter a live history');
 const margin=.3,hzValues=[30,60,144],speed=55;let histories=0,frames=0,booms=0,motions=0,rawHits=0,retractions=0,failuresCount=0,minBoom=Infinity,minMotion=Infinity;
 const failures:any[]=[],details:any[]=[],fail=(f:any)=>{failuresCount++;if(failures.length<60)failures.push(f);};
 const inspect=(a:V,b:V,label:string,motion=false)=>{
  for(const q of mesh.query(a,b,margin)){
   if(q.min[1]>Math.max(a[1],b[1])+margin||q.max[1]<Math.min(a[1],b[1])-margin)continue;
   const gap=segmentTriangleDistance(a,b,q);if(motion)minMotion=Math.min(minMotion,gap);else minBoom=Math.min(minBoom,gap);
   if(gap<margin-1e-6)fail({label,kind:motion?'camera-motion':'whole-boom',triangle:q.id,component:parts.owner.get(q.id)!.kind,gap,a,b});
  }
  for(const q of mesh.query(a,b))if(terrainIds.has(q.id)){const interval=projectedInterval(q,a,b);if(!interval)continue;for(const t of interval){const p=lerp(a,b,t),gap=p[1]-height(q,p[0],p[2]);if(gap<margin-1e-7)fail({label,kind:motion?'camera-motion-below-terrain':'boom-below-terrain',triangle:q.id,gap,a,b});}}
 };
 for(const hz of hzValues)for(const lane of [-1,0,1])for(const mode of ['default-rear','orbit-rear'])for(const [from,to]of intervals){
  let old:CameraPoint|null=null,time=0,historyFrames=0;
  for(let d=track.length*from;d<=track.length*to;d+=speed/hz){
   const frame=track.sample(d,lane*track.laneLimitAt(d)),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},phase=Math.floor(time*2),rearView=phase%5===2;
   const orbit=mode==='default-rear'?{yaw:0,pitch:0}:{yaw:(phase%7-3)*Math.PI/3,pitch:[-.5,0,.5,1.15][phase%4]};
   const raw=chaseCamera({position:frame.p,tangent:frame.t,view:phase%2,rearView,orbit}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles);
   if(mesh.firstHit(tuple(anchor),tuple(raw)))rawHits++;if(Math.hypot(...sub(tuple(raw),tuple(desired)))>.01)retractions++;
   const previous=old??desired,alpha=1-Math.exp(-8/hz),interpolated={x:previous.x+(desired.x-previous.x)*alpha,y:previous.y+(desired.y-previous.y)*alpha,z:previous.z+(desired.z-previous.z)*alpha};
   const final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles),label=`${mode}/${hz}/${lane}/${d}`;
   inspect(tuple(anchor),tuple(desired),label+'/desired');inspect(tuple(anchor),tuple(final),label+'/smoothed');booms+=2;
   if(old){inspect(tuple(old),tuple(final),label,true);motions++;}old=final;frames++;historyFrames++;time+=1/hz;
  }histories++;details.push({hz,lane,mode,from,to,frames:historyFrames});
 }
 report.metrics.plantingCameraHistories={intervals,pockets,hz:hzValues,lanes:3,modes:['default-rear','orbit-rear'],speed,margin,histories,frames,booms,motions,rawHits,retractions,minBoom,minMotion,failuresCount,failures,details,scope:'Finite continuous route histories using actual shared chase/safety functions and production exponential interpolation. Both normal/rear views and bounded yaw/pitch/view changes; every emitted scene triangle and exact terrain planes enter the independent oracle. Native game assembly/camera integration is separately tested.'};
 assert.equal(failuresCount,0,JSON.stringify(failures.slice(0,12)));
});
