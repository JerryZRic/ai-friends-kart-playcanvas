import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uiLayout} from '../src/ui-layout';
const css=readFileSync('src/menu.css','utf8')+'\n'+readFileSync('src/menu-fixed.css','utf8');
const fixed=readFileSync('src/menu-fixed.css','utf8'),html=readFileSync('index.html','utf8'),menu=readFileSync('src/menu.ts','utf8');

test('the complete menu shell and recovery panel live in one canonical frame',()=>{
 const frame=html.indexOf('id="menu-ui"');
 assert.match(html,/<div id="menu-ui" class="fixed-ui-root" data-fixed-layout="1440x900">/);
 for(const child of ['class="masthead"','id="menu"','id="menu-boot"','class="site-footer"'])assert.ok(html.indexOf(child)>frame,child);
 assert.match(html,/src\/ui-layout.css/);assert.match(html,/src\/menu-fixed.css/);
 assert.match(menu,/mountUiLayout\(shell,\(\)=>\{disposeBackdrop\?\.resize\(\);disposeCharacter\?\.resize\(\);\}\)/);
 assert.match(menu,/__menuBoot\?\.releaseLayout\?\.\(\)/);
 assert.match(menu,/mountUiViewportNotice\(shell\)/);
});

test('menu composition has no viewport-specific reflow or display-sized fonts',()=>{
 assert.doesNotMatch(css,/@media\s*\([^)]*(?:min|max)-(?:width|height)/);
 assert.doesNotMatch(css,/\d(?:s?v[wh]|dvh|lvh)\b/);
 assert.doesNotMatch(html,/\d(?:s?v[wh]|dvh|lvh)\b/);
 assert.match(fixed,/\.title-actions\{[^}]*grid-template-columns:repeat\(4,/);
 assert.match(fixed,/\.character-grid\{[^}]*grid-template-columns:repeat\(3,/);
 assert.match(fixed,/\.quality-options\{[^}]*grid-template-columns:repeat\(3,/);
 assert.match(fixed,/\.race-options-panel\{[^}]*grid-template-columns:252px minmax\(0,1fr\)[^}]*height:470px[^}]*max-height:584px[^}]*overflow-y:auto/);
 assert.match(fixed,/\.race-options-panel \.start-race\{[^}]*grid-column:1\/-1;grid-row:4[^}]*height:56px/);
 assert.match(fixed,/\.screen-settings>\.settings-panel\{[^}]*height:584px[^}]*overflow-y:auto/);
 assert.match(menu,/class="settings-panel" tabindex="0" aria-label="画面设置与操作说明"/);
 assert.match(fixed,/#character-preview\{width:100%!important;height:100%!important\}/);
});

test('title, story, header/footer, and scrollable settings remain proportionate inside every fit',()=>{
 const rectangles=[
  {name:'title actions',x:270,y:769,w:900,h:68},
  {name:'story dialog',x:510,y:300,w:420,h:300},
  {name:'header',x:0,y:0,w:1440,h:76},
  {name:'footer',x:72,y:848,w:1296,h:52},
  {name:'settings panel',x:72,y:244.8,w:900,h:584},
  {name:'race options panel',x:72,y:244.8,w:900,h:470},
  {name:'race start action',x:101,y:603.8,w:842,h:56},
 ];
 for(const [width,height] of [[1440,900],[1920,1080],[1280,720],[1180,757],[390,844],[844,390],[320,568],[2560,1080]]){
  const frame=uiLayout(width,height);
  for(const box of rectangles){
   const x=frame.left+box.x*frame.scale,y=frame.top+box.y*frame.scale,w=box.w*frame.scale,h=box.h*frame.scale;
   assert.ok(x>=0&&y>=0&&x+w<=width+1e-8&&y+h<=height+1e-8,`${box.name} at ${width}×${height}`);
   assert.ok(Math.abs(w/h-box.w/box.h)<1e-8);
  }
 }
});
