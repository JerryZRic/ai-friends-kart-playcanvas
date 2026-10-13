# Cartoon race feedback

Both land and water races now use `race-sound.ts`, an original, sample-free Web Audio synthesizer. These source-code effects follow the project's AGPL code licence; they do not change or incorporate the separately licensed original music.

- Pickup arpeggio; distinct boost, shield and pulse cues; pulse hit/block feedback
- Drift start, ready/full charge and release boost
- Debounced collision pop; each 3/2/1 boundary once; brighter GO; finish fanfare
- Independent saved effects switch and volume in the pause settings, with the existing HUD switch retained
- New profiles start at 65%; existing explicit off preferences remain off
- Gesture-unlocked, 10 concurrent oscillator ceiling, collision cooldown, no continuous loops, optional distance attenuation/cull. NPC-only events are intentionally silent; effects that hit the player remain audible
- Pause, blur, hidden document and scene disposal stop active voices; BGM owns its existing independent player

Quick verification: TypeScript check, Vite production compilation and 33 focused race-sound/race-shell/water-race tests. No full-suite or Windows packaging requirement added to the development preview workflow. Listening on a physical browser remains a subjective check.
