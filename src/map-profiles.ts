/** Distinct race entries share the same six characters and menu. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈竞速',tag:'SUNSET COAST',detail:'Level 0 海岸入门赛：连贯 S 弯、长短直道与缓坡观景段，宽窄变化中选择漂移和道具路线。',icon:'☀'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 六人水道竞速',tag:'SKY WATERPARK',detail:'Level 0 水道入门赛：骑上鲸鱼坐骑穿过连贯 S 弯、桥下直道与开阔回弯，借水面惯性选择道具路线。',icon:'≈'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[id==='waterpark'?'waterpark':'coast'];}
