/** Distinct race entries share the same six characters and menu. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈竞速',tag:'SUNSET COAST',detail:'海风、棕榈与日落。驾驶卡丁车穿过海岸弯道，漂移蓄力争夺冠军。',icon:'☀'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 六人水道竞速',tag:'SKY WATERPARK',detail:'骑上鲸鱼坐骑跃入晴空水道，在透明水面与高架滑道间竞速。',icon:'≈'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[id==='waterpark'?'waterpark':'coast'];}
