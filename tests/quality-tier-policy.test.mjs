import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { changedPaths, COURSE_NAMES, MODULE_TESTS, selectTargetedTests } from '../scripts/test-targeted.mjs';
const read = path => readFileSync(path, 'utf8');

test('dev remains compile-only F5 and never invokes a regression or dist certification gate', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /run: npm run build/);
  assert.doesNotMatch(workflow, /npm test|test-targeted|test-dev-preview|test:dist/);
  assert.match(workflow, /needs: \[build, compose\]/);
});

test('generic release validation stays nonstable; stable certification has an explicit immutable request', () => {
  for (const path of ['.github/workflows/release-quality.yml']) {
    const workflow = read(path);
    assert.match(workflow, /options: \[nonstable, stable\]\n        default: nonstable/);
    assert.match(workflow, /if: \$\{\{ github.event_name == 'workflow_dispatch' && inputs.quality == 'stable' \}\}\n        run: npm run check && npm test && npm run build/);
    assert.match(workflow, /if: \$\{\{ github.event_name != 'workflow_dispatch' \|\| inputs.quality != 'stable' \}\}/);
    assert.match(workflow, /npm run check && node scripts\/test-targeted.mjs && npm run build/);
    assert.match(workflow, /npm run test:dist/);
    assert.doesNotMatch(workflow, /tags:|if:.*prerelease|if:.*tag_name|continue-on-error|contents: write|actions: write/);
  }
  const stable = read('.github/workflows/release-stable.yml');
  const request = JSON.parse(read('docs/stable-release-request.json'));
  assert.equal(request.version, '1.1.0'); assert.equal(request.prerelease, false); assert.equal(request.latest, true);
  assert.match(request.expectedParentSha, /^[0-9a-f]{40}$/); assert.match(request.expectedDevParentSha, /^[0-9a-f]{40}$/);
  assert.match(stable, /stable-release\.py validate-request/);
  assert.match(stable, /run: npm test/); assert.match(stable, /npm run test:dist/);
  assert.match(stable, /needs: \[certify, windows-smoke\]/);
  assert.doesNotMatch(stable, /continue-on-error|workflow_dispatch/);
  const release = read('.github/workflows/release-quality.yml');
  assert.match(release, /release:\n    types: \[published\]/);
  assert.doesNotMatch(release, /deploy-pages|upload-release|gh release|pages: write|id-token: write/);
});

test('music and course edits select their own quick module regressions', () => {
  const music = selectTargetedTests(['src/background-music.ts']);
  assert.deepEqual(music.modules, ['music', 'publication']);
  assert.ok(music.tests.includes('tests/music-integration.test.ts'));
  assert.ok(!music.tests.some(path => path.includes('mountain')));
  const garden = selectTargetedTests(['src/maps/garden.ts', 'src/garden-scenery.ts']);
  assert.deepEqual(garden.modules, ['garden', 'publication']);
  assert.ok(garden.tests.includes('tests/garden-route-cursor.test.ts'));
  assert.ok(!garden.tests.some(path => path.includes('snow')));
});

test('shared and unknown runtime changes receive the combined quick smoke set, never large matrices', () => {
  for (const path of ['src/game.ts', 'src/new-runtime-module.ts', 'package-lock.json']) {
    const result = selectTargetedTests([path]);
    assert.deepEqual(result.modules, [...Object.keys(MODULE_TESTS), ...COURSE_NAMES].sort());
    assert.equal(new Set(result.tests).size, result.tests.length);
    for (const file of result.tests) assert.ok(existsSync(file), file);
    assert.ok(result.tests.every(file => !/independent-audit|enrichment-camera|route-geometry|enrichment-geometry/.test(file)));
  }
  assert.deepEqual(selectTargetedTests(['README.md']).modules, ['publication']);
  for (const paths of [[null], ['../escape'], ['/tmp/file']]) assert.throws(() => selectTargetedTests(paths));
});

test('targeted diff uses exact previous push SHA without shell interpolation and records changed paths', () => {
  const base = 'a'.repeat(40); let args;
  const result = changedPaths({ env: { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: 'event.json' }, read: path => JSON.stringify(path === 'event.json' ? { before: base } : { stableCommit: 'b'.repeat(40) }), git: value => { args = value; return 'src/music-ui.ts\0docs/music.md\0'; } });
  assert.deepEqual(args, ['diff', '--name-only', '-z', base, 'HEAD', '--']);
  assert.deepEqual(result, { base, paths: ['src/music-ui.ts', 'docs/music.md'] });
});

test('release/manual comparisons fall back to the pinned stable commit, while invalid or missing bases fail visibly', () => {
  const base = 'b'.repeat(40);
  for (const env of [{ GITHUB_EVENT_NAME: 'release' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_EVENT_NAME: 'push', TARGETED_BASE_SHA: '0'.repeat(40) }]) {
    assert.equal(changedPaths({ env, read: () => JSON.stringify({ stableCommit: base }), git: () => '' }).base, base);
  }
  assert.throws(() => changedPaths({ env: { TARGETED_BASE_SHA: 'main; npm test' }, read: () => JSON.stringify({ stableCommit: base }), git: () => '' }), /exact commit SHA/);
  assert.throws(() => changedPaths({ env: {}, read: () => JSON.stringify({ stableCommit: base }), git: () => { throw new Error('missing comparison commit'); } }), /missing comparison commit/);
});
