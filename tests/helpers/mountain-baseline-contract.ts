import {createHash} from 'node:crypto';
import type {LandTrack} from '../../src/land-track';
import type {LandSceneGeometry} from '../../src/land-scenery';
export const mountainProtectedSources=[
 'src/mouse-look.js','src/race-options.ts','src/driver-roster.js','src/kart-catalog.json','src/maps/mountain.ts','src/closed-circuit.ts','src/land-track.ts','src/game.ts','src/land-driving.ts','src/land-race-route.ts','src/land-routes.ts','src/track.ts','src/vehicle-controls.js','src/race-controls.ts','src/race-frame-clock.ts','src/race-camera.ts','src/land-camera.ts','src/npc-difficulty.ts','src/npc-tactics.ts','src/kart-race.ts','src/kart-build.ts','src/kart-presets.ts','src/kart-assembly.ts','src/kart-driver.ts','src/character-profiles.ts','src/coast-race-feedback.ts','src/coast-race-rules.ts','src/item-models.ts','src/item-pickups.ts','src/dynamic-pickups.ts','src/land-course-pickups.ts','src/food-kart-payload.ts','src/assets.ts',
] as const;
export function binaryDigest(values:readonly number[],kind:'f64'|'u32'='f64'){
 const hash=createHash('sha256'),bytes=Buffer.allocUnsafe(8192),size=kind==='f64'?8:4;let offset=0;
 for(const value of values){if(offset+size>bytes.length){hash.update(bytes.subarray(0,offset));offset=0;}if(kind==='f64')bytes.writeDoubleLE(value,offset);else bytes.writeUInt32LE(value,offset);offset+=size;}
 if(offset)hash.update(bytes.subarray(0,offset));return hash.digest('hex');
}
export function mountainRouteContract(track:LandTrack){
 const values:number[]=[],surfaces:string[]=[];
 for(let i=-1;i<=4096;i++){
  const d=i/4096*track.length;values.push(d,track.halfWidthAt(d),track.laneLimitAt(d));surfaces.push(JSON.stringify(track.surfaceAt(d)));
  for(const side of [-1,-.5,0,.5,1]){const frame=track.sample(d,side*track.laneLimitAt(d));values.push(...frame.p.toArray(),...frame.t.toArray(),...frame.n.toArray(),...frame.normal.toArray(),frame.bank,frame.grade,frame.angle);}
 }
 return {length:track.length,sampleStations:4098,lanes:5,floatCount:values.length,frameSHA256:binaryDigest(values),surfaceSHA256:createHash('sha256').update(surfaces.join('\n')).digest('hex'),sections:track.sections,pickups:track.pickups};
}
export function mountainRoadContract(geometry:LandSceneGeometry){
 return geometry.batches.filter(b=>/banked tarmac|aggregate tarmac|stone roadway/.test(b.name)).map(b=>({name:b.name,vertices:b.positions.length/3,triangles:b.indices.length/3,positionF64LE:binaryDigest(b.positions),indexU32LE:binaryDigest(b.indices,'u32'),uvF64LE:binaryDigest(b.uvs)}));
}

/** Exact intended contact classification. Reconstruct the original source quad
 * vertices and additive Y offsets, then require exact emitted-coordinate parity.
 * This does not remove these faces from the camera or any geometric oracle. */
export function mountainSupportWitnesses(track:LandTrack){
 const records=new Map<string,{kind:string;distance:number;next:number;offset:number;vertices:{distance:number;lateral:number;offset:number;position:number[]}[]}>();
 const key=(points:readonly (readonly number[])[])=>points.map(p=>p.join(',')).sort().join('|');
 const at=(distance:number,lateral:number,offset:number)=>{const p=track.sample(distance,lateral).p;p.y+=offset;return{distance,lateral,offset,position:p.toArray()};};
 const quad=(kind:string,d:number,next:number,a:ReturnType<typeof at>,b:ReturnType<typeof at>,c:ReturnType<typeof at>,e:ReturnType<typeof at>,offset:number)=>{for(const vertices of [[a,c,b],[b,c,e]])records.set(key(vertices.map(v=>v.position)),{kind,distance:d,next,offset,vertices});};
 const ribbon=(kind:string,d:number,next:number,a:number,b:number,offset:number)=>quad(kind,d,next,at(d,a,offset),at(d,b,offset),at(next,a,offset),at(next,b,offset),offset);
 const n=960,step=track.length/n;
 for(let i=0;i<n;i++){const d=i*step,next=(i+1)*step,w=track.halfWidthAt(d),wn=track.halfWidthAt(next);quad('original-road',d,next,at(d,-w,0),at(d,w,0),at(next,-wn,0),at(next,wn,0),0);
  for(const side of [-1,1]){quad('original-shoulder',d,next,at(d,side*w,-.04),at(d,side*(w+1.5),-.04),at(next,side*wn,-.04),at(next,side*(wn+1.5),-.04),-.04);ribbon('original-thin-kerb-marking',d,next,side*(w+.10),side*(w+.65),.035);}
  if(i%10<5)ribbon('original-thin-center-marking',d,next,-.055,.055,.025);
 }
 for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const w=track.halfWidthAt(0);ribbon('original-thin-grid-marking',row*.7,(row+1)*.7,-w+col*w/8,-w+(col+1)*w/8,.045);}
 return {records,key};
}

/** Loader may change, but its shared grade/camber placement functions may not. */
export function mountainPlacementContract(source:string){const marker='/** Model +Z faces the tangent;';const at=source.indexOf(marker);if(at<0)throw new Error('Missing preserved shared placement source');return createHash('sha256').update(source.slice(at)).digest('hex');}

/** Unrelated scene inputs are frozen while only Mountain is isolated. */
export const mountainIsolatedSceneSources=["src/land-mesh-builder.ts","src/land-road-mesh.ts","src/land-scene.ts","src/land-scenery.ts","src/scene.ts","src/maps/town.ts","src/maps/quarry.ts","src/maps/forest.ts","src/maps/workshop.ts","src/maps/harvest.ts","src/maps/desert.ts","src/maps/snow.ts","src/maps/caldera.ts","src/maps/garden.ts","src/maps/airfield.ts","src/town-scenery.ts","src/quarry-scenery.ts","src/forest-scenery.ts","src/workshop-scenery.ts","src/harvest-scenery.ts","src/desert-scenery.ts","src/snow-scenery.ts","src/caldera-scenery.ts","src/garden-scenery.ts","src/airfield-scenery.ts","src/water-mount.ts","src/water-race.ts","src/waterpark-bed.ts","src/waterpark-design.ts","src/waterpark-environment.ts","src/waterpark-input.ts","src/waterpark-lifetime.ts","src/waterpark-materials.ts","src/waterpark-motion.ts","src/waterpark-performance-ui.ts","src/waterpark-performance.ts","src/waterpark-play.ts","src/waterpark-preview.ts","src/waterpark-reflection.ts","src/waterpark-refraction.ts","src/waterpark-scene.ts","src/waterpark-surface.ts","src/waterpark-wake.ts","src/waterpark-water.ts"] as const;
export function mountainUnrelatedLoaderContract(source:string){const start=source.indexOf("  if(mapId==='mountain') {"),end=source.indexOf("  return {id:'coast'",start);if(start<0||end<start)throw new Error('Missing exact Mountain loader boundaries');return createHash('sha256').update(source.slice(0,start)+source.slice(end)).digest('hex');}
export function mountainUnrelatedMenuContract(source:string){const start=source.indexOf('  return mountainPreparation??='),ending='  }).catch(error=>{mountainPreparation=undefined;throw error;});',end=source.indexOf(ending,start);if(start<0||end<start)throw new Error('Missing exact Mountain menu boundaries');return createHash('sha256').update(source.slice(0,start)+source.slice(end+ending.length)).digest('hex');}

function pierRecord(positions:readonly number[],indices:readonly number[]){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];positions.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});return{vertices:positions.length/3,triangles:indices.length/3,min,max,positionF64LE:binaryDigest(positions),indexU32LE:binaryDigest(indices,'u32')};}
/** Pins actual emitted original dimensions/positions/topology, not merely a label
 * or a rounded pier center. The legacy extractor only reads already-built data. */
export function mountainLegacyPierContract(geometry:LandSceneGeometry){
 const placements=geometry.props.filter(p=>p.kind==='viaduct-pier'),batch=geometry.batches.find(b=>b.name==='Stratified granite and retaining masonry')!,pattern:number[]=[];
 for(let i=0;i<24;i+=4)pattern.push(i,i+2,i+1,i+1,i+2,i+3);
 const records=placements.map(place=>{const matches:ReturnType<typeof pierRecord>[]=[];for(let k=0;k+35<batch.indices.length;k+=3){const start=batch.indices[k];if(pattern.some((n,j)=>batch.indices[k+j]!==start+n))continue;const values=batch.positions.slice(start*3,(start+24)*3),r=pierRecord(values,pattern);if(Math.abs((r.min[0]+r.max[0])/2-place.x)>1e-7||Math.abs((r.min[2]+r.max[2])/2-place.z)>1e-7||Math.abs(r.min[1]-place.y)>1e-7||r.max[1]-r.min[1]<30)continue;matches.push(r);}if(matches.length!==1)throw new Error('Pristine pier extraction must find exactly one actual emitted box');return matches[0];});
 return{count:placements.length,authoredWidth:1.5,authoredDepth:2.2,placements,records};
}
export function mountainPierContract(geometry:LandSceneGeometry&{components:readonly {kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number}[]}){
 const placements=geometry.props.filter(p=>p.kind==='viaduct-pier'),piers=geometry.components.filter(c=>c.kind==='source-exact-viaduct-pier'),records=piers.map(c=>{const batch=geometry.batches.find(b=>b.name===c.batch)!;return pierRecord(batch.positions.slice(c.vertexStart*3,c.vertexEnd*3),batch.indices.slice(c.indexStart,c.indexEnd).map(i=>i-c.vertexStart));});
 return{count:piers.length,authoredWidth:1.5,authoredDepth:2.2,placements,records};
}
