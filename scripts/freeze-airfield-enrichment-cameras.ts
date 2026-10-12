/** Freeze original source-road eye/chase cameras before Airfield enrichment edits. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {AIRFIELD_COURSE as course} from '../src/maps/airfield.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';
const baseline=process.argv[2],output=process.argv[3];
if(!baseline||!output||existsSync(output))throw Error('Supply baseline and NEW camera output; cannot overwrite frozen cameras');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const data=JSON.parse(readFileSync(baseline+'/airfield-geometry.json','utf8'));
for(const [p,h] of Object.entries(data.sourceHashes))if(hash(p)!==h)throw Error('Source changed before freeze: '+p);
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]),tuple=(p:any)=>[p.x,p.y,p.z];
const stations=[['workshop-before','start',120],['workshop-middle','start',170],['workshop-after','start',220],['court-before','boulevard',90],['court-middle','boulevard',150],['court-after','boulevard',210],['terrace-before','finish',620],['terrace-middle','finish',680],['terrace-after','finish',740],['original-reveal','start',120.33254077843299],['original-hangar','alley',112.0256391123437],...data.route.driverReviewPoses.map((p:any)=>['original-'+p.id,p.edge,p.s])] as const;
const edges:any={start:course.commonStart,alley:course.alternates.alley,boulevard:course.alternates.boulevard,finish:course.commonFinish};
const selected=new Set(['eye-workshop-middle','chase0-workshop-middle','eye-court-middle','chase0-court-middle','eye-terrace-middle','chase0-terrace-middle']);
const views=stations.flatMap(([id,edge,s])=>{
 const f=edges[edge].sample(s),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},eye=tuple(f.p).map((v,i)=>v+(i===1?1.6:0)),look=tuple(edges[edge].sample(Math.min(s+32,edges[edge].length)).p).map((v,i)=>v+(i===1?1.6:0));
 const kinds:any[]=[{kind:'eye',eye,target:look}];
 for(const view of [0,1]){const desired=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles);kinds.push({kind:'chase'+view,eye:tuple(safe),target:tuple(desired.look),sourceDesiredEye:tuple(desired.position)});}
 return kinds.map(({kind,eye,target,sourceDesiredEye})=>{
 const pos=xyz(eye),mat=new pc.Mat4().setLookAt(pos,xyz(target),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(mat).normalize(),name=kind+'-'+id;
 return {name,edge,s,kind,sourceEye:eye,sourceTarget:target,sourceAnchor:tuple(anchor),sourceDesiredEye,cameraPositionBlender:pos.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,800],samples:8,renderByDefault:selected.has(name)};
 });
});
const old=JSON.parse(readFileSync('docs/airfield-preview-provenance.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'airfield-frozen-enrichment-cameras-v1',localUnpublishedHead:'fc5360139c00e0d60148afabd0d24ed85c272ed6',lastPublicDev:'915109353ed1d2fcdc8afbb5bdacafca3648e92e',notice:'Local unpublished preceding map enrichments baseline; original Airfield. Exact static geometry CPU preview, no kart/driver/HUD, runtime/GPU/FPS proof. 8 samples draft quality; all compared settings identical.',baseline:{geometrySha256:hash(baseline+'/airfield-geometry.json'),glbSha256:hash(baseline+'/airfield-original-scene.glb'),sourceHashes:data.sourceHashes},views,catalogViews:old.views},null,2));
console.log(JSON.stringify(views.filter(v=>v.renderByDefault),null,2));
