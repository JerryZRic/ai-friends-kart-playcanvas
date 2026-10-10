# Food kart runtime assets

## Exact identity, lossless delivery

The collection contains the original **54 kits × 6 independently selectable modules = 324 parts**. Public IDs preserve the inventory join key (for example `kit001::01_BodyShell`), exact module filename/root name, original kit title, and original SHA-256. No model was regenerated or substituted.

The public manifest is `models/food-karts/manifest.json`. It intentionally contains no private file paths, account identifiers, Library references, or recovery archive metadata.

Each theme is delivered in one stored ZIP containing its six image-stripped GLB gzip payloads and content-addressed original PNGs, deduplicated within that theme:

1. Read the original GLB without modifying it
2. Copy each embedded PNG, without recompression or resizing, to the logical ZIP entry `models/food-karts/textures/<sha256>.png`
3. Replace only those image byte ranges with zeroes and gzip the complete remaining GLB
4. Store the six gzip skeletons plus that theme’s deduplicated PNGs in `bundles/<kit-id>.zip`; at runtime download only the selected theme’s bundle
5. Verify the entire ZIP hash and its exact expected entry set; extract only the selected part and its required images, verify their compressed and decoded hashes, restore the original image bytes at their exact offsets, and verify the **entire reconstructed GLB against its canonical original SHA-256**
6. Pass that self-contained GLB into the existing strict GLB validator and PlayCanvas importer

Manifest `part.path` and image `path` values are logical ZIP entry names, not individually fetched public files. Each kit’s `bundlePath`, `bundleBytes`, and `bundleSha256` identify the only model network request. ZIP entries use store mode because their gzip/PNG contents are already compressed. Files named `*.glb.pack.gz` are transport payloads, not independently openable GLB files. `loadFoodKartPayload` returns the complete, independently importable original GLB as an `ArrayBuffer`. This approach changes no vertices, indices, UVs, normals, tangents, material parameters, image pixels, node names, transforms, anchors, pivots, or original JSON bytes. The original source files remain untouched.

Meshopt, Draco, geometry quantization, texture resizing, and lossy image encoding were not used. Deduplicating repeated embedded images provides the substantial download reduction without fidelity changes or an additional decoder requirement. Original PNG maps remain 384 × 384 pixels where specified by the source.

## Public API

`src/food-kart-payload.ts` exports:

- `loadFoodKartManifest({ signal, onProgress })`
- `lookupFoodKartPart(partId, { signal, onProgress })`
- `loadFoodKartPayload(partId, { signal, onProgress })`
- `clearFoodKartPayloadCache()`
- `foodKartPayloadCacheStats()`

All URLs resolve below Vite's current `BASE_URL`, including the GitHub project and isolated dev preview. The public manifest allows only the expected same-origin collection paths. Downloads are bounded, integrity errors are not retried, transient network errors use the shared retry policy, and AbortSignal cancellation stops pending work. Progress reports actual transferred bytes and retry state. Manifest download is a separate progress stage and keeps its total unknown until a real size is available. Model totals report the selected theme ZIP, with failed-attempt bytes added when retrying, and do not imply all 54 themes are downloading. Selecting another module from a cached theme transfers zero model bytes. A mixed kart may require up to six selected-theme bundles.

The single CPU payload cache is a 24 MiB least-recently-used cache of hash-verified ZIP bytes. Entry views point into those bytes without duplicating them; reconstructed GLBs are not retained. No separate PNG cache is kept. Concurrent manifest and same-theme downloads are coalesced; each consumer can cancel independently, and the underlying transfer is aborted when its final consumer leaves. GPU assets belong to the assembly loader, not this byte cache.

## Coordinates and assembly

Units are meters. Exported glTF uses **+X right, +Y up, +Z forward**. Every module root retains its original identity transform. Place all selected roots at the same vehicle transform. Never recenter or individually normalize the modules.

Public `anchors` are measured from the actual exported node world transforms, cross-checked against the original source metadata after `(x, y, z) → (x, z, -y)` conversion. Wheel pivots remain at their original hub positions. The manifest records the root transform and conservative world AABB for each part.

The source chassis combines static edible geometry by material. It does not contain a live steering pivot. Seat-reference anchors describe the shared interface, not necessarily the top of each themed cushion. Runtime rider fitting and any steering mesh split are separate, explicitly verified operations; this asset pipeline does not silently alter the source geometry.

## Verified budgets

See [the generated per-kit budget](food-kart-asset-budget.json) for all 54 kits.

- Original standalone GLBs: **652,360,460 bytes**
- Original GLBs individually gzipped: **553,912,436 bytes**
- Image-stripped gzip payloads: **57,267,297 bytes**
- **1,129 unique original PNGs:** **115,636,488 bytes**
- Globally deduplicated logical payloads: **172,903,785 bytes**
- **54 theme ZIPs:** **173,963,078 bytes**, excluding manifest and thumbnails
- Bundling adds **0.61%** total bytes through cross-theme PNG duplication and ZIP headers, while reducing model-file transport/publication requests from **1,453 to 54**
- Largest selected-theme download: **4,381,875 bytes**
- Reduction against individually gzipped original GLBs: **68.6%**
- Largest individual gzip payload: **800,437 bytes**
- Largest reconstructed standalone module: **3,795,840 bytes**
- Largest original matched six-part kit: **99,156 triangles / 49 material primitives**
- Conservative independently mixed six-slot upper bound: **163,966 triangles / 58 material primitives**

Material primitive counts are file-level counts, not measured frame draw calls. Shadows and engine batching can change actual draw calls. The whole collection is never required for first play.

The lossless transport saves network bytes, not by itself GPU texture memory. If each module is imported into a separate container, repeated embedded images can create duplicate GPU textures. An RGBA8-plus-full-mips estimate reaches 87.3 MB for the most image-heavy matched kit before GPU deduplication; that is an estimate, not an observed allocation or mobile benchmark. The assembly renderer now uses `src/kart-textures.ts` to pool exact image bytes with matching GPU format and sampler state, and reference-count their lifetimes. The figures above quantify the unpooled risk; browser QA should confirm actual pooled resources and disposal behavior.

## Rebuild and independent verification

Run the build script against a complete canonical inventory and its materialized original runtime files:

```
python scripts/build-food-kart-assets.py --inventory PATH_TO_INVENTORY_JSON --source PATH_TO_CANONICAL_KITS
node scripts/verify-food-kart-assets.mjs
node --import tsx --test tests/food-kart-payload.test.ts
```

The build fails if any original is missing or differs from its inventory hash. `--allow-partial` is a development-only recovery aid; incomplete output must not be published. The independent verifier reads only the public ZIPs and manifest, validates complete ZIP membership and bundle hashes, reconstructs all 324 original hashes, checks identity roots and anchors, counts actual triangle primitives, validates PNG hashes and dimensions, and rejects private metadata in the public manifest. `reconstructFoodKartPart(manifest, part)` exports the same strict reconstruction path for geometry test fixtures. Strict verification rejects leftover loose model delivery files.

Original module render PNGs are converted separately to small WebP thumbnails for the garage. The 324 original thumbnail WebP bytes are carried in one `thumbnails.json` index; manifest `thumbnailIndex` records its path, byte count and SHA-256. They are actual source renders; transport optimization never uses the thumbnails as material textures.
