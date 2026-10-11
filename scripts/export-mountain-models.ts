/** Write a source-exact GLB from an accepted exported Mountain geometry JSON.
 * node --max-old-space-size=512 --import tsx scripts/export-mountain-models.ts INPUT_DIR OUTPUT_DIR
 * No geometry rebuild, runtime source change, public publication, or network.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {deflateSync} from 'node:zlib';
const input=resolve(process.argv[2]),output=resolve(process.argv[3]??process.argv[2]);mkdirSync(output,{recursive:true});
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const bytes=readFileSync(join(input,'mountain-geometry.json')),geometryFileSha256=hash(bytes),record=JSON.parse(bytes.toString('utf8'));
const batches=record.geometry.batches,textures=record.textures,sourceHashes=record.sourceHashes;
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
  if(type==='VEC3'){item.min=[Infinity,Infinity,Infinity];item.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){const axis=i%3;item.min[axis]=Math.min(item.min[axis],array[i]);item.max[axis]=Math.max(item.max[axis],array[i]);}}
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
const gltf={asset:{version:'2.0',generator:'Original Cloudridge Pass enriched source geometry exporter',copyright:'Original project source under AGPL-3.0-only'},scene:0,scenes:[{name:'Cloudridge Pass enriched original static scene',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,textures:gltfTextures,images,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],buffers:[{byteLength}],bufferViews,accessors,extras:{sourceHashes,coordinateSystem:'Metres, +Y up; exact source geometry rounded to float32',materialNotice:'Source values preserved. glTF PBR, texture color management and lighting can differ from PlayCanvas.',route:record.route}};
const json=Buffer.from(JSON.stringify(gltf)),jsonPad=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]),bin=Buffer.concat([...binary,Buffer.alloc((4-byteLength%4)%4)]);
const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonPad.length+8+bin.length,8);jsonHeader.writeUInt32LE(jsonPad.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
writeFileSync(join(output,'mountain-enriched-source-scene.glb'),Buffer.concat([header,jsonHeader,jsonPad,binHeader,bin]));

// Independent GLB byte readback: every attribute/index retains GPU float32 or
// uint32 bytes, source order and topology. No optimizer may merge vertices.
const file=readFileSync(join(output,'mountain-enriched-source-scene.glb'));
if(file.readUInt32LE(0)!==0x46546c67||file.readUInt32LE(8)!==file.length)throw new Error('Invalid GLB header');
const jl=file.readUInt32LE(12),parsed=JSON.parse(file.subarray(20,20+jl).toString('utf8').trim()),binaryStart=20+jl+8;
const expectedBytes=(values:number[],indices=false)=>{const a=indices?new Uint32Array(values):new Float32Array(values);return Buffer.from(a.buffer,a.byteOffset,a.byteLength);};
let attributesVerified=0;
for(let i=0;i<batches.length;i++){
  const source=batches[i],p=parsed.meshes[i].primitives[0];
  for(const [name,id,values,isIndices] of [
    ['POSITION',p.attributes.POSITION,source.positions,false],['NORMAL',p.attributes.NORMAL,source.normals,false],
    ['TEXCOORD_0',p.attributes.TEXCOORD_0,source.uvs,false],['INDICES',p.indices,source.indices,true],
  ] as [string,number,number[],boolean][]){
    const a=parsed.accessors[id],v=parsed.bufferViews[a.bufferView],want=expectedBytes(values,isIndices),start=binaryStart+v.byteOffset+(a.byteOffset??0);
    if(!file.subarray(start,start+want.length).equals(want))throw new Error('GLB source byte mismatch: '+source.name+' '+name);attributesVerified++;
  }
}
if(hash(readFileSync(join(input,'mountain-geometry.json')))!==geometryFileSha256)throw new Error('Source data changed during model export');
const proof={file:'mountain-enriched-source-scene.glb',sha256:hash(file),byteLength:file.length,geometryFileSha256,geometryContentSha256:record.contentSha256,sourceHashes,
  batches:batches.length,vertices:batches.reduce((n:number,b:any)=>n+b.positions.length/3,0),triangles:batches.reduce((n:number,b:any)=>n+b.indices.length/3,0),attributesVerified,
  coordinateSystem:'Original metres, +Y up',normalNotice:'Original runtime-calculated normals preserved at float32 precision; no re-normal generation or topology simplification.',
  materialNotice:'Original colors, roughness, metalness, UVs and pixel textures. glTF PBR/color management/light response differs from PlayCanvas; not a gameplay capture.',
  reusedProps:record.geometry.reusedProps??[],generatorSha256:hash(readFileSync('scripts/export-mountain-models.ts'))};
writeFileSync(join(output,'mountain-model-provenance.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({file:proof.file,byteLength:proof.byteLength,sha256:proof.sha256,attributesVerified,batches:proof.batches,vertices:proof.vertices,triangles:proof.triangles}));
