# Land CPU balance analysis

Stage: **training**. Statistical assessment: **inconclusive**. Held-out statistical certification: **inconclusive**.

Primary input: 2304 races; 384 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/13824; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

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
| primary | whale | 15.15% | 12.71% | 17.58% | 0.68% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.97% | 15.99% | 21.94% | 0.83% | max-t-block-bootstrap-original-SE |
| primary | gpt | 16.49% | 13.67% | 19.32% | 0.79% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.97% | 14.15% | 19.79% | 0.79% | max-t-block-bootstrap-original-SE |
| primary | grok | 16.54% | 13.65% | 19.42% | 0.80% | max-t-block-bootstrap-original-SE |
| primary | glm | 15.89% | 13.22% | 18.55% | 0.74% | max-t-block-bootstrap-original-SE |
| mixed | whale | 18.92% | 15.05% | 22.79% | 1.08% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.49% | 12.17% | 20.82% | 1.21% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 18.58% | 14.71% | 22.45% | 1.08% | max-t-block-bootstrap-original-SE |
| mixed | claude | 17.19% | 12.72% | 21.65% | 1.25% | max-t-block-bootstrap-original-SE |
| mixed | grok | 14.76% | 10.57% | 18.94% | 1.17% | max-t-block-bootstrap-original-SE |
| mixed | glm | 14.06% | 10.44% | 17.68% | 1.01% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 41.15% | 29.47% | 52.82% | 32 |
| coast | gemini | 10.94% | 1.81% | 20.07% | 32 |
| coast | gpt | 13.02% | 4.24% | 21.80% | 32 |
| coast | claude | 19.79% | 9.26% | 30.32% | 32 |
| coast | grok | 7.81% | 1.83% | 13.80% | 32 |
| coast | glm | 7.29% | 0.23% | 14.35% | 32 |
| mountain | whale | 2.60% | 0.00% | 6.50% | 32 |
| mountain | gemini | 23.44% | 12.43% | 34.44% | 32 |
| mountain | gpt | 13.02% | 4.66% | 21.38% | 32 |
| mountain | claude | 10.42% | 3.45% | 17.38% | 32 |
| mountain | grok | 26.04% | 14.69% | 37.39% | 32 |
| mountain | glm | 24.48% | 14.82% | 34.14% | 32 |
| town | whale | 26.04% | 15.34% | 36.74% | 32 |
| town | gemini | 14.58% | 5.01% | 24.15% | 32 |
| town | gpt | 16.15% | 7.06% | 25.23% | 32 |
| town | claude | 25.52% | 14.15% | 36.89% | 32 |
| town | grok | 10.42% | 2.05% | 18.79% | 32 |
| town | glm | 7.29% | 1.34% | 13.25% | 32 |
| quarry | whale | 26.04% | 16.40% | 35.68% | 32 |
| quarry | gemini | 17.71% | 7.01% | 28.41% | 32 |
| quarry | gpt | 14.06% | 4.36% | 23.77% | 32 |
| quarry | claude | 21.35% | 9.60% | 33.11% | 32 |
| quarry | grok | 8.85% | 0.82% | 16.89% | 32 |
| quarry | glm | 11.98% | 4.29% | 19.67% | 32 |
| forest | whale | 28.12% | 16.31% | 39.94% | 32 |
| forest | gemini | 17.19% | 6.31% | 28.07% | 32 |
| forest | gpt | 18.23% | 7.72% | 28.73% | 32 |
| forest | claude | 18.75% | 7.78% | 29.72% | 32 |
| forest | grok | 9.90% | 2.88% | 16.92% | 32 |
| forest | glm | 7.81% | 1.83% | 13.80% | 32 |
| workshop | whale | 8.33% | 0.75% | 15.91% | 32 |
| workshop | gemini | 24.48% | 15.60% | 33.36% | 32 |
| workshop | gpt | 17.71% | 6.68% | 28.74% | 32 |
| workshop | claude | 9.90% | 2.38% | 17.41% | 32 |
| workshop | grok | 21.35% | 10.23% | 32.48% | 32 |
| workshop | glm | 18.23% | 8.81% | 27.65% | 32 |
| harvest | whale | 3.65% | 0.00% | 8.08% | 32 |
| harvest | gemini | 18.75% | 9.18% | 28.32% | 32 |
| harvest | gpt | 14.06% | 5.54% | 22.58% | 32 |
| harvest | claude | 9.90% | 2.38% | 17.41% | 32 |
| harvest | grok | 26.56% | 15.56% | 37.57% | 32 |
| harvest | glm | 27.08% | 15.79% | 38.38% | 32 |
| desert | whale | 10.94% | 3.07% | 18.80% | 32 |
| desert | gemini | 20.83% | 8.85% | 32.82% | 32 |
| desert | gpt | 18.75% | 10.82% | 26.68% | 32 |
| desert | claude | 19.27% | 8.51% | 30.03% | 32 |
| desert | grok | 12.50% | 4.46% | 20.54% | 32 |
| desert | glm | 17.71% | 6.68% | 28.74% | 32 |
| snow | whale | 7.29% | 0.23% | 14.35% | 32 |
| snow | gemini | 32.29% | 19.74% | 44.85% | 32 |
| snow | gpt | 13.54% | 3.72% | 23.37% | 32 |
| snow | claude | 15.63% | 5.98% | 25.27% | 32 |
| snow | grok | 10.94% | 3.54% | 18.33% | 32 |
| snow | glm | 20.31% | 10.38% | 30.25% | 32 |
| caldera | whale | 0.00% | 0.00% | 37.11% | 32 |
| caldera | gemini | 10.94% | 2.63% | 19.25% | 32 |
| caldera | gpt | 20.31% | 7.25% | 33.37% | 32 |
| caldera | claude | 8.33% | 1.77% | 14.90% | 32 |
| caldera | grok | 39.58% | 22.68% | 56.48% | 32 |
| caldera | glm | 20.83% | 10.80% | 30.86% | 32 |
| garden | whale | 22.40% | 10.83% | 33.96% | 32 |
| garden | gemini | 10.94% | 3.54% | 18.33% | 32 |
| garden | gpt | 22.40% | 12.88% | 31.91% | 32 |
| garden | claude | 35.42% | 22.92% | 47.92% | 32 |
| garden | grok | 5.21% | 0.24% | 10.18% | 32 |
| garden | glm | 3.65% | 0.00% | 8.83% | 32 |
| airfield | whale | 5.21% | 0.00% | 10.85% | 32 |
| airfield | gemini | 25.52% | 13.24% | 37.80% | 32 |
| airfield | gpt | 16.67% | 6.64% | 26.70% | 32 |
| airfield | claude | 9.37% | 0.51% | 18.24% | 32 |
| airfield | grok | 19.27% | 6.11% | 32.43% | 32 |
| airfield | glm | 23.96% | 10.31% | 37.61% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 349 / 2304 | 0 | 349 / 289 / 307 / 357 / 346 / 656 | 134.10 / 236.36 / 301.13 | 9.48 | 9.02 | 13.29 | 0.00 | 15.62 |
| gemini | 437 / 2304 | 0 | 437 / 430 / 384 / 402 / 363 / 288 | 135.42 / 236.49 / 299.11 | 9.63 | 9.18 | 15.20 | 0.00 | 16.26 |
| gpt | 380 / 2304 | 0 | 380 / 417 / 452 / 416 / 369 / 270 | 135.40 / 235.64 / 299.25 | 9.60 | 9.15 | 13.41 | 0.00 | 16.74 |
| claude | 391 / 2304 | 0 | 391 / 387 / 416 / 354 / 405 / 351 | 134.72 / 235.44 / 299.74 | 9.73 | 9.29 | 12.99 | 0.00 | 16.53 |
| grok | 381 / 2304 | 0 | 381 / 390 / 359 / 367 / 400 / 407 | 136.54 / 237.68 / 298.99 | 9.21 | 8.79 | 14.60 | 0.00 | 15.96 |
| glm | 366 / 2304 | 0 | 366 / 391 / 386 / 408 / 421 / 332 | 136.65 / 237.20 / 298.83 | 9.14 | 8.71 | 15.33 | 0.00 | 15.91 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 109 / 576 | 0 | 109 / 81 / 74 / 48 / 55 / 209 | 133.39 / 243.81 / 321.22 | 7.96 | 7.20 | 8.60 | 0.00 | 11.30 |
| gemini | 95 / 576 | 0 | 95 / 87 / 94 / 104 / 121 / 75 | 136.58 / 241.01 / 313.41 | 8.57 | 7.89 | 9.84 | 0.00 | 12.95 |
| gpt | 107 / 576 | 0 | 107 / 111 / 91 / 104 / 97 / 66 | 134.35 / 240.93 / 313.46 | 8.91 | 8.19 | 8.94 | 0.00 | 12.61 |
| claude | 99 / 576 | 0 | 99 / 104 / 104 / 72 / 98 / 99 | 134.36 / 241.68 / 315.15 | 8.82 | 8.12 | 8.47 | 0.00 | 12.50 |
| grok | 85 / 576 | 0 | 85 / 99 / 116 / 112 / 96 / 68 | 136.43 / 240.65 / 309.83 | 8.84 | 8.15 | 10.02 | 0.00 | 13.12 |
| glm | 81 / 576 | 0 | 81 / 94 / 97 / 136 / 109 / 59 | 136.85 / 241.97 / 310.64 | 9.01 | 8.34 | 10.76 | 0.00 | 13.73 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.581562.

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
- 1 degenerate/one-block endpoints use conservative bounded-block fallback, not a zero-width bootstrap interval
