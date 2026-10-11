import {randomUUID} from 'node:crypto';
import {unlinkSync,writeFileSync} from 'node:fs';

/** Private source siblings preserve all production relative imports, including
 * lazy imports, while giving every scenario its own entry/observer module URLs.
 * UUIDs do not depend on the gameplay harness's seeded Math.random or the clock.
 */
export function createInstrumentedSourceFiles(directory=new URL('../../src/',import.meta.url)) {
  const runId=`${process.pid}-${randomUUID()}`,owned:URL[]=[];
  return {
    write(name:string,source:string) {
      if(!/^[a-z][a-z0-9-]*$/.test(name))throw new Error(`Invalid instrumented source name: ${name}`);
      const filename=`.${name}-${runId}.ts`,url=new URL(filename,directory);
      // Even an accidental duplicate name must fail rather than overwrite a
      // source file that another import may already be loading.
      writeFileSync(url,source,{flag:'wx'});
      owned.push(url);
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
