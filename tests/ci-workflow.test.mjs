import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
const build = workflow.split('  build:\n')[1].split('  compose:\n')[0];
const compose = workflow.split('  compose:\n')[1].split('  deploy:\n')[0];
const deploy = workflow.split('  deploy:\n')[1];
test('build artifact is uploaded after compilation and exact byte sealing', () => {
  const ordered = ['npm ci', 'npm run build', 'node scripts/verified-build-artifact.mjs seal', 'uses: actions/upload-artifact@v4'];
  let last = -1;
  for (const step of ordered) { const next = build.indexOf(step); assert.ok(next > last, step); last = next; }
  assert.doesNotMatch(build, /compose-dev-pages|configure-pages|upload-pages-artifact|pages: write/);
  assert.match(build, /include-hidden-files: true/);
  assert.match(build, /compression-level: 0/);
  assert.match(build, /if-no-files-found: error/);
  assert.match(build, /artifact-id: \$\{\{ steps\.build-artifact\.outputs\.artifact-id \}\}/);
  assert.match(build, /provenance-sha256: \$\{\{ steps\.provenance\.outputs\.sha256 \}\}/);
});
test('composition is independently retryable and takes only this successful build by immutable artifact ID', () => {
  assert.match(compose, /needs: build/);
  assert.match(compose, /artifact-ids: \$\{\{ needs\.build\.outputs\.artifact-id \}\}/);
  assert.match(compose, /EXPECTED_PROVENANCE_SHA256: \$\{\{ needs\.build\.outputs\.provenance-sha256 \}\}/);
  assert.ok(compose.indexOf('verified-build-artifact.mjs verify') < compose.indexOf('prepare-pages-dev.mjs verified-build/dist dist-dev'));
  assert.ok(compose.indexOf('prepare-pages-dev.mjs verified-build/dist dist-dev') < compose.indexOf('compose-pages-snapshot.mjs baseline-pages dist-dev dist-pages dev'));
  assert.match(compose, /download-pages-snapshot\.py/);
  assert.match(compose, /verify-pages-snapshot\.mjs/);
  assert.doesNotMatch(compose, /npm test|npm ci|npm run build|run-id:|github-token:|contents: write/);
  assert.match(compose, /path: dist-pages/);
});
test('deployment remains strictly gated with shared concurrency and exact main and dev identity', () => {
  assert.match(deploy, /needs: \[build, compose\]/);
  assert.match(deploy, /node scripts\/verify-pages-snapshot\.mjs/);
  const guard = readFileSync('scripts/verify-pages-snapshot.mjs', 'utf8');
  assert.match(guard, /Object\.entries\(c\.expectedRefs\)/);
  assert.match(guard, /'ls-remote','origin',`refs\/heads\/\$\{branch\}`/);
  assert.match(guard, /pin==='CURRENT'\?current:pin/);
  assert.match(guard, /verifyPublishedBaseline\(c,api,current\)/);
  assert.ok(deploy.indexOf('verify-pages-snapshot.mjs') < deploy.indexOf('actions/deploy-pages@'));
  assert.match(workflow, /group: github-pages\n  cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /continue-on-error|if:.*always\(|contents: write|actions: write|windows-latest/);
});

test('dev preview compiles without test gates while explicit stable requests certify fully', () => {
  const stable = readFileSync('.github/workflows/release-stable.yml', 'utf8');
  assert.match(stable, /stable-release\.py validate-request/);
  assert.match(stable, /run: npm test/);
  assert.match(stable, /needs: \[certify, windows-smoke\]/);
  assert.match(stable, /npm run test:dist/);
  const focused = readFileSync('scripts/test-dev-preview.mjs', 'utf8');
  for (const file of ['background-music', 'music-integration', 'free-mode-menu-dom', 'portrait-packaging', 'audit-ci-build-deployment-transition', 'ci-build-artifact', 'ci-stable-retry']) assert.ok(focused.includes(file), file);
  assert.doesNotMatch(focused, /independent-audit\.test|enrichment-camera.*\.test/);
  assert.match(build, /- run: npm run build\n/);
  assert.doesNotMatch(workflow, /npm test|test:dist|test-dev-preview/);
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.equal(scripts.build, 'npm run check && vite build && node scripts/package-source.mjs');
});
