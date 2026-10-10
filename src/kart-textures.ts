import * as pc from 'playcanvas';
import type {DriverAsset} from './assets';

const MAPS = ['diffuseMap','normalMap','glossMap','metalnessMap','aoMap','emissiveMap','opacityMap','specularMap','heightMap','lightMap','clearCoatMap','clearCoatGlossMap','clearCoatNormalMap','sheenMap','sheenGlossMap','thicknessMap','iridescenceMap','iridescenceThicknessMap','specularityFactorMap','refractionMap'] as const;
type Entry = {asset: pc.Asset; references: number; pixels: number};
/** Containers borrow textures from one app-local pool. A parsed part is adopted
 * before instantiation, so material replacement never mutates an active actor.
 * Exact pixels, color format and sampler state form the key; no resizing occurs.
 */
export function createKartTexturePool() {
  const pool = new Map<string, Entry>();
  const owned = new WeakMap<DriverAsset, string[]>();
  let containers = 0;
  const destroy = (asset: pc.Asset) => {const registry=asset.registry;asset.unload();registry?.remove(asset);};
  async function adopt(asset: DriverAsset, buffer: ArrayBuffer) {
    if (owned.has(asset)) return;
    const resource=asset.resource as any, textures=resource.textures as pc.Asset[];
    if (!Array.isArray(textures)) throw new Error('Kart texture ownership is unavailable');
    const metadata=asset.metadata, view=new DataView(buffer);
    let binaryStart=-1;
    for(let offset=12;offset<buffer.byteLength;offset+=8+view.getUint32(offset,true))if(view.getUint32(offset+4,true)===0x004e4942){binaryStart=offset+8;break;}
    if(binaryStart<0&&textures.length)throw new Error('Kart texture bytes are missing');
    // Hash everything before changing ownership: failures leave normal parser
    // cleanup intact, including aborts while a parser is settling.
    const hashes=await Promise.all((metadata.images||[]).map(async image=>{
      const range=metadata.bufferViews?.[image.bufferView];
      if(!range||image.uri)throw new Error('Kart textures must be embedded image ranges');
      const bytes=new Uint8Array(buffer,binaryStart+(range.byteOffset||0),range.byteLength);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    }));
    const planned=textures.map((textureAsset,index)=>{
      const texture=textureAsset.resource as pc.Texture, descriptor=metadata.textures?.[index];
      const imageHash=hashes[descriptor?.source];
      if(!imageHash||!texture)throw new Error('Kart texture cannot be matched to source pixels');
      const key=[imageHash,texture.format,texture.type,texture.minFilter,texture.magFilter,texture.addressU,texture.addressV,texture.anisotropy,texture.flipY,texture.premultiplyAlpha].join(':');
      return {textureAsset,texture,key};
    });
    const keys:string[]=[], replacements=new Map<pc.Texture,pc.Texture>(), redundant=new Set<pc.Asset>();
    for(const item of planned){
      let entry=pool.get(item.key);
      if(!entry){entry={asset:item.textureAsset,references:0,pixels:item.texture.width*item.texture.height};pool.set(item.key,entry);}
      entry.references++;keys.push(item.key);
      if(entry.asset!==item.textureAsset){replacements.set(item.texture,entry.asset.resource as pc.Texture);redundant.add(item.textureAsset);}
    }
    for(const materialAsset of resource.materials||[]){
      const material=materialAsset.resource as pc.StandardMaterial;
      for(const property of MAPS){const current=(material as any)[property];if(replacements.has(current))(material as any)[property]=replacements.get(current);}
      material.update();
    }
    // GlbContainerResource.destroy normally unloads every image. The pool now
    // owns those images until the final borrowing container has been released.
    resource.textures=[];
    if(resource.data)resource.data.textures=planned.map(item=>pool.get(item.key)!.asset);
    for(const duplicate of redundant)destroy(duplicate);
    owned.set(asset,keys);containers++;
  }
  function release(asset: DriverAsset){
    const keys=owned.get(asset);if(!keys)return;owned.delete(asset);containers--;
    for(const key of keys){const entry=pool.get(key);if(entry&&--entry.references===0){pool.delete(key);destroy(entry.asset);}}
  }
  return {adopt,release,stats:()=>({textures:pool.size,containers,pixels:[...pool.values()].reduce((n,e)=>n+e.pixels,0),estimatedRgbaMipBytes:Math.ceil([...pool.values()].reduce((n,e)=>n+e.pixels,0)*4*4/3)})};
}
