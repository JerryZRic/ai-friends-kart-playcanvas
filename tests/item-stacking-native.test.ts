import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('default-on native race preserves both slots, queued use, shared cooldown and restart',t=>runGameScenario({name:'default-on stacking',cancelDuringParts:false,forest:true,defaultStackingSmoke:true},t));
