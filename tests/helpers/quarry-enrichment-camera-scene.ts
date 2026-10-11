/** Load the held source snapshot without rewriting any shared source import.
 * Every transient module is UUID-owned and recorded for parent cleanup. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {QUARRY_COURSE} from '../../src/maps/quarry';
import type {QuarrySceneGeometry} from '../../src/quarry-scenery';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
export const quarrySourceSha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export async function quarryCameraScene(baseline:boolean,ledger:string):Promise<QuarrySceneGeometry>{
 const source=readFileSync(baseline?'docs/scene-baselines/quarry-scenery.ts.txt':'src/quarry-scenery.ts','utf8');
 if(baseline)assert.equal(quarrySourceSha256(source),'f0f1fdb666f1513c3f496dd733834f3a8df02ab072dc23021cfb176a28e9cb5c');
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const module=files.write('quarry-enrichment-camera-scene',source),loaded=await import(module.url.href);return loaded.buildQuarrySceneGeometry(QUARRY_COURSE);}
 finally{files.cleanup();}
}
