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
| primary | whale | 14.32% | 11.97% | 16.68% | 0.66% | max-t-block-bootstrap-original-SE |
| primary | gemini | 17.66% | 15.10% | 20.23% | 0.71% | max-t-block-bootstrap-original-SE |
| primary | gpt | 17.32% | 14.58% | 20.06% | 0.76% | max-t-block-bootstrap-original-SE |
| primary | claude | 15.62% | 13.00% | 18.25% | 0.73% | max-t-block-bootstrap-original-SE |
| primary | grok | 15.19% | 12.44% | 17.94% | 0.76% | max-t-block-bootstrap-original-SE |
| primary | glm | 19.88% | 16.95% | 22.81% | 0.81% | max-t-block-bootstrap-original-SE |
| mixed | whale | 19.97% | 15.83% | 24.10% | 1.15% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.67% | 12.46% | 20.87% | 1.17% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.88% | 13.57% | 22.20% | 1.20% | max-t-block-bootstrap-original-SE |
| mixed | claude | 16.15% | 11.68% | 20.61% | 1.24% | max-t-block-bootstrap-original-SE |
| mixed | grok | 12.85% | 9.30% | 16.39% | 0.99% | max-t-block-bootstrap-original-SE |
| mixed | glm | 16.49% | 12.67% | 20.32% | 1.06% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 32.81% | 23.31% | 42.32% | 32 |
| coast | gemini | 10.94% | 3.52% | 18.36% | 32 |
| coast | gpt | 15.63% | 6.73% | 24.52% | 32 |
| coast | claude | 23.96% | 13.22% | 34.70% | 32 |
| coast | grok | 8.85% | 2.85% | 14.86% | 32 |
| coast | glm | 7.81% | 0.00% | 17.12% | 32 |
| mountain | whale | 3.12% | 0.00% | 7.32% | 32 |
| mountain | gemini | 19.79% | 10.31% | 29.28% | 32 |
| mountain | gpt | 13.54% | 5.28% | 21.80% | 32 |
| mountain | claude | 9.38% | 0.90% | 17.85% | 32 |
| mountain | grok | 23.44% | 13.07% | 33.81% | 32 |
| mountain | glm | 30.73% | 20.63% | 40.83% | 32 |
| town | whale | 25.52% | 16.61% | 34.43% | 32 |
| town | gemini | 10.42% | 3.97% | 16.87% | 32 |
| town | gpt | 17.19% | 8.48% | 25.90% | 32 |
| town | claude | 23.44% | 14.99% | 31.88% | 32 |
| town | grok | 10.94% | 3.05% | 18.83% | 32 |
| town | glm | 12.50% | 3.99% | 21.01% | 32 |
| quarry | whale | 19.79% | 10.70% | 28.89% | 32 |
| quarry | gemini | 19.79% | 12.97% | 26.62% | 32 |
| quarry | gpt | 13.02% | 4.21% | 21.83% | 32 |
| quarry | claude | 23.44% | 12.73% | 34.15% | 32 |
| quarry | grok | 5.73% | 0.00% | 11.50% | 32 |
| quarry | glm | 18.23% | 8.77% | 27.68% | 32 |
| forest | whale | 24.48% | 12.16% | 36.80% | 32 |
| forest | gemini | 18.23% | 8.04% | 28.42% | 32 |
| forest | gpt | 18.75% | 8.08% | 29.42% | 32 |
| forest | claude | 16.15% | 7.44% | 24.85% | 32 |
| forest | grok | 7.29% | 0.00% | 16.19% | 32 |
| forest | glm | 15.10% | 4.91% | 25.30% | 32 |
| workshop | whale | 10.94% | 5.16% | 16.71% | 32 |
| workshop | gemini | 25.00% | 15.68% | 34.32% | 32 |
| workshop | gpt | 16.15% | 6.27% | 26.02% | 32 |
| workshop | claude | 9.37% | 2.82% | 15.93% | 32 |
| workshop | grok | 17.71% | 6.97% | 28.45% | 32 |
| workshop | glm | 20.83% | 10.42% | 31.25% | 32 |
| harvest | whale | 3.13% | 0.00% | 8.11% | 32 |
| harvest | gemini | 19.27% | 8.48% | 30.07% | 32 |
| harvest | gpt | 18.23% | 8.40% | 28.06% | 32 |
| harvest | claude | 9.90% | 2.85% | 16.94% | 32 |
| harvest | grok | 25.00% | 12.38% | 37.62% | 32 |
| harvest | glm | 24.48% | 13.73% | 35.23% | 32 |
| desert | whale | 11.98% | 2.19% | 21.76% | 32 |
| desert | gemini | 19.27% | 10.31% | 28.24% | 32 |
| desert | gpt | 18.23% | 9.16% | 27.29% | 32 |
| desert | claude | 17.19% | 8.07% | 26.30% | 32 |
| desert | grok | 10.94% | 3.05% | 18.83% | 32 |
| desert | glm | 22.40% | 11.11% | 33.68% | 32 |
| snow | whale | 8.85% | 1.25% | 16.45% | 32 |
| snow | gemini | 28.65% | 18.15% | 39.14% | 32 |
| snow | gpt | 14.58% | 4.98% | 24.19% | 32 |
| snow | claude | 9.90% | 1.89% | 17.90% | 32 |
| snow | grok | 10.94% | 4.02% | 17.85% | 32 |
| snow | glm | 27.08% | 15.13% | 39.04% | 32 |
| caldera | whale | 1.04% | 0.00% | 3.65% | 32 |
| caldera | gemini | 11.46% | 3.65% | 19.27% | 32 |
| caldera | gpt | 20.83% | 9.42% | 32.24% | 32 |
| caldera | claude | 9.37% | 0.48% | 18.27% | 32 |
| caldera | grok | 38.54% | 23.95% | 53.13% | 32 |
| caldera | glm | 18.75% | 9.53% | 27.97% | 32 |
| garden | whale | 26.04% | 14.34% | 37.75% | 32 |
| garden | gemini | 8.85% | 1.25% | 16.45% | 32 |
| garden | gpt | 20.83% | 11.91% | 29.75% | 32 |
| garden | claude | 25.00% | 12.38% | 37.62% | 32 |
| garden | grok | 4.69% | 0.00% | 9.52% | 32 |
| garden | glm | 14.58% | 5.76% | 23.40% | 32 |
| airfield | whale | 4.17% | 0.00% | 8.83% | 32 |
| airfield | gemini | 20.31% | 10.34% | 30.28% | 32 |
| airfield | gpt | 20.83% | 11.52% | 30.15% | 32 |
| airfield | claude | 10.42% | 2.46% | 18.37% | 32 |
| airfield | grok | 18.23% | 6.09% | 30.36% | 32 |
| airfield | glm | 26.04% | 14.97% | 37.11% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 330 / 2304 | 0 | 330 / 315 / 309 / 338 / 349 / 663 | 134.28 / 235.91 / 301.15 | 9.44 | 8.99 | 13.09 | 0.00 | 15.42 |
| gemini | 407 / 2304 | 0 | 407 / 423 / 443 / 402 / 376 / 253 | 135.85 / 236.75 / 299.17 | 9.52 | 9.06 | 15.04 | 0.00 | 16.10 |
| gpt | 399 / 2304 | 0 | 399 / 419 / 383 / 411 / 390 / 302 | 135.31 / 236.24 / 299.47 | 9.57 | 9.14 | 13.29 | 0.00 | 16.64 |
| claude | 360 / 2304 | 0 | 360 / 412 / 416 / 371 / 396 / 349 | 134.50 / 235.71 / 299.70 | 9.65 | 9.21 | 13.09 | 0.00 | 16.55 |
| grok | 350 / 2304 | 0 | 350 / 327 / 351 / 375 / 415 / 486 | 136.46 / 237.69 / 298.94 | 9.01 | 8.61 | 14.51 | 0.00 | 15.54 |
| glm | 458 / 2304 | 0 | 458 / 408 / 402 / 407 / 378 / 251 | 135.78 / 236.26 / 298.38 | 9.38 | 8.92 | 15.36 | 0.00 | 16.28 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 115 / 576 | 0 | 115 / 80 / 60 / 55 / 54 / 212 | 133.43 / 244.74 / 321.46 | 7.92 | 7.16 | 8.64 | 0.00 | 11.30 |
| gemini | 96 / 576 | 0 | 96 / 89 / 93 / 102 / 134 / 62 | 135.66 / 241.34 / 313.41 | 8.95 | 8.26 | 10.14 | 0.00 | 12.94 |
| gpt | 103 / 576 | 0 | 103 / 99 / 104 / 91 / 104 / 75 | 134.86 / 241.40 / 314.00 | 9.09 | 8.42 | 9.22 | 0.00 | 13.44 |
| claude | 93 / 576 | 0 | 93 / 99 / 100 / 72 / 93 / 119 | 135.09 / 241.50 / 315.70 | 8.93 | 8.26 | 8.80 | 0.00 | 12.93 |
| grok | 74 / 576 | 0 | 74 / 115 / 111 / 138 / 79 / 59 | 136.61 / 240.72 / 309.83 | 9.07 | 8.39 | 10.13 | 0.00 | 13.52 |
| glm | 95 / 576 | 0 | 95 / 94 / 108 / 118 / 112 / 49 | 136.49 / 240.52 / 310.52 | 8.75 | 8.06 | 11.06 | 0.00 | 13.46 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.593976.

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
