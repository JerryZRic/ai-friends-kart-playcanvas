# 3D course overview cards

The map picker uses `public/map-previews/coast-overview.webp` and
`public/map-previews/waterpark-overview.webp`. Both are 1280 × 720 overhead 3D
renders generated from the same native PlayCanvas procedural scene meshes as
the menu and playable closed-loop courses. They are original project assets
under the repository's AGPL-3.0-only license.

These are **offline source-geometry renders, not browser/GPU gameplay
screenshots**. Blender Cycles CPU renders the actual exported mesh positions,
indices, normals and source base colors. Lighting, water shader appearance and
surface shading are approximate. The overview does not reproduce runtime fog,
water reflection/refraction, shader displacement, surface textures or animation.
No generated-image interpretation or substitute route drawing is used.

Each camera is elevated 68° above the ground and fitted to the complete route
edges, bridge, high landmarks and resort buildings with at least 6% image margin. The long axis of
the route is aligned across the 16:9 card without changing geometry. Atmospheric
sky spheres, the distant sun, distant mountains and clouds are omitted to keep
the complete course readable. All local scenery, terrain, route, banks, railings,
bridge and tower meshes remain. The menu's native simplified coastal palms are
used; character models are not part of these scenes.

## Regenerate after changing course geometry

From the repository root, with the project's npm dependencies, Blender 4.3+
and Pillow available in Blender's Python:

```sh
node --import tsx scripts/export-map-previews.ts /tmp/ai-friends-map-previews
blender --background --python scripts/render-map-previews.py -- /tmp/ai-friends-map-previews
node --import tsx --test tests/map-preview-assets.test.ts
```

The exporter uses PlayCanvas's real `NullGraphicsDevice` and constructs the
real menu worlds. Exported intermediate JSON/PNG files stay outside the source
tree. The renderer writes only the two WebP files and
`docs/map-preview-provenance.json`, which records source hashes, asset hashes,
triangle counts and tested framing bounds. Rendering refuses stale geometry if
the recorded source files change. These build-time tools are not runtime
dependencies and do not add a WebGL context or render loop to the cards.
