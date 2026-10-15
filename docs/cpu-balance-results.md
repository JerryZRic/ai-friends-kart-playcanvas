# Land CPU balance: candidate 21 held-out results

**DEV CANDIDATE ONLY · Final certification: INCONCLUSIVE.**  
Report metadata: `candidate-21-holdout`. Evidence cutoff: 2026-10-14 17:33 UTC.

Candidate 21 completed the original **9,216-race primary** and **4,608-race mixed-equipment** holdouts without retuning. All three aggregate criteria pass: observed primary rates within ±3 percentage points of 1/6, simultaneous primary intervals within ±4 points, and mixed intervals within ±5 points. **The per-map upper-bound guardrail is INCONCLUSIVE, so the candidate is not certified fully balanced and no single-map fairness guarantee is established.**

- **Whale / Coast:** 34.1146%, simultaneous 95% interval **27.7505%–40.4786%**
- **Grok / Caldera:** 41.5365%, interval **35.5695%–47.5034%**. The observed rate itself exceeds 40%; the formal result is inconclusive because its interval straddles that boundary
- **Whale / Caldera:** just **1.1719%**, interval **0.0000%–2.7004%**. Passing aggregate criteria does not remove this map-specific weakness
- Both cohorts have **zero DNFs, timeouts, invalid/rejected route steps, or missing winners** across 82,944 racer starts
- An independent implementation agrees on **all 84 simultaneous endpoints**, statuses and win/rank counts; maximum endpoint discrepancy is below 3×10⁻¹⁷
- **148 frozen inputs remain unchanged.** There were no runtime profile overrides and no post-holdout tuning. Accepting a map tradeoff or changing the criteria is a separate decision, not implied by candidate publication

Use the [readable candidate report](../public/balance-report.html), [full official analysis with every map/character interval](../public/balance-results/holdout21/official.report.md), [machine-readable official summary](../public/balance-results/holdout21/official.summary.json) and [artifact index](../public/balance-results/artifact-index.json). The expected dev report route is [balance-report.html](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/balance-report.html); this document alone does not attest that a deployment is live. The runtime version remains `1.0.1a-dev.cpu`; the report identifier does not change game code.

## Final aggregate results

All twelve maps receive equal weight. Intervals below are members of the same simultaneous 95% family of 84 endpoints, not separate unadjusted character intervals.

| Character | Primary rate | Primary simultaneous interval | Mixed rate | Mixed simultaneous interval |
|---|---:|---:|---:|---:|
| Whale | 14.0191% | 12.7373%–15.3009% | 17.6649% | 16.1612%–19.1687% |
| Gemini | 17.6758% | 16.2556%–19.0959% | 16.7535% | 15.2425%–18.2644% |
| GPT | 16.3194% | 14.9409%–17.6980% | 17.1875% | 15.5942%–18.7808% |
| Claude | 16.0048% | 14.6363%–17.3732% | 16.7969% | 15.3489%–18.2448% |
| Grok | 17.3286% | 15.9774%–18.6797% | 15.1042% | 13.6019%–16.6064% |
| GLM | 18.6523% | 17.2173%–20.0873% | 16.4931% | 14.9350%–18.0511% |

The primary aggregate target band is **13.6667%–19.6667%**, primary interval band **12.6667%–20.6667%**, and mixed interval band **11.6667%–21.6667%**. Every primary map/character upper bound must be **strictly below 40%**. Two of the 72 map endpoints do not establish this. No permitted margin was changed after measurement.

## Completed holdout and integrity

| Requirement | Recorded outcome |
|---|---|
| Freeze authoritative candidate 21 land roster before measurement | Frozen 2026-10-14 15:23:10 UTC; no runtime profile overrides |
| Primary cohort | 9,216 races; 1,536 complete six-rotation blocks; 128 blocks/map; completed 17:01:13 UTC |
| Mixed cohort | 4,608 races; 768 complete six-rotation blocks; 64 blocks/map; completed 17:32:01 UTC |
| Aggregate observed / primary interval / mixed interval criteria | PASS / PASS / PASS |
| All-map simultaneous upper bound strictly below 40% | INCONCLUSIVE: Whale–Coast and Grok–Caldera |
| DNFs / timeouts / invalid steps / missing winners | 0 / 0 / 0 / 0 in both cohorts |
| Missing maps / incomplete blocks / excluded inferential rows | None / none / zero |
| Independent roles, rotations, loadouts, seeds and CSV audit | PASS; no overlap with recorded training-domain seeds |
| Frozen-input hashes / runtime override audit | 148 of 148 match; overrides absent |
| Independent joint-statistics recomputation | All 84 endpoints, critical value, statuses and win/rank diagnostics agree to floating-point precision |
| Overall held-out certification | **INCONCLUSIVE** |

Freeze SHA-256: `c11162eb90464b6068d07044bb9a974718fd0f69ce7606304b3181fe30d9fbed`.

The [freeze record](../public/balance-results/holdout21/freeze.json) records a passing typecheck, **107/107 focused tests**, **24 exact baked-roster training replays** and unchanged water coefficients before holdout. These are controls, not 24 additional independent balance observations. The [independent structural audit](../public/balance-results/holdout21/independent-structural-audit.json) checks final source equality, complete rows, seeded roles, loadouts and domains. The [independent statistical comparison](../public/balance-results/holdout21/independent-official-comparison.json) verifies the final analyzer. Historical browser QA below is a distinct earlier source snapshot, not a new candidate-21 GPU or visual certification.

The primary run resumed only missing blocks after an interruption; complete cohort totals are counted once. Manifests, completion chronology and frozen hashes are verified. Files alone cannot prove the absence of unrecorded prior holdout access; the retained snapshot has no Git metadata. This provenance limit does not change the reported rates or their inconclusive map result.

No further tuning uses this holdout. A revised candidate needs a prospective decision and fresh holdout domains, retaining this result as the prior attempt. Publishing an explicitly labeled dev candidate does not accept the unresolved map tradeoff or promote it to stable `main`.

## Scope and release boundary

The released-physics reference is `33988b49dee01547238c08df4684cce93fae9497` (v1.0.1a). This is distinct from the stable-site/main identity: the current [stable Pages manifest](stable-pages-manifest.json) pins `b665343da013f5cfec0a0f45797adcd347f9607b`. Neither identifier should be substituted for the actual source hashes of a measured run.

This balance pass is confined to subsequent **dev land-kart work**. Stable `main`, the existing release, Windows packaging/publication, and A01 water gameplay are excluded. The dev Pages workflow preserves the pinned stable site and places the experiment under `dev/`; this report is not a new deployment or live stable-site audit. The water coefficients are explicitly retained separately in `WATER_CHARACTER_MULTIPLIERS`, and a focused test checks that supplying a land override cannot alter them.

## What the test measures

The estimand is each character's first-place probability under equal normal-difficulty CPU control, averaged equally over these twelve maps:

`coast`, `mountain`, `town`, `quarry`, `forest`, `workshop`, `harvest`, `desert`, `snow`, `caldera`, `garden`, `airfield`.

The test runs the exported **production NPC decision, driving, route/checkpoint, collision, pickup and item code**. The data-only course loader imports the authored map and pickup definitions; it does not replace the course with a toy track. The simulation builds no graphics scene. Pickup visibility booleans represent the actual pickup state needed by the shared item logic.

### Controls and role parity

- Fixed 60 Hz steps, three legal laps, and a 600-simulation-second timeout. Every racer must finish; the selected-player end-screen shortcut does not terminate an all-CPU trial
- Standard static and dynamic pickups, item use and contact behavior remain enabled for primary data. Normal difficulty, map geometry and item powers are held fixed
- Every map/seed block contains six races. Character labels rotate through every seat once, including initial grid position, iteration order, tie-break ID, AI phase, branch hash and, for mixed equipment, loadout
- Seat identities are `seat-0` through `seat-5`; character identity supplies its actual acceleration, top speed and steering. Character and phase orders are seeded/shuffled separately, and do not grant a fixed character a preferred role
- The equal-equipment condition uses the same default build for all characters. Mixed equipment uses the five authored presets plus the mixed-part corner build, shuffled across seats; every character receives every loadout in the block
- All six seats use the CPU path. The ordinary player's steering, extra player collision loss and end-screen behavior are preserved in the regular game
- Finished CPUs leave further combat. Standings use interpolated physical completion times. A timeout retains all DNFs in the denominator, and an all-DNF race has no invented winner
- Repeating identical inputs and seed must reproduce the entire result. Mechanically identical characters with rotating labels must produce one win per label over a complete six-rotation block, through role rotation rather than prescribed winners

Sources: [CPU simulation](../src/land-cpu-simulation.ts), [shared NPC loop](../src/land-cpu.ts), [authored course loader](../src/land-simulation-course.ts), [shared kart compiler](../src/kart-build.ts), and [role/replay tests](../tests/land-cpu-simulation.test.ts).

## Sample budget and decision rules

| Stage | Blocks per map | Races | Purpose |
|---|---:|---:|---|
| Original primary baseline | 32 | 2,304 | Unchanged reference |
| Original-physics replay | Same 32 | Same 2,304 | Correct instrumentation; exact replay check |
| Formula-only paired diagnostic | First 4 training blocks | 288 per formula | Identify shared composition effect |
| Full primary training candidate | 32 | 2,304 | Develop a roster, never certify it |
| Fixed primary development screen | First 12 training blocks | 864 | Compare early candidates consistently |
| Mixed training diagnostic/screen | 4 or 8 | 288 or 576 | Explore equipment sensitivity |
| **Final primary holdout** | **128 fresh** | **9,216** | **COMPLETE; aggregate PASS, map INCONCLUSIVE** |
| **Final mixed-equipment holdout** | **64 fresh** | **4,608** | **COMPLETE; mixed aggregate PASS** |

Primary training uses `land-balance-training-v1`; mixed training uses `land-balance-mixed-training-v1`. Final primary and mixed domains were reserved before measurement as `land-balance-holdout-v1` and `land-balance-mixed-holdout-v1`. The FNV-1a seed combines domain, map ID and block index. Runtime/browser pilots use separate diagnostic domains. Reusing training blocks for paired candidates is intentional; repeated candidates are not independent confirmation.

The statistical decision rules were declared before tuning and remain unchanged. The trait/span development constraints have the explicitly dated amendments described below:

1. Observed aggregate aim: all characters within **13.6667%–19.6667%** (1/6 ±3 percentage points)
2. Primary practical equivalence: all six simultaneous 95% cluster intervals entirely inside **12.6667%–20.6667%** (±4 points)
3. Every map/character simultaneous upper bound strictly below **40%**; publish all per-map rates and lower bounds, including weak characters
4. Mixed-equipment equivalence separately requires aggregate intervals inside **11.6667%–21.6667%** (±5 points)
5. Zero primary DNFs and zero invalid/nonfinite progress; an unexplained DNF blocks certification
6. Keep recognizable main archetypes and GPT at `1/1/1`. The initial all-original-orderings/ties requirement was prospectively amended before candidate 16. Minimum acceleration/top-speed/steering spans were `.16/.08/.12` through candidate 18; the prospective minimum from candidate 19 is `.16/.07/.12`. Multiplier bounds remain `.65–1.45`, `.90–1.10`, `.85–1.30`, respectively. Direct physics probes must preserve the main launch, straight-speed and steering archetypes. The amendments are not retroactive passes of the stricter original constraints

Uncertainty resamples entire six-race vectors within each map. The analyzer uses 10,000 deterministic max-t block-bootstrap draws, with a conservative bounded-block fallback for degenerate endpoints. The primary-plus-mixed family contains 84 endpoints: six primary aggregates, 72 map/character rates and six mixed aggregates. Its implementation divides the error allowance between the max-t and boundary procedures. Coverage is approximate, and **training intervals are descriptive only**. Individual races or racers are never treated as independent bootstrap observations.

Incomplete blocks are excluded from statistical inference but retained in raw diagnostics. All completed or fixed-screen batches summarized here have complete six-rotation blocks in their retained data. A stopped batch can nevertheless have unequal block counts by map; its pooled retained-row win fraction is not the equal-map fixed-screen estimand.

## Original baseline and corrected instrumentation

The primary baseline contains 384 complete map/seed blocks, 2,304 races and 13,824 racer starts. All racers finished, with no timeouts or no-winner races.

| Character | Wins / 2,304 races | Win rate |
|---|---:|---:|
| whale | 0 | 0.0000% |
| gemini | 15 | 0.6510% |
| gpt | 15 | 0.6510% |
| claude | 2 | 0.0868% |
| grok | 2134 | 92.6215% |
| glm | 138 | 5.9896% |

The original rejected-progress observer was unreliable: the movement guard had already reset speed before the heuristic checked it. Its old zero count alone was therefore not evidence that no route/checkpoint rejection occurred. Instrumentation version 2 observes the rejection callbacks directly and records reason counts, separately from normal vehicle contacts and rail contacts.

The completed **original-physics** replay confirmed:

- Exact equality of every field recorded by the original run across all 2,304 races
- Zero explicit rejected route/checkpoint steps, zero DNFs and zero timeouts
- Original JSONL SHA-256: `a45cb28127638c44d53de7738cef7e705b00ba5eb2cb9e8d82be1b838e37e3fd`
- Corrected, uncompressed JSONL SHA-256: `8b6fd214c00019fd327524d789b9a0518e117d04f40520c87a700481d6d28ad1`

The corrected file has additional instrumentation fields, so its byte hash is expected to differ. The equality claim applies to every original field, not to byte identity between the two schemas. This fixes the measurement claim without changing the baseline race outcomes.

Evidence: [replay audit](../public/balance-results/baseline-corrected.audit.json), [manifest](../public/balance-results/baseline-corrected.manifest.json), [completion marker](../public/balance-results/baseline-corrected.complete.json), [compressed raw races](../public/balance-results/baseline-corrected.jsonl.gz), [compressed CSV](../public/balance-results/baseline-corrected.csv.gz), and [full baseline analysis](../public/balance-results/baseline-corrected.analysis.report.md). The analysis includes every map/character interval and rank, finish-time, lap, item and contact diagnostics; its [summary JSON](../public/balance-results/baseline-corrected.analysis.summary.json) contains the underlying detail.

## Formula-only evidence before profile tuning

All three rows below use the **same first four training blocks per map**, unchanged original character numbers, normal difficulty, equal builds and standard items. Each row has 288 races, not 2,304. The original row is a subset of the baseline, not another run.

| Shared corner formula | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|
| Original formula, paired baseline subset | 0.0000% | 0.6944% | 0.0000% | 0.0000% | 93.0556% | 6.2500% |
| Character handling added to prior linear blend | 0.0000% | 1.3889% | 1.3889% | 0.0000% | 86.8056% | 10.4167% |
| Retained grip-limited cap, original profiles | 2.0833% | 22.2222% | 9.0278% | 1.0417% | 35.4167% | 30.2083% |

The source manifests are not byte-identical across all three snapshots. Between the baseline and linear trial, hashes differ for `src/character-profiles.ts`, `src/land-cpu-simulation.ts` and `src/kart-build.ts`; between the linear and grip trials, only `src/kart-build.ts` differs. “Paired” here describes the matched map/seed/rotation/options and original profile numbers, not identical whole-source hashes. Preserve those manifest differences when reproducing the comparison.

Adding character handling to the old linear blend reduced Grok's paired win rate from 93.0556% to 86.8056%, but the top-speed factor still dominated ordinary bends. The blend only approached its grip-limited value at very sharp curvature. The retained shared correction reduced that paired rate to 35.4167%; this was an improvement in the measured mechanism, not a balanced result by itself. Both formula-only passes had zero DNFs/timeouts. Their legacy rejection-counter zeros do not carry the stronger version-2 rejection-audit claim.

For nonzero curvature, the retained unboosted arcade cap is:

`min(straight top speed, sqrt(combined part × character handling) × max(42 × 0.62, sqrt(12 / abs(curvature))))`

At zero curvature, the straight top speed is unchanged. The `12` reference lateral-load ceiling is a bounded **arcade design constant**, not a measured real-vehicle claim. The old `0.62` reference tight-corner pace remains a floor, now scaled by grip rather than straight gearing. The same compiler supplies the player's and every NPC's corner tuning. The straight-line top-speed and acceleration integrator are unchanged by this formula correction; later profile trials separately adjust the character multipliers.

No map-specific or character-specific outcome bonus, route change, difficulty change or item-power change was used. The unrelated collision broad-phase optimization only reorders existing eligibility checks: the recorded audit matched the old physical-first predicate on 14,400 actual-map cases and replayed 24 full races exactly.

Evidence: [linear trial manifest](../public/balance-results/composition-linear.manifest.json), [linear raw races](../public/balance-results/composition-linear.jsonl.gz), [grip trial manifest](../public/balance-results/composition-grip.manifest.json), [grip raw races](../public/balance-results/composition-grip.jsonl.gz), [compiler](../src/kart-build.ts), [collision broad-phase test](../tests/land-collision-broadphase.test.ts), [shared collision implementation](../src/land-cpu.ts).

## Training history through candidate 19

Every row below is exploratory training. Profiles are retained as per-trial inputs in `public/balance-results/candidates/`, numbered to match each candidate, and copied into the corresponding manifest. The later `*-rationale.json` files record the motivation before the next trial. These historical candidates are development inputs; candidate 21 was later selected and frozen separately.

### Completed planned batches: equal equipment

| Trial | Blocks/map | Races | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| [`candidate-01`](../public/balance-results/candidate-01.jsonl.gz) | 4 | 288 | 5.2083% | 30.9028% | 11.1111% | 6.5972% | 23.6111% | 22.5694% |
| [`candidate-02`](../public/balance-results/candidate-02.jsonl.gz) | 4 | 288 | 13.8889% | 17.3611% | 10.4167% | 18.7500% | 19.7917% | 19.7917% |
| [`candidate-03`](../public/balance-results/candidate-03.jsonl.gz) | 4 | 288 | 17.7083% | 14.9306% | 17.0139% | 15.2778% | 14.5833% | 20.4861% |
| [`candidate-03-full`](../public/balance-results/candidate-03-full.jsonl.gz) | 32 | 2,304 | 19.5312% | 17.3177% | 14.6701% | 14.6701% | 14.9740% | 18.8368% |
| [`candidate-05-full`](../public/balance-results/candidate-05-full.jsonl.gz) | 32 | 2,304 | 14.6701% | 19.5312% | 16.2326% | 16.3628% | 15.3646% | 17.8385% |
| [`candidate-13-full`](../public/balance-results/candidate-13-full.jsonl.gz) | 32 | 2,304 | 14.3229% | 17.6649% | 17.3177% | 15.6250% | 15.1910% | 19.8785% |
| [`candidate-16-full`](../public/balance-results/candidate-16-full.jsonl.gz) | 32 | 2,304 | 15.1476% | 18.9670% | 16.4931% | 16.9705% | 16.5365% | 15.8854% |
| [`candidate-17-full`](../public/balance-results/candidate-17-full.jsonl.gz) | 32 | 2,304 | 14.0625% | 18.9670% | 18.2726% | 15.7118% | 15.7118% | 17.2743% |
| [`candidate-18-full`](../public/balance-results/candidate-18-full.jsonl.gz) | 32 | 2,304 | 12.1962% | 18.4896% | 17.6215% | 17.3177% | 16.4931% | 17.8819% |
| [`candidate-19-full`](../public/balance-results/candidate-19-full.jsonl.gz) | 32 | 2,304 | 12.5868% | 18.2726% | 18.9236% | 16.4497% | 16.7969% | 16.9705% |

The completed 12-block screens below were planned as **864-race screens** from the outset. They are complete for that smaller budget; they are not completed 2,304-race training runs.

| Trial | Blocks/map | Planned = completed races | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| [`candidate-10-screen`](../public/balance-results/candidate-10-screen.jsonl.gz) | 12 | 864 | 22.4537% | 19.0972% | 17.1296% | 15.1620% | 14.1204% | 12.0370% |
| [`candidate-11-screen`](../public/balance-results/candidate-11-screen.jsonl.gz) | 12 | 864 | 11.2269% | 17.5926% | 18.6343% | 17.2454% | 15.9722% | 19.3287% |
| [`candidate-12-screen`](../public/balance-results/candidate-12-screen.jsonl.gz) | 12 | 864 | 16.2037% | 16.2037% | 15.5093% | 15.0463% | 17.4769% | 19.5602% |

Their [10](../public/balance-results/candidate-10-screen.complete.json), [11](../public/balance-results/candidate-11-screen.complete.json) and [12](../public/balance-results/candidate-12-screen.complete.json) completion markers each confirm 864 races / 144 blocks. All retained rows have version-2 reason detail and zero rejected steps, DNFs, timeouts or no-winner races.

- **10:** Whale rises to 22.4537% aggregate while GLM falls to 12.0370%. Whale wins 45.8333% on Coast, 43.0556% on Garden and 41.6667% on Quarry
- **11:** The highest per-map point estimate is 36.1111% (Caldera Grok), but Whale falls to 11.2269% aggregate. Point estimates below 40% do not establish that every simultaneous upper confidence bound is below 40%
- **12:** All six aggregate point estimates meet the ±3-point aim. Caldera Grok still wins 43.0556%, while Coast Whale is 37.5000% and Garden Claude 36.1111%; this remains training evidence with unresolved map concentration

Candidates 11 and 12 are the two preplanned handling/GLM-straight-speed branches recorded in their [11 rationale](../public/balance-results/candidates/11-rationale.json) and [12 rationale](../public/balance-results/candidates/12-rationale.json). The actual profile values, also copied in the manifests, govern reproduction. These are descriptive screen comparisons; no final-holdout interval result is inferred from them.

Candidate 03's four-block sample is repeated within its full 32-block run, not independent supporting evidence. Candidates 01, 02 and the initial candidate-03 screen predate the corrected rejection observer; their finish, DNF and win results are usable, but their legacy rejection zeros are not a corrected safety audit. The full candidate-03 and candidate-05 runs have version-2 reason detail for all 13,824 racer starts each, with zero rejected steps, DNFs, timeouts or no-winner races.

For both full candidates, the analyzer reports the **observed aggregate aim passed**, while primary equivalence, the map upper-bound requirement and mixed equivalence remain **inconclusive**. This label does not mean the map guardrail was met: candidate 03 has Coast Whale 42.7083% and Caldera Grok 44.2708%; candidate 05 has Caldera Grok 42.1875%, Garden Claude 36.4583% and Coast Whale 35.9375%. Those concentrations motivated further training rather than premature certification.

All 72 map/character rates, simultaneous bounds and detailed diagnostics are in the [candidate-03 full report](../public/balance-results/candidate-03-full.analysis.report.md) / [summary](../public/balance-results/candidate-03-full.analysis.summary.json) and [candidate-05 report](../public/balance-results/candidate-05.analysis.report.md) / [summary](../public/balance-results/candidate-05.analysis.summary.json). These reports explicitly prohibit interpreting training data or runtime profile overrides as held-out certification. Candidate 03's combined primary/mixed report also flags differing source hashes between those two runs; this is not concealed as a source-matched holdout.

### Stopped primary batches: fixed-screen comparison

The following planned 32-block runs were stopped after examining the fixed first **12 complete blocks per map** (864 races). Work already completed beyond that screen is retained. The `full` basename describes the original planned budget, not a completed full batch. No `.complete.json` exists for these stopped batches.

| Trial | Planned races | All completed races retained | Fixed screen | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| [`candidate-04-full`](../public/balance-results/candidate-04-full.stopped.json) | 2,304 | 948 | 864 | 12.0370% | 17.8241% | 16.8981% | 25.6944% | 11.6898% | 15.8565% |
| [`candidate-06-full`](../public/balance-results/candidate-06-full.stopped.json) | 2,304 | 1,032 | 864 | 10.7639% | 17.1296% | 15.6250% | 18.1713% | 18.8657% | 19.4444% |
| [`candidate-07-full`](../public/balance-results/candidate-07-full.stopped.json) | 2,304 | 936 | 864 | 14.6991% | 20.0231% | 11.3426% | 22.2222% | 19.7917% | 11.9213% |
| [`candidate-08-full`](../public/balance-results/candidate-08-full.stopped.json) | 2,304 | 1,050 | 864 | 15.1620% | 17.2454% | 17.9398% | 19.9074% | 11.2269% | 18.5185% |
| [`candidate-09-full`](../public/balance-results/candidate-09-full.stopped.json) | 2,304 | 984 | 864 | 14.3519% | 19.7917% | 16.3194% | 14.4676% | 16.8981% | 18.1713% |

Recorded development decisions:

- **04:** Claude was over the aggregate aim, and Whale remained concentrated on Coast
- **06:** Whale's aggregate rate was too low, while Grok's Caldera concentration persisted
- **07:** Claude/Gemini/Grok were too strong relative to GPT/GLM on the fixed screen; Caldera remained problematic
- **08:** Grok's Caldera concentration fell, but its aggregate rate became too low, and Coast Whale / Garden Claude concentrations remained
- **09:** The fixed-screen aggregate was near the aim, with Gemini slightly above its upper edge at 19.7917%, but Caldera Grok still won 41.6667%; the run stopped with all 984 completed races retained

These are screening reasons, not formal holdout rejections. All retained primary rows for these stopped runs have zero version-2 rejected steps, DNFs and timeouts. Their raw JSONL hashes match their stop records. No extra completed rows were discarded to improve the fixed-screen result; they remain in each packaged `.jsonl.gz` and `.csv.gz` (after decompression). Results outside the fixed screen are not silently combined into an equal-weight comparison.

### Mixed-equipment development evidence

| Trial | Planned races | All completed races retained | Sample shown | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| [`candidate-03-mixed`](../public/balance-results/candidate-03-mixed.jsonl.gz) | 288 | 288 | Complete 4 blocks/map (288) | 25.0000% | 16.6667% | 14.5833% | 15.2778% | 12.8472% | 15.6250% |
| [`candidate-04-mixed`](../public/balance-results/candidate-04-mixed.jsonl.gz) | 288 | 288 | Complete 4 blocks/map (288) | 12.5000% | 17.3611% | 19.7917% | 18.7500% | 12.5000% | 19.0972% |
| [`candidate-05-mixed`](../public/balance-results/candidate-05-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 19.7917% | 17.0139% | 17.8819% | 14.7569% | 13.3681% | 17.1875% |
| [`candidate-06-mixed`](../public/balance-results/candidate-06-mixed.stopped.json) | 576 | 312 | Fixed first 4 blocks/map (288) | 19.7917% | 14.2361% | 13.1944% | 19.7917% | 15.9722% | 17.0139% |
| [`candidate-07-mixed`](../public/balance-results/candidate-07-mixed.stopped.json) | 576 | 312 | Fixed first 4 blocks/map (288) | 18.7500% | 19.4444% | 15.2778% | 19.0972% | 15.6250% | 11.8056% |
| [`candidate-08-mixed`](../public/balance-results/candidate-08-mixed.stopped.json) | 576 | 348 | Fixed first 4 blocks/map (288) | 19.0972% | 14.5833% | 17.3611% | 19.0972% | 11.4583% | 18.4028% |
| [`candidate-13-mixed`](../public/balance-results/candidate-13-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 19.9653% | 16.6667% | 17.8819% | 16.1458% | 12.8472% | 16.4931% |
| [`candidate-16-mixed`](../public/balance-results/candidate-16-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 18.9236% | 16.4931% | 18.5764% | 17.1875% | 14.7569% | 14.0625% |
| [`candidate-17-mixed`](../public/balance-results/candidate-17-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 18.7500% | 16.1458% | 17.8819% | 16.6667% | 13.5417% | 17.0139% |
| [`candidate-18-mixed`](../public/balance-results/candidate-18-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 14.2361% | 16.8403% | 18.2292% | 19.2708% | 14.0625% | 17.3611% |
| [`candidate-19-mixed`](../public/balance-results/candidate-19-mixed.jsonl.gz) | 576 | 576 | Complete 8 blocks/map (576) | 18.5764% | 18.4028% | 17.3611% | 16.4931% | 13.0208% | 16.1458% |

Candidates 06–08 mixed runs planned eight blocks per map but were stopped after the four-block comparison; their extra completed rows remain available. Every retained row in these mixed runs uses version-2 rejection instrumentation and records zero rejected steps, DNFs and timeouts. These are much smaller training diagnostics than the reserved 4,608-race mixed holdout, and do not establish equipment robustness.

### Candidate 13 complete; candidates 14/15 cancelled

Candidate 13 completed all 2,304 primary and 576 mixed training races, with zero DNFs, timeouts and explicit rejected progress. Its largest map rate is Grok on Caldera, **38.5417%**. That point estimate is below 40%, but its simultaneous upper bound does not satisfy the map guardrail. GLM's 19.8785% aggregate also slightly exceeds the observed ±3-point aim. The [analysis report](../public/balance-results/candidate-13.analysis.report.md) and [full summary](../public/balance-results/candidate-13.analysis.summary.json) therefore do not certify balance.

Candidates 14 and 15 were cancelled before their planned screens because of the prospective trait clarification below, without interpreting their incomplete outcomes. Their completed rows remain packaged, with [14](../public/balance-results/candidate-14-screen.stopped.json) and [15](../public/balance-results/candidate-15-screen.stopped.json) cancellation records; no fixed-screen result or rejection is inferred.

### Prospective trait amendment: 11:13 UTC, before candidate 16

At **2026-10-14 11:13 UTC**, before candidate 16 and before opening any holdout, the trait constraint was clarified to preserve recognizable differentiated acceleration/top-speed/handling archetypes rather than every exact original numerical tie and pairwise ordering. The initial Whale/GLM handling equality coupled two character adjustments unnecessarily. The [dated protocol amendment](cpu-balance-protocol.md#prospective-trait-constraint-amendment-2026-10-14-1113-utc) permits explicit, globally applied coefficient changes to minor ties/orderings. It does not introduce map bonuses or modify AI, route geometry, items or the shared corner formula.

The retained main archetypes are:

- Claude: strongest launch
- Grok: highest straight speed, with weaker launch and handling than GPT
- Gemini: strongest handling, with slow launch
- Whale: brisk launch and handling, with lower straight speed
- GLM: above-reference straight speed and handling, with slower launch
- GPT: unchanged `1/1/1` reference

Candidates 01–13 were evaluated under the original stricter tie/order assumptions; 14/15 provide no completed-screen conclusion. Candidate 16 first separates Whale and GLM handling (`1.08` versus `1.055`); candidate 17 retains unequal handling (`1.06` versus `1.05`). Candidate 18 also separates the old Claude/Grok handling tie (`.99` versus `.995`), with both still below GPT. These changes are explicit coefficient changes, not preserved original ties. The `.16/.08/.12` minimum spans and all coefficient bounds remained in force for candidates 16–18. **Statistical thresholds, sample budgets and holdout domains did not change.**

### Completed candidates 16–18: training conclusions

Each of candidates 16, 17 and 18 completed its entire planned **2,304-race primary** and **576-race mixed** batch: 384 and 96 complete six-rotation blocks respectively, with all twelve maps covered equally. Each candidate has **zero DNFs, zero timeouts, zero no-winner races and zero explicit rejected route/checkpoint steps** in both conditions. Rejection-reason detail is present for every racer start: 13,824 primary and 3,456 mixed per candidate. These are corrected version-2 observations, not the legacy speed-reset heuristic. Normal vehicle collisions remain separate diagnostics.

The paired primary/mixed manifests within each of these three candidates have matching source-hash inventories and matching profile inputs. All use the training domains and runtime overrides, so none is eligible for final held-out certification.

| Candidate | Observed aggregate aim | Primary interval equivalence | Per-map simultaneous bound | Mixed interval equivalence | Interpretation |
|---|---|---|---|---|---|
| 16 | Pass | Inconclusive | Inconclusive | Inconclusive | Aggregate training rates improved; map concentrations remain |
| 17 | Pass | Inconclusive | Inconclusive | Inconclusive | Coast concentration fell; Caldera upper bound remains too wide |
| 18 | Fail | Inconclusive | Inconclusive | Inconclusive | Whale's 12.1962% aggregate falls below the observed aim |

All three recorded `cleanPrimary` checks pass. Candidate 18's overall training statistical assessment is `fail` because the observed aggregate aim fails; its held-out certification field remains `inconclusive` because no eligible holdout exists. The labels must not be collapsed into either a balanced release or a failed final holdout.

- **16:** All aggregate point estimates lie between 15.1476% and 18.9670%. Coast Whale is **41.1458%**, Caldera Grok **39.5833%** and Garden Claude **35.4167%**. Their simultaneous upper bounds include **52.8241%** for Coast Whale and **56.4819%** for Caldera Grok. Gemini's aggregate upper bound is **21.9429%**, above the primary equivalence ceiling
- **17:** Aggregate rates lie between 14.0625% and 18.9670%. Coast Whale falls to **31.2500%**, but Caldera Grok stays at **39.5833%**, with a **51.8433%** simultaneous upper bound. Whale's aggregate interval starts at **11.6407%**, below the primary equivalence floor. A point estimate below 40% is not proof of the required per-map upper-bound condition
- **18:** Caldera Grok falls to **36.9792%**, while Garden Claude is the largest map point estimate at **38.5417%**. Their simultaneous upper bounds are **51.4211%** and **50.9390%**, respectively. Whale's aggregate falls to **12.1962%**, with a **9.9533%–14.4391%** simultaneous interval. The reduction in Grok's Caldera rate therefore does not establish overall balance

These intervals come from the completed, stage-labeled training analyses and remain descriptive. Mixed aggregate point estimates also remain training diagnostics; their intervals do not establish the separately required ±5-point equivalence.

| Candidate | Primary provenance | Mixed provenance | Full analysis |
|---|---|---|---|
| 16 | [Manifest](../public/balance-results/candidate-16-full.manifest.json), [complete](../public/balance-results/candidate-16-full.complete.json) | [Manifest](../public/balance-results/candidate-16-mixed.manifest.json), [complete](../public/balance-results/candidate-16-mixed.complete.json) | [Report](../public/balance-results/candidate-16.analysis.report.md), [summary](../public/balance-results/candidate-16.analysis.summary.json) |
| 17 | [Manifest](../public/balance-results/candidate-17-full.manifest.json), [complete](../public/balance-results/candidate-17-full.complete.json) | [Manifest](../public/balance-results/candidate-17-mixed.manifest.json), [complete](../public/balance-results/candidate-17-mixed.complete.json) | [Report](../public/balance-results/candidate-17.analysis.report.md), [summary](../public/balance-results/candidate-17.analysis.summary.json) |
| 18 | [Manifest](../public/balance-results/candidate-18-full.manifest.json), [complete](../public/balance-results/candidate-18-full.complete.json) | [Manifest](../public/balance-results/candidate-18-mixed.manifest.json), [complete](../public/balance-results/candidate-18-mixed.complete.json) | [Report](../public/balance-results/candidate-18.analysis.report.md), [summary](../public/balance-results/candidate-18.analysis.summary.json) |

The full reports retain all 72 primary map/character rates and simultaneous bounds plus racer diagnostics, including weaker characters. Profile decisions are recorded in the [16 rationale](../public/balance-results/candidates/16-rationale.json), [17 rationale](../public/balance-results/candidates/17-rationale.json) and [18 rationale](../public/balance-results/candidates/18-rationale.json).

### Prospective speed-span amendment: 12:21 UTC, before candidate 19

At **2026-10-14 12:21 UTC**, after the completed 17/18 training results and **before candidate 19 or any holdout**, the internally chosen minimum top-speed multiplier span was prospectively changed from **.08 to .07**. The [dated amendment](cpu-balance-protocol.md#prospective-speed-span-amendment-2026-10-14-1221-utc) records why: maintaining the .08 span coupled the two speed extrema, so lowering Grok's speed also forced Whale's speed down. In the completed 17→18 comparison, Caldera Grok decreased from 39.5833% to 36.9792%, but Whale's aggregate decreased from 14.0625% to 12.1962%. Several coefficients changed in that comparison; this is a measured training tradeoff, not a claim that the speed-span constraint alone causally explains every change.

The prospective `.96–1.03` range still spans seven percentage points, equivalent to **2.94 game m/s at the 42 reference pace** before equipment, corner caps or boosts. The minimum acceleration span stays `.16`, the handling span stays `.12`, and the coefficient bounds and main archetypes stay unchanged. **All statistical thresholds, sample budgets and held-out domains are unchanged.** A candidate with a `.07` speed span does **not** pass the earlier `.08` constraint; the criterion version must accompany the result. Neither amendment was made after observing held-out outcomes.

For transparency, these are the profile inputs for completed candidates 16–19. Each entry is **acceleration / top speed / steering**; these coefficient values are separate from the performance results above.

| Character | Candidate 16 | Candidate 17 | Candidate 18 | Candidate 19 |
|---|---|---|---|---|
| whale | 1.08 / 0.95 / 1.08 | 1.03 / 0.96 / 1.06 | 1.06 / 0.955 / 1.065 | 1.03 / 0.96 / 1.065 |
| gemini | 0.65 / 1 / 1.11 | 0.65 / 1 / 1.11 | 0.65 / 1 / 1.11 | 0.65 / 1 / 1.11 |
| gpt | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |
| claude | 1.18 / 0.985 / 0.99 | 1.18 / 0.985 / 0.99 | 1.18 / 0.985 / 0.99 | 1.18 / 0.985 / 0.99 |
| grok | 0.81 / 1.03 / 0.99 | 0.75 / 1.04 / 0.99 | 0.77 / 1.035 / 0.995 | 0.79 / 1.03 / 0.995 |
| glm | 0.66 / 1.022 / 1.055 | 0.66 / 1.028 / 1.05 | 0.66 / 1.028 / 1.05 | 0.66 / 1.025 / 1.05 |

The corresponding [16](../public/balance-results/candidates/16.json), [17](../public/balance-results/candidates/17.json), [18](../public/balance-results/candidates/18.json) and [19](../public/balance-results/candidates/19.json) profile files are the exact inputs. Their numerical spans are `.53/.08/.12` for candidates 16–18 and `.53/.07/.12` for candidate 19. These coefficient checks do not replace final frozen-source physics probes.

### Candidate 19 complete: observed aggregate aim failed

Candidate 19's [primary manifest](../public/balance-results/candidate-19-full.manifest.json) and [mixed manifest](../public/balance-results/candidate-19-mixed.manifest.json) were created at **12:22 UTC**, after the speed-span amendment. The [primary completion marker](../public/balance-results/candidate-19-full.complete.json) records **2,304 races / 384 blocks**, completed at **12:43:28 UTC**; the [mixed completion marker](../public/balance-results/candidate-19-mixed.complete.json) records **576 races / 96 blocks**, completed at **12:38:14 UTC**. Each condition covers all twelve maps equally, with all six rotations per block.

Both batches record **zero DNFs, zero timeouts, zero no-winner races and zero explicit rejected route/checkpoint steps**. Version-2 reason detail is present for all 13,824 primary and 3,456 mixed racer starts. The primary/mixed source-hash inventories and profile inputs match. Both remain normal-difficulty, standard-item training data with runtime overrides; the [rationale](../public/balance-results/candidates/19-rationale.json) describes a profile-only trial.

Whale won **290/2,304 primary races (12.5868%)**, below the observed aim's 13.6667% lower edge. Its simultaneous training interval is **10.1924%–14.9812%**. The [analysis report](../public/balance-results/candidate-19.analysis.report.md) and [full summary](../public/balance-results/candidate-19.analysis.summary.json) therefore mark `observedTarget` and the overall training statistical assessment as **fail**, while `cleanPrimary` passes. Primary interval equivalence, the per-map guardrail and mixed interval equivalence remain **inconclusive**; held-out certification also remains **inconclusive**, because no final holdout had been opened at that historical stage.

The largest primary map rate is **Caldera Grok 39.5833%**, with a **52.7724% simultaneous upper bound**. Garden Claude is 32.8125% and Mountain GLM 31.2500%. Those point estimates do not satisfy the required upper-bound test. Mixed rates range from Grok's 13.0208% to Whale's 18.5764%; their intervals still do not establish the separate ±5-point equivalence. All six aggregate rates for each condition are retained in the tables above, and every per-map interval remains in the full analysis.

This completed result does not resolve the Whale/Grok tradeoff or validate a final roster. **At that historical stage, final holdout remained unopened.**

### Prospective paired sensitivity matrix 20a–20e: completed training

The completed sensitivity step comprises the original **four prospective one-coordinate probes 20a–20d**, plus a separately documented **speed-axis diagnostic 20e**, all anchored to candidate 19. Each probe changes exactly one global character coefficient; all other profile values remain at candidate 19. Each is assigned **8 primary blocks/map (576 races)** plus **4 mixed blocks/map (288 races)** using the existing primary/mixed training domains and matched seeds.

| Probe | Single change from candidate 19 | Primary / mixed planned races |
|---|---|---:|
| 20a | Whale acceleration `1.03 → 1.10` | 576 / 288 |
| 20b | Grok acceleration `.79 → .70` | 576 / 288 |
| 20c | Grok acceleration `.79 → .88` | 576 / 288 |
| 20d | Grok steering `.995 → .965` | 576 / 288 |
| 20e | Grok top speed `1.030 → 1.020`; diagnostic-ineligible roster | 576 / 288 |

The prospective profile/rationale pairs are named `20a.json` / `20a-rationale.json` through `20e.json` / `20e-rationale.json`. All five planned primary/mixed batches completed before their outcomes were compared. A runtime restart interrupted the last 1,074 races; source hashes, recorded seeds, CSV row counts and every completed rotation block were verified, and only the missing 179 blocks were resumed. The completed matrix contains 4,320 races, with zero DNFs, timeouts, no-winner races and explicit rejected steps. These paired training probes are not independent validation, do not use holdout seeds and do not change the statistical acceptance criteria.


**20e is deliberately ineligible as a final roster.** GLM remains at `1.025`, above Grok's diagnostic `1.020`, so Grok temporarily loses its highest-straight-speed archetype. The actual roster speed span is **.065** (`1.025 − .960`), below the documented `.07` minimum; Grok-to-Whale alone spans `.060`. The probe is for measuring the speed axis, not for promotion or counting as an archetype-preserving candidate. Any combined roster must restore the documented main archetypes and minimum spans before full confirmation or holdout. The ineligible diagnostic remains labeled as such even though its races are complete.


### Completed paired responses

Each primary row below contains 576 races; each mixed row contains 288. The anchor is the corresponding fixed subset of candidate 19, not its full sample. These are descriptive paired training rates. Interactions between multiple coefficient changes need not add linearly.

| Cohort / trial | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|
| Primary anchor 19 | 12.85% | 19.10% | 17.01% | 15.62% | 17.19% | 18.23% |
| Primary 20a, Whale launch up | 15.62% | 17.71% | 17.36% | 17.19% | 14.41% | 17.71% |
| Primary 20b, Grok launch down | 15.45% | 19.62% | 17.88% | 18.58% | 8.51% | 19.97% |
| Primary 20c, Grok launch up | 13.72% | 17.01% | 13.54% | 14.24% | 26.91% | 14.58% |
| Primary 20d, Grok handling down | 16.32% | 18.06% | 19.62% | 22.57% | 7.12% | 16.32% |
| Primary 20e, Grok speed down | 13.89% | 16.84% | 20.49% | 17.19% | 10.59% | 21.01% |
| Mixed anchor 19 | 19.44% | 18.75% | 18.06% | 17.36% | 11.81% | 14.58% |
| Mixed 20a | 23.96% | 17.71% | 17.36% | 15.62% | 13.89% | 11.46% |
| Mixed 20b | 18.06% | 17.01% | 20.14% | 20.14% | 7.99% | 16.67% |
| Mixed 20c | 14.58% | 19.79% | 15.28% | 15.62% | 20.83% | 13.89% |
| Mixed 20d | 20.14% | 20.14% | 19.10% | 18.40% | 10.76% | 11.46% |
| Mixed 20e | 18.06% | 16.67% | 20.14% | 20.14% | 11.46% | 13.54% |

Grok's speed-only probe reduced its sampled Caldera rate from 39.58% to 22.92%, while changing mixed aggregate wins only from 11.81% to 11.46%. Its launch-up probe instead raised primary/mixed aggregate rates to 26.91%/20.83%, with Caldera at 52.08%. The direction supports a smaller joint speed reduction and launch/recovery increase, rather than another handling reduction. Caldera's speed-probe delta is −16.67 percentage points with a paired block standard error of 9.96 points: the exact magnitude is uncertain. Mean-rank and finish-gap responses support the axis distinction but do not substitute for win-rate validation.

Evidence: [paired sensitivity summary](../public/balance-results/sensitivity20/sensitivity20.summary.json), [rank/gap diagnostics](../public/balance-results/sensitivity20/sensitivity20.rank-diagnostics.json), [integrity record](../public/balance-results/sensitivity20/sensitivity20.integrity.json), [resumption record](../public/balance-results/sensitivity20/resume-20261014.json), and all ten compressed raw/CSV batches and manifests under the indexed `sensitivity20/` directory.

### Candidate 21: completed screen and full training extension

Candidate 21 applies only global profile changes from 19: Whale acceleration 1.03→1.10 and speed .960→.955; Grok acceleration .790→.835 and speed 1.030→1.025; GLM acceleration .660→.700 and speed 1.025→1.020. All handling coefficients and Gemini/GPT/Claude remain unchanged. The roster preserves all main archetypes and the declared .07 speed span.

The predeclared screen completed 8 primary blocks/map (576 races) and 4 mixed blocks/map (288 races), using the same training domains. All 148 source hashes match across both cohorts, candidate 19 and the then-current source; profiles match the candidate file. Every race completed with zero DNFs, timeouts and rejected steps. Complete seat/phase/equipment rotations and paired seed keys were checked.

| Cohort | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|
| Primary 21 screen | 16.15% | 18.06% | 15.97% | 16.67% | 16.49% | 16.67% |
| Mixed 21 screen | 17.01% | 17.36% | 15.63% | 20.14% | 15.63% | 14.24% |

The aggregate point estimates are promising, but map concentration remains: primary Whale–Coast is 43.75%, GLM–Caldera 39.58%, Grok–Caldera 27.08%, and Claude–Garden 20.83%. Whale–Coast’s paired increase is 10.42 points with a descriptive paired standard error of 10.42 points; eight blocks cannot settle whether its underlying rate satisfies the final guardrail. Whale’s Coast mean rank improved 2.77→2.33, so the concentration is not dismissed as irrelevant. The [screen analysis](../public/balance-results/candidate-21-screen.analysis.report.md) labels all interval equivalence/map checks inconclusive and provides all map rates and diagnostics.

At 13:43 UTC, the same source/profile cohort began its already-planned extension to 32 primary and 8 mixed blocks per map. It subsequently completed **2,304 primary / 576 mixed training races**. Exact screen rows were reused, with 1,728 new primary and 288 new mixed races; screen and full counts are not independent samples. Extension manifests record the original manifest/result hashes and scheduler hash.

| Completed training cohort | Whale | Gemini | GPT | Claude | Grok | GLM |
|---|---:|---:|---:|---:|---:|---:|
| Primary 21 full | 15.6684% | 18.1858% | 16.4931% | 16.0156% | 16.7101% | 16.9271% |
| Mixed 21 full | 17.7083% | 16.6667% | 17.1875% | 17.8819% | 14.7569% | 15.7986% |

The [full training analysis](../public/balance-results/candidate-21-full.analysis.report.md) passed the observed aggregate aim but left all interval/map requirements inconclusive. The later, separately frozen holdout result appears at the top of this report.

The GLM compensation, Whale speed change and joint interactions were unmeasured assumptions when this screen was chosen. A larger Claude-as-minimum-speed redesign was considered and deferred because it would require substantially larger unmeasured changes. This completed training screen is not a final-holdout result or a balance certification.

### Final preview regression correction

The later focused menu check exposed a legacy assertion that all three character multipliers must sum to 3, stay within 0.9–1.1, and also apply unchanged to water mounts. Those assumptions predate the prospectively documented land-axis bounds and the separate released water roster. Only `tests/free-mode-menu.test.ts` was corrected: it now checks the declared per-axis bounds, frozen profile objects, pairwise non-domination, land composition and the unchanged released water multipliers. The original failure was retained in development evidence. The corrected menu plus CPU-lab group passed **5/5**. No runtime, frozen input, holdout result, or statistical threshold changed; this focused run is not a full-suite certification.

## Test-mode and browser evidence

Recorded focused checks, rather than a new full-suite certification:

| Evidence | Recorded result | Boundary |
|---|---|---|
| `simulation-tests.log` | 5/5 passed: replay, identical-mechanics label rotation, seat/phase/build control, timeout/no-winner behavior, item switch and seed-domain matrix | Focused cases, not all possible maps/seeds |
| `composition-tests.log` | 32/32 passed, including pre-extraction NPC state parity on all 12 maps and distinct player/CPU contact handling | Logged source snapshot |
| `character-tests.log` | 3/3 passed: common compiler, differentiated launch/lane response, unchanged A01 coefficients under land override | Does not certify a future frozen profile |
| `grip-tests.log` | 35/35 passed in the recorded focused group | Overlaps other logs; not 35 independent new balance experiments |
| `collision-predicate-tests.log` / `collision-replay-check.log` | Predicate comparison passed; 24 exact full-race replays | Contact optimization equivalence, not roster equivalence |
| `current-check.log` | Recorded TypeScript check | Not a claim that later source edits were rechecked |

Source tests have since gained additional roster/menu/packaging assertions. A source assertion is not evidence of a passing run: the historical 3-test character log does not certify those later additions. The separate candidate-21 freeze record above supplies later focused checks; the historical logs below are not substituted for it.

[Browser QA](../public/balance-results/browser-qa.json) records cloud Chromium checks against experimental commit `401f4772f0baf6b82d5e7fc0b03bafdcf05dcc74`:

- Coast, seed `20261014`, rotation 0, normal/equal/items on: downloaded complete JSON exactly matched CLI output
- Town, seed `7`, rotation 5, hard/mixed/items off: complete JSON exactly matched CLI output; CSV was verified
- Mountain pause/resume: simulation stayed at 2 seconds across separate paused observations, then resumed to 4.28 seconds
- The 12 map choices, reset/cancel, pause/resume, difficulty, loadout, item switch, rotation, seed, JSON/CSV downloads and unfinished-report notice were inspected

The bundled `browser-qa.json` records the browser/CLI comparison; its individual `browser-parity-coast.*` and `browser-parity-town.*` exports are retained in development evidence but are not included in the current public artifact index. Those two cases check browser/CLI correspondence; they are not a 12-map visual QA sweep or independent win-rate sample. Hard and item-off are diagnostics, not primary-condition evidence. No completed easy-difficulty sensitivity batch is claimed here.

## Provenance, retention and reproduction

The packaged evidence lives under `public/balance-results/`. Its [artifact index](../public/balance-results/artifact-index.json) records each included file's byte size and SHA-256; the [status summary](../public/balance-results/summary.json) explicitly records the completed holdout and inconclusive certification. The report links this retained bundle rather than active run outputs. JSONL and CSV are distributed as gzip files. The index identifies packaged files; it is not proof that a new preview deployment has happened.

Every run's `.manifest.json` records options, seed domain, map list, block/rotation budget, timestep, lap count and SHA-256 hashes of its recorded source inputs. Candidate overrides are captured inside the manifest. Early manifests hash a smaller selection of critical files; later manifests expand that inventory. A hash identifies bytes but does not reconstruct an older source tree. For exact replay, the corresponding historical source must be available and match those hashes; the current source archive alone must not be assumed to reproduce all prior experimental variants.

- `.jsonl.gz`: gzip-compressed JSONL with one complete recorded race per row, including all six racers, actual finish/rank/lap/branch/item/contact data and the instrumented fields present in that schema
- `.csv.gz`: gzip-compressed per-character rows for inspection; it is not six independent observations per race
- `.complete.json`: created only when the entire planned batch finishes
- `.stopped.json`: retained-row count, fixed-screen definition, reason and raw-file hash for abandoned development batches
- `.analysis.report.md` / `.analysis.summary.json`: stage-labeled analysis, complete-block coverage, uncertainty, diagnostics and eligibility blockers
- `baseline.snapshot.analysis.*`: an earlier development progress snapshot, not part of the packaged evidence; superseded by the complete corrected baseline and not used as final baseline evidence here
- `runtime-pilot.*`: development execution diagnostics outside the balance domains, not part of the packaged evidence and not included in the reported balance rates

The report's counts and point estimates were recomputed from the saved completed/stopped raw data. The eight screened-and-stopped batches through candidate 09 had their JSONL hashes checked against their stop records, using the decompressed packaged data. Completed rows, six-rotation block coverage and completion-marker counts were checked through candidate 19. Completed 16–19 figures were checked against the retained raw files and analyses; their packaged JSONL/CSV files decompress to exactly the retained completed outputs. Cancelled 14/15 rows remain archived without outcome conclusions. Those historical packaging checks did not generate new balance samples. Final holdout counts and integrity are documented separately above; report generation does not itself establish deployment status.

The [lab guide](cpu-balance-lab.md) gives the supported runner and replay commands. For exact replay, use the manifest's source snapshot and profile input, not merely the same seed on a newer candidate. An explicit `--seed` is supported only for one map/one block and is diagnostic; it cannot be presented as a fresh multi-block sample. Choose a new output basename because existing raw outputs are protected from accidental overwrite.

## Limits on interpretation

- Equal-CPU win probability is conditional on this controller, normal difficulty, chosen loadout condition, authored maps and item system. It is **not a claim about equally skilled human players**, human comfort, every difficulty or every possible equipment combination
- Fixed 60 Hz removes rendering-frame variability from the balance comparison. It does not establish variable-frame-rate equivalence or device performance
- The lab's 2D map is a diagnostic view. Cloud-browser inspection and Node/headless runs do **not** establish WebGL appearance, GPU performance, animation quality, camera comfort or human driving feel
- Aggregate similarity can conceal map-specific dominance or weakness. Per-map results remain mandatory; map specialties are allowed only within the declared guardrail
- Repeated exploratory tuning on the same training seeds can overfit. Only an untouched, source-frozen holdout can address that limitation within the declared experiment
- Zero observed failures is limited to the measured inputs and instrumented conditions. Legacy observer zeros, stale logs and pending tests must not be represented as corrected current-source safety evidence
