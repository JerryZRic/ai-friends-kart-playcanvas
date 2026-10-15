import {readFileSync,writeFileSync} from 'node:fs';
import {contactProbe} from './pickup-contact-probe';
const output=process.argv[2]??'results';
const study=JSON.parse(readFileSync(output+'/pickup-planning-study.json','utf8')),rows:any[]=[];
// The coarse grid did not straddle the small production steering differences.
// Use exactly +/- 0.05 m around the legacy threshold, not tuned race outcomes.
for(const source of study.micro.filter((r:any)=>r.mode==='legacy'&&r.lateral===2))for(const offset of [-.05,.05]){
 const lateral=source.estimate.legacyBudget+offset;if(lateral>5.2)continue;
 const {map,character,speed,gap,grip,steering}=source,multiplier=steering*grip;
 rows.push({map,character,speed,gap,grip,steering,lateral,offset,
  legacy:contactProbe(speed,gap,lateral,multiplier,'legacy'),
  matched:contactProbe(speed,gap,lateral,multiplier,'execution-matched'),
  forcedDirect:contactProbe(speed,gap,lateral,multiplier,'forced-direct'),
 });
}
const summary={scenarios:rows.length,changed:rows.filter(r=>r.legacy.attempted!==r.matched.attempted).length,
 legacyAttemptMisses:rows.filter(r=>r.legacy.attempted&&!r.legacy.collected).length,
 matchedAttemptMisses:rows.filter(r=>r.matched.attempted&&!r.matched.collected).length,
 legacyRejectedButDirectReachable:rows.filter(r=>!r.legacy.attempted&&r.forcedDirect.collected).length,
 matchedRejectedButDirectReachable:rows.filter(r=>!r.matched.attempted&&r.forcedDirect.collected).length,
};
writeFileSync(output+'/pickup-boundaries.json',JSON.stringify({summary,rows},null,2));console.log(summary);
