import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {setMaxListeners} from 'node:events';
import * as pc from 'playcanvas';
import {parseLocalGLB} from '../src/assets';

/** Real entrypoint, meshes, rig and physics on NullGraphicsDevice. Browser DOM
 * events/image pixels and network scheduling are substituted; no GPU claim. */
test('waterpark entry preserves partial loading, pause/freeze, focus, touch, restart and exit lifecycles', async () => {
  const g=globalThis as any, names=['window','document','innerWidth','innerHeight','devicePixelRatio','__waterparkApp','__waterparkLoad'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(g,name)]));
  const errors:unknown[]=[];const originalError=console.error;console.error=(...args)=>errors.push(args);
  const elements=new Map<string,Element>();
  class Element extends EventTarget {
    id:string; tagName:string; width=1280;height=800;disabled=false;textContent='';value='';style={};dataset:any={};attributes:any={};children:Element[]=[];
    classes=new Set<string>();classList={add:(value:string)=>this.classes.add(value),remove:(value:string)=>this.classes.delete(value),contains:(value:string)=>this.classes.has(value),toggle:(value:string,force?:boolean)=>{const add=force??!this.classes.has(value);if(add)this.classes.add(value);else this.classes.delete(value);return add;}};
    constructor(id:string,tagName='DIV'){super();this.id=id;this.tagName=tagName;}
    setAttribute(name:string,value:string){this.attributes[name]=value;}
    getBoundingClientRect(){return{left:0,top:0,width:this.width,height:this.height};}
    append(element:Element){elements.set(element.id,element);this.children.push(element);}
    setPointerCapture(_id:number){}
    focus(){g.document.activeElement=this;}
    click(){if(!this.disabled)this.emit('click');}
    emit(type:string,data:any={}){const event=new Event(type,{cancelable:true});Object.assign(event,data);this.dispatchEvent(event);return event;}
  }
  const element=(id:string)=>{if(!elements.has(id))elements.set(id,new Element(id,id==='water-game'?'CANVAS':['start','pause','retry'].includes(id)?'BUTTON':'DIV'));return elements.get(id)!;};
  const touch=['KeyW','KeyS','KeyA','KeyD'].map(key=>{const e=element('touch-'+key);e.tagName='BUTTON';e.dataset.key=key;return e;});
  const windowTarget=new EventTarget(),documentTarget=new EventTarget();
  g.window=Object.assign(windowTarget,{devicePixelRatio:1});
  g.document=Object.assign(documentTarget,{hidden:false,activeElement:null,body:new Element('body','BODY'),documentElement:{clientWidth:1280,clientHeight:800},getElementById:element,querySelectorAll:()=>touch,createElement:(tag:string)=>new Element('',tag.toUpperCase())});
  g.innerWidth=1280;g.innerHeight=800;g.devicePixelRatio=1;
  const canvas=element('water-game'),app=new pc.AppBase(canvas as any),options=new pc.AppOptions();
  options.graphicsDevice=new pc.NullGraphicsDevice(canvas as any);
  options.componentSystems=[pc.RenderComponentSystem,pc.AnimComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];
  options.resourceHandlers=[pc.ContainerHandler,pc.RenderHandler,pc.MaterialHandler,pc.TextureHandler];options.devtools=false;app.init(options);
  app.assets.on('add',(asset:pc.Asset)=>{if(asset.type==='container')(asset.options as any).image={processAsync(_image:unknown,done:Function){const texture=new pc.Asset('test-texture','texture');texture.resource=new pc.Texture(options.graphicsDevice,{width:1,height:1});texture.loaded=true;app.assets.add(texture);done(null,texture);}};});
  (app as any).setCanvasFillMode=()=>{};(app as any).setCanvasResolution=()=>{};g.__waterparkApp=app;
  let release!:()=>void,attempts=0,signal!:AbortSignal,failLast=true;
  let gate=new Promise<void>(resolve=>release=resolve);
  const bytes=gunzipSync(readFileSync('public/assets/drivers/whale-driver.glb.gz'));
  const driver=await parseLocalGLB(app,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  g.__waterparkLoad=async(_app:any,options:any)=>{
    attempts++;signal=options.signal;setMaxListeners(100,signal);await gate;
    const assets=new Map(options.existing),failures=new Map();
    for(const id of ['whale','gemini','gpt','claude','grok','glm']){if(id==='glm'&&failLast)failures.set(id,'Injected partial failure');else assets.set(id,driver);}
    options.onStatus({loaded:assets.size,total:6,receivedBytes:100,totalBytes:null});
    return{assets,failures};
  };
  let source=readFileSync('src/waterpark-play.ts','utf8');
  source=source.replace('loadBundledDrivers,type DriverAsset','loadBundledDrivers as unusedLoader,type DriverAsset');
  source=source.replace("const canvas=$<HTMLCanvasElement>('water-game');","const loadBundledDrivers=(globalThis as any).__waterparkLoad;\nconst canvas=$<HTMLCanvasElement>('water-game');");
  source=source.replace(/new pc\.Application\(canvas,.*?\);/,'(globalThis as any).__waterparkApp;');
  source=source.replace('const input=createWaterparkInput(),events=new AbortController();','const input=createWaterparkInput(),events=new AbortController();\n(await import(\'node:events\')).setMaxListeners(100,events.signal);');
  source=source.replace('app.start(); void load();','void load();');
  const copy=new URL('../src/.waterpark-play-test.ts',import.meta.url);writeFileSync(copy,source);
  const emit=(target:EventTarget,type:string,data:any={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,data);target.dispatchEvent(event);return event;};
  const key=(type:string,code:string,target:any=canvas)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{code,repeat:false});windowTarget.dispatchEvent(event);return event;};
  const step=(count:number)=>{for(let i=0;i<count;i++)app.fire('update',1/60);};
  const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setTimeout(resolve,1));};
  const snapshot=()=>{const result:number[]=[];for(const entity of app.root.findComponents('render') as pc.RenderComponent[]){result.push(...Array.from(entity.entity.getWorldTransform().data));}return result;};
  let destroyed=0;app.on('destroy',()=>destroyed++);
  try {
    await import(copy.href+'?run='+Date.now());
    assert.equal(element('start').disabled,true);element('start').click();assert.equal(attempts,1);
    release();await settle();assert.equal(element('start').disabled,false);assert.match(element('load').textContent,/5\/6/);
    element('driver-glm').click();assert.equal(element('start').disabled,true,'failed rider cannot launch fallback');
    element('driver-whale').click();element('start').click();assert.equal(g.document.activeElement,canvas);
    key('keydown','KeyW');step(90);assert.ok(Number(element('speed').textContent)>0);
    key('keydown','KeyA');step(30);key('keydown','Escape');
    const pausedTime=element('time').textContent,pausedPose=snapshot();step(90);
    assert.equal(element('time').textContent,pausedTime);assert.deepEqual(snapshot(),pausedPose,'mount and world poses freeze while paused');
    assert.equal(element('pause').attributes['aria-label'],'继续');
    assert.equal(key('keydown','ArrowLeft',element('start')).defaultPrevented,false,'menu arrows are not captured');
    element('start').click();assert.equal(g.document.activeElement,canvas);
    key('keydown','KeyR');step(1);assert.equal(element('speed').textContent,'0');assert.ok(Number(element('time').textContent)<.1);
    const accelerate=touch[0];accelerate.emit('pointerdown',{pointerId:1,pointerType:'touch',button:0});
    key('keydown','KeyW');key('keyup','KeyW');step(60);assert.ok(Number(element('speed').textContent)>20,'pointer hold survives keyboard release');
    accelerate.emit('pointercancel',{pointerId:1});emit(windowTarget,'blur');
    const blurTime=element('time').textContent;step(10);assert.equal(element('time').textContent,blurTime);
    element('start').click();key('keydown','KeyR');key('keydown','KeyW');step(1800);
    assert.match(element('message').textContent,/285 米/);assert.equal(element('speed').textContent,'0');
    failLast=false;element('retry').click();await settle();assert.equal(attempts,2);assert.match(element('load').textContent,/六位/);
    element('driver-glm').click();assert.equal(element('start').disabled,false);
    element('start').click();key('keydown','KeyW');step(30);
    emit(windowTarget,'pagehide',{persisted:true});assert.equal(destroyed,0);const cachedTime=element('time').textContent;step(30);assert.equal(element('time').textContent,cachedTime);
    element('start').click();step(1);assert.ok(Number(element('time').textContent)>Number(cachedTime));
    emit(windowTarget,'pagehide',{persisted:false});assert.equal(signal.aborted,true);assert.equal(destroyed,1);
    emit(windowTarget,'pagehide',{persisted:false});assert.equal(destroyed,1);
    assert.deepEqual(errors,[]);
  } finally {
    if(!destroyed)app.destroy();unlinkSync(copy);console.error=originalError;
    for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(g,name,descriptor);else delete g[name];}
  }
});
