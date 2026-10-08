// Deterministic AGPL corresponding-source package. No character work files are traversed.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, lstatSync } from 'node:fs';
import { zipSync } from 'fflate';
const outputDir = process.argv[2] || 'dist';
if (!['dist', 'dist-waterpark'].includes(outputDir)) throw new Error('Unsupported build output directory');
const rootFiles = ['.gitignore','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','coast.html','waterpark.html','waterpark-study.html','LICENSE','NOTICE','MODEL-NOTICE.txt','THIRD-PARTY-NOTICES.txt','SOURCE.txt'];
const roots = ['src','tests','scripts','docs','models','.github','public'];
const files = [...rootFiles];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (path === 'public/assets/drivers' || path === 'public/assets/portraits') continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not source: ${path}`);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile()) files.push(path);
  }
}
for (const path of roots) visit(path);
for (const name of readdirSync('.').filter(name => /^README(?:\.[a-zA-Z-]+)?\.md$/.test(name))) files.push(name);
const archive = {};
for (const path of [...new Set(files)].sort()) {
  if (!lstatSync(path).isFile() || /(?:^|\/)(?:\.openai|node_modules|\.git|private)(?:\/|$)/.test(path)) throw new Error(`Unsafe source path: ${path}`);
  archive[`ai-friends-kart-playcanvas-source/${path}`] = [new Uint8Array(readFileSync(path)), { mtime: new Date(1980, 0, 1), level: 9 }];
}
writeFileSync(`${outputDir}/source.zip`, zipSync(archive));
for (const name of ['LICENSE','NOTICE','MODEL-NOTICE.txt','THIRD-PARTY-NOTICES.txt','SOURCE.txt']) copyFileSync(name, `${outputDir}/${name}`);
writeFileSync(`${outputDir}/.nojekyll`, '');
for (const page of ['index.html', 'coast.html', 'waterpark.html']) {
  const html = readFileSync(`${outputDir}/${page}`, 'utf8');
  if (!html.includes('source-license')) writeFileSync(`${outputDir}/${page}`, html.replace('</body>', '<a id="source-license" href="source.html" style="position:fixed;right:12px;bottom:6px;z-index:20;color:#dbe8e8;background:#102b37d9;padding:3px 7px;font:10px/1.4 Arial" aria-label="Source code and license / 源码与许可证">Source / License · 源码与许可证</a></body>'));
}
console.log(`Packaged ${Object.keys(archive).length} public source files; runtime drivers and standing portraits served separately.`);
