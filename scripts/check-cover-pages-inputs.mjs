import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const pinned={main:'b665343da013f5cfec0a0f45797adcd347f9607b',dev:'4357252f2a356b46426419325e4fb3ff70b2f053'};
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/home-portraits-live2d');
assert.match(process.env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);
pinned['feature/home-portraits-live2d']=process.env.GITHUB_SHA;
for(const [branch,expected] of Object.entries(pinned)){
 const actual=execFileSync('git',['ls-remote','origin',`refs/heads/${branch}`],{encoding:'utf8'}).trim().split(/\s+/)[0];
 assert.equal(actual,expected,`${branch} advanced; refresh pinned inputs before publication`);
}
