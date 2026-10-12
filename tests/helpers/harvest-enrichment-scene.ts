/** A UUID-owned temporary sibling preserves production imports unchanged. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HARVEST_COURSE} from '../../src/maps/harvest';
import type {HarvestSceneGeometry} from '../../src/harvest-scenery';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {harvestFileHash} from './harvest-enrichment-contract';
export async function harvestSceneData(baseline:boolean,ledger:string):Promise<{geometry:HarvestSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/harvest-scenery.ts.txt':'src/harvest-scenery.ts','utf8');
 if(baseline)assert.equal(harvestFileHash(source),'ea93d8ad6dca07bac38efc3934ff397bbde0ea93444982530319d56d79f1458a');
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('harvest-enrichment-scene',source),loaded=await import(file.url.href);return{geometry:loaded.buildHarvestSceneGeometry(HARVEST_COURSE),theme:loaded.HARVEST_SCENE_THEME};}finally{files.cleanup();}
}
