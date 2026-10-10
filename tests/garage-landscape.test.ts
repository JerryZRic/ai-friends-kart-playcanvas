import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {garagePartPage, filterGarageParts, garageRaceEntry, garageBackEntry, garageHomeEntry, garageInitialBuild, upsertGarageNamedBuild} from '../src/kart-garage';
import {KART_SLOTS, defaultGarageState} from '../src/kart-build';
import {kartPresets} from '../src/kart-presets';

test('landscape six-card pagination reaches all 330 parts once, in catalog order', () => {
  let count = 0;
  for (const slot of KART_SLOTS) {
    const all = filterGarageParts(slot, '', '');
    const first = garagePartPage(all, 0);
    assert.equal(first.pages, 10);
    const visited = [];
    for (let page = 0; page < first.pages; page++) {
      const result = garagePartPage(all, page);
      assert.equal(result.page, page);
      assert.equal(result.items.length, Math.min(6, all.length - page * 6));
      visited.push(...result.items);
    }
    assert.deepEqual(visited, all);
    assert.equal(new Set(visited.map(part => part.id)).size, 55);
    count += visited.length;
  }
  assert.equal(count, 330);
});

test('pagination clamps stale pages after filters and handles empty and partial trays', () => {
  const all = filterGarageParts('body', '', '');
  const chosen = all[all.length - 1];
  const theme = garagePartPage(filterGarageParts('body', chosen.themeId, ''), 8);
  assert.deepEqual(theme, {page: 0, pages: 1, items: [chosen]});
  const searched = garagePartPage(filterGarageParts('body', '', chosen.id), 8);
  assert.deepEqual(searched, theme);
  assert.deepEqual(garagePartPage([], 8), {page: 0, pages: 1, items: []});
  assert.deepEqual(garagePartPage([0, 1, 2, 3, 4, 5, 6], 1), {page: 1, pages: 2, items: [6]});
  assert.equal(garagePartPage(all, -10).page, 0);
  assert.equal(garagePartPage(all, 999).page, 9);
  assert.equal(garagePartPage(all, Number.NaN).page, 0);
});

test('dialog presets can still save and reload each build and preserve every race difficulty', () => {
  for (const preset of kartPresets) {
    const initial = {...defaultGarageState(), activeBuild: preset.build};
    const saved = upsertGarageNamedBuild(initial, preset.name, null, preset.id);
    assert.ok(saved.ok);
    if (!saved.ok) continue;
    const build = saved.state.namedBuilds[0].build;
    assert.deepEqual(build, preset.build);
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const search = `?flow=free&difficulty=${difficulty}&seed=77`;
      for (const entry of [garageRaceEntry, garageBackEntry, garageHomeEntry]) {
        const url = new URL(entry('gpt', build, search), 'https://example.com/dev/');
        assert.equal(url.searchParams.get('difficulty'), difficulty);
        assert.equal(url.searchParams.get('seed'), '77');
        assert.equal(url.searchParams.get('flow'), 'free');
        assert.equal(url.searchParams.get('driver'), 'gpt');
        assert.deepEqual(garageInitialBuild(url.search, initial.activeBuild), preset.build);
      }
    }
  }
});

test('landscape controls expose native dialogs, named openers, and bounded tray controls', () => {
  const source = readFileSync('src/kart-garage.ts', 'utf8');
  for (const name of ['recipes', 'specs']) {
    assert.match(source, new RegExp(`<dialog id="${name}-dialog"[^>]*aria-labelledby="${name}-title"`));
    assert.match(source, new RegExp(`data-open-dialog="${name}-dialog"`));
  }
  assert.match(source, /\.showModal\(\)/);
  assert.match(source, /dialogOpener\?\.focus\(\{preventScroll: true\}\)/);
  assert.match(source, /id="parts-prev" aria-label="上一页零件"/);
  assert.match(source, /id="parts-next" aria-label="下一页零件"/);
  assert.match(source, /id="parts-page" role="status" aria-live="polite"/);
  assert.match(source, /paged\.items\.map/);
  assert.match(source, /\$\('#recipes-dialog'\)\.append\(\$\('\.build-shelf'\)\)/);
  assert.match(source, /\$\('#specs-dialog'\)\.append\(\$\('\.performance-disclosure'\)\)/);
});
