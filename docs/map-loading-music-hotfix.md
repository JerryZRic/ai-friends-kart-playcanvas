# Map loading diagnostics and menu music handoff (2026-10-13)

Baseline: dev `f66ab221e944f161a7d45a15706303bf5df05395`, tree
`dda6d1a284a0ac856eba93b97e803c2f224430e1`.

Reports: maps 08 (desert) and 09 (snow) fail near the end of race loading;
music pauses when navigating between menu and garage.

## Changes

- Preserve the actual course import/initialization error on the visible loading
  screen instead of describing all errors as download failures.
- Expose the failing preparation stage and model error, including driver-load
  failures previously hidden in the legacy loading details.
- Shorten menu/garage navigation fade from 500 to 120 ms. Race entry stays 500 ms.
- Retain the menu seek handoff until metadata is usable; an early departure no
  longer overwrites the saved position with zero.
- Start garage theme playback through a lightweight entry before dynamically
  importing the PlayCanvas garage; preload only the theme on this entry.

## Verification and limits

- TypeScript and Vite production build pass.
- Audio controller tests: 24/24 pass, including delayed metadata and early unload.
- Desert and snow targeted gameplay tests: 4/4 pass, including six racers and
  assembled karts reaching ready state and injected course-load recovery.
- Snow source and compiled builder both emit 23 batches, 114800 triangles and
  172192 vertices successfully. Its preview file is present.
- Garage build emits a lightweight entry and separate dynamic garage chunk.

The reported browser map failure was not reproduced. These checks use a CPU
NullGraphicsDevice and mocked image decoding and do not prove WebGL, device
memory, deployment-network behavior, or audible seamlessness. The loading
changes are diagnostic, not a claim that the map failure is fixed. Full geometry
certification was not run; historical audit records remain unchanged.
