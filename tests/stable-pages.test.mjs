import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('main Pages builds exact release source, waits for public source, and preserves both preview trees', async () => {
  const workflow = await readFile('.github/workflows/pages-stable.yml', 'utf8');
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group: github-pages/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /node --import tsx --test/);
  assert.match(workflow, /GAME_BUILD_CHANNEL: release/);
  assert.match(workflow, /DEV_BUILD_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /verify-pages-snapshot\.mjs/g);
  assert.match(workflow, /download-pages-snapshot\.py/);
  assert.match(workflow, /compose-pages-snapshot\.mjs baseline-pages dist-root dist-pages root/);
  assert.match(workflow, /path: dist-pages/);
  assert.ok(workflow.indexOf('wait-public --source-file dist/source.zip') < workflow.indexOf('prepare-pages-root.mjs'));
  assert.ok(workflow.lastIndexOf('check-public') < workflow.indexOf('uses: actions/deploy-pages@'));
  assert.doesNotMatch(workflow, /windows-latest|contents: write|cp.*dist-pages\/dev|npm test/);
});
