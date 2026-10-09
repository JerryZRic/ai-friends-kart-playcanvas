import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('stable promotion publishes approved main to root and keeps the preview URL available', async () => {
  const workflow = await readFile('.github/workflows/pages-stable.yml', 'utf8');
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group: github-pages/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /npm run check && npm test && npm run build/);
  assert.match(workflow, /npm run test:dist/);
  assert.match(workflow, /cp -a dist\/\. dist-pages\//);
  assert.match(workflow, /cp -a dist\/\. dist-pages\/dev\//);
  assert.match(workflow, /path: dist-pages/);
  assert.match(workflow, /test "\$actual" = "\$GITHUB_SHA"/);
  assert.doesNotMatch(workflow, /windows-latest|contents: write/);
});
