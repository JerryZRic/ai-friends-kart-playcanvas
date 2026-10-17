import test from 'node:test';
import assert from 'node:assert/strict';
import {activateItem,tickEffects,slowTime,slowMultiplier,collectPickups,canReceivePickup,type Combatant,type RacingPickup} from '../src/npc-tactics';
const actor=(id='a',extra:Partial<Combatant>={}):Combatant=>({id,total:0,lateral:0,speed:20,held:'boost',heldSecond:null,boost:0,shield:0,slow:0,itemStacking:true,...extra});
const box=(display:RacingPickup['display']):RacingPickup=>({display,d:0,lateral:0,cool:0,mesh:{enabled:true},models:{boost:{enabled:false},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
test('upgraded boost doubles duration only and both slots share experimental release gate',()=>{
 const a=actor('a',{heldUpgraded:true,heldSecond:'pulse'});activateItem(a,[a],1000);assert.equal(a.boost,6.6);assert.equal(a.held,null);assert.equal(activateItem(a,[a],1000,undefined,1),null);assert.equal(a.heldSecond,'pulse');tickEffects(a,1.2);assert.ok(activateItem(a,[a],1000,undefined,1));
});
test('shield refuses consumption while protected; upgraded shield cleans only pulse sources',()=>{
 const a=actor('a',{held:'shield',heldUpgraded:true,slow:.55,pulseSlow:2,upgradedPulseSlow:3,shield:1});assert.equal(activateItem(a,[a],1000),null);assert.equal(a.held,'shield');tickEffects(a,1);a.slow=.55;activateItem(a,[a],1000);assert.equal(a.shield,6);assert.equal(a.slow,.55);assert.equal(a.pulseSlow,0);assert.equal(a.upgradedPulseSlow,0);
});
test('normal hits cannot extend upgraded intensity; nearest shield and no-target fallback unchanged',()=>{
 const a=actor('a',{held:'pulse',heldUpgraded:true}),b=actor('b',{total:10,held:null});activateItem(a,[a,b],1000);assert.equal(b.upgradedPulseSlow,3);assert.equal(slowMultiplier(b),.45);tickEffects(b,1);a.held='pulse';a.heldUpgraded=false;a.itemUseCooldown=0;activateItem(a,[a,b],1000);tickEffects(b,2);assert.equal(b.upgradedPulseSlow,0);assert.equal(b.pulseSlow,1);assert.equal(slowMultiplier(b),.55);assert.equal(slowTime(b),1);
 const c=actor('c',{held:'pulse',heldUpgraded:true}),d=actor('d',{total:10,shield:1}),e=actor('e',{total:20});assert.equal(activateItem(c,[c,d,e],1000)?.blocked,true);assert.equal(e.upgradedPulseSlow,undefined);const f=actor('f',{held:'pulse',heldUpgraded:true});activateItem(f,[f],1000);assert.equal(f.boost,1.9);
});
test('default path preserves original effects and adds no experimental clocks',()=>{
 const a=actor('a',{itemStacking:undefined,held:'pulse'}),b=actor('b',{itemStacking:undefined,total:10});activateItem(a,[a,b],1000);assert.equal(b.slow,3);assert.equal(b.pulseSlow,undefined);assert.equal(a.itemUseCooldown,undefined);tickEffects(b,1);assert.equal(b.slow,2);assert.equal(b.upgradedPulseSlow,undefined);
});
test('full stacks accept only known compatible boxes; mystery refusal does not draw or consume',()=>{
 const a=actor('a',{held:'boost',heldCount:2,heldSecond:'shield'}),m=box('mystery');let rolls=0;
 assert.equal(canReceivePickup(a,m),false);collectPickups([{actor:a,previous:0,previousLane:0}],[m],1000,()=>{rolls++;return 0});assert.equal(rolls,0);assert.equal(m.cool,0);
 const b=box('boost');collectPickups([{actor:a,previous:0,previousLane:0},{actor:actor('z'),previous:0,previousLane:0}],[b],1000);assert.equal(a.heldUpgraded,true);assert.equal(b.cool,8);
});

test('land speed adapters apply stronger pulse without changing default multiplier',async()=>{
 const {stepRaceKartSpeed}=await import('../src/kart-race');
 const tuning={maxSpeed:40,multipliers:{acceleration:1}};
 const normal=stepRaceKartSpeed(40,{throttle:true},1,tuning,0,1),strong=stepRaceKartSpeed(40,{throttle:true},1,tuning,0,1,false,.45);
 assert.ok(strong<normal);assert.equal(normal,stepRaceKartSpeed(40,{throttle:true},1,tuning,0,1,false,.55));
});
test('water experiment gives all six equal capacity and isolated sources; restart clears progress',async()=>{
 const {newWaterRace,useWaterItem,waterTravelSpeed}=await import('../src/water-race');
 const {storeItem}=await import('../src/item-inventory');
 const opts={difficulty:'normal' as const,seed:123,itemStacking:true};
 const race=newWaterRace('xiaosi',opts,2);race.countdown=0;
 assert.equal(race.racers.length,6);for(const r of race.racers){assert.equal(r.itemStacking,true);assert.equal(r.heldSecond,null);}
 const a=race.racers[0];storeItem(a,'boost');storeItem(a,'boost');storeItem(a,'boost');assert.ok(useWaterItem(race,a));assert.equal(a.boost,6.6);
 const b=race.racers[1];b.speed=b.motion.speed=20;b.pulseSlow=2;b.upgradedPulseSlow=1;assert.equal(waterTravelSpeed(b),9);tickEffects(b,1);assert.equal(waterTravelSpeed(b),11);
 const reset=newWaterRace('xiaosi',opts,2);assert.equal(reset.racers[0].held,null);assert.equal(reset.racers[0].heldUpgraded,undefined);
});

test('land HUD preserves slowdown feedback for isolated experimental attack sources',async()=>{
 const {coastHudFeedback}=await import('../src/coast-race-feedback');
 const a=actor('a',{held:null,pulseSlow:2,upgradedPulseSlow:1});
 assert.match(coastHudFeedback(a,[a],1000,0,id=>id).chargeLabel??'',/减速 2.0 秒/);
});

test('actual pickups progress x1 → x2 → super, then consume fourth box without another slot or upgrade',()=>{
 for(const kind of ['boost','shield','pulse'] as const){
  const a=actor('a',{held:null});const racer={actor:a,previous:0,previousLane:0};
  for(let i=1;i<=3;i++){const b=box(kind);collectPickups([racer],[b],1000);assert.equal(b.cool,8);assert.equal(a.heldSecond,null);assert.equal(a.heldCount,i===2?2:1);assert.equal(!!a.heldUpgraded,i===3);}
  const before=structuredClone(a),fourth=box(kind);collectPickups([racer],[fourth],1000);assert.deepEqual(a,before);assert.equal(fourth.cool,8);assert.equal(fourth.mesh.enabled,false);
  collectPickups([racer],[fourth],1000);assert.deepEqual(a,before);
 }
});
test('super same-kind mystery reward consumes one claim/draw without mutation; other kinds still enter R',()=>{
 const a=actor('a',{held:'boost',heldUpgraded:true,heldCount:1});const racer={actor:a,previous:0,previousLane:0};let rolls=0;const m=box('mystery'),before=structuredClone(a);
 collectPickups([racer],[m],1000,()=>{rolls++;return 0;});assert.equal(rolls,1);assert.equal(m.cool,8);assert.deepEqual(a,before);
 collectPickups([racer],[m],1000,()=>{rolls++;return 0;});assert.equal(rolls,1);
 const other=box('mystery');collectPickups([racer],[other],1000,()=>{rolls++;return .4;});assert.equal(a.heldSecond,'shield');assert.equal(rolls,2);
 const full=box('mystery');collectPickups([racer],[full],1000,()=>{rolls++;return 0;});assert.equal(rolls,2);assert.equal(full.cool,0);
});
