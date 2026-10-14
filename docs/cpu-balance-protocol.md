# Land CPU balance protocol (frozen before tuning)

Base: `33988b49dee01547238c08df4684cce93fae9497` (v1.0.1a). This is subsequent dev work; the release, main, Windows packages and water gameplay are excluded.

## Estimand and controls

The estimand is each character's first-place probability with equal normal-difficulty CPU control, averaged equally over the twelve land maps. It is not a claim about human skill or GPU rendering. Use the actual browser NPC decision, driving, route, collision, pickup and item code at 60 Hz for three legal laps. Finish every racer; stop an unfinished race at 600 simulation seconds and retain DNFs in every denominator. Do not infer winners for all-DNF races.

Each independently seeded map/scenario is a six-race block. The six characters rotate through every seat exactly once. Seat identity controls initial grid, iteration order, tie-break ID, AI phase and branch hash. Character order and phases are independently shuffled for each block. Use the same default build for all characters. Standard authored and dynamic pickups remain on. Keep difficulty and geometry fixed.

Primary training/baseline budget: 32 blocks × 12 maps × 6 rotations = 2,304 races. Development searches may use fixed subsets of training blocks; they never use holdout data. Primary final holdout: 128 fresh blocks/map = 9,216 races. Mixed-equipment holdout: 64 fresh blocks/map = 4,608 races, using five authored presets plus one mixed-part corner build in a shuffled seat assignment. Every character receives every seat/loadout in the block. Secondary easy/hard and item-off smoke probes are labeled diagnostics, not primary balance certification.

Seed domains are `land-balance-training-v1`, `land-balance-holdout-v1` and `land-balance-mixed-holdout-v1`; FNV-1a hashes domain, map ID and block index. The runtime-only pilot is outside these domains. A candidate is frozen and hashed before opening final holdout. If it fails and is retuned, discard that holdout for certification and reserve a new domain, reporting the failed attempt transparently. Never force prescribed winners or seek exactly 1/6 empirical rates.

## Acceptance declared before seeing training results

- Aim: all aggregate observed rates within 3 percentage points of 1/6
- Certify practical primary equivalence only when all six simultaneous 95% cluster intervals are fully contained in 12.6667%–20.6667% (±4 percentage points)
- Permit map specialties, but require every per-map/character simultaneous upper win-rate bound below 40%; report all per-map rates and lower bounds so a consistently weak character is visible
- Mixed-equipment aggregate equivalence margin is ±5 percentage points around 1/6, separately labeled
- Zero invalid/nonfinite progress and zero primary DNFs; any DNF blocks certification until explained/fixed and rerun
- Identical-character control: rotating labels across mechanically identical seats must yield exactly one win per label over a complete six-rotation block, assuming at least one finisher, without scripting outcomes
- Repeat identical input/seed produces identical complete result; preserve all character stat ordering, including existing ties. GPT remains the 1/1/1 reference. Land acceleration range at least .16, top-speed range at least .08 and steering range at least .12; no flattening to indistinguishable values. Candidate multipliers remain bounded: acceleration .65–1.45, top speed .90–1.10, steering .85–1.30
- Preserve launch, straight-speed and steering archetype ordering in direct physics probes

Resample entire six-race blocks within each map, preserving the six-character vectors. A deterministic 10,000-draw max-t block bootstrap provides a joint simultaneous band over primary aggregate, 72 per-map and mixed-equipment aggregate endpoints. Report training uncertainty only as descriptive. No binomial race-level interval is treated as independent evidence for paired rotations. Degenerate endpoints are called out rather than reported as magically certain; use a conservative block-level boundary bound there.

## Implementation boundary

The ordinary game's player steering, extra player collision loss and player-triggered end screen remain unchanged by the NPC extraction. All-CPU seats all follow the CPU path. Finished CPUs are excluded from further combat; standings use interpolated physical completion time. The data-only course loader imports the same map and pickup definitions as the browser; it builds no substitute track or mock physics. Headless pickup visibility booleans are real pickup state, not a renderer simulation.

Any shared character-neutral corner-composition fix must be justified with an unchanged baseline, measured separately before profile tuning, applied equally to player and NPC through the shared kart compiler, and documented explicitly. No AI difficulty or route geometry changes and no character/map outcome bonuses are allowed.

## Measured baseline and shared corner correction

The unchanged 2,304-race baseline completed without DNFs. Its initial rejected-progress observer was subsequently found unreliable because speed had already been reset by the guard; a separate original-physics replay with explicit rejection callbacks is required before interpreting that diagnostic. Aggregate rates were whale 0%, gemini 0.6510%, GPT 0.6510%, Claude 0.0868%, Grok 92.6215%, GLM 5.9896%.

Two formula-only diagnostic passes used the same first four training blocks per map (288 races) and retained the original profile numbers. The paired old formula gave Grok 93.06%; adding character handling only to its existing linear blend gave 86.81%. Character speed still dominated ordinary bends because the linear blend reached the grip-limited value only at very sharp curvature.

The retained unboosted arcade corner-cap formula is map-neutral: corner speed is the lower of straight top speed and sqrt(combined part/character handling) × max(42 × .62, sqrt(12 / absolute curvature)). The 12 m/s² reference lateral-load ceiling is a bounded arcade design constant, not a measured vehicle claim. The original .62 reference corner pace remains the tight-bend floor, now grip-scaled rather than gearing-scaled. Straight-line speed and the acceleration integrator are unchanged. This feeds the identical shared compiler for the player and every NPC. No difficulty, route geometry, item powers or per-map/character winner bonus changes.

With that formula alone, the same 288-race sample gave whale 2.08%, gemini 22.22%, GPT 9.03%, Claude 1.04%, Grok 35.42%, GLM 30.21%, with zero DNFs. These are development diagnostics, not independent validation. Roster tuning follows this measured correction.

The collision broad phase only reorders existing eligibility checks, skipping road-frame allocations for mathematically impossible contacts. The old physical-first predicate and the optimized predicate matched on 14,400 actual-map cases, and 24 full recorded races replayed exactly. It does not alter contact rules.
