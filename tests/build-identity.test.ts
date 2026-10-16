import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {devBuildVersion} from '../scripts/build-identity.ts';
test('dev identity uses exactly six hexadecimal characters from the supplied build commit',()=>{
 assert.equal(devBuildVersion('3b60271c5de6f7db84da4e8aa41a29c435de533d'),'1.1.0-dev.3b6027');
 assert.equal(devBuildVersion('ABCDEF'+'0'.repeat(34)),'1.1.0-dev.abcdef');
 assert.match(devBuildVersion('f'.repeat(40)),/^1\.1\.0-dev\.[a-f0-9]{6}$/);
});
test('missing build identity is explicitly local; malformed or abbreviated hashes fail closed',()=>{
 assert.equal(devBuildVersion(), '1.1.0-dev.local');
 assert.equal(devBuildVersion(''), '1.1.0-dev.local');
 for(const bad of ['3b6027','x'.repeat(40),'f'.repeat(41),' '+ 'f'.repeat(40)])assert.throws(()=>devBuildVersion(bad));
});
test('Vite consumes the explicit CI build input and Pages binds it to the actual current commit',()=>{
 const vite=readFileSync('vite.config.ts','utf8');
 assert.match(vite,/__GAME_BUILD_VERSION__: JSON\.stringify\(devBuildVersion\(process\.env\.DEV_BUILD_SHA, process\.env\.GAME_BUILD_CHANNEL\)\)/);
 const workflow=readFileSync('.github/workflows/pages.yml','utf8');
 assert.match(workflow,/- run: npm run build\s+env:\s+DEV_BUILD_SHA: \$\{\{ github\.sha \}\}/);
});

test('release channel omits dev hash without changing source identity',()=>{assert.equal(devBuildVersion('f'.repeat(40),'release'),'1.1.0');assert.throws(()=>devBuildVersion(undefined,'other'));});

