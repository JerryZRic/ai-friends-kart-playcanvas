import assert from 'node:assert/strict';
import {fetchWithRetry, fetchStream, DownloadError, backoffDelay} from '../src/asset-download.js';
const tests=[];
async function test(name,fn){await fn();tests.push(name)}
const noWait=async()=>{};
await test('stream reports actual received bytes rather than synthetic timer percentages',async()=>{
 const old=globalThis.fetch;const progress=[];
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(3));c.enqueue(new Uint8Array(7));c.close()}}),{headers:{'Content-Length':'10'}});
 try{assert.equal((await fetchStream('fixture',{onProgress:v=>progress.push(v)})).byteLength,10);assert.deepEqual(progress.map(v=>v.receivedBytes),[3,10,10]);assert.ok(progress.every(v=>v.totalBytes===10));}finally{globalThis.fetch=old}
});
await test('HTTP content-encoding uses decoded manifest size and unknown totals stay unknown',async()=>{
 const old=globalThis.fetch;
 try{for(const encoded of [true,false]){const progress=[];globalThis.fetch=async()=>new Response(new Uint8Array(20),{headers:encoded?{'Content-Encoding':'gzip','Content-Length':'10'}:{}});await fetchStream('fixture',{decodedBytes:20,onProgress:v=>progress.push(v)});assert.equal(progress[0].totalBytes,encoded?20:null);assert.equal(progress.at(-1).totalBytes,20)}}finally{globalThis.fetch=old}
});
await test('transient failures retry with exponential jitter and visible countdown then succeed',async()=>{
 let calls=0;const delays=[],retry=[];const result=await fetchWithRetry('fixture',{random:()=>.5,wait:async ms=>delays.push(ms),fetchAsset:async()=>{if(++calls<4)throw new TypeError('Network');return new ArrayBuffer(9)},onRetry:v=>retry.push(v)});
 assert.equal(result.byteLength,9);assert.equal(calls,4);assert.equal(delays.reduce((a,b)=>a+b),7000);assert.deepEqual(retry.filter(v=>[1000,2000,4000].includes(v.retryInMs)&&v.retryInMs===1000*2**(v.attempt-1)).map(v=>v.retryInMs),[1000,2000,4000]);assert.ok(backoffDelay(20,()=>1)<=15000);
});
await test('HTTP retry classification excludes permanent 404 and limits attempts on 503',async()=>{
 const old=globalThis.fetch;
 try{for(const [status,expected]of [[404,1],[401,1],[429,4],[503,4]]){let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status})};await assert.rejects(fetchWithRetry('fixture',{wait:noWait}));assert.equal(calls,expected)}}finally{globalThis.fetch=old}
});
await test('stalls abort each attempt, exhaust bounded retries and ignore late progress',async()=>{
 let calls=0,progress=0;const late=[],signals=[];await assert.rejects(fetchWithRetry('fixture',{timeoutMs:5,wait:noWait,fetchAsset:async(p,{signal,onProgress})=>{calls++;signals.push(signal);late.push(onProgress);return new Promise(()=>{})},onProgress:()=>progress++}),/超时/);
 assert.equal(calls,4);assert.ok(signals.every(s=>s.aborted));late.forEach(fn=>fn({receivedBytes:100,totalBytes:100}));assert.equal(progress,0);
});
await test('cancel during transfer or retry wait aborts without starting another request',async()=>{
 for(const stage of ['transfer','wait']){const controller=new AbortController();let calls=0;const promise=fetchWithRetry('fixture',{signal:controller.signal,fetchAsset:async()=>{calls++;if(stage==='wait')throw new DownloadError('HTTP 503',true);return new Promise(()=>{})},onRetry:()=>controller.abort()});if(stage==='transfer')controller.abort();await assert.rejects(promise);assert.equal(calls,1)}
});
await test('ordinary integrity/parse style errors never auto-retry',async()=>{let calls=0;await assert.rejects(fetchWithRetry('fixture',{wait:noWait,fetchAsset:async()=>{calls++;throw new Error('Checksum mismatch')}}),/Checksum/);assert.equal(calls,1)});
console.log(JSON.stringify({status:'passed',suite:'streaming download and bounded retry',tests},null,2));
