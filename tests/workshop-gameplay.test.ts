import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('workshop shares native kart runtime: touch route choice, six physical racers, three laps, input pause and restart',t=>runGameScenario({name:'workshop',cancelDuringParts:false,workshop:true},t));

test('workshop lazy course failure retains shared visible retry and workshop map navigation',t=>runGameScenario({name:'workshop-chunk-failure',cancelDuringParts:false,workshop:true,courseFailure:true},t));
