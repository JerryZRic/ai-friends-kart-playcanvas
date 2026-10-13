# Persistent menu / garage music host

Development fix: entering the garage from the menu no longer replaces the music
owner document. The parent `index.html` keeps its existing controller, media
sources, playback position and AudioContext. A same-origin iframe isolates the
garage's existing global CSS and rendering lifecycle. Its embedded mode does not
create or own music. Standalone `garage.html` remains supported.

- Menu preview renderers and pending async preview mounts are disposed/invalidated
  before showing the garage. Returning explicitly disposes the garage and removes
  its document before mounting a menu preview again.
- The parent URL records the garage route and current applied kart. Back/forward
  and refresh restore the route and configuration without an extra child route.
- Child navigation messages must match the exact frame window, origin, message
  shape and project-local page allowlist. The sandbox permits scripts,
  same-origin storage and the existing save form, but no top navigation/popups.
- Child input resumes the parent's audio synchronously and cancels stale pending
  departures. Normal race departures keep the established fade, loading silence,
  GO-start race track, loop and pause-volume rules.
- Existing music licensing, settings and assets are unchanged. The garage has no
  separate music settings or second controller to synchronize.

Checks: TypeScript/build and focused controller, navigation, message validation,
parent-history, disposal and menu DOM tests. No full geometry suite or claimed
real-device/audio listening verification. This removes the known cross-document
music reset in the normal menu/garage path; it cannot guarantee glitch-free audio
on every browser or under resource pressure. Old immutable audit evidence is not
rewritten to claim it reviewed these new files; stable-release audit maintenance
is separate from this F5 development preview.
