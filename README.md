# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![Engine: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![Platforms: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![Code: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

A sunset-coast arcade kart racer built with **PlayCanvas Engine, TypeScript and Vite**. Choose from six rigged character drivers and race against the other five, with drift boosts, items and freely orbiting chase cameras.

**[Play in your browser](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [Download the Windows playtest](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> The game UI is Simplified Chinese with English branding. The language links above switch the documentation only. Code and original assets use AGPL-3.0-only; the six character models have separate non-commercial restrictions. See [License and model rights](#license-and-model-rights).

## Dev free-mode playtest

[Open the isolated dev preview](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) for the cinematic 3D title screen, rotating map previews and selected-character 3D inspection, shared handling profiles, settings, and complete coast/waterpark races. [Details and validation limits](docs/free-mode.md). The stable root retains the earlier free-mode release; new garage and NPC setup changes are isolated to dev. The Windows release is separate.

## New original land course (dev)

**Cloudridge Pass / 云岭盘山道** adds a mountain kart circuit with 39 m of elevation change, banked hairpins, a real grade-separated viaduct, original detailed scenery and the shared garage/race interface. Choose it in the [dev map catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=mountain). [Geometry, source and validation limits](docs/land-map-catalog.md). This web preview is separate from Windows packaging.

**Lantern Terrace Rally / 灯阶旧城环线** adds a hillside market-town circuit with a real steering-selected alley/boulevard fork, grade-separated streets and original architecture. Both player and NPC routes share the existing kart runtime. [Open the dev town catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=town).

**Redstrata Quarry / 赤砾采石环道** adds an original dry industrial canyon with a technical stone shelf, broad haul road and timber trestle. [Open the dev quarry catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=quarry).

**CedarLight Observatory / 杉影星台环线** adds connected cedar slopes, a physically banked forest bowl, observatory service/rim choices and a treetop viaduct over the earlier valley. [Open the dev forest catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=forest).

**Clockwind Workshop / 发条工坊回旋道** adds an original oversized clockmaker workshop with a graded three-quarter spiral climb, a genuine elevated crossing and cabinet/workbench route choices. [Open the dev workshop catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=workshop).

**Amberwind Harvest / 谷风麦垄回环** connects grain terraces, orchard contours and a windmill ridge, with a real drive-through barnyard choice and a broad field route. [Open the dev harvest catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/index.html?screen=maps&map=harvest).

## Modular food garage (dev only)

The isolated [dev workshop](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html) has six independent assembly slots, 55 food themes / 330 parts (including approved 000 pure white rice), separate whole-car/free-customization views, real 3D previews, comparisons and saved builds. Whole-car browsing is preview-only; apply replaces all six parts with optional save-before-replace and undo. Your selected mixed build drives the coast race; the six character attributes and water mounts remain intact. Free mode now includes car selection and easy/normal/hard race setup; NPCs use authored mixed cars with the same part formulas. No same-theme bonus. Battery wear/repair/economy are not active in this preview. [Implementation and verification limits](docs/modular-garage.md).

## Features

- **Six selectable drivers:** WHALE, GEMINI, GPT, CLAUDE, GROK and GLM, with bundled rigged character models
- **Three-lap races** against five AI opponents on a sunset coastal circuit, with ocean scenery, collisions, lap/rank tracking and a minimap
- **Arcade driving:** manual throttle, braking, reverse, handbrake drift and drift boost
- **Three items:** turbo boost, energy shield and tracking pulse
- **Visible pickups:** translucent boxes show original 3D items; 25% show a mystery question mark. Pickups vanish immediately and respawn after eight racing seconds. The HUD displays a shaded projection of the same 3D model. [Details](docs/item-pickups.md)
- **Tactical NPCs:** rivals collect real boxes, steer toward safe pickups, and choose when to boost, defend or pulse another kart. Held 3D items and use effects show their intentions. [Rules](docs/npc-tactics.md)
- **Two chase cameras**, mouse orbit, recentering and temporary rear view
- Pause/restart, sound effects, keyboard controls and on-screen touch controls
- Optional session-only local GLB driver replacement, with no upload

## Play in a browser

Open the **[GitHub Pages game](https://jerryzric.github.io/ai-friends-kart-playcanvas/)** in a browser with **WebGL2** enabled. Wait for the characters to load, choose a driver and start the race.

The first character download is approximately **51.6 MB** in total. At most two models download/prepare concurrently. The loading screen shows real byte progress, decompression and preparation; temporary errors get bounded retries, and you can retry failed files without losing models that already loaded. Missing models remain absent; retry must finish before the race starts. Both maps share an aerial loading flyover and a smooth starting-line return.

No ChatGPT login, model-service account or runtime CDN is required. The game and character assets are served from the same distribution.

## Windows playtest

**Windows 10/11, 64-bit, with a WebGL2-capable GPU.** This is a prerelease playtest, not a production release.

1. Download [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip) from the [release page](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007).
2. Extract the **entire ZIP** into a folder.
3. Run **AI Friends Kart.exe**. Keep the adjacent DLLs, `resources` and `locales` folders together.
4. Press **F11** to toggle fullscreen.

All six characters are bundled for offline play. Node.js, installation and administrator privileges are not required. Do not disable Windows security protections to run the game.

The archive includes `Game-Corresponding-Source.zip`, `Desktop-Source` with the desktop wrapper/build instructions, and license notices. Desktop packaging is supplied in that release; this repository's npm scripts build the web game.

## Controls

| Input | Action |
| --- | --- |
| `W` / `↑` | Throttle; release to coast |
| `A` / `←`, `D` / `→` | Steer left/right |
| `S` / `↓` | Brake, then reverse while held |
| `Space` | Brake without reversing |
| `Left Shift` + steering | Drift; release Shift for a charged drift boost |
| `E` | Use the collected item |
| `Z` / `C` | Switch chase camera |
| Hold right mouse button | Temporary rear view |
| Click the track, then move the mouse | Orbit the camera |
| `Q` | Recenter the camera |
| `Esc` | Pause and release the pointer |
| `P` / pause button | Pause/resume |

If pointer capture is unavailable, hold the left mouse button and drag to look around. Touch buttons provide throttle, steering, reverse, brake and drift; tap the item panel to use an item. Menu buttons support native keyboard operation.

## Development and build

Requires **Node.js 22.12 or later** and npm.

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

Open the HTTP address printed by Vite. To check and build a production distribution:

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

Serve the complete **`dist/`** over HTTP(S); do not open `index.html` as `file://`. Relative paths support both a domain root and a repository subdirectory. Keep the license notices, `source.html` and `source.zip` alongside the game.

A full clone includes six driving-model archives in `public/assets/drivers/` and six separate standing-portrait archives in `public/assets/portraits/`. The smaller deployed `source.zip` includes code, tests, both checksum manifests, build files and original editable assets but omits both sets of character archives. To restore them after extracting that source package:

```sh
npm ci
npm run models:fetch
npm run build
```

The fetch script uses fixed public paths under this isolated `/dev/` preview and verifies the compressed/decoded hashes in [the runtime manifest](docs/runtime-models.json) and [the portrait manifest](docs/portrait-models.json); it refuses to overwrite mismatched local files. Code builds without these archives; restore both sets for the complete visuals.

### GitHub Pages

The [Build and publish PlayCanvas game workflow](.github/workflows/pages.yml) is **manual**. In repository **Settings → Pages**, select **GitHub Actions**. Run the workflow on `main` with **Publish** checked. It checks, tests and builds the selected commit before publishing. A normal push does not deploy the game.

### Project layout

- `src/`: PlayCanvas scene, track, race logic, input, camera and character loading
- `public/assets/`: bundled runtime assets, including the six compressed drivers
- `models/`: editable sources for the original kart and props
- `tests/`: logic, loading, UI and engine-level checks
- `scripts/`: source packaging, runtime-model fetching and distribution checks
- `docs/`: model manifest, local-import contract and technical verification notes

## Local driver replacements

Select a driver slot and import a compatible GLB, or multi-select filenames containing exactly one slot-name token each. Files are limited to **32 MiB each**, with at most two processed concurrently. Imports stay in page memory: they are neither uploaded nor persisted. Failure/cancellation preserves the previous driver; **Restore default** restores the bundled character. The streamlined race loading screen keeps legacy import controls hidden; character selection happens in the main menu.

See [the rig and import contract](docs/local-import.md) for accepted models and validation rules.

## Verification

Automated checks cover engine-independent race/input logic, real PlayCanvas CPU/null-device rig loading, mocked UI integration and static distribution checks. They do not establish GPU appearance, native pointer-lock behavior or performance. See [test coverage and limits](docs/MIGRATION-PARITY.md) and [the ocean shader regression notes](docs/WATER-REGRESSION.md).

## License and model rights

**Code and original game assets:** AGPL-3.0-only, including the original UI, circuit, kart, props and editable sources. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). PlayCanvas and fflate retain their MIT licenses.

**Six characters, including driving models and standing portraits:** separate rights apply. The project owner identifies them as Tripo Free outputs with non-commercial restrictions; the exact redistribution terms have not been independently established. Inclusion here grants no new model license, Creative Commons license or commercial permission. AGPL does not relicense the characters. Before reuse or redistribution, establish the applicable rights and obtain any required permissions. See [MODEL-NOTICE.txt](MODEL-NOTICE.txt).

The project contains final character runtime files, not character Blender projects or high-poly authoring sources. Original kart/prop editable files remain included as corresponding source. The demo has no ads, payments or commercial model sales.
