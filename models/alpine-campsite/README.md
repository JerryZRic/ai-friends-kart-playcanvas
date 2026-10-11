# Selected original Alpine Campsite props

This folder contains only the original full-detail ridge picnic table and ranger relief-map station selected for the existing Mountain001 lookout. The source set is **Alpine Campsite 1.0**, authored with Blender 4.3.2. See [the provenance notice](../../ALPINE-PROP-NOTICE.txt); the original package did not state a standalone license, and its provenance statement is not a blanket ownership guarantee.

## What is retained

- `glb/04_ridge_picnic_table.glb`: exact original full-detail GLB, 4,152 triangles, 6 material primitives
- `glb/12_ranger_relief_map_station.glb`: exact original full-detail GLB, 2,000 triangles, 9 material primitives
- `selected-manifest.json`: source descriptions, source hashes, original material identities, provenance and source dimensions
- `source/generate-selected.py`: editable procedural source containing the selected original geometry expressions and helpers only

The original collection's other props, complete collection scene and presentation renders are not included. The selected GLBs are self-contained, opaque, static and texture-free. Their coordinates use metres, Y-up, front toward +Z, and identity node transforms. The original authoring source uses Blender Z-up, front toward -Y. `dimensions_blender_xyz_m` in the manifest deliberately retains that original axis order; runtime data stores actual Y-up bounds.

## Reproduce the runtime data

From the repository root:

```sh
node --max-old-space-size=384 scripts/convert-alpine-props.mjs
node --max-old-space-size=384 scripts/convert-alpine-props.mjs --check
node --max-old-space-size=384 --import tsx --test --test-concurrency=1 tests/alpine-props.test.ts
```

The converter verifies the source hashes and supported GLB subset, then copies the original float32 positions, indices, winding and UV0 without rounding, welding, simplification or deformation. It also records original material PBR values and a checksum of each primitive's source normals. The exact original normals remain in the source GLBs. The common runtime and preview path intentionally recalculates normals from the same topology; this is an explicit shading adaptation.

`src/alpine-props.ts` exports immutable-by-contract local source geometry. The Mountain scene builder applies explicit unit-scale yaw/translation and owns all shared batching, primitive/component provenance, full-footprint terrain reservations, grounding and exact-triangle camera obstacles. This module neither loads GLBs at runtime nor creates a second exporter, collision or camera path.

The full projected convex hull includes the table's benches and the station's canopy. `groundContacts` contains actual source vertices within 1 micrometre of the global minimum Y. `supportBand` separately records vertices within 5 cm of that minimum, which may include slightly higher secondary feet. The support band is not a claim that every point touches the ground; any deliberate foundation embed belongs in scene-placement provenance.

## Edit the authored props

Copy this folder to a working location before running Blender, so the verified original GLBs are not overwritten accidentally. With Blender 4.3.2:

```sh
blender -b -t 1 --python source/generate-selected.py
```

This reproduces the two procedural models, exports them individually and saves an editable `source/alpine-selected.blend`. Both props retain their original local origin and overlap in the editing scene; hide one to inspect the other. Rendering, LOD generation and collection layout are omitted. Blender/exporter versions may change GLB byte serialization; modified exports require a deliberate source-hash/geometry review before updating the manifest and derived data. Byte-for-byte runtime conversion is reproducible from the committed originals without Blender.

For a read-only check against the committed originals, use an already-installed Blender and a **new directory outside the checkout**, whose parent already exists:

```sh
node --max-old-space-size=384 scripts/verify-alpine-source.mjs /path/to/new-reproduction-directory
```

Set `BLENDER_BIN` only if the installed Blender is not on PATH. This command copies the selected authoring script to the new directory, runs Blender with one thread and no rendering, retains the new GLBs/editable scene/logs, and writes `authoring-reproduction-report.json`. It never overwrites the committed originals. A pass requires exact positions, UVs, normals, material definitions and indexed triangle connectivity/winding for every primitive. Triangle enumeration or cyclic corner start may differ and are explicitly reported, while reversed winding, changed connectivity or coordinate drift are rejected without a tolerance. File/container and exporter document differences are reported separately.

The selected source was validated with installed Blender 4.3.2 and glTF exporter 4.3.47. Both props reproduced exact positions, UVs, normals, materials and indexed oriented topology. One repeated export changed only the enumeration of the relief map's `Alpine_water` primitive (252 triangles); its same indexed triangles, winding and multiplicity were verified over identical vertex/attribute arrays. Another export matched the complete original index arrays as well. Automatically assigned internal mesh names differ because the unselected objects are no longer authored. The original committed GLBs and byte-exact converter output remain unchanged.

## Deliberate shared-material adaptation

No new runtime material is created. Each original primitive keeps its own source identity/ranges while being appended to an existing Mountain batch:

| Original material | Mountain family | Adaptation |
| --- | --- | --- |
| Alpine_cedar | wood | Shared cedar color, roughness and procedural wood texture |
| Alpine_bark | bark | Shared dark timber color, roughness and wood texture |
| Alpine_slate | stone | Shared granite color, roughness and stone texture |
| Alpine_charcoal | darkStone | Shared blue-gray dark stone rather than source charcoal |
| Alpine_pine | pine | Shared dark spruce green |
| Alpine_cream | white | Shared light ivory |
| Alpine_sage | pineTips | Shared lighter green, distinct from pine |
| Alpine_water | darkStone | Tiny relief-map lake adapted to cool blue-gray stone |
| Alpine_coral | red | Shared muted warm coral/oxblood accent |
| Alpine_gold, Alpine_brass | yellow | Shared amber; source brass metallic response is not retained |

The full-detail 6,152-triangle pair is used once as a close-to-mid-distance lookout accent. Retaining the authored table legs, mugs and map silhouette avoids introducing an unreviewed simplification. This is a geometry/batch-count statement, not a claim of improved FPS or a measured LOD benefit.

## Separate Mountain mounting additions

The original authoring joins objects and exports them by material; it does not Boolean-union the station into one connected solid. In particular, the cream map board has a 2.5 mm authored depth gap from the bark backing, the lake has a 10.5 mm gap from the cream face, and the separately modeled snowcaps, trail/pins and pine emblems also include raised spacing. Sharing a material primitive is not evidence that its separate shapes physically touch.

The Mountain integration preserves every original local position, index, UV and unit scale. Both props receive separately modeled full-footprint stone pads and an explicit 3 cm bedding embed, seating the original low support geometry without deforming it. The station additionally receives nine small scene-authored mounting boxes behind the relief:

| Integration component | Count | Existing material family | Original source-primitive targets |
| --- | ---: | --- | --- |
| `selected-alpine-board-backing-stand-off` | 2 | bark | Cream board 3 to bark backing 2 |
| `selected-alpine-lake-relief-boss` | 1 | darkStone | Water lake 5 to cream board 3 |
| `selected-alpine-snowcap-relief-boss` | 3 | white | Cream snowcaps 3 to sage peaks 4 |
| `selected-alpine-trail-pin-backing` | 1 | yellow | Gold pin 7 to cream board 3 |
| `selected-alpine-pine-emblem-backing` | 2 | pine | Pine emblems 8 to cream board 3 |

These mounts add 108 triangles in existing batches, independently of the original pair's 6,152 triangles. Sage peaks retain their original overlap with the cream board; the coral trail retains its original connection to the gold pin. The exact mount dimensions, source-local placement and separate component/contact records live in `src/mountain-scenery.ts`, under `reusedProps.integrationSupports`. Their emitted geometry also follows the shared camera/export path. No original GLB or generated local prop data is modified.

The integration's focused geometry checks examine the nine station mounts and twenty identified original relief shells for actual contact paths and visible faces. This bounded check is not a universal structural-load certificate for every original subpart and does not establish GPU appearance or frame rate.

### Picnic cloth contact-edge bindings

The original table's central cedar tabletop plank and the two coral cloth folded ends share narrow exposed side strips at local X approximately `-.13`, Y `.8180154–.8750154`, and Z near `±.9`. Each strip is approximately 57 mm high by 1 mm wide. Their eight clipped triangle-pair witnesses partition the two strips, measuring approximately `1.139917e-4 m²` combined (1.14 cm²), rather than eight separate whole-area defects.

Two new closed `selected-alpine-picnic-coral-edge-binding` pieces cover those contact edges. Each is 8 × 68 × 8 mm, centered at source-local `(-.131,.8465154,±.9)`, and meets original coral primitive 3 and cedar primitive 1. These 24 new triangles use the existing red material family. They remain separately recorded, visibly rendered trim with whole-polygon burial, actual-contact and first-hit visibility checks; the original mesh positions, index order and UVs are unchanged.

Across both props, the integration now adds eleven mounting/trim boxes totaling 132 triangles: nine station mounts / 108 triangles and two picnic bindings / 24 triangles. These counts exclude the separately modeled stone pads and remain distinct from the original pair's 6,152 triangles. The selected Blender generator reproduces only the original props; the Mountain scene builder separately reproduces the derivative pads, mounts and bindings.
