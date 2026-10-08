import * as pc from 'playcanvas';
import {createPerformancePanel} from './waterpark-performance-ui';
import {createWaterparkScene} from './waterpark-scene';
import {sampleWaterparkLoop as sampleWaterpark,WATER_RACE_LENGTH} from './waterpark-design';
import {sampleWaterSurface,waterSurfaceRotation} from './waterpark-surface';
import {createWaterMount} from './water-mount';
import {createWaterparkWake} from './waterpark-wake';
import {newWaterRace,advanceWaterRace,resetWaterPickups,useWaterItem,waterStandings,waterTravelSpeed,WATER_LAPS,WATER_CHECKPOINTS} from './water-race';
import {createItemModel,itemImage,type ItemDisplay} from './item-models';
import type {RacingPickup} from './npc-tactics';
import {characterTuning} from './character-profiles';
import {readGameSettings,saveGameSettings,qualitySettings} from './game-settings';
import {createWaterparkInput,isWaterparkGameKeyTarget} from './waterpark-input';
import {createWaterparkLifetime} from './waterpark-lifetime';
import {loadBundledDrivers,type DriverAsset} from './assets';
import {DRIVERS,getDriver} from './driver-roster.js';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('water-game');
let startupApp:pc.Application|undefined, cleanup:undefined|(()=>void);
try {
  const app=startupApp=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
  // Keep real frame deltas: race fixed steps handle ordinary stalls, while >1s
  // suspension enters an explicit pause instead of silently slowing the clock.
  app.maxDeltaTime=Infinity;
  const settings=readGameSettings(),quality=qualitySettings(settings.quality);
  app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio||1,quality.pixelRatioCap);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const world=createWaterparkScene(app,{race:true}),wake=createWaterparkWake(app,world.root,{race:true});
  world.reflection.exclude(wake.entity);
  world.reflection.setRefractionEnabled(settings.refraction);
  for(const light of world.root.findComponents('light') as pc.LightComponent[]){light.castShadows=quality.shadows;light.shadowResolution=quality.shadowResolution;}
  const assets=new Map<string,DriverAsset>(),failures=new Map<string,string>();
  let selected=getDriver(new URLSearchParams(globalThis.location?.search??'').get('driver')).id,mount=createWaterMount(app,undefined,{id:selected,color:getDriver(selected).color});
  let mountedAsset:DriverAsset|undefined,race=newWaterRace(selected),clock=0,visualSteer=0;
  let autostart=new URLSearchParams(globalThis.location?.search??'').get('autostart')==='1';
  let mode:'menu'|'riding'|'paused'|'finished'='menu',busy=false;
  world.root.addChild(mount.root);world.reflection.exclude(mount.root);
  const input=createWaterparkInput(),events=new AbortController();
  const npcMounts=new Map<string,ReturnType<typeof createWaterMount>>();
  const pickups:RacingPickup[]=[];
  for(let d=45;d<WATER_RACE_LENGTH;d+=75)for(const lane of [-4,0,4]){
    const entity=new pc.Entity('水上道具箱');world.root.addChild(entity);
    const models={} as Record<ItemDisplay,pc.Entity>;
    for(const kind of ['boost','shield','pulse','mystery'] as const){models[kind]=createItemModel(app,kind);models[kind].setLocalScale(1.2,1.2,1.2);entity.addChild(models[kind]);}world.reflection.exclude(entity);
    const p=sampleWaterpark(d,lane).p;entity.setPosition(p.x,1.1,p.z);
    pickups.push({d,lateral:lane,mesh:entity,models,display:'boost',cool:0});
  }
  resetWaterPickups(race,pickups);
  const effectMesh=pc.Mesh.fromGeometry(app.graphicsDevice,new pc.TorusGeometry({tubeRadius:.065,ringRadius:1.55,segments:24,sides:6}));
  const effectMaterials=['#5de6ff','#ffc259','#e986ff'].map(hex=>{const material=new pc.StandardMaterial();material.diffuse=new pc.Color().fromString(hex);material.emissive=material.diffuse.clone();material.opacity=.72;material.blendType=pc.BLEND_NORMAL;material.depthWrite=false;material.cull=pc.CULLFACE_NONE;material.update();return material;});
  const effects=new Map(DRIVERS.map(d=>{const rings=effectMaterials.map((material,i)=>{const ring=new pc.Entity(`${d.id} ${['护盾','道具预警和加速','脉冲'][i]}`);ring.addComponent('render',{meshInstances:[new pc.MeshInstance(effectMesh,material)],castShadows:false});world.root.addChild(ring);world.reflection.exclude(ring);ring.enabled=false;return ring;});return [d.id,rings];}));
  world.root.once('destroy',()=>{effectMesh.destroy();for(const material of effectMaterials)material.destroy();});
  const lifetime=createWaterparkLifetime(()=>{wake.dispose(); mount.dispose();for(const npc of npcMounts.values())npc.dispose(); app.destroy();});
  const performancePanel=createPerformancePanel(canvas,()=>({
    quality:settings.quality,pixelRatioCap:quality.pixelRatioCap,loopLength:WATER_RACE_LENGTH,racerCount:6,profile:characterTuning(selected,'waterpark'),driver:selected,water:world.reflection.getSettings(),
  }),{getEnabled:()=>world.reflection.getSettings().requestedRefraction,setEnabled:enabled=>{world.reflection.setRefractionEnabled(enabled);saveGameSettings({...readGameSettings(),refraction:enabled});}});
  const portraits=Object.fromEntries((['boost','shield','pulse'] as const).map(kind=>[kind,itemImage(kind)]));
  const clearKeys=()=>input.clear();

  function updatePicker() {
    for(const d of DRIVERS) {
      const b=$<HTMLButtonElement>('driver-'+d.id);
      b.disabled=busy||mode==='paused'||mode==='riding';
      b.setAttribute('aria-pressed',String(d.id===selected));
      b.textContent=d.label+(assets.has(d.id)?'':' · 未就绪');
    }
    const ready=assets.size===DRIVERS.length&&!!mountedAsset&&mountedAsset===assets.get(selected),start=$<HTMLButtonElement>('start');
    start.disabled=!ready||busy;
    start.textContent=mode==='paused'?'继续比赛':mode==='finished'?'再跑一次':ready?'开始 · 三圈竞速':'等待角色加载';
    $<HTMLButtonElement>('retry').disabled=busy||mode==='paused'||mode==='riding';
    const pauseButton=$<HTMLButtonElement>('pause');
    pauseButton.disabled=mode!=='riding'&&mode!=='paused';
    pauseButton.textContent=mode==='paused'?'▶':'Ⅱ';
    pauseButton.setAttribute('aria-label',mode==='paused'?'继续':'暂停');
    $<HTMLButtonElement>('restart').disabled=busy||mode==='menu';
    $('restart').classList.toggle('hidden',mode==='menu');
  }
  function select(id:string) {
    if(lifetime.closed||mode==='riding'||mode==='paused')return;
    try {
      // Build first, so a bad rider cannot destroy the last usable preview.
      const next=createWaterMount(app,assets.get(id),{id,color:getDriver(id).color});
      mount.dispose(); mount=next; selected=id; mountedAsset=assets.get(id);
      world.root.addChild(mount.root);world.reflection.exclude(mount.root); $('message').textContent='';
      race=newWaterRace(selected);resetWaterPickups(race,pickups);
      for(const npc of npcMounts.values())npc.dispose();npcMounts.clear();
      for(const racer of race.racers.slice(1)){const npc=createWaterMount(app,assets.get(racer.id),{id:racer.id,color:getDriver(racer.id).color});npcMounts.set(racer.id,npc);world.root.addChild(npc.root);world.reflection.exclude(npc.root);}
      for(const [id,screen] of [['change-driver','characters'],['change-map','maps']])$<HTMLAnchorElement>(id).href=`./index.html?screen=${screen}&map=waterpark&driver=${selected}`;
    } catch(error) { $('message').textContent=`无法准备 ${getDriver(id).label}：${String(error)}`; }
    updatePicker();
  }
  for(const d of DRIVERS) {
    const b=document.createElement('button'); b.id='driver-'+d.id; b.type='button';
    b.addEventListener('click',()=>select(d.id),{signal:events.signal}); $('drivers').append(b);
  }
  updatePicker();
  async function load() {
    if(busy||lifetime.closed||mode==='riding'||mode==='paused')return;
    busy=true; $('retry').classList.add('hidden'); updatePicker();
    await lifetime.run(async signal=>{
      try {
        const result=await loadBundledDrivers(app,{existing:assets,signal,onStatus:s=>{
          if(lifetime.closed)return;
          const total=s.totalBytes==null?'未知':(s.totalBytes/1048576).toFixed(1);
          $('load').textContent=`角色 ${s.loaded} / ${s.total} · ${(s.receivedBytes/1048576).toFixed(1)} / ${total} MiB · 下载后准备模型`;
        }});
        if(lifetime.closed)return;
        for(const[id,a]of result.assets)assets.set(id,a);
        failures.clear(); for(const[id,error]of result.failures)failures.set(id,String(error));
        $('load').textContent=failures.size?`已就绪 ${assets.size}/6；失败：${[...failures.keys()].join('、')}`:'六位原有角色已就绪 · 非商业试玩';
        $('retry').classList.toggle('hidden',!failures.size); select(selected);
      } catch(error) {
        if(!lifetime.closed){$('load').textContent='角色准备失败，可重试：'+String(error);$('retry').classList.remove('hidden');}
      } finally {busy=false;if(!lifetime.closed){updatePicker();if(autostart&&mountedAsset&&assets.size===DRIVERS.length){autostart=false;start();}}}
    });
  }
  $('retry').addEventListener('click',()=>void load(),{signal:events.signal});
  function start() {
    if(lifetime.closed||mode==='riding'||assets.size!==DRIVERS.length||!mountedAsset||mountedAsset!==assets.get(selected)||busy)return;
    clearKeys();
    if(mode!=='paused'){race=newWaterRace(selected);resetWaterPickups(race,pickups);clock=0;visualSteer=0; $('results').textContent='';}
    $('menu').classList.add('hidden'); mode='riding'; $('message').textContent=''; canvas.focus(); updatePicker();
  }
  function pause() {
    if(mode==='riding') {
      performancePanel.interrupt('paused'); mode='paused'; clearKeys(); $('menu').classList.remove('hidden'); $('menu-title').textContent='已暂停';
      updatePicker(); $<HTMLButtonElement>('start').focus();
    } else if(mode==='paused')start();
  }
  $('start').addEventListener('click',start,{signal:events.signal});
  $('pause').addEventListener('click',pause,{signal:events.signal});
  function restart(){if(mode==='menu'||busy)return;performancePanel.interrupt('restart');mode='finished';start();}
  $('use-item').addEventListener('click',()=>{if(mode==='riding')useWaterItem(race,race.racers[0]);},{signal:events.signal});
  $('restart').addEventListener('click',restart,{signal:events.signal});
  const drivingKeys=new Set(['Space','KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  const down=(e:KeyboardEvent)=>{
    if(['Escape','KeyP'].includes(e.code)) {
      if(!e.repeat&&(mode==='riding'||mode==='paused')){e.preventDefault();pause();}
      return;
    }
    // Never steal arrows, Space, or letter keys from focused menu/source controls.
    if(!isWaterparkGameKeyTarget(e.target,canvas))return;
    if(e.code==='KeyE'){if(mode==='riding'){e.preventDefault();if(!e.repeat)useWaterItem(race,race.racers[0]);}return;}
    if(e.code==='KeyR'){if(!e.repeat)restart();return;}
    if(mode!=='riding'||!drivingKeys.has(e.code))return;
    e.preventDefault(); input.keyDown(e.code);
  };
  const up=(e:KeyboardEvent)=>input.keyUp(e.code);
  window.addEventListener('keydown',down,{signal:events.signal}); window.addEventListener('keyup',up,{signal:events.signal});
  const blur=()=>{clearKeys();if(mode==='riding')pause();};
  window.addEventListener('blur',blur,{signal:events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();},{signal:events.signal});
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    const key=button.dataset.key!;
    button.addEventListener('pointerdown',e=>{
      if(mode!=='riding'||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault(); input.pointerDown(e.pointerId,key); button.setPointerCapture(e.pointerId);
    },{signal:events.signal});
    const release=(e:PointerEvent)=>input.pointerUp(e.pointerId);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release,{signal:events.signal});
  }
  const resize=()=>app.resizeCanvas(); window.addEventListener('resize',resize,{signal:events.signal});
  cleanup=()=>{
    performancePanel.dispose(); clearKeys(); events.abort(); app.autoRender=false; app.renderNextFrame=false;
    // Abort HTTP work now, but preserve the app until an already-started GLB parse settles.
    lifetime.close();
  };
  window.addEventListener('pagehide',e=>{
    clearKeys();
    if(e.persisted){if(mode==='riding')pause();return;}
    cleanup!();
  },{signal:events.signal});
  app.on('update',(dt:number)=>{
    if(lifetime.closed)return;
    performancePanel.sample(performance.now(),mode==='riding'&&!busy&&race.countdown<=0&&race.racers[0].finishTime===null,race.countdown>0?'countdown':race.racers[0].finishTime!==null?'spectating':mode);
    const step=Number.isFinite(dt)?Math.max(0,dt):0; let steer=visualSteer;
    // A suspended tab is paused explicitly, never silently truncating its race clock.
    if(step>1&&mode==='riding')pause();
    if(mode==='riding') {
      steer=(input.pressed('KeyA')||input.pressed('ArrowLeft')?1:0)-(input.pressed('KeyD')||input.pressed('ArrowRight')?1:0); visualSteer=steer;
      advanceWaterRace(race,{throttle:input.pressed('KeyW')||input.pressed('ArrowUp'),brake:input.pressed('Space')||input.pressed('KeyS')||input.pressed('ArrowDown'),steer},step,pickups);
      clock=race.elapsed;
      if(race.finished) {
        performancePanel.interrupt('finished'); mode='finished'; clearKeys(); $('menu-title').textContent='比赛完成';
        $('message').textContent=`三圈 · ${(WATER_RACE_LENGTH*WATER_LAPS).toFixed(0)} 米 · 第 ${waterStandings(race).findIndex(r=>r.id===selected)+1} 名`;
        $('results').textContent=waterStandings(race).map((r,i)=>`${i+1}. ${getDriver(r.id).label}  ${r.finishTime!.toFixed(2)} 秒`).join('\n');
        $('menu').classList.remove('hidden'); updatePicker(); $<HTMLButtonElement>('start').focus();
      }
    } else if(mode==='menu'&&!document.hidden)clock+=Math.min(step,.05);
    const motion=race.racers[0].motion;
    $('countdown').textContent=mode==='riding'&&race.countdown>0?String(Math.ceil(race.countdown)):mode==='riding'&&motion.finished?'冲线！等待其他选手…':'';
    for(const racer of race.racers.slice(1)){
      const npc=npcMounts.get(racer.id);if(!npc)continue;
      const pose=sampleWaterpark(racer.total,racer.lateral),surface=sampleWaterSurface(pose.p.x,pose.p.z,clock),rotation=waterSurfaceRotation(surface.normal,pose.angle);
      npc.root.setPosition(pose.p.x,surface.height,pose.p.z);npc.root.setRotation(rotation.x,rotation.y,rotation.z,rotation.w);
      npc.update({speed:waterTravelSpeed(racer),steer:racer.motion.lateralSpeed/3,time:clock});
    }
    for(const racer of race.racers){
      const pose=sampleWaterpark(racer.total,racer.lateral),rings=effects.get(racer.id)!;
      rings[0].enabled=racer.shield>0;rings[1].enabled=racer.warning>0||racer.boost>0;rings[2].enabled=racer.pulseFlash>0||racer.slow>0;
      rings.forEach((ring,i)=>{ring.setPosition(pose.p.x,.55+i*.22,pose.p.z);const size=i===2&&racer.pulseFlash>0?1+(1-racer.pulseFlash/.8)*6:i===1&&racer.warning>0?1.15+Math.sin(clock*24)*.15:1;ring.setLocalScale(size,1,size);});
    }
    const standings=waterStandings(race),player=race.racers[0];
    $('rank').textContent=String(standings.findIndex(r=>r.id===selected)+1);
    $('lap').textContent=String(Math.min(WATER_LAPS,1+Math.floor(player.checkpoint/WATER_CHECKPOINTS)));
    $('standings').textContent=standings.map((r,i)=>`${i+1} ${getDriver(r.id).label}${r.held?' · '+({boost:'加速',shield:'护盾',pulse:'脉冲'}[r.held]):''}${r.warning>0?' ⚠ 准备使用':''}${r.boost>0?' 🚀':''}${r.shield>0?' ◈':''}${r.slow>0?' 减速':''}`).join(' · ');
    const item=$<HTMLImageElement>('held-item');item.hidden=!player.held;if(player.held){if(item.dataset.kind!==player.held){item.src=portraits[player.held];item.dataset.kind=player.held;}item.alt=player.held;}
    $<HTMLButtonElement>('use-item').disabled=!player.held||mode!=='riding'||race.countdown>0||motion.finished;
    $('race-events').textContent=race.announcements.at(-1)??'';
    const s=sampleWaterpark(motion.distance,motion.lane);
    const surface=sampleWaterSurface(s.p.x,s.p.z,clock);
    // Surface following changes only presentation; steering/speed/camera stay approved.
    const orientation=waterSurfaceRotation(surface.normal,s.angle+motion.lateralSpeed*2.3*Math.PI/180);
    mount.root.setPosition(s.p.x,surface.height,s.p.z); mount.root.setRotation(orientation.x,orientation.y,orientation.z,orientation.w);
    const travelSpeed=waterTravelSpeed(player);
    mount.update({speed:travelSpeed,steer,time:clock}); wake.update(motion.distance,motion.lane,travelSpeed,clock,motion.lateralSpeed); world.waterMaterial.setParameter('time',clock);
    const ahead=sampleWaterpark(motion.distance+10,motion.lane*.6).p;
    world.camera.setPosition(s.p.x-s.t.x*8.2,3.8,s.p.z-s.t.z*8.2); world.camera.lookAt(ahead.x,1.6,ahead.z); world.reflection.update();
    $('speed').textContent=String(Math.round(travelSpeed*3.6)); $('distance').textContent=String(Math.floor(((motion.distance%WATER_RACE_LENGTH)+WATER_RACE_LENGTH)%WATER_RACE_LENGTH)); $('time').textContent=race.elapsed.toFixed(2);
  });
  app.start(); void load();
} catch(error) {
  if(cleanup)cleanup(); else startupApp?.destroy();
  const detail=(error instanceof Error?error.message:String(error)).slice(0,180);
  $('load').textContent='无法启动水上比赛：'+detail+'。可刷新重试，详细信息见控制台。'; console.error(error);
}
