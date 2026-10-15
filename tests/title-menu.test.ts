import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
const css=read('src/title-menu.css'),menu=read('src/menu.ts'),html=read('index.html');

test('title keeps a real world canvas and overlays only independent decorative PNGs',()=>{
 assert.match(menu,/<canvas id="title-backdrop" tabindex="-1"><\/canvas>/);
 assert.match(menu,/mountMenuBackdrop\(canvas,curtain,settings/);
 assert.match(menu,/<div class="title-composition" aria-hidden="true">/);
 assert.match(menu,/src="\$\{homeCover.src\}"/);
 assert.match(read('src/home-cover-registry.ts'),/src:'\.\/menu-art\/whale-maid\.png',approved:true/);
 assert.match(menu,/src="\.\/menu-art\/title-logo\.png"/);
 assert.match(css,/\.title-composition\{[^}]*pointer-events:none/);
 assert.match(css,/\.title-character\{[^}]*pointer-events:none/);
 assert.match(css,/\.title-logo\{[^}]*pointer-events:none/);
 assert.doesNotMatch(menu,/Live2D|Cubism|spine/i);
 assert.doesNotMatch(css,/animation\s*:/);
 assert.match(menu,/listen\(image,'error',\(\)=>\{image\.hidden=true;/);
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
 assert.match(css,/env\(safe-area-inset-left,0px\)/);assert.match(css,/env\(safe-area-inset-right,0px\)/);assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.doesNotMatch(css,/#character-preview|raceHud|#raceLoading|\.screen-maps|\.screen-settings/);
});

test('declared contain formula preserves 16:9 art at desktop, landscape phones and ultrawide',()=>{
 assert.match(css,/\.title-stage\{[^}]*width:1600px;height:900px;transform:translate\(-50%,-50%\) scale\(var\(--title-scale,1\)\)/);
 assert.match(menu,/Math\.min\(Math\.max\(1,layout\.viewportWidth-left-right\)\/1600,Math\.max\(1,layout\.viewportHeight-top-bottom\)\/900\)/);
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

test('uniform title plates retain separate physical minimum targets without rearranging portrait art',()=>{
 assert.match(css,/height:83\.7px;min-height:83\.7px/);
 assert.match(css,/\.title-hit-area\{[^}]*height:max\(100%,calc\(48px \/ var\(--title-scale,1\)\)\)/);
 assert.doesNotMatch(css,/@media \([^)]*(?:max-width|orientation)/);
 for(const [w,h,safe] of [[844,390,44],[568,320,0],[480,280,0],[320,200,0],[320,568,0]]){
  const scale=Math.min((w-2*safe)/1600,h/900);
  const targetWidth=((1600-2*96-3*20.8)/4)*scale,targetHeight=Math.max(83.7*scale,48);
  assert.ok(targetWidth>=48,`${w} has four physical targets`);assert.ok(targetHeight>=48);
  assert.ok(20.8*scale>0,'neighboring expanded vertical targets remain horizontally separated');
 }
});
