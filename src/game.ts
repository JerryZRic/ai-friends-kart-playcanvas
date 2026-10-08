import * as pc from 'playcanvas';
import { itemImage, type ItemKind } from './item-models';
import { advancePickup, claimPickup, resetPickup } from './item-pickups';
import { keyCode, driveInput, driveSpeed, lateralInput, steeringYaw } from './vehicle-controls.js';
import { createOrbit, bindMouseLook } from './mouse-look.js';
import { DRIVERS, DEFAULT_DRIVER_ID, getDriver, raceOrder } from './driver-roster.js';
import { COURSE_FILES, loadCourseAssets, loadBundledDrivers, createImportedRacer, createLocalDriverStore, instantiateRenderEntity, type DriverAsset } from './assets';
import { createCoastScene, eachMesh, placeKart, color, type Spark } from './scene';
import { LENGTH, HALF, MAX_SPEED as MAX, sample, clamp, damp, scaled, degrees, UP } from './track';

declare global { interface Window { neonKart: any; webkitAudioContext?: typeof AudioContext; } }
const $ = (id: string): any => document.getElementById(id);
const canvas = $('game') as HTMLCanvasElement;
const map = ($('map') as HTMLCanvasElement).getContext('2d')!;
let app: pc.Application;
try {
  app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false, powerPreference: 'high-performance' } });
} catch (error) {
  $('loading').textContent = '当前浏览器无法启用 WebGL，请开启硬件加速或换用新版浏览器';
  throw error;
}
app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio || 1, 1.7);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
const world = createCoastScene(app);
const { camera, boxes, shield: shieldMesh, flames, particles } = world;
let state = 'loading', ready = false, elapsed = 0, countdown = 3, pos = 0, lane = 0, speed = 0,
  charge = 0, boost = 0, shield = 0, hit = 0, held: ItemKind | null = null,
  drifting = false, steerVis = 0, finishRank = 0, toastTime = 0, view = 0, muted = true,
  audio: AudioContext | null = null, clock = 0;
type RacerEntity = pc.Entity & { userData?: { driverId: string } };
type Bot = { id: string; phase: number; color: string; total: number; lateral: number; speed: number; slow: number; mesh: RacerEntity };
let bots: Bot[] = [], sparks: Spark[] = [], player: RacerEntity | null = null;
let selectedDriverId = DEFAULT_DRIVER_ID, chassisAsset: DriverAsset | null = null;
const controllers = new Map<string, ReturnType<typeof createImportedRacer>>();
let bundledDrivers = new Map<string, DriverAsset>(), bundledFailures = new Map<string, string>();
const courseAssets = new Map<string, DriverAsset>(), courseFiles = COURSE_FILES;
const keys: Record<string, boolean> = {}, orbit = createOrbit();
let mouseLook: ReturnType<typeof bindMouseLook>;
let courseBuilt = false, loadingBusy = false, loadingPromise: Promise<boolean> | null = null,
  loadingTimer: ReturnType<typeof setInterval> | null = null, loadingError: string | null = null;
let loadingSnapshot: any = { phase: 'course', records: [], receivedBytes: 0, totalBytes: 0, completed: 0, total: courseFiles.length, loaded: 0, failed: 0 };
const retryDeadlines=new Map();
const formatBytes=bytes=>bytes<1048576?(bytes/1024).toFixed(0)+' KiB':(bytes/1048576).toFixed(1)+' MiB';
function setLoadingSnapshot(snapshot){
  const previous=loadingSnapshot;
  loadingSnapshot={...snapshot,records:snapshot.records.map(record=>({...record}))};
  for(const record of loadingSnapshot.records){
    const key=loadingSnapshot.phase+':'+record.id;
    const old=previous.phase===loadingSnapshot.phase?previous.records.find(item=>item.id===record.id):null;
    if(record.stage==='waiting'){
      if(old?.stage!=='waiting'||old.attempt!==record.attempt||!retryDeadlines.has(key))retryDeadlines.set(key,Date.now()+Math.max(0,record.retryInMs||0));
    }else retryDeadlines.delete(key);
  }
  renderLoadingUI();
}
function renderLoadingUI(){
  const status=loadingSnapshot,course=status.phase==='course';
  const stageNames={queued:'等待下载',downloading:'下载中',decompressing:'校验 / 解压中',preparing:'解析 / 准备 3D 模型',ready:'已就绪',failed:'加载失败'};
  const progress=$('loadingProgress'),hasTotal=status.totalBytes>0;
  $('loadingSection').setAttribute('aria-busy',String(loadingBusy));
  $('loadingProgressLabel').textContent=(course?'赛道':'角色')+'下载进度（仅下载字节）';
  if(hasTotal){progress.max=status.totalBytes;progress.value=Math.min(status.receivedBytes,status.totalBytes);}
  else progress.removeAttribute?.('value');
  $('loadingBytes').textContent=formatBytes(status.receivedBytes)+(hasTotal?' / '+formatBytes(status.totalBytes)+' · '+Math.floor(Math.min(1,status.receivedBytes/status.totalBytes)*100)+'%':' · 正在确定下载大小');
  $('loadingDetails').textContent=status.records.map(record=>{
    const name=course?courseFiles.find(file=>file.id===record.id)?.label:getDriver(record.id).label;
    let detail=stageNames[record.stage]||record.stage;
    if(record.stage==='waiting'){
      const seconds=Math.max(0,Math.ceil(((retryDeadlines.get(status.phase+':'+record.id)||Date.now())-Date.now())/1000));
      detail=seconds+' 秒后自动重试（第 '+(record.attempt+1)+' / '+record.maxAttempts+' 次）';
    }else if(record.stage==='downloading')detail+=' · '+formatBytes(record.receivedBytes)+(record.totalBytes?' / '+formatBytes(record.totalBytes):'');
    if(record.stage==='failed'&&record.error)detail+=' · '+record.error;
    return name+'：'+detail;
  }).join('\n');
  if(loadingBusy){
    const preparing=status.records.some(record=>record.stage==='preparing'||record.stage==='decompressing');
    const downloading=status.records.some(record=>record.stage==='downloading'||record.stage==='queued'||record.stage==='waiting');
    $('loading').textContent=(course?'正在准备赛道':'正在加载角色')+' · 已就绪 '+status.loaded+' / '+status.total+(preparing&&!downloading?' · 下载完成，正在处理模型':'');
  }else if(loadingError&&courseBuilt){
    $('loading').textContent='模型准备失败：'+loadingError+'；请重试';
  }else if(!courseBuilt){
    $('loading').textContent='赛道资源加载失败，请检查网络后重试';
  }else if(bundledFailures.size){
    $('loading').textContent='角色加载失败：'+[...bundledFailures.keys()].map(id=>getDriver(id).label).join('、')+'；可重试，或使用原创替身开始比赛';
  }else $('loading').textContent='6 / 6 角色已就绪 · 非商业试玩';
  const canRetry=!loadingBusy&&!localDrivers.busy&&(loadingError||!courseBuilt||bundledFailures.size>0)&&(state==='loading'||state==='menu'||state==='finished');
  $('retryLoading').classList[!loadingBusy&&(loadingError||!courseBuilt||bundledFailures.size>0)?'remove':'add']('hidden');
  $('retryLoading').disabled=!canRetry;
  $('retryLoading').textContent=courseBuilt?(loadingError?'重试模型准备':'重试失败角色（'+bundledFailures.size+'）'):'重试赛道资源';
}
async function prepareCourseAssets() {
  const loaded = await loadCourseAssets(app, { existing: courseAssets, onStatus: status => setLoadingSnapshot({ phase: 'course', ...status }) });
  for (const [id, asset] of loaded.assets) courseAssets.set(id, asset);
  if (loaded.failures.size) throw new Error('原创赛道资源未完整加载，请重试');
}
function buildCourse() {
  if (courseBuilt) return;
  world.buildProps(courseAssets);
  chassisAsset = courseAssets.get('chassis')!;
  courseBuilt = true;
}
function boot(): Promise<boolean> {
  if (loadingPromise) return loadingPromise;
  if (localDrivers.busy || !['loading', 'menu', 'finished'].includes(state) || (ready && !bundledFailures.size && !loadingError)) return Promise.resolve(false);
  loadingBusy = true; ready = false; loadingError = null; $('loadingDetailGroup').open = true;
  const returnState = state === 'finished' ? 'finished' : 'menu'; state = 'loading';
  $('startText').textContent = courseBuilt ? '正在重试角色' : '正在准备赛道'; updateDriverUI();
  loadingTimer = setInterval(renderLoadingUI, 250);
  loadingPromise = (async () => {
    try {
      if (!courseBuilt) { await prepareCourseAssets(); buildCourse(); setupRacers(); }
      const loaded = await loadBundledDrivers(app, { existingDrivers: bundledDrivers, onStatus: status => setLoadingSnapshot({ phase: 'drivers', ...status }), onProgress: updateDriverUI });
      bundledDrivers = loaded.drivers; bundledFailures = loaded.failures;
      setupRacers(); ready = true; state = returnState;
      $('startText').textContent = bundledFailures.size ? '开始比赛（含原创替身）' : returnState === 'finished' ? '再来一场' : '开始比赛';
      return true;
    } catch (error) {
      console.error(error); loadingError = error instanceof Error ? error.message : '未知准备错误';
      $('startText').textContent = '资源加载未完成';
      if (courseBuilt) for (const slot of DRIVERS) if (!bundledDrivers.has(slot.id)) bundledFailures.set(slot.id, loadingError);
      return false;
    } finally {
      loadingBusy = false; loadingPromise = null; if (loadingTimer) clearInterval(loadingTimer); loadingTimer = null;
      $('loadingDetailGroup').open = !ready || bundledFailures.size > 0; updateDriverUI(); renderLoadingUI();
    }
  })();
  return loadingPromise;
}
function tone(freq=500,d=.1){if(muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.start();o.stop(audio.currentTime+d)}catch{}}
function toast(s){$('toast').textContent=s;toastTime=2.1;$('toast').style.opacity=1}
function rank(){return 1+bots.filter(b=>b.total>pos).length}
function releaseRacers() {
  for (const actor of [player, ...bots.map(bot => bot.mesh)].filter(Boolean) as RacerEntity[]) {
    const controller = controllers.get(actor.userData?.driverId || '');
    if (controller) controller.dispose();
    else { eachMesh(actor, mesh => mesh.material.destroy()); actor.destroy(); }
  }
  controllers.clear(); player = null; bots = [];
}
function racerFor(slot): RacerEntity {
  const asset = localDrivers.get(slot.id) || bundledDrivers.get(slot.id);
  let entity: RacerEntity;
  if (asset && chassisAsset) {
    const controller = createImportedRacer(app, asset, chassisAsset, slot);
    controllers.set(slot.id, controller); entity = controller.root;
  } else {
    entity = new pc.Entity('Fallback racer placement');
    entity.addChild(instantiateRenderEntity(courseAssets.get('kart')!));
    eachMesh(entity, mesh => {
      const m = mesh.material.clone() as pc.StandardMaterial;
      if (/body|paint|helmet/i.test(m.name) && !/visor/i.test(m.name)) m.diffuse = color(slot.color);
      m.update(); mesh.material = m; mesh.castShadow = true;
    });
  }
  entity.userData = { driverId: slot.id }; app.root.addChild(entity); return entity;
}
function setupRacers(){releaseRacers();const order=raceOrder(selectedDriverId);player=racerFor(order[0]);bots=order.slice(1).map((slot,i)=>({id:slot.id,phase:i,color:slot.color,total:12+Math.floor(i/2)*5.2,lateral:(i%2?1:-1)*3.2,speed:MAX*(.84+i*.018),slow:0,mesh:racerFor(slot)}));placeKart(player,pos,lane,0);bots.forEach(b=>placeKart(b.mesh,b.total,b.lateral,0));}
function reset(){if(!ready||loadingBusy||localDrivers.busy)return;mouseLook.release();orbit.recenter(true);elapsed=0;countdown=3.1;pos=0;lane=-2;speed=charge=boost=shield=hit=0;held=null;drifting=false;steerVis=0;finishRank=0;sparks=[];for(let k in keys)keys[k]=false;boxes.forEach(b=>resetPickup(b));setupRacers();state='countdown';document.body.classList.remove('menu');$('overlay').classList.add('hidden');$('count').classList.remove('paused');$('count').textContent='3';$('pause').textContent='Ⅱ';updateDriverUI();canvas.focus?.({preventScroll:true});updateLookHint();updateHUD();snapCamera=true;tone(500)}
const canImport=()=>ready&&!loadingBusy&&(state==='menu'||state==='finished');
const localDrivers=createLocalDriverStore(app,{canImport,onBusy:()=>{updateDriverUI();renderLoadingUI();},onChange:()=>{if(ready){setupRacers();updateDriverUI();}}});
function updateDriverUI(){
  const editable=canImport();
  for(const slot of DRIVERS){const button=$('slot-'+slot.id);button.disabled=!editable;button.setAttribute('aria-pressed',String(slot.id===selectedDriverId));button.textContent=slot.label+' · '+(localDrivers.has(slot.id)?'本地替换':bundledDrivers.has(slot.id)?'已就绪':ready?'加载失败 · 原创替身':'加载中');}
  $('start').disabled=!ready||loadingBusy||localDrivers.busy;
  $('retryLoading').disabled=loadingBusy||localDrivers.busy||!['loading','menu','finished'].includes(state);
  $('importButton').disabled=!editable||!chassisAsset;
  $('driverFiles').disabled=!editable||!chassisAsset;
  $('clearDriver').disabled=!editable||localDrivers.busy||!localDrivers.has(selectedDriverId);
  $('importSummary').textContent=localDrivers.busy?'正在检查本地 GLB，完成前暂停开始比赛…':bundledDrivers.size+' / 6 个默认角色已加载 · '+DRIVERS.filter(slot=>localDrivers.has(slot.id)).length+' 个本地替换'+(bundledFailures.size?' · 加载失败槽位使用原创替身':'');
}
function selectDriver(id){if(!canImport()||!DRIVERS.some(slot=>slot.id===id))return false;selectedDriverId=id;setupRacers();updateDriverUI();snapCamera=true;return true;}
let importStatusVersion=0;
async function importDrivers(files,slotId=selectedDriverId){
  // Capture selection before awaiting file reads. No selected bytes leave memory.
  const chosen=Array.from(files||[]) as File[];if(!chosen.length)return [];
  if(!canImport()||!chassisAsset){$('importStatus').textContent='请在赛前菜单导入；需先加载原创底盘';return [];}
  const statusVersion=++importStatusVersion;
  const results=await localDrivers.importFiles(chosen,slotId);
  if(statusVersion!==importStatusVersion)return results;
  const imported=results.filter(result=>result.status==='fulfilled'&&result.value.status==='imported').length;
  const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason.message);
  $('importStatus').textContent=(imported?'已导入 '+imported+' 个本地模型。':'')+(errors.length?'导入未完成：'+errors.join('；')+'。之前的模型保持可用。':imported?'仅当前页面会话可用，刷新后清除。':'导入取消或已被较新的选择替代。');
  return results;
}
for(const slot of DRIVERS)$('slot-'+slot.id).onclick=()=>selectDriver(slot.id);
$('importButton').onclick=()=>{if(canImport()&&chassisAsset)$('driverFiles').click();};
$('driverFiles').addEventListener('change',(event: any)=>{const files=Array.from(event.target.files||[]),slotId=selectedDriverId;event.target.value='';void importDrivers(files,slotId);});
$('clearDriver').onclick=()=>{if(localDrivers.clear(selectedDriverId)){importStatusVersion++;$('importStatus').textContent=bundledDrivers.has(selectedDriverId)?'该槽位已恢复默认角色':'该槽位恢复原创替身（默认模型加载失败）';}};
$('start').onclick=reset;
$('retryLoading').onclick=()=>{void boot();};
function pause(){if(state==='running'||state==='countdown'){state='paused';clearInputs();mouseLook.release();$('count').textContent='已暂停';$('count').classList.add('paused');$('pause').textContent='▶';updateLookHint();}else if(state==='paused'){state=countdown>0?'countdown':'running';$('count').textContent='';$('count').classList.remove('paused');$('pause').textContent='Ⅱ';updateLookHint()}}$('pause').onclick=pause;
$('camera').onclick=()=>{view=(view+1)%2;orbit.recenter(true);toast(view?'高位追逐视角':'低位追逐视角');snapCamera=true};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'♪':'♫';$('sound').setAttribute('aria-label',muted?'开启音效':'关闭音效');tone()};
function useItem(){if(state!=='running'||!held)return;let item=held;held=null;if(item==='boost'){boost=3.3;toast('涡轮加速！');tone(900,.3)}else if(item==='shield'){shield=6;toast('能量护盾 · 6 秒');tone(650,.3)}else{let target=bots.filter(b=>b.total>pos&&b.total-pos<120).sort((a,b)=>a.total-b.total)[0];if(target){target.slow=3;toast('脉冲命中前车！');for(let i=0;i<18;i++)emit(target.mesh.getPosition(),'pulse');tone(160,.3)}else{boost=1.9;toast('前方无目标 · 转化为加速');tone(850)}}updateHUD()}
$('item').onclick=useItem;
const handledCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','ShiftLeft','ShiftRight','KeyE','KeyZ','KeyC','KeyP','KeyQ','Escape']);
const interactiveTarget=target=>!!target?.closest?.('button,input,select,textarea,a,[contenteditable]');
const nativeKey=(event,code)=>!!event.target?.closest?.('input,select,textarea,[contenteditable]')||(interactiveTarget(event.target)&&((state==='menu'||state==='finished')||code==='Space'||code==='Enter'));
addEventListener('keydown',e=>{const code=keyCode(e);if(nativeKey(e,code))return;if(handledCodes.has(code))e.preventDefault();if(!e.repeat){if(code==='KeyE')useItem();if(code==='KeyP')pause();if(code==='Escape')release();if(code==='KeyQ'){orbit.recenter();toast('视角回正');}if(code==='KeyZ'||code==='KeyC')$('camera').click();if(code==='Enter'&&(state==='menu'||state==='finished'))reset()}if(state==='running'||state==='countdown')keys[code]=true});
addEventListener('keyup',e=>{const code=keyCode(e);if(nativeKey(e,code)){keys[code]=false;return;}if(handledCodes.has(code))e.preventDefault();keys[code]=false});
function clearInputs(){for(let k in keys)keys[k]=false;charge=0;drifting=false;}
function release(){clearInputs();if(state==='running'||state==='countdown')pause();else mouseLook.release()}addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.button===2&&(state==='running'||state==='countdown')){e.preventDefault();keys.RearView=true;if(document.pointerLockElement!==canvas)canvas.setPointerCapture(e.pointerId)}});
// Mouse events track individual buttons even when buttons are chorded; pointerup
// fires only when the last pressed mouse button is released.
canvas.addEventListener('mousedown',e=>{if(e.button===2&&(state==='running'||state==='countdown')){e.preventDefault();keys.RearView=true}});
document.addEventListener('mouseup',e=>{if(e.button===2)keys.RearView=false});
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&typeof e.buttons==='number')keys.RearView=!!(e.buttons&2)&&(state==='running'||state==='countdown')});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{keys.RearView=false});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.addEventListener('pointerdown',(e: PointerEvent)=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(state==='running'||state==='countdown')keys[b.dataset.key]=true});for(let ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys[b.dataset.key]=false)});
let lookStatus='free';
function updateLookHint(){
  $('lookHint').textContent=state==='paused'?'已暂停 · 单击赛道继续并环顾 · P 继续':lookStatus==='locked'?'移动鼠标环顾 · Q 回正 · 右键回看 · Esc 暂停并释放鼠标':lookStatus==='drag'?'按住鼠标左键拖动环顾 · Q 回正 · Esc 暂停':'单击赛道，移动鼠标环顾 · Q 回正 · Esc 暂停';
}
mouseLook=bindMouseLook(canvas,document,{orbit,isActive:()=>state==='running'||state==='countdown',activate:()=>{if(state==='paused')pause()},onRelease:release,onStatus:status=>{lookStatus=status;updateLookHint()},canMove:()=>!keys.RearView});
let shownItem: ItemKind | null | undefined;
function updateItemImage(){
  if(shownItem===held)return;shownItem=held;const image=$('itemImage');
  image.hidden=!held;
  if(held){image.src=itemImage(held);image.alt=({boost:'涡轮加速模型',shield:'能量护盾模型',pulse:'追踪脉冲模型'})[held];}
  else{image.removeAttribute('src');image.alt='';}
  $('item').dataset.held=held||'empty';
  $('item').setAttribute('aria-label',held?({boost:'使用涡轮加速',shield:'使用能量护盾',pulse:'使用追踪脉冲'})[held]:'等待道具');
}
function updateHUD(){updateItemImage();$('rank').innerHTML=(finishRank||rank())+' <small>/ 6</small>';$('lap').innerHTML=Math.max(1,Math.min(3,Math.floor(pos/LENGTH)+1))+' <small>/ 3</small>';$('timer').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');$('speed').textContent=(speed<-.1?'R ':'')+Math.round(Math.abs(speed)*3.6);$('charge').style.width=Math.min(100,charge/1.4*100)+'%';$('chargeLabel').textContent=boost>0?'涡轮加速中！':shield>0?'能量护盾保护中':charge>=.6?'松开 Shift，释放漂移加速':Math.abs(speed)<.1?'按住 W 油门起步':'左 Shift + A / D 手刹漂移';$('itemName').textContent=held?({boost:'ϟ 涡轮加速',shield:'◉ 能量护盾',pulse:'✦ 追踪脉冲'})[held]:'◇ 等待道具';$('itemHelp').textContent=held?'点击这里或按 E 使用':'撞箱拾取 · 问号为随机道具'}
function finish(){finishRank=rank();state='finished';clearInputs();mouseLook.release();document.body.classList.add('menu');$('overlay').classList.remove('hidden');$('title').innerHTML=finishRank===1?'GOLDEN<br><em>FINISH.</em>':'ONE MORE<br><em>RIDE?</em>';$('subtitle').textContent=finishRank===1?'冠军冲线，漂亮的超越':'追逐日落，再快一点点';$('desc').textContent='日落海岸 · 三圈大奖赛';$('results').classList.remove('hidden');$('results').textContent='第 '+finishRank+' / 6 名 · '+elapsed.toFixed(2)+' 秒';$('startText').textContent='再来一场';updateDriverUI();tone(1000,.4)}
function emit(p: pc.Vec3, type = 'spark') {
  if (sparks.length >= 160) return;
  sparks.push({ p: p.clone(), v: new pc.Vec3((Math.random() - .5) * 4, 1 + Math.random() * 2, (Math.random() - .5) * 4), t: type === 'pulse' ? .8 : .45, max: .65 });
}
function update(dt){if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0}if(state==='countdown'){let old=Math.ceil(countdown);countdown-=dt;let cur=Math.ceil(countdown);$('count').textContent=cur>0?cur:'GO!';if(cur!==old)tone(cur>0?500:1000,.15);if(countdown<=0){state='running';$('count').textContent='';toast('按住 W 起步 · 空格刹车 · Shift 手刹漂移')}return}if(state!=='running')return;
elapsed+=dt;boost=Math.max(0,boost-dt);shield=Math.max(0,shield-dt);hit=Math.max(0,hit-dt);const input=driveInput(keys),steer=input.steer;let now=sample(pos),next=sample(pos+7);let curvature=now.t.x*next.t.z-now.t.z*next.t.x;
let wantDrift=input.handbrake&&!!steer&&!input.brake&&!input.reverse&&speed>MAX*.4;if(wantDrift){charge=Math.min(1.6,charge+dt);if(Math.random()<.8){let p=scaled(now.p.clone(),now.n,lane+steer*.85);p.y+=.35;emit(p)}}else if(drifting){if(charge>.6&&!input.brake&&!input.reverse){boost=Math.max(boost,Math.min(2.5,charge*1.5));toast('漂移加速！');tone(850,.2)}charge=0}drifting=wantDrift;
let limit=boost>0?MAX*1.34:MAX;if(Math.abs(lane)>6.3)limit*=.58;if(hit>0)limit*=.55;speed=driveSpeed(speed,input,dt,limit);lane+=lateralInput(steer,speed,MAX,drifting,dt)+curvature*speed*dt*.43;lane=clamp(lane,-6.75,6.75);steerVis=damp(steerVis,steeringYaw(steer,speed,drifting),8,dt);
let previous=pos;pos+=speed*dt;if(pos>previous&&previous>=0&&Math.floor(previous/LENGTH)<Math.floor(pos/LENGTH)&&pos<LENGTH*3){toast('第 '+(Math.floor(pos/LENGTH)+1)+' 圈！');tone(750,.2)}
for(let b of bots){b.slow=Math.max(0,b.slow-dt);b.total+=b.speed*(b.slow>0?.42:1)*dt;b.lateral=damp(b.lateral,Math.sin(b.total/51+b.phase)*4.5,1.6,dt);if(Math.abs(b.total-pos)<2.9&&Math.abs(b.lateral-lane)<1.85&&hit<=0&&shield<=0){hit=.55;speed*=.77;lane+=lane>b.lateral?.55:-.55;tone(110,.1)}}
for(const b of boxes){advancePickup(b,dt);const dist=((b.d-pos)%LENGTH+LENGTH)%LENGTH;if((dist<1.8||dist>LENGTH-1.8)&&Math.abs(b.lateral-lane)<1.25){const reward=claimPickup(b,held!==null);if(reward){held=reward;tone(1200,.12);toast('获得道具 · E 使用')}}}
if(pos>=LENGTH*3)finish();updateHUD()}

/* NATIVE_DRAW */
const mapPath=Array.from({length:100},(_,i)=>sample(i/100*LENGTH).p);function drawMap(){map.clearRect(0,0,260,230);const coord=p=>[130+p.x*.6,114+p.z*.6];map.beginPath();mapPath.forEach((p,i)=>{let [x,y]=coord(p);i?map.lineTo(x,y):map.moveTo(x,y)});map.closePath();map.strokeStyle='#163b4bbb';map.lineWidth=12;map.stroke();map.strokeStyle='#eef5e9bb';map.lineWidth=4;map.stroke();for(let b of [...bots.map(b=>({d:b.total,color:b.color,player:false})),{d:pos,color:getDriver(selectedDriverId).color,player:true}]){let [x,y]=coord(sample(b.d).p);map.beginPath();map.arc(x,y,b.player?5.5:3.5,0,Math.PI*2);map.fillStyle=b.color;map.fill();map.strokeStyle='#163b4b';map.lineWidth=1.5;map.stroke()}}

let snapCamera = true, lastRearView = false;
function draw(dt: number) {
  const active = state === 'running' || state === 'countdown';
  for (const [id, controller] of controllers) {
    const bot = bots.find(b => b.id === id);
    controller.update(dt, active ? bot ? Math.sin(bot.total / 51 + bot.phase) * .65 : driveInput(keys).steer : 0, state === 'paused');
  }
  const rearView = driveInput(keys).rearView;
  if (rearView !== lastRearView) { snapCamera = true; lastRearView = rearView; }
  world.oceanMaterial.setParameter('time', clock);
  for (const box of boxes) {
    box.mesh.enabled = box.cool <= 0;
    box.mesh.setEulerAngles(degrees(Math.sin(clock * .8) * .15), degrees(clock * .8), degrees(.18));
    const p = box.mesh.getPosition(); box.mesh.setPosition(p.x, box.base + Math.sin(clock * 2 + box.d) * .17, p.z);
  }
  if (player) {
    const s = placeKart(player, pos, lane, steerVis);
    bots.forEach(b => placeKart(b.mesh, b.total, b.lateral, Math.sin(b.total / 65) * .06));
    const menu = state === 'menu' || state === 'finished';
    let cameraPosition: pc.Vec3, look: pc.Vec3;
    if (menu) {
      const t = clock * .12, focus = sample(state === 'finished' ? pos : 0);
      cameraPosition = scaled(scaled(focus.p.clone(), focus.t, 10 + Math.sin(t) * 2), focus.n, 15 + Math.cos(t) * 2);
      cameraPosition.y += 7.7;
      look = scaled(scaled(focus.p.clone(), focus.n, -3.8), focus.t, 8); look.y += 1.2;
      camera.camera!.fov = 53;
    } else {
      const angles = orbit.step(state === 'paused' ? 0 : dt);
      const yaw = rearView ? Math.PI : angles.yaw, pitch = rearView ? 0 : angles.pitch;
      const behind = view ? 15 : 10.5, height = view ? 7.9 : 4.6;
      const forward = new pc.Vec3(s.t.x, 0, s.t.z).normalize();
      new pc.Quat().setFromAxisAngle(UP, degrees(-yaw)).transformVector(forward, forward);
      const radius = Math.hypot(behind, height - 1), elevation = clamp(Math.atan2(height - 1, behind) + pitch, .08, 1.15);
      cameraPosition = scaled(s.p.clone(), forward, -radius * Math.cos(elevation));
      cameraPosition.y += 1 + radius * Math.sin(elevation);
      look = scaled(s.p.clone(), forward, (view ? 12 : 16) * Math.cos(elevation)); look.y += 1 - Math.sin(pitch) * 8;
      camera.camera!.fov = damp(camera.camera!.fov, boost > 0 ? 65 : 56, 3, dt);
    }
    if (snapCamera) { camera.setPosition(cameraPosition); snapCamera = false; }
    else camera.setPosition(new pc.Vec3().lerp(camera.getPosition(), cameraPosition, 1 - Math.exp(-dt * (menu ? 1.8 : 8))));
    camera.lookAt(look);
    shieldMesh.enabled = shield > 0;
    shieldMesh.setPosition(player.getPosition().clone().add(new pc.Vec3(0, 1.2, 0)));
    for (const flame of flames) {
      flame.mesh.enabled = boost > 0;
      const p = scaled(scaled(s.p.clone(), s.t, -2.2), s.n, flame.side * .54); p.y += .55;
      flame.mesh.setPosition(p);
      flame.mesh.setRotation(new pc.Quat().setFromDirections(UP, s.t.clone().mulScalar(-1)));
      flame.mesh.setLocalScale(1, .8 + Math.random() * .5, 1);
    }
    eachMesh(controllers.get(selectedDriverId)?.chassis || player, mesh => {
      const mat = mesh.material as pc.StandardMaterial;
      if (/body|paint/i.test(mat.name) && mat.emissive) mat.emissive.set(hit > 0 && Math.floor(clock * 12) % 2 ? .333 : 0, 0, 0);
    });
  }
  for (const spark of sparks) { spark.t -= dt; scaled(spark.p, spark.v, dt); spark.v.y -= 5 * dt; }
  sparks = sparks.filter(s => s.t > 0);
  particles.forEach((entity, i) => {
    entity.enabled = i < sparks.length;
    if (entity.enabled) { entity.setPosition(sparks[i].p); const scale = Math.max(.1, sparks[i].t / .5); entity.setLocalScale(scale, scale, scale); }
  });
  drawMap();
}

function getState() {
  const stats = app.stats as any;
  return {
    engine: 'PlayCanvas', state, pos, lane, speed, elapsed, charge, boost, shield, held, drifting, steerVis,
    lap: Math.max(1, Math.min(3, Math.floor(pos / LENGTH) + 1)), length: LENGTH, rank: finishRank || rank(), camera: view,
    muted, mouseLook: { ...orbit.get(), ...mouseLook.get() }, modelsLoaded: ready, allDriversLoaded: bundledDrivers.size === 6,
    bundledLoaded: [...bundledDrivers.keys()], bundledFailures: [...bundledFailures.keys()],
    loading: { ...loadingSnapshot, records: loadingSnapshot.records.map(record => ({ ...record })), busy: loadingBusy, courseBuilt, error: loadingError },
    selectedDriverId, importedSlots: DRIVERS.filter(d => localDrivers.has(d.id)).map(d => d.id), importing: localDrivers.busy,
    driverStates: DRIVERS.map(d => ({ id: d.id, appearance: localDrivers.has(d.id) ? 'local-import' : bundledDrivers.has(d.id) ? 'bundled-model' : 'original-fallback', ...(controllers.get(d.id)?.getState() || {}) })),
    drawCalls: stats.drawCalls?.total ?? stats.frame?.drawCalls ?? 0, triangles: stats.frame?.triangles ?? 0,
  };
}
window.neonKart = { getState, start: reset, pause, useItem, selectDriver, importDrivers, retryLoading: boot, clearDriver: () => localDrivers.clear(selectedDriverId) };
// Opt-in deterministic browser QA. It never changes production play unless explicitly invoked.
let manual = false;
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
  window.neonKart.debug = {
    app, world, sample, orbit, mouseLook, keys, controllers, courseAssets, localDrivers, update, draw, setupRacers, updateDriverUI,
    player: () => player, bots: () => bots, boxes: () => boxes,
    freeze: (value = true) => { manual = value; },
    step: (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) { const dt = 1 / 60; clock += dt; if (ready) update(dt); draw(dt); } },
    set: (values: Record<string, any>) => {
      ({ pos = pos, lane = lane, speed = speed, held = held, boost = boost, state = state, ready = ready, steerVis = steerVis, charge = charge, drifting = drifting, shield = shield, countdown = countdown, elapsed = elapsed, hit = hit } = values);
      if (values.noBots) { for (const b of bots) b.mesh.enabled = false; bots = []; }
    },
  };
}
addEventListener('resize', () => { app.resizeCanvas(); snapCamera = true; });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); release(); $('count').textContent = '画面已中断，请刷新'; $('count').classList.add('paused');
});
app.on('update', (delta: number) => {
  if (manual) return;
  const dt = Math.min(.045, delta || .016); clock += dt;
  if (ready) update(dt);
  draw(dt);
});
void boot();
app.start();
