// Isolated art-sample build. Does not replace the published game's dist directory.
import {build} from 'vite';
import {execFileSync} from 'node:child_process';
await build({configFile:false,base:'./',build:{outDir:'dist-waterpark',target:'es2022',sourcemap:true,rollupOptions:{input:{main:'index.html',coast:'coast.html',waterpark:'waterpark.html',study:'waterpark-study.html'}}}});

execFileSync(process.execPath,['scripts/package-source.mjs','dist-waterpark'],{stdio:'inherit'});
