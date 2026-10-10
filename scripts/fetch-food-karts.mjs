// Restore the separately served original food asset delivery after source.zip extraction.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyFoodKartAssets} from './verify-food-kart-assets.mjs';
const manifest=JSON.parse(await readFile('public/models/food-karts/manifest.json','utf8'));
const base=new URL('https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/');
const records=new Map();
for(const kit of manifest.kits){
 if(!kit.bundlePath||!kit.bundleSha256)throw new Error('Incomplete food bundle manifest');
 records.set(kit.bundlePath,{path:kit.bundlePath,bytes:kit.bundleBytes,sha256:kit.bundleSha256});
}
if(!manifest.thumbnailIndex)throw new Error('Missing thumbnail index');
records.set(manifest.thumbnailIndex.path,manifest.thumbnailIndex);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let next=0,completed=0;const files=[...records.values()];
await Promise.all(Array.from({length:4},async()=>{
 while(next<files.length){
  const record=files[next++];
  if(!/^models\/food-karts\/(?:bundles\/[a-zA-Z0-9_-]+\.zip|thumbnails\.json)$/.test(record.path)||record.path.includes('..'))throw new Error('Unsafe food asset path');
  const destination='public/'+record.path;
  const valid=bytes=>record.sha256?bytes.length===record.bytes&&hash(bytes)===record.sha256:bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  const existing=await readFile(destination).catch(()=>null);
  if(!existing||!valid(existing)){
   const response=await fetch(new URL(record.path,base),{redirect:'error',signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw new Error(`${record.path}: HTTP ${response.status}`);
   const bytes=Buffer.from(await response.arrayBuffer());if(!valid(bytes))throw new Error('Food asset integrity failed: '+record.path);
   await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);
  }
  completed++;if(completed%100===0)console.log(`${completed}/${files.length} food asset files verified`);
 }
}));
console.log(JSON.stringify(verifyFoodKartAssets(),null,2));
