import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePickup, claimPickup, resetPickup, setPickupDisplay, rollDisplay, randomItem, MYSTERY_CHANCE, PICKUP_RESPAWN_SECONDS, type PickupState } from '../src/item-pickups';
function box(): PickupState {return {display:'boost',cool:0,mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}};}
test('explicit rewards match every displayed model and a box is claimed atomically',()=>{
  for(const kind of ['boost','shield','pulse'] as const){const b=box();setPickupDisplay(b,kind);assert.equal(claimPickup(b,true),null);assert.equal(b.mesh.enabled,true);assert.equal(claimPickup(b,false,()=>{throw Error('explicit reward must not reroll')}),kind);assert.equal(b.cool,8);assert.equal(b.mesh.enabled,false);for(let i=0;i<6;i++)assert.equal(claimPickup(b,false),null);}
});
test('mystery is one-quarter of spawn distribution with uniform actual item outcomes',()=>{
  const counts={boost:0,shield:0,pulse:0,mystery:0};
  for(let i=0;i<120;i++)for(let j=0;j<120;j++){let n=0;const values=[(i+.5)/120,(j+.5)/120];counts[rollDisplay(()=>values[n++])]++;}
  assert.deepEqual(counts,{boost:3600,shield:3600,pulse:3600,mystery:3600});assert.equal(MYSTERY_CHANCE,.25);
  for(const [r,expected] of [[0,'boost'],[.4,'shield'],[.9,'pulse']] as const){const b=box();setPickupDisplay(b,'mystery');assert.equal(claimPickup(b,false,()=>r),expected);}
  assert.equal(randomItem(()=>1),'pulse');
});
test('respawn changes display once, resets visibility, and does not keep rerolling active boxes',()=>{
  const b=box();claimPickup(b,false);advancePickup(b,7,()=>{throw Error('too soon')});assert.equal(b.cool,1);assert.equal(b.mesh.enabled,false);
  advancePickup(b,1,()=>0);assert.equal(b.cool,0);assert.equal(b.display,'mystery');assert.equal(b.models.mystery.enabled,true);assert.equal(b.models.boost.enabled,false);assert.equal(b.mesh.enabled,true);
  advancePickup(b,100,()=>{throw Error('already active')});claimPickup(b,false,()=>.9);assert.equal(b.cool,PICKUP_RESPAWN_SECONDS);
  resetPickup(b,()=>.5);assert.equal(b.display,'shield');assert.equal(b.mesh.enabled,true);assert.equal(b.cool,0);
});
