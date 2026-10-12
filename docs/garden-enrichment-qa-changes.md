# Garden010 scoped QA changes

Immutable baseline: 36a4e224e915f2481513c805a9ed4f6445199d6d. The unchanged original scenery, provenance and all thirteen original Garden test files are retained in `docs/scene-baselines/garden-original/`. Original full indexed arrays, computed normals, UVs, materials, component records, terrain metadata and blocker prefixes are independently frozen in `tests/fixtures/garden-enrichment-original-geometry.json`.

Approved current-scene budget: strictly below 120,000 triangles, at most 10,000 added, exactly 21 batches; no original triangle removed or changed. This changes four numeric current-total cap sites: production scenery and Garden scene, independent-audit, and preview-assets tests. The snapshots retain the old strict 110,000 total; the immutable baseline actually contains 108,557 triangles and 117,223 vertices. All non-budget assertions remain.

Native blocker compatibility is a separately approved transformation. The old test categorized all unnamed components as original miscellaneous source. New geometry has separate appended opaque blockers so the old category would incorrectly absorb new triangles. Before classification the helper certifies every complete original component record, ordered range, batch material and indexed original position/index/UV prefix. All original categories use that certified complete original set. New categories use independently frozen assembly recipes and actual appended indexed faces. Every blocker retains the existing exact face count and range assertion; the helper additionally checks exact ordered triangles and exactly-once ownership for every added component. No original safety loop is removed or filtered, and all live blockers still participate in native collision checks.

These are CPU emitted-source and NullGraphicsDevice checks, not native rendered pixels, GPU, frame-rate or performance certification.

Multi-material leaves are physical shells formed by the union of their exact indexed upper, lower and edge patches. Position welding uses the existing oracle's 1e-7-metre coordinate quantization. The union must have exactly two opposite-directed uses of every welded edge, one connected shell, positive signed volume, no degenerate faces and no actual self-crossing. No convex proxy replaces a leaf. Exact component records and indexed ranges remain separately owned and checked once. Mutation controls remove or reverse a complete material patch and must break closure. Support and unrelated positive-volume overlap are checked separately from grouping, including against the original multi-material botanical shells.

A further explicit compatibility transformation certifies all 118 original assembly records, their order and original material-patch ownership against the immutable prefix digest before checking the historical 78 hero / 40 ordinary shell counts. The original audit still runs every closure, winding, connectivity, thickness and size assertion over all 194 current assemblies, including all 76 additions. Exact source reconstruction guards this edit; mutation controls omit, reorder, rename and reassign original assembly records. The first five retained suites are counted once when resuming after the original count-classification failure.

## Reproducing the checks

Install the locked repository dependencies, create a disk-backed `../verification-temp` directory, and set `TMPDIR` to its absolute path. Keep the following processes serial and use a 448 MiB Node heap:

- `node --max-old-space-size=448 --import tsx tests/helpers/run-garden-retained-audit.ts` runs all thirteen retained Garden suites against the final catalog
- `node --max-old-space-size=448 --import tsx --test --test-concurrency=1 tests/garden-enrichment-camera.test.ts` rebuilds original archives first, then compares candidate outputs against the immutable fixture; it never updates expected camera output
- `node --max-old-space-size=448 --import tsx tests/helpers/run-garden-final-audit.ts` runs the additive geometry/oracle/inventory checks and every affected inherited consumer
- `npm run check` checks the final TypeScript source

The final portable manifest explicitly lists the retained runners, fifteen historical source/test/provenance snapshots, frozen geometry and camera fixtures, all current QA helpers, and the actual art generators/verifiers. The independently pinned Garden review overlay accepts only individually enumerated paths and exact incoming historical hashes. All older fixture records and prior portable manifests remain byte-identical; their nested golden assertions still execute. Original-array mutations, missing new opaque faces, missing or reversed material patches, incomplete terrain/roof support, false apertures, unrelated volume intersections and exposed coincident skins are negative controls.

The exact camera comparison streams and the original native matrix are reported separately. Streaming rows pair six binary64 coordinates and preserve signed zero; they must not be added to the retained suite's desired/interpolated pose totals or presented as extra tests. Diagnostic repair attempts and reruns are excluded from the final distinct pass count.
