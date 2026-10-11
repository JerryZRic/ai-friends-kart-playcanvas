import test from 'node:test';
import assert from 'node:assert/strict';
import {fork,type ChildProcess} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createInstrumentedSourceFiles} from './helpers/instrumented-source-files';

function fixture(t:any) {
  const root=mkdtempSync(join(tmpdir(),'kart-source-isolation-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const directory=pathToFileURL(root+sep);
  writeFileSync(new URL('package.json',directory),'{"type":"module"}');
  writeFileSync(new URL('production.ts',directory),'export const value: string="production";');
  writeFileSync(new URL('dynamic-production.ts',directory),'export const value: string="lazy production";');
  return {root,directory};
}

test('same-process scenarios have private entry/observer URLs even with a frozen clock and gameplay RNG',async t=>{
  const {root,directory}=fixture(t);
  t.mock.method(Date,'now',()=>1234);t.mock.method(Math,'random',()=>0);
  const first=createInstrumentedSourceFiles(directory),second=createInstrumentedSourceFiles(directory);
  try {
    const prepare=(files:typeof first,owner:string)=>{
      const observer=files.write('land-course-mountain-test',`export const owner=${JSON.stringify(owner)};`);
      const entry=files.write('game-test-mountain',`export {owner} from '${observer.specifier}';`);
      return {observer,entry};
    };
    const a=prepare(first,'first'),b=prepare(second,'second');
    assert.equal(new Set([a.entry.url.href,b.entry.url.href,a.observer.url.href,b.observer.url.href]).size,4);
    const [loadedA,loadedB]=await Promise.all([import(a.entry.url.href),import(b.entry.url.href)]);
    assert.equal(loadedA.owner,'first');assert.equal(loadedB.owner,'second');
    first.cleanup();
    assert.match(readFileSync(b.entry.url,'utf8'),new RegExp(b.observer.specifier.replaceAll('.','\\.')));
    // A fresh entry must resolve the still-owned observer rather than reuse a
    // module from the first scenario's cache after its files have been removed.
    const later=second.write('game-test-course-failure',`export {owner} from '${b.observer.specifier}';`);
    assert.equal((await import(later.url.href)).owner,'second');
  } finally {first.cleanup();second.cleanup();}
  assert.deepEqual(readdirSync(root).sort(),['dynamic-production.ts','package.json','production.ts']);
});

test('parallel test processes cannot overwrite, import or unlink another Mountain scenario', {timeout:15000},async t=>{
  const {root,directory}=fixture(t),children:ChildProcess[]=[];
  t.after(()=>{for(const child of children)child.kill();});
  const start=(owner:string)=>{
    const child=fork(new URL('./helpers/instrumented-source-worker.ts',import.meta.url),[directory.href,owner],{
      execArgv:['--max-old-space-size=448','--import','tsx'],stdio:['ignore','ignore','pipe','ipc']
    });
    children.push(child);return child;
  };
  const request=(child:ChildProcess,command:string)=>new Promise<any>((resolve,reject)=>{
    const timeout=setTimeout(()=>done(new Error(`Worker timed out during ${command}`)),10000);
    const message=(value:any)=>value.error?done(new Error(value.stack??value.error)):done(null,value);
    const error=(reason:Error)=>done(reason),exit=(code:number|null)=>done(new Error(`Worker exited ${code} during ${command}`));
    const done=(reason:Error|null,value?:unknown)=>{
      clearTimeout(timeout);child.off('message',message);child.off('error',error);child.off('exit',exit);
      if(reason)reject(reason);else resolve(value);
    };
    child.once('message',message);child.once('error',error);child.once('exit',exit);
    child.send(command,error=>{if(error)done(error);});
  });
  const a=start('first'),b=start('second');
  // Explicit barriers force the old race deterministically: both writes finish
  // before A imports, then A removes its sources before B first imports them.
  // Fixed filenames either load B's data into A or leave B with deleted input.
  const readyA=await request(a,'prepare'),readyB=await request(b,'prepare');
  assert.notEqual(readyA.pid,readyB.pid);
  assert.equal(new Set([...readyA.urls,...readyB.urls]).size,4);
  for(const href of [...readyA.urls,...readyB.urls])assert.ok(readFileSync(new URL(href),'utf8').length);
  assert.deepEqual(await request(a,'load'),{owner:'first',shared:'production',lazy:'lazy production'});
  assert.deepEqual(await request(a,'cleanup'),{cleaned:true});
  for(const href of readyB.urls)assert.ok(readFileSync(new URL(href),'utf8').length);
  assert.deepEqual(await request(b,'load'),{owner:'second',shared:'production',lazy:'lazy production'});
  assert.deepEqual(await request(b,'cleanup'),{cleaned:true});
  assert.deepEqual(readdirSync(root).sort(),['dynamic-production.ts','package.json','production.ts']);
  assert.equal(readFileSync(new URL('production.ts',directory),'utf8'),'export const value: string="production";');
  assert.equal(readFileSync(new URL('dynamic-production.ts',directory),'utf8'),'export const value: string="lazy production";');
});

test('instrumented writes are exclusive and cleanup reports missing files while cleaning the rest',t=>{
  const {root,directory}=fixture(t),files=createInstrumentedSourceFiles(directory);
  const first=files.write('game-test-mountain','export const owner="first";');
  assert.throws(()=>files.write('game-test-mountain','export const owner="overwrite";'),{code:'EEXIST'});
  assert.equal(readFileSync(first.url,'utf8'),'export const owner="first";');
  files.write('land-course-mountain-test','export const observer=true;');
  unlinkSync(first.url);
  assert.throws(()=>files.cleanup(),(error:AggregateError)=>{
    assert.ok(error instanceof AggregateError);assert.equal(error.errors.length,1);assert.equal(error.errors[0].code,'ENOENT');return true;
  });
  assert.deepEqual(readdirSync(root).sort(),['dynamic-production.ts','package.json','production.ts']);
});
