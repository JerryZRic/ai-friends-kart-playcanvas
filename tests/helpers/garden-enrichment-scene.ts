/** Serial frozen-original/current loading without changing production imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {GardenSceneGeometry} from '../../src/garden-scenery';
import {GARDEN_COURSE} from '../../src/maps/garden';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {GARDEN_ORIGINAL_SOURCE_SHA256,gardenSha} from './garden-enrichment-contract';
export async function gardenSceneData(baseline:boolean,ledger:string):Promise<{geometry:GardenSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/garden-original/src/garden-scenery.ts.txt':'src/garden-scenery.ts','utf8');
 if(baseline)assert.equal(gardenSha(source),GARDEN_ORIGINAL_SOURCE_SHA256);
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('garden-enrichment-scene',source),module=await import(file.url.href);return{geometry:module.buildGardenSceneGeometry(GARDEN_COURSE),theme:module.GARDEN_SCENE_THEME};}finally{files.cleanup();}
}
