/** Explicit per-map identity. Kart gameplay stays in its existing entry/module. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./index.html',description:'卡丁车 · 六人三圈竞速'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 285 米可玩样段'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[id==='waterpark'?'waterpark':'coast'];}
