// Lightweight navigation only: the entry menu never imports the WebGL game.
const panel=document.querySelector('.panel');
if(panel&&!document.querySelector('[data-menu-return]')){
 const nav=document.createElement('nav');nav.dataset.menuReturn='true';nav.setAttribute('aria-label','返回自由模式');nav.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin:14px 0';
 for(const [text,href] of [['← 主菜单','./index.html'],['重新选择地图','./index.html?screen=maps']]){const a=document.createElement('a');a.href=href;a.textContent=text;a.style.cssText='color:#d5ff60;padding:8px 0;font:600 12px system-ui';nav.append(a);}panel.prepend(nav);
}
