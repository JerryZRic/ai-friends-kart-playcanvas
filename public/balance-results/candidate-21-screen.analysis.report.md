# Land CPU balance analysis

Stage: **training**. Statistical assessment: **inconclusive**. Held-out statistical certification: **inconclusive**.

Primary input: 576 races; 96 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/3456; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

## Acceptance checks

- observedTarget: **pass**
- primaryEquivalence: **inconclusive**
- mapUpperBound: **inconclusive**
- cleanPrimary: **pass**
- mixedEquivalence: **inconclusive**

Observed primary aim: 16.6667% ±3 percentage points. Joint primary intervals must lie inside ±4 points. Every per-map upper bound must be strictly below 40%. Mixed aggregate intervals must lie inside ±5 points.

## Equal-map aggregate win rates

| Cohort | Character | Rate | Simultaneous lower | Simultaneous upper | Cluster SE | Method |
|---|---|---:|---:|---:|---:|---|
| primary | whale | 16.15% | 11.60% | 20.69% | 1.37% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.06% | 12.93% | 23.18% | 1.54% | max-t-block-bootstrap-original-SE |
| primary | gpt | 15.97% | 10.71% | 21.24% | 1.58% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.67% | 11.77% | 21.57% | 1.47% | max-t-block-bootstrap-original-SE |
| primary | grok | 16.49% | 11.44% | 21.55% | 1.52% | max-t-block-bootstrap-original-SE |
| primary | glm | 16.67% | 11.05% | 22.28% | 1.69% | max-t-block-bootstrap-original-SE |
| mixed | whale | 17.01% | 11.01% | 23.02% | 1.80% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 17.36% | 11.25% | 23.47% | 1.84% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 15.62% | 9.33% | 21.92% | 1.89% | max-t-block-bootstrap-original-SE |
| mixed | claude | 20.14% | 14.48% | 25.80% | 1.70% | max-t-block-bootstrap-original-SE |
| mixed | grok | 15.63% | 9.48% | 21.77% | 1.85% | max-t-block-bootstrap-original-SE |
| mixed | glm | 14.24% | 8.86% | 19.61% | 1.62% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 43.75% | 18.22% | 69.28% | 8 |
| coast | gemini | 8.33% | 0.00% | 23.15% | 8 |
| coast | gpt | 4.17% | 0.00% | 13.24% | 8 |
| coast | claude | 31.25% | 14.89% | 47.61% | 8 |
| coast | grok | 6.25% | 0.00% | 16.39% | 8 |
| coast | glm | 6.25% | 0.00% | 16.39% | 8 |
| mountain | whale | 2.08% | 0.00% | 9.01% | 8 |
| mountain | gemini | 16.67% | 0.00% | 37.62% | 8 |
| mountain | gpt | 8.33% | 0.00% | 18.81% | 8 |
| mountain | claude | 8.33% | 0.00% | 23.15% | 8 |
| mountain | grok | 31.25% | 11.83% | 50.67% | 8 |
| mountain | glm | 33.33% | 0.20% | 66.46% | 8 |
| town | whale | 29.17% | 8.88% | 49.46% | 8 |
| town | gemini | 12.50% | 0.00% | 26.36% | 8 |
| town | gpt | 20.83% | 0.00% | 51.82% | 8 |
| town | claude | 29.17% | 0.00% | 58.33% | 8 |
| town | grok | 2.08% | 0.00% | 9.01% | 8 |
| town | glm | 6.25% | 0.00% | 16.39% | 8 |
| quarry | whale | 35.42% | 22.86% | 47.98% | 8 |
| quarry | gemini | 18.75% | 6.19% | 31.31% | 8 |
| quarry | gpt | 10.42% | 0.00% | 25.00% | 8 |
| quarry | claude | 20.83% | 3.46% | 38.21% | 8 |
| quarry | grok | 8.33% | 0.00% | 18.81% | 8 |
| quarry | glm | 6.25% | 0.00% | 20.83% | 8 |
| forest | whale | 18.75% | 0.00% | 38.17% | 8 |
| forest | gemini | 16.67% | 6.19% | 27.14% | 8 |
| forest | gpt | 25.00% | 1.57% | 48.43% | 8 |
| forest | claude | 25.00% | 14.52% | 35.48% | 8 |
| forest | grok | 6.25% | 0.00% | 16.39% | 8 |
| forest | glm | 8.33% | 0.00% | 23.15% | 8 |
| workshop | whale | 8.33% | 0.00% | 18.81% | 8 |
| workshop | gemini | 25.00% | 1.57% | 48.43% | 8 |
| workshop | gpt | 20.83% | 0.00% | 43.67% | 8 |
| workshop | claude | 16.67% | 0.00% | 44.39% | 8 |
| workshop | grok | 16.67% | 1.85% | 31.48% | 8 |
| workshop | glm | 12.50% | 0.00% | 26.36% | 8 |
| harvest | whale | 4.17% | 0.00% | 13.24% | 8 |
| harvest | gemini | 14.58% | 0.00% | 39.01% | 8 |
| harvest | gpt | 14.58% | 0.00% | 30.94% | 8 |
| harvest | claude | 4.17% | 0.00% | 18.03% | 8 |
| harvest | grok | 31.25% | 9.18% | 53.32% | 8 |
| harvest | glm | 31.25% | 2.68% | 59.82% | 8 |
| desert | whale | 10.42% | 0.00% | 28.37% | 8 |
| desert | gemini | 33.33% | 12.38% | 54.29% | 8 |
| desert | gpt | 18.75% | 2.39% | 35.11% | 8 |
| desert | claude | 14.58% | 2.02% | 27.14% | 8 |
| desert | grok | 10.42% | 0.00% | 25.00% | 8 |
| desert | glm | 12.50% | 0.00% | 26.36% | 8 |
| snow | whale | 6.25% | 0.00% | 20.83% | 8 |
| snow | gemini | 35.42% | 10.99% | 59.85% | 8 |
| snow | gpt | 8.33% | 0.00% | 18.81% | 8 |
| snow | claude | 12.50% | 3.43% | 21.57% | 8 |
| snow | grok | 25.00% | 4.05% | 45.95% | 8 |
| snow | glm | 12.50% | 0.00% | 26.36% | 8 |
| caldera | whale | 2.08% | 0.00% | 9.01% | 8 |
| caldera | gemini | 10.42% | 0.00% | 25.00% | 8 |
| caldera | gpt | 14.58% | 0.00% | 34.01% | 8 |
| caldera | claude | 6.25% | 0.00% | 16.39% | 8 |
| caldera | grok | 27.08% | 0.00% | 64.77% | 8 |
| caldera | glm | 39.58% | 8.26% | 70.90% | 8 |
| garden | whale | 25.00% | 4.05% | 45.95% | 8 |
| garden | gemini | 12.50% | 0.00% | 26.36% | 8 |
| garden | gpt | 22.92% | 4.96% | 40.87% | 8 |
| garden | claude | 20.83% | 6.97% | 34.69% | 8 |
| garden | grok | 12.50% | 3.43% | 21.57% | 8 |
| garden | glm | 6.25% | 0.00% | 16.39% | 8 |
| airfield | whale | 8.33% | 0.00% | 18.81% | 8 |
| airfield | gemini | 12.50% | 3.43% | 21.57% | 8 |
| airfield | gpt | 22.92% | 8.33% | 37.50% | 8 |
| airfield | claude | 10.42% | 0.00% | 25.00% | 8 |
| airfield | grok | 20.83% | 11.76% | 29.91% | 8 |
| airfield | glm | 25.00% | 6.85% | 43.15% | 8 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 93 / 576 | 0 | 93 / 73 / 65 / 84 / 103 / 158 | 134.08 / 236.44 / 300.47 | 9.44 | 9.00 | 12.97 | 0.00 | 15.74 |
| gemini | 104 / 576 | 0 | 104 / 111 / 92 / 98 / 86 / 85 | 136.46 / 236.54 / 298.17 | 9.51 | 9.06 | 15.61 | 0.00 | 16.33 |
| gpt | 92 / 576 | 0 | 92 / 100 / 123 / 99 / 95 / 67 | 136.42 / 236.42 / 298.73 | 9.64 | 9.19 | 13.29 | 0.00 | 16.67 |
| claude | 96 / 576 | 0 | 96 / 97 / 98 / 91 / 104 / 90 | 135.05 / 236.29 / 299.55 | 9.76 | 9.33 | 13.06 | 0.00 | 16.56 |
| grok | 95 / 576 | 0 | 95 / 99 / 82 / 113 / 95 / 92 | 136.92 / 237.00 / 297.89 | 9.55 | 9.11 | 14.49 | 0.00 | 16.73 |
| glm | 96 / 576 | 0 | 96 / 96 / 116 / 91 / 93 / 84 | 137.22 / 236.62 / 297.46 | 9.30 | 8.87 | 15.44 | 0.00 | 16.55 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 1728/1728 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 49 / 288 | 0 | 49 / 45 / 32 / 24 / 35 / 103 | 134.43 / 244.19 / 321.09 | 7.93 | 7.26 | 8.79 | 0.00 | 11.79 |
| gemini | 50 / 288 | 0 | 50 / 50 / 49 / 43 / 61 / 35 | 135.36 / 240.85 / 313.53 | 8.87 | 8.20 | 10.00 | 0.00 | 12.56 |
| gpt | 45 / 288 | 0 | 45 / 57 / 51 / 41 / 54 / 40 | 135.26 / 241.64 / 313.63 | 9.17 | 8.50 | 9.42 | 0.00 | 13.42 |
| claude | 58 / 288 | 0 | 58 / 39 / 45 / 46 / 46 / 54 | 135.41 / 241.74 / 316.46 | 8.58 | 7.87 | 9.04 | 0.00 | 12.93 |
| grok | 45 / 288 | 0 | 45 / 48 / 61 / 71 / 37 / 26 | 136.13 / 241.84 / 309.27 | 8.80 | 8.17 | 9.67 | 0.00 | 13.27 |
| glm | 41 / 288 | 0 | 41 / 49 / 50 / 63 / 55 / 30 | 137.12 / 241.39 / 310.98 | 8.43 | 7.76 | 10.61 | 0.00 | 13.36 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.326337.

Bootstrap coverage is approximate. Degenerate/one-block endpoints use conservative weighted Hoeffding bounds. Individual races and racers are never independent bootstrap observations.

Win rates retain all six rotations in each complete block, including DNF/no-winner races. Raw diagnostics retain every input row. Finish-time summaries condition on finishers; lap-time summaries condition on recorded laps. Raw pooled diagnostics are not equal-map estimands.

Fail means a failed observed/safety criterion or an interval fully beyond a permitted boundary. Inconclusive means insufficient precision, missing coverage, or unverified holdout eligibility. A pass applies only to the stated statistical checks.

Statistical criteria only. Candidate freezing, untouched holdout provenance, identical-role controls, deterministic replay, archetype ordering, and source-integrity review require separate evidence.

## Certification blockers

- Primary: Requires at least 128 independent complete blocks per map
- Primary: Nonempty runtime profile overrides are prohibited for holdout certification; bake the candidate roster into source
- Mixed: Requires at least 64 independent complete blocks per map
- Mixed: Nonempty runtime profile overrides are prohibited for holdout certification; bake the candidate roster into source
- Training/exploratory data cannot certify held-out balance
- Primary independent holdout seed domain is unverified
- Mixed independent holdout seed domain is unverified

## Warnings

- Uncertainty is descriptive only: training/exploratory outcomes are not independent confirmation of a tuned candidate
