# Uniform game interface scaling

All game menus, the garage and both race interfaces use a **1440 × 900** logical
composition. `ui-layout.ts` computes `min(viewportWidth / 1440,
viewportHeight / 900)` and centers that composition. A single CSS transform scales
text, controls, spacing and embedded previews equally. Different aspect ratios
leave extra background around the interface rather than rearranging controls.

- Menu: home, map library, characters, vehicle, race setup, settings and exit
- Garage: the approved workshop grid and its native top-layer dialogs
- Both maps: download/preparation/retry, driving HUD, minimap, settings, pause and
  full results/restart/navigation

Long help/settings, expanded download details and unusually long results can
scroll inside their logical panels. Physical viewport media queries no longer
change UI composition; coarse-pointer controls and reduced-motion preferences
remain supported. Mobile portrait displays retain every control and show a
physical-size landscape suggestion in unused letterbox space. A small viewport
necessarily produces smaller controls; landscape desktop/tablet remains the
recommended play mode.

## Rendering and input boundaries

The racing WebGL canvas and vignette remain outside the transformed HTML root.
PlayCanvas uses the actual viewport and camera aspect, with no non-uniform world
stretching. Physics, steering, keyboard, pointer lock and camera movement do not
use UI-scale coordinates. Embedded menu/garage previews measure displayed bounds
for render-target resolution while retaining logical CSS dimensions; preview
rotation converts physical pointer deltas back to design-space deltas.

The minimap retains its canvas aspect. Native garage dialogs explicitly use the
same scale because the browser top layer does not inherit the root transform.
Visual-viewport resize/scroll, orientation and normal window resize update the
same layout controller; disposal removes listeners and restores previous state.
Boot/recovery UI also fits before the heavy module graph is available.

## Validation boundaries

Unit geometry covers 1280×720, 1366×768, 1920×1080, 1180×757, ultrawide 2560×1080,
4:3 1024×768, high DPI-sized windows and portrait. DOM lifecycle tests cover shared
mount/dispose, visual viewport changes, duplicate mounts and restored navigation.
These deterministic checks are separate from browser pixels and real GPU driving.
The current cloud browser cannot create WebGL2; it can verify live HTML geometry,
buttons, navigation, fallback/retry and screenshots, but cannot certify GPU race
rendering or native-device performance. Its viewport-resize API is unavailable,
so multi-resolution arithmetic is not presented as multi-resolution screenshots.
