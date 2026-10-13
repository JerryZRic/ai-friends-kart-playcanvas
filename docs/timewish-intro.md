# Timewish cold-start presentation

The approved outlined SVG is copied unchanged to `public/brand/timewish.svg`
(SHA-256 `0392baa24bd617a602a13164e4695309d8eb213baeb2f5be2bf532484666c8f8`).
It is centered with its intrinsic aspect ratio on white: quick fade-in, brief
hold, then the logo and white cover fade away together, approximately two seconds.
Reduced-motion mode uses a shorter static display without animated fades.

The cover is part of each cold document entry, not a scene template. It survives
scene markup replacement while real menu resources load in parallel. Menu/garage
cold entries also buffer the theme; the intro's transient presentation gate does
not alter saved mute or volume. After the cover ends, already-ready menu music
may start; otherwise the existing resource loading/recovery UI continues. A real
pointer/key gesture can unlock audio while the cover is visible, without bypassing
browser autoplay policy. Neither scene readiness nor cover removal waits for
successful audio playback.

A lightweight inline recovery control is independent of the SPA bundle and
reveals reload on module failure/timeout. Once the host starts, that temporary
hook is released. Scene switches do not replay the logo. Main and Windows release
files are outside this development preview change.
