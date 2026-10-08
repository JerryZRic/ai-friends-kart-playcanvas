import test from 'node:test';
import assert from 'node:assert/strict';
import { coastLap, crossingTime, coastStandings } from '../src/coast-race-rules';
test('signed coast progress cannot award laps by reversing or oscillating over start',()=>{
 for(const distance of [-2100,-1,0,1,999])assert.equal(coastLap(distance,1000),1);
 assert.equal(coastLap(1000,1000),2);assert.equal(coastLap(999,1000),1);
 assert.equal(coastLap(2000,1000),3);assert.equal(coastLap(3000,1000),3);
 assert.equal(crossingTime(3001,2999,3000,100,1),null);
 assert.equal(crossingTime(-1,1,3000,100,1),null);
 assert.equal(crossingTime(2999,3001,3000,100,1),99.5);
});
test('coast standings preserve exact finishes and label unfinished racers without estimated times',()=>{
 const input=[{id:'whale',total:3000,finishedAt:90.2},{id:'gpt',total:3000,finishedAt:90.1},{id:'glm',total:2999,finishedAt:null},{id:'grok',total:2900,finishedAt:null}];
 assert.deepEqual(coastStandings(input).map(r=>r.id),['gpt','whale','glm','grok']);
 assert.equal(input[0].id,'whale');assert.equal(input[2].finishedAt,null);
});
