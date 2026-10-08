import * as pc from 'playcanvas';
import { createWaterparkScene } from './waterpark-scene';
import { SAMPLE_LENGTH,SAMPLE_SECONDS } from './waterpark-design';
const canvas=document.querySelector<HTMLCanvasElement>('#sample')!,timeline=document.querySelector<HTMLInputElement>('#timeline')!,play=document.querySelector<HTMLButtonElement>('#play')!;
try{
 const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
 app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio||1,1.7);app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);app.setCanvasResolution(pc.RESOLUTION_AUTO);
 const world=createWaterparkScene(app);let distance=12,time=0,playing=true;
 document.querySelector('#stats')!.textContent=`原创实景网格 · ${world.triangles.toLocaleString()} 三角面 · 无参考视频贴图`;
 play.onclick=()=>{playing=!playing;play.textContent=playing?'暂停':'播放';};timeline.oninput=()=>{distance=Number(timeline.value);world.setCamera(distance);world.reflection.update();};
 document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>{distance=0;time=0;playing=true;play.textContent='暂停';};
 const resize=()=>app.resizeCanvas();window.addEventListener('resize',resize);window.addEventListener('pagehide',(event)=>{if(!event.persisted){window.removeEventListener('resize',resize);app.destroy();}});
 app.on('update',(dt:number)=>{const step=Math.min(dt,.05);if(playing&&!document.hidden){time+=step;distance=(distance+step*SAMPLE_LENGTH/SAMPLE_SECONDS)%SAMPLE_LENGTH;}world.setCamera(distance);world.reflection.update();world.waterMaterial.setParameter('time',time);timeline.value=String(distance);document.querySelector('#progress')!.textContent=`${(distance/SAMPLE_LENGTH*SAMPLE_SECONDS).toFixed(1)} / 18 秒`;});app.start();
}catch(error){document.querySelector('#error')!.textContent='无法启动 WebGL 2。请使用支持硬件加速的浏览器打开此本地样段。';console.error(error);}
