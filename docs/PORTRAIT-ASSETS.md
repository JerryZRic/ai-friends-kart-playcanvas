# Original standing-character portraits

The character-selection screen uses a separate collection of the six original standing figures. These preserve their original pose, face, clothing and held objects before any seated driving-rig edits. Gemini uses the complete center-only figure, with its face and both arms, rather than the incomplete neighboring figures from the original multi-character file.

The race characters in `assets/drivers/` are unchanged. Portraits are static models: selecting, dragging, using the rotation keys or resizing the preview redraws the figure; an idle static preview does not run a continuous rendering loop.

## Runtime files and rights

- `docs/portrait-models.json` records exact compressed and decoded sizes and SHA-256 identities
- Runtime paths are `assets/portraits/{id}-portrait.glb.gz`
- The portrait collection is about 42.50 MiB compressed in total, but the menu only downloads the selected character, about 6.70–7.22 MiB
- Verified decoded CPU bytes use the existing two-entry, 36 MiB LRU cache; GPU assets remain owned by the current preview and are released on replacement or exit
- Portraits are non-commercial demonstration assets, outside the AGPL game-code license; see `MODEL-NOTICE.txt`
- The source archive excludes both portrait archives and driving archives; original working files and source packages are not included

## Web optimization

The original high-resolution meshes were decoded and dequantized with glTF Transform 4.5.1 and meshoptimizer 1.3.0. Geometry was welded and simplified with an error limit of 0.001 and target ratios of 0.16, or 0.32 for the already smaller Gemini center figure. The simplifier may stop early when its error limit prevents further reduction.

| Figure | Original vertices | Portrait vertices |
| --- | ---: | ---: |
| Whale / DeepSeek | 1,039,717 | 192,556 |
| Gemini | 481,233 | 169,843 |
| GPT | 1,008,685 | 193,000 |
| Claude | 986,972 | 188,121 |
| Grok | 1,009,369 | 195,041 |
| GLM | 1,030,541 | 198,411 |

All original embedded texture bytes were retained and their SHA-256 identities compared before and after optimization. A common parent transform turns the original forward axis toward the portrait camera; proportions and authored pose are preserved. Resource names were replaced with neutral portrait names, and unrelated metadata was removed.

The outputs have embedded resources, no required extensions, no driving skins and no animations. They need no meshopt, Draco or other external decoder at runtime. Each final GLB is wrapped in deterministic gzip with no filename and a zero timestamp. Geometry simplification is lossy; gzip compression itself is lossless.

## Verification

All six original figures and all six optimized figures were rendered with Blender 4.3.2 using CPU Cycles. Front-view inspection confirmed complete faces and standing poses, including Gemini's intended center figure. The portrait tests parse each final asset with PlayCanvas, check independent mesh-instance ownership, static behavior, camera fit at narrow and wide aspect ratios, selected-only loading, hash verification, bounded caching, cancellation, retries and release of superseded parser results.

CPU renders and null-device tests do not establish GPU/browser rendering or device performance. Final browser presentation still depends on the user's WebGL implementation and display.
