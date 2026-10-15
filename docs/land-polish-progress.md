# Land visual polish progress

Implemented in this dev source checkpoint (October 14, 2026). A01 and stable
main/v1.0.0 remain unchanged. Pages publication is verified per build commit.

- 01 Coast: modeled detail and palette pass complete; +5,004 triangles, +8 material batches
- 06 Workshop: modeled detail and palette pass complete; +1,992 triangles, +0 material batches
- 02 Mountain: modeled detail and palette pass complete; +1,704 triangles, +0 material batches
- 03 Town: modeled detail and palette pass complete; +7,872 triangles, +0 material batches
- 05 Forest: modeled detail and palette pass complete; +5,536 triangles, +0 material batches
- 09 Snow: modeled detail and palette pass complete; +1,636 triangles, +0 material batches
- 07 Harvest: modeled detail and palette pass complete; +1,936 triangles, +0 material batches
- 10 Caldera: modeled detail and palette pass complete; +1,476 triangles, +1 material batches

- 04 Quarry: modeled detail and palette pass complete; +1,848 triangles, +0 material batches

- 08 Desert: modeled detail and palette pass complete; +2,840 triangles, +0 material batches

- 11 Garden: modeled detail and palette pass complete; +1,248 triangles, +0 material batches

- 12 Airfield: modeled detail and palette pass complete; +2,076 triangles, +0 material batches

All twelve land scenes now include this pass. Total additional geometry across
the twelve separately loaded scenes is 35,168 triangles. Ten maps retain their
material-batch count; Coast adds eight batches and Caldera one small batch.
These counts are engineering budgets, not measured runtime draw calls or FPS.

Final integrated TypeScript/build and 20 bounded polish sanity tests passed.
Map-specific native road/camera checks are recorded in the per-map notes.

Coast was playtested and its visual direction accepted. Each map retains its own
theme. Specific notes record additions, budgets and checks. Offline previews use
actual source meshes with approximate material/light, not game screenshots or
device-performance measurements. No full historical golden audit is claimed.
