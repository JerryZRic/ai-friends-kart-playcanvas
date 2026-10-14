# Land CPU balance analysis

Stage: **training**. Statistical assessment: **fail**. Held-out statistical certification: **inconclusive**.

Primary input: 576 races; 96 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/3456; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

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
| primary | whale | 12.33% | 7.04% | 17.61% | 1.56% | max-t-block-bootstrap-original-SE |
| primary | gemini | 17.36% | 11.69% | 23.03% | 1.67% | max-t-block-bootstrap-original-SE |
| primary | gpt | 17.88% | 12.53% | 23.23% | 1.58% | max-t-block-bootstrap-original-SE |
| primary | claude | 17.01% | 11.80% | 22.23% | 1.54% | max-t-block-bootstrap-original-SE |
| primary | grok | 14.41% | 8.90% | 19.92% | 1.63% | max-t-block-bootstrap-original-SE |
| primary | glm | 21.01% | 14.58% | 27.43% | 1.90% | max-t-block-bootstrap-original-SE |
| mixed | whale | 15.97% | 10.54% | 21.41% | 1.60% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 17.71% | 11.83% | 23.59% | 1.74% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 18.40% | 13.28% | 23.53% | 1.51% | max-t-block-bootstrap-original-SE |
| mixed | claude | 16.67% | 10.90% | 22.43% | 1.70% | max-t-block-bootstrap-original-SE |
| mixed | grok | 15.63% | 9.01% | 22.24% | 1.95% | max-t-block-bootstrap-original-SE |
| mixed | glm | 15.63% | 10.23% | 21.02% | 1.59% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 29.17% | 0.00% | 65.74% | 8 |
| coast | gemini | 10.42% | 0.00% | 31.59% | 8 |
| coast | gpt | 20.83% | 0.17% | 41.50% | 8 |
| coast | claude | 22.92% | 1.74% | 44.09% | 8 |
| coast | grok | 8.33% | 0.00% | 19.00% | 8 |
| coast | glm | 8.33% | 0.00% | 26.81% | 8 |
| mountain | whale | 0.00% | 0.00% | 74.22% | 8 |
| mountain | gemini | 27.08% | 5.91% | 48.26% | 8 |
| mountain | gpt | 27.08% | 5.91% | 48.26% | 8 |
| mountain | claude | 6.25% | 0.00% | 21.10% | 8 |
| mountain | grok | 12.50% | 0.00% | 35.76% | 8 |
| mountain | glm | 27.08% | 3.37% | 50.79% | 8 |
| town | whale | 12.50% | 0.00% | 35.76% | 8 |
| town | gemini | 14.58% | 0.00% | 31.24% | 8 |
| town | gpt | 18.75% | 0.00% | 41.23% | 8 |
| town | claude | 29.17% | 3.58% | 54.75% | 8 |
| town | grok | 10.42% | 0.00% | 25.27% | 8 |
| town | glm | 14.58% | 0.00% | 37.06% | 8 |
| quarry | whale | 33.33% | 14.85% | 51.81% | 8 |
| quarry | gemini | 18.75% | 0.00% | 38.53% | 8 |
| quarry | gpt | 12.50% | 0.00% | 30.19% | 8 |
| quarry | claude | 16.67% | 0.00% | 35.15% | 8 |
| quarry | grok | 6.25% | 0.00% | 16.58% | 8 |
| quarry | glm | 12.50% | 0.00% | 35.76% | 8 |
| forest | whale | 14.58% | 0.00% | 37.06% | 8 |
| forest | gemini | 12.50% | 0.00% | 33.16% | 8 |
| forest | gpt | 16.67% | 0.00% | 42.80% | 8 |
| forest | claude | 29.17% | 8.50% | 49.83% | 8 |
| forest | grok | 16.67% | 0.00% | 38.01% | 8 |
| forest | glm | 10.42% | 0.00% | 28.70% | 8 |
| workshop | whale | 10.42% | 0.00% | 25.27% | 8 |
| workshop | gemini | 20.83% | 0.17% | 41.50% | 8 |
| workshop | gpt | 10.42% | 0.09% | 20.75% | 8 |
| workshop | claude | 10.42% | 0.09% | 20.75% | 8 |
| workshop | grok | 16.67% | 0.00% | 35.15% | 8 |
| workshop | glm | 31.25% | 8.77% | 53.73% | 8 |
| harvest | whale | 4.17% | 0.00% | 13.41% | 8 |
| harvest | gemini | 16.67% | 6.00% | 27.34% | 8 |
| harvest | gpt | 16.67% | 0.00% | 35.15% | 8 |
| harvest | claude | 8.33% | 0.00% | 29.67% | 8 |
| harvest | grok | 18.75% | 0.00% | 38.53% | 8 |
| harvest | glm | 35.42% | 4.42% | 66.41% | 8 |
| desert | whale | 8.33% | 0.00% | 23.42% | 8 |
| desert | gemini | 27.08% | 5.91% | 48.26% | 8 |
| desert | gpt | 20.83% | 6.72% | 34.95% | 8 |
| desert | claude | 20.83% | 6.72% | 34.95% | 8 |
| desert | grok | 4.17% | 0.00% | 13.41% | 8 |
| desert | glm | 18.75% | 0.00% | 38.53% | 8 |
| snow | whale | 4.17% | 0.00% | 13.41% | 8 |
| snow | gemini | 33.33% | 3.15% | 63.51% | 8 |
| snow | gpt | 14.58% | 1.79% | 27.38% | 8 |
| snow | claude | 14.58% | 0.00% | 31.24% | 8 |
| snow | grok | 6.25% | 0.00% | 21.10% | 8 |
| snow | glm | 27.08% | 8.80% | 45.37% | 8 |
| caldera | whale | 0.00% | 0.00% | 74.22% | 8 |
| caldera | gemini | 2.08% | 0.00% | 9.14% | 8 |
| caldera | gpt | 20.83% | 0.17% | 41.50% | 8 |
| caldera | claude | 10.42% | 0.00% | 25.27% | 8 |
| caldera | grok | 33.33% | 7.20% | 59.47% | 8 |
| caldera | glm | 33.33% | 14.85% | 51.81% | 8 |
| garden | whale | 25.00% | 1.14% | 48.86% | 8 |
| garden | gemini | 8.33% | 0.00% | 23.42% | 8 |
| garden | gpt | 18.75% | 2.09% | 35.41% | 8 |
| garden | claude | 27.08% | 5.91% | 48.26% | 8 |
| garden | grok | 10.42% | 0.00% | 28.70% | 8 |
| garden | glm | 10.42% | 0.00% | 31.59% | 8 |
| airfield | whale | 6.25% | 0.00% | 16.58% | 8 |
| airfield | gemini | 16.67% | 0.00% | 38.01% | 8 |
| airfield | gpt | 16.67% | 1.58% | 31.76% | 8 |
| airfield | claude | 8.33% | 0.00% | 19.00% | 8 |
| airfield | grok | 29.17% | 0.00% | 58.87% | 8 |
| airfield | glm | 22.92% | 0.00% | 48.92% | 8 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 3456/3456 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 71 / 576 | 0 | 71 / 67 / 86 / 83 / 90 / 179 | 135.16 / 236.14 / 301.11 | 9.49 | 9.06 | 13.40 | 0.00 | 15.82 |
| gemini | 100 / 576 | 0 | 100 / 111 / 83 / 114 / 98 / 70 | 136.00 / 237.43 / 298.32 | 9.32 | 8.89 | 16.20 | 0.00 | 16.36 |
| gpt | 103 / 576 | 0 | 103 / 107 / 102 / 93 / 77 / 94 | 135.13 / 236.22 / 298.35 | 9.55 | 9.13 | 13.61 | 0.00 | 16.85 |
| claude | 98 / 576 | 0 | 98 / 89 / 99 / 107 / 102 / 81 | 134.20 / 235.82 / 299.55 | 9.89 | 9.47 | 13.55 | 0.00 | 17.05 |
| grok | 83 / 576 | 0 | 83 / 97 / 110 / 90 / 117 / 79 | 136.03 / 237.47 / 298.82 | 9.30 | 8.88 | 14.80 | 0.00 | 16.87 |
| glm | 121 / 576 | 0 | 121 / 105 / 96 / 89 / 92 / 73 | 135.93 / 237.44 / 297.98 | 9.38 | 8.92 | 15.42 | 0.00 | 16.20 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 1728/1728 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 46 / 288 | 0 | 46 / 43 / 36 / 33 / 28 / 102 | 134.73 / 243.86 / 321.78 | 8.59 | 7.90 | 8.82 | 0.00 | 12.03 |
| gemini | 51 / 288 | 0 | 51 / 50 / 47 / 51 / 52 / 37 | 136.37 / 241.10 / 315.51 | 8.71 | 8.02 | 10.01 | 0.00 | 12.93 |
| gpt | 53 / 288 | 0 | 53 / 49 / 48 / 48 / 58 / 32 | 135.79 / 241.36 / 313.12 | 8.82 | 8.13 | 9.01 | 0.00 | 13.10 |
| claude | 48 / 288 | 0 | 48 / 51 / 42 / 31 / 53 / 63 | 135.14 / 241.58 / 315.95 | 8.09 | 7.39 | 8.68 | 0.00 | 12.53 |
| grok | 45 / 288 | 0 | 45 / 49 / 63 / 55 / 48 / 28 | 136.32 / 242.26 / 310.77 | 9.11 | 8.45 | 10.25 | 0.00 | 13.64 |
| glm | 45 / 288 | 0 | 45 / 46 / 52 / 70 / 49 / 26 | 136.25 / 241.66 / 311.44 | 8.70 | 8.02 | 10.03 | 0.00 | 13.49 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.387720.

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
- 2 degenerate/one-block endpoints use conservative bounded-block fallback, not a zero-width bootstrap interval
