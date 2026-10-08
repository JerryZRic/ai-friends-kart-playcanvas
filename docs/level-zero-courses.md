# Level-0 courses

The beginner courses now have authored direction changes and route choices rather
than using a simple stadium loop. They remain three-lap races for six drivers,
with the same shared race interface, items and controls.

## Sunset Coast

- Approximately 1,056 m per lap
- Broad connected bends and shallow S transitions, with unequal acceleration straights
- Gentle overlooks and descending return sections; sampled maximum grade is below 5%
- Road width changes smoothly from 12.4 m to 16.4 m, with the 14.4 m starting grid preserved
- Actual road, curb, rail and driving limits use the same width function
- Lane markings follow road slopes; direction signs follow upcoming curvature
- Original prop models are unchanged; intruding rocks and unsupported offshore palm placements are omitted
- Overlapping island caps have tiny height separation to avoid coincident surfaces

The narrow sections remain wider than the AI's normal passing/pickup envelope.
A player can correct the familiar outward turn pressure without using advanced
drift techniques. The new route's tightest bend is gentler than the old course's.

## Sunny Waterpark

- Approximately 760 m per lap, with two linked S sequences and unequal straights
- A recovery straight under the bridge near the finish approach
- A consistent 24 m canal, retaining forgiving water handling
- Fourteen authored pickup positions: centered recovery choices and optional offset lines at exits
- The bridge geometry, scenery details and shader shade share one route anchor
- A filled infield and exterior apron follow the actual promenade boundaries, leaving the canal and underwater basin unobstructed

A gentle bounded outward current follows turn curvature, so bends invite small
steering corrections while preserving the water mount’s inertia. The water
height, surface waves, transparent-water effect and original art-study route are
unchanged. No jumps, forks or new obstacle mechanisms are introduced.

## Geometry and performance contracts

`closed-circuit.ts` is the shared closed centripetal spline and arc-length lookup.
Map-specific control points retain metre-based distance, continuous wrapped
position/tangent sampling and a common lateral frame. The old Coast control
points remain a historical migration fixture, not a claim that the new route
matches the old layout.

Geometry tests check seam continuity, finite tangents, curvature, width/grade,
road and bank clearance, terrain winding, bridge alignment and pickup bounds.
Full-race simulations check character tuning, legal lanes, checkpoints and
finish results. Water scenery retains the existing 125,000-triangle ceiling and
16-bit batch constraints; Coast keeps its existing road/rail mesh sampling
budgets. New layout does not justify silently increasing those budgets.

CPU geometry review and NullGraphicsDevice tests do not establish browser/GPU
rendering or actual-device frame rates. Test the dev preview on target hardware
before treating appearance and performance as confirmed.
