/** Distinct race entries share the same six characters and menu. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈竞速',tag:'SUNSET COAST',detail:'中等复杂度海岸赛：高台爬坡、下坡连续弯、开阔发卡弯与港湾双弯，衔接长直道和道具超车路线。',icon:'☀'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 六人水道竞速',tag:'SKY WATERPARK',detail:'中等复杂度水道赛：灯塔马蹄弯、花园错位弯、泻湖反向弯与桥下冲刺，借水面惯性选择滑行和道具路线。',icon:'≈'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[id==='waterpark'?'waterpark':'coast'];}
