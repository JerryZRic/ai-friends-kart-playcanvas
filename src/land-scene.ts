import * as pc from 'playcanvas';
import type { DriverAsset } from './assets';
import type { LandTrack } from './land-track';
import type { ItemBox } from './scene';
import { createPickupVisual } from './pickup-visual';
import { resetPickup } from './item-pickups';
import { DYNAMIC_PICKUP_CAPACITY } from './dynamic-pickups';
import { buildLandSceneGeometry, landTexturePixels, type LandSurfaceTexture, type LandSceneGeometry } from './land-scenery';
export { buildLandSceneGeometry, landTexturePixels } from './land-scenery';
export type { LandSceneGeometry, LandGeometryBatch } from './land-scenery';

const color = (hex: string) => new pc.Color().fromString(hex);

export interface LandSceneTheme {
  textureLabel: string; ambient: string; sky: string; fogStart: number; fogEnd: number;
  cameraName: string; sunName: string; sunColor: string; sunIntensity: number;
  sunEuler: readonly [number, number, number];
}
export interface LandSceneOptions {
  preview?: boolean;
  /** Same immutable source geometry can feed the runtime and offline exporter. */
  geometry?: LandSceneGeometry;
  theme?: Partial<LandSceneTheme>;
  pickups?: readonly {d:number; lateral:number; p?:pc.Vec3; edgeId?:string; s?:number}[];
}
export const MOUNTAIN_SCENE_THEME: Readonly<LandSceneTheme> = Object.freeze({
  textureLabel: 'mountain', ambient: '#b6c8d1', sky: '#c4d6da', fogStart: 390, fogEnd: 1250,
  cameraName: 'Alpine chase camera', sunName: 'Alpine afternoon key light',
  sunColor: '#fff0d5', sunIntensity: 1.8, sunEuler: [48, -32, 0] as const,
});

/** Original, static-batched land environment. Deliberately contains no ocean,
 * coast scene import or external asset download. All course meshes derive from
 * the exact LandTrack passed by the playable race/menu/offline preview. */
export function createLandScene(app: pc.Application, track: LandTrack, options: LandSceneOptions = {}) {
  const geometry=options.geometry ?? buildLandSceneGeometry(track);
  const theme={...MOUNTAIN_SCENE_THEME,...options.theme};
  const root=new pc.Entity(`${track.label} original land circuit`,app);app.root.addChild(root);
  const materials: pc.Material[]=[],textures: pc.Texture[]=[];
  const textureCache=new Map<LandSurfaceTexture,pc.Texture>();
  let disposed=false;
  const makeMaterial=(name:string,hex:string,roughness=.9,metalness=0,texture:LandSurfaceTexture='none')=>{
    const mat=new pc.StandardMaterial();mat.name=name;mat.diffuse=color(hex);mat.useMetalness=true;
    mat.metalness=metalness;mat.gloss=1-roughness;mat.cull=pc.CULLFACE_NONE;mat.twoSidedLighting=true;
    if(texture!=='none') {
      let tex=textureCache.get(texture);
      if(!tex) {
        tex=new pc.Texture(app.graphicsDevice,{name:`Original ${theme.textureLabel} ${texture}`,width:64,height:64,format:pc.PIXELFORMAT_RGBA8,mipmaps:true});
        tex.addressU=tex.addressV=pc.ADDRESS_REPEAT;tex.minFilter=pc.FILTER_LINEAR_MIPMAP_LINEAR;tex.magFilter=pc.FILTER_LINEAR;
        (tex.lock() as Uint8Array).set(landTexturePixels(texture));tex.unlock();textureCache.set(texture,tex);textures.push(tex);
      }
      mat.diffuseMap=tex;
    }
    mat.update();materials.push(mat);return mat;
  };
  const entity=(name:string,mesh:pc.Mesh,mat:pc.Material,cast=true)=>{
    const e=new pc.Entity(name,app);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,mat)],castShadows:cast,receiveShadows:true});root.addChild(e);return e;
  };
  for(const batch of geometry.batches) {
    const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(batch.positions);mesh.setNormals(pc.calculateNormals(batch.positions,batch.indices));
    mesh.setUvs(0,batch.uvs);mesh.setIndices(batch.indices);mesh.update(pc.PRIMITIVE_TRIANGLES);
    entity(batch.name,mesh,makeMaterial(batch.name,batch.color,batch.roughness,batch.metalness,batch.texture),!/valley floor|Distant/.test(batch.name));
  }
  app.scene.ambientLight=color(theme.ambient);app.scene.exposure=1;
  app.scene.fog.type=pc.FOG_LINEAR;app.scene.fog.color=color(theme.sky);app.scene.fog.start=theme.fogStart;app.scene.fog.end=theme.fogEnd;
  const camera=new pc.Entity(theme.cameraName,app);
  camera.addComponent('camera',{fov:56,nearClip:.12,farClip:2200,clearColor:color(theme.sky),toneMapping:pc.TONEMAP_ACES,gammaCorrection:pc.GAMMA_SRGB});app.root.addChild(camera);
  const start=track.sample(0),behind=track.sample(-32).p;camera.setPosition(behind.x,behind.y+15,behind.z);camera.lookAt(start.p.clone().add(new pc.Vec3(0,2,0)));
  const sun=new pc.Entity(theme.sunName,app);
  sun.addComponent('light',{type:'directional',color:color(theme.sunColor),intensity:theme.sunIntensity,castShadows:true,shadowDistance:180,shadowResolution:2048,shadowBias:.14,normalOffsetBias:.09,numCascades:2});sun.setEulerAngles(...theme.sunEuler);app.root.addChild(sun);
  // Compatibility handle for the existing shared race animation path. No
  // entity uses it and no water geometry/material shader is allocated.
  const oceanMaterial=new pc.StandardMaterial();oceanMaterial.name='Unused land animation compatibility';oceanMaterial.setParameter('time',0);materials.push(oceanMaterial);
  const boxes: ItemBox[]=[];
  const shield=new pc.Entity('Land energy shield',app);root.addChild(shield);shield.enabled=false;
  const flames: {mesh:pc.Entity;side:number}[]=[],particles:pc.Entity[]=[];
  if(!options.preview) {
    for(const pickup of options.pickups ?? track.pickups) {
      const {d,lateral}=pickup, source=pickup as NonNullable<LandSceneOptions['pickups']>[number];
      const p=(source.p ?? track.sample(d,lateral).p).clone();p.y+=1.25;
      const visual=createPickupVisual(app,root);visual.mesh.setPosition(p);
      const box:ItemBox={d,lateral,...visual,cool:0,base:p.y,display:'mystery'};
      if(source.edgeId!==undefined)Object.assign(box,{edgeId:source.edgeId,s:source.s});
      resetPickup(box);boxes.push(box);
    }
    for(let i=0;i<DYNAMIC_PICKUP_CAPACITY;i++) {
      const p=track.sample(0).p.clone();p.y+=1.25;const visual=createPickupVisual(app,root);visual.mesh.setPosition(p);visual.mesh.enabled=false;
      boxes.push({d:0,lateral:0,...visual,cool:0,base:p.y,display:'mystery',dynamic:true});
    }
    const shieldMat=makeMaterial('Land translucent shield','#84e8fa',.1,.2);shieldMat.opacity=.18;shieldMat.blendType=pc.BLEND_NORMAL;shieldMat.depthWrite=false;shieldMat.emissive=color('#123f45');shieldMat.update();
    const shieldMesh=pc.Mesh.fromGeometry(app.graphicsDevice,new pc.SphereGeometry({radius:2.4,latitudeBands:12,longitudeBands:18}));
    shield.addComponent('render',{meshInstances:[new pc.MeshInstance(shieldMesh,shieldMat)],castShadows:false});
    const flameMesh=pc.Mesh.fromGeometry(app.graphicsDevice,new pc.ConeGeometry({baseRadius:.22,peakRadius:0,height:1.5,capSegments:7}));
    const flameMat=makeMaterial('Land boost flame','#a6f9ff');flameMat.useLighting=false;flameMat.emissive=color('#a6f9ff');flameMat.diffuse.set(0,0,0);flameMat.opacity=.8;flameMat.blendType=pc.BLEND_NORMAL;flameMat.depthWrite=false;flameMat.update();
    for(const side of [-1,1]) {const mesh=entity('Land turbo flame',flameMesh,flameMat,false);mesh.enabled=false;flames.push({mesh,side});}
    const sparkMesh=pc.Mesh.fromGeometry(app.graphicsDevice,new pc.SphereGeometry({radius:.065,latitudeBands:3,longitudeBands:4}));
    const sparkMat=makeMaterial('Land drift spark','#ffc36c');sparkMat.useLighting=false;sparkMat.emissive=color('#ffc36c');sparkMat.diffuse.set(0,0,0);sparkMat.update();
    for(let i=0;i<160;i++){const e=entity('Land drift spark',sparkMesh,sparkMat,false);e.enabled=false;particles.push(e);}
  }
  const propsRoot=new pc.Entity('Original land props are statically batched',app);root.addChild(propsRoot);
  // Contract-compatible and idempotent: land models are already original native
  // geometry, so loading driver assets cannot duplicate scenery or fetch props.
  function buildProps(_assets:Map<string,DriverAsset>) {return propsRoot;}
  root.once('destroy',()=>{if(disposed)return;disposed=true;for(const material of materials)material.destroy();for(const texture of textures)texture.destroy();});
  function destroy(){root.destroy();camera.destroy();sun.destroy();}
  return {root,camera,sun,oceanMaterial,boxes,shield,flames,particles,buildProps,destroy};
}
