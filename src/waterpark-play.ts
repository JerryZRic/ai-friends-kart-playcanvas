import * as pc from 'playcanvas';
import {mountRaceHud} from './race-hud';
import {createRaceShell} from './race-shell';
import {createRaceFrameClock} from './race-frame-clock';
import {bindRaceControls} from './race-controls';
import {chaseCamera} from './race-camera';
import {createPerformancePanel} from './waterpark-performance-ui';
import {createWaterparkScene} from './waterpark-scene';
import {sampleWaterparkLoop as sampleWaterpark,WATER_RACE_LENGTH,WATER_RACE_PICKUPS} from './waterpark-design';
import {sampleWaterSurface,waterSurfaceRotation} from './waterpark-surface';
import {createWaterMount} from './water-mount';
import {WATER_HANDLING} from './waterpark-motion';
import {createWaterparkWake} from './waterpark-wake';
import {newWaterRace,advanceWaterRace,resetWaterPickups,useWaterItem,waterStandings,waterTravelSpeed,WATER_LAPS,WATER_CHECKPOINTS} from './water-race';
import {createItemModel,type ItemDisplay} from './item-models';
import type {RacingPickup} from './npc-tactics';
import {characterTuning} from './character-profiles';
import {readGameSettings,saveGameSettings,qualitySettings} from './game-settings';
import {createWaterparkLifetime} from './waterpark-lifetime';
import {loadBundledDrivers,type DriverAsset} from './assets';
import {DRIVERS,getDriver} from './driver-roster.js';

mountRaceHud({subtitle:'SKY WATERPARK GRAND PRIX',canvasLabel:'晴空水上乐园 3D 赛道'});
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('game');
const initialDriver=getDriver(new URLSearchParams(globalThis.location?.search??'').get('driver')).id;
const shell=createRaceShell(document,canvas,{map:'waterpark',driver:initialDriver,track:{length:WATER_RACE_LENGTH,sample:sampleWaterpark}});
let startupApp:pc.Application|undefined, cleanup:undefined|(()=>void);
try {
  const app=startupApp=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
  // Keep real frame deltas; the shared clock separates preparation from an
  // interrupted race instead of charging model/shader warm-up to the race.
  app.maxDeltaTime=Infinity;
  const settings=readGameSettings(),quality=qualitySettings(settings.quality);
  app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio||1,quality.pixelRatioCap);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const world=createWaterparkScene(app,{race:true}),wake=createWaterparkWake(app,world.root,{race:true});
  world.reflection.exclude(wake.entity);
  world.reflection.setRefractionEnabled(settings.refraction);
  for(const light of world.root.findComponents('light') as pc.LightComponent[]){light.castShadows=quality.shadows;light.shadowResolution=quality.shadowResolution;}
  const assets=new Map<string,DriverAsset>(),failures=new Map<string,string>();
  let selected=initialDriver,mount=createWaterMount(app,undefined,{id:selected,color:getDriver(selected).color});
  let mountedAsset:DriverAsset|undefined,race=newWaterRace(selected),clock=0,visualSteer=0;
  let autostart=new URLSearchParams(globalThis.location?.search??'').get('autostart')==='1';
  const frameClock=createRaceFrameClock();
  let mode:'menu'|'riding'|'paused'|'finished'='menu',busy=false;
  world.root.addChild(mount.root);world.reflection.exclude(mount.root);
  const events=new AbortController();
  let controls:ReturnType<typeof bindRaceControls>,view=0,snapCamera=true,lastRearView=false;
  const npcMounts=new Map<string,ReturnType<typeof createWaterMount>>();
  const pickups:RacingPickup[]=[];
  for(const {d,lateral:lane} of WATER_RACE_PICKUPS){
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
  }),{getEnabled:()=>world.reflection.getSettings().requestedRefraction,setEnabled:enabled=>{world.reflection.setRefractionEnabled(enabled);saveGameSettings({...readGameSettings(),refraction:enabled});}},{mount:$('raceSettings'),scene:'waterpark-circuit-six-racers'});
  const clearKeys=()=>{controls?.clear();race.racers[0].motion.charge=0;race.racers[0].motion.drifting=false;};

  function updatePicker() {
    for(const d of DRIVERS) {
      const b=$<HTMLButtonElement>('driver-'+d.id);
      b.disabled=busy||mode==='paused'||mode==='riding';
      b.setAttribute('aria-pressed',String(d.id===selected));
      b.textContent=d.label+(assets.has(d.id)?'':' · 未就绪');
    }
    const ready=assets.size===DRIVERS.length&&!!mountedAsset&&mountedAsset===assets.get(selected),start=$<HTMLButtonElement>('start');
    start.disabled=!ready||busy;
    $('startText').textContent=mode==='finished'?'再来一场':ready?'开始 · 三圈竞速':'等待角色加载';
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
      world.root.addChild(mount.root);world.reflection.exclude(mount.root); $('message').textContent='';shell.updateNavigation('waterpark',selected);
      race=newWaterRace(selected);resetWaterPickups(race,pickups);
      for(const npc of npcMounts.values())npc.dispose();npcMounts.clear();
      for(const racer of race.racers.slice(1)){const npc=createWaterMount(app,assets.get(racer.id),{id:racer.id,color:getDriver(racer.id).color});npcMounts.set(racer.id,npc);world.root.addChild(npc.root);world.reflection.exclude(npc.root);}
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
    frameClock.reset();clearKeys(); controls.mouseLook.release();
    if(mode==='paused'){mode='riding';shell.setPaused(false,race.countdown);}
    else {race=newWaterRace(selected);resetWaterPickups(race,pickups);clock=0;visualSteer=0;lastAnnouncement='';controls.orbit.recenter(true);snapCamera=true;shell.start(race.countdown);mode='riding';}
    $('message').textContent=''; canvas.focus();updatePicker();
  }
  function pause() {
    if(mode==='riding') {
      performancePanel.interrupt('paused'); mode='paused'; clearKeys(); controls.mouseLook.release();shell.setPaused(true,race.countdown);updatePicker();
    } else if(mode==='paused')start();
  }
  function restart(){if(mode==='menu'||busy)return;performancePanel.interrupt('restart');mode='finished';start();}
  function useItem(){if(mode==='riding')useWaterItem(race,race.racers[0]);}
  function navigate(screen=''){clearKeys();controls.mouseLook.release();const urls=shell.updateNavigation('waterpark',selected)!;location.href=screen==='maps'?urls.changeMap:screen==='characters'?urls.changeCharacter:urls.main;}
  function switchCamera(){view=(view+1)%2;controls.orbit.recenter(true);snapCamera=true;shell.toast(view?'高位追逐视角':'低位追逐视角');}
  $('start').addEventListener('click',start,{signal:events.signal});
  $('pause').addEventListener('click',pause,{signal:events.signal});
  $('resumeRace').addEventListener('click',pause,{signal:events.signal});
  $('restartRace').addEventListener('click',restart,{signal:events.signal});
  $('pauseMenu').addEventListener('click',()=>navigate(),{signal:events.signal});
  $('pauseChangeMap').addEventListener('click',()=>navigate('maps'),{signal:events.signal});
  $('item').addEventListener('click',useItem,{signal:events.signal});
  $('camera').addEventListener('click',switchCamera,{signal:events.signal});
  $('sound').addEventListener('click',()=>shell.toggleSound(),{signal:events.signal});
  $('restart').addEventListener('click',restart,{signal:events.signal});
  controls=bindRaceControls(canvas,{state:()=>mode==='riding'?'active':mode,pause,useItem,switchCamera,start,recenter:()=>shell.toast('视角回正'),status:status=>{
    $('lookHint').textContent=status==='locked'?'移动鼠标环顾 · Q 回正 · 右键回看 · Esc 暂停并释放鼠标':status==='drag'?'按住鼠标左键拖动环顾 · Q 回正 · Esc 暂停':'单击赛道，移动鼠标环顾 · Q 回正 · Esc 暂停';
  },onClear:()=>{race.racers[0].motion.charge=0;race.racers[0].motion.drifting=false;},signal:events.signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();controls.release();$('count').textContent='画面已中断，请刷新';$('count').classList.add('paused');},{signal:events.signal});
  let lastAnnouncement='';
  const resize=()=>app.resizeCanvas(); window.addEventListener('resize',resize,{signal:events.signal});
  cleanup=()=>{
    performancePanel.dispose();clearKeys();controls.dispose();shell.dispose();events.abort(); app.autoRender=false; app.renderNextFrame=false;
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
    const frame=frameClock.sample(dt,mode==='riding',race.countdown);
    const step=frame.dt; let steer=visualSteer;
    // A suspended race pauses; initial rendering and countdown do not.
    if(frame.interrupted){pause();shell.toast('画面中断，比赛已暂停 · 继续后接着比赛');}
    shell.tick(step);
    const pressed=(key:string)=>!!controls.keys[key];
    if(mode==='riding') {
      const oldCount=Math.ceil(race.countdown);
      steer=(pressed('KeyA')||pressed('ArrowLeft')?1:0)-(pressed('KeyD')||pressed('ArrowRight')?1:0); visualSteer=steer;
      advanceWaterRace(race,{throttle:pressed('KeyW')||pressed('ArrowUp'),brake:pressed('Space'),reverse:pressed('KeyS')||pressed('ArrowDown'),drift:pressed('ShiftLeft')||pressed('ShiftRight'),steer},step,pickups);
      clock=race.elapsed;
      if(Math.ceil(race.countdown)!==oldCount)shell.tone(race.countdown>0?500:1000,.15);
      if(race.finished) {
        performancePanel.interrupt('finished');mode='finished';clearKeys();controls.mouseLook.release();
        const rank=waterStandings(race).findIndex(r=>r.id===selected)+1;
        $('message').textContent=`三圈 · 第 ${rank} 名`;
        shell.finish({rank,elapsed:race.racers[0].finishTime??race.elapsed,selectedDriverId:selected,racers:waterStandings(race).map(r=>({id:r.id,finishedAt:r.finishTime,total:r.total})),trackLength:WATER_RACE_LENGTH});
        updatePicker();shell.tone(1000,.4);

      }
    } else if(mode==='menu'&&!document.hidden)clock+=Math.min(step,.05);
    const motion=race.racers[0].motion;
    if(mode==='riding')shell.renderCountdown(race.countdown);
    for(const racer of race.racers.slice(1)){
      const npc=npcMounts.get(racer.id);if(!npc)continue;
      const pose=sampleWaterpark(racer.total,racer.lateral),surface=sampleWaterSurface(pose.p.x,pose.p.z,clock),rotation=waterSurfaceRotation(surface.normal,pose.angle);
      npc.root.setPosition(pose.p.x,surface.height,pose.p.z);npc.root.setRotation(rotation.x,rotation.y,rotation.z,rotation.w);
      npc.update({speed:waterTravelSpeed(racer),steer:racer.motion.lateralSpeed/3,time:clock,boost:Math.min(1,Math.max(racer.boost,racer.motion.slideBoost))});
    }
    for(const racer of race.racers){
      const pose=sampleWaterpark(racer.total,racer.lateral),rings=effects.get(racer.id)!;
      rings[0].enabled=racer.shield>0;rings[1].enabled=racer.warning>0||racer.boost>0||racer.motion.slideBoost>0;rings[2].enabled=racer.pulseFlash>0||racer.slow>0;
      rings.forEach((ring,i)=>{ring.setPosition(pose.p.x,.55+i*.22,pose.p.z);const size=i===2&&racer.pulseFlash>0?1+(1-racer.pulseFlash/.8)*6:i===1&&racer.warning>0?1.15+Math.sin(clock*24)*.15:1;ring.setLocalScale(size,1,size);});
    }
    const standings=waterStandings(race),player=race.racers[0];
    const travelSpeed=waterTravelSpeed(player);
    shell.updateHUD({rank:standings.findIndex(r=>r.id===selected)+1,lap:Math.min(WATER_LAPS,1+Math.floor(player.checkpoint/WATER_CHECKPOINTS)),elapsed:race.elapsed,speed:travelSpeed,charge:motion.charge,chargeMax:WATER_HANDLING.slideMaxCharge,boost:Math.max(player.boost,motion.slideBoost),shield:player.shield,held:player.held,slideLabel:'左 Shift + A / D 水上滑移',canUseItem:mode==='riding'&&race.countdown<=0&&!motion.finished});
    shell.drawMinimap(race.racers.map(r=>({total:r.total,color:getDriver(r.id).color,player:r.id===selected})));
    const announcement=race.announcements.at(-1)??'';if(announcement&&announcement!==lastAnnouncement){lastAnnouncement=announcement;shell.toast(announcement);}
    const s=sampleWaterpark(motion.distance,motion.lane);
    const surface=sampleWaterSurface(s.p.x,s.p.z,clock);
    // Surface following is a water adapter detail; shared camera follows the track frame.
    const orientation=waterSurfaceRotation(surface.normal,s.angle+motion.lateralSpeed*2.3*Math.PI/180);
    mount.root.setPosition(s.p.x,surface.height,s.p.z); mount.root.setRotation(orientation.x,orientation.y,orientation.z,orientation.w);
    mount.update({speed:travelSpeed,steer,time:clock,boost:Math.min(1,Math.max(player.boost,motion.slideBoost))}); wake.update(motion.distance,motion.lane,travelSpeed,clock,motion.lateralSpeed); world.waterMaterial.setParameter('time',clock);
    const rearView=!!controls.keys.RearView;if(rearView!==lastRearView){snapCamera=true;lastRearView=rearView;}
    const pose=chaseCamera({position:s.p,tangent:s.t,view,rearView,orbit:controls.orbit.step(mode==='paused'?0:step)});
    const cameraPosition=new pc.Vec3(pose.position.x,pose.position.y,pose.position.z);
    if(snapCamera){world.camera.setPosition(cameraPosition);snapCamera=false;}
    else if(mode!=='paused')world.camera.setPosition(new pc.Vec3().lerp(world.camera.getPosition(),cameraPosition,1-Math.exp(-Math.min(step,.25)*8)));
    world.camera.lookAt(pose.look.x,pose.look.y,pose.look.z);
    if(mode!=='paused')world.camera.camera!.fov+=( (player.boost>0||motion.slideBoost>0?65:56)-world.camera.camera!.fov)*(1-Math.exp(-3*Math.min(step,.25)));
    world.reflection.update();

  });
  app.start(); void load();
} catch(error) {
  if(cleanup)cleanup(); else startupApp?.destroy();
  const detail=(error instanceof Error?error.message:String(error)).slice(0,180);
  $('load').textContent='无法启动水上比赛：'+detail+'。可刷新重试，详细信息见控制台。'; console.error(error);
}
