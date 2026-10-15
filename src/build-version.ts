/** Release identity is persistent across every scene in this document. */
declare const __GAME_BUILD_VERSION__: string;
export const GAME_VERSION = typeof __GAME_BUILD_VERSION__ === 'string' ? __GAME_BUILD_VERSION__ : '1.0.2a-dev.local';
export function mountBuildVersion(doc: Document): HTMLElement {
 const existing=doc.getElementById('game-version');
 if(existing)return existing;
 const label=doc.createElement('small');
 label.id='game-version';label.textContent=`v${GAME_VERSION}`;
 label.setAttribute('aria-label',`游戏版本 ${GAME_VERSION}`);
 Object.assign(label.style,{
  position:'fixed',left:'max(8px, env(safe-area-inset-left))',
  bottom:'max(5px, env(safe-area-inset-bottom))',zIndex:'10000',
  font:'500 10px/1.2 system-ui, sans-serif',letterSpacing:'.03em',
  color:'#fff3d4',background:'rgba(12,30,38,.62)',borderRadius:'3px',
  padding:'2px 4px',pointerEvents:'none',userSelect:'none',
 });
 doc.body.append(label);
 return label;
}

