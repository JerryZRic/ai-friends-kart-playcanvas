/** Distinct race entries share the same six characters and menu. */
export const MAP_PROFILES=Object.freeze({
 coast:Object.freeze({id:'coast',label:'日落海岸',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈竞速',tag:'SUNSET COAST',detail:'中等复杂度海岸赛：高台爬坡、下坡连续弯、开阔发卡弯与港湾双弯，衔接长直道和道具超车路线。',icon:'☀'}),
 waterpark:Object.freeze({id:'waterpark',label:'晴空水上乐园',vehicle:'water-mount',entry:'./waterpark.html',description:'鲸鱼坐骑 · 六人水道竞速',tag:'SKY WATERPARK',detail:'中等复杂度水道赛：灯塔马蹄弯、花园错位弯、泻湖反向弯与桥下冲刺，借水面惯性选择滑行和道具路线。',icon:'≈'}),
 mountain:Object.freeze({id:'mountain',label:'云岭盘山道',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 六人三圈山路竞速',tag:'CLOUDRIDGE PASS',detail:'沿山脊爬升，穿过石桥与松林，在连续发卡弯和下坡长弯中掌握刹车、走线与漂移节奏。',icon:'△'}),
 town:Object.freeze({id:'town',label:'灯阶旧城环线',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 双路线旧城竞速',tag:'LANTERN TERRACE RALLY',detail:'从集市广场出发，选择紧凑灯巷或宽阔电车大道，在高架街桥、连续弯与汇合冲刺中争夺领先。',icon:'▦'}),
 quarry:Object.freeze({id:'quarry',label:'赤砾采石环道',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 砂岩采石场双路线竞速',tag:'REDSTRATA QUARRY',detail:'沿干燥砂岩台地爬升，在石脊窄道与重载环坡之间选线，穿过木栈桥下方的加工场并冲向装载区。',icon:'◇'}),
 forest:Object.freeze({id:'forest',label:'杉影星台环线',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 杉林天文台双路线竞速',tag:'CEDARLIGHT OBSERVATORY',detail:'穿过根谷连续弯与倾斜林碗，选择镜台便道或观星环路，再沿高架林冠桥返回山谷。',icon:'♧'}),
 workshop:Object.freeze({id:'workshop',label:'发条工坊回旋道',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 巨型钟表工坊双路线竞速',tag:'CLOCKWIND WORKSHOP',detail:'沿木制螺旋坡绕钟芯爬升，跨过旧路线，在工具柜便道与工作台外环之间选线，再穿过抽屉台阶返回起点。',icon:'⚙'}),
 harvest:Object.freeze({id:'harvest',label:'谷风麦垄回环',vehicle:'kart',entry:'./coast.html',description:'卡丁车 · 麦田果园双路线竞速',tag:'AMBERWIND HARVEST',detail:'沿麦垄梯田攀上风车山脊，在果园起伏弯后选择穿仓便道或金色田埂外环，穿过收获集市返回低地。',icon:'❋'}),
});
export type MapId=keyof typeof MAP_PROFILES;
export function resolveMap(id:unknown){return MAP_PROFILES[typeof id==='string'&&Object.prototype.hasOwnProperty.call(MAP_PROFILES,id)?id as MapId:'coast'];}
