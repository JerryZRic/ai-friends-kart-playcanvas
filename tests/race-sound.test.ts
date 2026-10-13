import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceSound,RACE_SOUND_KEY,RACE_VOLUME_KEY,sfxLimiterCurve} from '../src/race-sound';
function setup(){let started=0,stopped=0,closed=0;const values=new Map<string,string>();const audio={state:'running',currentTime:0,destination:{},resume:async()=>{},close:async()=>{closed++;},createOscillator:()=>({frequency:{value:0},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}}),createGain:()=>({connect(){},disconnect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}})};const sound=createRaceSound({storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}},audioFactory:()=>audio as unknown as AudioContext});return{sound,audio,values,stats:()=>({started,stopped,closed})};}
test('effects unlock lazily, persist independently and honour mute/volume',()=>{const t=setup();t.sound.play('pickup');assert.equal(t.stats().started,0);t.sound.unlock();t.sound.play('pickup');assert.equal(t.stats().started,3);t.sound.setVolume(.25);assert.equal(t.values.get(RACE_VOLUME_KEY),'0.25');t.sound.setMuted(true);assert.equal(t.values.get(RACE_SOUND_KEY),'off');t.sound.play('go');assert.equal(t.stats().started,3);t.sound.setMuted(false);t.sound.setVolume(0);t.sound.play('boost');assert.equal(t.stats().started,3);t.sound.dispose();t.sound.dispose();assert.equal(t.stats().closed,1);});
test('collision cooldown, distant NPC culling and global voice budget',()=>{const t=setup();t.sound.unlock();t.sound.play('pickup',25);assert.equal(t.stats().started,0);t.sound.play('collision');t.sound.play('collision');assert.equal(t.stats().started,1);t.audio.currentTime=.6;t.sound.play('collision');assert.equal(t.stats().started,2);for(const cue of ['pickup','shield','pulse','finish','go'] as const)t.sound.play(cue);assert.equal(t.stats().started,10);t.sound.stop();t.audio.currentTime=2;t.sound.play('go');assert.equal(t.stats().started,12);});

test('audible peak has a short body and volume scales once through a bounded effects bus',()=>{
 const ramps:number[]=[],holds:Array<[number,number]>=[];let curve:Float32Array|null=null,oversample='';const destination={};let gainTarget:unknown;
 const limiter={connect(target:unknown){assert.equal(target,destination);},disconnect(){},set curve(value:Float32Array){curve=value;},set oversample(value:string){oversample=value;}};
 const audio={state:'running',currentTime:0,destination,resume:async()=>{},close:async()=>{},createWaveShaper:()=>limiter,
 createOscillator:()=>({frequency:{value:0},connect(){},disconnect(){},start(){},stop(){}}),
 createGain:()=>({connect(target:unknown){gainTarget=target;},disconnect(){},gain:{setValueAtTime(value:number,time:number){holds.push([value,time]);},linearRampToValueAtTime(value:number){ramps.push(value);},exponentialRampToValueAtTime(){}}})};
 const saved=new Map([[RACE_VOLUME_KEY,'0.5']]);
 const sound=createRaceSound({storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>{saved.set(k,v);}},audioFactory:()=>audio as unknown as AudioContext});
 sound.unlock();sound.play('count');assert.equal(sound.volume,.5);assert.equal(ramps[0],.11);assert.equal(gainTarget,limiter);assert.equal(oversample,'2x');assert.ok(curve);
 assert.ok(holds.some(([v,t])=>v===.11&&t>=.04),'hold body rather than immediate decay');sound.dispose();
});
test('effects limiter stays bounded and monotonic while preserving quiet signals',()=>{
 const curve=sfxLimiterCurve();for(let i=0;i<curve.length;i++){assert.ok(Math.abs(curve[i])<=.72);if(i)assert.ok(curve[i]>=curve[i-1]);}
 assert.equal(curve[2048],0);assert.equal(curve[2560],.25);assert.ok(curve[4096]>.7);
});
