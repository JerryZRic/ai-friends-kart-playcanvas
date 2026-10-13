/** Original procedural effects: no sampled audio or additional asset licence. */
export const RACE_SOUND_KEY='ai-friends-kart.sound.v1';
export const RACE_VOLUME_KEY='ai-friends-kart.sound-volume.v1';
type SoundStorage=Pick<Storage,'getItem'|'setItem'>;
export interface RaceSoundOptions {storage?:SoundStorage;audioFactory?:()=>AudioContext|null}
export type RaceCue='pickup'|'boost'|'shield'|'pulse'|'hit'|'block'|'collision'|'drift'|'ready'|'full'|'release'|'count'|'go'|'finish'|'lap';
type Note=readonly [number,number,number?,OscillatorType?];
const cues:Record<RaceCue,readonly Note[]>={
 pickup:[[660,.09],[990,.12,.07],[1320,.16,.14]],boost:[[170,.22,0,'triangle'],[460,.18,.09,'triangle']],
 shield:[[440,.2],[660,.25,.06],[880,.25,.12]],pulse:[[1000,.13,0,'sawtooth'],[320,.12,.07,'triangle']],
 hit:[[150,.14,0,'triangle'],[85,.17,.06,'triangle']],block:[[920,.12],[1380,.2,.04]],collision:[[95,.11,0,'triangle']],
 drift:[[440,.12,0,'triangle']],ready:[[580,.12],[870,.13,.07]],full:[[870,.12],[1160,.16,.08]],
 release:[[240,.15,0,'triangle'],[540,.18,.05,'triangle'],[810,.13,.12]],count:[[440,.12]],go:[[660,.12],[990,.22,.08]],
 finish:[[523,.16],[659,.16,.13],[784,.18,.26],[1047,.4,.4]],lap:[[660,.13],[880,.2,.1]]
};
/** Unity below 0.5, smooth bounded knee above: overlapping voices cannot
 * exceed 0.72 full scale. This bus is exclusive to effects, never music. */
export function sfxLimiterCurve(){
 const curve=new Float32Array(4097);
 for(let i=0;i<curve.length;i++){
  const x=i/(curve.length-1)*2-1,a=Math.abs(x);
  curve[i]=Math.sign(x)*(a<=.5?a:.5+.22*Math.tanh((a-.5)/.22));
 }
 return curve;
}
export function createRaceSound(options:RaceSoundOptions={}){
 let storage=options.storage;try{storage??=globalThis.localStorage;}catch{}
 let muted=false,volume=.65,audio:AudioContext|null=null,disposed=false,limiter:WaveShaperNode|null=null;
 try{muted=storage?.getItem(RACE_SOUND_KEY)==='off';const saved=storage?.getItem(RACE_VOLUME_KEY);if(saved!==null&&saved!==undefined&&Number.isFinite(Number(saved)))volume=Math.max(0,Math.min(1,Number(saved)));}catch{}
 const voices=new Set<{oscillator:OscillatorNode;gain:GainNode}>(),last=new Map<string,number>();
 const save=()=>{try{storage?.setItem(RACE_SOUND_KEY,muted?'off':'on');storage?.setItem(RACE_VOLUME_KEY,String(volume));}catch{}};
 function stop(){for(const voice of voices){try{voice.oscillator.stop();voice.oscillator.disconnect();voice.gain.disconnect();}catch{}}voices.clear();}
 function unlock(){if(disposed||muted)return;try{const Browser=globalThis.window;const Audio=Browser?.AudioContext||(Browser as Window & {webkitAudioContext?:typeof AudioContext})?.webkitAudioContext;audio??=options.audioFactory?options.audioFactory():Audio?new Audio():null;if(audio&&!limiter&&audio.createWaveShaper){limiter=audio.createWaveShaper();limiter.curve=sfxLimiterCurve();limiter.oversample='2x';limiter.connect(audio.destination);}void audio?.resume()?.catch(()=>{});}catch{}}
 function note(frequency:number,duration:number,delay=0,type:OscillatorType='sine',level=1){
  if(disposed||muted||volume<=0||!audio||audio.state==='suspended'||voices.size>=10)return;
  try{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+delay,end=start+duration;
   const voice={oscillator,gain};voices.add(voice);oscillator.type=type;oscillator.frequency.value=frequency;
   oscillator.connect(gain);gain.connect(limiter??audio.destination);
   // A brief body after the click-free attack is audible beside a mastered song.
   // Legacy/mock contexts without a limiter keep a safe ten-voice peak budget.
   const peak=(limiter ? .22 : .065)*volume*level,attack=Math.min(.006,duration*.2),hold=Math.min(.045,duration*.4);
   gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(peak,start+attack);
   gain.gain.setValueAtTime(peak,start+hold);gain.gain.exponentialRampToValueAtTime(.0001,end);
   oscillator.onended=()=>{voices.delete(voice);oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(end);
  }catch{}}
 return{get muted(){return muted;},get volume(){return volume;},unlock,stop,
  setVolume(value:number){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));stop();save();},
  setMuted(value:boolean){muted=value;if(muted)stop();else unlock();save();},
  toggle(){if(!disposed){muted=!muted;if(muted)stop();else unlock();save();}return muted;},
  play(cue:RaceCue,distance=0){if(!audio||muted||disposed||!Number.isFinite(distance)||distance>24)return;const now=audio.currentTime,key=cue,interval=cue==='collision'?.5:cue==='drift'?.7:.09;if(now-(last.get(key)??-Infinity)<interval)return;last.set(key,now);const level=distance>0?.32*(1-distance/24):1;for(const [f,d,delay,type] of cues[cue])note(f,d,delay,type,level);},
  tone(frequency=500,duration=.1){unlock();note(Math.max(20,Math.min(20000,frequency)),Math.max(.01,Math.min(2,duration)));},
  dispose(){if(disposed)return;disposed=true;stop();limiter?.disconnect();limiter=null;try{void audio?.close()?.catch(()=>{});}catch{}audio=null;}
 };
}
