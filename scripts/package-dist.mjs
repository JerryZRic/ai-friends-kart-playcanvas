// Standalone static distribution and deterministic corresponding-source archive.
// Uses only Node built-ins; no service, account, or publishing step is involved.
import { copyFileSync, existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { verifyRuntimeAssets } from './verify-runtime-assets.mjs';

export const sourceLink = '<a id="source-license" href="source.html" style="position:fixed;right:12px;bottom:6px;z-index:20;color:#dbe8e8;background:#102b37d9;padding:3px 7px;border-radius:3px;font:10px/1.4 Arial,sans-serif;text-decoration:underline" aria-label="Source code and license / 源码与许可证">Source / License · 源码与许可证</a>';

// ZIP format uses little-endian fields and CRC-32, with a fixed DOS timestamp
// (1980-01-01). Sorted names and fixed metadata make identical inputs repeatable.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const entries = [], directory = [];
  let offset = 0;
  for (const path of files) {
    const name = Buffer.from(`ai-friends-kart-web-source/${path}`);
    const raw = readFileSync(path), data = deflateRawSync(raw, { level: 9 }), crc = crc32(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    entries.push(header, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, central, end]);
}

// Explicit source allowlist. Never traverse a workspace, node_modules, .git,
// deployment settings, temporary exports, or generated archives.
export const sourceFiles = [
  '.gitignore', '.github/workflows/pages.yml', 'package.json', 'package-lock.json', 'build.mjs',
  'LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'MODEL-NOTICE.txt',
  'README.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.yue.md', 'README.ja.md', 'README.ko.md',
  'src/game.js', 'src/index.html', 'src/vehicle-controls.js', 'src/mouse-look.js',
  'src/bundled-drivers.js', 'src/driver-roster.js', 'src/animated-driver.js', 'src/local-driver-import.js',
  'models/kart.blend', 'models/props.blend', 'models/build_models.py', 'models/create_props.py', 'models/model_metadata.json', 'models/export_original_chassis.py',
  'dist/assets/kart.glb', 'dist/assets/palm.glb', 'dist/assets/rock.glb', 'dist/assets/arch.glb', 'dist/assets/kart-r12-chassis.glb',
  'tests/three-test.mjs', 'tests/gameplay.test.mjs', 'tests/vehicle-controls.test.mjs', 'tests/mouse-look.test.mjs', 'tests/dist.test.mjs',
  'tests/bundled-drivers.test.mjs', 'tests/runtime-drivers.test.mjs', 'tests/local-driver-import.test.mjs', 'tests/public-artifact.test.mjs', 'tests/helpers/synthetic-driver.mjs',
  'scripts/verify-runtime-assets.mjs', 'scripts/fetch-runtime-models.mjs', 'docs/runtime-models.json', 'scripts/package-dist.mjs', 'docs/github-pages.md', 'docs/local-import.md', 'docs/releases/v1.0.0.md', 'docs/releases/v1.0.0-original-source.json',
].sort();

export function makeSourceArchive() { return zip(sourceFiles); }

export function packageDistribution() {
  verifyRuntimeAssets();
  for (const file of sourceFiles) {
    if (!existsSync(file) || !lstatSync(file).isFile()) throw new Error(`Missing regular source file: ${file}`);
  }
  const html = readFileSync('src/index.html', 'utf8');
  if (!html.includes('</body>')) throw new Error('Missing HTML body closing tag');
  writeFileSync('dist/index.html', html.replace('</body>', `${sourceLink}</body>`));
  for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'MODEL-NOTICE.txt']) copyFileSync(file, `dist/${file}`);
  writeFileSync('dist/.nojekyll', '');
  writeFileSync('dist/source.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Friends Kart · Source and License</title>
<style>body{max-width:760px;margin:40px auto;padding:0 24px;background:#172936;color:#edf4ec;font:16px/1.6 system-ui,sans-serif}a{color:#d5ff60}li{margin:10px 0}code{overflow-wrap:anywhere}h1{line-height:1.2}</style></head>
<body><p><a href="./">← Back to game / 返回游戏</a></p><h1>Source and License<br>源码与许可证</h1>
<p>AI Friends Kart · six-character non-commercial demo. Game code and original open kart/track/prop assets: GNU AGPL version 3 only (AGPL-3.0-only). Three.js, fflate and esbuild retain their MIT licenses.</p>
<p>The source download is served alongside this game. It includes editable ORIGINAL kart/prop Blender models, original exported GLBs, game source, tests, build scripts, pinned dependency metadata, documentation, and notices. It does not require GitHub or ChatGPT access. Extract it, then run <code>npm ci</code> and <code>npm run build</code> to rebuild the distribution. Build dependencies are fetched from npm.</p>
<p>源码下载与游戏一同托管，包含原始赛车/道具的可编辑 Blender 模型及原创 GLB、游戏源码、测试、构建脚本、锁定的依赖信息、文档及许可声明，无需登录 GitHub 或 ChatGPT。解压后运行 <code>npm ci</code> 和 <code>npm run build</code>；构建依赖从 npm 获取。</p>
<ul><li><a href="source.zip" download>Download corresponding source / 下载对应源码（ZIP）</a></li><li><a href="LICENSE">GNU AGPL v3 license</a></li><li><a href="NOTICE">Original work notice</a></li><li><a href="THIRD-PARTY-NOTICES.txt">Third-party MIT notices</a></li><li><a href="SOURCE.txt">Source information</a></li><li><a href="MODEL-NOTICE.txt">Separate character-model rights notice</a></li></ul>
<p>Six losslessly gzip-compressed final character GLBs load automatically from this site for this non-commercial demo. They are separate from the AGPL code/open original assets; no new model license or broader rights are granted. The owner identifies Tripo Free/non-commercial restrictions; exact redistribution terms remain unverified. See the separate model notice. Character project files are not included. 六个最终角色 GLB 自动加载，仅供非商业试玩，角色权利与 AGPL 代码分开，不代表已完全核实转分发许可。</p>
<p>The source ZIP excludes the six large character GLBs. It contains their manifest and a verification/download script. Clone the full repository, or copy the separately served .glb.gz runtime files into dist/assets/drivers/ before using the complete six-character distribution. Without them, the original kart fallback remains available. Optional local replacements stay in memory and are never uploaded or stored.</p>
<p>This program is distributed without any warranty. See the license for the full terms.</p></body></html>\n`);
  writeFileSync('dist/source.zip', makeSourceArchive());
  console.log(`Standalone dist ready; source.zip contains ${sourceFiles.length} source files.`);
}
