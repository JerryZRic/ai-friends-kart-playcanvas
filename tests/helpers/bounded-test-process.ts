import {spawn} from 'node:child_process';

/** Run one test process at a time; propagate all failures including timeouts.
 * A separate POSIX process group includes node:test's worker and tsx/esbuild. */
export function boundedTestProcess(command:string,args:string[],options:{cwd?:string;env?:NodeJS.ProcessEnv;timeoutMs:number;killGraceMs?:number;signal?:AbortSignal}):Promise<{output:string;code:number|null;signal:NodeJS.Signals|null;termination:string|null}>{
 return new Promise((resolve,reject)=>{
  const env={...(options.env??process.env)};
  // A real independent node:test subprocess must not inherit its parent's
  // internal child marker, which makes Node silently skip recursive runners.
  delete env.NODE_TEST_CONTEXT;
  const grouped=process.platform!=='win32',child=spawn(command,args,{cwd:options.cwd,env,detached:grouped,stdio:['ignore','pipe','pipe']});
  let output='',termination:string|null=null,killTimer:ReturnType<typeof setTimeout>|undefined;
  const kill=(signal:NodeJS.Signals)=>{try {if(grouped&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch(error){if(error.code!=='ESRCH')output+=`\nProcess termination error: ${String(error)}\n`;}};
  const stop=(reason:string)=>{if(termination)return;termination=reason;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),options.killGraceMs??3000);};
  const abort=()=>stop('parent test aborted');
  const timeout=setTimeout(()=>stop(`exceeded ${options.timeoutMs} ms deadline`),options.timeoutMs);
  options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const cleanup=()=>{clearTimeout(timeout);if(killTimer)clearTimeout(killTimer);options.signal?.removeEventListener('abort',abort);};
  child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
  child.once('error',error=>{cleanup();reject(error);});
  child.once('close',(code,signal)=>{cleanup();resolve({output,code,signal,termination});});
 });
}
