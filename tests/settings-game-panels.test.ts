import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uiLayout} from '../src/ui-layout';
const menu=readFileSync('src/menu.ts','utf8'),css=readFileSync('src/menu-fixed.css','utf8'),html=readFileSync('index.html','utf8');
test('settings are centered in the fixed frame with controls and help visible together',()=>{
 assert.match(css,/main\.screen-settings,#menu-ui main\.screen-race-settings\{padding:8px 170px 20px\}/);
 assert.match(css,/width:1100px;margin:0 auto/);
 assert.match(menu,/class="settings-panel system-options-panel"/);
 assert.match(css,/\.screen-settings>\.system-options-panel\{height:548px;display:grid;grid-template-columns:minmax\(0,1.45fr\) minmax\(0,1fr\)/);
 for(const id of ['menuControlMode','refraction','race-seed','start-race','reset-settings','settings-status'])assert.ok(menu.includes(`id="${id}"`),id);
 assert.ok(menu.includes('MUSIC_SETTINGS_MARKUP'));
 assert.ok(menu.includes('bindControlPreferenceSelect'));
 assert.ok(menu.includes('bindMusicSettings(root,music)'));
 assert.ok(menu.includes('name="quality"'));assert.ok(menu.includes('name="difficulty"'));
});
test('game navigation preserves routes and exposes icon plus visible text with interaction states',()=>{
 assert.match(menu,/class="back game-nav" aria-label="返回/);
 assert.match(menu,/data-screen="\$\{state.returnTo\}"/);
 assert.match(menu,/id="back-vehicle"/);
 assert.match(html,/class="garage-header-link game-nav" href="\.\/garage.html\?driver=whale"><svg[^>]*aria-hidden="true"/);
 for(const state of [':hover',':active',':focus-visible'])assert.ok(css.includes('.game-nav'+state));
 assert.match(css,/\.game-nav\{[^}]*min-height:54px/);
 assert.match(css,/\.game-nav svg\{[^}]*width:25px;height:25px/);
});
test('centered panel bounds keep their proportions in desktop, tablet and phone fits',()=>{
 for(const [width,height] of [[1440,900],[1920,1080],[1280,720],[844,390],[390,844],[320,568]]){
  const fit=uiLayout(width,height),left=fit.left+170*fit.scale,right=left+1100*fit.scale;
  assert.ok(Math.abs((left+right)/2-width/2)<1e-8);
  assert.ok(left>=0&&right<=width+1e-8);
  assert.ok(fit.top+820*fit.scale<=height+1e-8);
 }
});
