import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('snow shares native kart runtime: highland support, touch route choice, six physical racers and parts, three laps, pause and restart',t=>runGameScenario({name:'snow',cancelDuringParts:false,snow:true},t));
test('snow lazy course failure retains shared visible retry and snow navigation',t=>runGameScenario({name:'snow-chunk-failure',cancelDuringParts:false,snow:true,courseFailure:true},t));
