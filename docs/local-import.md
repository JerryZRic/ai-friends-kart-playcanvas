# Compatible local driver contract

The six slot IDs are `whale`, `gemini`, `gpt`, `claude`, `grok`, and `glm`. Every slot automatically loads its distributed runtime character. An explicit original-driver fallback is shown if loading fails. A compatible local file can optionally replace either appearance. Single-file import targets the slot selected when import begins; multi-file import uses exactly one slot-ID filename token.

## Export contract

- Binary glTF 2.0 (`.glb`), maximum 32 MiB per file
- +Y up, +Z forward, already seated in original kart-local units; no runtime coordinate/scale correction. Each race actor supplies an identity outer mount. Authored node transforms are preserved: five distributed GLBs intentionally have nonidentity fitting transforms on their model root. PlayCanvas returns that authored root directly, so it must not be reset to identity.
- At least one rendered skinned mesh, with POSITION, four-influence JOINTS_0/WEIGHTS_0, normalized weights, finite inverse-bind matrices and bones contained in its own hierarchy
- The distributed/original format requires nonempty `DriveIdle`, `SteerLeft`, `SteerRight`, `SteeringDemo`, and `SteeringRange` clips; `SteeringRange` is exactly 2 seconds
- A second local-file format accepts nonempty `Idle`, `Steer_Left`, and `Steer_Right` clips and uses a PlayCanvas one-dimensional blend tree. These are also the public state aliases for the original clips. The original five-clip format keeps its stricter validation. When any file includes `SteeringRange`, the range and grip-marker checks below also apply.
- For range-based drivers, `GripL` and `GripR`, or `Grip.L` and `Grip.R`, identify authored grip markers
- `SteeringRange` time 0 = steering −1, time 1 = neutral, time 2 = steering +1
- Original wheel center: `(0, 1.105, 0.30)`; shaft axis `(0, cos(43°), sin(43°))`; wheel angle `−steering × 18°`

Grip verification derives each marker's actual neutral offset at time 1 and rotates that vector about the shaft. It does not infer left/right from marker names or require a hard-coded hand radius. Five sampled poses must remain within 0.02 game units of their neutral-relative wheel path. Authors should verify every intermediate pose visually.

For distributed drivers the runtime samples the authored steering range. `ContainerResource.instantiateRenderEntity()` makes skeleton-aware PlayCanvas instances while preserving hierarchy, skin weights, UVs, materials and texture references. Each actor has independent bones, an AnimComponent, wheel and chassis paint. Character materials are never recolored or simplified. Pause freezes animation; restart resets steering to neutral. Three-clip local files blend left/idle/right using the same smoothed steering input. This baseline format does not claim the exact authored wheel-contact trajectory guaranteed by a validated range.

## Self-contained resources and limits

No external buffer or image URI is accepted, including relative, HTTPS, file and supplied blob URLs. Embedded buffer views or base64 data resources are supported. Buffer data MIME types are application/octet-stream or application/gltf-buffer. Images must be PNG, JPEG or WebP, at most 4096 × 4096 each and 32 megapixels total per imported asset. SVG and HTML images are not supported.

GLB headers, declared lengths, chunks, buffer views, accessors and image headers are checked before parsing. Oversized geometry counts, sparse accessors, unreasonable object counts and decoded geometry above 128 MiB are rejected. Draco, Meshopt, Basis/KTX2 and Gaussian-splat compression extensions are rejected before parsing, so local files cannot trigger external decoder downloads. Invalid, multiply-parented or cyclic node hierarchies and non-finite transforms are rejected. The PlayCanvas container receives a generated blob URL, an explicit `.glb` filename and the already-validated bytes via `Asset.file.contents`; the latter avoids another fetch. Only embedded buffer/image dependencies remain available to the parser. Imported bytes are never uploaded or persisted.

## Session lifecycle

At most two files are being read/parsed at once. Each request captures its target slot immediately. Newer requests for that same slot supersede older pending work; stale parsed assets are disposed. Invalid/cancelled loads preserve the prior source. A successful replacement first releases borrowing actor controllers and then unloads the old container and its owned subassets. Destroying an actor releases its per-instance render/skin state and cloned chassis materials, without unloading borrowed shared geometry or character textures. Empty/cancelled file selections change nothing.

The menu is the only import location. Starting a race is disabled while any imports are pending. An import that loses its menu permission before completion is discarded, preserving current race actors. A page refresh ends local replacement sessions and loads the six distributed default models again. Clearing a local replacement restores its distributed default, or the explicit original fallback if that model failed to load. There is no localStorage, IndexedDB, server upload or model cache.

## Verification

`tests/playcanvas-rig.test.ts` loads all six complete distributed GLBs through the real PlayCanvas 2.23.1 container parser on a NullGraphicsDevice. It checks valid bones/weights/bind matrices, 121 steering-range poses per character within 2 mm of the authored wheel path, 32 finite CPU-deformed vertex samples per skinned mesh per pose, changes to actual skin matrix palettes, independent cloned skeletons, pause/reset, safe repeated disposal, and the three-clip blend tree. Headless tests replace only embedded image pixel decoding with a 1×1 placeholder texture; they do not prove GPU rendering, texture appearance, browser file-picker behavior or frame rate. Those require a real browser verification pass.

Loader/store tests additionally cover checksums, gzip and transparently decoded responses, streamed byte progress, four-attempt bounded transport retries, preservation of successful cached slots, per-slot parse failures, stale imports and disposal. These lifecycle tests inject parser adapters and do not substitute for the real-rig suite.

References: [PlayCanvas container instantiation](https://api.playcanvas.com/engine/classes/ContainerResource.html), [animation components](https://api.playcanvas.com/engine/classes/AnimComponent.html), [animation layer time sampling](https://api.playcanvas.com/engine/classes/AnimComponentLayer.html), and [Asset file contents](https://api.playcanvas.com/engine/classes/Asset.html).

## Rights

The original open kart, props, track, UI, code and corresponding editable source are distributed under their existing AGPL-3.0-only notices. The six distributed runtime characters have separate rights and non-commercial restrictions described in MODEL-NOTICE.txt. A local third-party model retains its own licensing and restrictions; it is not automatically covered by AGPL. Obtain the required rights before importing. This app cannot determine whether a particular model's terms permit your use.
