import test from 'node:test';
import {runGameScenario,type GameScenario} from './helpers/gameplay-scenario';
const scenarios:GameScenario[]=[
 {name:'mountain lazy course download failure keeps visible retry and map navigation',cancelDuringParts:false,mountain:true,courseFailure:true},
 {name:'mountain shared runtime follows banked height support, controls, AI and lap rules',cancelDuringParts:false,mountain:true},
];
for(const scenario of scenarios)test(scenario.name,t=>runGameScenario(scenario,t));
