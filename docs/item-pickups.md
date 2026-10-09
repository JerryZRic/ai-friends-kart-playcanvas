# Visible item pickups

Both circuits use the same translucent pale-blue shell, luminous frame and original 3D model inside. Coast retains 45 authored pickups; water retains 14. Boost uses a finned orange capsule, shield a cyan shield, pulse a magenta orbital model, and mystery a dimensional gold question mark. An explicit model always grants that item. Each spawn independently has a 25% chance of being mystery; the other 75% is divided uniformly between boost, shield and pulse. Mystery resolves uniformly to one of those three items on pickup.

Pickup is a synchronous single-claim operation: it disables the entire parent entity immediately (shell, frame and model), before awarding inventory. A full inventory leaves a pickup untouched. Swept collision awards the earliest arrival, including lap seams, rather than always preferring the player. All six characters use the same rules when driven by the player or AI. NPCs seek reachable boxes, wait after collecting them, and use items according to nearby traffic and corner conditions.

Authored pickups respawn after eight seconds of running race time and roll a fresh display once. Pause, countdown and menus do not advance pickup clocks. Restart resets the authored pickups and clears temporary pickups. Race finish and leaving the race remove temporary boxes.

## Temporary, rank-weighted opportunities

`src/dynamic-pickups.ts` owns a four-box reusable pool on each circuit. After a four-second opening delay, it considers one additional box every 3.8–5.0 seconds. These are opportunities, not guaranteed rewards: unsafe candidates are skipped. Among eligible racers, the last-place targeting weight is three times the first-place weight, increasing smoothly with actual standing. Player and NPC identities receive no special treatment; finished racers remain ahead in the ranking. Item strength and the mystery distribution do not change by rank.

Placement follows the sampled track's arc length and legal lanes. Lead distance covers a 1.4-second reaction window, attainable acceleration/boost speed, an eight-metre clearance and extra random lead. The complete approach arc is checked for tight bends and folded routes rather than projecting a point straight ahead in world space. This geometry check does not claim to raycast every scenic prop. Every racer blocks unsafe placement, including an overlapping leader on another lap, racers already holding an item, stopped racers and reverse traffic. Placement also checks nearby static and temporary boxes for density and overlap.

Boxes are spawned after the frame's existing pickup collisions, never retroactively inside that collision sweep. A target must be moving forward at least six metres per second and cover another 80 metres of fresh high-water progress before receiving another targeted opportunity. Stopping or reversing over the same section cannot repeatedly solicit boxes. A temporary box expires after 12 seconds of racing; collection or expiry starts an eight-second pool-slot cooldown. It never automatically respawns at its old position. Finish latches spawning off until reset. No background timers, extra mesh allocation per spawn, or rank-based speed changes are used.

## Models and verification

`src/item-models.ts` is the original editable model source. World meshes and HUD images use the same authored triangles. The HUD image is a shaded, orthographic CPU projection encoded as SVG, not a separately drawn symbol or an engine screenshot. The image is cached and changes with inventory; using an item clears it. Text labels remain for accessibility.

`src/pickup-visual.ts` shares glass/frame resources within each scene. Its PlayCanvas StandardMaterial shell uses normal alpha blending, back-face culling and no depth writing. Opaque contents render before the shell. Each box enables only its chosen model. Water routes the entire box to its main-camera-only layer, which receives the existing sunlight. Exposure and sun intensity are unchanged by this feature.

Tests cover native engine integration, immediate visibility changes, occupied inventory, repeat claims, rewards, mystery distribution, reaction clearance, rank weighting, curved paths, lifecycle, reset and HUD behavior. NullGraphicsDevice validates structure and logic but does not render GPU pixels. Actual browser/WebGL appearance needs a WebGL-capable browser for visual QA.

All item model definitions and generated HUD projections are original project work under AGPL-3.0-only. The six existing Tripo character assets retain their separate terms; their files and licensing are unchanged.
