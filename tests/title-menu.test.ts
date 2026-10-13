import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
const css=read('src/title-menu.css'),menu=read('src/menu.ts'),html=read('index.html');

test('title keeps a real world canvas and overlays only independent decorative PNGs',()=>{
 assert.match(menu,/<canvas id="title-backdrop" tabindex="-1"><\/canvas>/);
 assert.match(menu,/mountMenuBackdrop\(canvas,curtain,settings/);
 assert.match(menu,/<div class="title-composition" aria-hidden="true">/);
 for(const name of ['whale-maid','title-logo'])assert.match(menu,new RegExp(`src="\\./menu-art/${name}\\.png"`));
 assert.match(css,/\.title-composition\{[^}]*pointer-events:none/);
 assert.match(css,/\.title-character\{[^}]*pointer-events:none/);
 assert.match(css,/\.title-logo\{[^}]*pointer-events:none/);
 assert.doesNotMatch(menu,/Live2D|Cubism|spine/i);
 assert.doesNotMatch(css,/animation\s*:/);
 assert.match(menu,/image\.addEventListener\('error',\(\)=>\{image\.hidden=true;/);
 assert.match(menu,/root\.querySelector\('\.title-logo'\)===image/,'late image completion cannot hide another screen title');
});

test('four number plates retain native buttons, real Chinese labels and decorative SVG icons',()=>{
 const title=menu.slice(menu.indexOf('if(state.screen===\'main\')root.innerHTML='),menu.indexOf(" if(state.screen==='maps'){",menu.indexOf('if(state.screen===\'main\')root.innerHTML=')));
 assert.equal((title.match(/class="title-action"/g)||[]).length,4);
 assert.equal((title.match(/<svg viewBox="0 0 32 32" aria-hidden="true">/g)||[]).length,4);
 for(const label of ['故事模式','自由模式','设置','退出'])assert.ok(title.includes(`<span>${label}</span>`));
 assert.match(title,/aria-hidden="true" hidden inert/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/button\[data-primary=true\]/);
 assert.match(css,/button:focus-visible\{outline:3px/);
 assert.match(css,/\.title-actions span\{white-space:nowrap/);
});

test('main-only physical sizing leaves loading, settings, map and race code paths separate',()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/href="\/src\/title-menu.css"/);
 assert.match(css,/body\[data-screen=main\] #menu-ui\{[^}]*transform:none/);
 assert.match(css,/body\[data-screen=main\] #menu-boot\{[^}]*width:min\(540px,calc\(100% - 40px\)\)/);
 assert.match(css,/body\[data-screen=main\] #menu-ui \.story-dialog\{[^}]*overflow:auto/);
 assert.match(css,/env\(safe-area-inset-left\)/);assert.match(css,/env\(safe-area-inset-right\)/);assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.doesNotMatch(css,/#character-preview|raceHud|#raceLoading|\.screen-maps|\.screen-settings/);
});

test('declared contain formula preserves 16:9 art at desktop, landscape phones and ultrawide',()=>{
 assert.match(css,/width:min\(100%,177\.777778cqh\);height:min\(56\.25cqw,100%\)/);
 // Arithmetic contract for declared CSS, not a browser screenshot/paint test.
 for(const [w,h] of [[1600,900],[1920,1080],[2560,1080],[844,390],[932,430],[568,320],[320,568]]){
  const aw=Math.min(w,h*16/9),ah=Math.min(w*9/16,h),left=(w-aw)/2,top=(h-ah)/2;
  assert.ok(Math.abs(aw/ah-16/9)<1e-8);
  assert.ok(left>=0&&top>=0&&left+aw<=w+.001&&top+ah<=h+.001);
  // Title box and face-bearing upper half stay inside the core frame.
  for(const box of [{x:.25,y:.02,w:.46,h:.24},{x:.64,y:.26,w:.30,h:.4}]){
   assert.ok(left+aw*box.x>=0&&top+ah*box.y>=0);
   assert.ok(left+aw*(box.x+box.w)<=w+.001&&top+ah*(box.y+box.h)<=h+.001);
  }
 }
});

test('small landscape controls have an independent minimum target and portrait stays usable',()=>{
 assert.match(css,/height:clamp\(48px,9\.3cqh,90px\);min-height:48px/);
 assert.match(css,/@media \(max-width:600px\) and \(orientation:portrait\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media \(max-width:420px\) and \(orientation:landscape\)/);
 for(const [w,h,safe] of [[844,390,44],[568,320,0],[480,280,0],[320,200,0]]){
  const side=Math.max(w*.06,safe),gap=Math.max(8,Math.min(w*.013,22));
  const targetWidth=(w-2*side-3*gap)/4,targetHeight=Math.max(48,Math.min(h*.093,90));
  assert.ok(targetWidth>=48,`${w} has four physical targets`);assert.ok(targetHeight>=48);
 }
});
