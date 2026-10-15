# Land CPU balance analysis

Stage: **holdout**. Statistical assessment: **inconclusive**. Held-out statistical certification: **inconclusive**.

Primary input: 9216 races; 1536 complete independent blocks; 0 incomplete-block rows excluded from inference.
Primary DNFs: 0/55296; timeouts: 0; observed invalid steps: 0; no-winner races: 0.

## Acceptance checks

- observedTarget: **pass**
- primaryEquivalence: **pass**
- mapUpperBound: **inconclusive**
- cleanPrimary: **pass**
- mixedEquivalence: **pass**

Observed primary aim: 16.6667% ±3 percentage points. Joint primary intervals must lie inside ±4 points. Every per-map upper bound must be strictly below 40%. Mixed aggregate intervals must lie inside ±5 points.

## Equal-map aggregate win rates

| Cohort | Character | Rate | Simultaneous lower | Simultaneous upper | Cluster SE | Method |
|---|---|---:|---:|---:|---:|---|
| primary | whale | 14.02% | 12.74% | 15.30% | 0.35% | max-t-block-bootstrap-original-SE |
| primary | gemini | 17.68% | 16.26% | 19.10% | 0.39% | max-t-block-bootstrap-original-SE |
| primary | gpt | 16.32% | 14.94% | 17.70% | 0.38% | max-t-block-bootstrap-original-SE |
| primary | claude | 16.00% | 14.64% | 17.37% | 0.38% | max-t-block-bootstrap-original-SE |
| primary | grok | 17.33% | 15.98% | 18.68% | 0.37% | max-t-block-bootstrap-original-SE |
| primary | glm | 18.65% | 17.22% | 20.09% | 0.40% | max-t-block-bootstrap-original-SE |
| mixed | whale | 17.66% | 16.16% | 19.17% | 0.41% | max-t-block-bootstrap-original-SE |
| mixed | gemini | 16.75% | 15.24% | 18.26% | 0.42% | max-t-block-bootstrap-original-SE |
| mixed | gpt | 17.19% | 15.59% | 18.78% | 0.44% | max-t-block-bootstrap-original-SE |
| mixed | claude | 16.80% | 15.35% | 18.24% | 0.40% | max-t-block-bootstrap-original-SE |
| mixed | grok | 15.10% | 13.60% | 16.61% | 0.41% | max-t-block-bootstrap-original-SE |
| mixed | glm | 16.49% | 14.94% | 18.05% | 0.43% | max-t-block-bootstrap-original-SE |

## All primary per-map win rates

| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |
|---|---|---:|---:|---:|---:|
| coast | whale | 34.11% | 27.75% | 40.48% | 128 |
| coast | gemini | 9.90% | 6.07% | 13.72% | 128 |
| coast | gpt | 14.97% | 10.48% | 19.47% | 128 |
| coast | claude | 25.52% | 19.30% | 31.74% | 128 |
| coast | grok | 7.55% | 4.27% | 10.83% | 128 |
| coast | glm | 7.94% | 4.66% | 11.23% | 128 |
| mountain | whale | 3.12% | 1.03% | 5.22% | 128 |
| mountain | gemini | 20.70% | 15.56% | 25.85% | 128 |
| mountain | gpt | 12.76% | 8.33% | 17.19% | 128 |
| mountain | claude | 9.64% | 5.74% | 13.53% | 128 |
| mountain | grok | 22.14% | 17.06% | 27.21% | 128 |
| mountain | glm | 31.64% | 25.42% | 37.86% | 128 |
| town | whale | 22.27% | 16.56% | 27.97% | 128 |
| town | gemini | 11.98% | 6.65% | 17.31% | 128 |
| town | gpt | 16.80% | 11.58% | 22.02% | 128 |
| town | claude | 26.69% | 20.71% | 32.67% | 128 |
| town | grok | 11.72% | 7.45% | 15.98% | 128 |
| town | glm | 10.55% | 6.47% | 14.62% | 128 |
| quarry | whale | 23.31% | 17.92% | 28.69% | 128 |
| quarry | gemini | 21.88% | 16.91% | 26.84% | 128 |
| quarry | gpt | 16.67% | 11.97% | 21.37% | 128 |
| quarry | claude | 16.02% | 11.39% | 20.64% | 128 |
| quarry | grok | 9.24% | 5.58% | 12.91% | 128 |
| quarry | glm | 12.89% | 8.80% | 16.99% | 128 |
| forest | whale | 26.69% | 20.35% | 33.04% | 128 |
| forest | gemini | 18.10% | 12.94% | 23.26% | 128 |
| forest | gpt | 16.15% | 11.26% | 21.03% | 128 |
| forest | claude | 17.97% | 13.05% | 22.88% | 128 |
| forest | grok | 8.98% | 5.44% | 12.53% | 128 |
| forest | glm | 12.11% | 7.77% | 16.45% | 128 |
| workshop | whale | 8.72% | 5.11% | 12.34% | 128 |
| workshop | gemini | 19.40% | 14.71% | 24.09% | 128 |
| workshop | gpt | 14.97% | 10.14% | 19.81% | 128 |
| workshop | claude | 11.46% | 7.23% | 15.69% | 128 |
| workshop | grok | 22.79% | 17.77% | 27.80% | 128 |
| workshop | glm | 22.66% | 17.17% | 28.14% | 128 |
| harvest | whale | 2.73% | 0.53% | 4.94% | 128 |
| harvest | gemini | 18.23% | 13.01% | 23.45% | 128 |
| harvest | gpt | 16.80% | 12.07% | 21.52% | 128 |
| harvest | claude | 9.11% | 5.27% | 12.96% | 128 |
| harvest | grok | 25.26% | 19.72% | 30.80% | 128 |
| harvest | glm | 27.86% | 22.53% | 33.20% | 128 |
| desert | whale | 10.42% | 6.50% | 14.33% | 128 |
| desert | gemini | 22.40% | 17.31% | 27.48% | 128 |
| desert | gpt | 16.80% | 12.07% | 21.52% | 128 |
| desert | claude | 15.76% | 10.95% | 20.56% | 128 |
| desert | grok | 16.15% | 10.95% | 21.34% | 128 |
| desert | glm | 18.49% | 13.50% | 23.48% | 128 |
| snow | whale | 11.07% | 6.81% | 15.33% | 128 |
| snow | gemini | 26.82% | 20.77% | 32.87% | 128 |
| snow | gpt | 15.89% | 11.19% | 20.58% | 128 |
| snow | claude | 13.15% | 8.92% | 17.38% | 128 |
| snow | grok | 12.11% | 7.62% | 16.60% | 128 |
| snow | glm | 20.96% | 15.38% | 26.55% | 128 |
| caldera | whale | 1.17% | 0.00% | 2.70% | 128 |
| caldera | gemini | 8.20% | 4.59% | 11.82% | 128 |
| caldera | gpt | 17.06% | 12.15% | 21.97% | 128 |
| caldera | claude | 7.94% | 4.39% | 11.49% | 128 |
| caldera | grok | 41.54% | 35.57% | 47.50% | 128 |
| caldera | glm | 24.09% | 18.81% | 29.37% | 128 |
| garden | whale | 20.31% | 14.86% | 25.76% | 128 |
| garden | gemini | 12.89% | 8.58% | 17.20% | 128 |
| garden | gpt | 19.14% | 14.58% | 23.70% | 128 |
| garden | claude | 31.25% | 25.36% | 37.14% | 128 |
| garden | grok | 8.59% | 5.04% | 12.15% | 128 |
| garden | glm | 7.81% | 4.08% | 11.55% | 128 |
| airfield | whale | 4.30% | 1.76% | 6.83% | 128 |
| airfield | gemini | 21.61% | 16.49% | 26.74% | 128 |
| airfield | gpt | 17.84% | 12.76% | 22.92% | 128 |
| airfield | claude | 7.55% | 3.88% | 11.22% | 128 |
| airfield | grok | 21.88% | 16.31% | 27.44% | 128 |
| airfield | glm | 26.82% | 20.62% | 33.02% | 128 |

## Primary racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 55296/55296 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 1292 / 9216 | 0 | 1292 / 1274 / 1263 / 1332 / 1506 / 2549 | 134.13 / 236.29 / 300.92 | 9.43 | 8.99 | 13.32 | 0.00 | 15.54 |
| gemini | 1629 / 9216 | 0 | 1629 / 1650 / 1651 / 1616 / 1540 / 1130 | 135.71 / 236.46 / 298.97 | 9.44 | 9.00 | 15.16 | 0.00 | 15.94 |
| gpt | 1504 / 9216 | 0 | 1504 / 1626 / 1726 / 1636 / 1495 / 1229 | 135.13 / 236.02 / 299.19 | 9.65 | 9.22 | 13.34 | 0.00 | 16.37 |
| claude | 1475 / 9216 | 0 | 1475 / 1489 / 1533 / 1540 / 1639 / 1540 | 134.24 / 235.82 / 299.78 | 9.64 | 9.22 | 12.98 | 0.00 | 16.41 |
| grok | 1597 / 9216 | 0 | 1597 / 1579 / 1539 / 1535 / 1500 / 1466 | 135.95 / 237.31 / 298.51 | 9.30 | 8.87 | 14.14 | 0.00 | 16.02 |
| glm | 1719 / 9216 | 0 | 1719 / 1598 / 1504 / 1557 / 1536 / 1302 | 136.09 / 236.89 / 298.37 | 9.23 | 8.78 | 15.09 | 0.00 | 15.91 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Mixed racer diagnostics (raw input rows)

Rejected-advance reasons: none recorded. Reason detail is present for 27648/27648 racer starts; 0 recorded invalid steps have no reason detail.

| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| whale | 814 / 4608 | 0 | 814 / 712 / 517 / 442 / 557 / 1566 | 135.35 / 243.83 / 320.61 | 8.30 | 7.59 | 9.20 | 0.00 | 12.31 |
| gemini | 772 / 4608 | 0 | 772 / 766 / 734 / 829 / 880 / 627 | 136.82 / 241.50 / 313.20 | 8.70 | 8.03 | 10.84 | 0.00 | 13.29 |
| gpt | 792 / 4608 | 0 | 792 / 734 / 847 / 769 / 826 / 640 | 136.18 / 241.26 / 313.31 | 8.99 | 8.33 | 9.79 | 0.00 | 13.55 |
| claude | 774 / 4608 | 0 | 774 / 767 / 756 / 619 / 858 / 834 | 135.74 / 241.48 / 315.53 | 9.13 | 8.47 | 9.33 | 0.00 | 13.49 |
| grok | 696 / 4608 | 0 | 696 / 814 / 880 / 1015 / 721 / 482 | 137.09 / 241.09 / 310.09 | 8.95 | 8.31 | 10.35 | 0.00 | 13.82 |
| glm | 760 / 4608 | 0 | 760 / 815 / 874 / 934 / 766 / 459 | 136.86 / 240.95 / 310.98 | 8.94 | 8.29 | 10.92 | 0.00 | 13.74 |

Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.

## Uncertainty and interpretation

Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback.

10,000 deterministic bootstrap draws; seed 2050076829; 84 joint endpoints; critical max-t 3.631568.

Bootstrap coverage is approximate. Degenerate/one-block endpoints use conservative weighted Hoeffding bounds. Individual races and racers are never independent bootstrap observations.

Win rates retain all six rotations in each complete block, including DNF/no-winner races. Raw diagnostics retain every input row. Finish-time summaries condition on finishers; lap-time summaries condition on recorded laps. Raw pooled diagnostics are not equal-map estimands.

Fail means a failed observed/safety criterion or an interval fully beyond a permitted boundary. Inconclusive means insufficient precision, missing coverage, or unverified holdout eligibility. A pass applies only to the stated statistical checks.

Statistical criteria only. Candidate freezing, untouched holdout provenance, identical-role controls, deterministic replay, archetype ordering, and source-integrity review require separate evidence.
