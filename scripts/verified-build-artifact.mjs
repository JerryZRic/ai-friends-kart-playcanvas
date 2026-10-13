// The artifact seals a compiled dev build, including its corresponding-source archive.
import assert from 'node:assert/strict';
import { appendFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, sha256 } from './compose-dev-pages.mjs';

export function runIdentity(env = process.env) {
  assert.equal(env.GITHUB_REPOSITORY, 'JerryZRic/ai-friends-kart-playcanvas');
  assert.equal(env.GITHUB_REF, 'refs/heads/dev');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  for (const key of ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']) assert.match(env[key] ?? '', /^[1-9][0-9]*$/);
  return { repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF, sha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT };
}
export async function fileRecords(directory) {
  return Promise.all((await inventory(directory)).map(async path => {
    const bytes = await readFile(join(directory, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }));
}
export async function sealBuild({ source = 'dist', output = 'verified-build', env = process.env } = {}) {
  const identity = runIdentity(env);
  await mkdir(output); // Refuse stale artifacts instead of merging directories.
  await cp(source, join(output, 'dist'), { recursive: true, errorOnExist: true });
  const files = await fileRecords(join(output, 'dist'));
  assert.ok(files.some(file => file.path === 'source.zip'), 'Missing verified corresponding source');
  const bytes = JSON.stringify({ schema: 'verified-dev-build-v1', ...identity, files }, null, 2) + '\n';
  await writeFile(join(output, 'provenance.json'), bytes);
  return sha256(bytes);
}
export async function verifyBuild({ directory = 'verified-build', expectedHash = process.env.EXPECTED_PROVENANCE_SHA256, env = process.env } = {}) {
  const identity = runIdentity(env);
  assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/, 'Missing build job provenance digest');
  const bytes = await readFile(join(directory, 'provenance.json'));
  assert.equal(sha256(bytes), expectedHash, 'Build provenance digest mismatch');
  const proof = JSON.parse(bytes);
  assert.equal(proof.schema, 'verified-dev-build-v1');
  for (const key of ['repository', 'ref', 'sha', 'runId']) assert.equal(proof[key], identity[key], `Wrong build ${key}`);
  // A compose-only retry retains the original successful build attempt.
  assert.match(proof.runAttempt ?? '', /^[1-9][0-9]*$/);
  assert.ok(BigInt(proof.runAttempt) <= BigInt(identity.runAttempt), 'Artifact comes from a future attempt');
  const records = await fileRecords(join(directory, 'dist'));
  assert.deepEqual(records, proof.files, 'Verified build inventory or bytes changed');
  assert.ok(records.some(file => file.path === 'source.zip'), 'Missing corresponding source');
  assert.deepEqual(await inventory(directory), ['provenance.json', ...records.map(file => 'dist/' + file.path)].sort(), 'Unexpected artifact contents');
  return proof;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  assert.ok(['seal', 'verify'].includes(mode), 'Use seal or verify');
  if (mode === 'seal') {
    const digest = await sealBuild();
    assert.ok(process.env.GITHUB_OUTPUT, 'Missing job output channel');
    await appendFile(process.env.GITHUB_OUTPUT, `sha256=${digest}\n`);
    console.log(`Sealed verified build provenance ${digest}`);
  } else console.log(`Verified build for ${(await verifyBuild()).sha}`);
}
