const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler,isLocal,CSP}=require('./protocol.cjs');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const gameSource=path.resolve(process.argv[2] || path.join(__dirname,'../source'));
const root=path.join(gameSource,'dist');
const handler=createHandler(root);
test('entry, modules, CSS and legal files have correct paths and headers',async()=>{
 for(const name of ['index.html','coast.html','waterpark.html','source.html','LICENSE','source.zip',...fs.readdirSync(path.join(root,'assets')).filter(x=>/\.(js|css)$/.test(x)).map(x=>'assets/'+x)]) {
  const r=await handler({url:'kart://game/'+name,method:'GET'}); assert.equal(r.status,200,name); assert.equal(r.headers.get('Content-Security-Policy'),CSP); assert.equal(Buffer.from(await r.arrayBuffer()).length,fs.statSync(path.join(root,name)).size);
 }
});
test('twelve gzip driver and portrait models delivered unchanged and decode to authorized hashes',async()=>{
 const manifest={assets:['runtime-models.json','portrait-models.json'].flatMap(name=>JSON.parse(fs.readFileSync(path.join(gameSource,'docs',name))).assets)};
 for(const a of manifest.assets){const r=await handler({url:'kart://game/'+a.path,method:'GET'});assert.equal(r.status,200);assert.equal(r.headers.get('Content-Encoding'),null);const b=Buffer.from(await r.arrayBuffer());assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(crypto.createHash('sha256').update(zlib.gunzipSync(b)).digest('hex'),a.decodedSha256);}
});
test('external hosts, traversal, methods and missing files blocked',async()=>{
 for(const u of ['https://example.com/','kart://evil/index.html','kart://game:123/index.html','kart://user@game/index.html','kart://game/..%2f..%2fpackage.json','kart://game/%5c..%5cpackage.json','kart://game/missing.js'])assert.notEqual((await handler({url:u,method:'GET'})).status,200,u);
 assert.equal((await handler({url:'kart://game/',method:'POST'})).status,405);
 assert.equal((await handler({url:'kart://game/',method:'HEAD'})).status,200);
 assert(isLocal('kart://game/source.html')); assert(!isLocal('file:///tmp/example'));
});

test('every packaged runtime file is reachable locally with correct WebP MIME',async()=>{
 function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);}
 for(const name of files(root)){const r=await handler({url:'kart://game/'+name,method:'GET'});assert.equal(r.status,200,name);assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),name);if(name.endsWith('.webp'))assert.equal(r.headers.get('content-type'),'image/webp');}
});

test('CSP permits exact bundled inline recovery script without unsafe script policy',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');let count=0;
 for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){count++;const hash=crypto.createHash('sha256').update(script).digest('base64');assert(CSP.includes("'sha256-"+hash+"'"));}
 assert.equal(count,1);const policy=CSP.split(';').find(s=>s.trim().startsWith('script-src'));assert(!policy.includes('unsafe-inline'));assert(!policy.includes('unsafe-eval'));
});

test('garage page, every food bundle and source ZIP use exact MIME without transport decoding',async()=>{
 const food=JSON.parse(fs.readFileSync(path.join(root,'models/food-karts/manifest.json')));
 assert.equal(food.kits.length,55);
 assert.equal(food.parts.length,330);
 const garage=await handler({url:'kart://game/garage.html',method:'GET'});
 assert.equal(garage.status,200);assert.equal(garage.headers.get('content-type'),'text/html; charset=utf-8');
 for(const name of ['source.zip',...food.kits.map(k=>k.bundlePath)]){
  const r=await handler({url:'kart://game/'+name,method:'HEAD'});
  assert.equal(r.status,200,name);assert.equal(r.headers.get('content-type'),'application/zip',name);
  assert.equal(r.headers.get('content-encoding'),null,name);assert.equal((await r.arrayBuffer()).byteLength,0,name);
  assert.equal(Number(r.headers.get('content-length')),fs.statSync(path.join(root,name)).size,name);
 }
});

test('encoded null bytes and malformed URLs cannot expose files outside game root',async()=>{
 for(const url of ['kart://game/%00index.html','kart://game/%','kart://game/%2e%2e%2fpackage.json','file://game/index.html','kart://game.evil/index.html']){
  assert.notEqual((await handler({url,method:'GET'})).status,200,url);
 }
});


test('every bundled HTML inline script has an exact CSP hash and no unsafe script permission',()=>{
 let count=0;const expectedHashes=new Set();
 for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,name),'utf8');
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(!script.trim())continue;
   count++;const hash=crypto.createHash('sha256').update(script).digest('base64');
   expectedHashes.add(hash);assert(CSP.includes("'sha256-"+hash+"'"),name+' inline script must be allowed exactly');
  }
 }
 assert(count>=2,'homepage and garage recovery scripts are covered');
 const allowedHashes=Array.from(CSP.matchAll(/'sha256-([^']+)'/g),m=>m[1]).sort();
 assert.deepEqual(allowedHashes,Array.from(expectedHashes).sort(),'no stale or surplus script hash');
 const policy=CSP.split(';').find(s=>s.trim().startsWith('script-src'));
 assert(!policy.includes('unsafe-inline'));assert(!policy.includes('unsafe-eval'));
});


test('all inventoried music tracks retain audio MIME, exact bytes and license',async()=>{
 for(const {name} of JSON.parse(fs.readFileSync(path.join(root,'assets/music/inventory.json'))).filter(entry=>entry.name.endsWith('.mp3'))){
  const rel='assets/music/'+name;const r=await handler({url:'kart://game/'+rel,method:'GET'});
  assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/mpeg');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync(path.join(root,rel)));
 }
 const r=await handler({url:'kart://game/assets/music/LICENSE.txt',method:'GET'});
 assert.equal(r.status,200);assert.match(await r.text(),/non-commercial/);
});
