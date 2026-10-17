import {postV100Hash,postV100Review,restorePostV100Buffer} from './post-v100-current';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {v100Review,v100Sha,restoreV100Bytes} from './v100-reviewed-revisions';

/** Historical control proofs run a COMPLETE pre-feature source graph. Never
 * pair old entry bytes with current collision modules or new pickup constants.
 * Current production geometry is retained when its pre-feature bytes match.
 */
export function createV100HistoricalRuntime(parent=process.env.MOUNTAIN_AUDIT_DIR??process.cwd(),sourceRoot=process.cwd()) {
  const review=v100Review(),root=mkdtempSync(join(resolve(parent),'.v100-historical-'));
  const inventory=Object.keys({...review.protectedFiles,...review.changes}).filter(path=>path.startsWith('src/'));
  const additions=Object.entries(review.additions).filter(([path])=>path.startsWith('src/'));
  const successorAdditions=Object.entries(postV100Review().additions).filter(([path])=>path.startsWith('src/'));
  const walk=(dir:string):string[]=>readdirSync(resolve(sourceRoot,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
  try {
    assert.deepEqual(walk('src').filter(path=>!path.split('/').at(-1)!.startsWith('.')).sort(),[...inventory,...additions.map(([path])=>path),...successorAdditions.map(([path])=>path)].sort(),'complete reviewed source inventory');
    for(const [path,row]of additions)assert.equal(v100Sha(readFileSync(resolve(sourceRoot,path))),postV100Hash(path,row.sha256),path+' verified current addition excluded from historical graph');
    for(const [path,row]of successorAdditions)assert.equal(v100Sha(readFileSync(resolve(sourceRoot,path))),row.currentSha256,path+' verified successor addition excluded from historical graph');
    for(const path of inventory){
      const current=readFileSync(resolve(sourceRoot,path)),change=review.changes[path];
      assert.equal(v100Sha(current),postV100Hash(path,change?.currentSha256??review.protectedFiles[path]),path+' verified candidate source');
      const restored=change?Buffer.from(restoreV100Bytes(path,current.toString('utf8'))):restorePostV100Buffer(path,current);
      assert.equal(v100Sha(restored),change?.previousSha256??review.protectedFiles[path],path+' exact historical dependency');
      const destination=join(root,path);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,restored);
    }
    // Relative JSON documentation and package imports resolve as in the checkout.
    symlinkSync(resolve(sourceRoot,'docs'),join(root,'docs'),'dir');
    symlinkSync(resolve(sourceRoot,'node_modules'),join(root,'node_modules'),'dir');
    writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
    return {directory:pathToFileURL(join(root,'src')+'/'),read:(path:string)=>readFileSync(join(root,path),'utf8'),dispose:()=>rmSync(root,{recursive:true,force:true})};
  }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}

