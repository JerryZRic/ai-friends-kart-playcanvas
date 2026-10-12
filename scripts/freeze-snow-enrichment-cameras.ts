/** Freeze original source-road eye/chase cameras before Snow enrichment edits. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {SNOW_COURSE as course} from '../src/maps/snow.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';
const baseline=process.argv[2],output=process.argv[3];
if(!baseline||!output||existsSync(output))throw Error('Supply baseline and NEW camera output; cannot overwrite frozen cameras');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const data=JSON.parse(readFileSync(baseline+'/snow-geometry.json','utf8'));
for(const [p,h] of Object.entries(data.sourceHashes))if(hash(p)!==h)throw Error('Source changed before freeze: '+p);
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]),tuple=(p:any)=>[p.x,p.y,p.z];
const stations=[['first-bowl','start',380],['saddle','start',640],['second-bowl','start',1100],['descent','start',1400],['fork','start',1740],['service-yard','alley',210],['clock-regression','boulevard',330],['return','finish',620],['clock-approach','boulevard',160],['clock-early','boulevard',100],['clock-middle','boulevard',220],['service-approach','alley',160]] as const;
const edges={start:course.commonStart,alley:course.alternates.alley,boulevard:course.alternates.boulevard,finish:course.commonFinish};
const selected=new Set(['eye-first-bowl','chase-first-bowl','eye-second-bowl','chase-second-bowl','eye-clock-approach','chase-clock-approach','eye-service-yard','chase-service-yard']);
const views=stations.flatMap(([id,edge,s])=>{
 const f=edges[edge].sample(s),desired=chaseCamera({position:f.p,tangent:f.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}}),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles),eye=tuple(f.p).map((v,i)=>v+(i===1?1.6:0)),look=tuple(edges[edge].sample(s+32).p).map((v,i)=>v+(i===1?1.6:0));
 return [['eye',eye,look],['chase',tuple(safe),tuple(desired.look)]].map(([kind,eye,target])=>{
 const pos=xyz(eye as number[]),mat=new pc.Mat4().setLookAt(pos,xyz(target as number[]),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(mat).normalize(),name=kind+'-'+id;
 return {name,edge,s,kind,sourceEye:eye,sourceTarget:target,sourceAnchor:tuple(anchor),sourceDesiredEye:tuple(desired.position),cameraPositionBlender:pos.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,800],samples:8,renderByDefault:selected.has(name)};
 });
});
const old=JSON.parse(readFileSync('docs/snow-preview-provenance.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'snow-frozen-enrichment-cameras-v1',localUnpublishedHead:'1005abd2b09b49310c8a8387de10e674ad9ee6ce',lastPublicDev:'915109353ed1d2fcdc8afbb5bdacafca3648e92e',notice:'Local unpublished Workshop/Harvest/Desert baseline; original Snow. Exact static geometry CPU preview, no kart/driver/HUD, runtime/GPU/FPS proof. 8 samples draft quality; all compared settings identical.',baseline:{geometrySha256:hash(baseline+'/snow-geometry.json'),glbSha256:hash(baseline+'/snow-original-scene.glb'),sourceHashes:data.sourceHashes},views,catalogViews:old.views},null,2));
console.log(JSON.stringify(views.filter(v=>v.renderByDefault),null,2));
