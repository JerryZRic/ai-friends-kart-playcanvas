/** Menu posters are immutable historical offline renders, not latest-scene captures.
 * Verify their original inputs, then independently calculate present route/layout
 * compatibility. No image or renderer provenance is rewritten by this proof.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {postV100Review,restorePostV100Buffer} from './post-v100-current';
import {restoreV100Bytes} from './v100-reviewed-revisions';
import {restoreMusicBytes} from './music-reviewed-revisions';
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');

export function historicalPreviewBytes(path:string,expected:unknown):Buffer {
  assert.match(String(expected),/^[a-f0-9]{64}$/,path+' historical SHA-256');
  const current=readFileSync(path);
  let historical=restorePostV100Buffer(path,current);
  // These three archived inputs predate the reviewed post-v1.0 endpoint.
  // Each inverse verifies its exact current input and exact historical output.
  if(sha(historical)!==expected){
    if(path==='src/desert-scenery.ts'||path==='src/snow-scenery.ts')historical=Buffer.from(restoreV100Bytes(path,current.toString('utf8')));
    else if(path==='src/game.ts')historical=Buffer.from(restoreMusicBytes(path,current.toString('utf8')));
  }
  assert.equal(sha(historical),expected,path+' exact archived preview source, never a current-render claim');
  return historical;
}
export function assertHistoricalPreviewInputs(provenancePath:string,p:any){
  const bytes=readFileSync(provenancePath);
  assert.deepEqual(bytes,restorePostV100Buffer(provenancePath,bytes),'Archived preview metadata stays byte-identical');
  for(const [path,digest]of Object.entries({...p.sourceHashes,...p.generatorHashes}))historicalPreviewBytes(path,digest);
}

function historicalRuntime(sourceHashes:Record<string,string>){
  const review=postV100Review(),root=mkdtempSync(join(tmpdir(),'historical-preview-'));
  try{
    // A complete verified baseline graph avoids pairing old scene entry bytes
    // with newly added production dependencies. No copied assets are required.
    for(const path of Object.keys({...review.protectedFiles,...review.changes}).filter(p=>p.startsWith('src/'))){
      const bytes=Object.hasOwn(sourceHashes,path)?historicalPreviewBytes(path,sourceHashes[path]):restorePostV100Buffer(path,readFileSync(path));
      const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
    }
    symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
    symlinkSync(resolve('docs'),join(root,'docs'),'dir');
    writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
    return {root,dispose:()=>rmSync(root,{recursive:true,force:true})};
  }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}
function calculate(root:string,id:string){
  const worker=fileURLToPath(new URL('./preview-layout-worker.ts',import.meta.url));
  const child=spawnSync(process.execPath,['--max-old-space-size=512','--import','tsx',worker,root,id],{encoding:'utf8',timeout:180_000,maxBuffer:4*1024*1024});
  assert.equal(child.error,undefined,id+' layout calculation: '+child.error);
  assert.equal(child.status,0,id+' layout calculation failed: '+child.stderr+'\n'+child.stdout);
  const line=child.stdout.split('\n').find(s=>s.startsWith('PREVIEW_LAYOUT '));
  assert.ok(line,id+' independently calculated layout result');
  return JSON.parse(line!.slice('PREVIEW_LAYOUT '.length));
}
export function assertPreviewLayoutEqual(current:any,historical:any,id:string){
  assert.ok(current.roadPointCount>100&&current.landmarkAnchorCount>0,id+' nonempty actual route and landmark proof');
  assert.deepEqual(current,historical,id+' exact current authored route, emitted road surfaces, landmark anchors and frozen-camera projection');
}
export function assertCurrentPreviewLayout(id:string,p:any){
  const historical=historicalRuntime(p.sourceHashes);
  try{assertPreviewLayoutEqual(calculate(process.cwd(),id),calculate(historical.root,id),id);}
  finally{historical.dispose();}
}
