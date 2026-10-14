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
| primary | whale | 14.06% | 11.64% | 16.48% | 0.67% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.97% | 16.22% | 21.71% | 0.76% | max-t-block-bootstrap-original-SE |
| primary | gpt | 18.27% | 15.58% | 20.96% | 0.75% | max-t-block-bootstrap-original-SE |
| primary | claude | 15.71% | 13.02% | 18.40% | 0.75% | max-t-block-bootstrap-original-SE |
| primary | grok | 15.71% | 13.14% | 18.28% | 0.71% | max-t-block-bootstrap-original-SE |
| primary | glm | 17.27% | 14.59% | 19.96% | 0.75% | max-t-block-bootstrap-original-SE |
| mixed | whale | 18.75% | 14.61% | 22.89% | 1.15% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.15% | 12.09% | 20.20% | 1.13% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.88% | 13.26% | 22.50% | 1.28% | max-t-block-bootstrap-original-SE |
| mixed | claude | 16.67% | 12.33% | 21.01% | 1.21% | max-t-block-bootstrap-original-SE |
| mixed | grok | 13.54% | 9.83% | 17.26% | 1.03% | max-t-block-bootstrap-original-SE |
| mixed | glm | 17.01% | 12.69% | 21.34% | 1.20% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 31.25% | 19.29% | 43.21% | 32 |
| coast | gemini | 13.02% | 3.42% | 22.63% | 32 |
| coast | gpt | 19.27% | 7.51% | 31.04% | 32 |
| coast | claude | 26.04% | 14.33% | 37.75% | 32 |
| coast | grok | 5.73% | 0.00% | 12.65% | 32 |
| coast | glm | 4.69% | 0.00% | 9.53% | 32 |
| mountain | whale | 2.60% | 0.00% | 6.51% | 32 |
| mountain | gemini | 19.27% | 11.15% | 27.39% | 32 |
| mountain | gpt | 13.02% | 5.07% | 20.98% | 32 |
| mountain | claude | 7.81% | 0.70% | 14.93% | 32 |
| mountain | grok | 26.04% | 16.36% | 35.72% | 32 |
| mountain | glm | 31.25% | 21.27% | 41.23% | 32 |
| town | whale | 23.96% | 14.28% | 33.64% | 32 |
| town | gemini | 17.71% | 6.31% | 29.11% | 32 |
| town | gpt | 20.31% | 12.36% | 28.27% | 32 |
| town | claude | 25.00% | 13.90% | 36.10% | 32 |
| town | grok | 7.29% | 1.95% | 12.63% | 32 |
| town | glm | 5.73% | 0.00% | 11.51% | 32 |
| quarry | whale | 22.40% | 11.10% | 33.69% | 32 |
| quarry | gemini | 20.83% | 11.51% | 30.16% | 32 |
| quarry | gpt | 16.67% | 9.55% | 23.79% | 32 |
| quarry | claude | 19.79% | 9.93% | 29.66% | 32 |
| quarry | grok | 6.77% | 0.84% | 12.70% | 32 |
| quarry | glm | 13.54% | 4.85% | 22.24% | 32 |
| forest | whale | 26.56% | 15.84% | 37.28% | 32 |
| forest | gemini | 21.87% | 11.65% | 32.10% | 32 |
| forest | gpt | 21.35% | 11.56% | 31.15% | 32 |
| forest | claude | 13.02% | 3.05% | 23.00% | 32 |
| forest | grok | 7.29% | 1.31% | 13.27% | 32 |
| forest | glm | 9.90% | 3.38% | 16.41% | 32 |
| workshop | whale | 9.90% | 1.88% | 17.91% | 32 |
| workshop | gemini | 13.02% | 4.62% | 21.42% | 32 |
| workshop | gpt | 22.92% | 13.31% | 32.53% | 32 |
| workshop | claude | 14.06% | 4.70% | 23.43% | 32 |
| workshop | grok | 20.31% | 9.98% | 30.64% | 32 |
| workshop | glm | 19.79% | 8.88% | 30.70% | 32 |
| harvest | whale | 5.21% | 0.00% | 12.04% | 32 |
| harvest | gemini | 16.15% | 7.03% | 25.27% | 32 |
| harvest | gpt | 18.23% | 8.03% | 28.43% | 32 |
| harvest | claude | 7.81% | 0.21% | 15.42% | 32 |
| harvest | grok | 28.12% | 14.82% | 41.43% | 32 |
| harvest | glm | 24.48% | 14.06% | 34.90% | 32 |
| desert | whale | 10.94% | 3.51% | 18.36% | 32 |
| desert | gemini | 26.56% | 14.57% | 38.56% | 32 |
| desert | gpt | 17.19% | 7.30% | 27.07% | 32 |
| desert | claude | 16.67% | 8.16% | 25.18% | 32 |
| desert | grok | 13.02% | 4.62% | 21.42% | 32 |
| desert | glm | 15.63% | 4.88% | 26.37% | 32 |
| snow | whale | 8.33% | 0.72% | 15.95% | 32 |
| snow | gemini | 31.77% | 22.31% | 41.23% | 32 |
| snow | gpt | 17.71% | 6.63% | 28.78% | 32 |
| snow | claude | 10.94% | 1.38% | 20.49% | 32 |
| snow | grok | 8.33% | 1.21% | 15.45% | 32 |
| snow | glm | 22.92% | 12.24% | 33.60% | 32 |
| caldera | whale | 1.04% | 0.00% | 3.65% | 32 |
| caldera | gemini | 9.37% | 2.29% | 16.46% | 32 |
| caldera | gpt | 17.71% | 9.66% | 25.75% | 32 |
| caldera | claude | 6.77% | 0.84% | 12.70% | 32 |
| caldera | grok | 39.58% | 27.32% | 51.84% | 32 |
| caldera | glm | 25.52% | 13.49% | 37.55% | 32 |
| garden | whale | 22.92% | 12.94% | 32.90% | 32 |
| garden | gemini | 16.15% | 7.43% | 24.86% | 32 |
| garden | gpt | 21.35% | 11.94% | 30.77% | 32 |
| garden | claude | 30.73% | 18.96% | 42.49% | 32 |
| garden | grok | 3.12% | 0.00% | 8.12% | 32 |
| garden | glm | 5.73% | 0.00% | 11.51% | 32 |
| airfield | whale | 3.65% | 0.00% | 8.10% | 32 |
| airfield | gemini | 21.88% | 12.38% | 31.37% | 32 |
| airfield | gpt | 13.54% | 5.72% | 21.36% | 32 |
| airfield | claude | 9.90% | 2.85% | 16.94% | 32 |
| airfield | grok | 22.92% | 11.58% | 34.26% | 32 |
| airfield | glm | 28.13% | 16.89% | 39.36% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 324 / 2304 | 0 | 324 / 298 / 329 / 334 / 397 / 622 | 134.73 / 236.16 / 300.71 | 9.36 | 8.90 | 12.98 | 0.00 | 15.22 |
| gemini | 437 / 2304 | 0 | 437 / 409 / 390 / 416 / 397 / 255 | 135.88 / 235.83 / 298.92 | 9.57 | 9.13 | 15.09 | 0.00 | 16.20 |
| gpt | 421 / 2304 | 0 | 421 / 424 / 416 / 402 / 343 / 298 | 135.07 / 236.30 / 298.87 | 9.65 | 9.19 | 13.09 | 0.00 | 16.63 |
| claude | 362 / 2304 | 0 | 362 / 396 / 389 / 370 / 438 / 349 | 134.79 / 235.80 / 299.27 | 9.63 | 9.20 | 12.87 | 0.00 | 16.56 |
| grok | 362 / 2304 | 0 | 362 / 379 / 388 / 381 / 358 / 436 | 136.97 / 237.75 / 298.60 | 9.12 | 8.66 | 14.33 | 0.00 | 15.55 |
| glm | 398 / 2304 | 0 | 398 / 398 / 392 / 401 / 371 / 344 | 136.67 / 237.11 / 298.42 | 9.48 | 9.06 | 15.25 | 0.00 | 16.21 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 108 / 576 | 0 | 108 / 82 / 61 / 58 / 61 / 206 | 135.28 / 242.89 / 320.30 | 8.51 | 7.79 | 8.76 | 0.00 | 11.85 |
| gemini | 93 / 576 | 0 | 93 / 89 / 100 / 94 / 129 / 71 | 136.58 / 240.73 / 313.49 | 8.74 | 8.07 | 10.23 | 0.00 | 12.97 |
| gpt | 103 / 576 | 0 | 103 / 95 / 103 / 85 / 107 / 83 | 134.96 / 240.11 / 312.87 | 9.03 | 8.31 | 9.07 | 0.00 | 13.39 |
| claude | 96 / 576 | 0 | 96 / 92 / 93 / 88 / 91 / 116 | 135.42 / 241.78 / 314.96 | 9.25 | 8.54 | 8.69 | 0.00 | 13.39 |
| grok | 78 / 576 | 0 | 78 / 109 / 120 / 130 / 89 / 50 | 137.04 / 241.17 / 307.90 | 9.02 | 8.37 | 9.87 | 0.00 | 13.21 |
| glm | 98 / 576 | 0 | 98 / 109 / 99 / 121 / 99 / 50 | 136.70 / 240.42 / 309.81 | 8.65 | 7.99 | 10.53 | 0.00 | 13.19 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.596433.

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
