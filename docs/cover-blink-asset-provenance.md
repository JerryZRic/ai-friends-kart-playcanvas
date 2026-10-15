# Portrait eyelid texture provenance

Date: 2026-10-15

The five `public/menu-art/{gemini,gpt,claude,grok,glm}-eyes-closed.png` textures are closed-eye derivatives of the corresponding user-approved character portraits, whose production originals remain `public/menu-art/{gemini,gpt,claude,grok,glm}-cover-v1.webp`.

Method: the built-in image generation/editing tool was given each corresponding approved source portrait and instructed to close the eyes while retaining its canvas, face, pose and composition. Each derivative is 1024 × 1536 pixels. Generated content outside the eye regions is not used in the animation: the approved original remains the base layer, and only the two registered, softly edged eye patches are sampled. The full generated portrait is never used as a replacement or full-image crossfade.

Registration and timing are recorded in `src/home-cover-rigs.ts`. Static original-versus-patch composites for all five characters were inspected for remaining pupils and obvious seams; fixed-face and adjacent-grid registration is covered by focused tests. Actual GPU-rendered animation was not visually verified in the cloud environment.

Rights: these are project-specific derivatives of the approved artwork. Existing rights and attribution requirements for the source artwork continue to apply. This record grants no new license, asserts no independently verified ownership, and does not change the repository's existing license or the artwork's existing rights status.
