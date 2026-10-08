import * as pc from 'playcanvas';
import {sampleWaterpark} from './waterpark-design';
/** Two original dynamic foam ribbons, one draw call, no billboard image textures. */
export function createWaterparkWake(app:pc.Application,parent:pc.Entity){
 const mesh=new pc.Mesh(app.graphicsDevice),count=24,indices:number[]=[],uvs:number[]=[];
 for(let side=0;side<2;side++)for(let i=0;i<=count;i++){uvs.push(0,i/count,1,i/count);if(i<count){const n=side*(count+1)*2+i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
 mesh.setPositions(new Array(2*(count+1)*2*3).fill(0));mesh.setUvs(0,uvs);mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
 const mat=new pc.ShaderMaterial({uniqueName:'waterpark-mount-wake',attributes:{aPosition:pc.SEMANTIC_POSITION,aUv0:pc.SEMANTIC_TEXCOORD0},vertexGLSL:'attribute vec3 aPosition;attribute vec2 aUv0;uniform mat4 matrix_model;uniform mat4 matrix_viewProjection;varying vec2 uv;void main(){uv=aUv0;gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.);}',fragmentGLSL:'varying vec2 uv;uniform float strength;uniform float time;void main(){float edge=sin(uv.x*3.14159265);float streak=.68+.32*sin(uv.y*48.-time*9.+uv.x*8.);float fade=pow(1.-uv.y,1.4);gl_FragColor=vec4(.82,.99,1.,edge*fade*strength*streak);}'});
 mat.blendType=pc.BLEND_NORMAL;mat.depthWrite=false;mat.cull=pc.CULLFACE_NONE;mat.setParameter('strength',0);mat.setParameter('time',0);
 const entity=new pc.Entity('Twin white water-mount wake');entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat)],castShadows:false,receiveShadows:false});parent.addChild(entity);
 function update(distance:number,lane:number,speed:number,time:number){const positions:number[]=[];const length=3+Math.min(1,speed/22)*12;
 for(const side of[-1,1])for(let i=0;i<=count;i++){const f=i/count,d=distance-1.5-f*length,center=lane+side*(.65+f*1.25),width=.25+f*.6;for(const offset of[-width,width]){const p=sampleWaterpark(d,center+offset).p;positions.push(p.x,.12+Math.sin(time*3+f*12)*.009,p.z);}}
 mesh.setPositions(positions);mesh.update(pc.PRIMITIVE_TRIANGLES);mat.setParameter('strength',Math.min(.86,speed/15));mat.setParameter('time',time);entity.enabled=speed>.6;
 }
 return{entity,update,dispose(){entity.destroy();mesh.destroy();mat.destroy();}};
}
