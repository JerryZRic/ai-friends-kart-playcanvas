import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compose,inventory} from '../scripts/compose-cover-pages.mjs';
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'cover-pages-test-')); try{await mkdir(join(dir,'baseline/dev'),{recursive:true});await mkdir(join(dir,'cover'));await writeFile(join(dir,'baseline/index.html'),'stable');await writeFile(join(dir,'baseline/dev/index.html'),'dev');await writeFile(join(dir,'baseline/.nojekyll'),'');await writeFile(join(dir,'cover/index.html'),'cover');await fn(dir);} finally{await rm(dir,{recursive:true,force:true});}}
test('preserves all baseline bytes and adds isolated cover',()=>fixture(async dir=>{const report=await compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'out'));assert.equal(report.preservedRootAndDev,true);assert.equal(report.baselineFiles,3);assert.equal((await inventory(join(dir,'out'))).length,4);}));
test('refuses oversized site before writing',()=>fixture(async dir=>{await assert.rejects(compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'out'),1),/exceeds/);}));
test('refuses previous cover in baseline',()=>fixture(async dir=>{await mkdir(join(dir,'baseline/cover-preview'));await writeFile(join(dir,'baseline/cover-preview/index.html'),'old');await assert.rejects(compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'out')),/previous preview/);}));
test('refuses symlink payload',()=>fixture(async dir=>{await symlink('../baseline/index.html',join(dir,'cover/link'));await assert.rejects(compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'out')),/Symlink/);}));
test('refuses output overwrite and overlapping directories',()=>fixture(async dir=>{await assert.rejects(compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'cover/out')),/overlap/);await mkdir(join(dir,'out'));await assert.rejects(compose(join(dir,'baseline'),join(dir,'cover'),join(dir,'out')));}));
