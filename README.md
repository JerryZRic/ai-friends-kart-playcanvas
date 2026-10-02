# Neon Kart 3D · Sunset Coast

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/platform-Web-orange.svg)](https://cici-neon-kart.shtw.chatgpt.site)

An original WebGL arcade kart racer built with Three.js, with editable assets modeled and exported in Blender 4.3.2.

**[Play in your browser](https://cici-neon-kart.shtw.chatgpt.site)**

## Features

- Sunset-coast circuit, ocean shader, directional shadows, and a perspective chase camera
- Six racers, manual throttle, braking and reverse, handbrake drift, and drift boost
- Three item types, lap and rank tracking, pause, and restart
- Two chase cameras, mouse orbit, temporary rear view, and touch controls
- Original editable Blender models and a self-contained static web build

## Stable Release

`v1.0.0` is the first stable GitHub baseline, taken from the published Sites v5 source commit `27e465a74e2248bc2584b77e3987ea2bb88d39dd`. Sites publication numbers and GitHub release tags use separate counters. See [release provenance and verification](docs/releases/v1.0.0.md).

This release preserves the original game and its assets. Later character and model experiments are excluded. The game interface remains in Chinese; the language links above switch the README only.

## Requirements

- A browser with WebGL enabled
- Node.js and npm to build or run checks; this release was verified with Node.js 24.19.0 and npm 11.9.0
- Python 3 for the included local HTTP server command
- Blender 4.3.2 to edit or regenerate the models; it is not required to play

## Quick Start

```bash
git clone https://github.com/JerryZRic/neon-kart.git
cd neon-kart
npm ci
npm run check
npm test
npm run build
npm run test:dist
npm run serve
```

Open [http://localhost:4173](http://localhost:4173).

The `dist/` folder is self-contained. It includes the bundled Three.js renderer, all four GLB assets, and license/source notices. No CDN requests are required. Serve it over HTTP rather than opening `index.html` as a `file:` URL. You can also serve the included prebuilt `dist/` without rebuilding.

## GitHub Pages and independent hosting

Deploy the **contents of `dist/`** as a static site. Relative paths work at the domain root, `/neon-kart/`, or another subdirectory. No ChatGPT account, Sites service, CDN, or backend is required. Keep `.nojekyll`, `source.html`, `source.zip`, and all license notices alongside the game. The visible **Source / License** link provides the complete project source, including editable Blender files, from the same host.

The prepared [Pages workflow](.github/workflows/pages.yml) uploads `dist/` directly. It runs **manually only**, with an explicit publish checkbox; a push does not deploy. After review and approval, choose **Settings → Pages → GitHub Actions**, then run **Publish static game to GitHub Pages** from Actions. This preparation has not enabled Pages or published a new site. A private repository does not generally make its Pages site private, and publishing also exposes `source.zip`.

The branch-based Pages picker accepts only `/(root)` or `/docs`, not `/dist`. Use the workflow above, or copy the complete distribution into one of those publishing locations. Run `npm run test:dist` for root and nested-path HTTP checks. See the [standalone deployment guide](docs/github-pages.md) for the complete layout, alternatives, and verification limits.

## Controls

| Input | Action |
| --- | --- |
| `W` / `↑` | Throttle. Release to coast; acceleration is manual. |
| `A` / `←`, `D` / `→` | Steer left or right relative to the vehicle. |
| `S` / `↓` | Brake while moving forward, then reverse while held. |
| `Space` | Brake to a full stop without reversing. |
| `Left Shift` + steering | Handbrake drift. Release Shift for drift boost. |
| `E` | Use the collected item. |
| `Z` | Switch between the two chase cameras and recenter. `C` is an alias. |
| Hold right mouse button | Look back temporarily; release to restore the previous orbit. |
| Click the track, then move the mouse | Capture the pointer and orbit the camera through 360° yaw, with smooth, limited vertical look. |
| `Q` | Smoothly recenter the camera. |
| `Esc` | Pause and release the pointer. |
| `P` / pause button | Toggle pause. |

After pausing, click the track to resume and capture the pointer again, or use `P` / the pause button to resume without capture. If pointer capture is unavailable, hold the left mouse button and drag to look around.

Touch controls provide left/right steering, drift, brake, reverse, and throttle. Tap the item panel to use an item.

The relevant driving-key layout follows NTE's documented PC controls. The [control reference](https://gamewith.net/nte/75764) and its [in-game HUD image](https://img.gamewith.net/img/original_c5318b60d191081761bb0516dadb5cd4.png) show Space for braking, Left Shift for handbrake, Z for camera switching, and right mouse for rear view. `E` for items is specific to Neon Kart. This remains an arcade lane-following racer; it does not reproduce NTE's vehicle physics or other vehicle features.

## Editable Models

Open `models/kart.blend` and `models/props.blend` in Blender. The original pieces and materials remain editable. To regenerate the assets:

```bash
blender -b --python models/build_models.py
blender -b --python models/create_props.py
```

The scripts export into `models/`. Copy the generated `kart.glb`, `palm.glb`, `rock.glb`, and `arch.glb` into `dist/assets/` before rebuilding. The GLBs use Y-up coordinates, and the kart faces +Z. The `Body` and `Helmet` materials can be recolored.

All Blender assets are original work created for this game and covered by the project license. Blender itself is an external authoring tool and is not included.

## Repository Layout

- `src/vehicle-controls.js`: physical-key mapping, manual throttle, brake/reverse, and signed steering
- `src/mouse-look.js`: smoothed orbit, bounded pitch, pointer-lock lifecycle, and drag fallback
- `src/game.js`: Three.js scene, cameras, track, racers, drift boost, items, laps, and ranking
- `src/index.html`: responsive Chinese interface and controls
- `models/`: editable Blender sources, procedural modeling scripts, and model metadata
- `tests/`: mouse-look, vehicle-control, and gameplay simulation checks
- `build.mjs`: esbuild bundle and license/source-notice copying; preserves local GLB assets
- `dist/`: deployable static game, four GLBs, and required notices
- `docs/releases/`: release provenance and verification

## Verification

JavaScript syntax checks, all **34 control/camera/gameplay simulation checks**, and the build passed. The gameplay JavaScript and GLBs remain byte-identical to the published stable version. The source HTML is unchanged; distribution packaging adds only a visible Source / License link. All four GLBs have no external buffer or image references, and both editable Blender files have no linked external libraries, images, fonts, or scripts. See the [release verification](docs/releases/v1.0.0.md).

The original build also passed Blender export, reimport, and studio-render checks, plus Three.js GLB parsing and material-batching validation. Simulation coverage includes steering/yaw at 360 headings; camera projection at 32 circuit positions in both chase cameras; smooth mouse direction, pitch limits, unlimited yaw, and recentering; repeated capture clicks and chorded mouse-button releases; unexpected and intentional pointer-lock release; delayed lock success after pause; capture failure and drag fallback; rear-view restoration; brake/reverse; items; pause/input release; touch controls; and race/restart logic.

The public Site was opened without sign-in, but the cloud test browser reported `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled` and could not create a WebGL context. Rendered gameplay and native pointer-lock feel have therefore **not been verified in that browser**. The simulation suite uses the real Three.js camera/geometry and game logic with a mocked renderer and DOM; it is not a visual browser gameplay pass.

## License

Original game code, UI, build/modeling scripts, tests, documentation, editable Blender sources, and exported GLB models are licensed under **GNU AGPL version 3 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Third-party software retains its original license. Three.js and esbuild are MIT-licensed; their notices are retained in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).

AGPL permits commercial use. If you distribute covered work, follow its license and corresponding-source requirements. If you modify this program and make the modified version available for users to interact with over a network, prominently offer those users the corresponding source as required by section 13. Private use does not by itself require public release, and sending changes upstream is not required. The full license controls.

Complete corresponding source for this release: [JerryZRic/neon-kart at v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0).
