import assert from 'node:assert/strict';
import test from 'node:test';
import {HOME_COVERS,FALLBACK_HOME_COVER,chooseHomeCover,getDocumentHomeCover} from '../src/home-cover-registry';
import {mountHomeCover,type HomeCoverRuntime} from '../src/home-cover';
test('all six approved portraits participate, and unapproved entries are excluded',()=>{
 assert.equal(HOME_COVERS.length,6);assert.equal(HOME_COVERS.filter(x=>x.approved).length,6);
 for(const roll of [0,.2,.5,.9,1,NaN,-1])assert.equal(chooseHomeCover(HOME_COVERS.map(x=>({...x,approved:x.id==='deepseek'})),()=>roll).id,'deepseek');
 assert.equal(chooseHomeCover([],()=>0),FALLBACK_HOME_COVER);
 const ready=HOME_COVERS.map(x=>({...x,approved:true}));
 assert.deepEqual(ready.map((_,i)=>chooseHomeCover(ready,()=>i/6).id),ready.map(x=>x.id));
});
test('one selection per document survives remount, without storage or driver selection',()=>{
 const a={} as Document,b={} as Document;
 assert.equal(getDocumentHomeCover(a),getDocumentHomeCover(a));
 assert.equal(getDocumentHomeCover(b).approved,true);
});
function fixture(){
 const motion=Object.assign(new EventTarget(),{matches:false});
 const win=Object.assign(new EventTarget(),{matchMedia:()=>motion});
 const doc=Object.assign(new EventTarget(),{defaultView:win,hidden:false,createElement:()=>canvas});
 const canvas=Object.assign(new EventTarget(),{className:'',hidden:true,setAttribute(){},remove(){removed++;}});
 let removed=0;
 const image=Object.assign(new EventTarget(),{ownerDocument:doc,dataset:{} as Record<string,string>,hidden:false,src:'test.png',after(){}});
 return {image:image as unknown as HTMLImageElement,doc,win,motion,canvas,removed:()=>removed};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('static load failure uses approved DeepSeek once, then hides broken fallback',()=>{
 const f=fixture(),control=mountHomeCover(f.image,{id:'gpt',src:'test.png',approved:true});
 f.image.dispatchEvent(new Event('error'));assert.equal(f.image.src,FALLBACK_HOME_COVER.src);assert.equal(f.image.hidden,false);
 f.image.dispatchEvent(new Event('error'));assert.equal(f.image.hidden,true);control.dispose();control.dispose();
});
test('no adapter import for pending/no-model covers; reduced motion delays genuine adapter',async()=>{
 const f=fixture();let imports=0,disposed=0;const pauses:boolean[]=[];
 const runtime:HomeCoverRuntime={setPaused:value=>pauses.push(value),resize(){},dispose(){disposed++;}};
 const loader=async()=>{imports++;return {mount:async()=>runtime};};
 mountHomeCover(f.image,{...FALLBACK_HOME_COVER,model:undefined},loader).dispose();assert.equal(imports,0);
 f.motion.matches=true;
 const control=mountHomeCover(f.image,{...FALLBACK_HOME_COVER,model:'approved.model3.json'},loader);
 await flush();assert.equal(imports,0);
 f.motion.matches=false;f.motion.dispatchEvent(new Event('change'));await flush();assert.equal(imports,1);assert.equal(f.image.hidden,true);
 f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.image.hidden,false);assert.equal(pauses.at(-1),true);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.image.hidden,true);
 control.dispose();control.dispose();assert.equal(disposed,1);assert.equal(f.removed(),1);
});
test('navigation during asynchronous mount disposes late runtime; errors preserve static fallback',async()=>{
 const f=fixture();let resolve!:(value:HomeCoverRuntime)=>void,disposed=0;
 const control=mountHomeCover(f.image,{...FALLBACK_HOME_COVER,model:'approved.model3.json'},async()=>({mount:()=>new Promise(done=>resolve=done)}));
 await flush();control.dispose();resolve({setPaused(){},resize(){},dispose(){disposed++;}});await flush();assert.equal(disposed,1);assert.equal(f.image.hidden,false);
 const g=fixture();const failed=mountHomeCover(g.image,{...FALLBACK_HOME_COVER,model:'approved.model3.json'},async()=>{throw Error('offline');});
 await flush();assert.equal(g.image.hidden,false);assert.equal(g.image.dataset.coverMode,'static');failed.dispose();
});

test('context loss returns to static and does not restart a failed model',async()=>{
 const f=fixture();let imports=0,disposed=0;
 const control=mountHomeCover(f.image,{...FALLBACK_HOME_COVER,model:'approved.model3.json'},async()=>{imports++;return {mount:async()=>({setPaused(){},resize(){},dispose(){disposed++;}})};});
 await flush();assert.equal(f.image.hidden,true);f.canvas.dispatchEvent(new Event('webglcontextlost'));
 assert.equal(f.image.hidden,false);assert.equal(disposed,1);f.win.dispatchEvent(new Event('pageshow'));await flush();assert.equal(imports,1);control.dispose();
});

test('manual static switch prevents import, toggles static instantly, and survives pagehide/pageshow',async()=>{
 const f=fixture();let imports=0,disposed=0;const pauses:boolean[]=[];
 const control=mountHomeCover(f.image,FALLBACK_HOME_COVER,async()=>{imports++;return {mount:async()=>({setPaused:value=>pauses.push(value),resize(){},dispose(){disposed++;}})};},{enabled:false});
 await flush();assert.equal(imports,0);assert.equal(f.image.hidden,false);
 control.setAnimationEnabled(true);await flush();assert.equal(imports,1);assert.equal(f.image.hidden,true);
 control.setAnimationEnabled(false);await flush();assert.equal(f.image.hidden,false);assert.equal(f.canvas.hidden,true);assert.equal(pauses.at(-1),true);
 control.setAnimationEnabled(true);await flush();assert.equal(f.image.hidden,true);
 f.win.dispatchEvent(new Event('pagehide'));await flush();assert.equal(f.image.hidden,false);
 f.win.dispatchEvent(new Event('pageshow'));await flush();assert.equal(f.image.hidden,true);assert.equal(imports,1);
 control.dispose();assert.equal(disposed,1);
});
test('texture/mount failure and runtime pause exception leave the approved static original visible',async()=>{
 const f=fixture();const control=mountHomeCover(f.image,FALLBACK_HOME_COVER,async()=>({mount:async()=>{throw Error('texture missing');}}));
 await flush();assert.equal(f.image.hidden,false);assert.equal(f.image.dataset.coverMode,'static');control.dispose();
 const g=fixture();let disposed=0;const other=mountHomeCover(g.image,FALLBACK_HOME_COVER,async()=>({mount:async()=>({resize(){},dispose(){disposed++;},setPaused(){throw Error('GPU failure');}})}));
 await flush();assert.equal(g.image.hidden,false);assert.equal(g.image.dataset.coverMode,'static');assert.equal(disposed,1);other.dispose();
});
test('a failed static fallback is never resurrected by late adapter failure or disposal',async()=>{
 const f=fixture();let reject!:(reason:unknown)=>void;
 const control=mountHomeCover(f.image,FALLBACK_HOME_COVER,async()=>({mount:()=>new Promise((_,fail)=>reject=fail)}));
 await flush();f.image.dispatchEvent(new Event('error'));assert.equal(f.image.hidden,true);
 reject(Error('late texture failure'));await flush();assert.equal(f.image.hidden,true);
 control.dispose();assert.equal(f.image.hidden,true);
});
