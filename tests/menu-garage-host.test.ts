import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuGarageHost} from '../src/menu-garage-host';
import {isMenuGarageFrame,sendGarageNavigation} from '../src/garage-host-protocol';

class Element extends EventTarget {
  style={cssText:''}; attributes=new Map<string,string>(); children:Element[]=[];removed=false; title='';src='';textContent='';onclick?:()=>void;
  contentDocument=new EventTarget();disposals=0;contentWindow={__disposeEmbeddedGarage:()=>{this.disposals++;}};
  constructor(public tag='section'){super();}
  setAttribute(k:string,v:string){this.attributes.set(k,v);}getAttribute(k:string){return this.attributes.get(k);}
  append(...nodes:Element[]){this.children.push(...nodes);}remove(){this.removed=true;}focus(){}
}
function harness(){
 const win=new EventTarget() as any;win.location=new URL('https://example.test/dev/index.html?screen=characters&map=snow');
 const entries:string[]=[];win.history={pushState(_a:unknown,_b:unknown,url:string){entries.push(url);win.location=new URL(url);},replaceState(_a:unknown,_b:unknown,url:string){win.location=new URL(url);}};
 const doc={body:new Element('body'),createElement:(tag:string)=>new Element(tag)};
 let suspended=0,resumed=0,unlocks=0,cancels=0;const departures:string[]=[];const phases:string[]=[];
 const music={setPhase:(phase:string)=>phases.push(phase),unlock:()=>unlocks++};
 const host=createMenuGarageHost({document:doc as any,window:win,music:music as any,suspend:()=>suspended++,resume:()=>resumed++,depart:href=>departures.push(href),cancelDeparture:()=>cancels++});
 const frame=()=>doc.body.children.filter(e=>e.tag==='iframe'&&!e.removed).at(-1)!;
 const message=(data:unknown,source=frame()?.contentWindow,origin=win.location.origin)=>{win.dispatchEvent(Object.assign(new Event('message'),{data,source,origin}));};
 return {host,win,doc,frame,message,entries,departures,phases,get suspended(){return suspended;},get resumed(){return resumed;},get unlocks(){return unlocks;},get cancels(){return cancels;}};
}
test('menu garage keeps parent audio, owns one renderer, routes back and disposes before re-entry',()=>{
 const h=harness();assert.ok(h.host.navigate('garage.html?flow=free&map=snow&driver=whale'));
 const first=h.frame();assert.equal(h.suspended,1);assert.equal(h.phases.join(), 'menu');assert.match(first.src,/embedded=menu/);
 assert.equal(first.attributes.get('sandbox'),'allow-scripts allow-same-origin allow-forms');
 assert.equal(h.win.location.search.includes('garage=1'),true);
 first.dispatchEvent(new Event('load'));first.contentDocument.dispatchEvent(new Event('pointerdown'));assert.equal(h.unlocks,1);
 h.message({type:'kart-garage:ready'});assert.equal(h.doc.body.children.at(-1)!.removed,true);
 h.message({type:'kart-garage:navigate',href:'https://example.test/dev/index.html?screen=race-settings&map=snow'});
 assert.equal(h.resumed,1);assert.equal(first.disposals,1);assert.equal(first.removed,true);assert.equal(h.host.active,false);
 first.contentDocument.dispatchEvent(new Event('pointerdown'));assert.equal(h.unlocks,1,'removed frame gestures no longer reach parent');
 h.host.navigate('garage.html?map=snow');const second=h.frame();assert.notEqual(first,second);h.host.dispose();assert.equal(second.disposals,1);
});
test('messages require exact owner, origin, type, keys and project-local destination',()=>{
 const h=harness();h.host.navigate('garage.html?map=snow');
 const valid={type:'kart-garage:navigate',href:'https://example.test/dev/coast.html?map=snow'};
 h.message(valid,{} as any);h.message(valid,undefined,'https://evil.test');
 h.message({...valid,extra:true});h.message({...valid,href:'https://example.test/other/coast.html'});h.message({...valid,href:'javascript:alert(1)'});
 assert.equal(h.departures.length,0);h.message(valid);assert.deepEqual(h.departures,[valid.href]);
 h.host.dispose();h.message(valid);assert.equal(h.departures.length,1);
});
test('history restoration creates or destroys only the current garage, and direct menu does not mount it',()=>{
 const h=harness();assert.equal(h.host.restore(),false);h.host.navigate('garage.html?map=snow');const first=h.frame();
 assert.equal(h.host.restore(),true);assert.equal(first.disposals,0);
 h.win.location=new URL('https://example.test/dev/index.html?screen=characters');assert.equal(h.host.restore(),false);assert.equal(first.disposals,1);
 h.win.location=new URL(h.entries[0]);assert.equal(h.host.restore(),true);assert.equal(h.suspended,2);h.host.dispose();
});
test('only menu-owned child disables audio and relays navigation',()=>{
 const sent:unknown[]=[];const host={parent:{postMessage:(...args:unknown[])=>sent.push(args)},location:new URL('https://example.test/dev/garage.html?embedded=menu'),frameElement:{getAttribute:()=> 'true'}} as any;
 assert.equal(isMenuGarageFrame(host),true);assert.equal(sendGarageNavigation('index.html?screen=characters',host),true);assert.equal(sent.length,1);
 assert.equal(sendGarageNavigation('https://elsewhere.test/index.html',host),false);
 host.frameElement=null;assert.equal(isMenuGarageFrame(host),false);assert.equal(sendGarageNavigation('index.html',host),false);
});

test('garage applied builds replace parent history and later input cancels pending race departure',()=>{
 const h=harness();h.host.navigate('garage.html?map=snow&kart=old');const frame=h.frame();frame.dispatchEvent(new Event('load'));
 h.message({type:'kart-garage:state',href:'https://example.test/dev/garage.html?embedded=menu&map=snow&kart=new'});
 assert.equal(h.win.location.searchParams.get('kart'),'new');assert.equal(h.entries.length,1);
 assert.equal(h.host.restore(),true);assert.equal(h.frame(),frame);
 frame.contentDocument.dispatchEvent(new Event('keydown'));assert.equal(h.cancels,1);h.host.dispose();
});
