import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('caldera shares native kart runtime: height-separated two-arch support, touch route choice, six assembled racers, items, three laps, pause and restart',t=>runGameScenario({name:'caldera',cancelDuringParts:false,caldera:true},t));
test('caldera lazy course failure retains shared visible retry and caldera navigation',t=>runGameScenario({name:'caldera-chunk-failure',cancelDuringParts:false,caldera:true,courseFailure:true},t));
