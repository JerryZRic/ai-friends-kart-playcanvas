# Visible item pickups

The 45 course pickups have a translucent pale-blue shell, a luminous frame and an original 3D model inside. Boost uses a finned orange capsule, shield a cyan shield, pulse a magenta orbital model, and mystery a dimensional gold question mark. An explicit model always grants that item. Each spawn independently has a 25% chance of being mystery; the other 75% is divided uniformly between boost, shield and pulse. Mystery resolves uniformly to one of those three items on pickup.

Pickup is a synchronous single-claim operation: it disables the entire parent entity immediately (shell, frame and model), before awarding the inventory item. A full inventory leaves a pickup untouched. Cooldown is eight seconds of running race time; pause, countdown and menus do not advance it. Respawn rolls a fresh display once. Restart resets and rerolls all pickups. This release preserves the prior player-only item rules; NPC inventory and tactical item use are a separate update.

`src/item-models.ts` is the original editable model source. World meshes and HUD images use the same authored triangles. The HUD image is a shaded, orthographic CPU projection of that geometry, encoded as SVG, not a separately drawn symbol or an engine screenshot. The image is cached and changes with inventory; using an item clears it. The text label remains for accessibility.

The transparent shell uses PlayCanvas StandardMaterial, normal alpha blending, back-face culling and no depth writing. Contents are opaque, so they render before the shell. No custom item shaders or remote assets are required. Geometry/materials are shared per graphics device and every box enables only its chosen model.

Tests cover native engine scene integration, immediate visibility changes, occupied inventory, repeat claims, reward parity, mystery distribution, respawn, paused cooldown, restart and HUD lifecycle. NullGraphicsDevice validates structure and logic but does not render GPU pixels. Actual browser/WebGL appearance needs a WebGL-capable browser for visual QA.

All item model definitions and generated HUD projections are original project work under AGPL-3.0-only. The six existing Tripo character assets retain their separate terms; their files and licensing are unchanged.
