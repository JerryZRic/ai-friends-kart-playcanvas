// Filesystem-only publication checks. No browser, GPU or real network is used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { unzipSync, zipSync } from 'fflate';

const read = path => readFileSync(path);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const tests = [];
function check(name, fn) { console.log('Checking: ' + name); fn(); tests.push(name); }
function inventory(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name), relative = prefix + name, stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `Published symlink: ${relative}`);
    return stat.isDirectory() ? inventory(path, relative + '/') : [relative];
  });
}
function safePath(path) {
  assert.ok(!path.split('/').some(part => part.startsWith('.') && !['.gitignore', '.github'].includes(part)), `Unapproved hidden/temporary file: ${path}`);
  assert.ok(path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => part === '.' || part === '..'), `Unsafe archive path: ${path}`);
  assert.doesNotMatch(path, /(?:^|\/)(?:\.openai|\.git|\.aws|\.codex|node_modules|private|secrets?)(?:\/|$)/i, `Private source path: ${path}`);
  assert.ok(!path.endsWith('.blend') || ['models/kart.blend', 'models/props.blend'].includes(path), `Unapproved editable model: ${path}`);
  assert.ok(!/^public\/assets\/(?:drivers|portraits)\//.test(path), `Restricted character duplicated in source: ${path}`);
}
// Split sentinels so the source scanner can also inspect this file without self-matching.
const privatePatterns = [
  new RegExp('lib' + 'file_[A-Za-z0-9_-]{8,}', 'i'),
  new RegExp('sedi' + 'ment://file_', 'i'),
  new RegExp('/work' + 'space/scratch/', 'i'),
  new RegExp('https?://(?:www\\.)?github\\.com/[^/\\s]+/ai-friends-' + 'kart(?:[/?#\\s"\']|$)', 'i'),
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
function scanContent(path, bytes) {
  if (path.endsWith('.glb.gz')) bytes = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 });
  for (const pattern of privatePatterns) assert.ok(!pattern.test(bytes.toString('utf8')), `Private data pattern in ${path}: ${pattern.source}`);
}
const rootAllowlist = new Set(['.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html','coast.html','waterpark.html','waterpark-study.html', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'README.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.yue.md', 'README.ja.md', 'README.ko.md']);
const allowedRoots = ['src/', 'tests/', 'scripts/', 'docs/', 'models/', '.github/', 'public/'];
const expectedSource = [...rootAllowlist].filter(existsSync);
for (const root of allowedRoots) for (const path of inventory(root)) {
  const relative = root + path;
  if (/^public\/assets\/(?:drivers|portraits)\//.test(relative)) continue;
  expectedSource.push(relative);
}
expectedSource.sort();
const files = inventory('dist'), archive = read('dist/source.zip');
const entries = unzipSync(archive), prefix = 'ai-friends-kart-playcanvas-source/';
const sourceEntries = new Map();

check('source ZIP has safe exact members, current content and deterministic compression', () => {
  for (const [name, bytes] of Object.entries(entries)) {
    assert.ok(name.startsWith(prefix));
    const path = name.slice(prefix.length); safePath(path);
    assert.ok(rootAllowlist.has(path) || allowedRoots.some(root => path.startsWith(root)), `Unknown source entry: ${path}`);
    assert.ok(!sourceEntries.has(path), `Duplicate source entry: ${path}`);
    assert.equal(sha(bytes), sha(read(path)), `Stale source archive entry: ${path}`);
    scanContent(path, Buffer.from(bytes)); sourceEntries.set(path, bytes);
  }
  assert.deepEqual([...sourceEntries.keys()], expectedSource);
  const deterministic = Object.fromEntries([...sourceEntries].map(([path, bytes]) => [prefix + path, [bytes, { mtime: new Date(1980, 0, 1), level: 9 }]]));
  assert.equal(sha(zipSync(deterministic)), sha(archive), 'Non-deterministic source archive');
  for (const path of ['src/game.ts', 'src/assets.ts', 'src/scene.ts', 'src/track.ts', 'docs/runtime-models.json', 'docs/portrait-models.json', 'tests/migration.test.ts', 'models/kart.blend', 'models/props.blend', 'public/assets/kart-r12-chassis.glb']) assert.ok(sourceEntries.has(path));
});

check('dist contains only runtime bundle/maps, approved public assets and legal/source files', () => {
  const publicFiles = inventory('public');
  const allowed = new Set([...publicFiles, '.nojekyll', 'index.html','coast.html','waterpark.html','waterpark-study.html', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'source.zip']);
  for (const path of files) {
    assert.ok(allowed.has(path) || /^assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.(?:js|css)(?:\.map)?$/.test(path), `Unexpected distribution path: ${path}`);
    if (path !== 'source.zip') scanContent(path, read('dist/' + path));
  }
  for (const path of publicFiles) assert.equal(sha(read('dist/' + path)), sha(read('public/' + path)));
  for (const path of ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt']) assert.equal(sha(read('dist/' + path)), sha(read(path)));
  assert.equal(read('dist/.nojekyll').length, 0);
  assert.match(read('THIRD-PARTY-NOTICES.txt').toString(), /PlayCanvas/);
});

check('all twelve driver/portrait archives have exact compressed/decoded hashes and source excludes them', () => {
  for (const [manifestPath, fixturePath, directory, suffix] of [
    ['docs/runtime-models.json', 'tests/helpers/authorized-runtime.json', 'drivers', 'driver'],
    ['docs/portrait-models.json', 'tests/helpers/authorized-portraits.json', 'portraits', 'portrait'],
  ]) {
    const manifest = JSON.parse(read(manifestPath)), authorized = JSON.parse(read(fixturePath));
    assert.deepEqual(manifest.assets, authorized.assets);
    assert.deepEqual(manifest.assets.map(record => record.id), ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm']);
    assert.deepEqual(inventory(`dist/assets/${directory}`), manifest.assets.map(record => `${record.id}-${suffix}.glb.gz`).sort());
    for (const record of manifest.assets) {
      assert.equal(record.path, `assets/${directory}/${record.id}-${suffix}.glb.gz`);
      const compressed = read('dist/' + record.path), decoded = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
      assert.equal(compressed.length, record.bytes); assert.equal(sha(compressed), record.sha256);
      assert.equal(compressed[3], 0, 'Archive carries no optional filename/comment metadata');
      assert.equal(compressed.readUInt32LE(4), 0, 'Archive timestamp is deterministic');
      assert.equal(decoded.length, record.decodedBytes); assert.equal(sha(decoded), record.decodedSha256);
      assert.ok(!sourceEntries.has('public/' + record.path));
      assert.equal(decoded.toString('ascii', 0, 4), 'glTF'); assert.equal(decoded.readUInt32LE(4), 2);
      assert.equal(decoded.readUInt32LE(8), decoded.length); assert.equal(decoded.readUInt32LE(16), 0x4e4f534a);
      const gltf = JSON.parse(decoded.toString('utf8', 20, 20 + decoded.readUInt32LE(12)));
      for (const resource of [...(gltf.buffers || []), ...(gltf.images || [])]) assert.ok(!resource.uri || resource.uri.startsWith('data:'), 'External model dependency');
      if (directory === 'portraits') {
        assert.equal(gltf.skins?.length || 0, 0, 'Portrait must not reuse the driving rig');
        assert.equal(gltf.animations?.length || 0, 0, 'Standing portrait has no driving animation');
      }
    }
  }
  for (const path of ['MODEL-NOTICE.txt', 'SOURCE.txt']) {
    const notice = read(path).toString(); assert.match(notice, /portrait/i); assert.match(notice, /AGPL/); assert.match(notice, /non[ -]?commercial/i);
  }
});

check('entry/source links and runtime assets resolve at root and nested Pages paths', () => {
  const html = read('dist/index.html').toString(), source = read('dist/source.html').toString();
  const gamePages = ['index.html', 'coast.html', 'waterpark.html', 'waterpark-study.html'].map(path => read('dist/' + path).toString());
  for (const page of gamePages.slice(0, 3)) assert.equal((page.match(/id="source-license"/g) || []).length, 1);
  assert.equal((html.match(/id="source-license"/g) || []).length, 1);
  assert.doesNotMatch(html, /<base\b/i);
  const moduleScripts = [...new Set(gamePages.flatMap(page => [...page.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map(match => match[1])))];
  assert.ok(moduleScripts.length > 0);
  for (const path of moduleScripts) assert.ok(!/^(?:[a-z]+:|\/\/|\/)/i.test(path), `External runtime script: ${path}`);
  for (const prefix of ['/', '/ai-friends-kart-playcanvas/', '/preview/nested/game/']) {
    const base = 'https://example.invalid' + prefix;
    for (const page of [...gamePages, source]) for (const [, path] of page.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (/^(?:data:|#)/.test(path)) continue;
      if (/^https:/.test(path)) {
        assert.ok(page === source && /^https:\/\/github\.com\/JerryZRic\/(?:ai-friends-kart-web|ai-friends-kart-playcanvas)$/.test(path), `Unexpected external page dependency: ${path}`);
        continue;
      }
      assert.ok(!/^(?:[a-z]+:|\/)/i.test(path), `Nonrelative local dependency: ${path}`);
      const url = new URL(path, base);
      assert.ok(url.pathname.startsWith(prefix));
      const resolved = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
      assert.ok(files.includes(resolved), `Missing linked file: ${resolved}`);
    }
    for (const path of inventory('public/assets')) assert.ok(new URL('assets/' + path, base).pathname.startsWith(prefix));
  }
  for (const path of moduleScripts) {
    const jsPath = 'dist/' + path.replace(/^\.\//, '');
    const js = read(jsPath).toString();
    assert.doesNotMatch(js, /(?:import\s*\(|from\s*)['"]https?:/);
    const mapName = js.match(/\/\/# sourceMappingURL=([^\s]+)/)?.[1];
    if (mapName) assert.ok(existsSync(join(dirname(jsPath), mapName)));
  }
});

check('source-only rebuild is byte-identical; manifest fetch restores only approved public models', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'playcanvas-source-'));
  // Preserve dependency symlinks in this offline fixture, matching the package-local
  // paths a real npm ci installation has. Otherwise sourcemaps name the host cache.
  const buildScript = `import {build} from ${JSON.stringify('file://' + resolve('node_modules/vite/dist/node/index.js'))};await build({resolve:{preserveSymlinks:true}});`;
  const build = () => execFileSync(process.execPath, ['--input-type=module', '-e', buildScript], { cwd: temporary, stdio: 'pipe', timeout: 120000 });
  const packageSource = () => execFileSync(process.execPath, ['scripts/package-source.mjs'], { cwd: temporary, stdio: 'pipe', timeout: 120000 });
  try {
    for (const [path, bytes] of sourceEntries) { const target = join(temporary, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes); }
    symlinkSync(resolve('node_modules'), join(temporary, 'node_modules'), 'dir');
    build(); packageSource();
    const withoutModels = files.filter(path => !/^assets\/(?:drivers|portraits)\//.test(path));
    assert.deepEqual(inventory(join(temporary, 'dist')), withoutModels);
    for (const path of withoutModels) assert.equal(sha(readFileSync(join(temporary, 'dist', path))), sha(read('dist/' + path)), `Source-only rebuild differs: ${path}`);
    const harness = `
      import assert from 'node:assert/strict';
      import {readFileSync} from 'node:fs';
      import {join} from 'node:path';
      let calls=0;
      globalThis.fetch=async (url,options)=>{
        calls++;assert.equal(process.env.QA_EXPECT_DOWNLOADS,'12');
        const parsed=new URL(url);assert.equal(parsed.origin,'https://jerryzric.github.io');
        assert.match(parsed.pathname,/^\\/ai-friends-kart-playcanvas\\/dev\\/assets\\/(drivers|portraits)\\/(whale|gemini|gpt|claude|grok|glm)-(driver|portrait)\\.glb\\.gz$/);
        assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
        const bytes=readFileSync(join(process.env.QA_RUNTIME_ROOT,parsed.pathname.slice('/ai-friends-kart-playcanvas/dev/'.length)));
        return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
      };
      await import('./scripts/fetch-runtime-models.mjs');assert.equal(calls,Number(process.env.QA_EXPECT_DOWNLOADS));
    `;
    for (const count of ['12', '0']) execFileSync(process.execPath, ['--input-type=module', '-e', harness], { cwd: temporary, stdio: 'pipe', timeout: 120000, env: { ...process.env, QA_RUNTIME_ROOT: resolve('dist'), QA_EXPECT_DOWNLOADS: count } });
    build(); packageSource();
    assert.deepEqual(inventory(join(temporary, 'dist')), files);
    for (const path of files) assert.equal(sha(readFileSync(join(temporary, 'dist', path))), sha(read('dist/' + path)), `Full rebuild differs: ${path}`);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

console.log(JSON.stringify({ status: 'passed', suite: 'PlayCanvas source and distribution safety', tests, sourceFiles: sourceEntries.size, distributionFiles: files.length, sourceSha256: sha(archive), note: 'CPU and filesystem checks only. Rebuilds use already installed pinned dependencies. HTTP fetch is mocked with local authorized bytes. No browser, GPU, real network or deployment is verified.' }, null, 2));
