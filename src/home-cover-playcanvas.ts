import * as pc from 'playcanvas';
import type {HomeCoverAdapter,HomeCoverRuntime} from './home-cover';
import {COVER_MAX_FPS,createCoverGrid,deformCoverPoint,coverBlink} from './home-cover-deformation';
import {getCoverRig} from './home-cover-rigs';

async function readImage(url:string,signal:AbortSignal):Promise<HTMLImageElement>{
 const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Portrait texture ${response.status}`);
 const blob=await response.blob();signal.throwIfAborted();
 const objectUrl=URL.createObjectURL(blob),image=new Image();
 try{image.src=objectUrl;await image.decode();signal.throwIfAborted();return image;}
 finally{URL.revokeObjectURL(objectUrl);}
}
/** Custom 2D mesh animation in the project's existing PlayCanvas version, not Live2D/Cubism. */
export const whaleCoverAdapter:HomeCoverAdapter={async mount(canvas,model,signal){
 const rig=getCoverRig(model);if(!rig)throw new Error('Unknown approved portrait');
 const [portrait,eyelids]=await Promise.all([
  readImage(rig.src,signal),rig.blink?readImage(rig.blink.src,signal):Promise.resolve(undefined),
 ]);
 if(portrait.naturalWidth!==rig.width||portrait.naturalHeight!==rig.height||eyelids&&(eyelids.naturalWidth!==rig.blink!.width||eyelids.naturalHeight!==rig.blink!.height))throw new Error('Portrait canvas mismatch');
 signal.throwIfAborted();
 let app:pc.Application|undefined,frame=0,previous=0,time=0,paused=true,disposed=false;
 const textureCache=new Map<HTMLImageElement,pc.Texture>();
 const textures:pc.Texture[]=[],materials:pc.StandardMaterial[]=[];let mesh:pc.Mesh|undefined;const eyeMeshes:pc.Mesh[]=[];
 let observer:ResizeObserver|undefined;
 function dispose(){
  if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();signal.removeEventListener('abort',dispose);
  if(app){const old=app;app=undefined;const gl=old.graphicsDevice as pc.WebglGraphicsDevice;const lose=gl.gl?.getExtension('WEBGL_lose_context');
   if(old.frameRequestId)cancelAnimationFrame(old.frameRequestId);old.frameRequestId=null;
   old.root.destroy();mesh?.destroy();for(const eyeMesh of eyeMeshes)eyeMesh.destroy();for(const material of materials)material.destroy();for(const texture of textures)texture.destroy();old.destroy();lose?.loseContext();}
  canvas.dataset.animationState='disposed';
 }
 try{
  app=new pc.Application(canvas,{graphicsDeviceOptions:{alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false}});
  app.setCanvasFillMode(pc.FILLMODE_NONE);app.autoRender=false;
  const camera=new pc.Entity('Portrait orthographic camera',app);
  camera.addComponent('camera',{projection:pc.PROJECTION_ORTHOGRAPHIC,clearColor:new pc.Color(0,0,0,0),nearClip:.1,farClip:10,gammaCorrection:pc.GAMMA_SRGB,toneMapping:pc.TONEMAP_NONE});
  app.root.addChild(camera);
  const grid=createCoverGrid(40,46,rig),positions=new Float32Array(grid.points.length/2*3);
  function updateMesh(){
   for(let i=0;i<grid.points.length;i+=2){const [x,y]=deformCoverPoint(grid.points[i],grid.points[i+1],time,rig),j=i/2*3;positions[j]=(x-rig.width/2)/1000;positions[j+1]=-y/1000;positions[j+2]=0;}
   mesh!.setPositions(positions);mesh!.update(pc.PRIMITIVE_TRIANGLES);
  }
  mesh=new pc.Mesh(app.graphicsDevice);mesh.clear(true,false);mesh.setUvs(0,grid.uvs);mesh.setIndices(grid.indices);updateMesh();
  function addLayer(image:HTMLImageElement,z:number,geometry=mesh!,feather=false){
   // HTML image rows start at the top; UVs use 1-y. PlayCanvas defaults flipY to false.
   // Explicit upload flipping keeps both original art and local eye patches upright.
   let texture=textureCache.get(image);if(!texture){texture=new pc.Texture(app!.graphicsDevice,{flipY:true,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});texture.setSource(image);textures.push(texture);textureCache.set(image,texture);}
   const material=new pc.StandardMaterial();material.useLighting=false;material.diffuse.set(0,0,0);material.emissive.set(1,1,1);material.emissiveMap=texture;material.opacityMap=texture;material.opacityMapChannel='a';material.opacityVertexColor=feather;material.opacityVertexColorChannel='a';material.blendType=pc.BLEND_NORMAL;material.depthWrite=false;material.cull=pc.CULLFACE_NONE;material.update();materials.push(material);
   const entity=new pc.Entity('Portrait texture layer',app!);entity.setLocalPosition(0,0,z);entity.addComponent('render',{meshInstances:[new pc.MeshInstance(geometry,material)]});app!.root.addChild(entity);return material;
  }
  addLayer(portrait,0);
  // Two local patches only. UV V uses the generated texture's 1332px height;
  // source geometry stays on the approved 1331px canvas (no image rescale).
  const eyes:pc.StandardMaterial[]=[];
  for(const [left,top,right,bottom] of rig.blink?.patches??[]){
   const p:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],segments=16;
   for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
    const x=left+(right-left)*col/segments,y=top+(bottom-top)*row/segments;
    p.push((x-rig.width/2)/1000,-y/1000,0);uv.push(x/rig.blink!.width,1-y/rig.blink!.height);
    const feather=Math.min(1,(x-left)/rig.blink!.feather,(right-x)/rig.blink!.feather,(y-top)/rig.blink!.feather,(bottom-y)/rig.blink!.feather);
    colors.push(1,1,1,Math.max(0,feather));
   }
   for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){const i=row*(segments+1)+col;indices.push(i,i+segments+1,i+1,i+1,i+segments+1,i+segments+2);}
   const geometry=new pc.Mesh(app.graphicsDevice);geometry.setPositions(p);geometry.setUvs(0,uv);geometry.setColors(colors);geometry.setIndices(indices);geometry.update();eyeMeshes.push(geometry);
   const material=addLayer(eyelids!,.001,geometry,true);material.opacity=0;material.update();eyes.push(material);
  }
  function resize(){
   if(!app||disposed)return;
   const rect=(canvas.parentElement??canvas).getBoundingClientRect();
   const aspect=rect.width>0&&rect.height>0?rect.width/rect.height:480/576;
   // At most ~0.7MP and 24fps beside the existing live menu scenery. CSS owns layout.
   const ratio=Math.min(devicePixelRatio||1,1.5),width=Math.max(1,Math.min(768,Math.round((rect.width||480)*ratio))),height=Math.max(1,Math.round(width/aspect));
   app.setCanvasResolution(pc.RESOLUTION_FIXED,width,height);canvas.style.width='100%';canvas.style.height='100%';
   const viewHeight=Math.max(rig.height,rig.width/aspect)/1000;
   camera.camera!.orthoHeight=viewHeight/2;camera.setPosition(0,-viewHeight/2,5);
   app.render();
  }
  let eyesClosed=false;
  function draw(now:number){
   frame=0;if(!app||disposed||paused)return;
   if(previous&&now-previous<1000/COVER_MAX_FPS-.5){frame=requestAnimationFrame(draw);return;}
   time+=previous?Math.min((now-previous)/1000,.1):0;previous=now;
   try{updateMesh();const close=coverBlink(time)>.35;if(close!==eyesClosed){eyesClosed=close;for(const eye of eyes){eye.opacity=close?1:0;eye.update();}}app.update(0);app.render();canvas.dataset.animationTime=time.toFixed(2);}
   catch{canvas.dispatchEvent(new Event('webglcontextlost'));dispose();return;}
   frame=requestAnimationFrame(draw);
  }
  const runtime:HomeCoverRuntime={resize,dispose,setPaused(value){
   if(disposed)return;paused=value;canvas.dataset.animationState=value?'paused':'running';
   if(value){if(frame)cancelAnimationFrame(frame);frame=0;previous=0;}else if(!frame)frame=requestAnimationFrame(draw);
  }};
  signal.addEventListener('abort',dispose,{once:true});
  app.start();if(app.frameRequestId)cancelAnimationFrame(app.frameRequestId);app.frameRequestId=null;
  resize();
  observer=new ResizeObserver(resize);observer.observe(canvas.parentElement??canvas);
  canvas.dataset.animationKind='playcanvas-custom-2d';canvas.dataset.animationModel=model;canvas.dataset.meshVertices=String(positions.length/3);
  return runtime;
 }catch(error){dispose();throw error;}
}};
