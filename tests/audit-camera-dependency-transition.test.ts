import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {assertGardenCameraDependency, GARDEN_CAMERA_AIRFIELD_TRANSITION as transition, gardenCameraPlan} from './helpers/garden-enrichment-camera-records';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => readFileSync(path, 'utf8');
const planPath = 'tests/helpers/garden-enrichment-camera-frozen.json';
const outputsPath = 'tests/fixtures/garden-enrichment-camera-outputs.json';

test('Garden camera dependencies retain the exact historical plan and all output matrices', () => {
  const planText = read(planPath), outputText = read(outputsPath), plan = JSON.parse(planText);
  assert.equal(sha(planText), '06c49fb8e7e4161c2be0380f887246cc6539a5792e0440c4adfc0dc92fb2d598');
  assert.equal(sha(outputText), '8cdac054678a3f529619dcf0d93d45f6bc0ba592b063bbf2b118d99dc229c900');
  assert.equal(JSON.parse(outputText).planSha256, sha(planText));
  assert.equal(plan.protected[transition.path], transition.previousSha256);
  assert.deepEqual(gardenCameraPlan(), plan, 'Dependency review must not rewrite or repin frozen inputs');
});

test('Garden camera records preserve every original archive and matrix assertion byte', () => {
  const current = read('tests/helpers/garden-enrichment-camera-records.ts');
  const start = current.indexOf('export const GARDEN_CAMERA_AIRFIELD_TRANSITION = ');
  const end = current.indexOf('export const gardenCameraExpectedPath=');
  assert.ok(start > 0 && end > start);
  const original = (current.slice(0, start) + current.slice(end)).replace(
    'for(const [path,sha]of Object.entries(plan.protected))assertGardenCameraDependency(path,sha,gardenSha(readFileSync(path)));',
    "for(const [path,sha]of Object.entries(plan.protected))assert.equal(gardenSha(readFileSync(path)),sha,'Original camera dependency: '+path);",
  );
  assert.equal(sha(original), '54ddb157a3dd55e090239d2a58ef6e1231b7ad4a7cef0db0967d4953e443125a');
});

test('Garden accepts only the exact reviewed Airfield incoming/current pair', () => {
  assertGardenCameraDependency(transition.path, transition.previousSha256, transition.currentSha256);
  for (const incoming of ['0'.repeat(64), transition.currentSha256, undefined]) {
    assert.throws(() => assertGardenCameraDependency(transition.path, incoming, transition.currentSha256));
  }
  for (const current of ['f'.repeat(64), transition.previousSha256, '']) {
    assert.throws(() => assertGardenCameraDependency(transition.path, transition.previousSha256, current));
  }
});

test('Garden rejects changes to every other protected dependency and unlisted transition paths', () => {
  const plan = JSON.parse(read(planPath));
  for (const [path, incoming] of Object.entries<string>(plan.protected)) {
    if (path === transition.path) continue;
    assertGardenCameraDependency(path, incoming, sha(readFileSync(path)));
    assert.throws(() => assertGardenCameraDependency(path, incoming, '0'.repeat(64)), undefined, path);
    assert.throws(() => assertGardenCameraDependency(path, transition.previousSha256, transition.currentSha256), undefined, path);
  }
  for (const path of ['src/unlisted-scenery.ts', 'src/airfield-scenery.ts/extra', './src/airfield-scenery.ts', 'public/map-previews/airfield.webp']) {
    assert.throws(() => assertGardenCameraDependency(path, transition.previousSha256, transition.currentSha256), undefined, path);
  }
});

test('Garden cross-scene transition is bound to retained Airfield review and original prefix evidence', () => {
  const reviewText = read(transition.reviewPath);
  assert.equal(sha(reviewText), transition.reviewSha256);
  const review = JSON.parse(reviewText).changes[transition.path];
  assert.equal(review.previousSha256, transition.previousSha256);
  assert.equal(review.currentSha256, transition.currentSha256);
  assert.equal(sha(readFileSync(transition.path)), transition.currentSha256);
  assert.equal(sha(readFileSync('docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt')), transition.previousSha256);
  const originalText = read('tests/fixtures/airfield-enrichment-original-geometry.json');
  assert.equal(sha(originalText), '264433eb8a734047aea058f6bcc92be4f0f03cda65db545e3036b6d5c25b7f30');
  const original = JSON.parse(originalText), plan = JSON.parse(read(planPath));
  assert.equal(original.sourceSha256, transition.previousSha256);
  assert.equal(original.protection.prefixes.components.count, 1585);
  assert.equal(original.protection.prefixes.cameraObstacles.count, 9);
  for (const path of ['src/maps/airfield.ts', 'src/land-road-mesh.ts', 'src/land-mesh-builder.ts', 'src/land-camera.ts', 'src/race-camera.ts']) {
    assert.equal(sha(readFileSync(path)), original.sourceHashes[path], path + ' retained road/camera dependency');
    assert.equal(plan.protected[path], original.sourceHashes[path]);
  }
  assert.equal(sha(readFileSync('tests/fixtures/airfield-enrichment-camera-outputs.json')), '596e883062ddd1683ebae3f3aedfcdae4bf04e7faf8100af15003674a5b39f67');
});
