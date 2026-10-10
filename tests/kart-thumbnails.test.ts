import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseKartThumbnails,loadKartThumbnails} from '../src/kart-thumbnails';
import {clearFoodKartPayloadCache} from '../src/food-kart-payload';
const text=readFileSync('public/models/food-karts/thumbnails.json','utf8');
test('thumbnail index is complete and forbids external/active URLs',()=>{
 assert.equal(parseKartThumbnails(text).size,330);
 for(const value of ['https://example.invalid/pixel','data:image/svg+xml;base64,AAA=','javascript:alert(1)']){const data=JSON.parse(text);data.images[Object.keys(data.images)[0]]=value;assert.throws(()=>parseKartThumbnails(JSON.stringify(data)),/Invalid thumbnail/);}
 const data=JSON.parse(text);delete data.images[Object.keys(data.images)[0]];assert.throws(()=>parseKartThumbnails(JSON.stringify(data)),/Incomplete/);
 assert.throws(()=>parseKartThumbnails(' '.repeat(3*1024*1024+1)),/too large/);
});
test('thumbnail fetch verifies exact manifest identity and downloads no model bundles',async()=>{
 const original=globalThis.fetch,calls:string[]=[];clearFoodKartPayloadCache();
 globalThis.fetch=async input=>{const path=new URL(String(input)).pathname.slice(1);calls.push(path);const data=readFileSync('public/'+path);return new Response(data,{headers:{'content-length':String(data.length)}});};
 try{const values=await loadKartThumbnails();assert.equal(values.size,330);assert.deepEqual(calls,['models/food-karts/manifest.json','models/food-karts/thumbnails.json']);await loadKartThumbnails();assert.equal(calls.length,2);}finally{globalThis.fetch=original;clearFoodKartPayloadCache();}
});
