import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

/** Dependency contracts supplement real entrypoint tests. They prevent the two
 * maps from silently forking player-facing components again; no GPU claim. */
test('both race adapters consume shared HUD, shell, input, camera and performance modules', () => {
  for (const entry of ['src/game.ts', 'src/waterpark-play.ts']) {
    const source = read(entry);
    for (const module of ['race-loading-camera', 'race-loading-ui', 'race-frame-clock', 'race-hud', 'race-shell', 'race-controls', 'race-camera', 'waterpark-performance-ui']) {
      assert.match(source, new RegExp(`from ['"]\\./${module}['"]`), `${entry} consumes ${module}`);
    }
    for (const call of ['createLoadingCamera', 'mountRaceLoadingUi', 'createRaceFrameClock', 'mountRaceHud', 'createRaceShell', 'bindRaceControls', 'chaseCamera', 'createPerformancePanel']) {
      assert.match(source, new RegExp(`\\b${call}\\(`), `${entry} instantiates ${call}`);
    }
    for (const method of ['start', 'setPaused', 'renderCountdown', 'finish', 'updateHUD', 'drawMinimap', 'tick', 'toggleSound', 'dispose']) {
      assert.match(source, new RegExp(`shell\\.${method}\\(`), `${entry} routes ${method} through shared shell`);
    }
    assert.doesNotMatch(source, /addEventListener\(['"]key(?:down|up)['"]/, `${entry} does not reinstall keyboard listeners`);
    assert.doesNotMatch(source, /itemImage\s*\(/, `${entry} does not regenerate inventory portraits`);
    assert.doesNotMatch(source, /createOscillator\s*\(/, `${entry} does not own a second sound engine`);
    assert.match(source, /track:\{length:[^,]+,sample(?:[:,}])/, `${entry} supplies geometry instead of forking minimap code`);
  }
});

test('shared modules remain independent of either map bootstrap and settings schema', () => {
  for (const path of ['src/race-loading-camera.ts', 'src/race-loading-ui.ts', 'src/race-frame-clock.ts', 'src/race-shell.ts', 'src/race-hud.ts', 'src/race-controls.ts', 'src/race-camera.ts']) {
    const source = read(path);
    assert.doesNotMatch(source, /from ['"]\.\/(?:game|waterpark-play|water-race|coast-race-rules)['"]/, `${path} cannot import an entry or map simulation`);
  }
  assert.doesNotMatch(read('src/race-shell.ts'), /(?:setInterval|requestAnimationFrame)\s*\(/, 'presentation cannot create an independent simulation/timer loop');
  assert.doesNotMatch(read('src/game-settings.ts'), /sound|muted|volume/, 'sound toggle does not change quality/refraction schema');
});
