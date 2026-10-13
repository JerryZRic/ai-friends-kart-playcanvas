import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealBuild, verifyBuild, runIdentity } from '../scripts/verified-build-artifact.mjs';
import { sha256 } from '../scripts/compose-dev-pages.mjs';
const env = { GITHUB_REPOSITORY: 'JerryZRic/ai-friends-kart-playcanvas', GITHUB_REF: 'refs/heads/dev', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '1234', GITHUB_RUN_ATTEMPT: '1' };
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'ci-build-proof-'));
  const source = join(root, 'dist'), directory = join(root, 'verified-build');
  try {
    await mkdir(source);
    for (const file of ['index.html', 'source.zip', '.nojekyll']) await writeFile(join(source, file), 'verified ' + file);
    const expectedHash = await sealBuild({ source, output: directory, env });
    await fn({ source, directory, expectedHash, env });
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('sealed build verifies exact files, hidden file and source ZIP, including compose-only retries', async () => fixture(async context => {
  const proof = await verifyBuild(context);
  assert.equal(proof.files.length, 3);
  await verifyBuild({ ...context, env: { ...env, GITHUB_RUN_ATTEMPT: '2' } });
  await assert.rejects(sealBuild({ source: context.source, output: context.directory, env }), /EEXIST/);
}));
test('artifact cannot be reused for another repository, SHA, ref, run, or prior attempt', async () => fixture(async context => {
  for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'other/repo', GITHUB_SHA: 'b'.repeat(40), GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '9999', GITHUB_RUN_ATTEMPT: '0' })) {
    await assert.rejects(verifyBuild({ ...context, env: { ...env, [key]: value } }));
  }
  const bytes = JSON.parse(await readFile(join(context.directory, 'provenance.json')));
  bytes.runAttempt = '3'; const replacement = JSON.stringify(bytes);
  await writeFile(join(context.directory, 'provenance.json'), replacement);
  await assert.rejects(verifyBuild({ ...context, expectedHash: sha256(replacement) }), /future attempt/);
}));
test('provenance mutation or absent job digest fails closed', async () => fixture(async context => {
  await assert.rejects(verifyBuild({ ...context, expectedHash: '' }), /Missing build job/);
  await writeFile(join(context.directory, 'provenance.json'), '{}');
  await assert.rejects(verifyBuild(context), /digest mismatch/);
}));
for (const mutation of ['bytes', 'extra', 'missing', 'symlink', 'outside']) test(`artifact ${mutation} mutation fails closed`, async () => fixture(async context => {
  const dist = join(context.directory, 'dist');
  if (mutation === 'bytes') await writeFile(join(dist, 'source.zip'), 'wrong corresponding source');
  if (mutation === 'extra') await writeFile(join(dist, 'extra.js'), 'unverified');
  if (mutation === 'missing') await rm(join(dist, '.nojekyll'));
  if (mutation === 'symlink') await symlink('index.html', join(dist, 'alias.html'));
  if (mutation === 'outside') await writeFile(join(context.directory, 'extra.txt'), 'unverified');
  await assert.rejects(verifyBuild(context));
}));
test('only exact dev repository CI identities can create artifact proofs', () => {
  assert.deepEqual(runIdentity(env).runId, '1234');
  for (const value of ['', '0', '-1', '1.5', '12x']) assert.throws(() => runIdentity({ ...env, GITHUB_RUN_ID: value }));
});
