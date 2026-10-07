import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateGLB} from '../src/local-driver-import.js';
import {validateDriverContract, createImportedRacer, disposeDriverAsset, WHEEL_CENTER, WHEEL_AXIS, MAX_WHEEL_ANGLE, DRIVER_CLIPS} from '../src/animated-driver.js';

// These fingerprints identify only the six explicitly published runtime models.
// They contain no source-project location, private link, or account identifier.
const expected = [
  {id:'whale', bytes:13572628, sha256:'50610733ba5a4eb73b47bddb22c96fad2883e7c8f4e56cdd229f6d77318b8703', vertices:154062, triangles:168586, skinnedMeshes:1, bones:31},
  {id:'gemini', bytes:16200556, sha256:'bf5519ce507441012124ae9b0dba542a9f11d434a7ea4da03cdca6ef5ccb11c3', vertices:158314, triangles:280853, skinnedMeshes:3, bones:60},
  {id:'gpt', bytes:13839372, sha256:'c6817f6f72f4ff58a801cd18e3deaef84003f7bbe6b88004bfb734b9da2f2efb', vertices:150285, triangles:208858, skinnedMeshes:1, bones:58},
  {id:'claude', bytes:11241728, sha256:'08ad20d0a29495f49d69c1bd7b9948e5a6ca56148ac41ec342e62c0640a9b523', vertices:97079, triangles:155076, skinnedMeshes:4, bones:56},
  {id:'grok', bytes:14850864, sha256:'382f56fa39cb26e8a243ab0faa8a413062c2416e3fdbb775317ec2f84f400a2c', vertices:152817, triangles:249321, skinnedMeshes:2, bones:57},
  {id:'glm', bytes:16631232, sha256:'ccbea7de68001e680de8e945b955392d28e958db4e02d3f549ecd6b905141e62', vertices:189564, triangles:279463, skinnedMeshes:3, bones:55},
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const arrayHash=attribute=>hash(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
const geometryHash=mesh=>JSON.stringify({attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,attribute])=>[name,arrayHash(attribute)])),index:mesh.geometry.index?arrayHash(mesh.geometry.index):null});
const asArrayBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const loader=new GLTFLoader();
// CPU parsing preserves the actual geometry, skin, clips, and material values.
// Texture pixel decoding is deliberately absent and is not claimed by this test.
loader.register(()=>({name:'CPUTexturePlaceholder',loadTexture:async()=>new THREE.Texture()}));
const originalFetch=globalThis.fetch;let requests=0;
globalThis.fetch=async()=>{requests++;throw new Error('Runtime asset CPU tests must not perform network requests');};
const rows=[],actors=[],assets=[];
try {
  const chassis=await loader.parseAsync(asArrayBuffer(readFileSync('dist/assets/kart-r12-chassis.glb')),'');
  for(const specification of expected){
    const compressed=readFileSync(`dist/assets/drivers/${specification.id}-driver.glb.gz`),bytes=gunzipSync(compressed);
    assert.equal(bytes.length,specification.bytes);assert.equal(hash(bytes),specification.sha256);
    const buffer=asArrayBuffer(bytes);validateGLB(buffer);const asset=await loader.parseAsync(buffer,'');assets.push(asset);assert.equal(validateDriverContract(asset),true);
    const sourceMeshes=[],boneSet=new Set();let vertices=0,triangles=0;
    asset.scene.traverse(node=>{if(node.isSkinnedMesh){sourceMeshes.push(node);vertices+=node.geometry.attributes.position.count;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;for(const bone of node.skeleton.bones)boneSet.add(bone);}});
    assert.equal(sourceMeshes.length,specification.skinnedMeshes);assert.equal(vertices,specification.vertices);assert.equal(triangles,specification.triangles);assert.equal(boneSet.size,specification.bones);
    for(const name of DRIVER_CLIPS)assert.ok(asset.animations.some(clip=>clip.name===name));
    const before=new Map(sourceMeshes.map(mesh=>[mesh.name,geometryHash(mesh)]));
    const actor=createImportedRacer(asset,chassis,{id:specification.id,color:'#d2ff53'});actors.push(actor);
    const meshes=[];actor.model.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node)});
    assert.equal(meshes.length,sourceMeshes.length);
    for(const mesh of meshes){const source=sourceMeshes.find(item=>item.name===mesh.name);assert.equal(mesh.geometry,source.geometry,'Imported geometry must not be simplified');assert.equal(mesh.material,source.material,'Imported material must not be repainted');assert.notEqual(mesh.skeleton,source.skeleton);assert.ok(mesh.skeleton.bones.every(bone=>!boneSet.has(bone)));}
    const grips=['L','R'].map(side=>actor.model.getObjectByName(`Grip${side}`)||actor.model.getObjectByName(`Grip.${side}`));assert.ok(grips.every(Boolean));
    actor.reset();actor.root.updateMatrixWorld(true);const neutral=grips.map(grip=>grip.getWorldPosition(new THREE.Vector3()).sub(WHEEL_CENTER));
    let maximumGripError=0,skinSamples=0;const boneStart=[];
    for(let pose=0;pose<=120;pose++){
      const input=-1+pose/60;actor.update(10,input);actor.root.updateMatrixWorld(true);
      assert.equal(actor.getState().steering,input);assert.ok(Math.abs(actor.getState().rangeTime-(input+1))<1e-12);assert.ok(Math.abs(actor.getState().wheelAngle+input*MAX_WHEEL_ANGLE)<1e-12);
      grips.forEach((grip,index)=>{const expectedPoint=neutral[index].clone().applyAxisAngle(WHEEL_AXIS,-input*MAX_WHEEL_ANGLE).add(WHEEL_CENTER);const actual=grip.getWorldPosition(new THREE.Vector3());assert.ok(actual.toArray().every(Number.isFinite));maximumGripError=Math.max(maximumGripError,actual.distanceTo(expectedPoint));});
      for(const mesh of meshes){mesh.skeleton.update();for(let point=0;point<32;point++){const index=Math.floor(point*(mesh.geometry.attributes.position.count-1)/31);const position=mesh.getVertexPosition(index,new THREE.Vector3());assert.ok(position.toArray().every(Number.isFinite));skinSamples++;}}
      if(pose===0)actor.model.traverse(node=>{if(node.isBone)boneStart.push([node,node.quaternion.clone()])});
    }
    assert.ok(maximumGripError<.002,`${specification.id} authored grip deviation exceeds 2 mm`);
    assert.ok(boneStart.filter(([bone,rotation])=>bone.quaternion.angleTo(rotation)>1e-5).length>0,'Steering must animate authored bones');
    for(const mesh of sourceMeshes)assert.equal(geometryHash(mesh),before.get(mesh.name),'Animation must not modify source topology, UVs or skin weights');
    const paused=actor.getState();actor.update(1,-1,true);assert.deepEqual(actor.getState(),paused);actor.reset();assert.equal(actor.getState().steering,0);assert.equal(actor.getState().rangeTime,1);
    rows.push({id:specification.id,gzipBytes:compressed.length,bytes:bytes.length,vertices,triangles,skinnedMeshes:meshes.length,bones:boneSet.size,poses:121,finiteSkinSamples:skinSamples,maxGripDriftMillimeters:maximumGripError*1000});
  }
  assert.equal(new Set(actors.map(actor=>actor.root)).size,6);assert.equal(new Set(actors.map(actor=>actor.mixer)).size,6);
  actors.forEach((actor,index)=>actor.update(1,-1+index*.4));assert.equal(new Set(actors.map(actor=>actor.getState().steering.toFixed(4))).size,6);assert.equal(requests,0);
} finally {
  for(const actor of actors)actor.dispose();for(const asset of assets)disposeDriverAsset(asset);globalThis.fetch=originalFetch;
}
console.log(JSON.stringify({status:'passed',suite:'six authorized runtime models',assets:rows,note:'Actual public GLB bytes, geometry, skin, animation and material-object preservation checked. Texture objects are CPU placeholders: image decode, rendered appearance, native browser controls and GPU performance remain untested.'},null,2));
