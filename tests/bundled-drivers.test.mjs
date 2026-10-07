import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {loadBundledDrivers, decodeRuntimeBuffer, RUNTIME_MODELS} from '../src/bundled-drivers.js';
import {deferred} from './helpers/synthetic-driver.mjs';

const tests=[];
async function test(name,fn){await fn();tests.push(name)}
const buffers=new Map(RUNTIME_MODELS.map(record=>{const bytes=readFileSync('dist/'+record.path);return [record.path,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)];}));
const decodedBuffers=new Map([...buffers].map(([path,bytes])=>{const value=gunzipSync(new Uint8Array(bytes));return [path,value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)];}));
const bySize=new Map(RUNTIME_MODELS.map(record=>[record.decodedBytes,record.id]));
const fetchAsset=async path=>buffers.get(path);
const parse=async buffer=>({id:bySize.get(buffer.byteLength)});
const validate=()=>true;
const waitFor=async condition=>{for(let i=0;i<2000;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,1));}throw new Error('Test condition did not settle');};

await test('exact six public manifest entries load and progress settles only after every result',async()=>{
  assert.deepEqual(RUNTIME_MODELS.map(record=>record.id),['whale','gemini','gpt','claude','grok','glm']);
  for(const record of RUNTIME_MODELS){assert.match(record.path,/^assets\/drivers\/(?:whale|gemini|gpt|claude|grok|glm)-driver\.glb\.gz$/);assert.match(record.sha256,/^[0-9a-f]{64}$/);assert.ok(record.bytes>0);}
  const progress=[];const result=await loadBundledDrivers({fetchAsset,parse,validate,onProgress:value=>progress.push(value)});
  assert.equal(result.drivers.size,6);assert.equal(result.failures.size,0);assert.deepEqual(progress.map(value=>value.completed),[1,2,3,4,5,6]);assert.equal(progress.at(-1).loaded,6);assert.equal(progress.at(-1).total,6);
  for(const [id,asset] of result.drivers)assert.equal(asset.id,id);
});
await test('lossless gzip and HTTP-already-decoded GLB transport produce identical verified data',async()=>{
  for(const record of RUNTIME_MODELS){
    const decoded=await decodeRuntimeBuffer(buffers.get(record.path),record);assert.deepEqual(new Uint8Array(decoded),new Uint8Array(decodedBuffers.get(record.path)));
    const alreadyDecoded=await decodeRuntimeBuffer(decodedBuffers.get(record.path),record);assert.deepEqual(new Uint8Array(alreadyDecoded),new Uint8Array(decoded));
  }
  const result=await loadBundledDrivers({fetchAsset:async path=>decodedBuffers.get(path),parse,validate});assert.equal(result.drivers.size,6);assert.equal(result.failures.size,0);
});
await test('malformed gzip and altered decoded GLB fail without parsing or returning unsafe bytes',async()=>{
  const record=RUNTIME_MODELS[0],bad=Uint8Array.from([31,139,8,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0]).buffer;
  const sha256=createHash('sha256').update(new Uint8Array(bad)).digest('hex');await assert.rejects(decodeRuntimeBuffer(bad,{...record,bytes:bad.byteLength,sha256}));
  const altered=decodedBuffers.get(record.path).slice(0);new Uint8Array(altered)[30]^=1;await assert.rejects(decodeRuntimeBuffer(altered,record),/checksum/);
});
await test('model fetching/parsing is capped at two tasks even with a larger requested limit',async()=>{
  let active=0,peak=0;const gates=[];
  const pending=loadBundledDrivers({maxConcurrent:99,parse,validate,fetchAsset:async path=>{active++;peak=Math.max(peak,active);const gate=deferred();gates.push(gate);await gate.promise;active--;return buffers.get(path);}});
  await waitFor(()=>gates.length===2);assert.equal(active,2);
  for(let i=0;i<6;i++){await waitFor(()=>!!gates[i]);gates[i].resolve();}
  const result=await pending;assert.equal(peak,2);assert.equal(result.drivers.size,6);
});
await test('bad size or checksum never reaches parser and other five models still succeed',async()=>{
  for(const mode of ['size','checksum']){
    let parsed=0;const record=RUNTIME_MODELS.find(item=>item.id==='gpt');
    const result=await loadBundledDrivers({fetchAsset:async path=>{const original=buffers.get(path);if(path!==record.path)return original;if(mode==='size')return original.slice(0,-4);const bytes=original.slice(0);new Uint8Array(bytes)[30]^=1;return bytes;},parse:async buffer=>{parsed++;return parse(buffer);},validate});
    assert.equal(parsed,5);assert.equal(result.drivers.size,5);assert.deepEqual([...result.failures.keys()],['gpt']);assert.match(result.failures.get('gpt'),mode==='size'?/size/:/checksum/);
  }
});
await test('network and parse failures stay slot-specific and never silently replace a model',async()=>{
  const calls=new Map();const result=await loadBundledDrivers({fetchAsset:async path=>{calls.set(path,(calls.get(path)||0)+1);if(path.includes('gemini'))throw new Error('HTTP 404');return buffers.get(path);},parse:async buffer=>{if(bySize.get(buffer.byteLength)==='claude')throw new Error('Invalid scene');return parse(buffer);},validate});
  assert.equal(result.drivers.size,4);assert.equal(result.failures.size,2);assert.match(result.failures.get('gemini'),/404/);assert.match(result.failures.get('claude'),/Invalid scene/);assert.ok([...calls.values()].every(count=>count===1),'No unlimited or hidden automatic retries');
});
await test('failed rig validation releases parsed geometry/material resources',async()=>{
  let geometryDisposals=0,materialDisposals=0;
  const result=await loadBundledDrivers({fetchAsset,parse:async buffer=>{const id=bySize.get(buffer.byteLength);if(id!=='glm')return {id};const scene=new THREE.Group(),geometry=new THREE.BufferGeometry(),material=new THREE.MeshBasicMaterial();geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);scene.add(new THREE.Mesh(geometry,material));return {id,scene};},validate:asset=>{if(asset.id==='glm')throw new Error('Incompatible rig');}});
  assert.equal(result.drivers.size,5);assert.equal(result.failures.size,1);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
});
await test('stalled downloads time out, abort, settle all six and leave explicit failure results',async()=>{
  const signals=[],late=[];let attempts=0,parses=0;
  const pending=loadBundledDrivers({timeoutMs:15,maxAttempts:1,parse:async buffer=>{parses++;return parse(buffer)},validate,fetchAsset:async(path,{signal})=>{attempts++;signals.push(signal);const delayed=deferred();late.push([path,delayed]);return delayed.promise;}});
  let watchdog;const result=await Promise.race([pending,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(new Error('Unbounded model download blocked readiness')),1500);})]).finally(()=>clearTimeout(watchdog));
  assert.equal(attempts,6);assert.equal(result.drivers.size,0);assert.equal(result.failures.size,6);assert.ok(signals.every(signal=>signal.aborted));for(const [path,delayed]of late)delayed.resolve(buffers.get(path));await new Promise(resolve=>setTimeout(resolve,5));assert.equal(parses,0);assert.equal(result.drivers.size,0);
});
await test('default download route is read-only same-origin paths, omits credentials and rejects redirects',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(path,options)=>{calls.push([path,options]);assert.ok(buffers.has(path));return {ok:true,status:200,arrayBuffer:async()=>buffers.get(path)};};
  try{const result=await loadBundledDrivers({parse,validate});assert.equal(result.drivers.size,6);for(const [path,options]of calls){assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);assert.ok(!options.method||options.method==='GET');assert.ok(options.signal instanceof AbortSignal);}}
  finally{globalThis.fetch=original;}
});
await test('status measures stream bytes and separates decompression/preparation; manual retry keeps successful assets',async()=>{
  const first=RUNTIME_MODELS[0];const retained=new Map(RUNTIME_MODELS.slice(1).map(r=>[r.id,{id:r.id}]));const statuses=[],calls=[];
  const result=await loadBundledDrivers({existingDrivers:retained,parse,validate,onStatus:v=>statuses.push(v),fetchAsset:async(path,{onProgress})=>{calls.push(path);onProgress({receivedBytes:123,totalBytes:first.bytes});return buffers.get(path)}});
  assert.deepEqual(calls,[first.path]);assert.equal(result.drivers.size,6);assert.equal(result.drivers.get('gemini'),retained.get('gemini'));
  const phases=statuses.map(v=>v.records[0].stage);for(const phase of ['downloading','decompressing','preparing','ready'])assert.ok(phases.includes(phase));
  assert.ok(statuses.some(v=>v.records[0].receivedBytes===123));assert.equal(statuses.at(-1).completed,6);assert.equal(statuses.at(-1).receivedBytes,statuses.at(-1).totalBytes);
});
await test('transient slot retry resets partial attempt bytes and has finite status countdown',async()=>{
  const retained=new Map(RUNTIME_MODELS.slice(1).map(r=>[r.id,{id:r.id}]));const statuses=[];let calls=0;
  const result=await loadBundledDrivers({existingDrivers:retained,parse,validate,wait:async()=>{},random:()=>.5,onStatus:v=>statuses.push(v),fetchAsset:async(path,{onProgress})=>{calls++;onProgress({receivedBytes:30,totalBytes:RUNTIME_MODELS[0].bytes});if(calls===1)throw new TypeError('Interrupted');return buffers.get(path)}});
  assert.equal(result.drivers.size,6);assert.equal(calls,2);assert.ok(statuses.some(v=>v.records[0].stage==='waiting'&&v.records[0].retryInMs===1000));assert.ok(statuses.some(v=>v.records[0].attempt===2&&v.records[0].receivedBytes===0));
});
await test('manual retry preserves decoded transport byte basis for cached successful models',async()=>{
  const loaded=await loadBundledDrivers({fetchAsset:async path=>decodedBuffers.get(path),parse,validate});const snapshots=[];
  const again=await loadBundledDrivers({existingDrivers:loaded.drivers,onStatus:v=>snapshots.push(v),fetchAsset:()=>{throw new Error('Should not fetch cached asset')}});
  assert.equal(again.drivers.size,6);assert.equal(snapshots[0].totalBytes,RUNTIME_MODELS.reduce((sum,r)=>sum+r.decodedBytes,0));assert.equal(snapshots[0].receivedBytes,snapshots[0].totalBytes);
});
console.log(JSON.stringify({status:'passed',suite:'automatic public model loader',tests,note:'Real authorized file bytes and SHA256 verification; mocked fetch/parse for lifecycle tests. No network requests, local server, browser or GPU.'},null,2));
