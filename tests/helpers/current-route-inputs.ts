import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import inputs from './accepted-route-physics/current-inputs.json';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
/** The complete reachable graph plus dependency lock, not just the entrypoint.
 * Intentional future physics revisions require a newly reviewed observation set. */
export function verifyCurrentRouteInputs(read:(path:string)=>Buffer=path=>readFileSync(path)){
 assert.equal(sha(readFileSync(new URL('./accepted-route-physics/current-inputs.json',import.meta.url))),'873e9ec87b50608380914efc0c6b01ead0702d14e72854cc10db893affbac682','immutable accepted input manifest');
 for(const file of inputs.files){
  const bytes=read(file.path);
  assert.equal(sha(bytes),file.sha256,`${file.path}: exact accepted route input`);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),file.gitBlobSha,`${file.path}: original Git blob`);
 }
}
