import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MAX_IMPORT_BYTES, validateGLB, resolveImportSlot, createLocalDriverStore, parseLocalGLB} from '../src/local-driver-import.js';
import {DRIVERS, raceOrder} from '../src/driver-roster.js';
import {validateDriverContract, createImportedRacer, disposeDriverAsset, DRIVER_CLIPS, WHEEL_CENTER} from '../src/animated-driver.js';
import {encodeGLB, syntheticDriverGLB, localFile, deferred} from './helpers/synthetic-driver.mjs';

const tests=[];
async function test(name, fn) { await fn(); tests.push(name); }
const tick=async()=>{for(let i=0;i<8;i++) await Promise.resolve();};
const minimal=()=>encodeGLB({asset:{version:'2.0'}});
const file=(name='driver.glb', extra={})=>localFile(minimal(),name,extra);
function fixture(options={}) {
  const disposed=[], changes=[], busy=[]; let serial=0;
  const store=createLocalDriverStore({parse:async()=>({serial:++serial}), validate:()=>true, dispose:asset=>disposed.push(asset), onChange:change=>changes.push(change), onBusy:(value,pending)=>busy.push([value,pending]), ...options});
  return {store,disposed,changes,busy};
}
function mutateWord(buffer, offset, value) { const copy=buffer.slice(0);new DataView(copy).setUint32(offset,value,true);return copy; }

await test('six independent stable slots and selected-first race order',()=>{
  const ids=DRIVERS.map(d=>d.id);assert.deepEqual(ids,['whale','gemini','gpt','claude','grok','glm']);
  for(const id of ids){const order=raceOrder(id);assert.equal(order[0].id,id);assert.equal(new Set(order.map(d=>d.id)).size,6);}
  assert.equal(resolveImportSlot('anything.glb','gpt'),'gpt');
  assert.equal(resolveImportSlot('Driver-GEMINI-r1.GLB','gpt',true),'gemini');
  assert.throws(()=>resolveImportSlot('character.glb','gpt',true));
  assert.throws(()=>resolveImportSlot('gpt-claude.glb','gpt',true));
  assert.throws(()=>resolveImportSlot('gpt.glb','unknown',false));
  assert.throws(()=>resolveImportSlot('mygpt.glb','gpt',true));
});
await test('GLB header, type, length, JSON, chunk and version validation',()=>{
  assert.equal(validateGLB(minimal()).asset.version,'2.0');
  for(const bytes of [new Uint8Array(24),new ArrayBuffer(0),new ArrayBuffer(19),new ArrayBuffer(MAX_IMPORT_BYTES+1),mutateWord(minimal(),0,0),mutateWord(minimal(),4,1),mutateWord(minimal(),8,20),mutateWord(minimal(),12,1),mutateWord(minimal(),12,0xfffffff0),mutateWord(minimal(),16,0),encodeGLB({asset:{version:'1.0'}}),encodeGLB(null),encodeGLB([])]) assert.throws(()=>validateGLB(bytes));
  const invalid=minimal();new Uint8Array(invalid)[20]=0xff;assert.throws(()=>validateGLB(invalid),/JSON/);
  const first=new Uint8Array(minimal()), duplicate=new Uint8Array(first.length+(first.length-12));duplicate.set(first);duplicate.set(first.subarray(12),first.length);new DataView(duplicate.buffer).setUint32(8,duplicate.length,true);assert.throws(()=>validateGLB(duplicate.buffer),/duplicate/);
  assert.throws(()=>validateGLB(encodeGLB({asset:{version:'2.0'},buffers:[{byteLength:4}]})),/binary buffer/);
  assert.throws(()=>validateGLB(encodeGLB({asset:{version:'2.0'},buffers:[{byteLength:-1}]})),/buffer length/);
});
await test('all external resource URIs including nested extensions are rejected before parse',async()=>{
  const prohibited=['https://example.invalid/a.png','http://example.invalid/a.bin','//example.invalid/a.bin','../a.bin','/a.bin','file:///tmp/a.bin','blob:untrusted','javascript:bad',''];
  for(const uri of prohibited){
    assert.throws(()=>validateGLB(encodeGLB({asset:{version:'2.0'},extensions:{TEST:{uri}}})),/External resource URI/);
    let parsed=0;const f=fixture({parse:async()=>{parsed++;return {};}});
    await assert.rejects(f.store.importFile(localFile(encodeGLB({asset:{version:'2.0'},images:[{uri}]})),'gpt'));assert.equal(parsed,0);
  }
  assert.throws(()=>validateGLB(encodeGLB({asset:{version:'2.0'},images:[{uri:'data:image/png,raw'}]})),/base64/);
  assert.doesNotThrow(()=>validateGLB(encodeGLB({asset:{version:'2.0'},buffers:[{uri:'data:application/octet-stream;base64,AAAAAA==',byteLength:4}]})));
});
await test('embedded geometry and image bounds reject excessive allocations before parsing',()=>{
  for(const mutate of [g=>{g.nodes=Array(4097).fill({});},g=>{g.accessors[0].count=2000001;},g=>{g.accessors[0].sparse={count:1};},g=>{g.accessors[0].byteOffset=999999;},g=>{g.bufferViews[0].byteLength=999999;},g=>{g.bufferViews[0].byteStride=1;}]) assert.throws(()=>validateGLB(syntheticDriverGLB({mutate})));
  const png=(width,height)=>{const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b;};
  const imageGLB=images=>encodeGLB({asset:{version:'2.0'},images});
  const uri=(bytes,type='png')=>({uri:`data:image/${type};base64,${bytes.toString('base64')}`});
  assert.doesNotThrow(()=>validateGLB(imageGLB([uri(png(1,1))])));
  assert.throws(()=>validateGLB(imageGLB([uri(png(4097,1))])),/4096/);
  assert.throws(()=>validateGLB(imageGLB([uri(png(0,1))])),/4096/);
  assert.throws(()=>validateGLB(imageGLB([uri(Buffer.alloc(24))])),/supported/);
  assert.throws(()=>validateGLB(imageGLB([uri(Buffer.from('<svg></svg>'),'svg+xml')])),/PNG, JPEG or WebP/);
  assert.throws(()=>validateGLB(imageGLB(Array(3).fill(uri(png(4096,4096))))),/pixel limit/);
  assert.throws(()=>validateGLB(imageGLB([{uri:'data:image/png;base64,***'}])),/base64/);
  assert.throws(()=>validateGLB(imageGLB([{mimeType:'image/png',bufferView:99}])),/buffer view/);
});
await test('cancel, unsupported extensions, oversized files, read errors and changed sizes preserve slots',async()=>{
  const f=fixture();await f.store.importFile(file(),'gpt');const existing=f.store.get('gpt');
  assert.deepEqual(await f.store.importFiles([],'gpt'),[]);assert.equal(f.store.get('gpt'),existing);
  let reads=0;
  for(const chosen of [null,file('bad.zip'),file('bad.gltf'),file('driver.glb',{size:0}),file('driver.glb',{size:MAX_IMPORT_BYTES+1})]){
    if(chosen)chosen.arrayBuffer=async()=>{reads++;return minimal();};await assert.rejects(f.store.importFile(chosen,'gpt'));
  }
  assert.equal(reads,0);
  await assert.rejects(f.store.importFile(file('driver.glb',{arrayBuffer:async()=>{throw new Error('read failed');}}),'gpt'),/read failed/);
  await assert.rejects(f.store.importFile(file('driver.glb',{size:20}),'gpt'),/size changed/);
  assert.equal(f.store.get('gpt'),existing);assert.equal(f.disposed.length,0);assert.equal(f.store.busy,false);assert.equal(f.store.pending,0);assert.deepEqual(f.busy.at(-1),[false,0]);
});
await test('single selected-slot import, six-file matching and repeated replacement cleanup',async()=>{
  const f=fixture();await f.store.importFiles([file('unrelated-name.GLB')],'claude');assert.ok(f.store.has('claude'));assert.equal(f.store.has('whale'),false);
  const first=f.store.get('claude');await f.store.importFile(file(),'claude');assert.equal(f.disposed.filter(a=>a===first).length,1);
  const results=await f.store.importFiles(DRIVERS.map(d=>file(`${d.id}-driver.glb`)),'claude');assert.ok(results.every(r=>r.status==='fulfilled'&&r.value.status==='imported'));
  assert.equal(new Set(DRIVERS.map(d=>f.store.get(d.id))).size,6);
  const before=DRIVERS.map(d=>f.store.get(d.id));await f.store.importFile(file(),'gpt');
  for(let i=0;i<DRIVERS.length;i++)if(DRIVERS[i].id!=='gpt')assert.equal(f.store.get(DRIVERS[i].id),before[i]);
  const failed=await f.store.importFiles([file('unknown.glb'),file('gpt-claude.glb')],'gpt');assert.ok(failed.every(r=>r.status==='rejected'));
  f.store.dispose();f.store.dispose();for(const asset of before)assert.equal(f.disposed.filter(a=>a===asset).length,1);
});
await test('parse/validation/onChange failures dispose new resources and preserve prior driver',async()=>{
  let mode='ok', candidate;const disposed=[];
  const f=fixture({parse:async()=>{if(mode==='parse')throw new Error('parse failure');return candidate={mode};},validate:async()=>{if(mode==='validate')throw new Error('rig failure');},dispose:a=>{disposed.push(a);},onChange:({previous})=>{if(previous)assert.ok(!disposed.includes(previous),'controller release precedes resource disposal');if(mode==='commit')throw new Error('commit failure');}});
  await f.store.importFile(file(),'gpt');const existing=f.store.get('gpt');
  for(mode of ['parse','validate','commit']) {await assert.rejects(f.store.importFile(file(),'gpt'));assert.equal(f.store.get('gpt'),existing);assert.ok(!disposed.includes(existing));if(mode!=='parse')assert.equal(disposed.filter(a=>a===candidate).length,1);assert.equal(f.store.busy,false);}
  mode='ok';await f.store.importFile(file(),'gpt');assert.equal(disposed.filter(a=>a===existing).length,1);
});
await test('latest slot intent wins asynchronous reads and parses, with stale resource disposal',async()=>{
  const firstRead=deferred(), f=fixture();const first=f.store.importFile(file('old.glb',{arrayBuffer:()=>firstRead.promise}),'gpt');
  const second=await f.store.importFile(file('new.glb'),'gpt');const committed=f.store.get('gpt');firstRead.resolve(minimal());assert.equal((await first).status,'stale');assert.equal(second.status,'imported');assert.equal(f.store.get('gpt'),committed);
  const oldParse=deferred();let number=0;const g=fixture({parse:()=>++number===1?oldParse.promise:Promise.resolve({fresh:true})});
  const old=g.store.importFile(file(),'gpt');await tick();await g.store.importFile(file(),'gpt');const oldAsset={old:true};oldParse.resolve(oldAsset);assert.equal((await old).status,'stale');assert.deepEqual(g.store.get('gpt'),{fresh:true});assert.deepEqual(g.disposed,[oldAsset]);
});
await test('two-read concurrency cap and stale queued work avoid redundant model reads',async()=>{
  const reads=[], releases=[];let active=0,peak=0;const f=fixture({maxConcurrent:99});
  const promises=DRIVERS.map(d=>f.store.importFile(file(`${d.id}.glb`,{arrayBuffer:async()=>{active++;peak=Math.max(peak,active);reads.push(d.id);const release=deferred();releases.push(release);await release.promise;active--;return minimal();}}),d.id));
  assert.equal(reads.length,2);assert.equal(f.store.pending,6);
  for(let i=0;i<6;i++){assert.ok(releases[i]);releases[i].resolve();await tick();}
  await Promise.all(promises);assert.equal(peak,2);assert.equal(f.store.pending,0);
  const blocker=deferred();let skippedReads=0;const g=fixture({maxConcurrent:1});
  const hold=g.store.importFile(file('hold.glb',{arrayBuffer:()=>blocker.promise}),'whale');
  const old=g.store.importFile(file('old.glb',{arrayBuffer:async()=>{skippedReads++;return minimal();}}),'gpt');
  const fresh=g.store.importFile(file('new.glb'),'gpt');blocker.resolve(minimal());await hold;assert.equal((await old).status,'stale');await fresh;assert.equal(skippedReads,0);
});
await test('import/start race gates both initial read and final commit',async()=>{
  let allowed=false, reads=0;const parse=deferred();const f=fixture({canImport:()=>allowed,parse:()=>parse.promise});
  await assert.rejects(f.store.importFile(file('driver.glb',{arrayBuffer:async()=>{reads++;return minimal();}}),'gpt'),/menu/);assert.equal(reads,0);
  allowed=true;const pending=f.store.importFile(file(),'gpt');await tick();allowed=false;const asset={late:true};parse.resolve(asset);assert.equal((await pending).status,'stale');assert.equal(f.store.has('gpt'),false);assert.deepEqual(f.disposed,[asset]);assert.equal(f.store.busy,false);
});
await test('clear and closed-session disposal invalidate in-flight candidates exactly once',async()=>{
  const pendingParse=deferred();let n=0;const f=fixture({parse:()=>++n===1?Promise.resolve({initial:true}):pendingParse.promise});
  await f.store.importFile(file(),'gpt');const initial=f.store.get('gpt');const pending=f.store.importFile(file(),'gpt');await tick();assert.equal(f.store.clear('gpt'),true);const candidate={late:true};pendingParse.resolve(candidate);assert.equal((await pending).status,'stale');assert.equal(f.store.has('gpt'),false);assert.deepEqual(f.disposed,[initial,candidate]);
  const late=deferred(), g=fixture({parse:()=>late.promise});const work=g.store.importFile(file(),'glm');await tick();g.store.dispose();g.store.dispose();const asset={closed:true};late.resolve(asset);assert.equal((await work).status,'stale');assert.deepEqual(g.disposed,[asset]);await assert.rejects(g.store.importFile(file(),'glm'),/closed/);assert.equal(g.store.busy,false);
});

let compatible;
await test('original synthetic GLB passes actual GLTFLoader and rig contract without network',async()=>{
  const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw new Error('No network is permitted in local-model import tests');};
  try {const bytes=syntheticDriverGLB();validateGLB(bytes);compatible=await parseLocalGLB(bytes);assert.equal(validateDriverContract(compatible),true);await assert.rejects(parseLocalGLB(syntheticDriverGLB({mutate:g=>{g.buffers[0].uri='https://example.invalid/blocked.bin';}})),/external resources/);assert.equal(requests,0);assert.deepEqual(compatible.animations.map(a=>a.name),[...DRIVER_CLIPS]);}
  finally {globalThis.fetch=originalFetch;}
});
await test('incompatible geometry, skins, animation contracts and grip motion fail clearly',async()=>{
  const parser=new GLTFLoader();
  for(const mutate of [
    gltf=>{delete gltf.nodes[5].skin;},
    gltf=>{gltf.animations.pop();},
    gltf=>{gltf.nodes[3].name='NoGrip';},
    gltf=>{gltf.nodes[2].translation=[0,0,0];},
  ]){const asset=await parser.parseAsync(syntheticDriverGLB({mutate}),'');assert.throws(()=>validateDriverContract(asset));disposeDriverAsset(asset);}
  const malformed=await parser.parseAsync(syntheticDriverGLB(),'');let mesh;malformed.scene.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});mesh.geometry.attributes.skinWeight.setX(0,-1);assert.throws(()=>validateDriverContract(malformed),/indices or weights/);disposeDriverAsset(malformed);
  const duration=await parser.parseAsync(syntheticDriverGLB(),'');duration.animations.find(c=>c.name==='SteeringRange').duration=1;assert.throws(()=>validateDriverContract(duration),/two seconds/);disposeDriverAsset(duration);
});
await test('six actor clones keep bones, steering phases, pause, repeated reset and teardown independent',()=>{
  const scene=new THREE.Group(),wheel=new THREE.Group();wheel.name='SteeringPivot';wheel.position.copy(WHEEL_CENTER);scene.add(wheel);
  const chassis={scene};const controllers=DRIVERS.map(slot=>createImportedRacer(compatible,chassis,slot));
  assert.equal(new Set(controllers.map(c=>c.mixer)).size,6);assert.equal(new Set(controllers.map(c=>c.model.getObjectByName('WheelBone'))).size,6);
  for(let i=0;i<controllers.length;i++)controllers[i].update(.2,-1+i*.4);
  assert.equal(new Set(controllers.map(c=>c.getState().steering.toFixed(6))).size,6);
  const states=controllers.map(c=>c.getState());for(const c of controllers)c.update(.5,1,true);assert.deepEqual(controllers.map(c=>c.getState()),states);
  for(let n=0;n<20;n++)for(const c of controllers){c.reset();assert.equal(c.getState().steering,0);assert.equal(c.getState().rangeTime,1);c.update(.1,n%2?1:-1);}
  controllers[0].dispose();controllers[0].dispose();assert.equal(controllers[0].getState().status,'disposed');for(const c of controllers.slice(1))assert.equal(c.getState().status,'ready');for(const c of controllers)c.dispose();
});
await test('asset cleanup disposes shared geometries, materials, textures and image bitmaps once',()=>{
  const counts={geometry:0,material:0,texture:0,image:0};const geometry=new THREE.BoxGeometry(), material=new THREE.MeshBasicMaterial(),texture=new THREE.Texture();
  texture.image={close(){counts.image++;}};texture.addEventListener('dispose',()=>counts.texture++);geometry.addEventListener('dispose',()=>counts.geometry++);material.addEventListener('dispose',()=>counts.material++);material.map=texture;material.alphaMap=texture;
  const scene=new THREE.Group();scene.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));disposeDriverAsset({scene,scenes:[scene]});assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1});disposeDriverAsset(compatible);
});
console.log(JSON.stringify({status:'passed',suite:'client-only local driver import',tests,note:'Real GLTF parsing and CPU animation checks use original in-memory synthetic geometry. No third-party driver, browser, WebGL renderer, network server or upload.'},null,2));
