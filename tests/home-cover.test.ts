import assert from 'node:assert/strict';
import test from 'node:test';
import {HOME_COVERS,FALLBACK_HOME_COVER,chooseHomeCover,getDocumentHomeCover} from '../src/home-cover-registry';
import {mountHomeCover,type HomeCoverRuntime} from '../src/home-cover';
test('only approved shipped art participates; all five pending portraits stay disabled',()=>{
 assert.equal(HOME_COVERS.length,6);assert.equal(HOME_COVERS.filter(x=>x.approved).length,1);
 for(const roll of [0,.2,.5,.9,1,NaN,-1])assert.equal(chooseHomeCover(HOME_COVERS,()=>roll).id,'deepseek');
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
 mountHomeCover(f.image,FALLBACK_HOME_COVER,loader).dispose();assert.equal(imports,0);
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
