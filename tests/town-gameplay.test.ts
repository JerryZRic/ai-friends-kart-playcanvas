import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('town shared native runtime drives both routes with independent six-racer cursors, touch input, three-lap validation and restart',t=>runGameScenario({name:'town',cancelDuringParts:false,town:true},t));
