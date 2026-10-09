# Original medium-complexity courses

The current dev courses replace the earlier level-0 S loops. Both remain
three-lap races for six drivers, with the same shared race interface, item
systems and controls. “Medium-complexity” is this project's design target,
not an official Nintendo difficulty rating.

## Reference principles, original geometry

Nintendo's [Mario Kart 8 Deluxe driving guide](https://www.nintendo.com/jp/ichikara/aabpa/index_en.html)
shows the value of drift lines, inside corners and choosing between course
features and pickups. The [official course overview](https://mariokart8.nintendo.com/booster-course-pass/)
provided broad references for varied turn rhythm and memorable landmarks.
No Nintendo course coordinates, layouts, artwork or other assets are copied.
The authored splines and generated scenery in this repository remain original.

## Sunset Coast

- Approximately 1,373 m per lap, arranged as four unequal coastal lobes
- Headland climb, downhill chicane, a genuine open lookout hairpin, cross-island esses, palm bluff and harbour double apex
- The main open hairpin turns approximately 177 degrees; the three substantial counter-turn groups turn about 55–102 degrees
- Approximately 853 degrees of accumulated turning using a 7 m look-ahead, compared with about 515 degrees on the earlier S course
- Elevation spans about 2.4–12.6 m; sampled maximum grade stays below 8%, with no jumps or road crossings
- Road width changes smoothly from 13.2 m to 16.4 m, preserving the 14.4 m starting grid and widening the major corner sequences
- Actual road, curb, rail and driving limits use the same width function; lane markings follow slopes and signs follow upcoming curvature
- Forty-five staggered pickups keep centre recovery choices and reachable optional corner-exit lines
- Original coast prop assets remain unchanged; intruding rocks and unsupported offshore palms are omitted, and island caps retain their anti-z-fighting offsets

The tightest sampled centreline radius remains above 20 m, leaving room for
both full-width road edges and rails. The narrow sections remain wider than the
AI's normal passing/pickup envelope. This course now asks for more intentional
steering and drift setup than the previous level-0 route.

## Sunny Waterpark

- Approximately 921 m per lap with three unequal bowls and two pronounced counter-bends
- A tower-side horseshoe, garden dogleg, eastern bowl, lagoon counter-bend and broad south return, followed by the bridge approach
- Counter-turns now turn approximately 53 and 85 degrees instead of the earlier 25 and 33 degrees; the south return totals about 201 degrees
- Approximately 649 degrees of accumulated turning using a 7 m look-ahead, compared with about 482 degrees previously
- A consistent 24 m canal retains forgiving water handling; full promenade boundaries remain clear of the open-hairpin centres
- Fourteen authored pickups offer centred recovery choices and optional offset lines at exits
- The bridge geometry, scenery details and shader shadow share one calm route anchor; the tower is positioned in the northern bowl
- Concave garden and exterior land use even-odd polygon filling rather than a centre fan or radial apron, so inlets cannot fill with grass
- Tower, palm canopies, parasols, pavilions and distant resort blocks are checked against every canal branch, including nonlocal sections

A bounded outward current follows actual turn curvature, so bends invite
steering corrections while preserving water inertia. The water surface waves,
refraction system and original 285 m art-study route remain unchanged. No
jumps, forks or new obstacle mechanics are introduced.

## Geometry, race and performance contracts

`closed-circuit.ts` remains the shared closed centripetal spline and arc-length
lookup. Map-specific control points retain metre-based distance, continuous
wrapped positions and tangents, and a common lateral frame. The historical Coast
migration fixture remains separately checked; it does not describe today's dev
route.

Geometry tests check seam continuity, actual turn-angle accumulation, minimum
radius, width/grade, full-width branch clearance, triangle winding and land area,
exact coping boundaries, global scenery clearance, bridge alignment and pickup
bounds. Full-race tests exercise all six selected profiles, NPC lane bounds,
real item collection/use, eight sequential water gates per lap, three-lap
results and finish freezing. Fixed-step water race replays agree at 30/60/120 Hz.
Water steering decisions are held for one second in that equivalence test, so
each frame rate receives the same control sequence.

The complete static water race scene has 122,028 triangles, below the existing
125,000 limit. Its water surface uses 1.6 m longitudinal rows and 55,296 vertices,
within 16-bit indices. Small railing posts and palm fruit use reduced
subdivision; the study assets retain their previous subdivision. The underwater
basin and inlays use 9,676 triangles in two batches. Coast retains its existing
road/rail mesh budgets.

CPU geometry review and NullGraphicsDevice tests do not establish browser/GPU
rendering or actual-device frame rates. Target-device visual and performance
checks remain necessary, especially with all six character models.
