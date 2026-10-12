/** Freeze original source-road eye/chase cameras before Desert enrichment edits. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {DESERT_COURSE as course} from '../src/maps/desert.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';
const baseline=process.argv[2],output=process.argv[3];
if(!baseline||!output||existsSync(output))throw Error('Supply baseline and NEW camera output; cannot overwrite frozen cameras');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const data=JSON.parse(readFileSync(baseline+'/desert-geometry.json','utf8'));
for(const [p,h] of Object.entries(data.sourceHashes))if(hash(p)!==h)throw Error('Source changed before freeze: '+p);
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]),tuple=(p:any)=>[p.x,p.y,p.z];
const stations=[['dune','start',450],['beacon','start',570.44106190816],['crown','start',820],['spire','start',975.7544480008],['descent','start',1050],['release','start',1200],['fork','start',1430],['arch-approach','alley',258.72575808588084],['arch-middle','alley',318.72575808588084],['court-approach','boulevard',175.44967945926842],['court-middle','boulevard',230],['court-exit','boulevard',290],['kiln-early','finish',260],['kiln','finish',320.8874242145482],['kiln-late','finish',385]] as const;
const edges={start:course.commonStart,alley:course.alternates.alley,boulevard:course.alternates.boulevard,finish:course.commonFinish};
const selected=new Set(['eye-crown','chase-crown','eye-descent','chase-descent','eye-court-approach','chase-court-middle','eye-court-exit','chase-court-exit']);
const views=stations.flatMap(([id,edge,s])=>{
 const f=edges[edge].sample(s),desired=chaseCamera({position:f.p,tangent:f.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}}),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles),eye=tuple(f.p).map((v,i)=>v+(i===1?1.6:0)),look=tuple(edges[edge].sample(s+32).p).map((v,i)=>v+(i===1?1.6:0));
 return [['eye',eye,look],['chase',tuple(safe),tuple(desired.look)]].map(([kind,eye,target])=>{
 const pos=xyz(eye as number[]),mat=new pc.Mat4().setLookAt(pos,xyz(target as number[]),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(mat).normalize(),name=kind+'-'+id;
 return {name,edge,s,kind,sourceEye:eye,sourceTarget:target,sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),cameraPositionBlender:pos.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,800],samples:8,renderByDefault:selected.has(name)};
 });
});
const old=JSON.parse(readFileSync('docs/desert-preview-provenance.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'desert-frozen-enrichment-cameras-v1',localUnpublishedHead:'077d232f4b4160d8928cce8cd85d0008c7212747',lastPublicDev:'915109353ed1d2fcdc8afbb5bdacafca3648e92e',notice:'Local unpublished Workshop/Harvest baseline; original Desert. Exact static geometry CPU preview, no kart/driver/HUD, runtime/GPU/FPS proof. 8 samples draft quality; all compared settings identical.',baseline:{geometrySha256:hash(baseline+'/desert-geometry.json'),glbSha256:hash(baseline+'/desert-original-scene.glb'),sourceHashes:data.sourceHashes},views,catalogViews:old.views},null,2));
console.log(JSON.stringify(views.filter(v=>v.renderByDefault),null,2));
