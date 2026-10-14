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
| primary | whale | 19.53% | 16.82% | 22.24% | 0.76% | max-t-block-bootstrap-original-SE |
| primary | gemini | 17.32% | 14.67% | 19.97% | 0.74% | max-t-block-bootstrap-original-SE |
| primary | gpt | 14.67% | 12.24% | 17.10% | 0.68% | max-t-block-bootstrap-original-SE |
| primary | claude | 14.67% | 11.91% | 17.43% | 0.77% | max-t-block-bootstrap-original-SE |
| primary | grok | 14.97% | 12.50% | 17.45% | 0.69% | max-t-block-bootstrap-original-SE |
| primary | glm | 18.84% | 16.10% | 21.57% | 0.76% | max-t-block-bootstrap-original-SE |
| mixed | whale | 25.00% | 20.22% | 29.78% | 1.33% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.67% | 10.47% | 22.86% | 1.72% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 14.58% | 7.98% | 21.18% | 1.84% | max-t-block-bootstrap-original-SE |
| mixed | claude | 15.28% | 7.66% | 22.90% | 2.12% | max-t-block-bootstrap-original-SE |
| mixed | grok | 12.85% | 7.51% | 18.19% | 1.49% | max-t-block-bootstrap-original-SE |
| mixed | glm | 15.63% | 10.28% | 20.97% | 1.49% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 42.71% | 27.76% | 57.66% | 32 |
| coast | gemini | 10.42% | 1.60% | 19.23% | 32 |
| coast | gpt | 13.02% | 6.58% | 19.46% | 32 |
| coast | claude | 19.79% | 9.94% | 29.65% | 32 |
| coast | grok | 3.65% | 0.00% | 10.62% | 32 |
| coast | glm | 10.42% | 1.60% | 19.23% | 32 |
| mountain | whale | 5.21% | 0.00% | 10.87% | 32 |
| mountain | gemini | 27.60% | 17.69% | 37.52% | 32 |
| mountain | gpt | 12.50% | 4.90% | 20.10% | 32 |
| mountain | claude | 10.94% | 1.78% | 20.10% | 32 |
| mountain | grok | 19.79% | 9.58% | 30.01% | 32 |
| mountain | glm | 23.96% | 12.57% | 35.34% | 32 |
| town | whale | 30.73% | 20.28% | 41.18% | 32 |
| town | gemini | 12.50% | 4.44% | 20.56% | 32 |
| town | gpt | 14.06% | 4.33% | 23.80% | 32 |
| town | claude | 22.40% | 12.12% | 32.67% | 32 |
| town | grok | 6.77% | 0.26% | 13.28% | 32 |
| town | glm | 13.54% | 4.86% | 22.23% | 32 |
| quarry | whale | 27.60% | 18.85% | 36.36% | 32 |
| quarry | gemini | 13.02% | 5.08% | 20.97% | 32 |
| quarry | gpt | 14.58% | 5.37% | 23.80% | 32 |
| quarry | claude | 20.31% | 8.37% | 32.25% | 32 |
| quarry | grok | 8.33% | 1.75% | 14.92% | 32 |
| quarry | glm | 16.15% | 7.44% | 24.85% | 32 |
| forest | whale | 32.81% | 20.07% | 45.56% | 32 |
| forest | gemini | 23.44% | 12.40% | 34.48% | 32 |
| forest | gpt | 16.15% | 6.27% | 26.02% | 32 |
| forest | claude | 9.90% | 0.00% | 20.26% | 32 |
| forest | grok | 2.60% | 0.00% | 7.34% | 32 |
| forest | glm | 15.10% | 6.45% | 23.76% | 32 |
| workshop | whale | 7.81% | 1.24% | 14.39% | 32 |
| workshop | gemini | 21.88% | 14.07% | 29.68% | 32 |
| workshop | gpt | 16.67% | 9.06% | 24.27% | 32 |
| workshop | claude | 13.02% | 3.81% | 22.23% | 32 |
| workshop | grok | 22.40% | 11.44% | 33.35% | 32 |
| workshop | glm | 18.23% | 10.94% | 25.52% | 32 |
| harvest | whale | 8.33% | 2.32% | 14.34% | 32 |
| harvest | gemini | 17.71% | 6.64% | 28.77% | 32 |
| harvest | gpt | 13.02% | 4.21% | 21.83% | 32 |
| harvest | claude | 9.90% | 2.86% | 16.94% | 32 |
| harvest | grok | 27.08% | 18.27% | 35.90% | 32 |
| harvest | glm | 23.96% | 12.89% | 35.02% | 32 |
| desert | whale | 19.79% | 8.89% | 30.69% | 32 |
| desert | gemini | 19.27% | 7.52% | 31.02% | 32 |
| desert | gpt | 16.15% | 7.87% | 24.42% | 32 |
| desert | claude | 11.46% | 2.37% | 20.55% | 32 |
| desert | grok | 9.90% | 2.86% | 16.94% | 32 |
| desert | glm | 23.44% | 13.07% | 33.80% | 32 |
| snow | whale | 16.67% | 7.35% | 25.98% | 32 |
| snow | gemini | 26.56% | 18.12% | 35.00% | 32 |
| snow | gpt | 15.62% | 7.59% | 23.66% | 32 |
| snow | claude | 10.94% | 3.05% | 18.83% | 32 |
| snow | grok | 5.73% | 0.62% | 10.84% | 32 |
| snow | glm | 24.48% | 13.73% | 35.23% | 32 |
| caldera | whale | 2.08% | 0.00% | 5.64% | 32 |
| caldera | gemini | 8.33% | 0.73% | 15.94% | 32 |
| caldera | gpt | 17.71% | 9.67% | 25.75% | 32 |
| caldera | claude | 11.98% | 3.81% | 20.15% | 32 |
| caldera | grok | 44.27% | 31.21% | 57.33% | 32 |
| caldera | glm | 15.63% | 7.59% | 23.66% | 32 |
| garden | whale | 34.90% | 23.38% | 46.41% | 32 |
| garden | gemini | 7.29% | 0.74% | 13.84% | 32 |
| garden | gpt | 13.54% | 5.73% | 21.35% | 32 |
| garden | claude | 27.60% | 15.11% | 40.10% | 32 |
| garden | grok | 3.65% | 0.00% | 8.84% | 32 |
| garden | glm | 13.02% | 5.08% | 20.97% | 32 |
| airfield | whale | 5.73% | 0.62% | 10.84% | 32 |
| airfield | gemini | 19.79% | 10.31% | 29.27% | 32 |
| airfield | gpt | 13.02% | 4.21% | 21.83% | 32 |
| airfield | claude | 7.81% | 0.22% | 15.41% | 32 |
| airfield | grok | 25.52% | 13.21% | 37.84% | 32 |
| airfield | glm | 28.13% | 17.23% | 39.02% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 450 / 2304 | 0 | 450 / 363 / 345 / 330 / 339 / 477 | 133.08 / 235.10 / 300.12 | 9.39 | 8.93 | 13.27 | 0.00 | 16.18 |
| gemini | 399 / 2304 | 0 | 399 / 402 / 407 / 399 / 430 / 267 | 135.49 / 236.84 / 298.62 | 9.44 | 9.00 | 15.28 | 0.00 | 15.97 |
| gpt | 338 / 2304 | 0 | 338 / 393 / 400 / 423 / 402 / 348 | 135.00 / 235.83 / 299.02 | 9.52 | 9.09 | 14.40 | 0.00 | 16.39 |
| claude | 338 / 2304 | 0 | 338 / 396 / 408 / 382 / 382 / 398 | 134.21 / 235.36 / 299.30 | 9.55 | 9.13 | 12.83 | 0.00 | 16.12 |
| grok | 345 / 2304 | 0 | 345 / 298 / 328 / 390 / 373 / 570 | 136.31 / 237.76 / 298.92 | 8.98 | 8.57 | 14.31 | 0.00 | 15.32 |
| glm | 434 / 2304 | 0 | 434 / 452 / 416 / 380 / 378 / 244 | 135.45 / 236.09 / 298.33 | 9.35 | 8.89 | 15.08 | 0.00 | 16.53 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 1728/1728 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 72 / 288 | 0 | 72 / 33 / 34 / 30 / 26 / 93 | 134.56 / 241.94 / 318.97 | 8.23 | 7.50 | 9.01 | 0.00 | 12.24 |
| gemini | 48 / 288 | 0 | 48 / 37 / 43 / 56 / 65 / 39 | 135.46 / 239.72 / 314.15 | 8.73 | 8.11 | 10.51 | 0.00 | 13.85 |
| gpt | 42 / 288 | 0 | 42 / 59 / 43 / 46 / 59 / 39 | 134.18 / 242.35 / 313.50 | 8.72 | 8.06 | 9.74 | 0.00 | 12.92 |
| claude | 44 / 288 | 0 | 44 / 53 / 57 / 44 / 43 / 47 | 134.78 / 240.44 / 314.54 | 8.97 | 8.32 | 8.64 | 0.00 | 13.33 |
| grok | 37 / 288 | 0 | 37 / 49 / 64 / 56 / 46 / 36 | 136.29 / 240.91 / 309.02 | 8.83 | 8.17 | 10.28 | 0.00 | 13.85 |
| glm | 45 / 288 | 0 | 45 / 57 / 47 / 56 / 49 / 34 | 135.93 / 239.44 / 313.07 | 8.54 | 7.90 | 9.66 | 0.00 | 12.85 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.592247.

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
- Primary/mixed source hashes differ

## Warnings

- Uncertainty is descriptive only: training/exploratory outcomes are not independent confirmation of a tuned candidate
