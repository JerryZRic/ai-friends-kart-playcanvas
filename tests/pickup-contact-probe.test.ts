import test from 'node:test';import assert from 'node:assert/strict';
import {contactProbe} from '../scripts/pickup-contact-probe';
test('probe is deterministic and uses actual swept pickup contact',()=>{
 const args=[30,16,3,.99] as const;
 assert.deepEqual(contactProbe(...args,'legacy'),contactProbe(...args,'legacy'));
 assert.equal(contactProbe(...args,'forced-direct').collected,true);
});
test('probe distinguishes synthetic low-grip misses from policy rejection',()=>{
 const legacy=contactProbe(30,16,2.7,.1,'legacy'),matched=contactProbe(30,16,2.7,.1,'execution-matched');
 assert.equal(legacy.attempted,true);assert.equal(legacy.collected,false);
 assert.equal(matched.attempted,false);assert.equal(matched.collected,false);
});
test('probe exposes conservative threshold false negatives without changing policy',()=>{
 const legacy=contactProbe(30,16,2.84,.99,'legacy'),forced=contactProbe(30,16,2.84,.99,'forced-direct');
 assert.equal(legacy.attempted,false);assert.equal(forced.collected,true);
});
test('probe rejects invalid or unbounded inputs',()=>{
 assert.throws(()=>contactProbe(0,16,3,1,'legacy'),RangeError);assert.throws(()=>contactProbe(30,49,3,1,'legacy'),RangeError);assert.throws(()=>contactProbe(30,16,6,1,'legacy'),RangeError);
});
