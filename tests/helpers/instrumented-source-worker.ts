import {createInstrumentedSourceFiles} from './instrumented-source-files';

// Tiny native-process fixture for the same write -> import -> finally-cleanup
// lifecycle as gameplay-scenario. No PlayCanvas world or large asset is loaded.
const directory=new URL(process.argv[2]),owner=process.argv[3];
const files=createInstrumentedSourceFiles(directory);
let entry:ReturnType<typeof files.write>;
process.on('message',async(command:string)=>{
  try {
    if(command==='prepare') {
      const observer=files.write('land-course-mountain-test',`
        import {value} from './production.ts';
        export const owner=${JSON.stringify(owner)};
        export const shared=value;
        export async function lazy() {return (await import('./dynamic-production.ts')).value;}
      `);
      entry=files.write('game-test-mountain',`export {owner,shared,lazy} from '${observer.specifier}';`);
      process.send!({pid:process.pid,urls:[entry.url.href,observer.url.href]});
    } else if(command==='load') {
      const loaded=await import(entry.url.href);
      process.send!({owner:loaded.owner,shared:loaded.shared,lazy:await loaded.lazy()});
    } else if(command==='cleanup') {
      files.cleanup();process.send!({cleaned:true});
    } else throw new Error(`Unexpected worker command: ${command}`);
  } catch(error) {
    process.send!({error:String(error),stack:(error as Error).stack});
  }
});
process.on('disconnect',()=>files.cleanup());
