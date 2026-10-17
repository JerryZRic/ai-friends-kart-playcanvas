# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![Engine: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![Platforms: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![Code: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

An arcade kart racer built with **PlayCanvas Engine, TypeScript and Vite**, with 12 land courses and one water course. Choose from six rigged character drivers and race against the other five, with drift boosts, items and freely orbiting chase cameras.

**[Play the main browser version](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [Try the dev preview](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [Web / HTML and Windows downloads](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> The game UI is Simplified Chinese with English branding. The language links above switch the documentation only. Code and original assets (excluding music) use AGPL-3.0-only; the six character models have separate non-commercial restrictions. See [License and model rights](#license-and-model-rights).

## v1.1.0 Stable release

**v1.1.0 is the stable release for Web / HTML and Windows x64.** It retains 13 maps, six drivers and the six-slot food garage with 55 themes / 330 parts. The 11 additional land courses include their scene-enrichment passes. Published assets, source revision, checksums and verification notes are listed on the [release page](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases). The site root is the main publication; `/dev/` is the separate development preview.

Free mode includes a randomly selected animated cover featuring one of six characters, rotating map previews, selected-character 3D inspection, car selection, easy/normal/hard race setup and settings. The cover uses custom PlayCanvas 2D mesh animation, not Cubism: WHALE (大肥鱼) has a 35% selection chance and the other five share 65% equally. Story mode remains a development notice. [Implementation notes and limits](docs/free-mode.md).

### Map catalog

The catalog lists land courses **01–12**, followed by water course **A01**. Display numbering does not change saved map IDs or deep links.

- **01** [Sunset Coast](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=coast) · `coast`
- **02** [Cloudridge Pass](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain) · `mountain`
- **03** [Lantern Terrace Rally](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town) · `town`
- **04** [Redstrata Quarry](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry) · `quarry`
- **05** [CedarLight Observatory](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest) · `forest`
- **06** [Clockwind Workshop](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop) · `workshop`
- **07** [Amberwind Harvest](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest) · `harvest`
- **08** [Sunweave Caravan](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert) · `desert`
- **09** [Frostloop Depot](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow) · `snow`
- **10** [Basalt Crown](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera) · `caldera`
- **11** [Verdant Canopy](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden) · `garden`
- **12** [Copperwing Airfield](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield) · `airfield`
- **A01** [Sky Waterpark](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=waterpark) · `waterpark`


## Original land courses

**Cloudridge Pass / 云岭盘山道** adds a mountain kart circuit with 39 m of elevation change, banked hairpins, a real grade-separated viaduct, original detailed scenery and the shared garage/race interface. Choose it in the [map catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain). [Geometry, source and validation limits](docs/land-map-catalog.md). [Mountain scene enrichment and same-camera comparison method](docs/mountain-scene-enrichment.md). [Current roadside art pass](docs/mountain-roadside-art-pass.md).

**Lantern Terrace Rally / 灯阶旧城环线** adds a hillside market-town circuit with a real steering-selected alley/boulevard fork, grade-separated streets and original architecture. Both player and NPC routes share the existing kart runtime. [Open the town catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town).

**Redstrata Quarry / 赤砾采石环道** adds an original dry industrial canyon with a technical stone shelf, broad haul road and timber trestle. [Open the quarry catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry).

**CedarLight Observatory / 杉影星台环线** adds connected cedar slopes, a physically banked forest bowl, observatory service/rim choices and a treetop viaduct over the earlier valley. [Open the forest catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest).

**Clockwind Workshop / 发条工坊回旋道** adds an original oversized clockmaker workshop with a graded three-quarter spiral climb, a genuine elevated crossing and cabinet/workbench route choices. [Open the workshop catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop).

**Amberwind Harvest / 谷风麦垄回环** connects grain terraces, orchard contours and a windmill ridge, with a real drive-through barnyard choice and a broad field route. [Open the harvest catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest).

**Sunweave Caravan / 星砂古驿** follows supported dune ridges, a wind-carved sandstone corridor and open caravan courts, with a technical twin-arch route or a broad sailcourt sweep. [Open the desert catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert).

**Frostloop Depot / 霜环雪站** climbs opposing snow bowls and a low saddle before choosing a technical maintenance-yard cut or a broad banked terrace, then returns over stepped stone-supported slopes. [Open the snow catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow).

**Basalt Crown / 玄岩环冕** climbs an open caldera rim, descends into a hooked stone bowl and offers technical inner and broad outer routes through separate openings beneath a real masonry viaduct. [Open the caldera catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera).

**Verdant Canopy / 蔓穹花园** links planted ascent folds, a petal terrace and a low basin, with a technical path beneath a genuinely open timber arbor or a broader outer garden arc. [Open the garden catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden).

**Copperwing Airfield / 铜翼空港** connects a launch runway, reversing observation ridge and descending uplands, with a narrow open-frame hangar route or a broader perimeter taxiway. Original static aircraft exhibits remain outside the kart racing lanes. [Open the airfield catalog](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield).

## Modular food garage

Open the [main garage](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html) or [dev garage](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html). Six independent assembly slots offer **55 food themes / 330 parts**, including 000 pure white rice, separate whole-car/free-customization views, real 3D previews, comparisons and saved builds. Whole-car browsing only previews; applying replaces all six parts, with optional save-before-replace and undo. Selected mixed builds run on all 12 land courses; the six character attributes and water mounts remain intact. NPCs use authored mixed cars with the same part formulas. There is no same-theme bonus. Battery discharge, wear, repair and economy systems are not active. [Implementation and verification limits](docs/modular-garage.md).

## Features

- **Six selectable drivers:** WHALE, GEMINI, GPT, CLAUDE, GROK and GLM, with bundled rigged character models
- **Three-lap races** against five AI opponents across the land and water catalog, with collisions, lap/rank tracking and a minimap
- **Arcade driving:** manual throttle, braking, reverse, handbrake drift and drift boost
- **Fixed E/R slots and three-of-a-kind upgrades:** stacking is enabled by default in the stable game and dev preview. Two matching ordinary items stack in one slot and each use consumes one; the third becomes one super use. Further matching boxes are consumed without upgrading the super, filling the other slot or creating a Token. Mystery boxes roll normally with a free slot and are rejected when both slots are full. E/R share a 1.2-second cooldown. In pause settings, apply and restart to change modes; `itemStacking=0` restores the plain dual-slot mode. Player and NPCs use the same rules; slot positions remain fixed.
- **Music:** all land and water races share a random pool of 17 tracks. THEME plays in menus; Love is reserved and excluded from the race pool. The original-quality MP3 files are preserved without transcoding; music has its own non-commercial license.
- **Three items:** turbo boost, energy shield and tracking pulse
- **Visible pickups:** translucent boxes show original 3D items; 25% show a mystery question mark. Pickups vanish immediately and respawn after eight racing seconds. The HUD displays a shaded projection of the same 3D model. [Details](docs/item-pickups.md)
- **Tactical NPCs:** rivals collect real boxes, steer toward safe pickups, and choose when to boost, defend or pulse another kart. Held 3D items and use effects show their intentions. [Rules](docs/npc-tactics.md)
- **Two chase cameras**, mouse orbit, recentering and temporary rear view
- Pause/restart, sound effects, keyboard controls and on-screen touch controls
- Optional session-only local GLB driver replacement, with no upload

## Play in a browser

Open the **[GitHub Pages game](https://jerryzric.github.io/ai-friends-kart-playcanvas/)** in a browser with **WebGL2** enabled. Wait for the characters to load, choose a driver and start the race.

The first racing-character download is approximately **51.6 MB** in total; selected standing portraits and food-car parts download separately as needed. At most two character models download/prepare concurrently. The loading screen shows real byte progress, decompression and preparation; temporary errors get bounded retries, and you can retry failed files without losing models that already loaded. Missing models remain absent; required assets must finish loading before the race starts. Races use an aerial loading flyover and a smooth starting-line return.

No ChatGPT login, model-service account or runtime CDN is required. The game and character assets are served from the same distribution.

## Web / HTML package

Choose the [`ai-friends-kart-playcanvas-v1.1.0-html.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-html.zip) from the [release page](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases) and verify its accompanying SHA-256 checksum. Extract the complete archive and serve it through nginx or another HTTP(S) static server. Opening `index.html` directly with `file://` is not supported. Keep all assets, license notices and corresponding-source files together. Check the release verification notes for root/subdirectory deployment results; relative-path support is not a substitute for testing the published archive.

The main GitHub Pages site serves runtime files; download its corresponding source as [`source.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/source.zip) from the [v1.1.0 release](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0). The complete HTML ZIP still includes `source.zip` and all runtime assets. Historical offline balance reports and data remain under `/dev/`. v1.1.0 is tagged from the final merged `main` commit, not published directly from `dev`.

GitHub Pages root and Timewish serve the hosted game without the offline balance diagnostic datasets. Their diagnostic entry links to the exact [v1.1.0 complete HTML package](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-html.zip), never to floating dev diagnostics. The complete HTML ZIP retains the datasets and functional offline diagnostics.

## Windows x64 package

Download [`ai-friends-kart-playcanvas-v1.1.0-windows-x64.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-windows-x64.zip) · [SHA256SUMS](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/SHA256SUMS)

Requires 64-bit Windows 10/11 and a WebGL2-capable GPU. Extract the entire ZIP, keep DLLs, `resources` and `locales` together, then run **AI Friends Kart.exe**; **F11** toggles fullscreen. Do not disable Windows security protections. Automated packaging, security and protocol checks do not establish native Windows GPU, performance or input compatibility.

## Controls

| Input | Action |
| --- | --- |
| `W` / `↑` | Throttle; release to coast |
| `A` / `←`, `D` / `→` | Steer left/right |
| `S` / `↓` | Brake, then reverse while held |
| `Space` | Brake without reversing |
| `Left Shift` + steering | Drift; release Shift for a charged drift boost |
| `E` / `R` | Use the item in the corresponding fixed slot |
| `Z` / `C` | Switch chase camera |
| Hold right mouse button | Temporary rear view |
| Click the track, then move the mouse | Orbit the camera |
| `Q` | Recenter the camera |
| `Esc` | Pause and release the pointer |
| `P` / pause button | Pause/resume |

If pointer capture is unavailable, hold the left mouse button and drag to look around. Touch buttons provide throttle, steering, reverse, brake and drift, with separate `E` and `R` item buttons. Menu buttons support native keyboard operation. The mobile game area suppresses accidental text selection, image dragging, context menus and interfering gestures while preserving input fields and scrolling where needed. OS accessibility zoom cannot be guaranteed to be blocked. These changes have not been verified on physical phones.

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

Serve the complete **`dist/`** over HTTP(S); do not open `index.html` as `file://`. Relative-path deployment at a domain root or subdirectory must be checked against the actual release archive and its verification notes. Keep the license notices, `source.html` and `source.zip` alongside the game.

A full clone includes six driving-model archives in `public/assets/drivers/` and six separate standing-portrait archives in `public/assets/portraits/`. The smaller release `source.zip` includes code, tests, both checksum manifests, build files and original editable assets but omits both sets of character archives. To restore them after extracting that source package:

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

The source archive also omits the downloadable food-kart payloads; restore and verify them with the commands above. The original editable asset sources and manifests remain included.

The fetch script uses fixed public paths under this isolated `/dev/` preview and verifies the compressed/decoded hashes in [the runtime manifest](docs/runtime-models.json) and [the portrait manifest](docs/portrait-models.json); it refuses to overwrite mismatched local files. Code builds without these archives; restore both sets for the complete visuals.

### GitHub Pages

Build labels are `v1.1.0` for release, `v1.1.0-dev.<sha6>` for dev using the actual build commit, and `v1.1.0-dev.local` without a supplied commit.

Development builds append the first six characters of their actual commit hash to the version. Release tags are created from `main`; release packages must use that tagged source. A dev deployment must preserve the main site root.

The [Build and publish PlayCanvas game workflow](.github/workflows/pages.yml) checks, tests and builds the selected source before publication. The main site is at the root URL and the independent preview is under `/dev/`. Follow the checked-out branch’s workflow triggers and publication options; a dev deployment must preserve the main root. Release packages must use the same tagged source as the release they describe.

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

Historical CPU candidate 21 results apply only to the single-slot baseline. They do not certify balance or fairness for the new dual-slot gameplay. Physical-phone QA has not been performed.

Automated checks cover engine-independent race/input logic, real PlayCanvas CPU/null-device rig loading, mocked UI integration and static distribution checks. They do not establish GPU appearance, native pointer-lock behavior or performance. See [test coverage and limits](docs/MIGRATION-PARITY.md) and [the ocean shader regression notes](docs/WATER-REGRESSION.md).

## License and model rights

**Code and original game assets (excluding music):** AGPL-3.0-only, including the original UI, circuit, kart, props and editable sources. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). PlayCanvas and fflate retain their MIT licenses.

**Original music (© 2026 JerryZRic):** [Separate music license](public/assets/music/LICENSE.txt). The musical works and recordings, including adaptations, may be used, modified and distributed non-commercially with this game and its forks, with credit and retained notices. Commercial use requires JerryZRic’s prior permission. This does not license unrelated projects or standalone music distribution/sale. The code’s AGPL terms are unchanged.

**Six characters, including driving models and standing portraits:** separate rights apply. The project owner identifies them as Tripo Free outputs with non-commercial restrictions; the exact redistribution terms have not been independently established. Inclusion here grants no new model license, Creative Commons license or commercial permission. AGPL does not relicense the characters. Before reuse or redistribution, establish the applicable rights and obtain any required permissions. See [MODEL-NOTICE.txt](MODEL-NOTICE.txt).

The project contains final character runtime files, not character Blender projects or high-poly authoring sources. Original kart/prop editable files remain included as corresponding source. The demo has no ads, payments or commercial model sales.

