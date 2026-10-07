# AI Friends Kart · PlayCanvas edition

A separate **PlayCanvas Engine + TypeScript + Vite** HTML migration of [AI Friends Kart](https://github.com/JerryZRic/ai-friends-kart-web). The old game and stable Neon Kart project are unchanged. Windows packaging is deferred.

[简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [粵語](README.yue.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

## Play

[Open the GitHub Pages demo](https://jerryzric.github.io/ai-friends-kart-playcanvas/)

Six rigged characters load automatically: WHALE, GEMINI, GPT, CLAUDE, GROK and GLM. Choose any driver and race against the other five around the original sunset coast circuit. Three laps, drift boosts, three item types, collisions, reverse, pause, restart, two chase cameras, full mouse orbit, rear view, minimap, sound and touch controls are retained. Optional session-only local GLB replacement remains supported.

The runtime UI is Simplified Chinese with English branding, as in the previous edition. These six-language README files are documentation, not a runtime language selector.

## Build and run

Use Node.js 22.12 or later:

```sh
npm ci
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

Open the preview HTTP address. For development, `npm run dev`. Do not open the HTML as `file://`. Vite uses relative paths; the complete `dist/` can be served under a GitHub Pages repository subpath or any ordinary HTTP(S) static server. All runtime code and models are local to the distribution: no ChatGPT login, runtime CDN or model-service account is needed.

The full repository contains six final `.glb.gz` runtime files in `public/assets/drivers/` (51.6 MB total transfer). Each compressed and decoded identity is checked against [docs/runtime-models.json](docs/runtime-models.json). At most two characters download/parse concurrently. The UI shows actual download bytes, separate decompression/preparation stages, bounded exponential retry countdowns, and manual retry of failed files while retaining successful models. Missing models are labeled original-driver fallbacks, never claimed ready.

## Controls

- W / ↑: throttle; S / ↓: brake then reverse; Space: brake
- A / D or ← / →: steer; Left Shift + steer: drift; release to boost
- E: use item; Z / C: camera; right mouse: rear view
- Click track: mouse look; Q: recenter; Esc: pause/release; P: pause/resume
- Touch buttons provide throttle, steering, reverse, brake and drift; tap item to use
- Menu buttons retain native keyboard operation

## Local replacements

Select a slot, choose a compatible GLB, or multi-select files containing exactly one slot-name token. Imports are at most 32 MiB each, two at a time, memory-only and never uploaded or persisted. Newer selections supersede older pending work. Failure/cancel preserves the previous driver; Restore default returns to the bundled character or explicit fallback. See [the rig/security contract](docs/local-import.md).

## Rights and corresponding source

Code, original UI/circuit/kart/props and original editable sources are **AGPL-3.0-only**. Read [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). PlayCanvas and fflate retain MIT licenses; no Three.js runtime is bundled.

The six character GLBs have **separate rights**. The owner identifies Tripo Free/non-commercial restrictions; exact redistribution terms have not been independently established. This repository does not grant new model rights, commercial permission or a Creative Commons license. AGPL does not relicense characters. Read [MODEL-NOTICE.txt](MODEL-NOTICE.txt). There are no ads, payments or commercial model sales.

Only already-public sanitized final character runtime files are reused. No character Blender projects, high-poly originals, private references, work exports or account metadata are included. The original already-public kart/prop Blender sources are retained for AGPL corresponding-source completeness.

The deployed `source.zip` contains complete public code, tests, build files, pinned metadata, original assets/editable sources and notices, excluding the six large character archives. After extracting source.zip, run `npm ci`, `npm run models:fetch`, and `npm run build`. The fetch script downloads only fixed public manifest paths and verifies hashes; it will not overwrite mismatched local files. Without those models, code still builds and reports explicit original-driver fallbacks.

## Verification and limits

See [migration parity and test evidence](docs/MIGRATION-PARITY.md). Tests distinguish engine-independent logic, real PlayCanvas CPU/null-device rig loading, UI integration mocks and static distribution checks from GPU/browser gameplay. Headless asset tests substitute texture decoding only; they do not certify appearance, pointer-lock support or GPU performance. The available cloud browser has WebGL disabled, so actual GPU gameplay must be checked in a WebGL2-capable browser.

GitHub Pages deployment is manual: choose **Build and publish PlayCanvas game**, Run workflow, check **Publish**, and run on main. Settings → Pages must use GitHub Actions. The workflow checks, tests and builds the exact selected commit before publication.
