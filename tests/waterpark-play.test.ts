import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {setMaxListeners} from 'node:events';
import * as pc from 'playcanvas';
import {parseLocalGLB} from '../src/assets';
import {advanceWaterRace} from '../src/water-race';
import {setPickupDisplay} from '../src/item-pickups';
import type {RacingPickup} from '../src/npc-tactics';

/** Real entrypoint, meshes, rig and physics on NullGraphicsDevice. Browser DOM
 * events/image pixels and network scheduling are substituted; no GPU claim. */
for(const scenario of ['full-race','manual-ready','context-loss-loading','context-loss-return','close-loading'])test(`waterpark real entry loading and race lifecycle: ${scenario}`, async () => {
  const g=globalThis as any, names=['location','window','document','innerWidth','innerHeight','devicePixelRatio','__waterparkApp','__waterparkLoad','__waterparkRace','__waterparkControls'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(g,name)]));
  g.location={search:'?driver=whale'+(scenario==='manual-ready'?'':'&autostart=1')};
  const errors:unknown[]=[];const originalError=console.error;console.error=(...args)=>errors.push(args);
  const elements=new Map<string,Element>();
  class Element extends EventTarget {
    id:string; tagName:string; width=1280;height=800;disabled=false;hidden=false;removed=false;textContent='';value='';style={};dataset:any={};attributes:any={};children:Element[]=[];
    classes=new Set<string>();classList={add:(value:string)=>this.classes.add(value),remove:(value:string)=>this.classes.delete(value),contains:(value:string)=>this.classes.has(value),toggle:(value:string,force?:boolean)=>{const add=force??!this.classes.has(value);if(add)this.classes.add(value);else this.classes.delete(value);return add;}};
    constructor(id:string,tagName='DIV'){super();this.id=id;this.tagName=tagName;}
    getContext(){return new Proxy({}, {get:()=>()=>{}});}
    closest(selector:string){return selector.split(',').some(s=>s.trim().toUpperCase()===this.tagName)?this:null;}
    removeAttribute(name:string){delete this.attributes[name];}
    setAttribute(name:string,value:string){this.attributes[name]=value;}
    set innerHTML(html:string){
      for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
        const child=elements.get(match[3])??new Element(match[3],match[1].toUpperCase());
        child.disabled=/\bdisabled\b/.test(match[2]);child.hidden=/\bhidden\b/.test(match[2]);
        for(const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(attribute[1],attribute[2]);
        this.append(child);
      }
    }
    querySelector(selector:string){return elements.get(selector.replace(/^#/,''))??null;}
    remove(){this.removed=true;elements.delete(this.id);}
    getBoundingClientRect(){return{left:0,top:0,width:this.width,height:this.height};}
    append(element:Element){elements.set(element.id,element);this.children.push(element);}
    captured=new Set<number>();
    setPointerCapture(id:number){this.captured.add(id);}
    hasPointerCapture(id:number){return this.captured.has(id);}
    releasePointerCapture(id:number){this.captured.delete(id);this.emit('lostpointercapture',{pointerId:id});}
    focus(){g.document.activeElement=this;}
    click(){if(!this.disabled)this.emit('click');}
    emit(type:string,data:any={}){const event=new Event(type,{cancelable:true});Object.assign(event,data);this.dispatchEvent(event);return event;}
  }
  const element=(id:string)=>{if(!elements.has(id))elements.set(id,new Element(id,id==='game'?'CANVAS':['start','pause','retry'].includes(id)?'BUTTON':'DIV'));return elements.get(id)!;};
  const touch=['KeyW','KeyS','KeyA','KeyD','ShiftLeft','Space'].map(key=>{const e=element('touch-'+key);e.tagName='BUTTON';e.dataset.key=key;return e;});
  const windowTarget=new EventTarget(),documentTarget=new EventTarget();
  g.window=Object.assign(windowTarget,{devicePixelRatio:1});
  g.document=Object.assign(documentTarget,{hidden:false,activeElement:null,body:new Element('body','BODY'),documentElement:{clientWidth:1280,clientHeight:800},getElementById:element,querySelectorAll:()=>touch,createElement:(tag:string)=>new Element('',tag.toUpperCase())});
  g.innerWidth=1280;g.innerHeight=800;g.devicePixelRatio=1;
  const canvas=element('game'),app=new pc.AppBase(canvas as any),options=new pc.AppOptions();
  options.graphicsDevice=new pc.NullGraphicsDevice(canvas as any);
  options.componentSystems=[pc.RenderComponentSystem,pc.AnimComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];
  options.resourceHandlers=[pc.ContainerHandler,pc.RenderHandler,pc.MaterialHandler,pc.TextureHandler];options.devtools=false;app.init(options);
  app.assets.on('add',(asset:pc.Asset)=>{if(asset.type==='container')(asset.options as any).image={processAsync(_image:unknown,done:Function){const texture=new pc.Asset('test-texture','texture');texture.resource=new pc.Texture(options.graphicsDevice,{width:1,height:1});texture.loaded=true;app.assets.add(texture);done(null,texture);}};});
  (app as any).setCanvasFillMode=()=>{};(app as any).setCanvasResolution=()=>{};g.__waterparkApp=app;
  let release!:()=>void,attempts=0,signal!:AbortSignal,failLast=scenario==='full-race';
  let gate=new Promise<void>(resolve=>release=resolve);
  const bytes=gunzipSync(readFileSync('public/assets/drivers/whale-driver.glb.gz'));
  const driver=await parseLocalGLB(app,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  g.__waterparkLoad=async(_app:any,options:any)=>{
    attempts++;signal=options.signal;setMaxListeners(100,signal);
    options.onStatus({loaded:options.existing.size,total:6,receivedBytes:123,totalBytes:1000,records:[{stage:'downloading'}]});
    await gate;
    const assets=new Map(options.existing),failures=new Map();
    for(const id of ['whale','gemini','gpt','claude','grok','glm']){if(id==='glm'&&failLast)failures.set(id,'Injected partial failure');else assets.set(id,driver);}
    options.onStatus({loaded:assets.size,total:6,receivedBytes:100,totalBytes:null});
    return{assets,failures};
  };
  let source=readFileSync('src/waterpark-play.ts','utf8');
  source=source.replace('loadBundledDrivers,type DriverAsset','loadBundledDrivers as unusedLoader,type DriverAsset');
  source=source.replace("const canvas=$<HTMLCanvasElement>('game');","const loadBundledDrivers=(globalThis as any).__waterparkLoad;\nconst canvas=$<HTMLCanvasElement>('game');");
  source=source.replace(/new pc\.Application\(canvas,.*?\);/,'(globalThis as any).__waterparkApp;');
  source=source.replace('const events=new AbortController();','const events=new AbortController();\n(await import(\'node:events\')).setMaxListeners(100,events.signal);');
  source=source.replace('app.start(); void load();','void load();');
  source=source.replace('const npcMounts=',"Object.defineProperty(globalThis,'__waterparkRace',{configurable:true,get:()=>race}); Object.defineProperty(globalThis,'__waterparkControls',{configurable:true,get:()=>({keys:controls.keys,orbit:controls.orbit,mouseLook:controls.mouseLook,view,mode,world,pickups})}); const npcMounts=");
  const copy=new URL('../src/.waterpark-play-test.ts',import.meta.url);writeFileSync(copy,source);
  const emit=(target:EventTarget,type:string,data:any={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,data);target.dispatchEvent(event);return event;};
  const key=(type:string,code:string,target:any=canvas)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{code,repeat:false});windowTarget.dispatchEvent(event);return event;};
  const observedDynamicSpawns=new Set<string>();
  const dynamicPool=():RacingPickup[]=>(g.__waterparkControls?.pickups??[]).filter((box:RacingPickup)=>box.dynamic);
  const step=(count:number,dt=1/60)=>{for(let i=0;i<count;i++){app.fire('update',dt);for(const box of dynamicPool())if(box.mesh.enabled)observedDynamicSpawns.add(`${box.d}:${box.lateral}`);}};
  const assertPickupHidden=(box:RacingPickup)=>{
    assert.equal(box.mesh.enabled,false);
    for(const render of (box.mesh as pc.Entity).findComponents('render') as pc.RenderComponent[]){
      assert.equal(render.entity.enabled,false);
      for(const layerId of render.layers)for(const mesh of render.meshInstances)assert.equal(app.scene.layers.getLayerById(layerId)!.meshInstances.includes(mesh),false,'disabled pickup leaves every native render layer before draw');
    }
  };
  const poolState=()=>dynamicPool().map(box=>({d:box.d,lateral:box.lateral,cool:box.cool,display:box.display,enabled:box.mesh.enabled}));
  const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setTimeout(resolve,1));};
  const snapshot=()=>{const result:number[]=[];for(const entity of app.root.findComponents('render') as pc.RenderComponent[]){result.push(...Array.from(entity.entity.getWorldTransform().data));}return result;};
  let destroyed=0;app.on('destroy',()=>destroyed++);
  try {
    await import(copy.href+'?run='+Date.now());
    assert.equal(app.maxDeltaTime,Infinity,'engine must not silently clamp real frame delta to 0.1s');
    assert.equal(g.__waterparkControls.pickups.length,18);assert.equal(dynamicPool().length,4);dynamicPool().forEach(assertPickupHidden);
    step(1,0);dynamicPool().forEach(assertPickupHidden);
    if(scenario!=='full-race'){
      const state=()=>g.__waterparkControls,continueButton=element('raceLoadingContinue');
      if(scenario==='close-loading'){
        emit(windowTarget,'pagehide',{persisted:false});assert.equal(signal.aborted,true);assert.equal(destroyed,0,'an in-flight parser retains its application');
        release();await settle();assert.equal(destroyed,1,'closing settles and disposes the pending loader exactly once');
        assert.equal(continueButton.disabled,true);assert.deepEqual(errors,[]);return;
      }
      if(scenario==='context-loss-loading'){
        const position=state().world.camera.getPosition().clone();canvas.emit('webglcontextlost');step(30,.2);
        assert.ok(state().world.camera.getPosition().equals(position));release();await settle();
        assert.equal(state().mode,'menu');assert.equal(app.root.findByName('WaterMount_whale'),null,'late completion cannot instantiate on a lost graphics context');
      }else{
        release();await settle();
        if(scenario==='manual-ready'){
          assert.equal(state().mode,'menu');assert.equal(continueButton.disabled,false);assert.equal(continueButton.hidden,false);
          step(120);assert.equal(g.__waterparkRace.countdown,3,'a direct-page visit waits for explicit start');
          continueButton.click();assert.equal(state().mode,'transition');continueButton.emit('click');assert.equal(attempts,1,'duplicate continue does not reload assets');
          step(5);const position=state().world.camera.getPosition().clone();emit(windowTarget,'pagehide',{persisted:true});step(100,.2);
          assert.ok(state().world.camera.getPosition().equals(position));assert.equal(state().mode,'transition');assert.equal(destroyed,0);
          emit(windowTarget,'pageshow',{persisted:true});for(let i=0;i<100&&state().mode==='transition';i++)step(1);
          assert.equal(state().mode,'riding');assert.equal(g.__waterparkRace.countdown,3);
          element('pause').click();step(30);assert.equal(state().mode,'paused');assert.equal(g.__waterparkRace.countdown,3,'explicit pause still works after the camera handoff');
          emit(windowTarget,'pagehide',{persisted:false});assert.equal(destroyed,1);assert.equal(continueButton.disabled,true);assert.deepEqual(errors,[]);return;
        }
        assert.equal(state().mode,'transition');step(5);const position=state().world.camera.getPosition().clone();canvas.emit('webglcontextlost');step(100,.2);
        assert.ok(state().world.camera.getPosition().equals(position));assert.equal(state().mode,'transition');
      }
      assert.match(element('raceLoadingStatus').textContent,/画面已中断/,'context failure stays visible in the loading UI');
      assert.equal(continueButton.disabled,true);assert.equal(element('raceLoadingRetry').disabled,true);assert.equal(element('start').disabled,true);
      continueButton.emit('click');canvas.emit('webglcontextrestored');step(100,.2);
      assert.notEqual(state().mode,'riding','graphics failure cannot auto-launch or falsely resume after restoration');assert.equal(g.__waterparkRace.countdown,3);
      emit(windowTarget,'pagehide',{persisted:false});assert.equal(destroyed,1);assert.deepEqual(errors,[]);return;
    }
    assert.equal(app.root.findByName('WaterMount_whale'),null,'there is no placeholder mount while the actual rider downloads');
    assert.equal(element('raceLoadingPercent').textContent,'12%','the displayed percentage comes from actual received bytes');
    assert.equal(element('raceLoadingContinue').disabled,true);
    const aerialCamera=g.__waterparkControls.world.camera,flightStart=aerialCamera.getPosition().clone();
    assert.ok(flightStart.y>=40,'loading begins high above the actual circuit');
    step(15);assert.ok(aerialCamera.getPosition().distance(flightStart)>3,'loading camera follows the water circuit at visible medium speed');
    const flightHidden=aerialCamera.getPosition().clone();g.document.hidden=true;emit(documentTarget,'visibilitychange');step(30,.5);
    assert.ok(aerialCamera.getPosition().equals(flightHidden),'backgrounding freezes the loading flight');
    g.document.hidden=false;emit(documentTarget,'visibilitychange');
    const refractionCamera=app.root.findByName('Waterpark underwater refraction camera') as pc.Entity;
    assert.ok(refractionCamera?.camera,'the real scene exposes the independent refraction pass');
    assert.equal(refractionCamera.camera!.enabled,true);
    assert.equal(element('perf-refraction').attributes['aria-pressed'],'true');
    const previewPose=snapshot();
    element('perf-refraction').click();assert.equal(refractionCamera.camera!.enabled,false);
    assert.equal(element('perf-refraction').attributes['aria-pressed'],'false');
    assert.deepEqual(snapshot(),previewPose,'A/B selection cannot move the mount or scenery');
    element('perf-refraction').click();assert.equal(refractionCamera.camera!.enabled,true);
    assert.equal(element('perf-body').hidden,true);
    element('perf-toggle').click();assert.equal(element('perf-body').hidden,false);
    assert.equal(element('perf-toggle').attributes['aria-expanded'],'true');
    element('perf-start').click();assert.equal(element('perf-start').disabled,true);
    assert.equal(element('perf-cancel').disabled,false);
    assert.equal(element('perf-refraction').disabled,true);
    element('perf-refraction').emit('click');assert.equal(refractionCamera.camera!.enabled,true,'recording rejects synthetic water setting changes');
    element('perf-cancel').click();assert.equal(element('perf-start').disabled,false);
    assert.equal(element('perf-refraction').disabled,false);
    assert.equal(element('perf-export').disabled,true,'empty captures cannot be exported');
    assert.equal(element('perf-copy').disabled,true,'empty captures cannot be copied');
    assert.match(element('perf-result').textContent,/0 帧间隔/);
    assert.equal(element('start').disabled,true);element('start').click();assert.equal(attempts,1);
    release();await settle();assert.equal(element('start').disabled,true);assert.match(element('load').textContent,/5\/6/);
    assert.equal(element('raceLoadingPercent').textContent,'—','an unknown byte total is never replaced with an invented percentage');
    assert.equal(element('raceLoadingRetry').hidden,false);assert.equal(element('raceLoadingRetry').disabled,false);
    assert.equal(app.root.findByName('WaterMount_glm'),null,'the missing NPC is absent rather than replaced with a fallback');
    element('driver-glm').click();assert.equal(element('start').disabled,true,'failed rider cannot launch fallback');
    assert.equal(app.root.findByName('WaterMount_glm'),null,'selecting the failed driver cannot instantiate a placeholder');
    element('driver-whale').click();g.document.hidden=true;emit(documentTarget,'visibilitychange');failLast=false;
    element('raceLoadingRetry').click();await settle();assert.equal(attempts,2);
    assert.equal(g.__waterparkControls.mode,'transition','all six real models begin camera return before countdown');
    assert.equal(element('raceLoadingPercent').textContent,'100%');assert.match(element('raceLoadingStatus').textContent,/返回起点/);
    assert.equal(element('raceLoadingRetry').hidden,true);assert.equal(element('start').disabled,true);
    assert.equal(app.scene.exposure,1);
    const sunlight=(app.root.findByName('Waterpark afternoon sun') as pc.Entity).light!;
    assert.equal(sunlight.intensity,2);
    for(const id of ['whale','gemini','gpt','claude','grok','glm']){
      const mount=app.root.findByName('WaterMount_'+id) as pc.Entity;
      assert.ok(mount,'all six actual riders are mounted');
      const renders=mount.findComponents('render') as pc.RenderComponent[];
      assert.ok(renders.some(render=>render.meshInstances.some(mesh=>mesh.skinInstance)),'actual skinned rider is included');
      for(const render of renders){
        assert.ok(render.layers.some(id=>(app.scene.layers.getLayerById(id) as any)._lights.includes(sunlight.light)), 'every rider and mount mesh receives the main sun');
        assert.ok(!g.__waterparkControls.world.reflection.layer.meshInstances.some((mesh:pc.MeshInstance)=>render.meshInstances.includes(mesh)), 'rider stays excluded from water reflection');
      }
    }
    const returningCount=g.__waterparkRace.countdown,hiddenReturn=aerialCamera.getPosition().clone();
    key('keydown','KeyW');touch[0].emit('pointerdown',{pointerId:41,pointerType:'touch',button:0});step(30,.5);
    assert.equal(g.__waterparkControls.mode,'transition');assert.equal(g.__waterparkRace.countdown,returningCount);
    assert.ok(aerialCamera.getPosition().equals(hiddenReturn),'loading completion in a background tab cannot finish the camera return');
    g.document.hidden=false;emit(documentTarget,'visibilitychange');step(10);
    assert.equal(g.__waterparkRace.countdown,returningCount,'camera return holds the countdown');
    emit(windowTarget,'blur');const blurReturn=aerialCamera.getPosition().clone();step(30,.5);
    assert.ok(aerialCamera.getPosition().equals(blurReturn),'window blur freezes the camera return');assert.equal(g.__waterparkControls.mode,'transition');
    emit(windowTarget,'focus');
    for(let i=0;i<80&&g.__waterparkControls.mode==='transition';i++)step(1);
    assert.equal(g.__waterparkControls.mode,'riding');assert.equal(g.__waterparkRace.countdown,returningCount);
    assert.ok(aerialCamera.getPosition().y<10,'countdown starts only after reaching the start-line chase camera');
    assert.ok(Object.values(g.__waterparkControls.keys).every(value=>!value),'input pressed while loading cannot leak into the race');
    dynamicPool().forEach(assertPickupHidden);
    for(const box of g.__waterparkControls.pickups){
      const mesh=box.mesh as pc.Entity,glass=mesh.findByName('Translucent pickup glass') as pc.Entity,material=glass.render!.meshInstances[0].material as pc.StandardMaterial;
      assert.equal(material.opacity,.16);assert.equal(material.depthWrite,false);assert.equal(material.cull,pc.CULLFACE_BACK);
      assert.ok(mesh.getLocalScale().equals(pc.Vec3.ONE),'water boxes preserve the coast shell native scale');
      for(const model of Object.values(box.models) as pc.Entity[])assert.ok(model.getLocalScale().equals(pc.Vec3.ONE),'water item models preserve their native coast scale');
    }
    assert.equal(g.document.activeElement,canvas);step(1,.8);assert.equal(g.__waterparkControls.mode,'riding','first model-ready frame must not open the pause panel');assert.equal(element('pausePanel').classList.contains('hidden'),true);const initialCountdown=g.__waterparkRace.countdown;step(2,.8);assert.equal(g.__waterparkControls.mode,'riding','successive warm-up frames stay in countdown');assert.equal(g.__waterparkRace.elapsed,0);assert.ok(g.__waterparkRace.countdown<initialCountdown);step(180);assert.equal(element('timer').textContent,'0:00');
    for(const seconds of [5,10]){
      while(g.__waterparkRace.elapsed<seconds)step(1);
      const before=g.__waterparkRace.elapsed;step(1,1.2);
      assert.equal(g.__waterparkControls.mode,'riding',`foreground stall at ${seconds}s`);
      assert.equal(element('pausePanel').classList.contains('hidden'),true);
      assert.ok(g.__waterparkRace.elapsed>before&&g.__waterparkRace.elapsed-before<=.2500001,'catch-up is bounded');
    }
    // The actual water entry adapts the same controls, not a test reimplementation.
    const controls=g.__waterparkControls;
    step(1,0);assert.equal(controls.view,0);
    key('keydown','KeyZ');key('keyup','KeyZ');step(1,0);
    assert.equal(g.__waterparkControls.view,1,'Z selects the high chase camera');
    assert.ok(Math.abs(controls.world.camera.getPosition().y-7.9)<1e-5);
    key('keydown','KeyC');key('keyup','KeyC');step(1,0);
    assert.equal(g.__waterparkControls.view,0,'C returns to the low chase camera');
    assert.ok(Math.abs(controls.world.camera.getPosition().y-4.6)<1e-5);
    canvas.emit('pointerdown',{pointerId:11,pointerType:'mouse',button:0,clientX:0,clientY:0});
    canvas.emit('pointermove',{pointerId:11,pointerType:'mouse',buttons:1,clientX:90,clientY:20});
    step(10);
    const orbitBeforeRear=controls.orbit.get(),forwardBeforeRear=controls.world.camera.forward.clone();
    assert.ok(orbitBeforeRear.targetYaw>0&&orbitBeforeRear.targetPitch>0,'fallback mouse drag really moves the water camera');
    canvas.emit('pointerdown',{pointerId:12,pointerType:'mouse',button:2,clientX:90,clientY:20});step(1,0);
    assert.equal(controls.keys.RearView,true);assert.ok(controls.world.camera.forward.dot(forwardBeforeRear)<-.8,'RMB points the live camera behind the mount');
    canvas.emit('pointermove',{pointerId:11,pointerType:'mouse',buttons:3,clientX:140,clientY:40});
    assert.deepEqual(controls.orbit.get(),orbitBeforeRear,'rear view cannot overwrite the saved orbit');
    emit(documentTarget,'mouseup',{button:2});step(1,0);assert.equal(controls.keys.RearView,false);
    assert.ok(controls.world.camera.forward.dot(forwardBeforeRear)>.9,'releasing RMB restores the previous look direction');
    canvas.emit('pointerup',{pointerId:11,pointerType:'mouse',button:0});
    key('keydown','KeyQ');key('keyup','KeyQ');step(30);
    assert.ok(Math.abs(controls.orbit.get().yaw)<1e-4&&Math.abs(controls.orbit.get().pitch)<1e-4,'Q recenters the water camera');
    const itemPlayer=g.__waterparkRace.racers[0];itemPlayer.held='shield';step(1,0);
    assert.equal(element('item').disabled,false);
    key('keydown','KeyE');key('keyup','KeyE');step(1,0);
    assert.equal(itemPlayer.held,null);assert.equal(itemPlayer.shield,6);assert.equal(element('item').disabled,true,'E consumes the water inventory through the real entry');
    element('perf-start').click();assert.equal(element('perf-result').textContent,'');
    element('perf-start').click(); // A duplicate click on the disabled control is harmless.
    element('perf-toggle').click();assert.equal(element('perf-body').hidden,true);
    key('keydown','KeyW');step(90);assert.ok(Number(element('speed').textContent)>0);
    element('perf-toggle').click();element('perf-cancel').click();
    assert.match(element('perf-result').textContent,/89 帧间隔/,'collapsed recording still captures every active interval');
    assert.equal(element('perf-export').disabled,false);
    assert.equal(element('perf-copy').disabled,false);
    assert.equal(element('perf-cancel').disabled,true);
    element('perf-start').click();assert.equal(element('perf-result').textContent,'');
    assert.equal(element('perf-export').disabled,true,'starting again clears the prior export');
    element('perf-cancel').click();assert.equal(element('perf-export').disabled,true);
    key('keydown','KeyA');key('keydown','ShiftLeft');step(30);
    touch[0].emit('pointerdown',{pointerId:19,pointerType:'touch',button:0});
    const pausePlayer=g.__waterparkRace.racers[0];pausePlayer.motion.charge=1;pausePlayer.motion.drifting=true;pausePlayer.motion.slideBoost=0;
    key('keydown','Escape');
    assert.ok(Object.values(controls.keys).every(value=>!value),'pause clears keyboard and touch sources');
    assert.equal(touch[0].hasPointerCapture(19),false,'pause releases held touch capture');
    assert.equal(pausePlayer.motion.charge,0);assert.equal(pausePlayer.motion.drifting,false);
    pausePlayer.held='boost';key('keydown','KeyE');key('keyup','KeyE');assert.equal(pausePlayer.held,'boost','paused E cannot use an item');pausePlayer.held=null;
    const pausedTime=element('timer').textContent,pausedPose=snapshot(),pausedPool=poolState();step(90);
    assert.deepEqual(poolState(),pausedPool,'paused rendering cannot schedule, expire or resurrect a dynamic pickup');
    assert.equal(element('timer').textContent,pausedTime);assert.deepEqual(snapshot(),pausedPose,'mount and world poses freeze while paused');
    assert.equal(element('pause').attributes['aria-label'],'继续');
    assert.equal(key('keydown','ArrowLeft',element('start')).defaultPrevented,false,'menu arrows are not captured');
    element('resumeRace').click();assert.equal(g.document.activeElement,canvas);
    const resumeSpeed=pausePlayer.motion.speed;step(1,.8);assert.equal(g.__waterparkControls.mode,'riding');assert.equal(pausePlayer.motion.speed,resumeSpeed);step(1);
    assert.ok(pausePlayer.motion.speed<resumeSpeed,'resume cannot revive a stale throttle hold');
    assert.equal(pausePlayer.motion.slideBoost,0,'resume cannot release a paused slide charge');
    element('restartRace').click();step(1,.8);assert.equal(g.__waterparkControls.mode,'riding','restart cannot immediately pause');assert.equal(element('pausePanel').classList.contains('hidden'),true);assert.equal(element('speed').textContent,'0');assert.equal(element('timer').textContent,'0:00');
    dynamicPool().forEach(assertPickupHidden);step(1,0);dynamicPool().forEach(assertPickupHidden);
    // Exercise collection in the actual fixed-step race before the entrypoint draws.
    let dynamicBox:RacingPickup|undefined;
    for(let frame=0;frame<60*45&&!dynamicBox;frame++){step(1);dynamicBox=dynamicPool().find(box=>box.mesh.enabled);}
    assert.ok(dynamicBox,'real water entry updates activate a random box on the authored circuit');
    assert.ok(observedDynamicSpawns.size>0);
    const poolPlayer=g.__waterparkRace.racers[0];
    for(const [index,racer] of g.__waterparkRace.racers.entries())if(index){racer.total=dynamicBox.d+150+index*30;racer.motion.distance=racer.total;}
    Object.assign(poolPlayer,{total:dynamicBox.d,lateral:dynamicBox.lateral,speed:0,held:null});
    Object.assign(poolPlayer.motion,{distance:dynamicBox.d,lane:dynamicBox.lateral,speed:0,lateralSpeed:0});
    setPickupDisplay(dynamicBox,'shield');advanceWaterRace(g.__waterparkRace,{throttle:false,brake:false,steer:0},1/120,g.__waterparkControls.pickups);
    assert.equal(poolPlayer.held,'shield');assertPickupHidden(dynamicBox);
    step(1,0);assertPickupHidden(dynamicBox);assert.equal(poolPlayer.held,'shield','draw cannot resurrect a claimed temporary box');
    element('restartRace').click();dynamicPool().forEach(assertPickupHidden);step(1,0);dynamicPool().forEach(assertPickupHidden);
    const accelerate=touch[0];accelerate.emit('pointerdown',{pointerId:1,pointerType:'touch',button:0});
    key('keydown','KeyW');key('keyup','KeyW');step(240);assert.ok(Number(element('speed').textContent)>20,'pointer hold survives keyboard release');
    accelerate.emit('pointercancel',{pointerId:1});emit(windowTarget,'blur');
    const blurTime=element('timer').textContent;step(10);assert.equal(element('timer').textContent,blurTime);
    element('resumeRace').click();element('restartRace').click();key('keydown','KeyW');
    // Complete the real medium-complexity route through its keyboard adapter.
    // A straight-throttle replay can now ride a bank indefinitely; don't skip
    // checkpoints or teleport to the finish just to exercise the results UI.
    for(let frame=0;frame<800&&!g.__waterparkRace.finished;frame++){
      const player=g.__waterparkRace.racers[0],correction=player.lateral*.6+player.motion.lateralSpeed*.4;
      key('keyup','KeyA');key('keyup','KeyD');
      if(correction>.25)key('keydown','KeyD');else if(correction<-.25)key('keydown','KeyA');
      step(1,.2);
    }
    key('keyup','KeyW');key('keyup','KeyA');key('keyup','KeyD');
    assert.equal(g.__waterparkRace.finished,true,'the actual entry completes all three laps under keyboard control');
    dynamicPool().forEach(assertPickupHidden);step(2,0);dynamicPool().forEach(assertPickupHidden);
    assert.equal(g.__waterparkRace.racers[0].checkpoint,24,'all sequential checkpoints were earned');
    assert.match(element('message').textContent,/三圈/);assert.equal(element('speed').textContent,'0');
    failLast=false;element('retry').click();await settle();assert.equal(attempts,3);assert.match(element('load').textContent,/六位/);
    element('driver-glm').click();assert.equal(element('start').disabled,false);
    element('start').click();step(1,.8);assert.equal(g.__waterparkControls.mode,'riding','replay starts without a stale-frame pause');g.document.hidden=true;emit(documentTarget,'visibilitychange');assert.equal(g.__waterparkControls.mode,'paused','backgrounding still pauses during countdown');g.document.hidden=false;emit(documentTarget,'visibilitychange');assert.equal(g.__waterparkControls.mode,'paused');element('resumeRace').click();key('keydown','KeyW');step(30);
    emit(windowTarget,'pagehide',{persisted:true});assert.equal(destroyed,0);const cachedTime=element('timer').textContent;step(30);assert.equal(element('timer').textContent,cachedTime);
    element('resumeRace').click();step(260);assert.notEqual(element('timer').textContent,cachedTime);
    const preStallTime=g.__waterparkRace.elapsed;step(1,1.2);assert.equal(g.__waterparkControls.mode,'riding','later foreground stall cannot pause');assert.ok(Math.abs(g.__waterparkRace.elapsed-preStallTime-.25)<1e-7);g.document.hidden=true;emit(documentTarget,'visibilitychange');const hiddenTime=g.__waterparkRace.elapsed;step(1,20);assert.equal(g.__waterparkControls.mode,'paused');assert.equal(g.__waterparkRace.elapsed,hiddenTime);g.document.hidden=false;emit(documentTarget,'visibilitychange');assert.equal(g.__waterparkControls.mode,'paused','visibility alone never resumes');element('resumeRace').click();step(1,20);assert.equal(g.__waterparkControls.mode,'riding');assert.equal(g.__waterparkRace.elapsed,hiddenTime,'resume rebases hidden wall time');
    element('pause').click();element('restartRace').click();step(1);assert.equal(element('timer').textContent,'0:00');assert.equal(element('speed').textContent,'0');
    const actualPlayer=g.__waterparkRace.racers[0];actualPlayer.speed=actualPlayer.motion.speed=20;actualPlayer.boost=2;actualPlayer.slow=0;step(1,0);assert.equal(Number(element('speed').textContent),Math.round(20*1.34*3.6),'HUD reports actual boosted travel speed');actualPlayer.boost=0;actualPlayer.slow=2;step(1,0);assert.equal(Number(element('speed').textContent),Math.round(20*.55*3.6),'HUD reports actual slowed travel speed');actualPlayer.finishTime=1;step(1,0);assert.equal(element('speed').textContent,'0','finished rider always displays zero');
    const performanceRoot=element('performance'),performanceStart=element('perf-start');
    const exitingPool=dynamicPool();for(const box of exitingPool){box.mesh.enabled=true;box.cool=0;}
    emit(windowTarget,'pagehide',{persisted:false});assert.equal(signal.aborted,true);assert.equal(destroyed,1);
    assert.ok(exitingPool.every(box=>!box.mesh.enabled),'navigation clears dynamic pickup visibility before scene disposal');
    assert.equal(performanceRoot.removed,true,'performance panel is removed during app disposal');
    performanceStart.click();assert.equal(performanceStart.disabled,false,'disposed controls no longer start captures');
    emit(windowTarget,'pagehide',{persisted:false});assert.equal(destroyed,1);
    assert.deepEqual(errors,[]);
  } finally {
    if(!destroyed)app.destroy();unlinkSync(copy);console.error=originalError;
    for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(g,name,descriptor);else delete g[name];}
  }
});
