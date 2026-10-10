// Optional asset regeneration. Original owner-supplied sheets are not distributed.
// Usage: node scripts/extract-character-emblems.mjs /path/to/authorized/source-sheets
// Requires ImageMagick 7 from its official distribution.
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const source=process.argv[2];
if(!source)throw Error('Provide the directory containing the original authorized setting sheets.');
const manifest=JSON.parse(readFileSync('docs/character-emblems.json','utf8'));
mkdirSync('public/character-emblems',{recursive:true});
for(const e of manifest.emblems){
 const input=resolve(source,e.sourceFile);
 if(createHash('sha256').update(readFileSync(input)).digest('hex')!==e.sourceSha256)throw Error(`Source does not match verified sheet: ${e.id}`);
 const {x,y,width,height}=e.crop;
 const result=spawnSync('magick',[input,'-crop',`${width}x${height}+${x}+${y}`,'+repage','-fuzz','4%','-transparent','white','-trim','+repage','-resize','112x112','-gravity','center','-background','none','-extent','128x128','-strip',`public/${e.path}`],{stdio:'inherit'});
 if(result.status!==0)throw Error(`Extraction failed: ${e.id}`);
}
