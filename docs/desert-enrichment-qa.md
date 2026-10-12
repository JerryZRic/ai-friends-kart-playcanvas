# Desert007 additive scenery contract

This pass enriches the existing Sunweave Caravan scene. It does not add a map, change a route or replace its stable release. Geometry is original source-built project work. External reference pixels are not included in runtime assets or exports.

## Original baseline and scope

The immutable local baseline is `077d232f4b4160d8928cce8cd85d0008c7212747`. It includes unpublished Workshop/Harvest work. `915109353ed1d2fcdc8afbb5bdacafca3648e92e` is the separately recorded last public dev identity, not proof that this local pass was published.

The original Desert scene has 107224 triangles, 133911 vertices and 22 material batches. The reviewed Desert-only ceiling is fewer than 125000 triangles and fewer than 200000 vertices, with exactly 22 batches and at most 16000 additional triangles. All other scene budgets remain unchanged.

`tests/fixtures/desert-enrichment-protected.json` retains the original tracked-file inventory and nested historical contracts. Complete original Desert source and native-test snapshots are in `docs/scene-baselines`. Only three native-test triangle-cap literals change from 110000 to 125000. Their complete remaining text, including all original camera, terrain, contact, road, pickup and physics assertions, is byte-identical.

## What the new tests prove

- Original batch positions, indices, UVs, actual PlayCanvas-computed normals, material values and order remain exact prefixes. Added triangles cannot share old vertices
- Original road surfaces/undersides, shoulders, rails, signs, terrain grid, arches, landmarks, foundations, props and camera payloads remain exact
- All new indexed triangles have one named component owner. Added solids are closed, connected, consistently wound, outward and nondegenerate
- Actual complete lower surfaces are covered by the emitted terrain triangle union. The small buried offset is measured over entire clipped planes, not inferred from centers or AABBs
- Each named support relationship has an actual positive-area surface seat or a measured structural join. Whole stratum interfaces and lower feet are tested explicitly
- New camera payloads contain exactly the real indexed triangles and preserve openings. Two unoccupied court bays and the new deep pottery opening receive explicit void witnesses
- Cross-material duplicate outward skins are rejected. Concealment requires complete polygon burial inside real terrain or a third closed support
- Unrelated positive-volume intersections are rejected. Shared-post brace joints require the whole convex intersection to be inside the actual post; assembly membership alone is never an exemption

The source importer uses `pc.calculateNormals(batch.positions, batch.indices)`. The audit checks those source normals directly, including original-prefix identity and finite unit-length new normals. Offline rendering remains separate evidence.

## Camera coverage

The pre-edit camera fixture freezes 30 road-eye/normal-chase views and the five original catalog transforms. Primary comparison settings are 1280×800, 56° vertical FOV, 0.12–2200m clipping and 8-sample draft quality. Original eye, target, matrix, lens and framing values cannot be retargeted to favor a candidate.

The added CPU matrix includes 2970 static desired-safe/interpolated poses and 8190 actual previous-pose-smoothed moving frames at 30/60 Hz. It covers full legal lanes, both views, orbit limits, rear toggles, complete booms and movement between frames. Every saved baseline pose is replayed or proved numerically identical. An inherited witness requires the exact same original face, segment, label, violation kind and no worse gap.

These additions do not replace the original independent Desert suite: 100188 whole-course poses with both desired-safe and interpolated booms, 54720 dense-arch poses with both boom states, 46656 transition frames and 1296 pickup rays. Original gameplay-camera tests also remain intact.

## Portable serial verification

Use a disk-backed temporary directory and one heavy process at a time. Each new audit worker caps its Node heap at 448 MiB and runs baseline/candidate children serially. Do not claim a result from a stale source hash.

Example POSIX commands from the repository root:

```sh
mkdir -p ../verification-temp
export TMPDIR="$(cd ../verification-temp && pwd)"
export NODE_OPTIONS=--max-old-space-size=448
npm run check
node --import tsx --test --test-concurrency=1 tests/desert-enrichment-inventory.test.ts tests/desert-enrichment-oracles.test.ts
node --import tsx --test --test-concurrency=1 tests/desert-enrichment-geometry.test.ts
node --import tsx --test --test-concurrency=1 tests/desert-enrichment-camera.test.ts
node --import tsx --test --test-concurrency=1 tests/desert-*.test.ts
```

Optional `DESERT_ENRICHMENT_AUDIT_DIR` persists detailed new-worker reports. `DESERT_AUDIT_DIR` sets the original independent audit's report directory. Its source hashes and status distinguish a fresh run from historical evidence.

## Evidence limits

Passing source geometry and CPU camera tests is not native gameplay-pixel, GPU-memory, FPS, packaging or deployment certification. Fixed Blender comparisons use actual emitted geometry, but their renderer differs from PlayCanvas. A 2026-10-11T13:21:02.730Z all 24 native-source audit is historical baseline evidence only; its matching hashes do not establish that a later candidate passes. Final-current-source run results and reviewed preview provenance must be checked separately.

No Windows packaging, main/stable workflow change or remote publication is included in this local pass.

## Retained local source-safety result

For source SHA-256 `aa2ad6819309066caa4a7acd74f3df55a037358c9c9f3c551a0d0bcbf5ccf713`:

- Typecheck passed
- 116 distinct source-safety tests passed: 107 original Desert tests, 8 enrichment geometry/inventory/oracle tests, and 1 added camera-matrix test
- The original independent audit passed all 24 checks in 165.128 seconds with stable before/after source hashes
- Original camera coverage remained 100188 course poses, 54720 dense-arch poses, both desired/interpolated booms, 46656 transition frames and 1296 pickup rays, with zero failures
- The additional matrix passed 2970 static poses, 8190 moving frames and 22365 inspections. All baseline poses were replayed or numerically identical; there were zero changed camera poses and zero inherited or new witnesses
- Final source counts are 118490 triangles, 154180 vertices and 22 batches. All 5248 original components are exact; 147 new solids add 11266 triangles
- New geometry has 5 complete terrain-contact surfaces, 214 named structural contacts, 2 open-bay passage witnesses and a 4.48 m-deep actual amphora opening. No unrelated positive-volume intrusion or exposed duplicate outward skin remains

This retained source-safety subtotal excludes the later final catalog and consumer stage below. A repeated test is not counted as another distinct test.

## Final catalog and shared-consumer result

The final scoped local result is **132 distinct tests passed, zero failures**:

- 119 Desert tests: the retained 116 source-safety tests, two additional final revision/catalog contracts, and the regenerated native preview-asset test
- 13 focused shared-consumer tests: Mountain 3, Town 1, Quarry 1, Forest 2, Workshop 2 and Harvest 4
- The final 18-test preview/inventory/consumer command repeated three existing Desert inventory tests. Those repetitions are not additional distinct tests
- Final typecheck passed. The Town command selected only its original source/route/road/bridge/terrain/texture/budget protection contract; it was not a rerun of the complete Town suite

The immutable 709-file original inventory remains unchanged. Exactly 18 existing files have explicit previous/current hash receipts: the Desert source, three cap-only native tests, current catalog provenance and poster, six inherited consumer files and six revision/consumer fixtures. All earlier scene revisions, historical nested goldens, other scene sources, shared gameplay inputs and original exporter/importer bytes remain exact. The complete paths and hashes are in `tests/fixtures/desert-enrichment-protected.json` under `reviewedChanges`.

The final catalog has the original five camera transforms. The full enrichment provenance has 18 selected 48-sample views; the additional 17 frozen cameras are retained in the model but are not claimed as final pixel evidence. Both reopened model receipts and all 36 paired image hashes were checked against the actual retained bytes, together with equality of paired cameras, generator hashes, render settings and lighting. This is offline CPU source-geometry evidence, not PlayCanvas GPU or FPS certification.

Final identities:

- Source: `aa2ad6819309066caa4a7acd74f3df55a037358c9c9f3c551a0d0bcbf5ccf713`
- Five-view catalog provenance: `5f49439ca583d7178934f9ed2e5817a7c95a43bc549fe03ad87d65f3bd6a53fc`
- Eighteen-view enrichment provenance: `03343b250a92980482fdf2be413664b522c0e8cae7050a44806cd53abc6dee75`
- Menu poster: `7090ee77080edabec9683585c7f314d894b2bbb3d6dfda73bb0b5af5a008b675`

The final focused consumer commands, using the same serial disk-backed temporary directory and 448 MiB heap, were:

```sh
npm run check
node --import tsx --test --test-concurrency=1 \
  tests/desert-preview-assets.test.ts \
  tests/desert-enrichment-inventory.test.ts \
  tests/mountain-enrichment-contract.test.ts \
  tests/quarry-enrichment-inventory.test.ts \
  tests/forest-enrichment-inventory.test.ts \
  tests/workshop-enrichment-inventory.test.ts \
  tests/harvest-enrichment-inventory.test.ts
node --import tsx --test --test-concurrency=1 \
  --test-name-pattern='^Town exact original source route road bridge terrain texture protection and fixed budget$' \
  tests/helpers/town-enrichment-geometry-worker.ts
```

The retained original Desert run selected every original `tests/desert-*.test.ts` file except `desert-preview-assets.test.ts` and the new `desert-enrichment-*` files. The final preview was then tested against the settled artifacts. Source stayed identical throughout, so the long geometry/camera matrices did not need another run after consumer-only binding.

Repository integration, production build/package reproduction and full exact-head CI are separate later stages. No all-map native rerun or remote publication is claimed by this audit.
