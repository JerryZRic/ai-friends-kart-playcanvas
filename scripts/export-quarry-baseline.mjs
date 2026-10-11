/** Reproduce the frozen Quarry baseline without changing the working checkout.
 * node scripts/export-quarry-baseline.mjs OUTPUT_DIR
 * Uses only installed dependencies and the public source snapshot. No downloads.
 */
import {createHash} from 'node:crypto';
import {cpSync,copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw new Error('Supply an output directory outside the repository source folders');
const output=resolve(process.argv[2]);
for(const folder of ['src','docs','scripts','tests','models','public']){const directory=join(root,folder);if(output===directory||output.startsWith(directory+'/'))throw new Error('Output must not overwrite source folders');}
mkdirSync(output,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const contract=JSON.parse(readFileSync(join(root,'docs/quarry-enrichment-cameras.json'),'utf8')).baselineGeometryContract;
for(const [path,hash]of Object.entries(contract.sourceHashes)){
 const actual=path==='src/quarry-scenery.ts'?contract.scenerySnapshot:path;
 if(sha(join(root,actual))!==hash)throw new Error('Protected baseline dependency changed: '+actual);
}
const working=mkdtempSync(join(tmpdir(),'quarry-source-baseline-'));
try{
 cpSync(join(root,'src'),join(working,'src'),{recursive:true});
 mkdirSync(join(working,'scripts'));
 copyFileSync(join(root,contract.scenerySnapshot),join(working,'src/quarry-scenery.ts'));
 copyFileSync(join(root,'scripts/export-quarry-preview.ts'),join(working,'scripts/export-quarry-preview.ts'));
 copyFileSync(join(root,'package.json'),join(working,'package.json'));
 symlinkSync(join(root,'node_modules'),join(working,'node_modules'),'dir');
 const result=spawnSync(process.execPath,['--max-old-space-size=448','--import','tsx','scripts/export-quarry-preview.ts',output],{cwd:working,stdio:'inherit'});
 if(result.status!==0)throw new Error('Baseline export failed with status '+result.status);
 if(sha(join(output,'quarry-geometry.json'))!==contract.geometryJsonSha256)throw new Error('Baseline JSON differs from its immutable receipt');
 if(sha(join(output,'quarry-original-scene.glb'))!==contract.glbSha256)throw new Error('Baseline GLB differs from its immutable receipt');
 console.log('Verified exact frozen Quarry baseline JSON and GLB');
}finally{rmSync(working,{recursive:true,force:true});}
