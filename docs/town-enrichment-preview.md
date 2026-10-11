# Reproduce the Town scene previews

These are offline source-geometry renders, not browser/gameplay captures or GPU/FPS evidence. The scene geometry comes from `buildTownSceneGeometry(TOWN_COURSE)` and the four existing project textures. glTF PBR and Blender lighting/material response differ from PlayCanvas.

## Export and render

Use the project dependencies, Blender 4.3.2 and Pillow. The renderer verifies the frozen daylight, exposure, render settings and camera transforms instead of refitting cameras to changed scenery.

```sh
mkdir -p artifacts/town-enriched
NODE_OPTIONS=--max-old-space-size=448 node --import tsx scripts/export-town-preview.ts artifacts/town-enriched
blender -b -t 2 --python-exit-code 1 --python scripts/render-town-enrichment-preview.py -- artifacts/town-enriched
blender -b artifacts/town-enriched/town-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-town-enrichment-model.py -- artifacts/town-enriched
```

The default renders sixteen paired baseline views and two additional legacy catalog images (topdown and bridge). `docs/town-enrichment-cameras.json` contains all 125 original frozen review poses plus the original pre-enrichment topdown and bridge poses. Both branch road ribbons remain actual independent source meshes.

- `--views name,name` renders a selected subset
- `--resume` skips only images whose stored hashes match identical source, generator and camera-manifest inputs
- `--manifest FILE` chooses an explicitly supplied compatible camera manifest
- `--baseline` renders only the hash-pinned archived geometry using its preserved original Town source snapshot; it cannot update catalog assets
- `--update-catalog` requires the complete default view set, then writes the catalog exports and initial provenance. Release packaging runs `python3 scripts/finalize-town-catalog.py CANDIDATE_OUTPUT CORRECTED_BASELINE_OUTPUT` after reopening both models with the verifier. This keeps the overview runtime poster, excludes the unused topdown WebP, retains the reusable topdown PNG, and records matched corrected baseline/candidate evidence without changing the actual render records.

For a partial run, do not claim a complete final comparison. Never replace the immutable camera poses with auto-fit views to conceal an obstruction.

## Reusable outputs

- `town-geometry.json`: exact indexed runtime source meshes, normals, UVs, material values, texture pixels, routes and source hashes
- `town-original-scene.glb`: static meshes at float32 GPU precision, original indices/normals/UVs and embedded original texture PNGs
- `town-original-scene.blend`: editable original mesh batches, packed textures, fixed offline daylight and all 127 named cameras, opening on the reviewed overview
- `town-render-record.json` and `town-preview-provenance.json`: exact source/generator/manifest/model/image hashes, actual render/light settings and camera transforms
- Eighteen PNG views, including the full sixteen-camera comparison set

The exporter asserts stable source inputs. The renderer checks input source hashes, exact frozen transforms and settings, catalog route framing and source stability after each image. The manifest and scripts contain no private reference images, Library identifiers or workspace paths.

## Corrected source-normal shading

The historical native Blender custom-normal encoder has an ellipsoid-pole discrepancy that also affects adjacent positive-area citrus/fruit faces. Historical images and inputs are preserved separately. The enrichment renderer bypasses that encoding: an exact float32 source-normal POINT attribute is transformed from OBJECT to WORLD as a NORMAL, normalized, multiplied by `(1 - 2 * Backfacing)`, and connected to the Principled normal input. This follows the existing Harvest/Mountain exporter correction and the runtime's double-sided lighting setting.

Both archived-baseline and current-candidate comparison images must use this same corrected shader, with unchanged frozen cameras, light, exposure and source geometry. The baseline keeps its original source hashes; it is never relabeled as current geometry. Packed model validation checks exact source normal attributes and the actual shader links after reopening the saved file. The render remains an offline approximation of PlayCanvas lighting/material response, not runtime visual or performance certification.

## Comparison sheets

After both matched sets finish, run `python3 scripts/compose-town-comparison.py CORRECTED_BASELINE_OUTPUT CORRECTED_CANDIDATE_OUTPUT`. This verifies identical shaders/settings/poses and produces four labeled PNG sheets below 10 MiB each while preserving the individual images.
