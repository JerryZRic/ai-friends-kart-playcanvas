# AI Friends Kart · six-character demo

A non-commercial kart-racing demo on the original Neon Kart sunset circuit. Six rigged characters load automatically: choose WHALE, GEMINI, GPT, CLAUDE, GROK or GLM, then race against the other five. No local model import is required. Optional local replacements remain supported.

[简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [粵語](README.yue.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

## Rights are separate

The game code, original UI, kart, props, track and original editable assets are **AGPL-3.0-only**. Original notices remain in [NOTICE](NOTICE); Three.js, fflate and esbuild retain their MIT terms.

The six character GLBs are separate third-party assets. The owner identifies them as Tripo Free outputs restricted to non-commercial use. Exact applicable redistribution terms have not been independently established here. Publication is not a claim that every right is cleared. No new license, commercial permission, Creative Commons grant or broad redistribution permission is created by this repository. **AGPL does not relicense the characters.** Read [MODEL-NOTICE.txt](MODEL-NOTICE.txt) before reuse. This demo contains no advertisements, payments or commercial model sales.

Only final runtime GLBs are included. No new character Blender projects, raw high-poly originals, separate textures, previews, videos or private source references are published. The two unchanged, already-public original kart/prop Blender sources remain included to preserve complete corresponding source for those AGPL assets.

## Run or build

The prebuilt `dist/` folder is a complete static website. Serve the entire folder over HTTP(S); do not open it directly as `file://`. The full repository includes the six losslessly gzip-compressed runtime models. All game dependencies and models are served alongside the site; no account, model service or CDN is required.

With Node.js 22 or later:

```sh
npm ci
npm run check
npm test
npm run build
npm run test:dist
npm run serve
```

`serve` is an optional development server on port 4173. The workflow is manual and its `publish` input defaults to false.

The site serves `.glb.gz` archives and losslessly restores their original GLB bytes in the browser. Compressed and decoded identities are both checked, including hosts that already decode gzip over HTTP. Initial character loading transfers approximately 49.2 MiB (51.6 MB). At most two files load/parse at once. Each file's length and SHA-256 are checked against [docs/runtime-models.json](docs/runtime-models.json). Start remains unavailable until loading settles. If a model fails or times out, its slot explicitly reports an original-driver fallback; the UI never claims six ready when some failed. The loading panel shows actual streamed download bytes, then separate decompression and model-preparation stages (no simulated parsing percentage). Transient network failures, 60-second download timeouts, HTTP 408/429 and 5xx responses retry up to three times with exponential backoff and jitter; countdowns and attempt counts are visible. Permanent HTTP errors, invalid models and integrity failures do not auto-retry. Use Retry after loading settles to retry only failed assets; successfully prepared models remain cached for this page session. Repeated clicks cannot start overlapping loads.

## Source ZIP and separately served models

`dist/source.zip` is the complete public code/build/test/original-open-asset source package, including original Blender source and the six-model manifest. It deliberately does **not** duplicate the large character GLBs. A full repository clone includes them; a source-ZIP-only extraction rebuilds the code with original fallbacks but needs the separately served models for the six-character experience and full runtime-asset tests.

After extracting the ZIP, copy the six verified `.glb.gz` files from the public demo's `assets/drivers/` directory into `dist/assets/drivers/`, or explicitly run:

```sh
npm run models:fetch
```

This retrieves only the authorized public runtime paths at `https://jerryzric.github.io/ai-friends-kart-web/`, checks each manifest hash and refuses to overwrite mismatched local files. It may fail before that public site is deployed. It performs no upload. Then run the build/tests above. `npm run test:dist` verifies the code-only source rebuild and separately verifies the full distribution's runtime model hashes.

## Controls

- W / ↑: throttle; S / ↓: brake/reverse
- A / D or ← / →: steer; Space: brake
- Left Shift + steering: drift; release to boost
- E: item; Z / C: camera; right mouse: rear view
- Click track: mouse look; Q: recenter; Esc: pause/release; P: resume
- Menu buttons preserve native Enter/Space behavior; Start focuses the canvas

Each driver retains its full skinned hierarchy, textures, animations, independent skeleton and mixer. The wheel and authored grip motion use ±18° steering. All six participate in the race; choosing a driver makes the other five AI opponents.

## Optional local replacement

Select a slot and use **Local replacement GLB**. A single file replaces that selected slot; multiple files use exactly one filename token among whale/gemini/gpt/claude/grok/glm. Files must meet the [rig and animation contract](docs/local-import.md) and be at most 32 MiB. **Restore default** returns to the automatically loaded character, or the explicit original fallback if that download failed.

User-selected bytes are read with `File.arrayBuffer()` and parsed entirely in page memory. They are never uploaded or persisted. Refresh clears replacements. Cancel/failure preserves the prior appearance; imports are menu-only, bounded to two reads/parses, and prevent race start until settled. Acquire appropriate rights for any replacement.

## Original chassis source

The clean chassis derives only from original `models/kart.blend`, removing the baked original driver and adding a wheel pivot. It can be regenerated, without overwriting that source:

```sh
blender --background --disable-autoexec --python-exit-code 1 --python models/export_original_chassis.py -- --source models/kart.blend --output build-chassis
```

Review the generated preservation report and copy its final GLB to `dist/assets/`. Blender byte output may differ across versions. Identical code/source inputs and pinned build dependencies produce the same web/source package.

## Verification

Automated checks cover original controls/race logic, camera math, six actual runtime GLB identities and CPU skinning, 121 sampled steering poses per model, independent controllers, bundled loading/integrity/timeouts, optional local-import races, artifact safety and deterministic source rebuilds. Browser rendering, native picker/pointer lock and GPU performance require separate visual tests. CPU image fixtures do not decode texture pixels.

[Original public upstream v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0) · [Current public repository](https://github.com/JerryZRic/ai-friends-kart-web)
