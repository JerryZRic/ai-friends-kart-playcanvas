import * as pc from 'playcanvas';
import {createWaterparkScene} from './waterpark-scene';
import {sampleWaterpark} from './waterpark-design';
import {createWaterMount} from './water-mount';
import {createWaterparkWake} from './waterpark-wake';
import {newWaterState,stepWaterMotion} from './waterpark-motion';
import {createWaterparkInput,isWaterparkGameKeyTarget} from './waterpark-input';
import {createWaterparkLifetime} from './waterpark-lifetime';
import {loadBundledDrivers,type DriverAsset} from './assets';
import {DRIVERS,getDriver} from './driver-roster.js';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('water-game');
let startupApp:pc.Application|undefined, cleanup:undefined|(()=>void);
try {
  const app=startupApp=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
  app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio||1,1.7);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const world=createWaterparkScene(app),wake=createWaterparkWake(app,world.root);
  const assets=new Map<string,DriverAsset>(),failures=new Map<string,string>();
  let selected='whale',mount=createWaterMount(app,undefined,{id:selected,color:getDriver(selected).color});
  let mountedAsset:DriverAsset|undefined,motion=newWaterState(),clock=0,visualSteer=0;
  let mode:'menu'|'riding'|'paused'|'finished'='menu',busy=false;
  world.root.addChild(mount.root);
  const input=createWaterparkInput(),events=new AbortController();
  const lifetime=createWaterparkLifetime(()=>{wake.dispose(); mount.dispose(); app.destroy();});
  const clearKeys=()=>input.clear();

  function updatePicker() {
    for(const d of DRIVERS) {
      const b=$<HTMLButtonElement>('driver-'+d.id);
      b.disabled=busy||mode==='paused'||mode==='riding';
      b.setAttribute('aria-pressed',String(d.id===selected));
      b.textContent=d.label+(assets.has(d.id)?'':' · 未就绪');
    }
    const ready=!!mountedAsset&&mountedAsset===assets.get(selected),start=$<HTMLButtonElement>('start');
    start.disabled=!ready||busy;
    start.textContent=mode==='paused'?'继续体验':mode==='finished'?'再跑一次':ready?'出发 · 水上坐骑':'等待角色加载';
    $<HTMLButtonElement>('retry').disabled=busy||mode==='paused'||mode==='riding';
    const pauseButton=$<HTMLButtonElement>('pause');
    pauseButton.disabled=mode!=='riding'&&mode!=='paused';
    pauseButton.textContent=mode==='paused'?'▶':'Ⅱ';
    pauseButton.setAttribute('aria-label',mode==='paused'?'继续':'暂停');
  }
  function select(id:string) {
    if(lifetime.closed||mode==='riding'||mode==='paused')return;
    try {
      // Build first, so a bad rider cannot destroy the last usable preview.
      const next=createWaterMount(app,assets.get(id),{id,color:getDriver(id).color});
      mount.dispose(); mount=next; selected=id; mountedAsset=assets.get(id);
      world.root.addChild(mount.root); $('message').textContent='';
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
      } finally {busy=false;if(!lifetime.closed)updatePicker();}
    });
  }
  $('retry').addEventListener('click',()=>void load(),{signal:events.signal});
  function start() {
    if(lifetime.closed||!mountedAsset||mountedAsset!==assets.get(selected)||busy)return;
    clearKeys();
    if(mode!=='paused'){motion=newWaterState();clock=0;visualSteer=0;}
    $('menu').classList.add('hidden'); mode='riding'; $('message').textContent=''; canvas.focus(); updatePicker();
  }
  function pause() {
    if(mode==='riding') {
      mode='paused'; clearKeys(); $('menu').classList.remove('hidden'); $('menu-title').textContent='已暂停';
      updatePicker(); $<HTMLButtonElement>('start').focus();
    } else if(mode==='paused')start();
  }
  $('start').addEventListener('click',start,{signal:events.signal});
  $('pause').addEventListener('click',pause,{signal:events.signal});
  function restart(){if(mode==='menu'||busy)return;mode='finished';start();}
  const drivingKeys=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  const down=(e:KeyboardEvent)=>{
    if(['Escape','KeyP'].includes(e.code)) {
      if(!e.repeat&&(mode==='riding'||mode==='paused')){e.preventDefault();pause();}
      return;
    }
    // Never steal arrows, Space, or letter keys from focused menu/source controls.
    if(!isWaterparkGameKeyTarget(e.target,canvas))return;
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
    clearKeys(); events.abort(); app.autoRender=false; app.renderNextFrame=false;
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
    const step=Math.min(Number.isFinite(dt)?Math.max(0,dt):0,.05); let steer=visualSteer;
    if(mode==='riding') {
      clock+=step;
      steer=(input.pressed('KeyA')||input.pressed('ArrowLeft')?1:0)-(input.pressed('KeyD')||input.pressed('ArrowRight')?1:0); visualSteer=steer;
      motion=stepWaterMotion(motion,{throttle:input.pressed('KeyW')||input.pressed('ArrowUp'),brake:input.pressed('KeyS')||input.pressed('ArrowDown'),steer},step);
      if(motion.finished) {
        mode='finished'; clearKeys(); $('menu-title').textContent='样段完成'; $('message').textContent=`285 米 · ${motion.elapsed.toFixed(2)} 秒`;
        $('menu').classList.remove('hidden'); updatePicker(); $<HTMLButtonElement>('start').focus();
      }
    } else if(mode==='menu'&&!document.hidden)clock+=step;
    const s=sampleWaterpark(motion.distance,motion.lane);
    mount.root.setPosition(s.p.x,0,s.p.z); mount.root.setEulerAngles(0,s.angle*180/Math.PI+motion.lateralSpeed*2.3,0);
    mount.update({speed:motion.speed,steer,time:clock}); wake.update(motion.distance,motion.lane,motion.speed,clock); world.waterMaterial.setParameter('time',clock);
    const ahead=sampleWaterpark(motion.distance+10,motion.lane*.6).p;
    world.camera.setPosition(s.p.x-s.t.x*8.2,3.8,s.p.z-s.t.z*8.2); world.camera.lookAt(ahead.x,1.6,ahead.z);
    $('speed').textContent=String(Math.round(motion.speed*3.6)); $('distance').textContent=String(Math.floor(motion.distance)); $('time').textContent=motion.elapsed.toFixed(2);
  });
  app.start(); void load();
} catch(error) {
  if(cleanup)cleanup(); else startupApp?.destroy();
  const detail=(error instanceof Error?error.message:String(error)).slice(0,180);
  $('load').textContent='无法启动水上样段：'+detail+'。可刷新重试，详细信息见控制台。'; console.error(error);
}
