import * as pc from 'playcanvas';
import {sampleWaterpark,WATER_HALF_WIDTH} from './waterpark-design';
import {sampleWaterSurface,finiteWaterValue} from './waterpark-surface';
export const WAKE_SEGMENTS=24,SPRAY_DROPLETS=28;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** Deterministic, bounded visual wake. Curves with lateral velocity, rides the same
 * surface as the water mesh, and uses ballistic spray arcs rather than rigid bodies. */
export function waterparkEffectGeometry(distance:number,lane:number,speed:number,time:number,lateralSpeed=0){
 distance=clamp(finiteWaterValue(distance),0,285);lane=clamp(finiteWaterValue(lane),-10.5,10.5);
 speed=clamp(finiteWaterValue(speed),0,30);time=Math.max(0,finiteWaterValue(time));lateralSpeed=clamp(finiteWaterValue(lateralSpeed),-8,8);
 const positions:number[]=[],spray:number[]=[],effort=speed/30,turn=Math.abs(lateralSpeed)/8,length=3+effort*15;
 for(const side of[-1,1])for(let i=0;i<=WAKE_SEGMENTS;i++){
  const f=i/WAKE_SEGMENTS,d=distance-1.5-f*length,lag=f*length/Math.max(speed,4);
  const center=lane-lateralSpeed*lag*.55+side*(.65+f*(1.25+turn*.9)),width=.19+f*(.58+turn*.25);
  for(const offset of[-width,width]){const p=sampleWaterpark(d,clamp(center+offset,-WATER_HALF_WIDTH+.06,WATER_HALF_WIDTH-.06)).p;
   positions.push(p.x,sampleWaterSurface(p.x,p.z,time).height+.035,p.z);}
 }
 for(let i=0;i<SPRAY_DROPLETS;i++){
  const side=i%2?1:-1,phase=(time+i*.61803398875)%1;
  const age=phase,launchVelocity=2.5+effort*1.4+turn*.8,flight=2*launchVelocity/9.8;
  const height=launchVelocity*age-4.9*age*age;
  const visibility=clamp(age/.035,0,1)*clamp((flight-age)/.12,0,1);
  const d=distance+.55-age*(speed*.6+1.2),l=clamp(lane+side*(.68+age*(1.5+effort*2+turn*2))-lateralSpeed*age*.2,-11.8,11.8);
  const s=sampleWaterpark(d,l),y=sampleWaterSurface(s.p.x,s.p.z,time).height+.035+Math.max(0,height),size=(.025+effort*.04+turn*.025)*(1-phase*.7)*visibility;
  // Slim cross-facing spray droplets: two triangles, no texture/particle allocation.
  for(const[x,up]of[[-1,0],[1,0],[-.3,2.7],[.3,2.7]])spray.push(s.p.x+s.n.x*x*size,y+up*size,s.p.z+s.n.z*x*size);
 }
 return{positions,spray,strength:clamp(speed/18,0,.88),sprayStrength:clamp((speed-2)/20+turn*.22,0,.8),enabled:speed>.6};
}
/** Two batched draw calls; fixed vertices, no per-droplet entities or physics bodies. */
export function createWaterparkWake(app:pc.Application,parent:pc.Entity){
 const mesh=new pc.Mesh(app.graphicsDevice),sprayMesh=new pc.Mesh(app.graphicsDevice),indices:number[]=[],uvs:number[]=[];
 for(let side=0;side<2;side++)for(let i=0;i<=WAKE_SEGMENTS;i++){uvs.push(0,i/WAKE_SEGMENTS,1,i/WAKE_SEGMENTS);if(i<WAKE_SEGMENTS){const n=side*(WAKE_SEGMENTS+1)*2+i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
 mesh.setPositions(new Array(2*(WAKE_SEGMENTS+1)*2*3).fill(0));mesh.setUvs(0,uvs);mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
 const sprayIndices:number[]=[],sprayUvs:number[]=[];
 for(let i=0;i<SPRAY_DROPLETS;i++){const n=i*4;sprayIndices.push(n,n+1,n+2,n+1,n+3,n+2);sprayUvs.push(0,0,1,0,0,1,1,1);}
 sprayMesh.setPositions(new Array(SPRAY_DROPLETS*12).fill(0));sprayMesh.setUvs(0,sprayUvs);sprayMesh.setIndices(sprayIndices);sprayMesh.update(pc.PRIMITIVE_TRIANGLES);
 const vertex='attribute vec3 aPosition;attribute vec2 aUv0;uniform mat4 matrix_model;uniform mat4 matrix_viewProjection;varying vec2 uv;void main(){uv=aUv0;gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.);}';
 function material(name:string,spray=false){const mat=new pc.ShaderMaterial({uniqueName:name,attributes:{aPosition:pc.SEMANTIC_POSITION,aUv0:pc.SEMANTIC_TEXCOORD0},vertexGLSL:vertex,fragmentGLSL:spray?'varying vec2 uv;uniform float strength;void main(){float edge=sin(uv.x*3.14159265);gl_FragColor=vec4(.89,.99,1.,edge*(1.-uv.y*.5)*strength);}':'varying vec2 uv;uniform float strength;uniform float time;void main(){float edge=sin(uv.x*3.14159265);float streak=.68+.32*sin(uv.y*48.-time*9.+uv.x*8.);float fade=pow(1.-uv.y,1.4);gl_FragColor=vec4(.82,.99,1.,edge*fade*strength*streak);}'});mat.blendType=pc.BLEND_NORMAL;mat.depthWrite=false;mat.cull=pc.CULLFACE_NONE;mat.setParameter('strength',0);mat.setParameter('time',0);return mat;}
 const mat=material('waterpark-surface-following-wake'),sprayMat=material('waterpark-ballistic-spray',true);
 const entity=new pc.Entity('Twin white water-mount wake');entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat),new pc.MeshInstance(sprayMesh,sprayMat)],castShadows:false,receiveShadows:false});parent.addChild(entity);
 let disposed=false;
 function update(distance:number,lane:number,speed:number,time:number,lateralSpeed=0){if(disposed)return;const data=waterparkEffectGeometry(distance,lane,speed,time,lateralSpeed);
 mesh.setPositions(data.positions);mesh.update(pc.PRIMITIVE_TRIANGLES);sprayMesh.setPositions(data.spray);sprayMesh.update(pc.PRIMITIVE_TRIANGLES);
 mat.setParameter('strength',data.strength);mat.setParameter('time',finiteWaterValue(time));sprayMat.setParameter('strength',data.sprayStrength);entity.enabled=data.enabled;
 }
 function dispose(){if(disposed)return;disposed=true;app.off('destroy',dispose);entity.destroy();mesh.destroy();sprayMesh.destroy();mat.destroy();sprayMat.destroy();}
 app.once('destroy',dispose);
 return{entity,update,dispose};
}
