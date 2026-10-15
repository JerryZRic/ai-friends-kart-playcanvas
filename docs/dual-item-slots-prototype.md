# E/R fixed-slot prototype

This dev prototype gives every browser racer (player and NPC, land and water) two fixed slots using the existing boost, shield and pulse items. Character parameters and the default NPC pickup-routing planner are unchanged.

- Pickups fill empty E first, then R. Items never shift between slots and duplicates do not upgrade.
- A full inventory rejects a box without consuming it or its mystery-item RNG draw. Existing swept pickup arbitration remains atomic.
- E and R use their corresponding slots. Mobile exposes matching independent icon buttons. Empty/disabled slots cannot pre-arm a future pickup.
- Input edges are collected until the next accepted simulation tick. E wins simultaneous requests, at most one successful use occurs, and the remainder is discarded rather than queued. Keyboard holds/repeats cannot repeatedly use items.
- Pause, blur, visibility interruption, reset and disposal clear pending requests. Pausing preserves inventory; starting/resetting and finishing clear it.
- NPCs evaluate each slot with existing per-item use conditions, E first, sharing existing reaction/cooldown rules. Water NPCs retain their warning delay and the selected slot. One empty slot permits box targeting; two full slots do not.

## Evidence boundary

Targeted transaction, input, HUD, water and CPU compatibility tests and a TypeScript check passed. The Vite source build passed against dev fd73c8ae8fce197bd7c2995e1d4e84b6d7cc05a7 (public asset copy omitted during the resource-constrained local build). DOM/layout tests cover fixed slots and mobile widths; real-browser visual/play feedback is still needed.

This is a functional prototype, not a new balance certification. Historical CPU/holdout evidence applies to its recorded single-slot baseline. The CPU harness keeps that default; explicitly set `itemCapacity: 2` for a double-slot experiment, and record the returned capacity. Existing water simulation fixtures likewise retain their single-slot default; browser adapters explicitly select capacity two for all racers. No new win-rate or fun claim is made.
