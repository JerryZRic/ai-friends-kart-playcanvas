# Land CPU balance analysis

Stage: **training**. Statistical assessment: **fail**. Held-out statistical certification: **inconclusive**.

Primary input: 2304 races; 384 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/13824; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

## Acceptance checks

- observedTarget: **fail**
- primaryEquivalence: **fail**
- mapUpperBound: **fail**
- cleanPrimary: **pass**
- mixedEquivalence: **inconclusive**

Observed primary aim: 16.6667% ±3 percentage points. Joint primary intervals must lie inside ±4 points. Every per-map upper bound must be strictly below 40%. Mixed aggregate intervals must lie inside ±5 points.

## Equal-map aggregate win rates

| Cohort | Character | Rate | Simultaneous lower | Simultaneous upper | Cluster SE | Method |
|---|---|---:|---:|---:|---:|---|
| primary | whale | 0.00% | 0.00% | 10.67% | 0.00% | bounded-block fallback |
| primary | gemini | 0.65% | 0.07% | 1.23% | 0.16% | max-t-block-bootstrap-original-SE |
| primary | gpt | 0.65% | 0.03% | 1.28% | 0.17% | max-t-block-bootstrap-original-SE |
| primary | claude | 0.09% | 0.00% | 0.30% | 0.06% | max-t-block-bootstrap-original-SE |
| primary | grok | 92.62% | 90.83% | 94.41% | 0.50% | max-t-block-bootstrap-original-SE |
| primary | glm | 5.99% | 4.31% | 7.67% | 0.47% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 0.00% | 0.00% | 36.95% | 32 |
| coast | gemini | 5.21% | 0.00% | 10.87% | 32 |
| coast | gpt | 5.21% | 0.00% | 11.48% | 32 |
| coast | claude | 1.04% | 0.00% | 3.65% | 32 |
| coast | grok | 66.15% | 54.27% | 78.02% | 32 |
| coast | glm | 22.40% | 12.12% | 32.68% | 32 |
| mountain | whale | 0.00% | 0.00% | 36.95% | 32 |
| mountain | gemini | 0.00% | 0.00% | 36.95% | 32 |
| mountain | gpt | 0.52% | 0.00% | 2.39% | 32 |
| mountain | claude | 0.00% | 0.00% | 36.95% | 32 |
| mountain | grok | 97.40% | 93.49% | 100.00% | 32 |
| mountain | glm | 2.08% | 0.00% | 5.64% | 32 |
| town | whale | 0.00% | 0.00% | 36.95% | 32 |
| town | gemini | 1.56% | 0.00% | 4.70% | 32 |
| town | gpt | 0.52% | 0.00% | 2.39% | 32 |
| town | claude | 0.00% | 0.00% | 36.95% | 32 |
| town | grok | 86.46% | 77.77% | 95.15% | 32 |
| town | glm | 11.46% | 3.20% | 19.72% | 32 |
| quarry | whale | 0.00% | 0.00% | 36.95% | 32 |
| quarry | gemini | 0.52% | 0.00% | 2.39% | 32 |
| quarry | gpt | 0.00% | 0.00% | 36.95% | 32 |
| quarry | claude | 0.00% | 0.00% | 36.95% | 32 |
| quarry | grok | 94.27% | 88.50% | 100.00% | 32 |
| quarry | glm | 5.21% | 0.00% | 10.87% | 32 |
| forest | whale | 0.00% | 0.00% | 36.95% | 32 |
| forest | gemini | 0.00% | 0.00% | 36.95% | 32 |
| forest | gpt | 0.00% | 0.00% | 36.95% | 32 |
| forest | claude | 0.00% | 0.00% | 36.95% | 32 |
| forest | grok | 94.79% | 89.81% | 99.78% | 32 |
| forest | glm | 5.21% | 0.22% | 10.19% | 32 |
| workshop | whale | 0.00% | 0.00% | 36.95% | 32 |
| workshop | gemini | 0.00% | 0.00% | 36.95% | 32 |
| workshop | gpt | 0.00% | 0.00% | 36.95% | 32 |
| workshop | claude | 0.00% | 0.00% | 36.95% | 32 |
| workshop | grok | 93.75% | 87.89% | 99.61% | 32 |
| workshop | glm | 6.25% | 0.39% | 12.11% | 32 |
| harvest | whale | 0.00% | 0.00% | 36.95% | 32 |
| harvest | gemini | 0.00% | 0.00% | 36.95% | 32 |
| harvest | gpt | 1.56% | 0.00% | 4.70% | 32 |
| harvest | claude | 0.00% | 0.00% | 36.95% | 32 |
| harvest | grok | 90.62% | 82.58% | 98.67% | 32 |
| harvest | glm | 7.81% | 0.21% | 15.41% | 32 |
| desert | whale | 0.00% | 0.00% | 36.95% | 32 |
| desert | gemini | 0.00% | 0.00% | 36.95% | 32 |
| desert | gpt | 0.00% | 0.00% | 36.95% | 32 |
| desert | claude | 0.00% | 0.00% | 36.95% | 32 |
| desert | grok | 98.44% | 95.30% | 100.00% | 32 |
| desert | glm | 1.56% | 0.00% | 4.70% | 32 |
| snow | whale | 0.00% | 0.00% | 36.95% | 32 |
| snow | gemini | 0.52% | 0.00% | 2.39% | 32 |
| snow | gpt | 0.00% | 0.00% | 36.95% | 32 |
| snow | claude | 0.00% | 0.00% | 36.95% | 32 |
| snow | grok | 97.92% | 94.36% | 100.00% | 32 |
| snow | glm | 1.56% | 0.00% | 4.70% | 32 |
| caldera | whale | 0.00% | 0.00% | 36.95% | 32 |
| caldera | gemini | 0.00% | 0.00% | 36.95% | 32 |
| caldera | gpt | 0.00% | 0.00% | 36.95% | 32 |
| caldera | claude | 0.00% | 0.00% | 36.95% | 32 |
| caldera | grok | 98.96% | 96.35% | 100.00% | 32 |
| caldera | glm | 1.04% | 0.00% | 3.65% | 32 |
| garden | whale | 0.00% | 0.00% | 36.95% | 32 |
| garden | gemini | 0.00% | 0.00% | 36.95% | 32 |
| garden | gpt | 0.00% | 0.00% | 36.95% | 32 |
| garden | claude | 0.00% | 0.00% | 36.95% | 32 |
| garden | grok | 98.44% | 95.30% | 100.00% | 32 |
| garden | glm | 1.56% | 0.00% | 4.70% | 32 |
| airfield | whale | 0.00% | 0.00% | 36.95% | 32 |
| airfield | gemini | 0.00% | 0.00% | 36.95% | 32 |
| airfield | gpt | 0.00% | 0.00% | 36.95% | 32 |
| airfield | claude | 0.00% | 0.00% | 36.95% | 32 |
| airfield | grok | 94.27% | 88.50% | 100.00% | 32 |
| airfield | glm | 5.73% | 0.00% | 11.50% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 0 / 2304 | 0 | 0 / 0 / 2 / 12 / 54 / 2236 | 122.34 / 229.63 / 300.15 | 4.70 | 3.75 | 5.52 | 0.00 | 4.41 |
| gemini | 15 / 2304 | 0 | 15 / 103 / 898 / 1148 / 125 / 15 | 118.52 / 215.95 / 281.15 | 8.12 | 7.32 | 8.30 | 0.00 | 11.26 |
| gpt | 15 / 2304 | 0 | 15 / 164 / 1106 / 895 / 116 / 8 | 117.65 / 215.64 / 280.26 | 8.36 | 7.53 | 7.97 | 0.00 | 11.52 |
| claude | 2 / 2304 | 0 | 2 / 14 / 65 / 184 / 1994 / 45 | 119.65 / 222.44 / 289.91 | 7.06 | 6.20 | 7.49 | 0.00 | 9.09 |
| grok | 2134 / 2304 | 0 | 2134 / 136 / 17 / 15 / 2 / 0 | 111.85 / 200.03 / 260.99 | 5.30 | 4.35 | 5.07 | 0.00 | 9.68 |
| glm | 138 / 2304 | 0 | 138 / 1887 / 216 / 50 / 13 / 0 | 115.72 / 208.03 / 271.26 | 7.71 | 6.84 | 7.09 | 0.00 | 11.96 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 78 joint endpoints; critical max-t 3.593976.

Bootstrap coverage is approximate. Degenerate/one-block endpoints use conservative weighted Hoeffding bounds. Individual races and racers are never independent bootstrap observations.

Win rates retain all six rotations in each complete block, including DNF/no-winner races. Raw diagnostics retain every input row. Finish-time summaries condition on finishers; lap-time summaries condition on recorded laps. Raw pooled diagnostics are not equal-map estimands.

Fail means a failed observed/safety criterion or an interval fully beyond a permitted boundary. Inconclusive means insufficient precision, missing coverage, or unverified holdout eligibility. A pass applies only to the stated statistical checks.

Statistical criteria only. Candidate freezing, untouched holdout provenance, identical-role controls, deterministic replay, archetype ordering, and source-integrity review require separate evidence.

## Certification blockers

- Primary: Requires at least 128 independent complete blocks per map
- Mixed-equipment holdout not supplied
- Training/exploratory data cannot certify held-out balance
- Primary independent holdout seed domain is unverified

## Warnings

- Uncertainty is descriptive only: training/exploratory outcomes are not independent confirmation of a tuned candidate
- 40 degenerate/one-block endpoints use conservative bounded-block fallback, not a zero-width bootstrap interval
