import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAME_VERSION,mountBuildVersion} from '../src/build-version.ts';
test('local release identity is explicit and mounts once outside scene replacement',()=>{
 const nodes:any[]=[];
 const doc={getElementById:(id:string)=>nodes.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(){}}),body:{append:(n:any)=>nodes.push(n)}} as unknown as Document;
 const first=mountBuildVersion(doc);
 assert.equal(mountBuildVersion(doc),first);assert.equal(nodes.length,1);
 assert.equal(first.textContent,'v1.0.2a-dev.local');
 assert.equal(first.style.pointerEvents,'none');
 assert.match(first.style.left,/safe-area-inset-left/);
 assert.match(first.style.bottom,/safe-area-inset-bottom/);
 assert.equal(GAME_VERSION,'1.0.2a-dev.local');
 assert.equal(JSON.parse(readFileSync('package.json','utf8')).version,'1.0.2-alpha.0');
 const spa=readFileSync('src/spa.ts','utf8');
 assert.ok(spa.indexOf('mountBuildVersion(document)')>spa.indexOf('node.remove()'));
 assert.ok(!spa.includes('sceneRoot.append(mountBuildVersion'));
});

