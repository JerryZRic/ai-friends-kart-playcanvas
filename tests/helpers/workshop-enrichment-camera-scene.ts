/** Load the held source snapshot without rewriting any shared source import.
 * Every transient module is UUID-owned and recorded for parent cleanup. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {WORKSHOP_COURSE} from '../../src/maps/workshop';
import type {WorkshopSceneGeometry} from '../../src/workshop-scenery';
import {createInstrumentedSourceFiles} from './instrumented-source-files';
export const workshopSourceSha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export async function workshopSceneData(baseline:boolean,ledger:string):Promise<{geometry:WorkshopSceneGeometry;theme:unknown}>{
 const source=readFileSync(baseline?'docs/scene-baselines/workshop-scenery.ts.txt':'src/workshop-scenery.ts','utf8');
 if(baseline)assert.equal(workshopSourceSha256(source),'a9ffc11ffd00fa0faa5e74bc0c1a3a17b44aa097ebe46f1427f4bfc43d820874');
 const files=createInstrumentedSourceFiles(undefined,ledger);
 try{const module=files.write('workshop-enrichment-camera-scene',source),loaded=await import(module.url.href);return {geometry:loaded.buildWorkshopSceneGeometry(WORKSHOP_COURSE),theme:loaded.WORKSHOP_SCENE_THEME};}
 finally{files.cleanup();}
}

export async function workshopCameraScene(baseline:boolean,ledger:string):Promise<WorkshopSceneGeometry>{return(await workshopSceneData(baseline,ledger)).geometry;}
