/** Browser affordances are suppressed only inside the game's own surfaces.
 * Native form controls/links and browser keyboard/wheel accessibility remain native.
 * OS/browser accessibility zoom overrides are intentionally not circumvented. */
export const GAME_SURFACES='#app-scene,#brand-intro,#startup-recovery,#mobileTouchControls,#raceSystemTools,#mobileControlModePanel';
export const NATIVE_GAME_CONTROLS='input,textarea,select,option,a,#perf-result,[contenteditable]:not([contenteditable="false"]),[data-native-browser]';
export const GAME_SURFACE_CSS=`
:where(${GAME_SURFACES}),:where(${GAME_SURFACES}) * {
 -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
 touch-action:pan-x pan-y!important;
}
:where(${GAME_SURFACES}) img {-webkit-user-drag:none;}
:where(${GAME_SURFACES}) #game,:where(${GAME_SURFACES}) #kart-preview,:where(${GAME_SURFACES}) [data-key],:where(${GAME_SURFACES}) [data-mobile-action] {touch-action:none!important;}
:where(${GAME_SURFACES}) :is(${NATIVE_GAME_CONTROLS}),:where(${GAME_SURFACES}) :is(${NATIVE_GAME_CONTROLS}) * {
 -webkit-user-select:text;user-select:text;-webkit-touch-callout:default;touch-action:auto!important;
}
`;
export function shouldGuardGameSurface(target:EventTarget|null){
 const element=target as Element|null;
 return !!element?.closest?.(GAME_SURFACES)&&!element.closest(NATIVE_GAME_CONTROLS);
}
export function mountGameSurfaceGuards(doc:Document=document){
 const style=doc.createElement('style');style.dataset.gameSurfaceGuards='true';style.textContent=GAME_SURFACE_CSS;doc.head.append(style);
 const suppress=(event:Event)=>{if(event.cancelable&&shouldGuardGameSurface(event.target))event.preventDefault();};
 // No touchstart/move or pointer interception: steering, throttle and camera
 // keep their independent pointer capture and pointercancel lifecycle.
 const events=['dragstart','selectstart','contextmenu','dblclick','gesturestart','gesturechange'] as const;
 for(const type of events)doc.addEventListener(type,suppress,{passive:false});
 return {dispose(){for(const type of events)doc.removeEventListener(type,suppress);style.remove();}};
}
