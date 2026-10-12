/** Serial frozen-original/current loading without changing production imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {SnowSceneGeometry} from '../../src/snow-scenery';
import {SNOW_COURSE} from '../../src/maps/snow';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {SNOW_ORIGINAL_SOURCE_SHA256,snowSha} from './snow-enrichment-contract';
export async function snowSceneData(baseline:boolean,ledger:string):Promise<{geometry:SnowSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/snow-scenery.ts.txt':'src/snow-scenery.ts','utf8');
 if(baseline)assert.equal(snowSha(source),SNOW_ORIGINAL_SOURCE_SHA256);
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('snow-enrichment-scene',source),module=await import(file.url.href);return{geometry:module.buildSnowSceneGeometry(SNOW_COURSE),theme:module.SNOW_SCENE_THEME};}finally{files.cleanup();}
}
