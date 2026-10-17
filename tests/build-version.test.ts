import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAME_VERSION,mountBuildVersion} from '../src/build-version.ts';
test('local release identity is explicit and mounts once outside scene replacement',()=>{
 const nodes:any[]=[];
 const doc={getElementById:(id:string)=>nodes.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(){}}),body:{append:(n:any)=>nodes.push(n)}} as unknown as Document;
 const first=mountBuildVersion(doc);
 assert.equal(mountBuildVersion(doc),first);assert.equal(nodes.length,1);
 assert.equal(first.textContent,'v1.1.1-dev.local');
 assert.equal(first.style.pointerEvents,'none');
 assert.match(first.style.left,/safe-area-inset-left/);
 assert.match(first.style.bottom,/safe-area-inset-bottom/);
 assert.equal(GAME_VERSION,'1.1.1-dev.local');
 assert.equal(JSON.parse(readFileSync('package.json','utf8')).version,'1.1.1');
 const spa=readFileSync('src/spa.ts','utf8');
 assert.ok(spa.indexOf('mountBuildVersion(document)')>spa.indexOf('node.remove()'));
 assert.ok(!spa.includes('sceneRoot.append(mountBuildVersion'));
});



test('hotfix package and lock identities agree and all six READMEs describe release assets and gameplay',()=>{
 const packageVersion=JSON.parse(readFileSync('package.json','utf8')).version;
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 assert.equal(packageVersion,'1.1.1');
 assert.equal(lock.version,packageVersion); assert.equal(lock.packages[''].version,packageVersion);
 for(const lang of ['', '.zh-CN', '.zh-TW', '.yue', '.ja', '.ko']) {
  const readme=readFileSync(`README${lang}.md`,'utf8');
  for(const expected of ['v1.1.1-html.zip','v1.1.1-windows-x64.zip','releases/download/v1.1.1/source.zip','itemStacking=0','17','THEME','Love','1.1.1-dev.<sha6>','1.1.1-dev.local']) assert.ok(readme.includes(expected),`${lang || 'en'}: ${expected}`);
  assert.ok(!readme.includes('v1.0.2a'),lang);
 }
});
