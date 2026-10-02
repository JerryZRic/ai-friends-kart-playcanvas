import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { packageDistribution } from './scripts/package-dist.mjs';
mkdirSync('dist',{recursive:true});
await build({entryPoints:['src/game.js'],bundle:true,format:'esm',outfile:'dist/game.js',minify:true,sourcemap:false,target:'es2022'});
packageDistribution();
console.log('Neon Kart 3D built.');
