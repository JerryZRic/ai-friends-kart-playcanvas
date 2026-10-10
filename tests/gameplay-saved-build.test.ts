import test from 'node:test';
import {runGameScenario} from './helpers/gameplay-scenario';
import {starterBuilds} from '../src/kart-build';
test('saved nondefault kart changes real player geometry and track-context handling',t=>runGameScenario({name:'saved coast build',savedBuild:starterBuilds.find(build=>build.id==='mixed_straight')!.build,cancelDuringParts:false},t));
