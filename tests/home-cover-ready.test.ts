import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForHomeCover} from '../src/home-cover-ready';
const image=()=>Object.assign(new EventTarget(),{complete:false,naturalWidth:0,hidden:false}) as unknown as HTMLImageElement;
test('selected image readiness waits through fallback and completes on its load',async()=>{
 const img=image(),abort=new AbortController();let ready=false;
 const pending=waitForHomeCover(img,abort.signal).then(()=>{ready=true;});
 img.dispatchEvent(new Event('error'));await Promise.resolve();assert.equal(ready,false);
 img.dispatchEvent(new Event('load'));await pending;assert.equal(ready,true);
});
test('missing, loaded, failed, aborted and deadline images cannot strand startup',async()=>{
 const abort=new AbortController();await waitForHomeCover(null,abort.signal);
 const img=image();img.hidden=true;await waitForHomeCover(img,abort.signal);
 img.hidden=false;const pending=waitForHomeCover(img,abort.signal);abort.abort();await pending;
 await waitForHomeCover(image(),new AbortController().signal,1);
});
