import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
// Native model-heavy scenarios use separate test workers so a module cache
// cannot retain an entire previous PlayCanvas world while the next loads.
test('native game integration preserves race, camera, items, menu and safety flows',t=>runGameScenario({name:'coast baseline',cancelDuringParts:false},t));
