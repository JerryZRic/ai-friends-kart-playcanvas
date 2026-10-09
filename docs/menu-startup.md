# Home startup readiness

The main screen starts with an HTML-first title and loading panel. Its four
navigation buttons are hidden, inert, and disabled until the current scene has
successfully rendered a visible frame and had a browser paint opportunity.
Handlers also reject premature programmatic activation.

Progress describes four real initialization stages, not guessed download bytes:
menu program, engine startup, procedural scenery/material creation, and first
visible frame. Scene construction and first render are separated by animation
frames so the preceding status can paint. The home preview does not preload any
of the six driver GLBs; race assets continue to load at race entry.

A script/network error, failed WebGL initialization, render error, or startup
context loss shows recovery actions. A 30-second watchdog also ends an unresolved
loading state. Reload preserves the current URL. Once menu handlers exist, the
user can explicitly continue with the static course poster instead of the live
background. This fallback makes the menu usable; it does not claim that a device
without WebGL can run a 3D race.

Every return to the home screen starts a fresh gate. Render-generation guards
prevent a stale import or old frame callback from unlocking a newer screen.
Direct map/character/settings routes do not wait for home scenery. Existing
history, selection, back navigation, camera motion, and race loading stay intact.

Regression tests cover inline shell startup with no module, stage ordering,
module failure, watchdog expiry, retry, static fallback, premature activation,
re-entry and history, engine failure, context loss, hidden tabs, reduced motion,
and cancellation. NullGraphicsDevice and DOM tests do not establish real GPU
shader quality or visual rendering on a supported hardware/browser combination.
