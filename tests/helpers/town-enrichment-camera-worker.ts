import {musicHash, musicAuditDependencies} from './music-reviewed-revisions';
/** Serial worker: actual indexed scene faces are the independent oracle.
 * Static/moving camera math is production code, not an acceptance oracle. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {TOWN_COURSE} from '../../src/maps/town';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../../src/land-camera';
import {MeshOracle,tuple,lerp,sub,dot,height,projectedInterval,segmentTriangleDistance,area3D,type Triangle,type V} from './emitted-scene-oracle';
import {cameraScene,type TargetScope} from './town-enrichment-camera-scene';

const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline';assert.ok(['baseline','candidate'].includes(stage));
const started=Date.now(),hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const frozenBytes=readFileSync(new URL('./town-enrichment-camera-frozen.json',import.meta.url));assert.equal(hash(frozenBytes),'bff2d07d74d139131a9bebc65a2f467660e3b38aaef13d9dd13f08350e54f48b');
const frozen=JSON.parse(frozenBytes.toString());assert.equal(frozen.views.length,125);
assert.equal(hash(readFileSync(new URL('./town-enrichment-camera-baseline-source.txt',import.meta.url))),frozen.sourceHashes['src/town-scenery.ts']);
const dependencies=Object.keys(frozen.sourceHashes).filter(f=>f!=='src/town-scenery.ts');
for(const file of dependencies)assert.equal(hash(readFileSync(file)),musicHash(file,frozen.sourceHashes[file]),`Frozen camera dependency changed: ${file}`);
const source=readFileSync('src/town-scenery.ts','utf8'),sources=Object.fromEntries([...dependencies,...musicAuditDependencies(),...(baseline?[]:['src/town-scenery.ts']),...['worker.ts','scene.ts','frozen.json','baseline-source.txt','extra-windows.json'].map(s=>'tests/helpers/town-enrichment-camera-'+s),'tests/helpers/emitted-scene-oracle.ts'].map(f=>[f,hash(readFileSync(f))]));
// Verify the actual production smoothing expression and pre/post safety order.
const game=readFileSync('src/game.ts','utf8');assert.match(game,/safeLandCamera\(cameraAnchor,cameraPosition,course.cameraObstacles\)[\s\S]*?1 - Math.exp\(-dt \* \(menu \? 1.8 : 8\)\)[\s\S]*?safeLandCamera\(cameraAnchor,camera.getPosition\(\),course.cameraObstacles\)/);
// Independent oracle sentinels: neither endpoint-only nor fixed-step boom
// sampling may accidentally replace whole rendered-face/terrain math.
const sentinel=new MeshOracle([{name:'sentinel',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]).triangles[0];
assert.equal(segmentTriangleDistance([-1,0,0],[1,0,0],sentinel),0);
assert.ok(Math.abs(segmentTriangleDistance([-.3,0,0],[-.3,0,0],sentinel)-.3)<1e-12);
assert.ok(segmentTriangleDistance([-.299,0,0],[-.299,0,0],sentinel)<.3);
const peak=new MeshOracle([{name:'thin terrain peak',positions:[4.99,0,-1,5.02,8,0,4.99,0,1],indices:[0,1,2]}]).triangles[0],peakInterval=projectedInterval(peak,[0,1,0],[10,1,0]);
assert.ok(peakInterval&&peakInterval[0]<.5&&peakInterval[1]>.5);assert.ok(height(peak,5,0)>1);
const sceneBuildStarted=performance.now();
const {geometry,targets}=await cameraScene(baseline,ledger);
const instrumentedSceneBuildMilliseconds=performance.now()-sceneBuildStarted;
const trianglePayloads=geometry.cameraObstacles.filter(b=>b.triangles);
const coldTriangleIndexes=trianglePayloads.map(blocker=>{const f=TOWN_COURSE.edges.start.sample(0),a={x:f.p.x,y:f.p.y+1.35,z:f.p.z},b=chaseCamera({position:f.p,tangent:f.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}}).position,t=performance.now(),ids=cameraMeshCandidateIds(blocker.triangles!,a,b);return {kind:blocker.kind,triangles:blocker.triangles!.length,buildAndFirstQueryMilliseconds:performance.now()-t,firstCandidates:ids.length};});
if(baseline)for(const batch of geometry.batches){const expected=frozen.batchHashes.find(b=>b.name===batch.name);assert.ok(expected);assert.equal(hash(JSON.stringify(batch.positions)),expected.positionSha256);assert.equal(hash(JSON.stringify(batch.indices)),expected.indexSha256);}
const mesh=new MeshOracle(geometry.batches),terrain='Town garden earth and distant terraces';
const faceKey=(q:Triangle)=>hash(JSON.stringify([q.a,q.b,q.c].map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])));
const rendered=new Set(mesh.triangles.filter(q=>area3D([q.a,q.b,q.c])>1e-12).map(q=>q.id));
const faceKeys=mesh.triangles.map(faceKey),old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-report.json'),'utf8'));
const oldFaces=baseline?null:new Set<string>(old.faceKeys),changed=baseline?new Set<number>():new Set(mesh.triangles.filter(q=>!oldFaces!.has(faceKeys[q.id])).map(q=>q.id));
const report:any={schema:'town-enrichment-camera-report-v1',stage,sourceCommit:frozen.sourceCommit,sourceBundleSha256:frozen.sourceBundleSha256,sources,planningSourceSha256:hash(source),strictFaceMargin:.30,metrics:{},checks:[],newFailures:0,inheritedFailures:0,totalFailures:0,changedMeshFailures:0,unchangedMeshRegressions:0,newFailuresByBatch:{},allNewWitnesses:[],failureExamples:[],visibilityFailures:[],limitations:['Finite CPU indexed-source-geometry audit, not a continuous-angle proof, gameplay pixel capture, GPU or FPS result','Existing source camera and its smoothing are unchanged; inherited failed witnesses are retained, never relabeled as clear','Frozen pose geometry queries do not replace the separate 16-view offline pixel review']};
const baselineFailures:Record<string,number>={};
function failure(label:string,q:Triangle,gap:number,kind:string,a:V,b:V){
 const key=label+'|'+kind+'|'+faceKeys[q.id]+'|'+hash(JSON.stringify([a,b]));report.totalFailures++;
 if(baseline)baselineFailures[key]=Math.min(baselineFailures[key]??Infinity,gap);
 const inherited=!baseline&&!changed.has(q.id)&&Object.hasOwn(old.failures,key)&&gap>=old.failures[key]-1e-6;
 if(inherited)report.inheritedFailures++;else if(!baseline){report.newFailures++;if(changed.has(q.id))report.changedMeshFailures++;else report.unchangedMeshRegressions++;report.newFailuresByBatch[q.batch]=(report.newFailuresByBatch[q.batch]??0)+1;const equivalent=Object.entries(old.failures).filter(([k])=>k.startsWith(label+'|'+kind+'|'+faceKeys[q.id]+'|'));report.allNewWitnesses.push({label,kind,gap,triangle:q.id,indexStart:q.indexStart,batch:q.batch,faceKey:faceKeys[q.id],changed:changed.has(q.id),equivalentBaselineGaps:equivalent.map(([,v])=>v),a,b,vertices:[q.a,q.b,q.c]});}
 if(report.failureExamples.length<40||(!inherited&&!baseline&&report.failureExamples.filter(e=>!e.inherited).length<40))report.failureExamples.push({label,kind,gap,triangle:q.id,indexStart:q.indexStart,batch:q.batch,faceKey:faceKeys[q.id],changed:!baseline&&changed.has(q.id),inherited,baselineGap:old?.failures[key],a,b,vertices:[q.a,q.b,q.c]});
}
function inspect(a:V,b:V,label:string,wholeBoom=true){
 let minimum=Infinity;
 for(const q of mesh.query(a,b,.3)){if(!rendered.has(q.id))continue;
  if(q.min[1]<=Math.max(a[1],b[1])+.3&&q.max[1]>=Math.min(a[1],b[1])-.3){const gap=segmentTriangleDistance(a,b,q);minimum=Math.min(minimum,gap);if(gap<.3-1e-6)failure(label,q,gap,'face-clearance',a,b);}
  if(wholeBoom&&q.batch===terrain){const interval=projectedInterval(q,a,b);if(interval)for(const fraction of interval){const p=lerp(a,b,fraction),gap=p[1]-height(q,p[0],p[2]);if(gap<.3-1e-7){failure(label,q,gap,'below-terrain',a,b);break;}}}
 }return minimum;
}
const point=(p:V):CameraPoint=>({x:p[0],y:p[1],z:p[2]}),anchorAt=(f:any)=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z});
const smooth=(a:CameraPoint,b:CameraPoint,dt:number)=>{const alpha=1-Math.exp(-8*dt);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};
const modes=[-Math.PI,-Math.PI/2,0,Math.PI/2].flatMap(yaw=>[-.28,0,.78].map(pitch=>({yaw,pitch,rearView:false}))).concat([{yaw:0,pitch:0,rearView:true}]);
const edges=TOWN_COURSE.edges,stations=new Map<string,{edge:keyof typeof edges;s:number;reasons:string[]}>();
function station(edge:keyof typeof edges,s:number,reason:string){s=Math.max(0,Math.min(edges[edge].length,s));const key=edge+':'+s.toFixed(9),prior=stations.get(key);if(prior)prior.reasons.push(reason);else stations.set(key,{edge,s,reasons:[reason]});}
for(const edge of Object.values(edges)){for(let s=0;s<edge.length;s+=20)station(edge.id,s,'20m grid');for(const s of [0,3,edge.length-3,edge.length])station(edge.id,s,'endpoint');}
for(const view of frozen.views)if(view.edge)station(view.edge,view.sMetres,'immutable camera');
const districts=[...source.matchAll(/\{edge:course\.(commonStart|commonFinish|alternates\.alley|alternates\.boulevard),s:([\d.]+),side:/g)].map(m=>({edge:({commonStart:'start',commonFinish:'finish','alternates.alley':'alley','alternates.boulevard':'boulevard'}as const)[m[1]],s:Number(m[2])}));assert.ok(districts.length>=14&&districts.length<=16);
const arcadeMatch=source.match(/for\(const \[run,s\] of \[([\d, ]+)\]\.entries\(\)\)/);assert.ok(arcadeMatch);const districtsAndArcades=[...districts,...arcadeMatch[1].split(',').map(Number).map(s=>({edge:'boulevard' as const,s}))];
for(const d of districtsAndArcades)for(const delta of [-6,0,6])station(d.edge,d.s+delta,'changed district/arcade approach');
if(!baseline)assert.deepEqual([...stations.values()],old.metrics.static.stationDetails,'Camera station plan changed since baseline; rerun the immutable baseline stage');
assert.ok(stations.size<=180,`${stations.size} stations exceed bounded 180-station contract`);
let poses=0,retractions=0,rawHits=0,meshQueries=0,meshQueryMilliseconds=0,maxMeshCandidates=0;
for(const {edge:id,s}of stations.values())for(const lane of [-1,0,1])for(const view of [0,1])for(const [mode,angles]of modes.entries()){
 const edge=edges[id],frame=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:angles.rearView,orbit:angles}).position,safe=safeLandCamera(anchor,raw,geometry.cameraObstacles),label=`static/${id}/${s}/${lane}/${view}/${mode}`;
 if(lane===0)for(const blocker of trianglePayloads){const t=performance.now(),ids=cameraMeshCandidateIds(blocker.triangles!,anchor,raw);meshQueryMilliseconds+=performance.now()-t;maxMeshCandidates=Math.max(maxMeshCandidates,ids.length);meshQueries++;}
 assert.ok(Object.values(safe).every(Number.isFinite));if(Math.hypot(...sub(tuple(safe),tuple(raw)))>.01)retractions++;if(mesh.firstHit(tuple(anchor),tuple(raw)))rawHits++;
 inspect(tuple(anchor),tuple(safe),label+'/safe');
 const priorS=Math.max(0,s-2.4),priorFrame=edge.sample(priorS,lane*edge.laneLimitAt(priorS)),priorAnchor=anchorAt(priorFrame),priorRaw=chaseCamera({position:priorFrame.p,tangent:priorFrame.t,view:1-view,rearView:false,orbit:{yaw:angles.yaw+.6,pitch:angles.pitch}}).position,previous=safeLandCamera(priorAnchor,priorRaw,geometry.cameraObstacles),final=safeLandCamera(anchor,smooth(previous,safe,1/60),geometry.cameraObstacles);
 inspect(tuple(anchor),tuple(final),label+'/interpolated');poses++;
}
report.metrics.cameraMeshResources={instrumentedSceneBuildMilliseconds,coldTriangleIndexes,representativeCenterLaneQueries:meshQueries,totalWarmQueryMilliseconds:meshQueryMilliseconds,averageWarmQueryMilliseconds:meshQueries?meshQueryMilliseconds/meshQueries:null,maxMeshCandidates,scope:'Serial CPU diagnostic from finite static center-lane views, not FPS or a universal worst-case guarantee'};
report.metrics.static={stations:stations.size,stationDetails:[...stations.values()],poses,booms:poses*2,lanes:3,views:2,modes:13,retractions,rawHits};
console.log(JSON.stringify({stage,phase:'static',stations:stations.size,poses,totalFailures:report.totalFailures,newFailures:report.newFailures}));

// Targeted 40 m traversals retain the actual last post-safety camera on every
// frame. Routes continue across fork, common-tail merge and lap seams.
const windows=new Map<string,{edge:keyof typeof edges;s:number;branch:'alley'|'boulevard';reason:string}>();
function window(edge:keyof typeof edges,s:number,reason:string,branch:'alley'|'boulevard'=edge==='alley'?'alley':'boulevard'){s=Math.max(0,Math.min(edges[edge].length,s));windows.set(`${edge}/${s}/${branch}`,{edge,s,branch,reason});}
for(const d of districtsAndArcades)window(d.edge,d.s,'changed district/arcade');
for(const v of frozen.views)if(v.edge&&v.orbit?.yaw===0&&v.orbit?.pitch===0&&!v.rearView)window(v.edge,v.sMetres,'frozen approach');
for(const branch of ['alley','boulevard']as const){window('start',edges.start.length,'fork',branch);window(branch,edges[branch].length-35,'shared merge entry',branch);window(branch,edges[branch].length,'branch to finish',branch);}
window('finish',edges.finish.length,'lap seam');
const extraWindows=JSON.parse(readFileSync(new URL('./town-enrichment-camera-extra-windows.json',import.meta.url),'utf8'));
for(const extra of extraWindows.windows)window(extra.edge,extra.s,'witnessed changed-face envelope');
// Both actual crossing decks; these source stations are fixed independently
// of the enrichment and of camera obstacle metadata.
for(const id of ['start','finish']as const){let best=0,distance=Infinity;for(let s=0;s<=edges[id].length;s+=.5){const p=edges[id].sample(s).p,d=Math.hypot(p.x,p.z+25.5);if(d<distance){distance=d;best=s;}}window(id,best,'crossing deck');}
function routeFrame(w:{edge:keyof typeof edges;s:number;branch:'alley'|'boulevard'},offset:number,lane:number){
 const route=[edges.start,edges[w.branch],edges.finish],prefix=w.edge==='start'?0:w.edge==='finish'?edges.start.length+edges[w.branch].length:edges.start.length,total=route.reduce((n,e)=>n+e.length,0);let d=((prefix+w.s+offset)%total+total)%total;
 for(const edge of route){if(d<=edge.length){return {frame:edge.sample(d,lane*edge.laneLimitAt(d)),edge:edge.id,s:d};}d-=edge.length;}throw Error('No route frame');
}
if(!baseline)assert.deepEqual([...windows.values()],old.metrics.motion.windows,'Motion plan changed since baseline; rerun the immutable baseline stage');
let frames=0,runs=0,minMotion=Infinity;
for(const [wi,w]of [...windows.values()].entries())for(const hz of [30,60,144])for(const lane of [-1,0,1]){
 let previous:CameraPoint|undefined;
 const count=Math.ceil(40/(55/hz));
 for(let i=0;i<=count;i++){
  const offset=-20+40*i/count,{frame}=routeFrame(w,offset,lane),anchor=anchorAt(frame),u=i/count;
  const options={view:u<.35?0:1,rearView:u>=.45&&u<.65,orbit:{yaw:u<.2?0:Math.PI*Math.sin((u-.2)/.8*Math.PI*2),pitch:u<.2?0:.25+.53*Math.sin(u*Math.PI*2)}};
  const raw=chaseCamera({position:frame.p,tangent:frame.t,...options}).position,safe=safeLandCamera(anchor,raw,geometry.cameraObstacles),last=previous??safe,final=safeLandCamera(anchor,smooth(last,safe,1/hz),geometry.cameraObstacles),label=`live/${wi}/${hz}/${lane}/${i}`;
  inspect(tuple(anchor),tuple(final),label+'/boom');minMotion=Math.min(minMotion,inspect(tuple(last),tuple(final),label+'/motion',false));previous=final;frames++;
 }runs++;
}
report.metrics.motion={windows:[...windows.values()],runs,frames,rates:[30,60,144],speedMetresPerSecond:55,metresPerWindow:40,minimumMotionClearance:minMotion,actualPreviousRetained:true,productionDampingRate:8};
console.log(JSON.stringify({stage,phase:'motion',runs,frames,totalFailures:report.totalFailures,newFailures:report.newFailures}));
// A changed face potentially in the finite static camera envelope must have a
// nearby actual-motion window. This does not use a building's claimed radius.
if(!baseline){const missing:any[]=[];for(const station of stations.values()){
 const edge=edges[station.edge],a=tuple(anchorAt(edge.sample(station.s,-edge.laneLimitAt(station.s)))),b=tuple(anchorAt(edge.sample(station.s,edge.laneLimitAt(station.s))));
 if([...windows.values()].some(w=>w.edge===station.edge&&Math.abs(w.s-station.s)<=20))continue;
 for(const q of mesh.query(a,b,17)){if(!rendered.has(q.id)||!changed.has(q.id)||q.min[1]>Math.max(a[1],b[1])+17||q.max[1]<Math.min(a[1],b[1])-17)continue;const gap=segmentTriangleDistance(a,b,q);if(gap<=17){missing.push({station,triangle:q.id,batch:q.batch,gap,vertices:[q.a,q.b,q.c]});break;}}
 }report.metrics.uncoveredChangedEnvelopes=missing;if(missing.length)report.visibilityFailures.push({kind:'motion coverage needs an additional targeted window',witnesses:missing});}

const normalize=(v:V)=>{const length=Math.hypot(...v);return v.map(n=>n/length);},cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function pose(view:any){
 if(view.positionGame){const eye=view.positionGame as V,forward=normalize(sub(view.lookGame,eye)),right=normalize([-forward[2],0,forward[0]]),up=cross(right,forward);return{eye,forward,right,up,tan:Math.tan(view.verticalFovDegrees*Math.PI/360),aspect:view.resolution[0]/view.resolution[1],near:view.nearClipMetres,far:view.farClipMetres,ortho:0};}
 const m=view.cameraMatrixWorldBlender;assert.ok(m);const convert=(v:V)=>[v[0],v[2],-v[1]],eye=convert(view.cameraPositionBlender),right=convert([m[0][0],m[1][0],m[2][0]]),up=convert([m[0][1],m[1][1],m[2][1]]),forward=convert([-m[0][2],-m[1][2],-m[2][2]]),aspect=view.resolution[0]/view.resolution[1];
 return {eye,forward,right,up,tan:Math.tan((view.effectiveVerticalFovDegrees??38.73952406980271)*Math.PI/360),aspect,near:view.clipStart,far:view.clipEnd,ortho:view.projection==='ORTHO'?view.orthographicScaleMetres:0};
}
function project(view:any,p:V){const camera=pose(view),d=sub(p,camera.eye),depth=dot(camera.forward,d),halfY=camera.ortho?camera.ortho/(2*camera.aspect):depth*camera.tan,halfX=camera.ortho?camera.ortho/2:halfY*camera.aspect;return {x:dot(camera.right,d)/halfX,y:dot(camera.up,d)/halfY,depth,inFrame:depth>camera.near&&depth<camera.far&&Math.abs(dot(camera.right,d))<=halfX&&Math.abs(dot(camera.up,d))<=halfY};}
const replay:any[]=[];
for(const view of frozen.views){
 const camera=pose(view);assert.ok([...camera.eye,...camera.forward,...camera.right,...camera.up,camera.tan,camera.aspect].every(Number.isFinite));
 if(view.edge){const frame=edges[view.edge].sample(view.sMetres,view.lateralMetres),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view:view.view,rearView:view.rearView,orbit:view.orbit});assert.ok(Math.hypot(...sub(tuple(raw.position),view.desiredPositionGame))<1e-9);assert.ok(Math.hypot(...sub(tuple(raw.look),view.lookGame))<1e-9);if(baseline)assert.ok(Math.hypot(...sub(tuple(safeLandCamera(anchor,raw.position,geometry.cameraObstacles)),view.positionGame))<1e-9);inspect(view.anchorGame,view.positionGame,'frozen/'+view.name);}
 else if(view.roadEdge){const frame=edges[view.roadEdge].sample(view.roadDistanceMetres);inspect(tuple(anchorAt(frame)),camera.eye,'frozen/'+view.name);}
 else inspect(camera.eye,camera.eye,'frozen/'+view.name,false);
 let hits=0;const batches:Record<string,number>={};
 for(const y of [-.8,-.4,0,.4,.8])for(const x of [-.8,-.4,0,.4,.8]){const halfY=camera.ortho?camera.ortho/(2*camera.aspect):camera.tan,halfX=halfY*camera.aspect,origin=camera.ortho?camera.eye.map((n,i)=>n+camera.right[i]*halfX*x+camera.up[i]*halfY*y):camera.eye,direction=camera.ortho?camera.forward:normalize(camera.forward.map((n,i)=>n+camera.right[i]*halfX*x+camera.up[i]*halfY*y)),end=origin.map((n,i)=>n+direction[i]*camera.far),hit=mesh.firstHit(origin,end);if(hit){hits++;batches[hit.triangle.batch]=(batches[hit.triangle.batch]??0)+1;}}
 replay.push({name:view.name,projection:view.projection,eye:camera.eye,fov:view.verticalFovDegrees??view.effectiveVerticalFovDegrees,resolution:view.resolution,rays:25,hits,batches});
}
report.metrics.frozenReplay={count:replay.length,rays:replay.length*25,views:replay};

function owned(scope:TargetScope,batchPattern:RegExp,firstTriangles=Infinity){const range=scope.ranges.find(r=>batchPattern.test(r.batch));if(!range)return [];return mesh.triangles.filter(q=>q.batch===range.batch&&q.indexStart!>=range.start&&q.indexStart!<Math.min(range.end,range.start+firstTriangles*3));}
function targetVisibility(view:any,name:string,faces:Triangle[],requireFrame=false){
 assert.ok(faces.length,`${name} has actual emitted target faces`);const camera=pose(view),ids=new Set(faces.map(q=>q.id));let samples=0,framed=0,visible=0;const rays:any[]=[],vertexProjection=faces.flatMap(q=>[q.a,q.b,q.c]).map(p=>project(view,p));
 for(const face of faces){const normal=cross(sub(face.b,face.a),sub(face.c,face.a));if(name.includes('arrow')||dot(normal,sub(camera.eye,face.a))>1e-8)for(const u of [.15,.4,.65])for(const v of [.15,.4,.65]){
  const point=face.a.map((n,k)=>n+(face.b[k]-n)*u+(face.c[k]-n)*(1-u)*v),projection=project(view,point),end=camera.eye.map((n,k)=>n+(point[k]-n)*1.000001),hit=mesh.firstHit(camera.eye,end),seen=projection.inFrame&&!!hit&&ids.has(hit.triangle.id)&&Math.abs(hit.fraction-1)<.00001;
  samples++;if(projection.inFrame)framed++;if(seen)visible++;rays.push({target:faceKeys[face.id],point,inFrame:projection.inFrame,visible:seen,firstFace:hit?faceKeys[hit.triangle.id]:null,firstBatch:hit?.triangle.batch,fraction:hit?.fraction});
 }}
 const result={name,view:view.name,faces:faces.length,samples,framed,visible,allVerticesInFrame:vertexProjection.every(p=>p.inFrame),projectionBounds:{x:[Math.min(...vertexProjection.map(p=>p.x)),Math.max(...vertexProjection.map(p=>p.x))],y:[Math.min(...vertexProjection.map(p=>p.y)),Math.max(...vertexProjection.map(p=>p.y))]},rays};
 if(!baseline&&requireFrame&&(!result.allVerticesInFrame||(name.startsWith('board-')&&vertexProjection.some(p=>Math.abs(p.x)>.84||Math.abs(p.y)>.84))))report.visibilityFailures.push({name,view:view.name,kind:'fixed target frustum',bounds:result.projectionBounds});return result;
}
const landmarkResults:any[]=[];
const tower=targets.find(t=>t.kind==='clock-tower')!,tram=targets.find(t=>t.kind==='parked-market-tram')!,civic=frozen.views.find(v=>v.edge==='finish'&&v.sMetres===270)!;
for(const [name,pattern]of [['tower-body',/Ivory plaster/],['tower-clock',/Deep blue/],['tower-roof',/Terracotta/]]as const)landmarkResults.push(targetVisibility(civic,name,owned(tower,pattern),true));
for(const view of frozen.views.filter(v=>v.edge==='boulevard'&&v.sMetres===205&&v.orbit.yaw===0&&v.orbit.pitch===0&&!v.rearView)){
 landmarkResults.push(targetVisibility(view,'tram-body',owned(tram,/Teal shutters/,12),true));landmarkResults.push(targetVisibility(view,'tram-windows',owned(tram,/Deep blue/),true));
 const arches=targets.filter(t=>t.kind==='open-arcade-bay').flatMap(t=>{assert.ok(Number.isInteger(t.archStart)&&Number.isInteger(t.archEnd));return owned(t,/Cream sidewalk/).filter(q=>q.indexStart!>=t.archStart!&&q.indexStart!<t.archEnd!);});landmarkResults.push(targetVisibility(view,'arcades',arches));
}
const signs=frozen.views.find(v=>v.edge==='start'&&v.sMetres===259.6891077959268)!;
for(const sign of targets.filter(t=>t.kind==='fork-wayfinding-board')){landmarkResults.push(targetVisibility(signs,'board-arrow-'+sign.ordinal,owned(sign,/Ivory market/),true));landmarkResults.push(targetVisibility(signs,'board-body-'+sign.ordinal,owned(sign,/Teal shutters/),true));}
if(!baseline)for(const result of landmarkResults){
 const before=old.metrics.landmarks.find(r=>r.name===result.name&&r.view===result.view);assert.ok(before);if(!result.visible)report.visibilityFailures.push({name:result.name,view:result.view,kind:'no actual first-hit target surface',samples:result.samples,framed:result.framed});
 if(result.name!=='arcades'){
  const baselineVisible=new Set(before.rays.filter(r=>r.visible).map(r=>JSON.stringify([r.target,r.point]))),afterVisible=new Set(result.rays.filter(r=>r.visible).map(r=>JSON.stringify([r.target,r.point]))),lost=[...baselineVisible].filter(r=>!afterVisible.has(r));if(lost.length)report.visibilityFailures.push({name:result.name,view:result.view,kind:'previously visible landmark target samples lost',count:lost.length,witnesses:lost.slice(0,9)});
  if(['tower-body','tower-clock','tram-body','tram-windows'].includes(result.name)&&result.visible<=before.visible)report.visibilityFailures.push({name:result.name,view:result.view,kind:'required reveal did not improve',before:before.visible,after:result.visible});
 }
 result.baselineVisible=before.visible;
}
report.metrics.landmarks=landmarkResults;report.metrics.changedFaces=changed.size;report.metrics.degenerateZeroAreaFaces=mesh.triangles.length-rendered.size;
report.faceKeys=baseline?faceKeys:undefined;report.failures=baseline?baselineFailures:undefined;
report.durationSeconds=(Date.now()-started)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};
for(const [file,before]of Object.entries(sources))assert.equal(hash(readFileSync(file)),before,'Source changed while audited: '+file);
writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report));
if(process.env.TOWN_ENRICHMENT_CAMERA_AUDIT_DIR){const destination=resolve(process.env.TOWN_ENRICHMENT_CAMERA_AUDIT_DIR);mkdirSync(destination,{recursive:true});writeFileSync(join(destination,stage+'-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({stage,durationSeconds:report.durationSeconds,resources:report.resources,totalFailures:report.totalFailures,newFailures:report.newFailures,inheritedFailures:report.inheritedFailures,changedMeshFailures:report.changedMeshFailures,unchangedMeshRegressions:report.unchangedMeshRegressions,newFailuresByBatch:report.newFailuresByBatch,visibilityFailures:report.visibilityFailures,landmarks:landmarkResults.map(({rays,...r})=>r)}));
