import type {MountainSceneGeometry,MountainComponent} from '../../src/mountain-scenery';
import type {LandTrack} from '../../src/land-track';
import {mountainArtComponent,mountainArtMemberIds,mountainArtComponentBuffer} from './mountain-art-pass-contract';
import {MeshOracle,ComponentOracle,clipPlane,tuple,sub,segmentTriangleDistance,type V,type Triangle} from './emitted-scene-oracle';

/** Independent emitted-face oracle, shared only by historical capture and the
 * regression test. No production camera/clearance acceptance helpers are used. */
export function mountainArtCylinderSnapshot(scene:MountainSceneGeometry,track:LandTrack,mesh=new MeshOracle(scene.batches),parts=new ComponentOracle(mesh,scene.components)){
 const ids=mountainArtMemberIds(scene),radius=Math.hypot(15,6.9),margin=.3,betweenStations=.75;
 let stations=0,pierContacts=0,sceneryContacts=0,pierCandidates=0,sceneryCandidates=0,minPierMargin=Infinity,maxAdjacentLaneTravel=0;
 const groups=new Map<string,any>(),stationGroups=new Map<string,any>(),pierGroups=new Map<string,any>(),witnesses:any[]=[];let prior:V[]|null=null;
 for(let d=track.length*.875;d<=track.length*.935;d+=.5){
  const a=tuple(track.sample(d,-track.laneLimitAt(d)).p),b=tuple(track.sample(d,track.laneLimitAt(d)).p);
  if(prior)maxAdjacentLaneTravel=Math.max(maxAdjacentLaneTravel,Math.hypot(...sub(a,prior[0])),Math.hypot(...sub(b,prior[1])));prior=[a,b];
  const lo=Math.min(a[1],b[1])+1.35-margin,hi=Math.max(a[1],b[1])+1+radius+margin;
  for(const q of mesh.query(a,b,radius+margin+betweenStations)){
   const c=parts.owner.get(q.id)! as MountainComponent,isPier=c.kind==='source-exact-viaduct-pier';
   if((!isPier&&!mountainArtComponent(c))||q.max[1]<lo||q.min[1]>hi)continue;
   if(isPier)pierCandidates++;else sceneryCandidates++;
   let polygon=clipPlane([q.a,q.b,q.c],v=>v[1]-lo);polygon=clipPlane(polygon,v=>hi-v[1]);if(polygon.length<3)continue;
   const flat=(p:V):V=>[p[0],0,p[2]];let distance=Infinity;
   for(let i=1;i<polygon.length-1;i++){const t:Triangle={id:q.id,batch:q.batch,vertices:[],a:flat(polygon[0]),b:flat(polygon[i]),c:flat(polygon[i+1]),min:[0,0,0],max:[0,0,0]};distance=Math.min(distance,segmentTriangleDistance(flat(a),flat(b),t));}
   const gap=distance-radius-betweenStations;if(isPier)minPierMargin=Math.min(minPierMargin,gap);if(gap>=margin-1e-6)continue;
   const key=ids.get(c)!,collection=isPier?pierGroups:groups,group=collection.get(key)??{identity:key,kinds:new Set<string>(),contacts:0,stationIds:new Set<number>(),faces:new Set<number>(),componentIds:new Set<number>(),minimumMargin:Infinity,witness:null};
   group.contacts++;group.kinds.add(c.kind);group.stationIds.add(stations);group.faces.add(q.id);group.componentIds.add(scene.components.indexOf(c));
   const witness={station:stations,d,triangle:q.id,identity:key,kind:c.kind,gap,polygon};
   if(gap<group.minimumMargin){group.minimumMargin=gap;group.witness=witness;}collection.set(key,group);if(witnesses.length<40)witnesses.push(witness);
   if(isPier)pierContacts++;else{
    sceneryContacts++;const skey=key+'@'+stations,r=stationGroups.get(skey)??{identity:key,station:stations,d,contacts:0,minimumMargin:Infinity};r.contacts++;r.minimumMargin=Math.min(r.minimumMargin,gap);stationGroups.set(skey,r);
   }
  }stations++;
 }
 const serialize=(map:Map<string,any>)=>[...map.values()].map(r=>{
  const trunk=scene.components.find(c=>ids.get(c)===r.identity&&c.kind==='spruce-ground-rooted-trunk');
  const body=scene.components.find(c=>ids.get(c)===r.identity&&c.kind==='rooted-low-layered-talus');
  return{...r,kinds:[...r.kinds],stationIds:[...r.stationIds],faces:[...r.faces],componentIds:[...r.componentIds],
   groundedEvidence:trunk?mountainArtComponentBuffer(scene,trunk):body?mountainArtComponentBuffer(scene,body):null};
 });
 return{routeFractions:[.875,.935],stationStep:.5,stations,radius,margin,betweenStations,maxAdjacentLaneTravel,pierContacts,sceneryContacts,pierCandidates,sceneryCandidates,minPierMargin,originalPierEnvelopeClear:pierContacts===0,sceneryEnvelopeClear:sceneryContacts===0,pierGroups:serialize(pierGroups),sceneryGroups:serialize(groups),stationGroups:[...stationGroups.values()],witnesses,witnessCap:40};
}
