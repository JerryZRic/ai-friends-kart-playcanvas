import * as pc from 'playcanvas';
import { defaultBuild } from './kart-build';
import { raceKartBuild, buildForRacer, createRaceKartTuning, kartRoadContext, kartBuildKey } from './kart-race';
import { createKartAssemblyLoader, type KartAssembly, type KartAssemblyProgress } from './kart-assembly';
import { createModularRacer, validateModularDriverContract } from './kart-driver';
import { readGameSettings, qualitySettings } from './game-settings';
import { coastLap, crossingTime, coastStandings } from './coast-race-rules';
import { COAST_DRIFT, coastDriftReady, coastDriftBoost, coastCornerPace, coastHudFeedback } from './coast-race-feedback';
import { createWaterparkLifetime as createRaceLifetime } from './waterpark-lifetime';
import { createItemModel, itemImage, type ItemKind } from './item-models';
import { advancePickup, resetPickup } from './item-pickups';
import { createDynamicPickupDirector } from './dynamic-pickups';
import { RULES, newBrain, tickBrain, tickEffects, racingSpeed, chooseItem, activateItem, collectPickups, planLane, moveLane, nearbyGap, type Combatant, type Brain } from './npc-tactics';
import { keyCode, driveInput, driveSpeed, lateralInput, steeringYaw } from './vehicle-controls.js';
import { createOrbit, bindMouseLook } from './mouse-look.js';
import {createRaceFrameClock} from './race-frame-clock';
import {bindRaceControls} from './race-controls';
import {chaseCamera} from './race-camera';
import {createLoadingCamera} from './race-loading-camera';
import {mountRaceLoadingUi} from './race-loading-ui';
import {mountRaceHud} from './race-hud';
import {createRaceShell,raceNavigation} from './race-shell';
import {createPerformancePanel} from './waterpark-performance-ui';
import { DRIVERS, DEFAULT_DRIVER_ID, getDriver, raceOrder } from './driver-roster.js';
import { COURSE_FILES, loadCourseAssets, loadBundledDrivers, createLocalDriverStore, type DriverAsset } from './assets';
import { createCoastScene, eachMesh, placeKart, type Spark } from './scene';
import { LENGTH, halfWidthAt, sample, clamp, damp, scaled, degrees, UP } from './track';

declare global { interface Window { neonKart: any; webkitAudioContext?: typeof AudioContext; } }
mountRaceHud({subtitle:'SUNSET COAST GRAND PRIX',canvasLabel:'真实 3D 卡丁车赛道'});
const $ = (id: string): any => document.getElementById(id);
const loadingUi=mountRaceLoadingUi(document,'coast');
const loadingCamera=createLoadingCamera({length:LENGTH,sample});
let initialCameraReturn=true,loadingFocused=true,contextUnavailable=false;
const loadingActive=()=>loadingFocused&&!contextUnavailable&&!document.hidden&&(typeof document.hasFocus!=='function'||document.hasFocus());
const settings = readGameSettings(), quality = qualitySettings(settings.quality);
const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const activeKartBuild = raceKartBuild(query.toString());
const racerBuild = (id: string) => buildForRacer(id, selectedDriverId, activeKartBuild);
const compiledRaceTuning = createRaceKartTuning(activeKartBuild);
const racerTuning = (id: string, distance?: number, velocity = 0) => compiledRaceTuning(id, selectedDriverId, distance===undefined?undefined:kartRoadContext(distance,velocity,sample));
// Native links remain usable if WebGL or a later bootstrap step fails.
function updateRaceLinks(driverId:string){
  const links=raceNavigation('coast',driverId);
  $('raceChangeMap').href=links.changeMap;
  $('raceChangeCharacter').href=links.changeCharacter;
  if ($('raceGarage')) $('raceGarage').href='garage.html?driver='+encodeURIComponent(driverId);
}
updateRaceLinks(getDriver(query.get('driver') || DEFAULT_DRIVER_ID).id);

let disposed = false, autoStartPending = query.get('autostart') === '1';
const canvas = $('game') as HTMLCanvasElement;
const shell=createRaceShell(document,canvas,{map:'coast',driver:getDriver(query.get('driver')||DEFAULT_DRIVER_ID).id,track:{length:LENGTH,sample}});
let app: pc.Application;
try {
  app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false, powerPreference: 'high-performance' } });
} catch (error) {
  $('loading').textContent = '当前浏览器无法启用 WebGL，请开启硬件加速或换用新版浏览器';
  loadingUi.update({progress:null,status:$('loading').textContent,busy:false});
  throw error;
}
app.maxDeltaTime = Infinity; // Preserve elapsed time; gameplay is substepped below.
app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio || 1, quality.pixelRatioCap);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
const world = createCoastScene(app);
const kartLoader = createKartAssemblyLoader(app);
const kartTemplates = new Map<string, KartAssembly>();
const lifetime = createRaceLifetime(()=>{
  releaseRacers(); for (const assembly of kartTemplates.values()) assembly.dispose(); kartTemplates.clear();
  void kartLoader.dispose().finally(()=>app.destroy());
});
for (const light of app.root.findComponents('light') as pc.LightComponent[]) {light.castShadows = quality.shadows;light.shadowResolution = quality.shadowResolution;}
const { camera, boxes, shield: shieldMesh, flames, particles } = world;
const dynamicPickups=createDynamicPickupDirector(boxes.filter(b=>b.dynamic),{length:LENGTH,sample,laneLimit:d=>Math.min(5.2,halfWidthAt(d)-1.1)});
const performancePanel=createPerformancePanel(canvas,()=>({quality:settings.quality,pixelRatioCap:quality.pixelRatioCap,loopLength:LENGTH,racerCount:6,profile:racerTuning(selectedDriverId),driver:selectedDriverId}),undefined,{mount:$('raceSettings'),scene:'coast-circuit-six-racers'});
const frameClock=createRaceFrameClock();
let state = 'loading', ready = false, elapsed = 0, countdown = 3, pos = 0, lane = 0, speed = 0,
  charge = 0, boost = 0, shield = 0, hit = 0, slow = 0, held: ItemKind | null = null,
  drifting = false, steerVis = 0, finishRank = 0, playerFinishedAt = Infinity, view = 0, muted = shell.muted, clock = 0;
type RacerEntity = pc.Entity & { userData?: { driverId: string } };
type BotFX = { shield: pc.Entity; flames: { mesh: pc.Entity; side: number }[]; inventory: Record<ItemKind, pc.Entity> };
type Bot = Combatant & Brain & { phase: number; color: string; driving: boolean; cornerPace: number; finishedAt: number | null; mesh: RacerEntity; fx: BotFX };
let bots: Bot[] = [], sparks: Spark[] = [], player: RacerEntity | null = null;
let selectedDriverId = getDriver(query.get('driver') || DEFAULT_DRIVER_ID).id, chassisAsset: DriverAsset | null = null;
const controllers = new Map<string, ReturnType<typeof createModularRacer>>();
let bundledDrivers = new Map<string, DriverAsset>(), bundledFailures = new Map<string, string>();
const courseAssets = new Map<string, DriverAsset>(), courseFiles = COURSE_FILES;
let keys: Record<string, boolean> = {};
const orbit = createOrbit();
let controls: ReturnType<typeof bindRaceControls>;
let mouseLook: ReturnType<typeof bindMouseLook>;
let courseBuilt = false, loadingBusy = false, loadingPromise: Promise<boolean> | null = null,
  loadingTimer: ReturnType<typeof setInterval> | null = null, loadingError: string | null = null;
let loadingSnapshot: any = { phase: 'course', records: [], receivedBytes: 0, totalBytes: 0, completed: 0, total: courseFiles.length, loaded: 0, failed: 0 };
const retryDeadlines=new Map();
const formatBytes=bytes=>bytes<1048576?(bytes/1024).toFixed(0)+' KiB':(bytes/1048576).toFixed(1)+' MiB';
function setLoadingSnapshot(snapshot){
  if (disposed) return;
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
  if(disposed)return;
  if(contextUnavailable){loadingUi.update({progress:null,status:'画面已中断，请刷新页面后重试',busy:false});return;}
  const status=loadingSnapshot,course=status.phase==='course',karts=status.phase==='karts';
  const stageNames={queued:'等待下载',downloading:'下载中',decompressing:'校验 / 解压中',preparing:'解析 / 准备 3D 模型',ready:'已就绪',failed:'加载失败'};
  const progress=$('loadingProgress'),hasTotal=status.totalBytes>0;
  $('loadingSection').setAttribute('aria-busy',String(loadingBusy));
  $('loadingProgressLabel').textContent=(course?'赛道':karts?'组装零件':'角色')+'下载进度（仅下载字节）';
  if(hasTotal){progress.max=status.totalBytes;progress.value=Math.min(status.receivedBytes,status.totalBytes);}
  else progress.removeAttribute?.('value');
  $('loadingBytes').textContent=formatBytes(status.receivedBytes)+(hasTotal?' / '+formatBytes(status.totalBytes)+' · '+Math.floor(Math.min(1,status.receivedBytes/status.totalBytes)*100)+'%':' · 正在确定下载大小');
  $('loadingDetails').textContent=status.records.map(record=>{
    const name=course?courseFiles.find(file=>file.id===record.id)?.label:karts?record.label:getDriver(record.id).label;
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
    $('loading').textContent=(course?'正在准备赛道':karts?'正在装配赛车':'正在加载角色')+' · 已就绪 '+status.loaded+' / '+status.total+(preparing&&!downloading?' · 下载完成，正在处理模型':'');
  }else if(loadingError&&courseBuilt){
    $('loading').textContent='模型准备失败：'+loadingError+'；请重试';
  }else if(!courseBuilt){
    $('loading').textContent='赛道资源加载失败，请检查网络后重试';
  }else if(bundledFailures.size){
    $('loading').textContent='角色加载失败：'+[...bundledFailures.keys()].map(id=>getDriver(id).label).join('、')+'；请重试失败资源';
  }else $('loading').textContent='6 / 6 角色与组装赛车已就绪 · 非商业试玩';
  const canRetry=!loadingBusy&&!localDrivers.busy&&(loadingError||!courseBuilt||bundledFailures.size>0)&&(state==='loading'||state==='menu'||state==='finished');
  $('retryLoading').classList[!loadingBusy&&(loadingError||!courseBuilt||bundledFailures.size>0)?'remove':'add']('hidden');
  $('retryLoading').disabled=!canRetry;
  const shortStatus=!loadingBusy&&(loadingError||!courseBuilt)?'赛道或模型准备失败，请重试':!loadingBusy&&bundledFailures.size?`角色加载失败 ${bundledFailures.size} / 6，请重试`:$('loading').textContent;
  loadingUi.update({progress:hasTotal?Math.min(1,status.receivedBytes/status.totalBytes):null,status:shortStatus,busy:loadingBusy,canRetry:!!canRetry,canContinue:ready&&!loadingBusy&&!localDrivers.busy,continueLabel:'开始比赛'});
  $('retryLoading').textContent=courseBuilt?(loadingError?'重试模型准备':'重试失败角色（'+bundledFailures.size+'）'):'重试赛道资源';
}
async function prepareCourseAssets(signal: AbortSignal) {
  const loaded = await loadCourseAssets(app, { signal, existing: courseAssets, onStatus: status => setLoadingSnapshot({ phase: 'course', ...status }) });
  for (const [id, asset] of loaded.assets) courseAssets.set(id, asset);
  if (loaded.failures.size) throw new Error('原创赛道资源未完整加载，请重试');
}
function buildCourse() {
  if (courseBuilt) return;
  world.buildProps(courseAssets);
  chassisAsset = courseAssets.get('chassis')!;
  courseBuilt = true;
}
async function prepareKarts(signal: AbortSignal) {
  const builds = [...new Map([defaultBuild, activeKartBuild].map(build=>[kartBuildKey(build),build])).values()];
  const records = builds.map((build,index)=>({id:kartBuildKey(build),label:index===0?'对手均衡组装':'我的六槽组装',stage:kartTemplates.has(kartBuildKey(build))?'ready':'queued',receivedBytes:0,totalBytes:0,error:null as string|null,attempt:1,maxAttempts:4}));
  const emit=()=>setLoadingSnapshot({phase:'karts',records,receivedBytes:records.reduce((n,r)=>n+r.receivedBytes,0),totalBytes:records.reduce((n,r)=>n+r.totalBytes,0),completed:records.filter(r=>r.stage==='ready').length,total:records.length,loaded:records.filter(r=>r.stage==='ready').length,failed:records.filter(r=>r.stage==='failed').length});
  emit();
  for (let index=0;index<builds.length;index++) {
    const build=builds[index],key=kartBuildKey(build),record=records[index];
    if (kartTemplates.has(key)) continue;
    try {
      const assembly=await kartLoader.load(build,{signal,onProgress:(progress:KartAssemblyProgress)=>{
        record.stage=progress.stage==='ready'?'ready':progress.stage==='preparing'?'preparing':progress.stage==='retrying'?'waiting':'downloading';
        record.receivedBytes=progress.receivedBytes;record.totalBytes=progress.totalBytes||0;record.attempt=progress.attempt||1;emit();
      }});
      if (disposed||contextUnavailable||signal.aborted) {assembly.dispose();throw new DOMException('Race no longer available','AbortError');}
      kartTemplates.set(key,assembly); record.stage='ready';emit();
    } catch(error) {record.stage='failed';record.error=error instanceof Error?error.message:'组装加载失败';emit();throw error;}
  }
}
function boot(): Promise<boolean> {
  if (disposed||contextUnavailable) return Promise.resolve(false);
  if (loadingPromise) return loadingPromise;
  if (localDrivers.busy || !['loading', 'menu', 'finished'].includes(state) || (ready && !bundledFailures.size && !loadingError)) return Promise.resolve(false);
  loadingBusy = true; ready = false; loadingError = null; $('loadingDetailGroup').open = true;
  const returnState = state === 'finished' ? 'finished' : 'menu'; state = 'loading';
  $('startText').textContent = courseBuilt ? '正在重试角色' : '正在准备赛道'; updateDriverUI();
  loadingTimer = setInterval(renderLoadingUI, 250);
  loadingPromise = lifetime.run(async signal => {
    try {
      if (!courseBuilt) { await prepareCourseAssets(signal); if (disposed||contextUnavailable) return false; buildCourse(); }
      const loaded = await loadBundledDrivers(app, { signal, existingDrivers: bundledDrivers, onStatus: status => setLoadingSnapshot({ phase: 'drivers', ...status }), onProgress: updateDriverUI });
      if (disposed||contextUnavailable) return false;
      bundledDrivers = loaded.drivers; bundledFailures = loaded.failures;
      await prepareKarts(signal); if (disposed||contextUnavailable) return false;
      setupRacers(); ready = bundledFailures.size===0&&bundledDrivers.size===DRIVERS.length; state = returnState;
      $('startText').textContent = bundledFailures.size ? '请重试失败资源' : returnState === 'finished' ? '再来一场' : '开始比赛';
      return true;
    } catch (error) {
      if (disposed||contextUnavailable) return false;
      console.error(error); loadingError = error instanceof Error ? error.message : '未知准备错误';
      $('startText').textContent = '资源加载未完成';
      if (courseBuilt) for (const slot of DRIVERS) if (!bundledDrivers.has(slot.id)) bundledFailures.set(slot.id, loadingError);
      return false;
    } finally {
      loadingBusy = false; loadingPromise = null; if (loadingTimer) clearInterval(loadingTimer); loadingTimer = null;
      if (!disposed) { $('loadingDetailGroup').open = !ready || bundledFailures.size > 0; updateDriverUI(); renderLoadingUI(); if(ready&&!bundledFailures.size&&autoStartPending){autoStartPending=false;reset();} }
    }
  });
  return loadingPromise;
}
function tone(freq=500,d=.1){shell.tone(freq,d)}
function toast(s){shell.toast(s)}
function standings(){return coastStandings([{id:selectedDriverId,total:pos,finishedAt:Number.isFinite(playerFinishedAt)?playerFinishedAt:null},...bots.map(({id,total,finishedAt})=>({id,total,finishedAt}))]);}
function rank(){return standings().findIndex(r=>r.id===selectedDriverId)+1;}
function createBotFX(): BotFX {
  const sphere = shieldMesh.clone(); sphere.name = 'NPC energy shield'; app.root.addChild(sphere); sphere.enabled = false;
  const jets = flames.map(f => { const mesh = f.mesh.clone(); mesh.name = 'NPC turbo flame'; app.root.addChild(mesh); mesh.enabled = false; return { mesh, side: f.side }; });
  const inventory = Object.fromEntries((['boost', 'shield', 'pulse'] as ItemKind[]).map(kind => { const model = createItemModel(app, kind); model.name = 'NPC held ' + kind; app.root.addChild(model); model.enabled = false; return [kind, model]; })) as Record<ItemKind, pc.Entity>;
  return { shield: sphere, flames: jets, inventory };
}
function hideBotFX(b: Bot) { b.fx.shield.enabled = false; b.fx.flames.forEach(f => f.mesh.enabled = false); Object.values(b.fx.inventory).forEach(e => e.enabled = false); }
function releaseBotFX(b: Bot) { b.fx.shield.destroy(); b.fx.flames.forEach(f => f.mesh.destroy()); Object.values(b.fx.inventory).forEach(e => e.destroy()); }
function releaseActor(actor: RacerEntity) {
  const controller = controllers.get(actor.userData?.driverId || '');
  if (controller) { controller.dispose(); controllers.delete(actor.userData!.driverId); }
  else { eachMesh(actor, mesh => mesh.material.destroy()); actor.destroy(); }
}
function releaseRacers() {
  bots.forEach(releaseBotFX);
  for (const actor of [player, ...bots.map(bot => bot.mesh)].filter(Boolean) as RacerEntity[]) {
    releaseActor(actor);
  }
  controllers.clear(); player = null; bots = [];
}
function racerFor(slot): RacerEntity {
  const asset = localDrivers.get(slot.id) || bundledDrivers.get(slot.id);
  let entity: RacerEntity;
  if (asset && kartTemplates.has(kartBuildKey(racerBuild(slot.id)))) {
    const assembly = kartLoader.instantiate(racerBuild(slot.id));
    let controller: ReturnType<typeof createModularRacer>;
    try { controller = createModularRacer(app, asset, assembly, slot); } catch(error) {assembly.dispose();throw error;}
    controllers.set(slot.id, controller); entity = controller.root;
  } else {
    // A missing asset remains invisible. Never resurrect the retired low-poly rider.
    entity = new pc.Entity('Unloaded racer');
    entity.enabled = false;
  }
  entity.userData = { driverId: slot.id }; app.root.addChild(entity); return entity;
}
function setupRacers(){
  releaseRacers(); const order=raceOrder(selectedDriverId);
  try {
    player=racerFor(order[0]);
    for (const [i,slot] of order.slice(1).entries()) bots.push({id:slot.id,phase:i,color:slot.color,total:12+Math.floor(i/2)*5.2,lateral:(i%2?1:-1)*3.2,speed:0,driving:true,cornerPace:1,held:null,boost:0,shield:0,slow:0,finishedAt:null,...newBrain(i,(i%2?1:-1)*3.2),mesh:racerFor(slot),fx:createBotFX()});
    placeKart(player,pos,lane,0);bots.forEach(b=>placeKart(b.mesh,b.total,b.lateral,0));
  } catch(error) {releaseRacers();throw error;}
}
function reset(){if(disposed||contextUnavailable||!ready||loadingBusy||localDrivers.busy||state==='returning')return;
if(initialCameraReturn){
  clearInputs();mouseLook.release();orbit.recenter(true);
  pos=0;lane=-2;speed=0;setupRacers();state='returning';
  const start=sample(0,-2);loadingCamera.beginReturn(chaseCamera({position:start.p,tangent:start.t,view,rearView:false,orbit:{yaw:0,pitch:0}}));
  loadingUi.update({progress:1,status:'模型已就绪 · 镜头返回起点',busy:true,canRetry:false,canContinue:false});
  return;
}
frameClock.reset();mouseLook.release();orbit.recenter(true);elapsed=0;countdown=3;pos=0;lane=-2;speed=charge=boost=shield=hit=slow=0;held=null;drifting=false;steerVis=0;finishRank=0;playerFinishedAt=Infinity;sparks=[];shieldMesh.enabled=false;flames.forEach(f=>f.mesh.enabled=false);particles.forEach(p=>p.enabled=false);clearInputs();boxes.filter(b=>!b.dynamic).forEach(b=>resetPickup(b));dynamicPickups.reset();setupRacers();state='countdown';shell.start(countdown);updateDriverUI();canvas.focus?.({preventScroll:true});updateLookHint();updateHUD();snapCamera=true;tone(500)}
const canImport=()=>ready&&!loadingBusy&&(state==='menu'||state==='finished');
const localDrivers=createLocalDriverStore(app,{canImport,validate:validateModularDriverContract,onBusy:()=>{updateDriverUI();renderLoadingUI();},onChange:()=>{if(ready){setupRacers();updateDriverUI();}}});
function updateDriverUI(){
  if (disposed) return;
  updateRaceLinks(selectedDriverId);
  const editable=canImport();
  for(const slot of DRIVERS){const button=$('slot-'+slot.id);button.disabled=!editable;button.setAttribute('aria-pressed',String(slot.id===selectedDriverId));button.textContent=slot.label+' · '+(localDrivers.has(slot.id)?'本地替换':bundledDrivers.has(slot.id)?'已就绪':bundledFailures.has(slot.id)?'加载失败':'加载中');}
  $('start').disabled=!ready||loadingBusy||localDrivers.busy||state==='returning';
  $('retryLoading').disabled=loadingBusy||localDrivers.busy||!['loading','menu','finished'].includes(state);
  $('importButton').disabled=!editable||!chassisAsset;
  $('driverFiles').disabled=!editable||!chassisAsset;
  $('clearDriver').disabled=!editable||localDrivers.busy||!localDrivers.has(selectedDriverId);
  $('importSummary').textContent=localDrivers.busy?'正在检查本地 GLB，完成前暂停开始比赛…':bundledDrivers.size+' / 6 个默认角色已加载 · '+DRIVERS.filter(slot=>localDrivers.has(slot.id)).length+' 个本地替换'+(bundledFailures.size?' · 失败角色等待重试':'');
}
function selectDriver(id){if(!canImport()||!DRIVERS.some(slot=>slot.id===id))return false;autoStartPending=false;selectedDriverId=id;setupRacers();updateDriverUI();snapCamera=true;return true;}
let importStatusVersion=0;
async function importDrivers(files,slotId=selectedDriverId){
  // Capture selection before awaiting file reads. No selected bytes leave memory.
  const chosen=Array.from(files||[]) as File[];if(!chosen.length)return [];
  if(!canImport()||!chassisAsset){$('importStatus').textContent='请在赛前菜单导入；需先加载原创底盘';return [];}
  const statusVersion=++importStatusVersion;
  const results=await lifetime.run(()=>localDrivers.importFiles(chosen,slotId));
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
function pause(){if(state==='running'||state==='countdown'){state='paused';clearInputs();mouseLook.release();shell.setPaused(true,countdown);updateLookHint();updateHUD();}else if(state==='paused'){frameClock.reset();state=countdown>0?'countdown':'running';shell.setPaused(false,countdown);updateLookHint()}}$('pause').onclick=pause;
$('resumeRace').onclick=pause;
$('restartRace').onclick=reset;
function navigate(screen=''){dynamicPickups.finish();clearInputs();mouseLook.release();const urls=shell.updateNavigation('coast',selectedDriverId)!;location.href=screen==='maps'?urls.changeMap:screen==='characters'?urls.changeCharacter:urls.main;}
$('pauseMenu').onclick=()=>navigate();
$('pauseChangeMap').onclick=()=>navigate('maps');
$('camera').onclick=()=>{if(state==='loading'||state==='menu'||state==='returning')return;view=(view+1)%2;orbit.recenter(true);toast(view?'高位追逐视角':'低位追逐视角');snapCamera=true};
$('sound').onclick=()=>{shell.toggleSound();muted=shell.muted;};
function playerCombatant(): Combatant { return { id: selectedDriverId, total: pos, lateral: lane, speed, held, boost, shield, slow }; }
function applyPlayerCombatant(r: Combatant) { held = r.held; boost = r.boost; shield = r.shield; slow = r.slow; }
function useCombatItem(actor: Combatant, racers: Combatant[]) {
  const result = activateItem(actor, racers, LENGTH); if (!result) return;
  const bot = bots.find(b => b.id === actor.id);
  if (bot) { bot.uses++; bot.cooldown = RULES.cooldown; if (result.item === 'pulse') bot.pulseFlash = .65; }
  const sourceMesh = bot?.mesh || player;
  if (result.item === 'pulse' && sourceMesh) for (let i = 0; i < 9; i++) emit(sourceMesh.getPosition(), 'pulse');
  if (result.target) {
    const mesh = bots.find(b => b.id === result.target.id)?.mesh || player;
    if (mesh) for (let i = 0; i < 18; i++) emit(mesh.getPosition(), 'pulse');
  }
  if (!bot) {
    toast(result.item === 'boost' ? '涡轮加速！' : result.item === 'shield' ? '能量护盾 · 6 秒' : result.target ? result.blocked ? '前车护盾挡住了脉冲' : '脉冲命中前车！' : '前方无目标 · 转化为加速');
    tone(result.item === 'pulse' && result.target ? 160 : 850, .3);
  } else if (result.target?.id === selectedDriverId) { toast(result.blocked ? '护盾挡住了对手的脉冲！' : '被对手脉冲击中 · 短暂减速'); tone(result.blocked ? 650 : 160, .2); }
}
function useItem() {
  if (state !== 'running' || !held) return;
  const human = playerCombatant(); useCombatItem(human, [human, ...bots.filter(b=>b.total<LENGTH*3)]); applyPlayerCombatant(human); updateHUD();
}
$('item').onclick=useItem;
function clearInputs(){if(controls)controls.clear();else for(let k in keys)keys[k]=false;charge=0;drifting=false;}
function release(){controls?.release();}
let lookStatus='free';
function updateLookHint(){
  $('lookHint').textContent=state==='paused'?'已暂停 · P 继续':lookStatus==='locked'?'移动鼠标环顾 · Q 回正 · 右键回看 · Esc 暂停并释放鼠标':lookStatus==='drag'?'按住鼠标左键拖动环顾 · Q 回正 · Esc 暂停':'单击赛道，移动鼠标环顾 · Q 回正 · Esc 暂停';
}
controls=bindRaceControls(canvas,{
  state:()=>state==='running'||state==='countdown'?'active':state==='paused'?'paused':state==='finished'?'finished':state==='loading'||state==='returning'?'loading':'menu',
  pause,useItem,switchCamera:()=>$('camera').click(),start:reset,
  recenter:()=>toast('视角回正'),status:status=>{lookStatus=status;updateLookHint()},
  onClear:()=>{charge=0;drifting=false;},orbit,window:globalThis as unknown as Window,
});
keys=controls.keys;mouseLook=controls.mouseLook;
function updateHUD(){const feedback=coastHudFeedback(playerCombatant(),bots.filter(b=>b.total<LENGTH*3),LENGTH,charge,id=>getDriver(id).label);shell.updateHUD({...feedback,rank:finishRank||rank(),lap:coastLap(pos,LENGTH),elapsed,speed,charge,boost,shield,held,slideLabel:'左 Shift + A / D 手刹漂移',canUseItem:state==='running'});}
function finish(){dynamicPickups.finish();finishRank=rank();elapsed=playerFinishedAt;pos=LENGTH*3;state='finished';held=null;boost=shield=hit=slow=0;shieldMesh.enabled=false;flames.forEach(f=>f.mesh.enabled=false);sparks=[];particles.forEach(p=>p.enabled=false);bots.forEach(b=>{b.held=null;b.boost=b.shield=b.slow=b.bump=b.reaction=b.cooldown=b.decisionIn=b.pulseFlash=0;hideBotFX(b)});clearInputs();mouseLook.release();shell.finish({rank:finishRank,elapsed,selectedDriverId,racers:standings(),trackLength:LENGTH});updateDriverUI();tone(1000,.4)}
function emit(p: pc.Vec3, type = 'spark') {
  if (sparks.length >= 160) return;
  sparks.push({ p: p.clone(), v: new pc.Vec3((Math.random() - .5) * 4, 1 + Math.random() * 2, (Math.random() - .5) * 4), t: type === 'pulse' ? .8 : .45, max: .65 });
}
function update(dt){shell.tick(dt);if(state==='countdown'){let old=Math.ceil(countdown);countdown-=dt;let cur=Math.ceil(countdown);shell.renderCountdown(countdown);if(cur!==old)tone(cur>0?500:1000,.15);if(countdown<=0){const remaining=-countdown;countdown=0;state='running';$('count').textContent='';toast('按住 W 起步 · 空格刹车 · Shift 手刹漂移');if(remaining>0)update(remaining);}return}if(state!=='running')return;
elapsed+=dt;boost=Math.max(0,boost-dt);shield=Math.max(0,shield-dt);hit=Math.max(0,hit-dt);slow=Math.max(0,slow-dt);const previousLane=lane;const botPrevious=bots.map(b=>({actor:b,previous:b.total,previousLane:b.lateral,onPickup:()=>{b.pickups++;b.reaction=RULES.reaction+b.phase*.08}}));for(const box of boxes)if(!box.dynamic)advancePickup(box,dt);const tuning=racerTuning(selectedDriverId,pos,speed),input=driveInput(keys),steer=input.steer;let now=sample(pos),next=sample(pos+7);let curvature=now.t.x*next.t.z-now.t.z*next.t.x;
let wantDrift=input.handbrake&&!!steer&&!input.brake&&!input.reverse&&speed>tuning.maxSpeed*.4;if(wantDrift){charge=Math.min(COAST_DRIFT.maxCharge,charge+dt);if(Math.random()<.8){let p=scaled(now.p.clone(),now.n,lane+steer*.85);p.y+=.35;emit(p)}}else if(drifting){if(coastDriftReady(charge)&&!input.brake&&!input.reverse){boost=Math.max(boost,coastDriftBoost(charge));toast('漂移加速！');tone(850,.2)}charge=0}drifting=wantDrift;
let limit=tuning.maxSpeed*(boost>0?RULES.boostFactor:1);if(Math.abs(lane)>halfWidthAt(pos)-.9)limit*=.58;if(hit>0||slow>0)limit*=RULES.slowFactor;speed=driveSpeed(speed,input,dt*(input.throttle&&!input.reverse&&!input.brake&&speed>=0&&speed<limit?tuning.multipliers.acceleration:1),limit);lane+=lateralInput(steer,speed,tuning.maxSpeed,drifting,dt)*tuning.multipliers.steering+curvature*speed*dt*.43;lane=clamp(lane,-(halfWidthAt(pos)-.45),halfWidthAt(pos)-.45);steerVis=damp(steerVis,steeringYaw(steer,speed,drifting),8,dt);
let previous=pos;pos+=speed*dt;lane=clamp(lane,-(halfWidthAt(pos)-.45),halfWidthAt(pos)-.45);playerFinishedAt=crossingTime(previous,pos,LENGTH*3,elapsed,dt)??playerFinishedAt;if(pos>previous&&previous>=0&&Math.floor(previous/LENGTH)<Math.floor(pos/LENGTH)&&pos<LENGTH*3){toast('第 '+(Math.floor(pos/LENGTH)+1)+' 圈！');tone(750,.2)}
const human=playerCombatant(), racers: Combatant[]=[human,...bots.filter(b=>b.total<LENGTH*3)];
for(const b of bots){tickEffects(b,dt);tickBrain(b,dt);}
for(const b of bots){
  if(b.total>=LENGTH*3){b.finishedAt??=elapsed-dt;b.held=null;b.boost=b.shield=b.slow=b.pulseFlash=0;hideBotFX(b);continue;}
  if(b.decisionIn<=0){
    b.decisionIn=.22+b.phase*.03;
    b.cornerPace=coastCornerPace(b.total,b.speed,sample);
    const a=sample(b.total).t,z=sample(b.total+22).t,bend=a.x*z.z-a.z*z.x;
    const safeLane=Math.min(halfWidthAt(b.total),halfWidthAt(b.total+22))-.8;
    b.targetLane=clamp(planLane(b,racers,boxes,LENGTH,b.phase,bend),-safeLane,safeLane);
    if(chooseItem(b,racers,LENGTH,bend))useCombatItem(b,racers);
  }
}
applyPlayerCombatant(human);
for(const b of bots){
  if(b.total>=LENGTH*3)continue;
  const tuning=racerTuning(b.id,b.total,b.speed);
  if(b.driving)b.speed=driveSpeed(b.speed,{throttle:true},dt*tuning.multipliers.acceleration,tuning.maxSpeed*(.9+b.phase*.008)*b.cornerPace);
  const travel=racingSpeed(b,tuning.maxSpeed)*dt, before=b.total;b.total=Math.min(LENGTH*3,b.total+travel);if(b.total>=LENGTH*3)b.finishedAt=elapsed-dt+dt*(LENGTH*3-before)/Math.max(travel,1e-9);b.lateral=clamp(moveLane(b.lateral,b.targetLane,dt*tuning.multipliers.steering),-(halfWidthAt(b.total)-.8),halfWidthAt(b.total)-.8);
  if(b.total>=LENGTH*3){b.held=null;b.boost=b.shield=b.slow=b.bump=b.reaction=b.cooldown=b.decisionIn=b.pulseFlash=0;hideBotFX(b);continue;}
}
for(const b of bots){
  if(b.total>=LENGTH*3)continue;
  if(b.bump<=0&&b.shield<=0&&racers.some(r=>r.id!==b.id&&Math.abs(nearbyGap(b.total,r.total,LENGTH))<2.9&&Math.abs(b.lateral-r.lateral)<1.85)){b.slow=Math.max(b.slow,.55);b.bump=.8;}
  if(Math.abs(nearbyGap(pos,b.total,LENGTH))<2.9&&Math.abs(b.lateral-lane)<1.85&&hit<=0&&shield<=0){hit=.55;speed*=.77;lane=clamp(lane+(lane>b.lateral?.55:-.55),-(halfWidthAt(pos)-.45),halfWidthAt(pos)-.45);tone(110,.1)}
}
human.total=pos;human.lateral=lane;
collectPickups([{actor:human,previous,previousLane,onPickup:()=>{tone(1200,.12);toast('获得道具 · E 使用')}},...botPrevious.filter(r=>r.actor.total<LENGTH*3)],boxes,LENGTH);
applyPlayerCombatant(human);
if(Number.isFinite(playerFinishedAt)){
  const fraction=dt>0?clamp((playerFinishedAt-(elapsed-dt))/dt,0,1):1;
  for(const prior of botPrevious){const b=prior.actor;if(b.finishedAt===null||b.finishedAt>playerFinishedAt){const effectiveFraction=b.finishedAt!==null?clamp((playerFinishedAt-(elapsed-dt))/(b.finishedAt-(elapsed-dt)),0,1):fraction;b.total=prior.previous+(b.total-prior.previous)*effectiveFraction;if(b.finishedAt!==null){b.total=Math.min(b.total,LENGTH*3-1e-8);b.finishedAt=null;}}}
  finish();
}else{
 const snapshots=[{...playerCombatant(),travelSpeed:speed,reactionSpeed:Math.abs(speed),finished:false},...bots.map(b=>({id:b.id,total:b.total,lateral:b.lateral,held:b.held,travelSpeed:racingSpeed(b,racerTuning(b.id).maxSpeed),reactionSpeed:Math.min(Math.abs(b.speed),racerTuning(b.id).maxSpeed)*RULES.boostFactor,finished:b.total>=LENGTH*3}))].map(r=>{
  const tuning=racerTuning(r.id);return {...r,finishDistance:LENGTH*3,maxSpeed:tuning.maxSpeed*RULES.boostFactor,acceleration:tuning.acceleration*RULES.boostFactor};
 });
 for(const box of dynamicPickups.tick({dt,active:true,racers:snapshots,staticBoxes:boxes.filter(b=>!b.dynamic)})){
  const item=box as typeof boxes[number],p=sample(box.d,box.lateral).p;item.base=p.y+1.25;item.mesh.setPosition(p.x,item.base,p.z);
 }
}updateHUD()}

/* NATIVE_DRAW */
function drawMap(){shell.drawMinimap([...bots.map(b=>({total:b.total,color:b.color,player:false})),{total:pos,color:getDriver(selectedDriverId).color,player:true}]);}

let snapCamera = true, lastRearView = false;
function draw(dt: number) {
  const active = state === 'running' || state === 'countdown';
  const effectDt = state === 'paused' ? 0 : dt;
  for (const [id, controller] of controllers) {
    const bot = bots.find(b => b.id === id);
    controller.update(dt, active ? bot ? clamp(bot.targetLane - bot.lateral, -1, 1) * .65 : driveInput(keys).steer : 0, state === 'paused', active ? bot ? bot.speed : speed : 0);
  }
  const rearView = driveInput(keys).rearView;
  if (rearView !== lastRearView) { snapCamera = true; lastRearView = rearView; }
  world.oceanMaterial.setParameter('time', clock);
  for (const box of boxes) {
    // Pickup ownership and the director alone control visibility, never rendering.
    if(!box.mesh.enabled)continue;
    box.mesh.setEulerAngles(degrees(Math.sin(clock * .8) * .15), degrees(clock * .8), degrees(.18));
    const p = box.mesh.getPosition(); box.mesh.setPosition(p.x, box.base + Math.sin(clock * 2 + box.d) * .17, p.z);
  }
  const cinematic=state==='loading'||state==='menu'||state==='returning';
  if(cinematic){
    const pose=loadingCamera.step(dt,loadingActive());
    camera.setPosition(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.camera!.fov=pose.fov;
    if(state==='returning'&&pose.phase==='ready'&&loadingActive()){initialCameraReturn=false;state='menu';reset();}
  }
  if (player) {
    const s = placeKart(player, pos, lane, steerVis);
    bots.forEach(b => {
      const frame=placeKart(b.mesh,b.total,b.lateral,clamp(b.targetLane-b.lateral,-1,1)*.08);
      const visible=(state==='running'||state==='paused')&&b.total<LENGTH*3;
      b.fx.shield.enabled=visible&&b.shield>0;b.fx.shield.setPosition(b.mesh.getPosition().clone().add(new pc.Vec3(0,1.2,0)));
      for(const flame of b.fx.flames){flame.mesh.enabled=visible&&b.boost>0;const p=scaled(scaled(frame.p.clone(),frame.t,-2.2),frame.n,flame.side*.54);p.y+=.55;flame.mesh.setPosition(p);flame.mesh.setRotation(new pc.Quat().setFromDirections(UP,frame.t.clone().mulScalar(-1)));flame.mesh.setLocalScale(1,.95+.2*Math.sin(elapsed*24+b.phase),1);}
      for(const [kind,model] of Object.entries(b.fx.inventory)){model.enabled=visible&&(b.held===kind||(kind==='pulse'&&b.pulseFlash>0));model.setPosition(b.mesh.getPosition().clone().add(new pc.Vec3(0,3.4,0)));model.setEulerAngles(0,degrees(elapsed*1.8),0);const size=kind==='pulse'&&b.pulseFlash>0?1.1+(.65-b.pulseFlash)*2:.55;model.setLocalScale(size,size,size);}
    });
    const menu = state === 'menu' || state === 'finished';
    let cameraPosition: pc.Vec3, look: pc.Vec3;
    if (menu) {
      const t = clock * .12, focus = sample(state === 'finished' ? pos : 0);
      cameraPosition = scaled(scaled(focus.p.clone(), focus.t, 10 + Math.sin(t) * 2), focus.n, 15 + Math.cos(t) * 2);
      cameraPosition.y += 7.7;
      look = scaled(scaled(focus.p.clone(), focus.n, -3.8), focus.t, 8); look.y += 1.2;
      if(!cinematic)camera.camera!.fov = 53;
    } else {
      const angles = orbit.step(state === 'paused' ? 0 : dt);
      const pose=chaseCamera({position:s.p,tangent:s.t,view,rearView,orbit:angles});
      cameraPosition=new pc.Vec3(pose.position.x,pose.position.y,pose.position.z);
      look=new pc.Vec3(pose.look.x,pose.look.y,pose.look.z);
      if(!cinematic)camera.camera!.fov = damp(camera.camera!.fov, boost > 0 ? 65 : 56, 3, state==='paused'?0:dt);
    }
    if(!cinematic){
    if (snapCamera) { camera.setPosition(cameraPosition); snapCamera = false; }
    else if(state!=='paused')camera.setPosition(new pc.Vec3().lerp(camera.getPosition(), cameraPosition, 1 - Math.exp(-dt * (menu ? 1.8 : 8))));
    camera.lookAt(look);
    }
    shieldMesh.enabled = shield > 0;
    shieldMesh.setPosition(player.getPosition().clone().add(new pc.Vec3(0, 1.2, 0)));
    for (const flame of flames) {
      flame.mesh.enabled = boost > 0;
      const p = scaled(scaled(s.p.clone(), s.t, -2.2), s.n, flame.side * .54); p.y += .55;
      flame.mesh.setPosition(p);
      flame.mesh.setRotation(new pc.Quat().setFromDirections(UP, s.t.clone().mulScalar(-1)));
      flame.mesh.setLocalScale(1, .95 + Math.sin(elapsed * 24) * .2, 1);
    }
    eachMesh(controllers.get(selectedDriverId)?.chassis || player, mesh => {
      const mat = mesh.material as pc.StandardMaterial;
      if (/body|paint/i.test(mat.name) && mat.emissive) mat.emissive.set(hit > 0 && Math.floor(clock * 12) % 2 ? .333 : 0, 0, 0);
    });
  }
  for (const spark of sparks) { spark.t -= effectDt; scaled(spark.p, spark.v, effectDt); spark.v.y -= 5 * effectDt; }
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
    engine: 'PlayCanvas', state, pos, lane, speed, elapsed, charge, boost, shield, slow, held, drifting, steerVis,
    bots: bots.map(({id,total,lateral,speed,held,boost,shield,slow,reaction,cooldown,pickups,uses,finishedAt})=>({id,total,lateral,speed,held,boost,shield,slow,reaction,cooldown,pickups,uses,finishedAt})),
    lap: coastLap(pos, LENGTH), length: LENGTH, rank: finishRank || rank(), camera: view,
    muted, mouseLook: { ...orbit.get(), ...mouseLook.get() }, modelsLoaded: ready, allDriversLoaded: bundledDrivers.size === 6,
    bundledLoaded: [...bundledDrivers.keys()], bundledFailures: [...bundledFailures.keys()],
    loading: { ...loadingSnapshot, records: loadingSnapshot.records.map(record => ({ ...record })), busy: loadingBusy, courseBuilt, error: loadingError },
    selectedDriverId, tuning:racerTuning(selectedDriverId), kartBuild:{...activeKartBuild}, modularKartsLoaded:kartTemplates.size>0, quality:settings.quality, standings:standings().map(r=>({...r})), importedSlots: DRIVERS.filter(d => localDrivers.has(d.id)).map(d => d.id), importing: localDrivers.busy,
    driverStates: DRIVERS.map(d => ({ id: d.id, appearance: localDrivers.has(d.id) ? 'local-import' : bundledDrivers.has(d.id) ? 'bundled-model' : 'not-loaded', ...(controllers.get(d.id)?.getState() || {}) })),
    drawCalls: stats.drawCalls?.total ?? stats.frame?.drawCalls ?? 0, triangles: stats.frame?.triangles ?? 0,
  };
}
window.neonKart = { getState, start: reset, pause, useItem, selectDriver, importDrivers, retryLoading: boot, clearDriver: () => localDrivers.clear(selectedDriverId) };
// Opt-in deterministic browser QA. It never changes production play unless explicitly invoked.
let manual = false;
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
  window.neonKart.debug = {
    app, world, sample, orbit, mouseLook, keys, controllers, courseAssets, localDrivers, update, advanceFrame, draw, setupRacers, updateDriverUI,
    player: () => player, bots: () => bots, boxes: () => boxes,
    freeze: (value = true) => { manual = value; },
    step: (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) { const dt = 1 / 60; clock += dt; if (ready) update(dt); draw(dt); } },
    set: (values: Record<string, any>) => {
      ({ pos = pos, lane = lane, speed = speed, held = held, boost = boost, state = state, ready = ready, steerVis = steerVis, charge = charge, drifting = drifting, shield = shield, countdown = countdown, elapsed = elapsed, hit = hit, slow = slow } = values);
      if (values.noBots) { for (const b of bots) { releaseBotFX(b); releaseActor(b.mesh); } bots = []; }
    },
  };
}
addEventListener('blur',()=>{loadingFocused=false;});
addEventListener('focus',()=>{loadingFocused=true;frameClock.reset();});
addEventListener('pageshow',()=>{loadingFocused=true;frameClock.reset();});
addEventListener('resize', () => { if(!disposed){app.resizeCanvas(); snapCamera = true;} });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextUnavailable=true; release();renderLoadingUI(); $('count').textContent = '画面已中断，请刷新'; $('count').classList.add('paused');
});
function advanceFrame(delta:number){
  if(disposed||contextUnavailable)return;
  performancePanel.sample(performance.now(),state==='running',state);
  const frame=frameClock.sample(delta,state==='running'||state==='countdown',countdown);
  // Foreground stalls use bounded catch-up; real interruptions come from controls.
  const dt = frame.dt; if(state!=='paused')clock += dt;
  // Substep every accepted interval; the frame clock bounds exceptional stalls.
  if (ready && (state==='running'||state==='countdown')) { let remaining=dt; while(remaining>1e-8){const step=Math.min(1/60,remaining);update(step);remaining-=step;if(state!=='running'&&state!=='countdown')break;} }
  else if(ready)update(dt);
  draw(Math.min(.25,dt));
}
app.on('update',(delta:number)=>{if(!manual)advanceFrame(delta);});
loadingUi.retryButton.onclick=()=>void boot();
loadingUi.continueButton.onclick=reset;
const initialPose=loadingCamera.step(0);
camera.setPosition(initialPose.position.x,initialPose.position.y,initialPose.position.z);camera.lookAt(initialPose.look.x,initialPose.look.y,initialPose.look.z);camera.camera!.fov=initialPose.fov;
void boot();
app.start();

addEventListener('pagehide',(event: PageTransitionEvent)=>{
  loadingFocused=false;release();
  if(event.persisted)return; // BFCache restores the same paused session.
  dynamicPickups.finish();disposed=true;ready=false;state='leaving';importStatusVersion++;
  if(loadingTimer)clearInterval(loadingTimer);loadingTimer=null;
  app.autoRender=false;app.renderNextFrame=false;
  if(app.frameRequestId&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(app.frameRequestId);
  loadingUi.dispose();loadingCamera.dispose();controls.dispose();shell.dispose();performancePanel.dispose();localDrivers.dispose();lifetime.close();
});
