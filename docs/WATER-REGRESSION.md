# Ocean shader regression fix

The migrated water shader set `precision mediump float` in its fragment stage only. PlayCanvas 2.23.1 already injects the device precision into both stages. On highp devices, the extra declaration made the shared `time` uniform highp in the vertex shader and mediump in the fragment shader, including after PlayCanvas's WebGL2 shader processing.

GLSL ES 3.00 section 4.3.5 requires uniforms shared across stages to have matching precision. This invalid shader interface explains the missing water; the plane was not rotated onto the wrong axis or made transparent. Varying precision differences alone are permitted by section 4.3.10 and are not the diagnosed link defect. [Official GLSL ES specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf).

The fix removes the fragment-only precision overrides from the water and sky materials, letting PlayCanvas select a consistent device precision. Water geometry, color, wave motion, height, and course assets are unchanged.

## Regression evidence

- `tests/coast-rendering.test.ts` constructs the actual native PlayCanvas scene with a null graphics device and generates the real engine GLSL preambles. It checks the ocean's shared time precision on highp and mediump device configurations. The original code fails; the fix passes.
- The native mesh test checks all 17,161 vertices and 33,800 triangles, horizontal XZ orientation, upward winding, 2,100-unit width/depth, y=-1.8 position, enabled render component, double-sided culling, opaque/depth-writing material, and a water point inside the camera frustum.
- Independent inspection of the installed engine's WebGL2 preprocessing confirms the time precision mismatch remains in the original processed shaders and disappears with this fix.
- Typecheck, all 17 test entries, production build, and distribution/source integrity checks pass.

These checks establish the shader defect and its correction, not GPU rendering quality. The available cloud browser cannot create a WebGL context; no GPU link test, water screenshot, device performance, or full gameplay visual confirmation is claimed. A WebGL2-capable browser should verify animated sea around the island in menu, chase, rear, and orbit views.
