/** Freeze original source-road eye/chase cameras before Garden enrichment edits. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import {GARDEN_COURSE as course} from '../src/maps/garden.ts';
import {chaseCamera} from '../src/race-camera.ts';
import {safeLandCamera} from '../src/land-camera.ts';
const baseline=process.argv[2],output=process.argv[3];
if(!baseline||!output||existsSync(output))throw Error('Supply baseline and NEW camera output; cannot overwrite frozen cameras');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const data=JSON.parse(readFileSync(baseline+'/garden-geometry.json','utf8'));
for(const [p,h] of Object.entries(data.sourceHashes))if(hash(p)!==h)throw Error('Source changed before freeze: '+p);
const xyz=(p:number[])=>new pc.Vec3(p[0],-p[2],p[1]),tuple=(p:any)=>[p.x,p.y,p.z];
const stations=[['west-before','start',220],['west-middle','start',270],['west-after','start',320],['nursery-before','start',670],['nursery-middle','start',725],['nursery-after','start',780],['crown-before','finish',280],['crown-middle','finish',330],['crown-after','finish',380],['original-reveal','start',181.2094364941425],['original-arbor','alley',99.7072233487035],...data.route.driverReviewPoses.map((p:any)=>['original-'+p.id,p.edge,p.s])] as const;
const edges:any={start:course.commonStart,alley:course.alternates.alley,boulevard:course.alternates.boulevard,finish:course.commonFinish};
const selected=new Set(['eye-west-middle','chase0-west-middle','eye-nursery-middle','chase0-nursery-middle','eye-crown-middle','chase0-crown-middle']);
const views=stations.flatMap(([id,edge,s])=>{
 const f=edges[edge].sample(s),anchor={x:f.p.x,y:f.p.y+1.35,z:f.p.z},eye=tuple(f.p).map((v,i)=>v+(i===1?1.6:0)),look=tuple(edges[edge].sample(Math.min(s+32,edges[edge].length)).p).map((v,i)=>v+(i===1?1.6:0));
 const kinds:any[]=[{kind:'eye',eye,target:look}];
 for(const view of [0,1]){const desired=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),safe=safeLandCamera(anchor,desired.position,data.geometry.cameraObstacles);kinds.push({kind:'chase'+view,eye:tuple(safe),target:tuple(desired.look),sourceDesiredEye:tuple(desired.position)});}
 return kinds.map(({kind,eye,target,sourceDesiredEye})=>{
 const pos=xyz(eye),mat=new pc.Mat4().setLookAt(pos,xyz(target),new pc.Vec3(0,0,1)),q=new pc.Quat().setFromMat4(mat).normalize(),name=kind+'-'+id;
 return {name,edge,s,kind,sourceEye:eye,sourceTarget:target,sourceAnchor:tuple(anchor),sourceDesiredEye,cameraPositionBlender:pos.toArray().map(Math.fround),cameraQuaternionBlender:[q.w,q.x,q.y,q.z].map(Math.fround),projection:'PERSP',sensorFit:'VERTICAL',sensorWidthMillimetres:36,sensorHeightMillimetres:24,lensMillimetres:24/(2*Math.tan(28*Math.PI/180)),verticalFovDegrees:56,clipStart:.12,clipEnd:2200,resolution:[1280,800],samples:8,renderByDefault:selected.has(name)};
 });
});
const old=JSON.parse(readFileSync('docs/garden-preview-provenance.json','utf8'));
writeFileSync(output,JSON.stringify({schema:'garden-frozen-enrichment-cameras-v1',localUnpublishedHead:'36a4e224e915f2481513c805a9ed4f6445199d6d',lastPublicDev:'915109353ed1d2fcdc8afbb5bdacafca3648e92e',notice:'Local unpublished preceding map enrichments baseline; original Garden. Exact static geometry CPU preview, no kart/driver/HUD, runtime/GPU/FPS proof. 8 samples draft quality; all compared settings identical.',baseline:{geometrySha256:hash(baseline+'/garden-geometry.json'),glbSha256:hash(baseline+'/garden-original-scene.glb'),sourceHashes:data.sourceHashes},views,catalogViews:old.views},null,2));
console.log(JSON.stringify(views.filter(v=>v.renderByDefault),null,2));
