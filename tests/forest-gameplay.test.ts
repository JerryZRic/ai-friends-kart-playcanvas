import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('forest shares native kart runtime: touch route choice, six physical racers, three laps, input pause and restart',t=>runGameScenario({name:'forest',cancelDuringParts:false,forest:true},t));

test('forest lazy course failure retains shared visible retry and forest map navigation',t=>runGameScenario({name:'forest-chunk-failure',cancelDuringParts:false,forest:true,courseFailure:true},t));
