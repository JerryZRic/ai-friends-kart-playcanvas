# Optional same-slot upgrade experiment

This is a separate dev experiment, disabled by default. The normal two-slot rules remain the v1.0.2a baseline. In a dev race, pause and enable “实验：三同类升级”, then choose “应用并重新开始”. This restarts the race; ticking the checkbox alone does not change an active race. The URL carries `itemStacking=1`. Stable builds do not offer or enable this setting.

## Rules

- E/R keep fixed positions. Pickups prefer an existing ordinary stack of the same kind (E first if both match), otherwise the first empty slot.
- One ordinary item becomes ×2 on the next matching pickup. Each press uses one ordinary item. The third matching pickup converts that stack to one upgraded item; one use empties it. No cross-slot movement or hidden progress.
- Upgraded items cannot absorb more pickups. An empty other slot can begin a new stack. Two full slots reject incompatible boxes without consuming them.
- Full inventory rejects mystery boxes before drawing their reward. With an empty slot, the existing successful-claim random draw is retained and can join an ordinary matching stack. There is no trial draw/rejection/reroll loop.
- E/R share a 1.2-second release cooldown only in the experiment. Requests during cooldown are discarded, not queued. Existing E-first, at-most-one-use-per-tick and use-before-pickup ordering remain.
- Player and NPC use the same capacity, acceptance and effects. NPCs retain existing per-item use conditions; they are not instructed to hoard for upgrades or given future-box knowledge.

## Initial effect probes, not final balance

| Item | Upgraded effect |
| --- | --- |
| Boost | 6.6 seconds instead of 3.3, same peak multiplier |
| Shield | Same 6 seconds, additionally removes existing ordinary/upgraded pulse slow only; collision/terrain slow survives |
| Pulse | Same 3 seconds, range, nearest-target and shield blocking; speed multiplier .45 rather than .55. No-target fallback remains 1.9-second boost |

Ordinary and upgraded pulse timers expire independently; a normal hit cannot extend upgraded strength. Active shield blocks another shield use without consuming it. There is deliberately no extra recovery window: another shield after expiry can still create continuous coverage. This remains a known balance risk, not a solved anti-chain guarantee.

## Verification boundary

Pure inventory tests cover all 100 valid two-slot states against all three incoming kinds, material conservation, use counts, upgrades, fixed slots and cancellation. Effect tests cover source isolation, full mystery rejection without RNG, shield/pulse targeting and baseline-OFF behavior. Runtime tests cover water capacity/reset and land speed adapters. Existing targeted CPU and water compatibility tests remain useful; none certify new item economy, win rates or fun. No real browser or mobile playtest is claimed.

R1-06 preferred a different cross-slot recipe; this prototype intentionally chooses its alternative same-slot stacking model. Old C21/holdout results remain historical baseline evidence. Supply, character tuning, F/Token and new item kinds are outside this experiment.
