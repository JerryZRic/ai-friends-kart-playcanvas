/** Serial frozen-original/current loading without changing production imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CalderaSceneGeometry} from '../../src/caldera-scenery';
import {CALDERA_COURSE} from '../../src/maps/caldera';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {CALDERA_ORIGINAL_SOURCE_SHA256,calderaSha} from './caldera-enrichment-contract';
export async function calderaSceneData(baseline:boolean,ledger:string):Promise<{geometry:CalderaSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/caldera-scenery.ts.txt':'src/caldera-scenery.ts','utf8');
 if(baseline)assert.equal(calderaSha(source),CALDERA_ORIGINAL_SOURCE_SHA256);
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('caldera-enrichment-scene',source),module=await import(file.url.href);return{geometry:module.buildCalderaSceneGeometry(CALDERA_COURSE),theme:module.CALDERA_SCENE_THEME};}finally{files.cleanup();}
}
