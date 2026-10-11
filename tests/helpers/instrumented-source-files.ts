import {randomUUID} from 'node:crypto';
import {readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

/** Private source siblings preserve all production relative imports, including
 * lazy imports, while giving every scenario its own entry/observer module URLs.
 * UUIDs do not depend on the gameplay harness's seeded Math.random or the clock.
 */
export function createInstrumentedSourceFiles(directory=new URL('../../src/',import.meta.url),manifest?:string) {
  const runId=`${process.pid}-${randomUUID()}`,owned:URL[]=[];
  return {
    write(name:string,source:string) {
      if(!/^[a-z][a-z0-9-]*$/.test(name))throw new Error(`Invalid instrumented source name: ${name}`);
      const filename=`.${name}-${runId}.ts`,url=new URL(filename,directory);
      // Even an accidental duplicate name must fail rather than overwrite a
      // source file that another import may already be loading.
      writeFileSync(url,source,{flag:'wx'});
      owned.push(url);
      // The parent may only clean these exact successfully-created siblings if
      // this worker is terminated before its ordinary finally block can run.
      if(manifest){const temporary=manifest+'.tmp';writeFileSync(temporary,JSON.stringify({runId,directory:directory.href,files:owned.map(url=>url.href)}));renameSync(temporary,manifest);}
      return {url,specifier:`./${filename}`};
    },
    cleanup() {
      const errors:unknown[]=[];
      for(const url of owned.splice(0)) {
        try {unlinkSync(url);} catch(error) {errors.push(error);}
      }
      // Attempt every owned cleanup, but never hide missing files or other
      // ownership violations: those can indicate corrupted test inputs.
      if(errors.length)throw new AggregateError(errors,'Instrumented source cleanup failed');
    }
  };
}

/** Called only after the owning child has exited. Never glob or remove siblings
 * belonging to another process; ordinary cleanup may already have removed ours. */
export function cleanupInstrumentedSourceManifest(manifest:string,directory=new URL('../../src/',import.meta.url)) {
 let ledger:any;
 try {ledger=JSON.parse(readFileSync(manifest,'utf8'));} catch(error) {if(error.code==='ENOENT')return;throw error;}
 assert.equal(ledger.directory,directory.href);
 assert.match(ledger.runId,/^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 assert.ok(Array.isArray(ledger.files));
 const urls=ledger.files.map((href:string)=>{const url=new URL(href),name=url.pathname.slice(url.pathname.lastIndexOf('/')+1);assert.equal(new URL('.',url).href,directory.href);assert.ok(name.endsWith('-'+ledger.runId+'.ts'));assert.match(name,/^\.[a-z][a-z0-9-]+\.ts$/);return url;});
 for(const url of urls)try {unlinkSync(url);} catch(error) {if(error.code!=='ENOENT')throw error;}
}
