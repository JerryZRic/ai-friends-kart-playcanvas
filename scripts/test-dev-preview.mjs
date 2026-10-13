// Fast development-preview gate. Full geometry/camera/collision certification
// remains `npm test` in pages-stable.yml before stable publication.
// This explicit list covers the current music/menu preview and publication safety;
// future feature changes must add their focused regression files here.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
export const previewTests = Object.freeze([
  'tests/background-music.test.ts',
  'tests/music-integration.test.ts',
  'tests/free-mode-menu.test.ts',
  'tests/free-mode-menu-dom.test.ts',
  'tests/race-shell.test.ts',
  'tests/title-menu.test.ts',
  'tests/menu-fixed-layout.test.ts',
  'tests/menu-boot.test.ts',
  'tests/menu-backdrop.test.ts',
  'tests/race-loading-ui.test.ts',
  'tests/touch-control-presentation.test.ts',
  'tests/migration.test.ts',
  'tests/portrait-packaging.test.ts',
  'tests/audit-music-transition.test.ts',
  'tests/audit-static-menu-art-transition.test.ts',
  'tests/audit-stable-pages-v050-repin-transition.test.ts',
  'tests/audit-ci-build-deployment-transition.test.ts',
  'tests/stable-pages.test.mjs',
  'tests/dev-pages.test.mjs',
  'tests/ci-build-artifact.test.mjs',
  'tests/ci-stable-retry.test.mjs',
  'tests/ci-workflow.test.mjs',
]);
assert.equal(new Set(previewTests).size, previewTests.length);
for (const path of previewTests) assert.ok(existsSync(path), `Missing preview regression: ${path}`);
console.log(`Running ${previewTests.length} explicit preview regression files. Full unrelated course audits remain in the stable gate.`);
const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', '--test', '--test-concurrency=2', ...previewTests], { stdio: 'inherit' });
if (result.error) throw result.error;
assert.equal(result.signal, null, 'Preview tests terminated by a signal');
process.exitCode = result.status ?? 1;
