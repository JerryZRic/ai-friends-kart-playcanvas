import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const ids = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'character-fetch-'));
  mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'docs')); mkdirSync(join(root, 'fixtures'));
  writeFileSync(join(root, 'scripts/fetch-runtime-models.mjs'), readFileSync(new URL('../scripts/fetch-runtime-models.mjs', import.meta.url)));
  const collections = [['runtime', 'drivers', 'driver'], ['portrait', 'portraits', 'portrait']];
  const manifests = {};
  for (const [name, directory, suffix] of collections) {
    const assets = ids.map(id => {
      const decoded = Buffer.from(`synthetic ${suffix} fixture for ${id}`), compressed = gzipSync(decoded);
      const path = `assets/${directory}/${id}-${suffix}.glb.gz`;
      mkdirSync(join(root, 'fixtures', directory), {recursive: true});
      writeFileSync(join(root, 'fixtures', directory, `${id}-${suffix}.glb.gz`), compressed);
      return {id, path, bytes: compressed.length, sha256: hash(compressed), decodedBytes: decoded.length, decodedSha256: hash(decoded)};
    });
    manifests[name] = {schemaVersion: name === 'runtime' ? 2 : 1, assets};
    writeFileSync(join(root, 'docs', `${name}-models.json`), JSON.stringify(manifests[name]));
  }
  const harness = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    let calls=0;
    globalThis.fetch=async(url, options)=>{
      calls++;
      assert.equal(url.origin,'https://jerryzric.github.io');
      assert.match(url.pathname,/^\\/ai-friends-kart-playcanvas\\/dev\\/assets\\/(drivers|portraits)\\/(whale|gemini|gpt|claude|grok|glm)-(driver|portrait)\\.glb\\.gz$/);
      assert.equal(options.redirect,'error');assert.equal(options.headers['Accept-Encoding'],'identity');
      assert.ok(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
      if(process.env.FETCH_MODE==='missing')return {ok:false,status:404};
      const bytes=process.env.FETCH_MODE==='corrupt'?Buffer.from('wrong bytes'):readFileSync('./fixtures/'+url.pathname.split('/assets/')[1]);
      return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    };
    await import('./scripts/fetch-runtime-models.mjs');
    assert.equal(calls,Number(process.env.EXPECT_DOWNLOADS));
  `;
  const run = (count = 12, mode = '') => spawnSync(process.execPath, ['--input-type=module', '-e', harness], {cwd: root, encoding: 'utf8', env: {...process.env, EXPECT_DOWNLOADS: String(count), FETCH_MODE: mode}});
  return {root, manifests, run, dispose: () => rmSync(root, {recursive: true, force: true})};
}

test('fetch restores both fixed manifest sets and repeated runs perform zero downloads', () => {
  const f = fixture();
  try {
    const first = f.run(); assert.equal(first.status, 0, first.stderr);
    for (const manifest of Object.values(f.manifests)) for (const record of manifest.assets) {
      const bytes = readFileSync(join(f.root, 'public', record.path)); assert.equal(bytes.length, record.bytes); assert.equal(hash(bytes), record.sha256);
    }
    const again = f.run(0); assert.equal(again.status, 0, again.stderr);
  } finally { f.dispose(); }
});

test('fetch refuses corrupted compressed bytes, decoded identities and unapproved paths', () => {
  for (const fault of ['corrupt', 'decoded', 'path']) {
    const f = fixture();
    try {
      if (fault !== 'corrupt') {
        const record = f.manifests.runtime.assets[0];
        if (fault === 'decoded') record.decodedSha256 = '0'.repeat(64); else record.path = '../outside.glb.gz';
        writeFileSync(join(f.root, 'docs/runtime-models.json'), JSON.stringify(f.manifests.runtime));
      }
      const result = f.run(12, fault === 'corrupt' ? 'corrupt' : '');
      assert.notEqual(result.status, 0); assert.match(result.stderr, fault === 'path' ? /Unrecognized public model path/ : /checksum or size mismatch/);
      assert.equal(existsSync(join(f.root, 'public/assets/drivers/whale-driver.glb.gz')), false);
    } finally { f.dispose(); }
  }
});

test('fetch never overwrites mismatched local assets and reports an unpublished preview', () => {
  const f = fixture();
  try {
    const target = join(f.root, 'public/assets/drivers/whale-driver.glb.gz');
    mkdirSync(join(f.root, 'public/assets/drivers'), {recursive: true}); writeFileSync(target, 'keep this local file');
    const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /it was not overwritten/);
    assert.equal(readFileSync(target, 'utf8'), 'keep this local file');
  } finally { f.dispose(); }
  const missing = fixture();
  try {
    const result = missing.run(12, 'missing'); assert.notEqual(result.status, 0); assert.match(result.stderr, /HTTP 404.*dev preview may not yet be deployed/);
    assert.equal(existsSync(join(missing.root, 'public/assets/drivers/whale-driver.glb.gz')), false);
  } finally { missing.dispose(); }
});
