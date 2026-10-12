/** Serial frozen-original/current loading without changing production imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AirfieldSceneGeometry} from '../../src/airfield-scenery';
import {AIRFIELD_COURSE} from '../../src/maps/airfield';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {AIRFIELD_ORIGINAL_SOURCE_SHA256,airfieldSha} from './airfield-enrichment-contract';
export async function airfieldSceneData(baseline:boolean,ledger:string):Promise<{geometry:AirfieldSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt':'src/airfield-scenery.ts','utf8');
 if(baseline)assert.equal(airfieldSha(source),AIRFIELD_ORIGINAL_SOURCE_SHA256);
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('airfield-enrichment-scene',source),module=await import(file.url.href);return{geometry:module.buildAirfieldSceneGeometry(AIRFIELD_COURSE),theme:module.AIRFIELD_SCENE_THEME};}finally{files.cleanup();}
}
