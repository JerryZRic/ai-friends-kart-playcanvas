import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { packageDistribution } from './scripts/package-dist.mjs';
import { verifyRuntimeAssets } from './scripts/verify-runtime-assets.mjs';
verifyRuntimeAssets();
mkdirSync('dist',{recursive:true});
await build({entryPoints:['src/game.js'],bundle:true,format:'esm',outfile:'dist/game.js',minify:true,sourcemap:false,target:'es2022'});
packageDistribution();
console.log('AI Friends Kart six-character non-commercial demo built.');
