import {fetchWithRetry} from './asset-download.js';
import {loadFoodKartManifest} from './food-kart-payload';
import {catalog} from './kart-build';
let cached:ReadonlyMap<string,string>|undefined;
export function parseKartThumbnails(text:string):ReadonlyMap<string,string>{
 if(text.length>3*1024*1024)throw new Error('Thumbnail index is too large');
 const data=JSON.parse(text);if(data.schemaVersion!==1||!data.images||Object.keys(data.images).length!==catalog.length)throw new Error('Incomplete thumbnail index');
 const result=new Map<string,string>();for(const part of catalog){const uri=data.images[part.id];if(typeof uri!=='string'||uri.length>60000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(uri))throw new Error('Invalid thumbnail identity');result.set(part.id,uri);}return result;
}
export async function loadKartThumbnails(signal?:AbortSignal):Promise<ReadonlyMap<string,string>>{
 if(cached)return cached;
 const manifest=await loadFoodKartManifest({signal}),record=(manifest as any).thumbnailIndex;
 if(!record||record.path!=='models/food-karts/thumbnails.json'||!Number.isSafeInteger(record.bytes)||record.bytes<1||record.bytes>3*1024*1024||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid thumbnail manifest');
 const base=new URL(import.meta.env?.BASE_URL||'./',globalThis.location?.href||'http://localhost/');
 const buffer=await fetchWithRetry(new URL(record.path,base).href,{signal,expectedBytes:record.bytes,maxAttempts:2} as any);
 if(buffer.byteLength!==record.bytes)throw new Error('Thumbnail index size mismatch');
 const digest=await crypto.subtle.digest('SHA-256',buffer),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==record.sha256)throw new Error('Thumbnail index checksum mismatch');
 if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
 cached=parseKartThumbnails(new TextDecoder().decode(buffer));return cached;
}
