# Land CPU balance analysis

Stage: **training**. Statistical assessment: **fail**. Held-out statistical certification: **inconclusive**.

Primary input: 2304 races; 384 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/13824; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

## Acceptance checks

- observedTarget: **fail**
- primaryEquivalence: **inconclusive**
- mapUpperBound: **inconclusive**
- cleanPrimary: **pass**
- mixedEquivalence: **inconclusive**

Observed primary aim: 16.6667% ±3 percentage points. Joint primary intervals must lie inside ±4 points. Every per-map upper bound must be strictly below 40%. Mixed aggregate intervals must lie inside ±5 points.

## Equal-map aggregate win rates

| Cohort | Character | Rate | Simultaneous lower | Simultaneous upper | Cluster SE | Method |
|---|---|---:|---:|---:|---:|---|
| primary | whale | 12.59% | 10.19% | 14.98% | 0.66% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.27% | 15.57% | 20.98% | 0.75% | max-t-block-bootstrap-original-SE |
| primary | gpt | 18.92% | 15.94% | 21.90% | 0.82% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.45% | 13.69% | 19.21% | 0.76% | max-t-block-bootstrap-original-SE |
| primary | grok | 16.80% | 14.17% | 19.42% | 0.73% | max-t-block-bootstrap-original-SE |
| primary | glm | 16.97% | 14.34% | 19.60% | 0.73% | max-t-block-bootstrap-original-SE |
| mixed | whale | 18.58% | 14.41% | 22.75% | 1.15% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 18.40% | 14.33% | 22.47% | 1.13% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.36% | 13.04% | 21.68% | 1.20% | max-t-block-bootstrap-original-SE |
| mixed | claude | 16.49% | 12.27% | 20.72% | 1.17% | max-t-block-bootstrap-original-SE |
| mixed | grok | 13.02% | 9.40% | 16.64% | 1.00% | max-t-block-bootstrap-original-SE |
| mixed | glm | 16.15% | 12.15% | 20.14% | 1.10% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 26.56% | 15.13% | 38.00% | 32 |
| coast | gemini | 14.58% | 6.13% | 23.03% | 32 |
| coast | gpt | 21.35% | 10.45% | 32.26% | 32 |
| coast | claude | 21.88% | 9.94% | 33.81% | 32 |
| coast | grok | 11.46% | 3.60% | 19.32% | 32 |
| coast | glm | 4.17% | 0.00% | 8.85% | 32 |
| mountain | whale | 3.12% | 0.00% | 7.35% | 32 |
| mountain | gemini | 16.15% | 6.58% | 25.71% | 32 |
| mountain | gpt | 13.54% | 4.39% | 22.69% | 32 |
| mountain | claude | 8.85% | 1.70% | 16.01% | 32 |
| mountain | grok | 27.08% | 17.81% | 36.36% | 32 |
| mountain | glm | 31.25% | 18.34% | 44.16% | 32 |
| town | whale | 18.75% | 9.88% | 27.62% | 32 |
| town | gemini | 14.58% | 5.31% | 23.86% | 32 |
| town | gpt | 23.96% | 11.87% | 36.04% | 32 |
| town | claude | 20.83% | 11.08% | 30.59% | 32 |
| town | grok | 10.94% | 2.12% | 19.75% | 32 |
| town | glm | 10.94% | 3.47% | 18.40% | 32 |
| quarry | whale | 19.79% | 9.16% | 30.42% | 32 |
| quarry | gemini | 18.75% | 8.36% | 29.14% | 32 |
| quarry | gpt | 17.19% | 6.54% | 27.84% | 32 |
| quarry | claude | 23.44% | 13.36% | 33.51% | 32 |
| quarry | grok | 7.81% | 0.66% | 14.96% | 32 |
| quarry | glm | 13.02% | 5.02% | 21.02% | 32 |
| forest | whale | 24.48% | 12.08% | 36.88% | 32 |
| forest | gemini | 20.83% | 9.35% | 32.32% | 32 |
| forest | gpt | 15.62% | 7.09% | 24.16% | 32 |
| forest | claude | 20.83% | 9.35% | 32.32% | 32 |
| forest | grok | 6.25% | 0.35% | 12.15% | 32 |
| forest | glm | 11.98% | 2.91% | 21.05% | 32 |
| workshop | whale | 6.77% | 0.22% | 13.32% | 32 |
| workshop | gemini | 23.44% | 14.94% | 31.94% | 32 |
| workshop | gpt | 16.67% | 6.19% | 27.15% | 32 |
| workshop | claude | 10.42% | 2.88% | 17.95% | 32 |
| workshop | grok | 20.83% | 10.71% | 30.96% | 32 |
| workshop | glm | 21.88% | 10.25% | 33.50% | 32 |
| harvest | whale | 4.17% | 0.00% | 10.22% | 32 |
| harvest | gemini | 18.75% | 10.74% | 26.76% | 32 |
| harvest | gpt | 21.35% | 9.18% | 33.53% | 32 |
| harvest | claude | 9.90% | 3.34% | 16.45% | 32 |
| harvest | grok | 24.48% | 12.69% | 36.27% | 32 |
| harvest | glm | 21.35% | 11.51% | 31.20% | 32 |
| desert | whale | 11.46% | 4.08% | 18.84% | 32 |
| desert | gemini | 26.04% | 15.94% | 36.15% | 32 |
| desert | gpt | 20.31% | 10.65% | 29.97% | 32 |
| desert | claude | 14.58% | 7.05% | 22.12% | 32 |
| desert | grok | 13.02% | 4.15% | 21.89% | 32 |
| desert | glm | 14.58% | 6.58% | 22.59% | 32 |
| snow | whale | 10.42% | 2.41% | 18.42% | 32 |
| snow | gemini | 23.96% | 12.18% | 35.74% | 32 |
| snow | gpt | 17.19% | 8.02% | 26.36% | 32 |
| snow | claude | 12.50% | 2.74% | 22.26% | 32 |
| snow | grok | 16.15% | 7.38% | 24.91% | 32 |
| snow | glm | 19.79% | 9.87% | 29.71% | 32 |
| caldera | whale | 0.52% | 0.00% | 2.40% | 32 |
| caldera | gemini | 6.77% | 0.22% | 13.32% | 32 |
| caldera | gpt | 17.19% | 6.20% | 28.18% | 32 |
| caldera | claude | 11.46% | 2.31% | 20.61% | 32 |
| caldera | grok | 39.58% | 26.39% | 52.77% | 32 |
| caldera | glm | 24.48% | 15.51% | 33.45% | 32 |
| garden | whale | 19.27% | 9.11% | 29.44% | 32 |
| garden | gemini | 12.50% | 3.13% | 21.87% | 32 |
| garden | gpt | 21.35% | 11.89% | 30.82% | 32 |
| garden | claude | 32.81% | 19.15% | 46.47% | 32 |
| garden | grok | 5.21% | 0.19% | 10.23% | 32 |
| garden | glm | 8.85% | 1.70% | 16.01% | 32 |
| airfield | whale | 5.73% | 0.59% | 10.87% | 32 |
| airfield | gemini | 22.92% | 15.38% | 30.45% | 32 |
| airfield | gpt | 21.35% | 11.51% | 31.20% | 32 |
| airfield | claude | 9.90% | 2.81% | 16.98% | 32 |
| airfield | grok | 18.75% | 9.47% | 28.03% | 32 |
| airfield | glm | 21.35% | 12.28% | 30.43% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 290 / 2304 | 0 | 290 / 322 / 382 / 365 / 366 / 579 | 135.15 / 236.32 / 300.74 | 9.43 | 8.99 | 13.45 | 0.00 | 15.66 |
| gemini | 421 / 2304 | 0 | 421 / 412 / 383 / 384 / 433 / 271 | 136.24 / 236.76 / 299.05 | 9.41 | 8.96 | 15.24 | 0.00 | 16.28 |
| gpt | 436 / 2304 | 0 | 436 / 422 / 405 / 379 / 338 / 324 | 135.35 / 235.72 / 299.30 | 9.71 | 9.26 | 13.09 | 0.00 | 16.54 |
| claude | 379 / 2304 | 0 | 379 / 384 / 401 / 400 / 392 / 348 | 135.10 / 235.49 / 299.59 | 9.63 | 9.19 | 12.87 | 0.00 | 16.45 |
| grok | 387 / 2304 | 0 | 387 / 367 / 356 / 408 / 365 / 421 | 136.92 / 237.41 / 298.82 | 9.24 | 8.83 | 14.56 | 0.00 | 15.90 |
| glm | 391 / 2304 | 0 | 391 / 397 / 377 / 368 / 410 / 361 | 136.77 / 237.59 / 298.31 | 9.22 | 8.79 | 15.28 | 0.00 | 15.88 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 107 / 576 | 0 | 107 / 80 / 73 / 58 / 57 / 201 | 135.11 / 243.79 / 319.21 | 8.47 | 7.78 | 9.17 | 0.00 | 12.05 |
| gemini | 106 / 576 | 0 | 106 / 83 / 83 / 104 / 122 / 78 | 136.13 / 241.48 / 312.54 | 8.45 | 7.74 | 10.19 | 0.00 | 12.70 |
| gpt | 100 / 576 | 0 | 100 / 105 / 100 / 80 / 112 / 79 | 135.59 / 241.40 / 312.88 | 8.95 | 8.29 | 9.15 | 0.00 | 13.38 |
| claude | 95 / 576 | 0 | 95 / 96 / 97 / 77 / 107 / 104 | 135.18 / 241.78 / 314.94 | 8.87 | 8.20 | 8.76 | 0.00 | 13.34 |
| grok | 75 / 576 | 0 | 75 / 111 / 122 / 124 / 87 / 57 | 136.73 / 240.29 / 309.30 | 8.99 | 8.34 | 10.16 | 0.00 | 13.46 |
| glm | 93 / 576 | 0 | 93 / 101 / 101 / 133 / 91 / 57 | 136.87 / 241.54 / 310.14 | 9.32 | 8.68 | 10.87 | 0.00 | 13.66 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.616369.

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
