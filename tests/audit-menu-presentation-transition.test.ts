import {mobileControlsHash, mobileControlsPathsWithin, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {stablePagesRepinPathsWithin} from './helpers/stable-pages-repin-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  MENU_PRESENTATION_BASELINE_COMMIT, MENU_PRESENTATION_PUBLIC_BASELINE_COMMIT,
  MENU_PRESENTATION_REVIEW_PATH, MENU_PRESENTATION_REVIEW_SHA256,
  menuPresentationSha as sha, menuPresentationReview, assertMenuPresentationReviewBytes,
  menuPresentationHash, assertMenuPresentationDependency, menuPresentationPathsWithin,
  menuPresentationSourcePaths, restoreMenuPresentationBytes, menuPresentationAuditDependencies,
} from './helpers/menu-presentation-reviewed-revisions';
import {airfieldAfterGardenHash,airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import {gardenCameraPlan, assertGardenCameraDependency} from './helpers/garden-enrichment-camera-records';
import {airfieldCameraPlan} from './helpers/airfield-enrichment-camera-records';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = menuPresentationReview();

test('presentation transition names exact prior local/public identities and only one existing production input', () => {
  assert.equal(MENU_PRESENTATION_BASELINE_COMMIT, 'c6ac26335aa2fa93cec0b1a96a4ca7bea6ae5840');
  assert.equal(MENU_PRESENTATION_PUBLIC_BASELINE_COMMIT, 'eb2a0b3aae43c06664b84a7f8d209c44ec71e99a');
  assert.equal(sha(read(MENU_PRESENTATION_REVIEW_PATH)), MENU_PRESENTATION_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/')), ['src/menu.ts']);
  assert.deepEqual(Object.keys(review.additions), ['src/map-presentation.ts']);
  assert.ok(Object.keys(review.changes).every(path => !path.startsWith('tests/fixtures/') && !path.startsWith('docs/scene-baselines/')));
  assert.equal(review.changes['src/menu.ts'].previousSha256, '75f94747db242584a02153710bb29a060b5480d715b5d030a45b35984e2e2bb6');
  assert.equal(review.changes['tests/free-mode-menu-dom.test.ts'].previousSha256, 'a8aa31a7bc8e2a5631f14d7ecfa2be4e087dc2dd5b94c0da6e960a9d5c47599c');
});

test('every reviewed current file reconstructs every exact historical byte and a complete forward round trip', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreMobileControlsBytes(path, raw), original = restoreMenuPresentationBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path);
    assert.equal(sha(original), row.previousSha256, path);
    const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' exact reversible byte transition');
    assert.throws(() => restoreMenuPresentationBytes(path, raw + ' '), undefined, path + ' unreviewed current byte rejected');
    assert.throws(() => restoreMenuPresentationBytes(path, original), undefined, path + ' no historical-format fallback');
  }
});

test('only each exact incoming/current pair is accepted and unchanged unlisted inputs remain strict', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(menuPresentationHash(path, row.previousSha256), mobileControlsHash(path, row.currentSha256));
    assertMenuPresentationDependency(path, row.previousSha256, mobileControlsHash(path, row.currentSha256) as string);
    for (const incoming of [undefined, '0'.repeat(64), row.currentSha256]) {
      assert.throws(() => menuPresentationHash(path, incoming), undefined, path);
      assert.throws(() => assertMenuPresentationDependency(path, incoming, row.currentSha256), undefined, path);
    }
    for (const actual of ['', 'f'.repeat(64), row.previousSha256]) {
      assert.throws(() => assertMenuPresentationDependency(path, row.previousSha256, actual), undefined, path);
    }
  }
  for (const path of ['src/unlisted.ts', './src/menu.ts', 'src/menu.ts/extra', 'src/map-profiles.ts', 'src/land-camera.ts']) {
    assert.equal(menuPresentationHash(path, 'unchanged'), 'unchanged');
    assert.throws(() => assertMenuPresentationDependency(path, review.changes['src/menu.ts'].previousSha256, review.changes['src/menu.ts'].currentSha256), undefined, path);
  }
});

test('the transition record rejects changed rows, unlisted permissions, inverse hunks and addition identities', () => {
  const bytes = read(MENU_PRESENTATION_REVIEW_PATH);
  assert.throws(() => assertMenuPresentationReviewBytes(bytes + ' '));
  const tampered = structuredClone(review);
  tampered.changes['src/menu.ts'].currentSha256 = 'f'.repeat(64);
  assert.throws(() => assertMenuPresentationReviewBytes(JSON.stringify(tampered)));
  const unlisted = structuredClone(review);
  unlisted.changes['src/unlisted.ts'] = structuredClone(review.changes['src/menu.ts']);
  assert.throws(() => assertMenuPresentationReviewBytes(JSON.stringify(unlisted)));
  const changedHunk = structuredClone(review);
  changedHunk.changes['src/menu.ts'].hunks[0].removedLines[0] += ' ';
  assert.throws(() => assertMenuPresentationReviewBytes(JSON.stringify(changedHunk)));
  const addition = structuredClone(review);
  addition.additions['src/map-presentation.ts'].sha256 = '0'.repeat(64);
  assert.throws(() => assertMenuPresentationReviewBytes(JSON.stringify(addition)));
});

test('the complete Town historical inventory uses the same strict final transition without running geometry', () => {
  const town = JSON.parse(read('tests/fixtures/town-enrichment-protected.json'));
  const sceneRevisions = JSON.parse(read('tests/fixtures/reviewed-scene-revisions.json')).revisions;
  assert.equal(Object.keys(town.sourceInventory).length, 424);
  for (const [path, original] of Object.entries(town.sourceInventory)) {
    const scene = sceneRevisions[path];
    if (scene) assert.equal(scene.previousSHA256, original, path + ' exact original Town scenery input');
    const expected = scene ? airfieldReviewedHash(path, scene.currentSHA256) : airfieldAfterGardenHash(path, town.reviewedTestContractChanges[path] ?? original);
    assert.equal(sha(readFileSync(path)), expected, path + ' complete Town input');
  }
  assert.deepEqual(menuPresentationPathsWithin(town.sourceInventory), [...new Set([...Object.keys(review.changes).filter(path => Object.hasOwn(town.sourceInventory, path)), ...stablePagesRepinPathsWithin(town.sourceInventory), ...mobileControlsPathsWithin(town.sourceInventory)])]);
  const currentSources = menuPresentationSourcePaths(town.sourceInventory);
  assert.equal(currentSources.filter(path => path === 'src/map-presentation.ts').length, 1);
  assert.equal(sha(readFileSync('src/map-presentation.ts')), review.additions['src/map-presentation.ts'].sha256);
});

test('Garden and Airfield preserve frozen camera plans/output matrices while accepting only the reviewed menu pair', () => {
  const menu = review.changes['src/menu.ts'];
  const cases = [
    {name: 'garden', plan: gardenCameraPlan, planSha: '06c49fb8e7e4161c2be0380f887246cc6539a5792e0440c4adfc0dc92fb2d598', outputSha: '8cdac054678a3f529619dcf0d93d45f6bc0ba592b063bbf2b118d99dc229c900'},
    {name: 'airfield', plan: airfieldCameraPlan, planSha: '3e9b75eef6f98647fbc3813ce5248d0a6805b7668bdc46626e79f7e3959c333a', outputSha: '596e883062ddd1683ebae3f3aedfcdae4bf04e7faf8100af15003674a5b39f67'},
  ];
  for (const row of cases) {
    const planBytes = read(`tests/helpers/${row.name}-enrichment-camera-frozen.json`);
    const outputBytes = read(`tests/fixtures/${row.name}-enrichment-camera-outputs.json`);
    assert.equal(sha(planBytes), row.planSha);
    assert.equal(sha(outputBytes), row.outputSha);
    const plan = row.plan();
    assert.deepEqual(plan, JSON.parse(planBytes), 'Frozen inputs are never regenerated');
    assert.equal(plan.protected['src/menu.ts'], menu.previousSha256);
    assert.equal(JSON.parse(outputBytes).planSha256, row.planSha);
    assert.deepEqual(Object.keys(plan.protected).filter(path => Object.hasOwn(review.changes, path)), ['src/menu.ts']);
    for (const [path, incoming] of Object.entries(plan.protected)) {
      const check = row.name === 'garden' ? assertGardenCameraDependency : assertMenuPresentationDependency;
      check(path, incoming, sha(readFileSync(path)));
      assert.throws(() => check(path, incoming, '0'.repeat(64)), undefined, row.name + ' ' + path);
      if (path !== 'src/menu.ts') assert.throws(() => check(path, menu.previousSha256, menu.currentSha256), undefined, row.name + ' ' + path);
    }
  }
});

test('both camera source-stability closures include the new pure module and full transition proof dependencies', () => {
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of menuPresentationAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path);
    assert.equal(hashes['src/menu.ts'], mobileControlsHash('src/menu.ts', review.changes['src/menu.ts'].currentSha256));
    assert.equal(hashes['tests/free-mode-menu-dom.test.ts'], mobileControlsHash('tests/free-mode-menu-dom.test.ts', review.changes['tests/free-mode-menu-dom.test.ts'].currentSha256));
  }
});
