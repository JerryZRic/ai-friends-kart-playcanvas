export type SceneKind = 'menu'|'garage'|'land'|'water';
/** Only exact project-local game routes become in-document navigation. */
export function sceneForUrl(url:URL,directory:URL):SceneKind|undefined {
 if(url.origin!==directory.origin)return;
 const pages:Record<string,SceneKind>={'index.html':'menu','garage.html':'garage','coast.html':'land','waterpark.html':'water'};
 if(url.pathname===directory.pathname)return 'menu';
 const name=url.pathname.slice(directory.pathname.length);
 return url.pathname.startsWith(directory.pathname)?pages[name]:undefined;
}
