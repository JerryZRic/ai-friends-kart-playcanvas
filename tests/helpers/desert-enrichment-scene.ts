/** Serial baseline/candidate source loading without editing production imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {DesertSceneGeometry} from '../../src/desert-scenery';
import {DESERT_COURSE} from '../../src/maps/desert';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
import {desertSha} from './desert-enrichment-contract';
export async function desertSceneData(baseline:boolean,ledger:string):Promise<{geometry:DesertSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/desert-scenery.ts.txt':'src/desert-scenery.ts','utf8');
 if(baseline)assert.equal(desertSha(source),'ea35a4a1d40ea12ec0b74e1cc2276e78bc722d16ecdae154c2fa1f602f96672c');
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const file=files.write('desert-enrichment-scene',source),module=await import(file.url.href);return{geometry:module.buildDesertSceneGeometry(DESERT_COURSE),theme:module.DESERT_SCENE_THEME};}finally{files.cleanup();}
}
