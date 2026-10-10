import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('quarry shared native runtime drives both routes with independent six-racer cursors, touch input, three-lap validation, pause and restart',t=>runGameScenario({name:'quarry',cancelDuringParts:false,quarry:true},t));
