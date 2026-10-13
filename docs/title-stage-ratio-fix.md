# Title-stage proportion correction (2026-10-13)

Baseline: `6c73581de6623076a535830b03ffc8703f0facf5`.

The previous title artwork used a contained 1600×900 composition while the
buttons used viewport-relative position, independent size clamps, and a
portrait-only two-column layout. A near-square browser window therefore
separated the portrait's bottom from the button row and changed their relative
sizes.

Title, portrait, and all four visible plates now share one 1600×900 stage and
one uniform scale: `min(safeWidth/1600, safeHeight/900)`. The live 3D background
continues to fill the viewport. Safe-area insets reduce and recenter the stage.
Only transparent button hit areas expand to a 48 CSS-pixel height; the visible
plates, text, and icons keep their exact stage-relative size.

No artwork, audio, navigation, map, race, or stable-release assets were changed.
TypeScript and the production build were checked for this change. Layout
arithmetic was checked at desktop, near-square, portrait, landscape-phone, and
ultrawide sizes. Browser/GPU/device rendering was not verified.

This is an F5 compile-and-deploy change under the current user-requested release
policy. Historical frozen audit JSON is retained byte-for-byte, not relabeled
as evidence for this new layout. Full/source-hash certification and legacy
viewport-specific title assertions have not been rerun or repinned here.
