import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('harvest shares native kart runtime: barn support, touch route choice, six physical racers, three laps, pause and restart',t=>runGameScenario({name:'harvest',cancelDuringParts:false,harvest:true},t));

test('harvest lazy course failure retains shared visible retry and harvest navigation',t=>runGameScenario({name:'harvest-chunk-failure',cancelDuringParts:false,harvest:true,courseFailure:true},t));
