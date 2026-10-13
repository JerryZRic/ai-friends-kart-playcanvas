// Nonstable main/release regression selection. Dev never invokes this gate.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const MODULE_TESTS = Object.freeze({
  publication: ['tests/migration.test.ts', 'tests/portrait-packaging.test.ts', 'tests/stable-pages.test.mjs', 'tests/dev-pages.test.mjs', 'tests/ci-build-artifact.test.mjs', 'tests/ci-stable-retry.test.mjs', 'tests/ci-workflow.test.mjs', 'tests/quality-tier-policy.test.mjs'],
  music: ['tests/background-music.test.ts', 'tests/music-integration.test.ts'],
  menu: ['tests/free-mode-menu.test.ts', 'tests/free-mode-menu-dom.test.ts', 'tests/title-menu.test.ts', 'tests/menu-fixed-layout.test.ts', 'tests/menu-boot.test.ts', 'tests/menu-backdrop.test.ts'],
  input: ['tests/control-mode.test.ts', 'tests/control-settings-entries.test.ts', 'tests/mobile-controls.test.ts', 'tests/touch-control-presentation.test.ts', 'tests/race-controls.test.ts', 'tests/vehicle-controls.test.mjs'],
  race: ['tests/race-shell.test.ts', 'tests/race-frame-clock.test.ts', 'tests/race-hud.test.ts', 'tests/race-loading-ui.test.ts', 'tests/race-ui-layout.test.ts', 'tests/npc-difficulty.test.ts', 'tests/npc-tactics.test.ts'],
  garage: ['tests/kart-build.test.ts', 'tests/kart-garage-layout.test.ts', 'tests/kart-garage-stats.test.ts', 'tests/kart-presets.test.ts'],
});
export const COURSE_NAMES = Object.freeze(['airfield', 'caldera', 'desert', 'forest', 'garden', 'harvest', 'mountain', 'quarry', 'snow', 'town', 'workshop', 'coast', 'waterpark']);
export function courseTests(name) {
  assert.ok(COURSE_NAMES.includes(name), 'Unknown course module');
  if (name === 'coast') return ['tests/coast-race-rules.test.ts', 'tests/coast-race-feedback.test.ts'];
  if (name === 'waterpark') return ['tests/waterpark-play.test.ts', 'tests/waterpark-performance-ui.test.ts'];
  if (name === 'mountain') return ['tests/mountain-menu.test.ts', 'tests/mountain-gameplay.test.ts'];
  return [`tests/${name}-menu.test.ts`, `tests/${name}-route-cursor.test.ts`];
}
export function selectTargetedTests(paths) {
  assert.ok(Array.isArray(paths) && paths.every(path => typeof path === 'string' && path && !path.startsWith('/') && !path.split('/').includes('..')), 'Invalid changed paths');
  const modules = new Set(['publication']);
  for (const path of paths) {
    let mapped = false;
    for (const course of COURSE_NAMES) if (path.includes(course)) { modules.add(course); mapped = true; }
    for (const [module, pattern] of Object.entries({ music: /music|assets\/music/, menu: /menu|map-picker|map-presentation|map-profiles|menu-art|character|portrait/, input: /control|input|touch|mouse-look|vehicle/, race: /race|npc|pickup|game-settings/, garage: /garage|kart|driver/ })) {
      if (pattern.test(path)) { modules.add(module); mapped = true; }
    }
    if (/^(?:\.github\/|scripts\/|docs\/|tests\/helpers\/|tests\/audit-)/.test(path)) modules.add('publication');
    // Shared runtime or unknown runtime changes receive the complete quick
    // cross-module smoke set, never the full course certification matrices.
    if (['src/game.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'].includes(path) || (!mapped && /^(?:src|public|models)\//.test(path))) {
      for (const name of [...Object.keys(MODULE_TESTS), ...COURSE_NAMES]) modules.add(name);
    }
  }
  const tests = [...new Set([...modules].flatMap(module => MODULE_TESTS[module] ?? courseTests(module)))].sort();
  return { modules: [...modules].sort(), tests };
}
export function changedPaths({ env = process.env, read = readFileSync, git = args => execFileSync('git', args, { encoding: 'utf8' }) } = {}) {
  const event = env.GITHUB_EVENT_PATH ? JSON.parse(read(env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const requested = env.TARGETED_BASE_SHA || (env.GITHUB_EVENT_NAME === 'push' ? event.before : '');
  const fallback = JSON.parse(read('docs/stable-pages-manifest.json', 'utf8')).stableCommit;
  const base = requested && !/^0+$/.test(requested) ? requested : fallback;
  assert.match(base, /^[a-f0-9]{40}$/, 'Targeted comparison base must be an exact commit SHA');
  const paths = git(['diff', '--name-only', '-z', base, 'HEAD', '--']).split('\0').filter(Boolean);
  return { base, paths };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = changedPaths();
  const selected = selectTargetedTests(changed.paths);
  for (const path of selected.tests) assert.ok(existsSync(path), `Missing targeted test: ${path}`);
  console.log(JSON.stringify({ tier: 'nonstable', base: changed.base, changedPaths: changed.paths, ...selected }, null, 2));
  const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', '--test', '--test-concurrency=2', ...selected.tests], { stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'Targeted regressions terminated by signal');
  process.exitCode = result.status ?? 1;
}
