# NPC pickup reachability: exploratory paired probes, 2026-10-15

## Decision

Keep `pickupPlanning: 'execution-matched'` opt-in. Do not change character/build
parameters or pulse-holding policy. These probes found a planning/execution
formula difference, but no production-parameter example in the tested local
scenes where legacy targeting chose an unreachable pickup. They do not establish
that enabling the new planner improves human driving, participation or fairness.

## Fixed scope and provenance

Gameplay modules were checked against dev `3bed4f9c` before running:

- land-cpu.ts: `6f061c56ad336172e818bbe7f9b11cbc99913961`
- npc-tactics.ts: `8488a65e8c30724d30ebe7f22b27ecbf1cf1f2b9`
- land-cpu-simulation.ts: `e308a0f943d8308cccf3cb7ce54aff879a8fe14c`
- character-profiles.ts: `06833d63885b155f70815046c8d403e70bb12762`
- kart-build.ts: `005d4495dc09a8e63c2c6bba1c47bdbc72de1650`

Coast, Snow and Caldera; seeds 20261015 and 20261016; normal difficulty;
equal default equipment; ordinary and dynamic pickups enabled; all six CPU
seats; both planners. Exactly 12 full races, not a new holdout or win-rate study.
Existing C21 evidence applies only to its frozen baseline.

## Local mechanism probes

108 paired straight-segment scenarios (216 traces) used speed 18/30, gap
8/16/24, lateral displacement 2/3.5/5, and the actual default-build steering
multipliers of Claude (0.99) and Gemini (1.11). Local grip was frozen at the
minimum of 128 evenly spaced samples: Coast 1, Snow/Caldera 0.975. Speed and
grip were fixed deliberately to isolate lateral capability, not to recreate a
whole map. Actual `moveLane` and swept `collectPickups` determined contact.

Each planner attempted and collected 54 pickups; neither had an attempted
miss. This coarse grid did not straddle the small production differences.

A second, explicitly exploratory probe placed boxes exactly 0.05 m below/above
the legacy reachability boundary (60 valid scenarios). It compared both planners
with a forced-direct steering trace:

- 23 target decisions differed: 15 extra attempts, 8 removed attempts
- Neither planner produced an attempted miss
- All 8 removed attempts were physically collectible in the fixed local scene
- Legacy rejected 30 forced-direct-reachable cases; matched rejected 23

The estimator keeps a 0.65 m allowance while actual pickup lateral half-range is
1.5 m, with a longitudinal contact window as well. Thus its threshold is
conservative. Multiplying it by steering/grip does not by itself calibrate it to
actual contact. Do not replace the allowance or speed heuristic in this batch.
A synthetic multiplier 0.1 is used only in a harness unit test to verify that
misses are detectable; it is not a real-character result.

## Full-race descriptive outcomes

All 72 racer outcomes finished; no timeout, rejected progress or rail contact
was observed. This small sample is not a guarantee.

| Map | Total pickups, legacy → matched | Mean absolute target-lane error, m | Sum of 12 racer finish times, s |
|---|---:|---:|---:|
| Coast | 204 → 211 | 0.3426 → 0.3571 | 1651.004 → 1628.232 |
| Snow | 123 → 123 | 0.1439 → 0.1436 | 3555.820 → 3555.820 |
| Caldera | 120 → 118 | 0.1501 → 0.1464 | 3584.179 → 3573.380 |

Matched-vs-legacy pickup changes by seed were Coast 0/+7, Snow 0/0 and
Caldera -2/0. Faster finishes do not establish a better decision or better fun.

The harness also counted *inferred target-lane episodes*: a decision followed
by the final lane matching one eligible box. Legacy/matched episode counts were
Coast 258/272, Snow 138/137 and Caldera 133/129. Episode ends (collected during /
unavailable or taken / retargeted) were 171/24/63 versus 179/25/68 on Coast,
119/17/2 versus 119/16/2 on Snow, and 117/6/10 versus 115/7/7 on Caldera.

No pass-without-collection episode was recorded, but this is **not zero pickup
misses**: replanning can end the episode before crossing the box. These are not
exact AI-intent logs. A collection during an episode may be another box, and
unavailability does not identify the taker. Counts are diagnostic labels only.
After different pickup events, shared item RNG consumption can diverge; the
full races are not a one-event causal contact test.

## Reproduce and next evidence

Run from the repository root:

    node --import tsx --test tests/pickup-contact-probe.test.ts
    node --import tsx scripts/diagnose-pickup-planning.ts results
    node --import tsx scripts/diagnose-pickup-boundaries.ts results

The first study writes full raw JSON. The boundary probe reads that file and
writes its separate raw results. Four harness tests passed; output dimensions,
completion and episode-accounting invariants were also checked. No full game
regression or new balance certification was run.

Before enabling the planner, use an actual missed opportunity and capture its
selected box, route, input/target lane, local speed/grip and contact outcome.
Replay that same initial state, changing only planning. The existing read-only
`pickupReachability` observer can help locate the discrepancy. If no such
failure is present, keep the default and avoid more broad seed searches.
