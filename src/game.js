import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { keyCode, driveInput, driveSpeed, lateralInput, steeringYaw } from './vehicle-controls.js';
import { createOrbit, bindMouseLook } from './mouse-look.js';
import { DRIVERS, DEFAULT_DRIVER_ID, getDriver, raceOrder } from './driver-roster.js';
import { CHASSIS_ASSET, createImportedRacer } from './animated-driver.js';
import { createLocalDriverStore } from './local-driver-import.js';
import { loadBundledDrivers } from './bundled-drivers.js';
import { fetchWithRetry } from './asset-download.js';

const $=id=>document.getElementById(id), canvas=$('game'), map=$('map').getContext('2d');
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#eabbb2',210,650);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('loading').textContent='当前浏览器无法启用 WebGL，请开启硬件加速或换用新版浏览器';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,1500);
scene.add(new THREE.HemisphereLight('#d5eeff','#b5a783',2.2));
const sun=new THREE.DirectionalLight('#ffe1b6',3.1);sun.position.set(-100,180,-130);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-72;sun.shadow.camera.right=72;sun.shadow.camera.top=72;sun.shadow.camera.bottom=-72;sun.shadow.camera.near=1;sun.shadow.camera.far=430;sun.shadow.bias=-.0003;sun.shadow.normalBias=.05;scene.add(sun,sun.target);
const sky=new THREE.Mesh(new THREE.SphereGeometry(1100,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#6176b5')},horizon:{value:new THREE.Color('#f9cdb5')}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPos;uniform vec3 top;uniform vec3 horizon;void main(){float t=smoothstep(-.03,.7,normalize(vPos).y);gl_FragColor=vec4(mix(horizon,top,t),1.);}'}));scene.add(sky);
const sunBall=new THREE.Mesh(new THREE.SphereGeometry(38,32,24),new THREE.MeshBasicMaterial({color:'#ffdda2',fog:false}));sunBall.position.set(-360,115,-650);scene.add(sunBall);
const mat=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.78,...opts});
const oceanMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},fogColor:{value:new THREE.Color('#eabbb2')}},vertexShader:'varying vec3 wp;varying float depth;uniform float time;void main(){vec3 p=position;p.z+=sin(p.x*.038+time*.4)*.18+cos(p.y*.045+time*.3)*.13;vec4 w=modelMatrix*vec4(p,1.);wp=w.xyz;vec4 mv=viewMatrix*w;depth=-mv.z;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec3 wp;varying float depth;uniform float time;uniform vec3 fogColor;void main(){float a=sin(wp.x*.22+wp.z*.34+time*.9);float b=sin(wp.x*.13-wp.z*.17+time*.5);float glint=pow(max(0.,a*b),14.);vec3 col=mix(vec3(.08,.41,.5),vec3(.12,.61,.63),.5+.2*a);col+=vec3(.4,.5,.43)*glint*.45;col=mix(col,fogColor,smoothstep(140.,650.,depth));gl_FragColor=vec4(col,1.);}'});
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(2100,2100,130,130),oceanMat);ocean.rotation.x=-Math.PI/2;ocean.position.y=-1.8;scene.add(ocean);
const landMat=mat('#bbd395'),sandMat=mat('#edcca0'),cliffMat=mat('#bd9686');
function land(x,z,r,sx,sz){let sand=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.97,4,64),sandMat);sand.position.set(x,-2,z);sand.scale.set(sx,1,sz);sand.receiveShadow=true;scene.add(sand);let top=new THREE.Mesh(new THREE.CylinderGeometry(r*.92,r*.98,2,64),landMat);top.position.set(x,-.4,z);top.scale.set(sx,1,sz);top.receiveShadow=true;scene.add(top)}
land(-12,5,135,1.05,1.03);land(70,-50,85,1.02,.85);land(-90,68,65,1,1.1);
const mountainMat=mat('#a2adc0');for(let i=0;i<17;i++){let a=i/17*Math.PI*2;let r=420+Math.sin(i*3)*70;let geo=new THREE.ConeGeometry(32+(i%3)*15,55+(i%5)*15,5);let m=new THREE.Mesh(geo,mountainMat);m.position.set(Math.cos(a)*r,8,Math.sin(a)*r);m.rotation.y=i;m.scale.z=1.4;scene.add(m)}
const points=[[0,2.4,-140],[95,4.5,-125],[160,7,-40],[135,4.5,50],[70,2.6,90],[35,2.4,155],[-70,4,160],[-145,6,100],[-155,3.2,0],[-110,2.4,-85]].map(p=>new THREE.Vector3(...p));
const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');curve.arcLengthDivisions=1800;const LENGTH=curve.getLength(),HALF=7.2,MAX=42;const UP=new THREE.Vector3(0,1,0);let state='loading',ready=false,elapsed=0,countdown=3,pos=0,lane=0,speed=0,charge=0,boost=0,shield=0,hit=0,held=null,drifting=false,steerVis=0,finishRank=0,toastTime=0,view=0,muted=true,audio=null,last=0,clock=0;
let bots=[],boxes=[],sparks=[],kartTemplate=null,player=null;const keys={};const orbit=createOrbit();let mouseLook;let selectedDriverId=DEFAULT_DRIVER_ID,chassisAsset=null;const controllers=new Map();let bundledDrivers=new Map(),bundledFailures=new Map();
// With a +Y-up chase camera, this track normal points LEFT. Keep the
// convention for track/model placement; convert right-positive input below.
function sample(distance,lateral=0){let u=((distance/LENGTH)%1+1)%1;let p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),n=new THREE.Vector3(t.z,0,-t.x).normalize();p.addScaledVector(n,lateral);return {p,t,n,u};}
function ribbon(inner,outer,y,material){const verts=[],indices=[];const count=720;for(let i=0;i<=count;i++){let s=sample(i/count*LENGTH);for(let side of [inner,outer]){let p=s.p.clone().addScaledVector(s.n,side);verts.push(p.x,p.y+y,p.z)}if(i<count){let k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}}let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();let m=new THREE.Mesh(g,material);m.receiveShadow=true;scene.add(m);return m;}
const asphalt=mat('#455461',{roughness:.94,side:THREE.DoubleSide});ribbon(-HALF,HALF,0,asphalt);
function addBatch(geos,material,cast=false){if(!geos.length)return;let mesh=new THREE.Mesh(mergeGeometries(geos),material);mesh.castShadow=cast;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
const curbGeos=[[],[]],dashGeos=[],postGeos=[],supports=[];
for(let i=0;i<720;i++){let a=sample(i/720*LENGTH),b=sample((i+1)/720*LENGTH);for(let side of [-1,1]){let verts=[];for(let [s,w] of [[a,HALF],[a,HALF+.75],[b,HALF],[b,HALF+.75]]){let p=s.p.clone().addScaledVector(s.n,side*w);verts.push(p.x,p.y+.045,p.z)}let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();curbGeos[Math.floor(i/3)%2].push(g)}}
addBatch(curbGeos[0],mat('#e9776a',{side:THREE.DoubleSide}));addBatch(curbGeos[1],mat('#f8ead6',{side:THREE.DoubleSide}));
for(let side of [-1,1]){ribbon(side*(HALF+.75),side*(HALF+.95),-.1,mat('#597485',{side:THREE.DoubleSide}));let railpts=[];for(let i=0;i<=500;i++){let s=sample(i/500*LENGTH,side*(HALF+.95));s.p.y+=.74;railpts.push(s.p)}let rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railpts),500,.075,5,false),mat(side<0?'#d1eced':'#f9ebd8',{metalness:.3}));scene.add(rail)}
for(let i=0;i<240;i++){let s=sample(i/240*LENGTH);if(i%2===0){for(let offset of [-2.4,2.4]){let geo=new THREE.PlaneGeometry(.11,2.1);geo.rotateX(-Math.PI/2);geo.rotateY(Math.atan2(s.t.x,s.t.z));let p=s.p.clone().addScaledVector(s.n,offset);geo.translate(p.x,p.y+.012,p.z);dashGeos.push(geo)}}if(i%2===0)for(let side of [-1,1]){let p=s.p.clone().addScaledVector(s.n,side*(HALF+.95));let g=new THREE.CylinderGeometry(.085,.1,.78,5);g.translate(p.x,p.y+.34,p.z);postGeos.push(g)}if(i%7===0){let g=new THREE.CylinderGeometry(1.2,1.45,s.p.y+2,8);g.translate(s.p.x,(s.p.y-2)/2-.1,s.p.z);supports.push(g)}}
addBatch(dashGeos,mat('#e7e4ca'));addBatch(postGeos,mat('#b5d3d9'),true);addBatch(supports,mat('#93acaa'),true);
// The starting grid is real geometry over the circuit.
let grid=[];for(let row=0;row<2;row++)for(let col=0;col<16;col++){let s=sample(row*.75,col*.9-HALF+.45);let g=new THREE.PlaneGeometry(.9,.75);g.rotateX(-Math.PI/2);g.rotateY(Math.atan2(s.t.x,s.t.z));g.translate(s.p.x,s.p.y+.02,s.p.z);if((row+col)%2===0)grid.push(g)}addBatch(grid,mat('#fffcde'));
const loader=new GLTFLoader();
function simplify(root){root.updateMatrixWorld(true);let groups=new Map();root.traverse(m=>{if(m.isMesh){let material=m.material;if(Array.isArray(material))return;let key=material.name;let geo=m.geometry.clone().applyMatrix4(m.matrixWorld);if(geo.index)geo=geo.toNonIndexed();for(const attr of Object.keys(geo.attributes)){if(attr!=='position'&&attr!=='normal'&&!(attr==='color'&&material.vertexColors))geo.deleteAttribute(attr)}if(!groups.has(key))groups.set(key,{material,geos:[]});groups.get(key).geos.push(geo)}});let g=new THREE.Group();for(let [name,{material,geos}] of groups){let mesh=new THREE.Mesh(mergeGeometries(geos),material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh)}return g;}
function cloneKart(color){let g=kartTemplate.clone(true);g.traverse(m=>{if(m.isMesh){m.material=m.material.clone();if(/body|paint|helmet/i.test(m.material.name)&&!/visor/i.test(m.material.name))m.material.color.set(color);m.castShadow=true;}});scene.add(g);return g;}
function instanceProp(root,transforms,target=scene){root.updateMatrixWorld(true);root.traverse(m=>{if(!m.isMesh)return;let geo=m.geometry.clone().applyMatrix4(m.matrixWorld);let im=new THREE.InstancedMesh(geo,m.material,transforms.length);transforms.forEach((t,i)=>im.setMatrixAt(i,t));im.castShadow=true;im.receiveShadow=true;target.add(im)})}
const tempObj=new THREE.Object3D();function transform(p,scale=1,rot=0){tempObj.position.copy(p);tempObj.rotation.set(0,rot,0);tempObj.scale.setScalar(scale);tempObj.updateMatrix();return tempObj.matrix.clone()}
const itemMat=mat('#aa76e4',{emissive:'#a45edf',emissiveIntensity:.55,metalness:.18,roughness:.25});const itemEdge=new THREE.LineBasicMaterial({color:'#fff6ba'}),itemGeo=new THREE.BoxGeometry(1.25,1.25,1.25);
for(let j=0;j<15;j++)for(let lateral of [-4.2,0,4.2]){let d=45+j*LENGTH/15;let g=new THREE.Group(),box=new THREE.Mesh(itemGeo,itemMat);g.add(box,new THREE.LineSegments(new THREE.EdgesGeometry(itemGeo),itemEdge));let core=new THREE.Mesh(new THREE.OctahedronGeometry(.35),new THREE.MeshBasicMaterial({color:'#ffffe0'}));g.add(core);let p=sample(d,lateral).p;p.y+=1.25;g.position.copy(p);scene.add(g);boxes.push({d,lateral,mesh:g,cool:0,base:p.y})}
const shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(2.4,24,16),new THREE.MeshPhysicalMaterial({color:'#84e8fa',transparent:true,opacity:.18,roughness:.1,metalness:.2,side:THREE.DoubleSide,depthWrite:false}));scene.add(shieldMesh);shieldMesh.visible=false;
const flameMat=new THREE.MeshBasicMaterial({color:'#a6f9ff',transparent:true,opacity:.8,depthWrite:false});let flames=[];for(let side of [-1,1]){let f=new THREE.Mesh(new THREE.ConeGeometry(.22,1.5,7),flameMat);f.rotation.x=-Math.PI/2;scene.add(f);flames.push({mesh:f,side})}
const particles=new THREE.InstancedMesh(new THREE.SphereGeometry(.065,4,3),new THREE.MeshBasicMaterial({color:'#ffc36c'}),160);particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(particles);particles.count=0;
const courseAssets=new Map();
const courseFiles=[
  {id:'kart',label:'原创卡丁车',path:'assets/kart.glb'},
  {id:'palm',label:'海岛棕榈',path:'assets/palm.glb'},
  {id:'rock',label:'海岸岩石',path:'assets/rock.glb'},
  {id:'arch',label:'起点拱门',path:'assets/arch.glb'},
  {id:'chassis',label:'角色底盘',path:CHASSIS_ASSET},
];
let courseBuilt=false,loadingBusy=false,loadingPromise=null,loadingTimer=null,loadingError=null;
let loadingSnapshot={phase:'course',records:[],receivedBytes:0,totalBytes:0,completed:0,total:courseFiles.length,loaded:0,failed:0};
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
async function loadCourseAssets(){
  const records=courseFiles.map(file=>({...file,stage:courseAssets.has(file.id)?'ready':'queued',receivedBytes:courseAssets.get(file.id)?.bytes||0,totalBytes:courseAssets.get(file.id)?.bytes||0,attempt:1,maxAttempts:4,error:null}));
  const report=()=>setLoadingSnapshot({phase:'course',records,receivedBytes:records.reduce((sum,record)=>sum+record.receivedBytes,0),totalBytes:records.every(record=>record.totalBytes>0)?records.reduce((sum,record)=>sum+record.totalBytes,0):0,completed:records.filter(record=>record.stage==='ready'||record.stage==='failed').length,total:records.length,loaded:records.filter(record=>record.stage==='ready').length,failed:records.filter(record=>record.stage==='failed').length});
  report();
  await Promise.all(records.map(async record=>{
    if(courseAssets.has(record.id))return;
    try{
      record.stage='downloading';report();
      const buffer=await fetchWithRetry(record.path,{
        maxAttempts:4,
        onAttempt:({attempt,maxAttempts})=>{Object.assign(record,{stage:'downloading',attempt,maxAttempts,receivedBytes:0,retryInMs:0});report();},
        onProgress:({receivedBytes,totalBytes})=>{Object.assign(record,{stage:'downloading',receivedBytes,totalBytes});report();},
        onRetry:({attempt,maxAttempts,retryInMs})=>{Object.assign(record,{stage:'waiting',attempt,maxAttempts,retryInMs});report();},
      });
      Object.assign(record,{stage:'preparing',receivedBytes:buffer.byteLength,totalBytes:buffer.byteLength});report();
      await new Promise(resolve=>setTimeout(resolve,0));
      const asset=await loader.parseAsync(buffer,'assets/');
      courseAssets.set(record.id,{asset,bytes:buffer.byteLength});record.stage='ready';
    }catch(error){record.stage='failed';record.error=error instanceof Error?error.message:'无法加载资源';}
    report();
  }));
  if(records.some(record=>record.stage==='failed'))throw new Error('Original course assets could not load');
}
function buildCourse(){
  if(courseBuilt)return;
  // Assemble props off-scene, then publish once. Driver retries never rebuild it.
  const group=new THREE.Group();group.name='original-course-props';
  const kart=courseAssets.get('kart').asset,palm=courseAssets.get('palm').asset,rock=courseAssets.get('rock').asset,arch=courseAssets.get('arch').asset;
  const template=simplify(kart.scene);let palms=[],rocks=[];
  for(let i=0;i<94;i++){let d=i/94*LENGTH,side=i%2?1:-1;let s=sample(d,side*(HALF+6+(i%4)*3));s.p.y=.4;palms.push(transform(s.p,.82+(i%4)*.09,i*2.4))}
  instanceProp(simplify(palm.scene),palms,group);
  for(let i=0;i<36;i++){let a=i/36*Math.PI*2;let p=new THREE.Vector3(Math.cos(a)*(100+(i%3)*10)-12,.35,Math.sin(a)*(90+(i%4)*7));rocks.push(transform(p,.6+(i%3)*.23,i))}
  instanceProp(simplify(rock.scene),rocks,group);
  const gantry=arch.scene.clone(true);const s=sample(1);gantry.position.copy(s.p);gantry.rotation.y=Math.atan2(s.t.x,s.t.z);gantry.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});group.add(gantry);addSigns(group);
  kartTemplate=template;chassisAsset=courseAssets.get('chassis').asset;scene.add(group);courseBuilt=true;
}
function boot(){
  if(loadingPromise)return loadingPromise;
  if(localDrivers.busy||!['loading','menu','finished'].includes(state)||(ready&&!bundledFailures.size&&!loadingError))return Promise.resolve(false);
  loadingBusy=true;ready=false;loadingError=null;$('loadingDetailGroup').open=true;const returnState=state==='finished'?'finished':'menu';state='loading';
  $('startText').textContent=courseBuilt?'正在重试角色':'正在准备赛道';updateDriverUI();
  loadingTimer=setInterval(()=>renderLoadingUI(),250);
  loadingPromise=(async()=>{
    try{
      if(!courseBuilt){await loadCourseAssets();buildCourse();setupRacers();}
      const loaded=await loadBundledDrivers({existingDrivers:bundledDrivers,onStatus:status=>setLoadingSnapshot({phase:'drivers',...status}),onProgress:()=>updateDriverUI()});
      bundledDrivers=loaded.drivers;bundledFailures=loaded.failures;
      setupRacers();ready=true;state=returnState;
      $('startText').textContent=bundledFailures.size?'开始比赛（含原创替身）':returnState==='finished'?'再来一场':'开始比赛';
      window.neonKart={getState:()=>({state,pos,lane,speed,elapsed,charge,boost,held,lap:Math.max(1,Math.min(3,Math.floor(pos/LENGTH)+1)),length:LENGTH,rank:finishRank||rank(),camera:view,mouseLook:{...orbit.get(),...mouseLook.get()},modelsLoaded:ready,allDriversLoaded:bundledDrivers.size===6,bundledLoaded:[...bundledDrivers.keys()],bundledFailures:[...bundledFailures.keys()],loading:{...loadingSnapshot,records:loadingSnapshot.records.map(record=>({...record})),busy:loadingBusy,courseBuilt,error:loadingError},selectedDriverId,importedSlots:DRIVERS.filter(d=>localDrivers.has(d.id)).map(d=>d.id),importing:localDrivers.busy,driverStates:DRIVERS.map(d=>({id:d.id,appearance:localDrivers.has(d.id)?'local-import':bundledDrivers.has(d.id)?'bundled-model':'original-fallback',...(controllers.get(d.id)?.getState()||{})})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),start:reset,pause,useItem,selectDriver,importDrivers,retryLoading:boot,clearDriver:()=>localDrivers.clear(selectedDriverId)};
      return true;
    }catch(error){
      console.error(error);loadingError=error instanceof Error?error.message:'未知准备错误';$('startText').textContent='资源加载未完成';
      if(courseBuilt)for(const slot of DRIVERS)if(!bundledDrivers.has(slot.id))bundledFailures.set(slot.id,error instanceof Error?error.message:'无法加载角色');
      return false;
    }finally{
      loadingBusy=false;loadingPromise=null;clearInterval(loadingTimer);loadingTimer=null;$('loadingDetailGroup').open=!ready||bundledFailures.size>0;updateDriverUI();renderLoadingUI();
    }
  })();
  return loadingPromise;
}
function makeTextTexture(text,bg='#183b45',fg='#edffd0',size=512){let c=document.createElement('canvas');c.width=size;c.height=128;let x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,size,128);x.fillStyle=fg;x.font='900 56px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,65);let t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function addSigns(target=scene){let s=sample(1);let banner=new THREE.Mesh(new THREE.PlaneGeometry(13,2.1),new THREE.MeshBasicMaterial({map:makeTextTexture('NEON KART'),side:THREE.DoubleSide}));banner.position.copy(s.p);banner.position.y+=7.1;banner.rotation.y=Math.atan2(s.t.x,s.t.z)+Math.PI;target.add(banner);for(let d of [145,320,550,740]){let s=sample(d,-HALF-2.5);let board=new THREE.Mesh(new THREE.BoxGeometry(6.2,1.6,.2),[mat('#ecb081'),mat('#ecb081'),mat('#ecb081'),mat('#ecb081'),new THREE.MeshBasicMaterial({map:makeTextTexture('› › ›', '#ed806d','#fff8de')}),new THREE.MeshBasicMaterial({map:makeTextTexture('› › ›', '#ed806d','#fff8de')})]);board.position.copy(s.p);board.position.y+=2;board.rotation.y=Math.atan2(s.t.x,s.t.z)+Math.PI;target.add(board)}}
function tone(freq=500,d=.1){if(muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.start();o.stop(audio.currentTime+d)}catch{}}
function toast(s){$('toast').textContent=s;toastTime=2.1;$('toast').style.opacity=1}
function rank(){return 1+bots.filter(b=>b.total>pos).length}
function releaseRacers(){
  for(const actor of [player,...bots.map(b=>b.mesh)].filter(Boolean)){
    const controller=controllers.get(actor.userData.driverId);
    if(controller)controller.dispose();
    else {actor.traverse(mesh=>{if(mesh.isMesh)for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))material.dispose()});actor.removeFromParent();}
  }
  controllers.clear();player=null;bots=[];
}
function racerFor(slot){
  const asset=localDrivers.get(slot.id)||bundledDrivers.get(slot.id);
  if(asset&&chassisAsset){const controller=createImportedRacer(asset,chassisAsset,slot);controllers.set(slot.id,controller);scene.add(controller.root);return controller.root;}
  const mesh=cloneKart(slot.color);mesh.userData.driverId=slot.id;return mesh;
}
function setupRacers(){releaseRacers();const order=raceOrder(selectedDriverId);player=racerFor(order[0]);bots=order.slice(1).map((slot,i)=>({id:slot.id,phase:i,color:slot.color,total:12+Math.floor(i/2)*5.2,lateral:(i%2?1:-1)*3.2,speed:MAX*(.84+i*.018),slow:0,mesh:racerFor(slot)}));placeKart(player,pos,lane,0);bots.forEach(b=>placeKart(b.mesh,b.total,b.lateral,0));}
function reset(){if(!ready||loadingBusy||localDrivers.busy)return;mouseLook.release();orbit.recenter(true);elapsed=0;countdown=3.1;pos=0;lane=-2;speed=charge=boost=shield=hit=0;held=null;drifting=false;steerVis=0;finishRank=0;sparks=[];for(let k in keys)keys[k]=false;boxes.forEach(b=>b.cool=0);setupRacers();state='countdown';document.body.classList.remove('menu');$('overlay').classList.add('hidden');$('count').classList.remove('paused');$('count').textContent='3';$('pause').textContent='Ⅱ';updateDriverUI();canvas.focus?.({preventScroll:true});updateLookHint();updateHUD();snapCamera=true;tone(500)}
const canImport=()=>ready&&!loadingBusy&&(state==='menu'||state==='finished');
const localDrivers=createLocalDriverStore({canImport,onBusy:()=>{updateDriverUI();renderLoadingUI();},onChange:()=>{if(ready){setupRacers();updateDriverUI();}}});
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
  const chosen=Array.from(files||[]);if(!chosen.length)return [];
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
$('driverFiles').addEventListener('change',event=>{const files=Array.from(event.target.files||[]),slotId=selectedDriverId;event.target.value='';void importDrivers(files,slotId);});
$('clearDriver').onclick=()=>{if(localDrivers.clear(selectedDriverId)){importStatusVersion++;$('importStatus').textContent=bundledDrivers.has(selectedDriverId)?'该槽位已恢复默认角色':'该槽位恢复原创替身（默认模型加载失败）';}};
$('start').onclick=reset;
$('retryLoading').onclick=()=>{void boot();};
function pause(){if(state==='running'||state==='countdown'){state='paused';clearInputs();mouseLook.release();$('count').textContent='已暂停';$('count').classList.add('paused');$('pause').textContent='▶';updateLookHint();}else if(state==='paused'){state=countdown>0?'countdown':'running';$('count').textContent='';$('count').classList.remove('paused');$('pause').textContent='Ⅱ';updateLookHint()}}$('pause').onclick=pause;
$('camera').onclick=()=>{view=(view+1)%2;orbit.recenter(true);toast(view?'高位追逐视角':'低位追逐视角');snapCamera=true};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'♪':'♫';$('sound').setAttribute('aria-label',muted?'开启音效':'关闭音效');tone()};
function useItem(){if(state!=='running'||!held)return;let item=held;held=null;if(item==='boost'){boost=3.3;toast('涡轮加速！');tone(900,.3)}else if(item==='shield'){shield=6;toast('能量护盾 · 6 秒');tone(650,.3)}else{let target=bots.filter(b=>b.total>pos&&b.total-pos<120).sort((a,b)=>a.total-b.total)[0];if(target){target.slow=3;toast('脉冲命中前车！');for(let i=0;i<18;i++)emit(target.mesh.position,'pulse');tone(160,.3)}else{boost=1.9;toast('前方无目标 · 转化为加速');tone(850)}}updateHUD()}
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
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(state==='running'||state==='countdown')keys[b.dataset.key]=true});for(let ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys[b.dataset.key]=false)});
let lookStatus='free';
function updateLookHint(){
  $('lookHint').textContent=state==='paused'?'已暂停 · 单击赛道继续并环顾 · P 继续':lookStatus==='locked'?'移动鼠标环顾 · Q 回正 · 右键回看 · Esc 暂停并释放鼠标':lookStatus==='drag'?'按住鼠标左键拖动环顾 · Q 回正 · Esc 暂停':'单击赛道，移动鼠标环顾 · Q 回正 · Esc 暂停';
}
mouseLook=bindMouseLook(canvas,document,{orbit,isActive:()=>state==='running'||state==='countdown',activate:()=>{if(state==='paused')pause()},onRelease:release,onStatus:status=>{lookStatus=status;updateLookHint()},canMove:()=>!keys.RearView});
function updateHUD(){$('rank').innerHTML=(finishRank||rank())+' <small>/ 6</small>';$('lap').innerHTML=Math.max(1,Math.min(3,Math.floor(pos/LENGTH)+1))+' <small>/ 3</small>';$('timer').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');$('speed').textContent=(speed<-.1?'R ':'')+Math.round(Math.abs(speed)*3.6);$('charge').style.width=Math.min(100,charge/1.4*100)+'%';$('chargeLabel').textContent=boost>0?'涡轮加速中！':shield>0?'能量护盾保护中':charge>=.6?'松开 Shift，释放漂移加速':Math.abs(speed)<.1?'按住 W 油门起步':'左 Shift + A / D 手刹漂移';$('itemName').textContent=held?({boost:'ϟ 涡轮加速',shield:'◉ 能量护盾',pulse:'✦ 追踪脉冲'})[held]:'◇ 等待道具';$('itemHelp').textContent=held?'点击这里或按 E 使用':'驶过彩色能量方块'}
function finish(){finishRank=rank();state='finished';clearInputs();mouseLook.release();document.body.classList.add('menu');$('overlay').classList.remove('hidden');$('title').innerHTML=finishRank===1?'GOLDEN<br><em>FINISH.</em>':'ONE MORE<br><em>RIDE?</em>';$('subtitle').textContent=finishRank===1?'冠军冲线，漂亮的超越':'追逐日落，再快一点点';$('desc').textContent='日落海岸 · 三圈大奖赛';$('results').classList.remove('hidden');$('results').textContent='第 '+finishRank+' / 6 名 · '+elapsed.toFixed(2)+' 秒';$('startText').textContent='再来一场';updateDriverUI();tone(1000,.4)}
function emit(p,type='spark'){if(sparks.length>=160)return;sparks.push({p:p.clone(),v:new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*2,(Math.random()-.5)*4),t:type==='pulse'?.8:.45,max:.65})}
function update(dt){if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0}if(state==='countdown'){let old=Math.ceil(countdown);countdown-=dt;let cur=Math.ceil(countdown);$('count').textContent=cur>0?cur:'GO!';if(cur!==old)tone(cur>0?500:1000,.15);if(countdown<=0){state='running';$('count').textContent='';toast('按住 W 起步 · 空格刹车 · Shift 手刹漂移')}return}if(state!=='running')return;
elapsed+=dt;boost=Math.max(0,boost-dt);shield=Math.max(0,shield-dt);hit=Math.max(0,hit-dt);const input=driveInput(keys),steer=input.steer;let now=sample(pos),next=sample(pos+7);let curvature=now.t.x*next.t.z-now.t.z*next.t.x;
let wantDrift=input.handbrake&&!!steer&&!input.brake&&!input.reverse&&speed>MAX*.4;if(wantDrift){charge=Math.min(1.6,charge+dt);if(Math.random()<.8){let p=now.p.clone().addScaledVector(now.n,lane+steer*.85);p.y+=.35;emit(p)}}else if(drifting){if(charge>.6&&!input.brake&&!input.reverse){boost=Math.max(boost,Math.min(2.5,charge*1.5));toast('漂移加速！');tone(850,.2)}charge=0}drifting=wantDrift;
let limit=boost>0?MAX*1.34:MAX;if(Math.abs(lane)>6.3)limit*=.58;if(hit>0)limit*=.55;speed=driveSpeed(speed,input,dt,limit);lane+=lateralInput(steer,speed,MAX,drifting,dt)+curvature*speed*dt*.43;lane=THREE.MathUtils.clamp(lane,-6.75,6.75);steerVis=THREE.MathUtils.damp(steerVis,steeringYaw(steer,speed,drifting),8,dt);
let previous=pos;pos+=speed*dt;if(pos>previous&&previous>=0&&Math.floor(previous/LENGTH)<Math.floor(pos/LENGTH)&&pos<LENGTH*3){toast('第 '+(Math.floor(pos/LENGTH)+1)+' 圈！');tone(750,.2)}
for(let b of bots){b.slow=Math.max(0,b.slow-dt);b.total+=b.speed*(b.slow>0?.42:1)*dt;b.lateral=THREE.MathUtils.damp(b.lateral,Math.sin(b.total/51+b.phase)*4.5,1.6,dt);if(Math.abs(b.total-pos)<2.9&&Math.abs(b.lateral-lane)<1.85&&hit<=0&&shield<=0){hit=.55;speed*=.77;lane+=lane>b.lateral?.55:-.55;tone(110,.1)}}
for(let b of boxes){b.cool=Math.max(0,b.cool-dt);let dist=((b.d-pos)%LENGTH+LENGTH)%LENGTH;if((dist<1.8||dist>LENGTH-1.8)&&b.cool===0&&Math.abs(b.lateral-lane)<1.25&&!held){held=['boost','shield','pulse'][Math.floor(Math.random()*3)];b.cool=8;tone(1200,.12);toast('获得道具 · E 使用')}}
if(pos>=LENGTH*3)finish();updateHUD()}
function placeKart(mesh,d,lateral,angle=0){let s=sample(d,lateral);mesh.position.copy(s.p);mesh.position.y+=.11;mesh.rotation.set(0,Math.atan2(s.t.x,s.t.z)+angle,0);mesh.rotateX(-Math.asin(s.t.y));return s;}
let snapCamera=true,lastRearView=false;
function draw(dt){const active=state==='running'||state==='countdown';for(const [id,controller] of controllers){const bot=bots.find(b=>b.id===id);controller.update(dt,active?(bot?Math.sin(bot.total/51+bot.phase)*.65:driveInput(keys).steer):0,state==='paused');}let rearView=driveInput(keys).rearView;if(rearView!==lastRearView){snapCamera=true;lastRearView=rearView}oceanMat.uniforms.time.value=clock;for(let b of boxes){b.mesh.visible=b.cool<=0;b.mesh.rotation.set(Math.sin(clock*.8)*.15,clock*.8,.18);b.mesh.position.y=b.base+Math.sin(clock*2+b.d)*.17}if(player){const s=placeKart(player,pos,lane,steerVis);bots.forEach(b=>placeKart(b.mesh,b.total,b.lateral,Math.sin(b.total/65)*.06));let menu=state==='menu'||state==='finished';let camPos,look;if(menu){let t=clock*.12;let distance=state==='finished'?pos:0;let focus=sample(distance,0);camPos=focus.p.clone().addScaledVector(focus.t,10+Math.sin(t)*2).addScaledVector(focus.n,15+Math.cos(t)*2);camPos.y+=7.7;look=focus.p.clone().addScaledVector(focus.n,-3.8).addScaledVector(focus.t,8);look.y+=1.2;camera.fov=53;}else{const angles=orbit.step(state==='paused'?0:dt),rear=driveInput(keys).rearView;
const yaw=rear?Math.PI:angles.yaw,pitch=rear?0:angles.pitch;
const behind=view?15:10.5,height=view?7.9:4.6;
// Rotate the chase rig around the kart. The neutral rig preserves the original
// road-ahead framing; full 360-degree yaw never changes vehicle steering.
const forward=s.t.clone().setY(0).normalize().applyAxisAngle(UP,-yaw);
const radius=Math.hypot(behind,height-1),elevation=THREE.MathUtils.clamp(Math.atan2(height-1,behind)+pitch,.08,1.15);
camPos=s.p.clone().addScaledVector(forward,-radius*Math.cos(elevation));camPos.y+=1+radius*Math.sin(elevation);
look=s.p.clone().addScaledVector(forward,(view?12:16)*Math.cos(elevation));look.y+=1-Math.sin(pitch)*8;
camera.fov=THREE.MathUtils.damp(camera.fov,boost>0?65:56,3,dt)}if(snapCamera){camera.position.copy(camPos);snapCamera=false}else camera.position.lerp(camPos,1-Math.exp(-dt*(menu?1.8:8)));camera.lookAt(look);camera.updateProjectionMatrix();sun.target.position.copy(s.p);sun.position.copy(s.p).add(new THREE.Vector3(-85,150,-95));shieldMesh.visible=shield>0;shieldMesh.position.copy(player.position).add(new THREE.Vector3(0,1.2,0));for(let f of flames){f.mesh.visible=boost>0;let p=s.p.clone().addScaledVector(s.t,-2.2).addScaledVector(s.n,f.side*.54);p.y+=.55;f.mesh.position.copy(p);f.mesh.rotation.set(Math.PI/2,0,-Math.atan2(s.t.x,s.t.z));f.mesh.quaternion.setFromUnitVectors(UP,s.t.clone().negate());f.mesh.scale.y=.8+Math.random()*.5}(controllers.get(selectedDriverId)?.chassis||player).traverse(m=>{if(m.isMesh)for(const material of (Array.isArray(m.material)?m.material:[m.material]))if(/body|paint/i.test(material.name))material.emissive?.setHex(hit>0&&Math.floor(clock*12)%2?0x552222:0x000000)})}
for(let p of sparks){p.t-=dt;p.p.addScaledVector(p.v,dt);p.v.y-=5*dt}sparks=sparks.filter(p=>p.t>0);particles.count=sparks.length;sparks.forEach((p,i)=>{tempObj.position.copy(p.p);tempObj.rotation.set(0,0,0);tempObj.scale.setScalar(Math.max(.1,p.t/.5));tempObj.updateMatrix();particles.setMatrixAt(i,tempObj.matrix)});particles.instanceMatrix.needsUpdate=true;drawMap();renderer.render(scene,camera)}
const mapPath=Array.from({length:100},(_,i)=>sample(i/100*LENGTH).p);function drawMap(){map.clearRect(0,0,260,230);const coord=p=>[130+p.x*.6,114+p.z*.6];map.beginPath();mapPath.forEach((p,i)=>{let [x,y]=coord(p);i?map.lineTo(x,y):map.moveTo(x,y)});map.closePath();map.strokeStyle='#163b4bbb';map.lineWidth=12;map.stroke();map.strokeStyle='#eef5e9bb';map.lineWidth=4;map.stroke();for(let b of [...bots.map(b=>({d:b.total,color:b.color})),{d:pos,color:getDriver(selectedDriverId).color,player:true}]){let [x,y]=coord(sample(b.d).p);map.beginPath();map.arc(x,y,b.player?5.5:3.5,0,Math.PI*2);map.fillStyle=b.color;map.fill();map.strokeStyle='#163b4b';map.lineWidth=1.5;map.stroke()}}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();snapCamera=true});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();$('count').textContent='画面已中断，请刷新';$('count').classList.add('paused')});
function frame(t){let dt=Math.min(.045,(t-last)/1000||.016);last=t;clock+=dt;if(ready)update(dt);draw(dt);requestAnimationFrame(frame)}
camera.position.set(30,15,-150);camera.lookAt(0,2,-140);boot();requestAnimationFrame(frame);
