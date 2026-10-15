# Narrow control correction and opt-in pickup diagnostics

## Scope and provenance

The four edited source files were verified byte-for-byte against dev commit
`4357252f2a356b46426419325e4fb3ff70b2f053` before editing. This is a new gameplay
revision. Existing C21 holdout evidence remains about its frozen baseline; this
patch neither reruns nor renews that evidence. Character/build parameters, maps,
ordinary items, and NPC no-target pulse holding remain unchanged.

## Forward acceleration correction

Previously, `stepRaceKartSpeed` multiplied elapsed time by the build acceleration
multiplier whenever forward throttle was held below the full speed limit. With
the handbrake held, the actual target is 0.76 times that limit. This made a higher
acceleration multiplier produce stronger deceleration between those two limits.

The shared speed integrator now applies the multiplier only to forward propulsion.
At speed 35, limit 40 and dt 0.1, multipliers 0.6/1/1.4 previously produced
33.68/32.8/31.92; all now produce 32.8 under throttle plus handbrake. Ordinary
braking, reverse, coasting, propulsion differences and effect caps are preserved.
Player and land NPC callers share this correction. This does change drift speed
trajectories and may change race outcomes; no balance improvement is claimed.

Run the reproducible probes with:

    node --import tsx scripts/diagnose-control-coupling.ts

## NPC pickup diagnostics: default remains legacy

`LandCpuFeedback.pickupReachability` observes local candidates before traffic
filtering, reporting the legacy lateral budget and a budget multiplied by current
build steering and clamped surface grip. Observation alone leaves target choices
unchanged. `LandCpuContext.pickupPlanning = 'execution-matched'` opts a diagnostic
caller into using the latter estimate. No browser setting or default behavior is
changed. Omit the option to return to legacy planning.

This isolates the lateral multiplier only. The existing longitudinal-speed
heuristic (including boost multiplication), 0.65 metre allowance, lookahead,
route eligibility and traffic rules remain unchanged. It does not promise pickup
contact or predict changing grip/speed, bank drift, forks or collisions. The
non-route execution samples grip after advancing progress, so the planning-time
grip is a local estimate rather than an exact future execution trajectory.

## Review and stopping boundary

Targeted tests reproduce the original coupling, cover acceleration/deceleration
boundaries and verify observation-only planning, opt-in targeting, current grip
and steering input, and excluded boxes/routes. Existing shared CPU parity checks
compare controllers, not old versus new physics: both call the shared integrator.

Before any claim about human driving or weak-map participation, repeat the same
short developer driving scene on baseline and this revision. Investigate an
observable input/response difference; do not tune character parameters or run
large CPU holdouts to manufacture a passing result. No E/R/F prototype, release
packaging, Windows build, or stable-main change is included.
