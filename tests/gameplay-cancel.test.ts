import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
test('leaving during real modular kart loading aborts work without publishing racers',t=>runGameScenario({name:'cancelled coast loading',cancelDuringParts:true},t));
