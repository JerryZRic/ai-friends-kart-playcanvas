import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_SURFACES,NATIVE_GAME_CONTROLS,GAME_SURFACE_CSS,mountGameSurfaceGuards} from '../src/game-surface-guards';
class Target extends EventTarget {
 style={dataset:{},textContent:'',remove(){}};
 head={append:()=>{}};
 createElement(){return this.style;}
}
function fire(doc:Target,type:string,inside=true,native=false){
 const e=new Event(type,{cancelable:true});
 Object.defineProperty(e,'target',{value:{closest:(s:string)=>s===GAME_SURFACES?(inside?{}:null):s===NATIVE_GAME_CONTROLS?(native?{}:null):null}});
 doc.dispatchEvent(e);return e.defaultPrevented;
}
test('game surfaces block selection, image drag, menus and accidental gestures; outside remains native',()=>{
 const doc=new Target(),guard=mountGameSurfaceGuards(doc as unknown as Document);
 for(const type of ['dragstart','selectstart','contextmenu','dblclick','gesturestart','gesturechange']){
  assert.equal(fire(doc,type),true,type);assert.equal(fire(doc,type,false),false,type);assert.equal(fire(doc,type,true,true),false,type);
 }
 guard.dispose();assert.equal(fire(doc,'contextmenu'),false);
});
test('pointer/touch cancellation, clicks, keyboard and browser zoom wheel are never intercepted',()=>{
 const doc=new Target();mountGameSurfaceGuards(doc as unknown as Document);
 for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','click','keydown','wheel'])assert.equal(fire(doc,type),false,type);
});
test('CSS preserves two-axis menu scrolling and native controls while canvas and multi-touch controls retain none',()=>{
 assert.match(GAME_SURFACE_CSS,/touch-action:pan-x pan-y!important/);
 assert.match(GAME_SURFACE_CSS,/#game.*#kart-preview.*\[data-key\].*\[data-mobile-action\].*touch-action:none!important/);
 assert.match(GAME_SURFACE_CSS,/touch-action:auto!important/);
 for(const selector of ['input','textarea','select','a','contenteditable','data-native-browser'])assert.ok(NATIVE_GAME_CONTROLS.includes(selector));
 assert.match(GAME_SURFACE_CSS,/-webkit-user-drag:none/);
 for(const root of ['#mobileTouchControls','#raceSystemTools','#mobileControlModePanel'])assert.ok(GAME_SURFACES.includes(root));
 assert.doesNotMatch(GAME_SURFACE_CSS,/overflow:hidden|user-scalable|maximum-scale/);
});
