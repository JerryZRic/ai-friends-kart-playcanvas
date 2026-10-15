import {collectPickups,moveLane,planLane,pickupReachability,type RacingPickup} from '../src/npc-tactics';
/** Frozen speed/grip, straight local segment, no traffic: isolates lateral
 * reachability from changing physics, routes and stochastic item competition. */
export function contactProbe(speed:number,gap:number,lateral:number,multiplier:number,mode:'legacy'|'execution-matched'|'forced-direct'){
 if(![speed,gap,lateral,multiplier].every(Number.isFinite)||speed<=0||gap<2||gap>48||Math.abs(lateral)>5.2||multiplier<=0)throw new RangeError('Invalid bounded probe');
 const actor={id:'probe',total:0,lateral:0,speed,held:null,boost:0,slow:0,shield:0};
 const box:RacingPickup={d:gap,lateral,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}};
 const estimate=pickupReachability(actor,box,gap,multiplier);
 const target=mode==='forced-direct'?lateral:planLane(actor,[actor],[box],1000,0,0,undefined,undefined,{mode,lateralMultiplier:multiplier});
 while(actor.total<=gap+3){const previous=actor.total,previousLane=actor.lateral;actor.total+=speed/60;actor.lateral=moveLane(actor.lateral,target,multiplier/60);collectPickups([{actor,previous,previousLane}],[box],1000,()=>0);}
 return {attempted:Math.abs(target-lateral)<1e-10,collected:actor.held!==null,estimate};
}
