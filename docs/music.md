# Original theme and race music

The project owner supplied the three original MP3 recordings under
`public/assets/music/`. Their exact uploaded bytes and metadata are retained;
see the adjacent README for durations and checksums and
[the separate music license](../public/assets/music/LICENSE.txt) for the
author-approved non-commercial game/fork permission. Copyright © 2026 JerryZRic;
commercial use needs prior author permission. Code AGPL terms are unchanged. They are
served from the same origin using relative URLs, including under `/dev/`.
No CDN, MIDI SDK, transcoding, or required-model loading gate is involved.

## Playback lifecycle

- First home: theme starts only when the home is revealed (including the
  explicit fallback), then loops through same-document map, character,
  race-settings and settings navigation.
- Garage and other menu scenes share the same document and music controller.
  Returning to the homepage does not restart or interrupt the playing theme.
- A full document reload replays the Timewish intro and starts new theme media
  at time zero. Playback position is no longer read from or written to session
  storage; only the user's volume and mute preferences persist.
- Entering a track: menu theme fades before navigation. Track resource loading
  and its camera return are silent. Race audio preloads independently without
  playback. Music is optional and never blocks play.
- The countdown retains its existing sound effects; BGM starts at GO, when
  driving actually begins: dfy_bgm.mp3 on all 12 land courses, and
  dfy_fusion.mp3 only on waterpark (A01). Pausing an active race ducks BGM to
  30% of the selected music volume; continuing restores that volume.
- Completed standings: race BGM fades out and theme fades in on the same page.
  This happens when the game presents its final result, not merely when the
  player crosses the line while waiting for other racers. Replay starts BGM.
- Leaving a race: the playing track fades out before navigation; theme fades
  in on the destination menu. Resting/exit screen is silent.
- Hidden tabs are silent; on returning, the existing race pause policy remains
  authoritative. Music does not resume the simulation or take input focus.

## Browser policy and settings

Playback is attempted normally. Browsers may require a trusted click/touch or
keyboard gesture, including after a full-page navigation. The first ordinary
page interaction synchronously requests audio unlock without an extra modal,
input cancellation, silent-play workaround, or promise of universal autoplay.
Each document owns one controller, one Web Audio context and two media sources.

Menu settings and the race pause panel have a persistent music toggle and
volume slider. Default music volume is 65%. Sound effects retain their existing
independent toggle. Storage denial does not block play. Network/audio failures
can be retried by ordinary interaction; music does not delay asset readiness.
Rapid state changes cancel obsolete fades and stale play completions. Page
lifecycle cleanup releases listeners and audio resources.

## Verification scope

Automated controller tests use injected media, Web Audio and timers. Integration
checks cover state wiring, settings and unmodified source MP3 hashes. These do
not establish actual perceived loudness, loop-point quality, iPhone autoplay,
or Windows audio-device compatibility. This change publishes dev only; it does
not modify the stable root, main, or the frozen Windows release package.
