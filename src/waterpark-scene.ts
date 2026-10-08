import * as pc from 'playcanvas';
import { createWaterparkDesign,sampleCamera } from './waterpark-design';
import { createWaterparkWaterMaterial } from './waterpark-water';
export function createWaterparkScene(app:pc.Application){
 const root=new pc.Entity('Waterpark art sample');app.root.addChild(root);app.scene.ambientLight=new pc.Color(.61,.76,.88);app.scene.exposure=1.1;
 const waterMaterial=createWaterparkWaterMaterial(app);waterMaterial.setParameter('bridgeShadow',new Float32Array([183,3.5,.6,2]));let triangles=0;
 for(const data of createWaterparkDesign()){
 const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(data.positions);mesh.setNormals(pc.calculateNormals(data.positions,data.indices));mesh.setIndices(data.indices);if(data.uvs.length)mesh.setUvs(0,data.uvs);mesh.update(pc.PRIMITIVE_TRIANGLES);
 let mat:pc.Material=waterMaterial;if(!data.water){const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(data.color);m.gloss=.23;m.cull=pc.CULLFACE_NONE;m.twoSidedLighting=true;m.update();mat=m;}
 const e=new pc.Entity(data.name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat)],castShadows:!data.water,receiveShadows:true});root.addChild(e);triangles+=data.indices.length/3;}
 const sun=new pc.Entity('Waterpark afternoon sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.94,.83),intensity:2.15,castShadows:true,shadowDistance:130,shadowResolution:2048,shadowBias:.1,normalOffsetBias:.06,numCascades:2});sun.setEulerAngles(47,-35,0);root.addChild(sun);
 const camera=new pc.Entity('Waterpark low chase composition');camera.addComponent('camera',{fov:56,nearClip:.1,farClip:1200,clearColor:new pc.Color(.18,.59,.91),toneMapping:pc.TONEMAP_ACES,gammaCorrection:pc.GAMMA_SRGB});root.addChild(camera);
 const skyMat=new pc.ShaderMaterial({uniqueName:'waterpark-gradient-sky',attributes:{aPosition:pc.SEMANTIC_POSITION},vertexGLSL:'attribute vec3 aPosition; uniform mat4 matrix_model; uniform mat4 matrix_viewProjection; varying vec3 skyPosition; void main(){skyPosition=aPosition;gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.);}',fragmentGLSL:'varying vec3 skyPosition; void main(){float t=smoothstep(-.08,.65,normalize(skyPosition).y);gl_FragColor=vec4(mix(vec3(.65,.89,.98),vec3(.065,.34,.77),t),1.);}'});skyMat.cull=pc.CULLFACE_FRONT;skyMat.depthWrite=false;
 const sky=new pc.Entity('Waterpark blue gradient sky');sky.addComponent('render',{meshInstances:[new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice,new pc.SphereGeometry({radius:700,latitudeBands:12,longitudeBands:24})),skyMat)],castShadows:false});root.addChild(sky);
 function setCamera(distance:number){const c=sampleCamera(distance);camera.setPosition(...c.position as [number,number,number]);camera.lookAt(...c.target as [number,number,number]);}setCamera(12);
 return{root,camera,waterMaterial,triangles,setCamera};
}
