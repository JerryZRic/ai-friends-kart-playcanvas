import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBrandIntro} from '../src/brand-intro';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function harness(reduced=false,elapsed=0,hidden=false){
 const overlay=Object.assign(new EventTarget(),{removed:false,remove(){this.removed=true;},getAnimations:()=>[{animationName:'timewish-cover',currentTime:elapsed}]});
 const style={removed:false,remove(){this.removed=true;}};let completed=0,callback=()=>{};let delay=0;
 const window=Object.assign(new EventTarget(),{matchMedia:()=>({matches:reduced}),getComputedStyle:()=>({visibility:hidden?'hidden':'visible'}),setTimeout:(fn:()=>void,ms:number)=>{callback=fn;delay=ms;return 1;},clearTimeout:()=>{callback=()=>{};}});
 const doc={getElementById:()=>overlay,querySelector:()=>style};
 const intro=mountBrandIntro(doc as any,window as any,()=>completed++);
 return {intro,window,overlay,style,get completed(){return completed;},get delay(){return delay;},tick:()=>callback()};
}
test('intro finishes once, preserves elapsed CSS time, and releases recovery on error',()=>{
 const h=harness(false,500);assert.equal(h.delay,1560);h.tick();assert.equal(h.completed,1);assert.equal(h.overlay.removed,true);assert.equal(h.style.removed,true);h.intro.dispose();assert.equal(h.completed,1);
 const failed=harness();failed.window.dispatchEvent(new Event('unhandledrejection'));assert.equal(failed.completed,1);failed.tick();assert.equal(failed.completed,1);
});
test('reduced motion is brief and already-faded CSS never repeats on a slow bundle',()=>{
 assert.equal(harness(true).delay,860);assert.equal(harness(false,2000,true).completed,1);
});
test('approved outlined SVG bytes and aspect ratio are preserved across all cold entries',()=>{
 const svg=readFileSync('public/brand/timewish.svg');assert.equal(createHash('sha256').update(svg).digest('hex'),'0392baa24bd617a602a13164e4695309d8eb213baeb2f5be2bf532484666c8f8');
 for(const page of ['index.html','garage.html','coast.html','waterpark.html']){const html=readFileSync(page,'utf8');assert.match(html,/data-brand-intro/);assert.match(html,/height:auto/);assert.match(html,/prefers-reduced-motion/);}
 const host=readFileSync('src/spa.ts','utf8');assert.match(host,/script,noscript,\[data-brand-intro\]/);assert.match(host,/sceneRoot\.replaceChildren/);
});
