# Home cover integration into dev

The accepted cover feature was integrated into the actual game menu on top of dev `ac420bf12513c973fce532cbe1c1d3d6d7734df7`, without replacing gameplay, music, Timewish bootstrap, entry HTML, package configuration, or deployment workflows.

- One weighted selection per document: whale 35%; five other approved portraits share 65%. SPA menu returns retain the selection and do not alter the chosen race driver.
- All six use the existing PlayCanvas custom local mesh adapter. Whale blink period is 4 seconds. The other five retain the accepted 1.5× final amplitude and individually configured short blink poses.
- Static fallback, reduced motion, visibility suspension, cancellation, context-loss fallback and disposal remain active. A missing selected portrait retries the original whale once before hiding a broken fallback.
- The original uniform title-stage scale is retained, including the accepted 1.65 portrait framing and non-cropped side silhouettes.
- Selected-image readiness is bounded and only signals the existing intro controller; it does not alter its A/B/C timing or restart the intro.
- Generated eyelid images are sampled only within registered eye patches. See `cover-blink-asset-provenance.md` and `home-cover-assets.json`.

GPU animation appearance cannot be verified by the cloud browser; the prior feature preview was accepted on the user's device. Integration tests verify lifecycle and entry wiring, not a new GPU visual result.
