/** Export original runtime workshop geometry and both real fork choices, without WebGL.
 * node --import tsx scripts/export-workshop-preview.ts OUTPUT_DIR
 * No downloaded models, generated concept art, GPU capture, or gameplay claims.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {deflateSync} from 'node:zlib';
import * as pc from 'playcanvas';
import {WORKSHOP_COURSE, WORKSHOP_TRACK, WORKSHOP_LANDMARKS, WORKSHOP_ROAD_EDGES} from '../src/maps/workshop.ts';
import {buildWorkshopSceneGeometry, WORKSHOP_SCENE_THEME} from '../src/workshop-scenery.ts';
import {landTexturePixels} from '../src/land-scenery.ts';

const output=resolve(process.argv[2] ?? '../land-map-artifacts/workshop');
mkdirSync(output,{recursive:true});
const files=['src/closed-circuit.ts','src/open-road.ts','src/land-track.ts','src/land-routes.ts','src/maps/workshop.ts','src/land-mesh-builder.ts','src/land-road-mesh.ts','src/land-scenery.ts','src/workshop-scenery.ts','src/land-scene.ts','src/land-camera.ts'];
const hash=(buffer:Buffer|string)=>createHash('sha256').update(buffer).digest('hex');
const sourceHashes=Object.fromEntries(files.map(path=>[path,hash(readFileSync(path))]));
const geometry=buildWorkshopSceneGeometry(WORKSHOP_COURSE);
const batches=geometry.batches.map(b=>({...b,normals:pc.calculateNormals(b.positions,b.indices)}));
const textures=Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
const edges=WORKSHOP_ROAD_EDGES.map(edge=>{
  const count=Math.ceil(edge.length/1.5);
  return {id:edge.id,length:edge.length,samples:Array.from({length:count+1},(_,i)=>{
    const s=edge.length*i/count,f=edge.sample(s),w=edge.halfWidthAt(s);
    return {s,p:f.p.toArray(),t:f.t.toArray(),n:f.n.toArray(),halfWidth:w,left:edge.sample(s,-w).p.toArray(),right:edge.sample(s,w).p.toArray()};
  })};
});
const record={
  kind:'offline-native-geometry-render',
  description:'Exact original static runtime workshop mesh positions, triangle indices, computed normals, UVs, material values and procedural texture pixels. Both real fork roads are exported independently. Lighting, shaders and renderer differ from PlayCanvas. No gameplay/GPU capture or frame-rate claim; no driver, vehicle or downloaded asset.',
  sourceHashes,theme:WORKSHOP_SCENE_THEME,geometry:{...geometry,batches},textures,
  route:{label:WORKSHOP_TRACK.label,tag:WORKSHOP_TRACK.tag,canonicalLength:WORKSHOP_COURSE.canonicalLength,
    cabinetLapLength:WORKSHOP_COURSE.commonStart.length+WORKSHOP_COURSE.alternates.alley.length+WORKSHOP_COURSE.commonFinish.length,
    rimLapLength:WORKSHOP_COURSE.canonicalLength,edges,landmarks:WORKSHOP_LANDMARKS,checkpointGates:WORKSHOP_COURSE.checkpointGates},
};
const contentSha256=hash(JSON.stringify({geometry:record.geometry,textures:record.textures,route:record.route,theme:record.theme}));
writeFileSync(join(output,'workshop-geometry.json'),JSON.stringify({...record,contentSha256}));

// GLB is a reusable geometry interchange companion. It retains every source
// vertex/normal/UV/index, rounded only to the same float32 used by GPU buffers.
// Original texture PNG bytes are embedded; glTF's PBR response is approximate.
function crc32(bytes:Buffer){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type:string,bytes:Buffer){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([name,bytes])));return Buffer.concat([len,name,bytes,crc]);}
function png(width:number,height:number,pixels:number[]){
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const scanlines=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)Buffer.from(pixels.slice(y*width*4,(y+1)*width*4)).copy(scanlines,y*(width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
}
const binary:Buffer[]=[],bufferViews:any[]=[],accessors:any[]=[],images:any[]=[],gltfTextures:any[]=[],materials:any[]=[],meshes:any[]=[],nodes:any[]=[];
let byteLength=0;
function view(bytes:Buffer,target?:number){const pad=(4-byteLength%4)%4;if(pad){binary.push(Buffer.alloc(pad));byteLength+=pad;}const index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length,...(target?{target}:{})});binary.push(bytes);byteLength+=bytes.length;return index;}
function accessor(values:number[],type:'VEC3'|'VEC2'|'SCALAR',indices=false){
  const array=indices?new Uint32Array(values):new Float32Array(values),width=type==='VEC3'?3:type==='VEC2'?2:1;
  const item:any={bufferView:view(Buffer.from(array.buffer,array.byteOffset,array.byteLength),indices?34963:34962),componentType:indices?5125:5126,count:values.length/width,type};
  if(type==='VEC3'){item.min=Array.from({length:3},(_,axis)=>values.filter((_,i)=>i%3===axis).reduce((a,b)=>Math.min(a,b),Infinity));item.max=Array.from({length:3},(_,axis)=>values.filter((_,i)=>i%3===axis).reduce((a,b)=>Math.max(a,b),-Infinity));}
  accessors.push(item);return accessors.length-1;
}
const textureIndices=new Map<string,number>();
mkdirSync(join(output,'textures'),{recursive:true});
for(const [name,texture] of Object.entries(textures)){
  const bytes=png(texture.width,texture.height,texture.pixels);writeFileSync(join(output,'textures',name+'.png'),bytes);
  images.push({name:'Original runtime '+name,mimeType:'image/png',bufferView:view(bytes)});
  textureIndices.set(name,gltfTextures.length);gltfTextures.push({sampler:0,source:images.length-1});
}
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
for(const b of batches){
  const hex=b.color.replace('#',''),rgb=[0,2,4].map(i=>linear(parseInt(hex.slice(i,i+2),16)/255));
  materials.push({name:b.name,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:b.metalness,roughnessFactor:b.roughness,...(b.texture!=='none'?{baseColorTexture:{index:textureIndices.get(b.texture)}}:{})},extras:{sourceColor:b.color,sourceTexture:b.texture,sourceRoughness:b.roughness,sourceMetalness:b.metalness}});
  // Runtime UVs are retained unchanged. Coordinate system is the original +Y up.
  meshes.push({name:b.name,primitives:[{attributes:{POSITION:accessor(b.positions,'VEC3'),NORMAL:accessor(b.normals,'VEC3'),TEXCOORD_0:accessor(b.uvs,'VEC2')},indices:accessor(b.indices,'SCALAR',true),material:materials.length-1,mode:4}]});
  nodes.push({name:b.name,mesh:meshes.length-1});
}
const gltf={asset:{version:'2.0',generator:'Original Clockwind Workshop runtime geometry exporter',copyright:'Original project source under AGPL-3.0-only'},scene:0,scenes:[{name:'Clockwind Workshop original static scene',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,textures:gltfTextures,images,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],buffers:[{byteLength}],bufferViews,accessors,extras:{sourceHashes,coordinateSystem:'Metres, +Y up; exact source geometry rounded to float32',materialNotice:'Source values preserved. glTF PBR, texture color management and lighting can differ from PlayCanvas.',route:record.route}};
const json=Buffer.from(JSON.stringify(gltf)),jsonPad=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]),bin=Buffer.concat([...binary,Buffer.alloc((4-byteLength%4)%4)]);
const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonPad.length+8+bin.length,8);jsonHeader.writeUInt32LE(jsonPad.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
writeFileSync(join(output,'workshop-original-scene.glb'),Buffer.concat([header,jsonHeader,jsonPad,binHeader,bin]));
for(const [path,digest] of Object.entries(sourceHashes))if(hash(readFileSync(path))!==digest)throw new Error('Source changed during export: '+path);
console.log(JSON.stringify({batches:batches.length,vertices:batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:batches.reduce((n,b)=>n+b.indices.length/3,0),bounds:geometry.bounds,structures:geometry.structures,landmarks:geometry.landmarks,routeLengths:edges.map(e=>({id:e.id,length:e.length})),glbBytes:12+8+jsonPad.length+8+bin.length}));
