import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import inputs from './helpers/accepted-route-physics/current-inputs.json';
import {verifyCurrentRouteInputs} from './helpers/current-route-inputs';
test('accepted route provenance rejects a one-byte mutation of every source or dependency input',()=>{
 verifyCurrentRouteInputs();
 for(const target of inputs.files)assert.throws(()=>verifyCurrentRouteInputs(path=>{
  const bytes=readFileSync(path);if(path===target.path)bytes[0]^=1;return bytes;
 }),/exact accepted route input/,target.path);
});

test('accepted current route observations retain their reviewed exact bytes',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('./helpers/accepted-route-physics/current-results.json',import.meta.url))).digest('hex'),'dd988a07b4aec1cb76432db7b6655ff4b102fe8d646e1866ba641178f2dd5a60');
});

// The certificate-only exception must not become a JSON-field allowlist.
test('reviewed serial audit metadata rejects every individual package byte mutation',()=>{
 const original=readFileSync('package.json');
 for(let i=0;i<original.length;i++)assert.throws(()=>verifyCurrentRouteInputs(path=>{
  if(path!=='package.json')return readFileSync(path);
  const changed=Buffer.from(original);changed[i]^=1;return changed;
 }),/exact accepted route input/,`package.json byte ${i}`);
});
