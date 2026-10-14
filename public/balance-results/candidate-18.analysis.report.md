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
| primary | whale | 12.20% | 9.95% | 14.44% | 0.61% | max-t-block-bootstrap-original-SE |
| primary | gemini | 18.49% | 15.48% | 21.50% | 0.82% | max-t-block-bootstrap-original-SE |
| primary | gpt | 17.62% | 14.76% | 20.48% | 0.78% | max-t-block-bootstrap-original-SE |
| primary | claude | 17.32% | 14.62% | 20.02% | 0.74% | max-t-block-bootstrap-original-SE |
| primary | grok | 16.49% | 13.75% | 19.23% | 0.75% | max-t-block-bootstrap-original-SE |
| primary | glm | 17.88% | 15.10% | 20.66% | 0.76% | max-t-block-bootstrap-original-SE |
| mixed | whale | 14.24% | 10.24% | 18.23% | 1.09% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.84% | 12.96% | 20.72% | 1.06% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 18.23% | 13.88% | 22.58% | 1.19% | max-t-block-bootstrap-original-SE |
| mixed | claude | 19.27% | 14.98% | 23.57% | 1.17% | max-t-block-bootstrap-original-SE |
| mixed | grok | 14.06% | 9.44% | 18.68% | 1.26% | max-t-block-bootstrap-original-SE |
| mixed | glm | 17.36% | 12.86% | 21.86% | 1.23% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 33.33% | 22.03% | 44.64% | 32 |
| coast | gemini | 15.10% | 6.28% | 23.93% | 32 |
| coast | gpt | 15.10% | 7.66% | 22.54% | 32 |
| coast | claude | 27.08% | 16.20% | 37.97% | 32 |
| coast | grok | 5.73% | 0.00% | 11.62% | 32 |
| coast | glm | 3.65% | 0.00% | 8.95% | 32 |
| mountain | whale | 1.56% | 0.00% | 4.76% | 32 |
| mountain | gemini | 22.92% | 12.75% | 33.09% | 32 |
| mountain | gpt | 11.46% | 1.41% | 21.51% | 32 |
| mountain | claude | 9.37% | 2.15% | 16.60% | 32 |
| mountain | grok | 25.52% | 15.64% | 35.40% | 32 |
| mountain | glm | 29.17% | 19.67% | 38.67% | 32 |
| town | whale | 23.96% | 14.89% | 33.03% | 32 |
| town | gemini | 11.98% | 2.39% | 21.57% | 32 |
| town | gpt | 18.75% | 8.58% | 28.92% | 32 |
| town | claude | 27.08% | 16.20% | 37.97% | 32 |
| town | grok | 8.85% | 1.61% | 16.10% | 32 |
| town | glm | 9.38% | 1.18% | 17.57% | 32 |
| quarry | whale | 20.31% | 11.33% | 29.30% | 32 |
| quarry | gemini | 23.44% | 11.85% | 35.03% | 32 |
| quarry | gpt | 20.83% | 10.95% | 30.72% | 32 |
| quarry | claude | 18.23% | 9.40% | 27.06% | 32 |
| quarry | grok | 6.77% | 0.73% | 12.82% | 32 |
| quarry | glm | 10.42% | 3.84% | 16.99% | 32 |
| forest | whale | 17.71% | 6.09% | 29.32% | 32 |
| forest | gemini | 20.83% | 11.33% | 30.33% | 32 |
| forest | gpt | 20.31% | 9.09% | 31.53% | 32 |
| forest | claude | 23.96% | 13.36% | 34.56% | 32 |
| forest | grok | 8.33% | 1.62% | 15.05% | 32 |
| forest | glm | 8.85% | 0.00% | 18.35% | 32 |
| workshop | whale | 7.81% | 1.10% | 14.52% | 32 |
| workshop | gemini | 23.96% | 10.82% | 37.09% | 32 |
| workshop | gpt | 14.06% | 5.34% | 22.78% | 32 |
| workshop | claude | 10.94% | 3.37% | 18.50% | 32 |
| workshop | grok | 22.92% | 10.42% | 35.41% | 32 |
| workshop | glm | 20.31% | 10.15% | 30.48% | 32 |
| harvest | whale | 2.08% | 0.00% | 5.71% | 32 |
| harvest | gemini | 16.67% | 6.41% | 26.93% | 32 |
| harvest | gpt | 19.27% | 9.73% | 28.81% | 32 |
| harvest | claude | 8.85% | 1.61% | 16.10% | 32 |
| harvest | grok | 23.44% | 12.52% | 34.36% | 32 |
| harvest | glm | 29.69% | 15.78% | 43.60% | 32 |
| desert | whale | 5.73% | 0.00% | 12.78% | 32 |
| desert | gemini | 25.52% | 11.54% | 39.50% | 32 |
| desert | gpt | 19.27% | 7.60% | 30.94% | 32 |
| desert | claude | 12.50% | 2.61% | 22.39% | 32 |
| desert | grok | 16.67% | 7.99% | 25.34% | 32 |
| desert | glm | 20.31% | 9.43% | 31.19% | 32 |
| snow | whale | 11.46% | 2.60% | 20.32% | 32 |
| snow | gemini | 22.92% | 12.38% | 33.45% | 32 |
| snow | gpt | 20.83% | 10.57% | 31.09% | 32 |
| snow | claude | 14.06% | 4.52% | 23.61% | 32 |
| snow | grok | 14.58% | 4.05% | 25.12% | 32 |
| snow | glm | 16.15% | 6.08% | 26.22% | 32 |
| caldera | whale | 0.52% | 0.00% | 2.43% | 32 |
| caldera | gemini | 10.42% | 1.02% | 19.82% | 32 |
| caldera | gpt | 18.75% | 9.35% | 28.15% | 32 |
| caldera | claude | 7.81% | 0.57% | 15.06% | 32 |
| caldera | grok | 36.98% | 22.54% | 51.42% | 32 |
| caldera | glm | 25.52% | 14.22% | 36.82% | 32 |
| garden | whale | 18.23% | 9.40% | 27.06% | 32 |
| garden | gemini | 10.42% | 2.78% | 18.05% | 32 |
| garden | gpt | 20.83% | 9.53% | 32.14% | 32 |
| garden | claude | 38.54% | 26.14% | 50.94% | 32 |
| garden | grok | 5.21% | 0.00% | 10.99% | 32 |
| garden | glm | 6.77% | 0.73% | 12.82% | 32 |
| airfield | whale | 3.65% | 0.00% | 8.18% | 32 |
| airfield | gemini | 17.71% | 9.06% | 26.35% | 32 |
| airfield | gpt | 11.98% | 3.65% | 20.31% | 32 |
| airfield | claude | 9.38% | 1.18% | 17.57% | 32 |
| airfield | grok | 22.92% | 12.38% | 33.45% | 32 |
| airfield | glm | 34.38% | 23.78% | 44.97% | 32 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 13824/13824 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 281 / 2304 | 0 | 281 / 299 / 317 / 350 / 364 / 693 | 134.68 / 236.35 / 301.25 | 9.29 | 8.85 | 13.26 | 0.00 | 15.44 |
| gemini | 426 / 2304 | 0 | 426 / 420 / 417 / 392 / 382 / 267 | 135.87 / 236.77 / 298.77 | 9.49 | 9.03 | 15.27 | 0.00 | 16.22 |
| gpt | 406 / 2304 | 0 | 406 / 400 / 429 / 391 / 399 / 279 | 135.44 / 236.05 / 299.29 | 9.80 | 9.35 | 13.34 | 0.00 | 16.78 |
| claude | 399 / 2304 | 0 | 399 / 397 / 348 / 410 / 402 / 348 | 134.73 / 235.73 / 299.89 | 9.60 | 9.17 | 13.01 | 0.00 | 16.46 |
| grok | 380 / 2304 | 0 | 380 / 393 / 391 / 375 / 356 / 409 | 136.62 / 237.65 / 298.65 | 9.22 | 8.77 | 14.51 | 0.00 | 15.97 |
| glm | 412 / 2304 | 0 | 412 / 395 / 402 / 386 / 401 / 308 | 136.82 / 237.42 / 298.53 | 9.25 | 8.80 | 15.27 | 0.00 | 15.95 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 82 / 576 | 0 | 82 / 82 / 71 / 65 / 73 / 203 | 135.86 / 244.40 / 321.82 | 8.16 | 7.45 | 9.02 | 0.00 | 12.12 |
| gemini | 97 / 576 | 0 | 97 / 93 / 101 / 96 / 118 / 71 | 136.17 / 240.10 / 312.34 | 8.66 | 7.98 | 10.28 | 0.00 | 12.79 |
| gpt | 105 / 576 | 0 | 105 / 96 / 99 / 90 / 107 / 79 | 135.17 / 241.50 / 314.10 | 9.00 | 8.36 | 9.57 | 0.00 | 13.61 |
| claude | 111 / 576 | 0 | 111 / 100 / 80 / 76 / 88 / 121 | 135.24 / 240.68 / 315.64 | 8.80 | 8.10 | 8.76 | 0.00 | 12.84 |
| grok | 81 / 576 | 0 | 81 / 104 / 123 / 129 / 88 / 51 | 136.66 / 242.08 / 308.89 | 9.07 | 8.43 | 10.17 | 0.00 | 13.69 |
| glm | 100 / 576 | 0 | 100 / 101 / 102 / 120 / 102 / 51 | 137.01 / 241.10 / 311.08 | 9.06 | 8.42 | 10.55 | 0.00 | 13.59 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.664436.

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
