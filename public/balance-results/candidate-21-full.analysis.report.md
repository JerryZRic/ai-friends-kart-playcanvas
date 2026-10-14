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
| primary | whale | 15.67% | 13.07% | 18.26% | 0.72% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.19% | 15.32% | 21.05% | 0.79% | max-t-block-bootstrap-original-SE |
| primary | gpt | 16.49% | 13.61% | 19.38% | 0.80% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.02% | 13.50% | 18.53% | 0.70% | max-t-block-bootstrap-original-SE |
| primary | grok | 16.71% | 13.99% | 19.43% | 0.75% | max-t-block-bootstrap-original-SE |
| primary | glm | 16.93% | 14.11% | 19.74% | 0.78% | max-t-block-bootstrap-original-SE |
| mixed | whale | 17.71% | 13.44% | 21.98% | 1.18% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.67% | 12.16% | 21.17% | 1.25% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.19% | 12.54% | 21.83% | 1.28% | max-t-block-bootstrap-original-SE |
| mixed | claude | 17.88% | 13.56% | 22.20% | 1.19% | max-t-block-bootstrap-original-SE |
| mixed | grok | 14.76% | 10.31% | 19.20% | 1.23% | max-t-block-bootstrap-original-SE |
| mixed | glm | 15.80% | 11.61% | 19.98% | 1.16% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 37.50% | 25.40% | 49.60% | 32 |
| coast | gemini | 11.46% | 1.18% | 21.74% | 32 |
| coast | gpt | 8.85% | 0.74% | 16.97% | 32 |
| coast | claude | 27.08% | 16.69% | 37.48% | 32 |
| coast | grok | 7.81% | 1.19% | 14.43% | 32 |
| coast | glm | 7.29% | 0.70% | 13.89% | 32 |
| mountain | whale | 5.21% | 0.00% | 10.91% | 32 |
| mountain | gemini | 22.92% | 12.88% | 32.95% | 32 |
| mountain | gpt | 11.46% | 3.60% | 19.32% | 32 |
| mountain | claude | 10.94% | 3.00% | 18.88% | 32 |
| mountain | grok | 27.08% | 16.69% | 37.48% | 32 |
| mountain | glm | 22.40% | 8.70% | 36.09% | 32 |
| town | whale | 24.48% | 12.69% | 36.27% | 32 |
| town | gemini | 14.58% | 6.58% | 22.59% | 32 |
| town | gpt | 18.23% | 6.02% | 30.44% | 32 |
| town | claude | 25.00% | 13.84% | 36.16% | 32 |
| town | grok | 8.85% | 1.21% | 16.50% | 32 |
| town | glm | 8.85% | 1.21% | 16.50% | 32 |
| quarry | whale | 28.65% | 17.74% | 39.55% | 32 |
| quarry | gemini | 16.15% | 6.21% | 26.08% | 32 |
| quarry | gpt | 17.71% | 6.90% | 28.51% | 32 |
| quarry | claude | 19.27% | 9.47% | 29.07% | 32 |
| quarry | grok | 7.81% | 0.00% | 16.36% | 32 |
| quarry | glm | 10.42% | 1.97% | 18.87% | 32 |
| forest | whale | 22.40% | 10.72% | 34.07% | 32 |
| forest | gemini | 19.79% | 9.87% | 29.71% | 32 |
| forest | gpt | 15.63% | 5.89% | 25.36% | 32 |
| forest | claude | 22.40% | 13.17% | 31.62% | 32 |
| forest | grok | 10.42% | 1.54% | 19.29% | 32 |
| forest | glm | 9.38% | 1.75% | 17.00% | 32 |
| workshop | whale | 10.94% | 2.12% | 19.75% | 32 |
| workshop | gemini | 21.35% | 10.79% | 31.92% | 32 |
| workshop | gpt | 18.23% | 8.71% | 27.74% | 32 |
| workshop | claude | 14.58% | 3.51% | 25.66% | 32 |
| workshop | grok | 17.71% | 9.18% | 26.24% | 32 |
| workshop | glm | 17.19% | 8.85% | 25.52% | 32 |
| harvest | whale | 5.73% | 0.00% | 13.19% | 32 |
| harvest | gemini | 17.19% | 6.20% | 28.18% | 32 |
| harvest | gpt | 15.63% | 5.52% | 25.73% | 32 |
| harvest | claude | 6.25% | 0.35% | 12.15% | 32 |
| harvest | grok | 23.96% | 13.50% | 34.42% | 32 |
| harvest | glm | 31.25% | 18.63% | 43.87% | 32 |
| desert | whale | 13.54% | 5.68% | 21.40% | 32 |
| desert | gemini | 21.88% | 11.24% | 32.51% | 32 |
| desert | gpt | 22.40% | 10.72% | 34.07% | 32 |
| desert | claude | 14.06% | 6.85% | 21.28% | 32 |
| desert | grok | 15.10% | 5.98% | 24.23% | 32 |
| desert | glm | 13.02% | 6.54% | 19.50% | 32 |
| snow | whale | 8.33% | 1.17% | 15.49% | 32 |
| snow | gemini | 33.85% | 19.67% | 48.04% | 32 |
| snow | gpt | 14.58% | 4.55% | 24.62% | 32 |
| snow | claude | 8.85% | 2.81% | 14.90% | 32 |
| snow | grok | 16.67% | 6.54% | 26.79% | 32 |
| snow | glm | 17.71% | 7.25% | 28.17% | 32 |
| caldera | whale | 0.52% | 0.00% | 2.40% | 32 |
| caldera | gemini | 11.46% | 4.59% | 18.32% | 32 |
| caldera | gpt | 16.67% | 7.29% | 26.04% | 32 |
| caldera | claude | 8.33% | 1.70% | 14.96% | 32 |
| caldera | grok | 35.94% | 21.34% | 50.54% | 32 |
| caldera | glm | 27.08% | 15.06% | 39.11% | 32 |
| garden | whale | 26.56% | 15.45% | 37.67% | 32 |
| garden | gemini | 8.85% | 2.23% | 15.47% | 32 |
| garden | gpt | 19.79% | 10.64% | 28.94% | 32 |
| garden | claude | 29.17% | 18.69% | 39.65% | 32 |
| garden | grok | 8.33% | 2.28% | 14.38% | 32 |
| garden | glm | 7.29% | 1.28% | 13.31% | 32 |
| airfield | whale | 4.17% | 0.00% | 8.85% | 32 |
| airfield | gemini | 18.75% | 9.88% | 27.62% | 32 |
| airfield | gpt | 18.75% | 8.36% | 29.14% | 32 |
| airfield | claude | 6.25% | 0.35% | 12.15% | 32 |
| airfield | grok | 20.83% | 11.46% | 30.21% | 32 |
| airfield | glm | 31.25% | 18.63% | 43.87% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 361 / 2304 | 0 | 361 / 301 / 306 / 309 / 377 / 650 | 134.02 / 236.09 / 300.76 | 9.37 | 8.93 | 13.29 | 0.00 | 15.63 |
| gemini | 419 / 2304 | 0 | 419 / 445 / 376 / 404 / 377 / 283 | 135.80 / 236.86 / 298.74 | 9.49 | 9.04 | 15.39 | 0.00 | 16.03 |
| gpt | 380 / 2304 | 0 | 380 / 415 / 439 / 397 / 362 / 311 | 135.50 / 236.09 / 298.79 | 9.61 | 9.17 | 13.44 | 0.00 | 16.48 |
| claude | 369 / 2304 | 0 | 369 / 384 / 398 / 401 / 407 / 345 | 134.33 / 235.83 / 299.84 | 9.73 | 9.31 | 12.94 | 0.00 | 16.38 |
| grok | 385 / 2304 | 0 | 385 / 384 / 376 / 390 / 397 / 372 | 136.19 / 237.23 / 298.66 | 9.32 | 8.87 | 14.41 | 0.00 | 16.31 |
| glm | 390 / 2304 | 0 | 390 / 375 / 409 / 403 / 384 / 343 | 136.18 / 237.05 / 298.18 | 9.20 | 8.75 | 15.39 | 0.00 | 16.14 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 102 / 576 | 0 | 102 / 91 / 72 / 42 / 66 / 203 | 134.46 / 243.87 / 320.71 | 8.03 | 7.34 | 8.67 | 0.00 | 11.49 |
| gemini | 96 / 576 | 0 | 96 / 96 / 97 / 90 / 115 / 82 | 135.58 / 240.78 / 313.45 | 8.64 | 7.97 | 10.03 | 0.00 | 12.65 |
| gpt | 99 / 576 | 0 | 99 / 107 / 91 / 97 / 103 / 79 | 134.99 / 242.02 / 313.52 | 8.97 | 8.27 | 9.41 | 0.00 | 13.10 |
| claude | 103 / 576 | 0 | 103 / 96 / 89 / 86 / 94 / 108 | 135.28 / 241.61 / 316.01 | 8.88 | 8.18 | 8.93 | 0.00 | 13.01 |
| grok | 85 / 576 | 0 | 85 / 89 / 119 / 139 / 92 / 52 | 136.53 / 241.58 / 310.15 | 8.90 | 8.28 | 9.92 | 0.00 | 13.67 |
| glm | 91 / 576 | 0 | 91 / 97 / 108 / 122 / 106 / 52 | 136.48 / 240.60 / 311.00 | 8.73 | 8.07 | 10.45 | 0.00 | 13.18 |

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
