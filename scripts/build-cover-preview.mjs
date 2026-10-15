import {build} from 'vite';
import {mkdir,copyFile,rename,writeFile} from 'node:fs/promises';
await build({configFile:'vite.cover-preview.config.ts'});
for(const folder of ['menu-art','map-previews'])await mkdir(`dist-cover-preview/${folder}`,{recursive:true});
for(const file of ['whale-maid.png','whale-maid-eyes-closed.png',...['gemini','gpt','claude','grok','glm'].map(id=>`${id}-eyes-closed.png`),'title-logo.png',...['gemini','gpt','claude','grok','glm'].map(id=>`${id}-cover-v1.webp`)])await copyFile(`public/menu-art/${file}`,`dist-cover-preview/menu-art/${file}`);
await copyFile('public/map-previews/waterpark-overview.webp','dist-cover-preview/map-previews/waterpark-overview.webp');
await rename('dist-cover-preview/cover-preview.html','dist-cover-preview/index.html');
await writeFile('dist-cover-preview/preview-manifest.json',JSON.stringify({kind:'custom-2d-cover-review',source:process.env.GITHUB_SHA??'local',game:'../dev/',live2d:false,animation:'playcanvas-local-mesh-v1'},null,2)+'\n');

await copyFile('LICENSE','dist-cover-preview/LICENSE');
