import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {parseLocalGLB,disposeDriverAsset,type DriverAsset} from '../src/assets';
import {createKartTexturePool} from '../src/kart-textures';
import {foodKartManifest as manifest, foodKartFixtureBytes as payload} from './helpers/food-kart-fixture';

function headlessApp(){
 const canvas={id:'kart-textures',width:1,height:1,addEventListener(){},removeEventListener(){}} as any;
 const device=new pc.NullGraphicsDevice(canvas),app=new pc.AppBase(canvas),options=new pc.AppOptions();
 options.graphicsDevice=device;options.componentSystems=[pc.RenderComponentSystem];options.resourceHandlers=[pc.ContainerHandler,pc.RenderHandler,pc.MaterialHandler,pc.TextureHandler];options.devtools=false;app.init(options);
 app.assets.on('add',(asset:pc.Asset)=>{if(asset.type==='container')(asset.options as any).image={processAsync(_image,done){const texture=new pc.Asset('texture-pool-fixture','texture');texture.resource=new pc.Texture(device,{width:1,height:1});texture.loaded=true;app.assets.add(texture);done(null,texture);}};});return app;
}

test('same source pixels share real PlayCanvas textures across containers until final release',async()=>{
 const app=headlessApp(),pool=createKartTexturePool(),record=manifest.parts.find(p=>p.moduleId==='02_ChassisSuspension'&&p.images.length>0),bytes=payload(record);
 const a=await parseLocalGLB(app,bytes),b=await parseLocalGLB(app,bytes);let extra:DriverAsset|undefined;
 try{
  const originalA=(a.resource as any).textures.map((asset:pc.Asset)=>asset.resource), originalB=(b.resource as any).textures.map((asset:pc.Asset)=>asset.resource);
  assert.ok(originalA.length>0);assert.notEqual(originalA[0],originalB[0]);
  await pool.adopt(a,bytes);const once=pool.stats();await pool.adopt(b,bytes);
  assert.equal(pool.stats().textures,once.textures);assert.equal(pool.stats().containers,2);
  assert.deepEqual((a.resource as any).textures,[],'container no longer owns borrowed images');
  const am=(a.resource as any).materials.map(asset=>asset.resource),bm=(b.resource as any).materials.map(asset=>asset.resource);
  for(let i=0;i<am.length;i++)for(const key of ['diffuseMap','normalMap','glossMap','metalnessMap'])if(am[i][key])assert.equal(am[i][key],bm[i][key],`${key} is shared without material cloning`);
  const canonical=am.flatMap(m=>[m.diffuseMap,m.normalMap,m.glossMap]).filter(Boolean) as pc.Texture[];
  let destroyed=0;for(const texture of new Set(canonical)){const destroy=texture.destroy.bind(texture);texture.destroy=()=>{destroyed++;destroy();};}
  pool.release(a);disposeDriverAsset(a);assert.equal(destroyed,0,'sibling keeps texture alive');assert.equal(pool.stats().containers,1);
  extra=await parseLocalGLB(app,bytes);await pool.adopt(extra,bytes);assert.equal(pool.stats().textures,once.textures);
  pool.release(b);disposeDriverAsset(b);assert.equal(destroyed,0,'third container remains valid');
  pool.release(extra);disposeDriverAsset(extra);assert.ok(destroyed>0);assert.deepEqual(pool.stats(),{textures:0,containers:0,pixels:0,estimatedRgbaMipBytes:0});
  pool.release(extra);assert.equal(pool.stats().containers,0,'release is idempotent');
 }finally{for(const asset of [a,b,extra].filter(Boolean) as DriverAsset[]){pool.release(asset);disposeDriverAsset(asset);}app.destroy();}
});

test('different images retain separate textures and malformed adoption leaves normal ownership',async()=>{
 const app=headlessApp(),pool=createKartTexturePool(),records=[manifest.parts.find(p=>p.kitNumber==='001'&&p.moduleId==='01_BodyShell'),manifest.parts.find(p=>p.kitNumber==='054'&&p.moduleId==='01_BodyShell')],assets:DriverAsset[]=[];
 try{
  for(const record of records){const bytes=payload(record),asset=await parseLocalGLB(app,bytes);assets.push(asset);await pool.adopt(asset,bytes);}
  const count=pool.stats().textures;assert.ok(count>records[0].images.length);
  const bytes=payload(records[0]),invalid=await parseLocalGLB(app,bytes);assets.push(invalid);invalid.metadata={...invalid.metadata,images:[{uri:'bad'}]};
  const textures=(invalid.resource as any).textures;await assert.rejects(pool.adopt(invalid,bytes),/embedded image ranges/);assert.equal((invalid.resource as any).textures,textures);assert.equal(pool.stats().textures,count);
 }finally{for(const asset of assets){pool.release(asset);disposeDriverAsset(asset);}assert.equal(pool.stats().textures,0);app.destroy();}
});


test('vertex-color rice modules need no textures and release cleanly through the same pool', async()=>{
 const app=headlessApp(),pool=createKartTexturePool(),record=manifest.parts.find(p=>p.kitNumber==='000'&&p.moduleId==='02_ChassisSuspension'),bytes=payload(record);
 const asset=await parseLocalGLB(app,bytes);
 try {await pool.adopt(asset,bytes);assert.equal(pool.stats().textures,0);assert.equal(pool.stats().pixels,0);assert.ok((asset.resource as any).materials.every(material=>material.resource.diffuseVertexColor));pool.release(asset);assert.equal(pool.stats().containers,0);}
 finally {pool.release(asset);disposeDriverAsset(asset);app.destroy();}
});
