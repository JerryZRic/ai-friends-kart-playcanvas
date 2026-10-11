/** Attach the immutable comparison camera/light package to a fresh source export.
 * node scripts/prepare-mountain-final-input.mjs GEOMETRY CAMERAS SETTINGS OUTPUT_DIR
 * Does not alter geometry, source hashes, old comparisons or public assets.
 */
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [input,cameraFile,settingsFile,output]=process.argv.slice(2).map(p=>resolve(p));
const data=JSON.parse(readFileSync(input,'utf8')),cameras=JSON.parse(readFileSync(cameraFile,'utf8')),settings=JSON.parse(readFileSync(settingsFile,'utf8'));
const cameraPackageSha256=createHash('sha256').update(JSON.stringify(cameras)).digest('hex');
if(settings.cameraPackageSha256!==cameraPackageSha256)throw new Error('Camera package mismatch');
if(JSON.stringify(data.theme)!==JSON.stringify(cameras.runtimeTheme))throw new Error('Source theme differs from frozen comparison');
if(existsSync(join(output,'mountain-geometry.json')))throw new Error('Refusing to overwrite an existing final input');
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'mountain-geometry.json'),JSON.stringify({...data,cameras,cameraPackageSha256}));
copyFileSync(cameraFile,join(output,'comparison-cameras.json'));copyFileSync(settingsFile,join(output,'comparison-render-settings.json'));
console.log(JSON.stringify({output,cameraPackageSha256,sourceHashes:data.sourceHashes}));
