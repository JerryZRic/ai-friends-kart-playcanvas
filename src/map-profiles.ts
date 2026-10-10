/** Distinct race entries share the same six characters and menu. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈竞速',tag:'SUNSET COAST',detail:'中等复杂度海岸赛：高台爬坡、下坡连续弯、开阔发卡弯与港湾双弯，衔接长直道和道具超车路线。',icon:'☀'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 六人水道竞速',tag:'SKY WATERPARK',detail:'中等复杂度水道赛：灯塔马蹄弯、花园错位弯、泻湖反向弯与桥下冲刺，借水面惯性选择滑行和道具路线。',icon:'≈'}),
 mountain:Object.freeze({id:'mountain',label:'云岭盘山道',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈山路竞速',tag:'CLOUDRIDGE PASS',detail:'沿山脊爬升，穿过石桥与松林，在连续发卡弯和下坡长弯中掌握刹车、走线与漂移节奏。',icon:'△'}),
 town:Object.freeze({id:'town',label:'灯阶旧城环线',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 双路线旧城竞速',tag:'LANTERN TERRACE RALLY',detail:'从集市广场出发，选择紧凑灯巷或宽阔电车大道，在高架街桥、连续弯与汇合冲刺中争夺领先。',icon:'▦'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[typeof id==='string'&&Object.prototype.hasOwnProperty.call(MAP_PROFILES,id)?id as MapId:'coast'];}
