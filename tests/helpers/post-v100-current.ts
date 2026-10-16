/** Fail-closed binding to the independently reviewed successor bootstrap.
 * The bootstrap pin and record are finalized only after content/evidence review.
 */
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {readFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {posix,resolve} from 'node:path';
import {POST_V100_REVIEW_SHA256} from './post-v100-review-pin';
import {readPinnedSuccessor,restoreSuccessor,successorHash,successorSha,SUCCESSOR_BOOTSTRAP_PATHS,type Successor} from './post-v100-reviewed-revisions';
let cached:Successor|undefined;
export function postV100Review(){return cached??=readPinnedSuccessor(readFileSync(SUCCESSOR_BOOTSTRAP_PATHS[0],'utf8'),POST_V100_REVIEW_SHA256);}
const hasBaseline=(r:Successor,p:string)=>Object.hasOwn(r.changes,p)||Object.hasOwn(r.protectedFiles,p);
/** Legacy transition APIs pass untouched paths and unrecognized aliases through; actual file
 * acceptance is governed by complete successor checkout validation. */
export function postV100Hash(path:string,incoming:unknown){const r=postV100Review();return Object.hasOwn(r.changes,path)?successorHash(r,path,incoming):incoming;}
export function restorePostV100Bytes(path:string,current:string){const r=postV100Review();return Object.hasOwn(r.changes,path)?restoreSuccessor(r,path,Buffer.from(current)).toString('utf8'):current;}
export function restorePostV100Buffer(path:string,current:Buffer){const r=postV100Review();assert.ok(hasBaseline(r,path),path+' exact known historical path');return restoreSuccessor(r,path,current);}
export function postV100PathsWithin(inventory:Record<string,unknown>){return Object.keys(postV100Review().changes).filter(p=>Object.hasOwn(inventory,p));}
export function postV100AddedPaths(){return [...Object.keys(postV100Review().additions),...SUCCESSOR_BOOTSTRAP_PATHS];}
export function postV100AuditDependencies(){return [...postV100AddedPaths(),...Object.keys(postV100Review().changes)];}
export function postV100SourcePaths(previous:string[]){const r=postV100Review(),additions=Object.entries(r.additions).filter(([p])=>p.startsWith('src/'));for(const [p,row]of additions){assert.ok(!previous.includes(p),p+' exact new source, no duplicate');assert.equal(successorSha(readFileSync(p)),row.currentSha256,p+' exact reviewed source addition');}return [...previous,...additions.map(([p])=>p)];}
export function postV100CurrentHash(path:string){const r=postV100Review();const hash=r.changes[path]?.currentSha256??r.additions[path]?.currentSha256??r.protectedFiles[path];assert.ok(hash,path+' complete reviewed current inventory');return hash;}
export function postV100PortableClosure(scene:'airfield'|'garden',original:Record<string,string>,required:string[]){
 const r=postV100Review(),closure=r.portableClosures?.[scene];assert.ok(closure,scene+' explicit reviewed portable closure');
 const manifestPath=`docs/${scene}-enrichment-qa-files.json`;
 assert.equal(successorSha(readFileSync(manifestPath)),closure.historicalManifestSha256,'Historical portable manifest stays byte-exact');
 assert.equal(closure.historicalManifestSha256,r.protectedFiles[manifestPath],'Portable historical record is protected evidence');
 assert.equal(new Set(closure.additions).size,closure.additions.length,'No duplicate closure additions');
 for(const p of closure.additions){assert.ok(!Object.hasOwn(original,p),p+' explicit closure addition');assert.equal(successorSha(readFileSync(p)),postV100CurrentHash(p),p+' exact new portable dependency');}
 assert.deepEqual(closure.bootstrapDependencies,[...SUCCESSOR_BOOTSTRAP_PATHS],'Explicit non-circular portable bootstrap');
 assert.equal(readFileSync(SUCCESSOR_BOOTSTRAP_PATHS[1],'utf8'),`export const POST_V100_REVIEW_SHA256 = '${POST_V100_REVIEW_SHA256}';\n`,'Canonical separately pinned bootstrap');
 const union=[...Object.keys(original),...closure.additions,...closure.bootstrapDependencies];
 for(const p of required)assert.ok(union.includes(p),p+' complete portable dependency');
 // Hash-only public/docs artifacts are evidence, not executable entrypoints. Actual imports into any namespace still recurse normally.
 const moduleRoots=union.filter(p=>p.startsWith('src/')||(p.startsWith('tests/')&&!p.startsWith('tests/fixtures/'))||p.startsWith('scripts/')||!p.includes('/'));
 for(const p of postV100LocalDependencies(moduleRoots))assert.ok(union.includes(p),p+' transitive portable source dependency');
 return union;
}

/** Parse actual literal local imports of reviewed portable runners with the locked esbuild parser.
 * Nonliteral worker/data paths remain explicitly enumerated review evidence.
 */
export function postV100LocalDependencies(roots:string[]){
 const seen=new Set<string>(),queue=[...roots];
 while(queue.length){const p=queue.pop()!;if(seen.has(p))continue;seen.add(p);
  if(!/\.(?:[cm]?[jt]sx?)$/.test(p))continue;
  const text=readFileSync(p,'utf8');
  const metadata=buildSync({stdin:{contents:text,sourcefile:posix.basename(p),resolveDir:resolve(posix.dirname(p)),loader:p.endsWith('.tsx')?'tsx':/\.tsx?$/.test(p)?'ts':'js'},bundle:true,format:'esm',write:false,external:['*'],metafile:true,logLevel:'silent'}).metafile!;
  const imports=Object.values(metadata.inputs).flatMap(input=>input.imports.map(entry=>entry.path));
  for(const spec of imports){if(!spec.startsWith('.'))continue;
   const base=posix.normalize(posix.join(posix.dirname(p),spec.split(/[?#]/)[0]));assert.ok(!base.startsWith('../')&&!base.startsWith('/'),'Local dependency stays inside checkout');
   // Installed tooling is governed by the existing package lock, outside the declared Git content scope.
   if(base.startsWith('node_modules/'))continue;
   if(base.includes('*')){
    const prefix=base.slice(0,base.indexOf('*')),directory=prefix.slice(0,prefix.lastIndexOf('/'))||'.';
    let expression='';for(let i=0;i<base.length;i++){const char=base[i];if(char==='*'){if(base[i+1]==='*'){i++;if(base[i+1]==='/'){i++;expression+='(?:.*/)?';}else expression+='.*';}else expression+='[^/]*';}else expression+=char.replace(/[.+?^${}()|[\]\\]/g,'\\$&');}
    const pattern=new RegExp('^'+expression+'$');
    const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const path=dir==='.'?e.name:dir+'/'+e.name;return e.isDirectory()?walk(path):[path];});
    const matches=walk(directory).filter(path=>pattern.test(path));assert.ok(matches.length,p+' missing bounded dynamic dependency '+spec);queue.push(...matches);continue;
   }
   const candidates=[base,...['.ts','.tsx','.js','.mjs','.cjs','.json','/index.ts','/index.js'].map(ext=>base+ext),...(/\.js$/.test(base)?[base.slice(0,-3)+'.ts']:[])];
   const resolved=candidates.find(candidate=>existsSync(candidate)&&statSync(candidate).isFile());assert.ok(resolved,p+' missing literal dependency '+spec);queue.push(resolved!);
  }
 }
 return [...seen].sort();
}
