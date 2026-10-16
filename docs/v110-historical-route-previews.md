# v1.1.0 historical route previews

The retained menu thumbnails are **historical offline renders**. Their image bytes, original source hashes, renderer hashes, view records and provenance JSON have not been regenerated or rebased for v1.1.0. Wording such as `current-candidate` inside an archived provenance record describes the candidate at the time of that render.

The latest cosmetic scenery polish is not pictured in these thumbnails. In particular, the Coast card predates the new lighthouse, cabanas, marina and other coastal details. The cards remain route/layout guides, not screenshots of the latest runtime appearance. Blender shading and lighting differ from PlayCanvas; these files are not gameplay/GPU captures or performance evidence.

## What the current compatibility tests verify

- Exact archived source bytes are reconstructed through the reviewed inverse transition chain and compared with the unchanged historical source hashes. Original image hashes, dimensions, file signatures, renderer identities and historical render budgets remain checked
- A complete verified historical source graph is built in a temporary directory, with no copied image assets or production source edits
- Bounded CPU-only workers independently build current and historical scenes. They compare authored route samples at 1.5 metre spacing, widths and tangents, route knots/checkpoints, emitted road surfaces, original landmarks/prop placements, structures and sightlines where recorded
- The workers project the actual current road/branch points through the frozen orthographic camera poses. The resulting bounds must match the historical view record within 0.000002 normalized screen units and retain the original safe margins. Original landmark anchor projections must also match their historical counterparts
- Coast and Waterpark check their actual world-space road and original landmark mesh vertices/indices. Their archived 68-degree overview fit is recalculated from the original fit-anchor selection. Coast's original exporter fit road edges only; its original island, elevated-pier and palm geometry is independently checked. Newly added cosmetic batches are not represented as historical image contents

This is a source/layout compatibility proof. It does not assert that new cosmetic geometry, materials, lighting, occlusion or every decorative detail appears in a historical image. Current gameplay, scenery safety and performance remain separate release checks.
