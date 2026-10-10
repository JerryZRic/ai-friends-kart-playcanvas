# Modular kart tuning, dev preview

This is an experimental **fresh-vehicle** implementation for the coast circuit.
The six existing drivers retain their existing identities and coefficients.
Waterpark animal mounts do not use this configuration.

## Inventory and identity

`src/kart-catalog.json` contains 54 complete themes, 324 parts, and exactly 54
parts per slot: `body`, `chassis`, `motor`, `transmission`, `battery`, `wheels`.
Part IDs preserve the frozen inventory, for example
`kit001::01_BodyShell` and `kit054::06_Battery`. Theme names, slot labels and
archetype names are search/display metadata. Runtime assets are resolved by the
separate verified asset manifest, never by a URL supplied in a saved build.

The public catalog contains only design parameters and public part identity.
It does not include private provenance, private file IDs or local source paths.

A `KartBuild` is an object containing exactly the six slot keys, each with an
existing part ID belonging to that slot. There is **no same-theme bonus**,
rarity bonus, hidden character bonus, or unlock requirement.

## First-run and starter builds

The default is a six-theme balanced mix:

- Body: `kit028::01_BodyShell`
- Chassis: `kit023::02_ChassisSuspension`
- Motor: `kit033::04_Motor`
- Transmission: `kit025::05_FinalDrive`
- Battery: `kit019::06_Battery`
- Wheels: `kit031::03_WheelsTires`

Its fresh physical parameters and aggregate mass exactly match the design
reference: 208 kg including a fixed 70 kg driver. All three build multipliers
are exactly 1, so selecting it preserves the original flat/straight character
stats. Character choice never changes this assumed mass.

Six editable mixed-theme starter examples are also included: corner,
straight, launch/climb, endurance-design, heavy practice and agile. They are
examples, not an assertion that every combination has been competitively
balanced.

## Parameter layers

1. **Raw design parameters** use their declared units: kilograms, newton-metres,
   kilowatts, gear ratio, etc. They are proposed gameplay values, not measured
   real-world vehicle properties.
2. **Neutral SI estimates** combine those parameters using the fresh version
   of the design formula. They explain tradeoffs and are not added to the
   game's existing units.
3. **Build multipliers** normalize those estimates to the reference and clamp
   them. Acceleration: 0.80–1.20; speed: 0.88–1.12; handling: 0.85–1.15.
4. **Character and map tuning** multiplies the existing character coefficient
   by the build coefficient. The original coast baseline remains
   acceleration 18, speed 42 and steering 7.
5. **Coast track context**, when passed, adds an explicit geometry-dependent
   corner limit and a bounded slope-sensitive drive response. This is an
   additional game rule, separate from the fresh SI proposal.

The flat force estimate is the minimum of wheel torque, available drive
power divided by speed, and tyre traction. Resistance combines aerodynamic
drag and rolling resistance. Available power is the smaller of motor output
and battery output, multiplied by motor and transmission efficiencies.

Acceleration uses a 40% launch / 60% 20 m/s index. Top speed is the lower
force/resistance equilibrium under the wheel RPM ceiling. Handling uses
wheel grip × chassis corner stability. These are the exact fresh formulas
used by the six supplied sample builds; the tests check their published SI
estimates and rounded multipliers.

Body drag and mass, chassis mass/stability, motor torque/power/RPM/efficiency,
transmission ratio/efficiency/mass, battery output/mass, and wheel grip/rolling
resistance/mass therefore affect driving. Many choices interact: a high-power
motor can be battery-limited, and a short final drive trades speed for launch
force.

## Track context and fairness

`KartTrackContext` accepts:

- `speed`: current speed in existing coast game units
- `grade`: rise/run, for example tangent.y / hypot(tangent.x, tangent.z)
- `curvature`: signed yaw radians per metre; corner severity uses its magnitude

Non-finite values become zero. Speed, grade and curvature are bounded before
use. No race rank, player distance, random value or catch-up factor is read.
The same calculation is available to player and rivals.

At tight bends, the speed ceiling depends on grip rather than allowing long
gearing to dominate every corner. A mild bend interpolates toward that
ceiling. The corner multiplier stays within 0.5–1.0. This track ceiling may
lower effective top speed below the fresh straight-line clamp; it is not a
hidden build penalty. The corner starter wins a sharp-corner comparison,
while the straight starter wins the straight-line comparison.

On slopes, the fresh acceleration multiplier is blended with the current
speed/grade force ratio, then clamped to 0.80–1.20. This retains a launch/climb
advantage for the short-drive example at low speed. `gradeAcceleration`
(-9.81 × grade, bounded by the input grade) is exposed separately for the race
integration to apply gravity; `kartTuning` does not silently add an SI force
to the character's acceleration coefficient.

`kartTuning().multipliers` is the **combined** character × build × track
coefficient used by existing controls. `characterMultipliers` and
`buildMultipliers` remain separately inspectable. For coast,
42 × multipliers.topSpeed = maxSpeed, 18 × multipliers.acceleration =
acceleration, and 7 × multipliers.steering = steering.

## Deliberately absent systems

There is no purchasing, currency, unlock tree, per-race charge drain,
part damage, durability consumption, repair action or repair charge.
All builds start fresh and fully powered. Battery capacity, durability,
rigidity, estimated cruise duration, roll threshold and recovery time are
retained as design metadata; they do not imply that a corresponding full
simulation or repair system exists in this preview.

In particular, the source design's same-archetype heavier variants trade
mass against durability. Because this preview does not consume durability,
those heavier variants currently lack that proposed durability benefit.
Do not interpret the 324-part inventory as 324 competitively equal choices.
Actual race balance, visual clipping and driving feel still need playtesting.

## Pure API

`src/kart-build.ts` exports:

- `KART_SLOTS`, `SLOT_LABELS`, `catalog`/`parts`, `partsBySlot`, `themes`, `getPart`
- `defaultBuild`, `starterBuilds`, `validateBuild`, `resolveBuild`, `buildParts`
- `buildStats`, `buildPerformance`, `kartTuning`, `compileKartBuild`
- `defaultGarageState`, `parseGarageState`, `loadGarageState`, `saveGarageState`
- The associated TypeScript build, part, stats, context and state types

Compile once when preparing a race:

```ts
const kart = compileKartBuild(savedBuild);
const tuning = kart.tuning(driverId, 'coast', {speed, grade, curvature});
```

A compiled build is an immutable snapshot. Its per-frame performance method
does not search the inventory or recalculate SI estimates. Bounded caches
retain at most 128 stats entries and 128 compiled snapshots. Callers holding
a snapshot can continue to use it safely after cache eviction.

`resolveBuild` supports interactive partial edits by preserving valid slots
and substituting default parts for invalid ones. `validateBuild` is strict:
extra keys, missing slots, foreign URLs, mismatched slots and unknown IDs fail.

## Local persistence

The localStorage key is `ai-friends-kart:modular-garage:v1`.

```ts
type GarageState = {
  version: 1;
  activeBuild: KartBuild;
  namedBuilds: {id: string; name: string; build: KartBuild}[];
};
```

At most 24 named builds are stored. IDs are 1–64 ASCII letters, digits,
underscores or hyphens, beginning with a letter or digit. Names must be
trimmed, nonempty, at most 48 UTF-16 code units, without control characters.
No executable code, model URL, character stat or raw tuning value is stored.

Reads accept only JSON strings up to 48,000 characters and the supported
schema version. An invalid active build resets to the balanced default;
invalid or duplicate named records are dropped. Unsupported versions,
invalid envelopes and malformed JSON reset safely. Reading never writes
back, so corrupt data is not automatically overwritten.

Saving rejects malformed states rather than quietly repairing and replacing
them. It returns `false` for validation failure, unavailable storage, blocked
storage or quota errors. Successful saves return `true`. Persistence is
browser/origin-specific. Stable and preview paths on the same host share the origin;
this modular garage uses its own versioned key.

## Verification

Run `node --import tsx --test tests/kart-build.test.ts`.

The focused suite covers catalog completeness, exact sample estimates, all
46,656 six-archetype combinations, 2,000 deterministic full-catalog mixes,
all single-part substitutions, equivalent-physics/no-theme-bonus cases,
all six original characters, waterpark bypass, straight/launch/corner
advantages, extreme and non-finite context, immutable snapshots, strict
storage round-trips, invalid IDs, corrupt JSON, duplicate records, storage
limits and browser access/quota failures. These are deterministic unit
checks, not a claim of complete gameplay or visual balance validation.
