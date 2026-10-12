/** Freeze original source-road eye/chase cameras before Caldera enrichment edits. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {CALDERA_COURSE as course} from '../src/maps/caldera.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';
const baseline=process.argv[2],output=process.argv[3];
if(!baseline||!output||existsSync(output))throw Error('Supply baseline and NEW camera output; cannot overwrite frozen cameras');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const data=JSON.parse(readFileSync(baseline+'/caldera-geometry.json','utf8'));
for(const [p,h] of Object.entries(data.sourceHashes))if(hash(p)!==h)throw Error('Source changed before freeze: '+p);
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]),tuple=(p:any)=>[p.x,p.y,p.z];
const stations=[['rim-original','start',266.96907609010907],['rim-approach','start',350],['rim-gate','start',415],['rim-north','start',718.7628971656782],['archive-approach','boulevard',200],['archive-middle','boulevard',273],['archive-departure','boulevard',340],['bowl-approach','start',1378],['bowl-departure','start',1560.7422909883298],['bridge-west-approach','alley',52],['bridge-west-aperture','alley',96.93603113547367],['bridge-east-approach','boulevard',64],['bridge-east-aperture','boulevard',112.54367134824344],['viaduct-west','finish',772.0030207251166],['viaduct-middle','finish',893.797870789008],['viaduct-east','finish',1021.2578930080276],['tooth-approach','finish',310],['tooth-middle','finish',370],['return-ridge','finish',505.7014268937809],['choice','start',1950.927863735412]] as const;
const edges={start:course.commonStart,alley:course.alternates.alley,boulevard:course.alternates.boulevard,finish:course.commonFinish};
const selected=new Set(['eye-rim-approach','chase-rim-approach','eye-rim-gate','chase-rim-gate','eye-archive-approach','chase-archive-approach','eye-archive-middle','chase-archive-middle']);
const views=stations.flatMap(([id,edge,s])=>{
 const f=edges[edge].sample(s),desired=chaseCamera({position:f.p,tangent:f.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}}),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles),eye=tuple(f.p).map((v,i)=>v+(i===1?1.6:0)),look=tuple(edges[edge].sample(Math.min(s+32,edges[edge].length)).p).map((v,i)=>v+(i===1?1.6:0));
 return [['eye',eye,look],['chase',tuple(safe),tuple(desired.look)]].map(([kind,eye,target])=>{
 const pos=xyz(eye as number[]),mat=new pc.Mat4().setLookAt(pos,xyz(target as number[]),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(mat).normalize(),name=kind+'-'+id;
 return {name,edge,s,kind,sourceEye:eye,sourceTarget:target,sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),cameraPositionBlender:pos.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,800],samples:8,renderByDefault:selected.has(name)};
 });
});
const old=JSON.parse(readFileSync('docs/caldera-preview-provenance.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'caldera-frozen-enrichment-cameras-v1',localUnpublishedHead:'70e66387b09c50a1ed8244048089cea2269e426e',lastPublicDev:'915109353ed1d2fcdc8afbb5bdacafca3648e92e',notice:'Local unpublished preceding map enrichments baseline; original Caldera. Exact static geometry CPU preview, no kart/driver/HUD, runtime/GPU/FPS proof. 8 samples draft quality; all compared settings identical.',baseline:{geometrySha256:hash(baseline+'/caldera-geometry.json'),glbSha256:hash(baseline+'/caldera-original-scene.glb'),sourceHashes:data.sourceHashes},views,catalogViews:old.views},null,2));
console.log(JSON.stringify(views.filter(v=>v.renderByDefault),null,2));
