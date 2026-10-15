/** Deterministic mechanism probes, not race balance or player-experience evidence. */
import {driveSpeed} from '../src/vehicle-controls.js';
import {stepRaceKartSpeed} from '../src/kart-race';
import {pickupReachability, newBrain, type RacingPickup} from '../src/npc-tactics';
const input={throttle:true,handbrake:true},speed=35,limit=40,dt=.1;
const deceleration=[.6,1,1.4].map(acceleration=>({acceleration,
  legacyNextSpeed:driveSpeed(speed,input,dt*acceleration,limit),
  correctedNextSpeed:stepRaceKartSpeed(speed,input,dt,{maxSpeed:limit,multipliers:{acceleration}},0,0),
}));
const actor={id:'probe',total:0,lateral:0,speed:24,held:null,boost:0,shield:0,slow:0,...newBrain(0,0)};
const box:RacingPickup={d:24,lateral:3,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}};
console.log(JSON.stringify({baseline:'W 4357252f2a356b46426419325e4fb3ff70b2f053',
  scope:'Deterministic local formulas only; no new C21, fairness or fun certification',
  speedProbe:{initialSpeed:speed,limit,dt,input,deceleration},
  pickupProbe:[.4,1,1.5].map(multiplier=>pickupReachability(actor,box,24,multiplier)),
  pickupLimitations:'Existing speed heuristic and allowance unchanged; no prediction of future grip, bank drift, traffic or pickup success',
},null,2));
