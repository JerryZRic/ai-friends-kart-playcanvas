# Food kart rider fitting verification

## Character rights

The character imagery in these references remains subject to [MODEL-NOTICE.txt](../../MODEL-NOTICE.txt), including the stated non-commercial restrictions. These renders do not grant AGPL rights to the six character designs, geometry or textures. The original food vehicles and game code are a separate rights category; their availability does not relicense character derivatives. No new redistribution or commercial-use clearance is claimed.

## What changes at runtime

- The six original driver GLBs, rig hierarchy, fitting transforms, textures and authored clips remain unchanged
- Each complete food kart still uses the original six modules in their shared coordinate system
- A measured cushion surface positions the driver's pelvis above the actual seat, rather than above the lower construction-reference marker
- The original food steering solids are separated from their material batches in instance-owned mesh buffers. Their original material/UV/geometry is retained; their runtime placement is tilted and raised to suit the seated driver
- The original food steering column is extended between its original chassis mounting point and the adapted wheel center
- An analytic, two-bone arm fit preserves upper-arm/forearm lengths, the sampled wrist orientation and authored finger curls. Actual handle cross-sections support the early pretzel, crescent and split-handle designs as well as later circular rims
- The four original food wheel pivots spin from signed race speed using their .435 m radius; only the front pivots steer, through ±18°
- Foot/leg poses remain authored. The high food seats use a stylized dangling-foot pose; pedal-contact IK is not implemented

## Automated evidence

Command: `node --import tsx --test tests/kart-driver.test.ts`

The test uses real public payloads reconstructed to their original SHA-256 and the actual PlayCanvas loader, animation and skinning systems. Only image pixel decoding is replaced with a one-pixel texture for `NullGraphicsDevice`.

- 54 food chassis × 6 original drivers × 5 steering poses = 1,620 measured poses
- Maximum grip trajectory deviation: 0.073285 mm
- Measured cushion surfaces: 0.735715–1.056817 m
- Every chassis triangle is retained in either static or adapted cockpit geometry
- Original borrowed position, normal, UV and index buffers remain byte-equivalent
- Upper-arm and forearm lengths remain unchanged through the sampled steering range
- Skin matrix palettes remain finite using the actual renderer's mesh-node transform convention
- Translated/rotated actor roots, pause, reset, independent rigs/material borrowing and sibling survival after disposal are covered
- All instance-owned vertex/index buffers are released on disposal
- Maximum instance-owned cockpit GPU buffer allocation: 1,039,216 bytes across 10 meshes. This is additional to cached original assets and is not a total-scene memory estimate
- Local imports with an otherwise valid generic animation contract but missing cockpit bones are rejected before replacing a working driver

These checks are CPU/contract evidence. They are not a browser render, frame-rate or mobile GPU claim.

## Offline visual references

The six `modular-driver-*-offline.png` images use the actual adapted PlayCanvas pose, baked from the same per-mesh skin matrices used by the renderer, and original embedded textures. Blender Cycles supplies the studio lighting. The captions explicitly identify these as offline references rather than browser screenshots.

The reference assembly is kit 054 at normalized steering +0.6; it exercises the highest measured cushion and the smaller circular steering wheel. The automated fit coverage includes every food chassis. Browser visual/performance QA must be reported separately.

- [WHALE offline reference](modular-driver-whale-offline.png)
- [GEMINI offline reference](modular-driver-gemini-offline.png)
- [GPT offline reference](modular-driver-gpt-offline.png)
- [CLAUDE offline reference](modular-driver-claude-offline.png)
- [GROK offline reference](modular-driver-grok-offline.png)
- [GLM offline reference](modular-driver-glm-offline.png)
