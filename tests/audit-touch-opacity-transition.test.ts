import {stablePagesV050RepinHash} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import {inputModeHash, inputModePathsWithin, inputModeSourcePaths, restoreInputModeBytes} from './helpers/input-mode-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {parse} from 'postcss';
import {
  TOUCH_OPACITY_BASELINE_COMMIT, TOUCH_OPACITY_BASELINE_TREE, TOUCH_OPACITY_PRODUCTION_PATHS,
  TOUCH_OPACITY_BRIDGE_PATHS, TOUCH_OPACITY_TEST_ADDITIONS, TOUCH_OPACITY_REVIEW_PATH, TOUCH_OPACITY_REVIEW_SHA256,
  touchOpacitySha as sha, touchOpacityReview, assertTouchOpacityReviewBytes,
  touchOpacityHash, touchOpacityPathsWithin, restoreTouchOpacityBytes, touchOpacityAuditDependencies,
} from './helpers/touch-opacity-reviewed-revisions';
import {loadingGuideReview, loadingGuideHash, restoreLoadingGuideBytes} from './helpers/loading-guide-reviewed-revisions';
import {mobileControlsReview, mobileControlsHash, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = touchOpacityReview();
const paint = new Set(['background', 'border-color', 'backdrop-filter', 'text-shadow', 'box-shadow']);
// Parallel geometry/gameplay workers create only these root-level source siblings.
// Match the generator's exact PID + UUID format; arbitrary dotfiles remain production inputs.
const instrumentedNames = [
  ...['airfield', 'caldera', 'desert', 'garden', 'harvest', 'snow'].map(name => name + '-enrichment-scene'),
  ...['forest', 'quarry', 'town', 'workshop'].map(name => name + '-enrichment-camera-scene'),
  ...['forest', 'quarry', 'town'].map(name => name + '-enrichment-provenance'),
  ...['airfield', 'garden', 'mountain'].map(name => 'land-course-' + name + '-test'),
  ...['airfield', 'caldera', 'course-failure', 'default', 'desert', 'forest', 'garden', 'harvest', 'mountain', 'quarry', 'saved', 'snow', 'town', 'workshop', 'cancel'].map(name => 'game-test-' + name),
  'waterpark-play-test',
];
const instrumentedPath = new RegExp('^src/\\.(?:' + instrumentedNames.join('|') + ')-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.ts$');
const productionSources = (paths: string[]) => paths.filter(path => !instrumentedPath.test(path)).sort();
function cssStructure(css: string, ignorePaint = false) {
  const visit = (node: any): any => {
    if (node.type === 'comment') return null;
    if (node.type === 'decl') {
      if (ignorePaint && paint.has(node.prop)) return null;
      const value = ignorePaint && node.prop === 'border' ? node.value.replace(/#[a-f\d]{3,8}\b/gi, '<color>') : node.value;
      return {type: node.type, prop: node.prop, value, important: !!node.important};
    }
    const nodes = (node.nodes ?? []).map(visit).filter(Boolean);
    if (node.type === 'root') return nodes;
    if (node.type === 'rule') return {type: node.type, selector: node.selector, nodes};
    assert.equal(node.type, 'atrule');
    return {type: node.type, name: node.name, params: node.params, nodes};
  };
  return visit(parse(css));
}

test('touch presentation pins the exact published dev tree and only three CSS production changes', () => {
  assert.equal(TOUCH_OPACITY_BASELINE_COMMIT, 'f8d3615bacafae78eadd81224ee78a91e362b677');
  assert.equal(TOUCH_OPACITY_BASELINE_TREE, '2d6fae0d9b46c66115ea40a6043eb7d2e0181420');
  assert.equal(sha(read(TOUCH_OPACITY_REVIEW_PATH)), TOUCH_OPACITY_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes), [...TOUCH_OPACITY_PRODUCTION_PATHS, ...TOUCH_OPACITY_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...TOUCH_OPACITY_TEST_ADDITIONS]);
  const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
  const actualSource = productionSources(walk('src'));
  const protectedSource = Object.keys(review.protectedProduction).filter(path => path.startsWith('src/'));
  assert.deepEqual(actualSource, inputModeSourcePaths([...protectedSource, ...TOUCH_OPACITY_PRODUCTION_PATHS]).sort(), 'No unreviewed new or removed production source');
  assert.ok(protectedSource.length > 100);
  for (const [path, hash] of Object.entries(review.protectedProduction)) assert.equal(sha(restoreInputModeBytes(path, read(path))), hash, path + ' exact touch-era production bytes');
});

test('source inventory tolerates exact parallel fixture names but rejects arbitrary additional production', () => {
  const expected = inputModeSourcePaths([...Object.keys(review.protectedProduction).filter(path => path.startsWith('src/')), ...TOUCH_OPACITY_PRODUCTION_PATHS]).sort();
  const suffix = '-123-12345678-abcd-4321-9abc-0123456789ab.ts';
  const fixtures = instrumentedNames.map(name => 'src/.' + name + suffix);
  assert.deepEqual(productionSources([...expected, ...fixtures]), expected);
  for (const extra of ['src/unreviewed.ts', 'src/.unreviewed' + suffix, 'src/.game-test-default.ts', 'src/.game-test-default-not-a-uuid.ts', 'src/sub/.game-test-default' + suffix]) {
    assert.notDeepEqual(productionSources([...expected, extra]), expected, extra + ' cannot bypass production inventory');
  }
});

test('every touch-presentation change restores exact previous bytes and complete forward reconstruction', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreInputModeBytes(path, raw), original = restoreTouchOpacityBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path); assert.equal(sha(original), row.previousSha256, path);
    const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' exact forward round trip');
    assert.throws(() => restoreTouchOpacityBytes(path, raw + ' '));
    assert.throws(() => restoreTouchOpacityBytes(path, original), undefined, path + ' no historical fallback');
  }
  for (const [path, row] of Object.entries(review.additions)) assert.equal(sha(restoreInputModeBytes(path, read(path))), row.sha256, path + ' exact regression addition');
});

test('touch overlay rejects wrong incoming identities, aliases, modified evidence and expanded scope', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(touchOpacityHash(path, row.previousSha256), inputModeHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => touchOpacityHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra']) assert.equal(touchOpacityHash(alias, row.previousSha256), row.previousSha256);
  }
  for (const path of ['src/game.ts', 'src/race-controls.ts', 'src/race-camera.ts', 'public/source.html']) assert.equal(touchOpacityHash(path, 'unchanged'), 'unchanged');
  const mobilePath = 'src/mobile-controls.ts', mobilePin = review.protectedProduction[mobilePath];
  assert.equal(touchOpacityHash(mobilePath, mobilePin), sha(read(mobilePath)), 'Exact protected mobile source advances only through the new input-mode layer');
  assert.throws(() => touchOpacityHash(mobilePath, 'unchanged'));
  assert.throws(() => touchOpacityHash('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires its exact historical identity');
  assert.throws(() => assertTouchOpacityReviewBytes(read(TOUCH_OPACITY_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].removedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedLegal.LICENSE = 'f'.repeat(64); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertTouchOpacityReviewBytes(JSON.stringify(copy))); }
});

test('mobile changes only button paint, preserving every selector, nonvisual declaration and hit target', () => {
  const raw = read('src/mobile-controls.css'), current = restoreInputModeBytes('src/mobile-controls.css', raw), original = restoreTouchOpacityBytes('src/mobile-controls.css', raw);
  assert.deepEqual(cssStructure(current, true), cssStructure(original, true), 'All layout, media queries, input semantics, fonts and disabled opacity remain exact');
  const rules = (css: string) => {
    const values: Array<{selector: string; paint: string}> = [];
    parse(css).walkRules(rule => { values.push({selector: rule.selector, paint: JSON.stringify(rule.nodes.filter(node => node.type === 'decl' && (paint.has(node.prop) || node.prop === 'border')).map(node => node.toString()))}); });
    return values;
  };
  const previous = rules(original), next = rules(current);
  const changed = previous.filter((rule, index) => rule.paint !== next[index].paint).map(rule => rule.selector);
  assert.deepEqual(changed, [
    '.mobile-controls button',
    ".mobile-controls button:active,.mobile-controls button.is-pressed,\n.mobile-controls button[aria-pressed='true']",
    '.mobile-pedals .throttle', '.mobile-controls .mobile-drift', '.mobile-utilities button',
  ]);
  // Negative controls prove that geometry, input behavior and labels cannot pass the paint-only projection.
  for (const mutation of [
    current.replace('min-width:48px', 'min-width:47px'),
    current.replace('pointer-events:auto', 'pointer-events:none'),
    current.replace('border:1px solid #eaf6f440', 'border:2px solid #eaf6f440'),
    current.replace('--mobile-edge:20px', '--mobile-edge:21px'),
    current.replace('opacity:.45', 'opacity:.25'),
    current.replace('color:#f4f9f7', 'color:#000000'),
  ]) assert.notDeepEqual(cssStructure(mutation, true), cssStructure(original, true));
});

test('legal visibility delta is exactly menu shortcut restoration and dedicated-track hiding', () => {
  const rawMenu = read('src/menu.css'), menu = restoreInputModeBytes('src/menu.css', rawMenu), originalMenu = restoreTouchOpacityBytes('src/menu.css', rawMenu);
  const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.equal(withoutComments(menu), withoutComments(originalMenu.replace(',body[data-screen=main] #source-license', '')));
  const rawRace = read('src/race-ui.css'), race = restoreInputModeBytes('src/race-ui.css', rawRace), originalRace = restoreTouchOpacityBytes('src/race-ui.css', rawRace);
  assert.equal(race.slice(0, originalRace.length), originalRace, 'Existing race styles remain byte-exact');
  assert.deepEqual(cssStructure(race.slice(originalRace.length)), [{
    type: 'rule', selector: '#raceUi ~ #source-license', nodes: [{type: 'decl', prop: 'display', value: 'none', important: false}],
  }]);
  for (const path of ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', 'scripts/package-source.mjs']) assert.ok(Object.hasOwn(review.protectedLegal, path));
  for (const [path, hash] of Object.entries(review.protectedLegal)) assert.equal(sha(readFileSync(path)), hash, path + ' unchanged license/source and packaging bytes');
});

test('all historical proofs, geometry and stable publication evidence remain byte-exact', () => {
  assert.ok(Object.keys(review.protectedEvidence).length > 100);
  for (const path of ['tests/helpers/loading-guide-transition.json', 'tests/helpers/mobile-controls-transition.json', 'tests/helpers/menu-presentation-transition.json', 'tests/helpers/stable-pages-repin-transition.json', 'tests/helpers/mobile-controls-protected-evidence.json', 'docs/stable-pages-manifest.json']) assert.ok(Object.hasOwn(review.protectedEvidence, path), path);
  for (const [path, hash] of Object.entries(review.protectedEvidence)) assert.equal(sha(readFileSync(path)), stablePagesV050RepinHash(path, hash), path + ' unchanged historical evidence');
  for (const [path, row] of Object.entries(loadingGuideReview().changes)) {
    assert.equal(sha(restoreTouchOpacityBytes(path, read(path))), row.currentSha256, path + ' original loading endpoint');
    assert.equal(sha(restoreLoadingGuideBytes(path, read(path))), row.previousSha256, path + ' complete pre-loading history');
    assert.equal(loadingGuideHash(path, row.previousSha256), sha(read(path)), path + ' loading-to-current chain');
  }
  for (const [path, row] of Object.entries(mobileControlsReview().changes)) {
    assert.equal(sha(restoreMobileControlsBytes(path, read(path))), row.previousSha256, path + ' complete pre-mobile history');
    assert.equal(mobileControlsHash(path, row.previousSha256), sha(read(path)), path + ' mobile-to-current chain');
  }
});

test('all new audit dependencies and legal bytes join both current source-stability closures', () => {
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(touchOpacityPathsWithin(inventory), [...new Set([...Object.keys(review.changes).filter(path => Object.hasOwn(inventory, path)), ...inputModePathsWithin(inventory)])]);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of touchOpacityAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' explicit current audit closure');
  }
});
