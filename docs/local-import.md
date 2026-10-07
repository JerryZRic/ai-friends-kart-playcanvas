# Compatible local driver contract

The six slot IDs are `whale`, `gemini`, `gpt`, `claude`, `grok`, and `glm`. Every slot automatically loads its distributed runtime character. An explicit original-driver fallback is shown if loading fails. A compatible local file can optionally replace either appearance. Single-file import targets the slot selected when import begins; multi-file import uses exactly one slot-ID filename token.

## Export contract

- Binary glTF 2.0 (`.glb`), maximum 32 MiB per file
- Identity scene root, +Y up, +Z forward, already seated in original kart-local units; no runtime coordinate/scale correction
- At least one SkinnedMesh, with position attributes, four-influence skinIndex/skinWeight, normalized weights and bones contained in its own hierarchy
- Nonempty `DriveIdle`, `SteerLeft`, `SteerRight`, `SteeringDemo`, and `SteeringRange` clips; `SteeringRange` is exactly 2 seconds
- `GripL` and `GripR`, or `Grip.L` and `Grip.R`, identify authored grip markers
- `SteeringRange` time 0 = steering −1, time 1 = neutral, time 2 = steering +1
- Original wheel center: `(0, 1.105, 0.30)`; shaft axis `(0, cos(43°), sin(43°))`; wheel angle `−steering × 18°`

Grip verification derives each marker's actual neutral offset at time 1 and rotates that vector about the shaft. It does not infer left/right from marker names or require a hard-coded hand radius. Five sampled poses must remain within 0.02 game units of their neutral-relative wheel path. Authors should verify every intermediate pose visually.

The runtime samples the authored steering range, rather than blending distant endpoints. SkeletonUtils clones preserve hierarchy, skin weights, UVs, materials and texture references. Each actor has independent bones, mixer, wheel and chassis paint. Character materials are never recolored or simplified. Pause freezes animation; restart resets steering to neutral.

## Self-contained resources and limits

No external buffer or image URI is accepted, including relative, HTTPS, file and supplied blob URLs. Embedded buffer views or base64 data resources are supported. Buffer data MIME types are application/octet-stream or application/gltf-buffer. Images must be PNG, JPEG or WebP, at most 4096 × 4096 each and 32 megapixels total per imported asset. SVG and HTML images are not supported.

GLB headers, declared lengths, chunks, buffer views, accessors and image headers are checked before parsing. Oversized geometry counts, sparse accessors, unreasonable object counts and decoded geometry above 128 MiB are rejected. Compressed formats requiring external decoders are not configured. The import loader has a second URL guard that permits only embedded data or internally generated blob URLs. Imported bytes are never uploaded or persisted.

## Session lifecycle

At most two files are being read/parsed at once. Each request captures its target slot immediately. Newer requests for that same slot supersede older pending work; stale parsed assets are disposed. Invalid/cancelled loads preserve the prior source. A successful replacement first releases borrowing actor controllers and then disposes the old geometry, materials, textures and image bitmaps. Empty/cancelled file selections change nothing.

The menu is the only import location. Starting a race is disabled while any imports are pending. An import that loses its menu permission before completion is discarded, preserving current race actors. A page refresh ends local replacement sessions and loads the six distributed default models again. Clearing a local replacement restores its distributed default, or the explicit original fallback if that model failed to load. There is no localStorage, IndexedDB, server upload or model cache.

## Rights

The original open kart, props, track, UI, code and corresponding editable source are distributed under their existing AGPL-3.0-only notices. The six distributed runtime characters have separate rights and non-commercial restrictions described in MODEL-NOTICE.txt. A local third-party model retains its own licensing and restrictions; it is not automatically covered by AGPL. Obtain the required rights before importing. This app cannot determine whether a particular model's terms permit your use.
