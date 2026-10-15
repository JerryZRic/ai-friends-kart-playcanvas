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
| primary | whale | 14.67% | 12.07% | 17.27% | 0.72% | max-t-block-bootstrap-original-SE |
| primary | gemini | 19.53% | 16.63% | 22.43% | 0.80% | max-t-block-bootstrap-original-SE |
| primary | gpt | 16.23% | 13.58% | 18.89% | 0.74% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.36% | 13.74% | 18.98% | 0.73% | max-t-block-bootstrap-original-SE |
| primary | grok | 15.36% | 12.82% | 17.91% | 0.71% | max-t-block-bootstrap-original-SE |
| primary | glm | 17.84% | 15.18% | 20.50% | 0.74% | max-t-block-bootstrap-original-SE |
| mixed | whale | 19.79% | 15.32% | 24.26% | 1.24% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 17.01% | 12.58% | 21.45% | 1.23% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.88% | 13.26% | 22.51% | 1.28% | max-t-block-bootstrap-original-SE |
| mixed | claude | 14.76% | 10.48% | 19.03% | 1.19% | max-t-block-bootstrap-original-SE |
| mixed | grok | 13.37% | 9.41% | 17.33% | 1.10% | max-t-block-bootstrap-original-SE |
| mixed | glm | 17.19% | 13.06% | 21.31% | 1.15% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 35.94% | 22.17% | 49.71% | 32 |
| coast | gemini | 8.33% | 1.20% | 15.46% | 32 |
| coast | gpt | 11.98% | 4.73% | 19.23% | 32 |
| coast | claude | 28.65% | 17.14% | 40.15% | 32 |
| coast | grok | 5.21% | 0.00% | 11.49% | 32 |
| coast | glm | 9.90% | 1.43% | 18.36% | 32 |
| mountain | whale | 3.12% | 0.00% | 7.33% | 32 |
| mountain | gemini | 27.08% | 17.85% | 36.32% | 32 |
| mountain | gpt | 12.50% | 4.88% | 20.12% | 32 |
| mountain | claude | 10.42% | 3.42% | 17.42% | 32 |
| mountain | grok | 22.40% | 11.41% | 33.38% | 32 |
| mountain | glm | 24.48% | 13.70% | 35.25% | 32 |
| town | whale | 23.96% | 12.87% | 35.05% | 32 |
| town | gemini | 14.58% | 5.75% | 23.42% | 32 |
| town | gpt | 15.10% | 6.02% | 24.19% | 32 |
| town | claude | 26.04% | 14.95% | 37.13% | 32 |
| town | grok | 10.42% | 2.45% | 18.39% | 32 |
| town | glm | 9.90% | 1.43% | 18.36% | 32 |
| quarry | whale | 23.96% | 12.23% | 35.69% | 32 |
| quarry | gemini | 17.19% | 7.67% | 26.71% | 32 |
| quarry | gpt | 16.67% | 9.04% | 24.29% | 32 |
| quarry | claude | 16.67% | 6.23% | 27.10% | 32 |
| quarry | grok | 9.90% | 1.87% | 17.92% | 32 |
| quarry | glm | 15.63% | 7.13% | 24.12% | 32 |
| forest | whale | 31.77% | 21.92% | 41.62% | 32 |
| forest | gemini | 19.27% | 6.60% | 31.94% | 32 |
| forest | gpt | 16.15% | 7.85% | 24.45% | 32 |
| forest | claude | 9.90% | 2.34% | 17.45% | 32 |
| forest | grok | 6.25% | 1.03% | 11.47% | 32 |
| forest | glm | 16.67% | 9.54% | 23.80% | 32 |
| workshop | whale | 6.77% | 1.48% | 12.06% | 32 |
| workshop | gemini | 16.15% | 7.42% | 24.87% | 32 |
| workshop | gpt | 18.23% | 8.76% | 27.70% | 32 |
| workshop | claude | 16.15% | 6.25% | 26.04% | 32 |
| workshop | grok | 19.27% | 10.70% | 27.84% | 32 |
| workshop | glm | 23.44% | 13.41% | 33.47% | 32 |
| harvest | whale | 4.17% | 0.00% | 10.77% | 32 |
| harvest | gemini | 28.13% | 17.20% | 39.05% | 32 |
| harvest | gpt | 15.10% | 4.20% | 26.00% | 32 |
| harvest | claude | 9.90% | 1.87% | 17.92% | 32 |
| harvest | grok | 18.23% | 8.02% | 28.44% | 32 |
| harvest | glm | 24.48% | 15.15% | 33.81% | 32 |
| desert | whale | 11.98% | 2.18% | 21.78% | 32 |
| desert | gemini | 19.79% | 9.91% | 29.67% | 32 |
| desert | gpt | 25.52% | 15.09% | 35.95% | 32 |
| desert | claude | 13.54% | 3.66% | 23.42% | 32 |
| desert | grok | 13.02% | 3.40% | 22.64% | 32 |
| desert | glm | 16.15% | 7.42% | 24.87% | 32 |
| snow | whale | 10.42% | 0.00% | 21.45% | 32 |
| snow | gemini | 27.08% | 15.73% | 38.44% | 32 |
| snow | gpt | 19.27% | 8.12% | 30.42% | 32 |
| snow | claude | 7.81% | 1.22% | 14.40% | 32 |
| snow | grok | 8.85% | 2.26% | 15.45% | 32 |
| snow | glm | 26.56% | 16.17% | 36.95% | 32 |
| caldera | whale | 0.00% | 0.00% | 37.11% | 32 |
| caldera | gemini | 14.58% | 5.75% | 23.42% | 32 |
| caldera | gpt | 15.62% | 5.56% | 25.69% | 32 |
| caldera | claude | 12.50% | 4.42% | 20.58% | 32 |
| caldera | grok | 42.19% | 29.55% | 54.82% | 32 |
| caldera | glm | 15.10% | 6.43% | 23.78% | 32 |
| garden | whale | 20.83% | 11.12% | 30.55% | 32 |
| garden | gemini | 9.38% | 0.00% | 19.79% | 32 |
| garden | gpt | 14.58% | 5.75% | 23.42% | 32 |
| garden | claude | 36.46% | 25.87% | 47.05% | 32 |
| garden | grok | 7.29% | 0.73% | 13.86% | 32 |
| garden | glm | 11.46% | 3.18% | 19.74% | 32 |
| airfield | whale | 3.12% | 0.00% | 8.12% | 32 |
| airfield | gemini | 32.81% | 21.23% | 44.40% | 32 |
| airfield | gpt | 14.06% | 5.49% | 22.63% | 32 |
| airfield | claude | 8.33% | 2.31% | 14.36% | 32 |
| airfield | grok | 21.35% | 11.19% | 31.52% | 32 |
| airfield | glm | 20.31% | 9.29% | 31.34% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 338 / 2304 | 0 | 338 / 310 / 345 / 338 / 365 / 608 | 133.63 / 235.62 / 300.96 | 9.38 | 8.95 | 13.49 | 0.00 | 15.57 |
| gemini | 450 / 2304 | 0 | 450 / 400 / 388 / 409 / 404 / 253 | 135.33 / 236.40 / 298.69 | 9.41 | 8.96 | 15.33 | 0.00 | 16.14 |
| gpt | 374 / 2304 | 0 | 374 / 396 / 389 / 410 / 399 / 336 | 135.30 / 235.83 / 299.04 | 9.37 | 8.94 | 14.37 | 0.00 | 16.25 |
| claude | 377 / 2304 | 0 | 377 / 397 / 388 / 366 / 400 / 376 | 134.14 / 235.19 / 299.68 | 9.66 | 9.24 | 12.85 | 0.00 | 16.60 |
| grok | 354 / 2304 | 0 | 354 / 374 / 398 / 402 / 355 / 421 | 135.92 / 236.79 / 298.90 | 9.27 | 8.85 | 13.92 | 0.00 | 16.08 |
| glm | 411 / 2304 | 0 | 411 / 427 / 396 / 379 / 381 / 310 | 135.63 / 236.65 / 299.00 | 9.32 | 8.88 | 15.55 | 0.00 | 16.19 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 114 / 576 | 0 | 114 / 81 / 66 / 49 / 82 / 184 | 134.04 / 243.68 / 320.58 | 7.97 | 7.24 | 8.79 | 0.00 | 11.66 |
| gemini | 98 / 576 | 0 | 98 / 89 / 89 / 109 / 106 / 85 | 137.06 / 241.19 / 312.55 | 8.72 | 8.06 | 10.81 | 0.00 | 13.10 |
| gpt | 103 / 576 | 0 | 103 / 96 / 94 / 101 / 112 / 70 | 135.25 / 241.33 / 312.93 | 8.97 | 8.30 | 9.40 | 0.00 | 13.02 |
| claude | 85 / 576 | 0 | 85 / 101 / 105 / 99 / 88 / 98 | 135.32 / 240.32 / 314.87 | 8.95 | 8.30 | 9.17 | 0.00 | 13.48 |
| grok | 77 / 576 | 0 | 77 / 109 / 121 / 113 / 82 / 74 | 136.30 / 239.95 / 309.35 | 8.65 | 7.97 | 10.05 | 0.00 | 13.56 |
| glm | 99 / 576 | 0 | 99 / 100 / 101 / 105 / 106 / 65 | 136.12 / 240.19 / 311.68 | 8.82 | 8.15 | 10.44 | 0.00 | 13.15 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.601049.

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
