# Redstrata Quarry: bounded scene enrichment

This is a scenery and material pass on existing **Quarry003**. It adds no map or gameplay mode. The original dry quarry identity, five extraction sites, seven named industrial landmarks and both physical fork roads are retained. All artwork is original procedural project geometry; no reference assets were copied or downloaded.

## Composition

- The north, east and southern extraction sites form broader, unequal stepped backdrops. Battered ends, chamfered plan outlines and gently tilted bedding planes avoid a repeated tower silhouette
- The hopper, counterweight derrick and two-belt conveyor have low open service shelters. The derrick shelter sits farther outside the road to clear the existing chase-camera corridor as well as the nearby rock. All roofs, beams, open bays, stock and foundation caps have real source geometry
- A matching central sleeper repairs an inherited unsupported middle stone in every relocated three-stone workset; its top touches the stone and its bottom touches the pad
- Existing roadside worksets are regrouped into seven proposed loading pockets. Only complete road-clear, prop-clear and rock-clear placements are emitted
- The working floor is quiet, untextured soil; compacted haul road is darker; fresh cuts are pale; amber rock, deep seams, dark timber and limited safety orange remain distinct. Existing texture pixels are unchanged
- Geological side UVs are metre-based. No decorative coplanar surface, painted alternate road, imported building or new tower is used

## Static budget

The checked source has **20 batches, 167,849 vertices and 103,842 triangles**. The archived baseline has 165,571 vertices and 102,692 triangles, so the bounded pass adds 2,278 vertices and 1,150 triangles (about 1.12%). It remains below the existing strict 200,000-vertex / 110,000-triangle limits. There are 23 emitted loading worksets, three open shelters and the original seven named machinery/crossing landmarks. Geometry counts are not frame-rate measurements.

## Preserved source

The baseline is published dev commit `3a0e97db08bc2c6036d6a8e7000e1c9437551337`, source tree `53751230de3c89645c15bd2c7ff358b4f39623da`. The public baseline scenery snapshot and preservation receipt are sufficient to regenerate the original source geometry with the unchanged source dependencies.

Tests hash-check exact road positions/indices/UVs, both road-face arrays, route samples, terrain positions/indices/UVs and heightfield payload, trestle members and camera support, primary landmark anchors, and procedural texture bytes. Shared camera mechanics, physics, AI, checkpoints, pickup layout and controls are unchanged. Main, stable publication files, workflows and Windows packaging are outside this pass.

Expanded convex footprints are checked against the complete road triangle union with a 5 m buffer. Every ground toe is below every covered emitted terrain triangle. All 22 upper terraces are supported by their lower cap, including battered edges and tilted bedding planes. Irregular geology uses actual source triangles as camera blockers; an open shed never receives a single solid blocking box.

## Reproduce offline source previews

Requires the locked Node dependencies, Blender 4.3.2 with Cycles CPU, and Pillow available to Blender Python. From the repository root:

```sh
npm ci
node scripts/export-quarry-baseline.mjs OUTPUT_BASELINE
node --max-old-space-size=448 --import tsx scripts/export-quarry-preview.ts OUTPUT_CANDIDATE
blender -b -t 2 --python-exit-code 1 --python scripts/render-quarry-enrichment-preview.py -- OUTPUT_BASELINE --baseline
blender -b -t 2 --python-exit-code 1 --python scripts/render-quarry-enrichment-preview.py -- OUTPUT_CANDIDATE --update-catalog
blender -b OUTPUT_BASELINE/quarry-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-quarry-enrichment-model.py -- OUTPUT_BASELINE
blender -b OUTPUT_CANDIDATE/quarry-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-quarry-enrichment-model.py -- OUTPUT_CANDIDATE
python3 scripts/compose-quarry-comparison.py OUTPUT_BASELINE OUTPUT_CANDIDATE OUTPUT_COMPARISONS
```

Use output directories outside the repository's `src`, `docs`, `scripts`, `tests`, `models` and `public` source folders. The renderer accepts `--views comma,separated,names` for a subset and `--resume` only when source, generator, camera and image hashes are identical. Catalog update requires the complete set.

Six forward eye-level poses are sampled from the original road at 2.1 m eye height and 35 m look-ahead. Five original catalog poses are retained exactly, including overview and top-down. Neither baseline nor candidate cameras are refitted to the new scenery. The fixed overview keeps both roads and machinery framed; enlarged distant cut-wall ends may be cropped at the image edges. The same lighting, exposure, normal shader, samples and resolutions apply to both. Historical pre-correction images are preserved separately and are not substituted for paired comparisons.

The editable BLEND preserves exact float32 source positions, normal POINT attributes, indices and UVs. Its explicit shader transforms each source normal from OBJECT to WORLD as a NORMAL, normalizes it, and applies the two-sided sign before shading. Original texture pixels are packed. The companion GLB includes exact float32 source streams and embedded original texture PNGs. A reopened-model verification checks these data, shader sockets, frozen cameras and packed pixels.

## Bounded camera audit

`quarry-enrichment-camera-audit.json` records the finite CPU audit. Actual
candidate safe, interpolated and moving camera paths, plus the six fixed
forward review poses, have no new failures. Broad archived-orbit replay is
reported separately as a diagnostic rather than requiring the camera to
ignore new scenery. The runtime camera algorithm itself is unchanged.

The audit retains 750 original triangle/path witnesses below its conservative
0.30 m margin: 742 exact matches and eight strictly proved collinear shortened
subsegments against the same unchanged rail faces, with no worse clearance.
These are not 750 distinct camera poses. The minimum retained gap is
0.144608750 m; there are zero actual triangle intersections or below-terrain
cases. This finite coverage is not a claim of unrestricted continuous-orbit
clearance or device performance.

## Limits

These are offline source-geometry renders, without a driver, vehicle or HUD. Blender lighting, color management, textures and PBR response approximate the PlayCanvas scene. They are not gameplay screenshots, GPU captures, FPS measurements, or proof of device performance. Runtime browser and controller validation remain separate from source tests and offline model verification.
