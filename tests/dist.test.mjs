import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { makeSourceArchive, sourceFiles, sourceLink } from '../scripts/package-dist.mjs';

const read = path => readFileSync(path);
const html = read('dist/index.html').toString();
const sourceHtml = read('dist/source.html').toString();
assert.equal(html, read('src/index.html').toString().replace('</body>', `${sourceLink}</body>`), 'Only the source/license anchor may change the original game HTML');
assert.equal((html.match(/id="source-license"/g) || []).length, 1);
assert.ok(html.includes('src="game.js"'));
assert.ok(!/<base\b/i.test(html));
for (const page of [html, sourceHtml]) {
  for (const [, value] of page.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (value.startsWith('data:')) continue;
    assert.ok(!/^(?:[a-z]+:|\/)/i.test(value), `Non-relative page link: ${value}`);
    assert.ok(!value.split('/').includes('..'), `Parent-directory page link: ${value}`);
    assert.ok(value === './' || lstatSync(`dist/${value}`).isFile(), `Missing page target: ${value}`);
  }
}
for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt']) assert.deepEqual(read(`dist/${file}`), read(file));
assert.equal(read('dist/.nojekyll').length, 0);
for (const file of ['src/index.html', 'src/game.js', 'dist/game.js']) {
  assert.doesNotMatch(read(file).toString(), /chatgpt\.com|chatgpt\.site|\.openai|shtw\.|\/api\/|\/auth\//i, `Service dependency in ${file}`);
}
const gameSource = read('src/game.js').toString();
assert.ok(gameSource.includes("['kart','palm','rock','arch'].map(name=>loader.loadAsync('assets/'+name+'.glb'))"), 'Audit any changes to model URL construction');
for (const name of ['kart', 'palm', 'rock', 'arch']) {
  const bytes = read(`dist/assets/${name}.glb`);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
  for (const object of [...(gltf.buffers || []), ...(gltf.images || [])]) assert.ok(!object.uri || object.uri.startsWith('data:'), `External model dependency: ${object.uri}`);
}

// Independently read ZIP local headers and compare each extracted entry with
// the checked-out source. Also detect stale source packages after any edit.
const archive = read('dist/source.zip'), members = [];
let cursor = 0;
while (archive.readUInt32LE(cursor) === 0x04034b50) {
  const compressedSize = archive.readUInt32LE(cursor + 18), size = archive.readUInt32LE(cursor + 22);
  const nameSize = archive.readUInt16LE(cursor + 26), extraSize = archive.readUInt16LE(cursor + 28);
  const name = archive.toString('utf8', cursor + 30, cursor + 30 + nameSize);
  assert.equal(archive.readUInt16LE(cursor + 8), 8);
  assert.ok(name.startsWith('neon-kart-source/'));
  const relative = name.slice('neon-kart-source/'.length);
  assert.ok(sourceFiles.includes(relative), `Unapproved archive entry: ${relative}`);
  const start = cursor + 30 + nameSize + extraSize;
  const bytes = inflateRawSync(archive.subarray(start, start + compressedSize));
  assert.equal(bytes.length, size);
  assert.deepEqual(bytes, read(relative), `Stale source archive entry: ${relative}`);
  members.push(relative); cursor = start + compressedSize;
}
assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
assert.deepEqual(members, sourceFiles);
assert.deepEqual(archive, makeSourceArchive(), 'Source archive must be deterministic and current');
assert.doesNotMatch(members.join('\n'), /(?:^|\/)(?:node_modules|\.git|\.openai|\.sites-runtime|qa)(?:\/|$)|source\.zip|\.blend1|game-test-copy/);

function listFiles(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const path = `${directory}/${name}`, relative = `${prefix}${name}`, stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `Do not publish symbolic links: ${path}`);
    return stat.isDirectory() ? listFiles(path, `${relative}/`) : [relative];
  });
}
const files = listFiles('dist');
assert.deepEqual(files, ['.nojekyll', 'LICENSE', 'NOTICE', 'SOURCE.txt', 'THIRD-PARTY-NOTICES.txt', 'assets/arch.glb', 'assets/kart.glb', 'assets/palm.glb', 'assets/rock.glb', 'game.js', 'index.html', 'source.html', 'source.zip'].sort(), 'Unexpected distribution file');
const prefixes = ['/', '/neon-kart/', '/preview/nested/game/'];
for (const prefix of prefixes) {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const relative = path.slice(prefix.length) || 'index.html';
    if (!files.includes(relative)) { response.writeHead(404).end(); return; }
    const mime = relative.endsWith('.html') ? 'text/html' : relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime }); response.end(read(`dist/${relative}`));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    for (const file of ['', ...files]) {
      const response = await fetch(new URL(file, base));
      assert.equal(response.status, 200, `${prefix}${file}`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), read(`dist/${file || 'index.html'}`));
    }
    for (const relative of ['game.js', 'assets/kart.glb', 'assets/palm.glb', 'assets/rock.glb', 'assets/arch.glb', 'source.html', 'source.zip']) {
      assert.ok(new URL(relative, base).pathname.startsWith(prefix));
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
}
console.log(JSON.stringify({ status: 'passed', suite: 'standalone distribution', sourceFiles: members.length, distributionFiles: files.length, httpMounts: prefixes, note: 'Static URL, source-archive, and HTTP checks only; not a WebGL or native pointer-lock gameplay test' }, null, 2));
