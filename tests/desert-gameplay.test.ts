import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('desert shares native kart runtime: paired open arch support, touch route choice, six physical racers, three laps, pause and restart',t=>runGameScenario({name:'desert',cancelDuringParts:false,desert:true},t));
test('desert lazy course failure retains shared visible retry and desert navigation',t=>runGameScenario({name:'desert-chunk-failure',cancelDuringParts:false,desert:true,courseFailure:true},t));
