/** Load the held source snapshot without rewriting any shared source import.
 * Every transient module is UUID-owned and recorded for parent cleanup. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {FOREST_COURSE} from '../../src/maps/forest';
import type {ForestSceneGeometry} from '../../src/forest-scenery';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
export const forestSourceSha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export async function forestCameraScene(baseline:boolean,ledger:string):Promise<ForestSceneGeometry>{
 const source=readFileSync(baseline?'docs/scene-baselines/forest-scenery.ts.txt':'src/forest-scenery.ts','utf8');
 if(baseline)assert.equal(forestSourceSha256(source),'f41fdd4886d01f131cb3b4fdfda5ce36444a80545a45ec8ee20a6457082f8802');
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const module=files.write('forest-enrichment-camera-scene',source),loaded=await import(module.url.href);return loaded.buildForestSceneGeometry(FOREST_COURSE);}
 finally{files.cleanup();}
}
