# Route physics regression split

Historical replay: exact commit `33988b49dee01547238c08df4684cce93fae9497` (v1.0.1a), with its complete 31-file reachable source graph isolated from current imports. The nine pre-existing gameplay-balance files retain every frozen numeric observation and assertion, now clearly labeled historical.

Current replay: accepted commit `4d9b345f0cb938af092b57e4231396b03ff64858`. The 35 source/dependency inputs have original Git blob IDs and SHA-256 hashes. Every input is mutation-tested. The current suite imports production modules and compares all 1,006 complete physical results exactly, including total time, branch time, total/branch rail contact and route choice. No runtime curve, route geometry, item power, collision guard or threshold is changed.

Coverage: nine maps; default whale plus all six authored character/build pairs; both routes at 30/60/120/144/240 Hz; three-second stale decisions for every build; nine additional default-build delays; quarry uncorrected steering at all five rates; legacy direct-step default runs. The unchanged production benchmark checks accepted progress, finite state and full-lap completion. Clean runs separately require zero rail contact. Its zero boost/slow inputs and shared physics remain exact pinned source, rather than introducing a branch-specific bonus.

The following current 60 Hz clean narrow routes are slower than the wide route. Negative signs are explicit accepted observations, not universal shortcut guarantees. All five rates are separately pinned; none are skipped.

- caldera: gpt/straight: -0.016666667 s
- desert: gpt/straight: -0.800000000 s
- desert: glm/balanced: -0.566666667 s
- forest: grok/impact: -0.016666667 s
- forest: glm/balanced: -0.083333333 s
- garden: gpt/straight: -0.166666667 s
- harvest: glm/balanced: -0.250000000 s
- quarry: whale/default: -0.916666667 s
- quarry: whale/balanced: -0.916666667 s
- quarry: gpt/straight: -1.233333333 s
- quarry: claude/start-hill: -0.266666667 s
- quarry: grok/impact: -0.800000000 s
- quarry: glm/balanced: -1.166666667 s
- snow: gpt/straight: -0.550000000 s
- snow: glm/balanced: -0.316666667 s
- workshop: whale/default: -0.616666667 s
- workshop: whale/balanced: -0.600000000 s
- workshop: gpt/straight: -0.616666667 s
- workshop: claude/start-hill: -0.233333333 s
- workshop: grok/impact: -0.750000000 s
- workshop: glm/balanced: -0.866666667 s

Fixtures are deliberately not auto-regenerated in tests. Future intentional physics changes require a separately reviewed source manifest and observations. This alignment preserves accepted parameters; it does not certify human balance, arbitrary loadouts, traffic/item outcomes, or GPU performance.
