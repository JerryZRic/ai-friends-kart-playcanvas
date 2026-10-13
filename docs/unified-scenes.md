# Unified in-document game scenes (development preview)

The menu, garage, land races and water race now share one document and one music
controller. `spa.ts` owns navigation, scene styles, the current scene handle and
its lifetime. Existing index/garage/coast/waterpark URLs remain valid bookmarks;
in-app navigation updates history without fetching a replacement document.

Scene modules are dynamically imported and export repeatable mounts. Each old
scene is disposed before mounting its successor. Async route imports use a
latest-navigation token; race loading and asset parser lifetimes are canceled
through their scene handles. Garage and menu previews, race controls, frame
callbacks, owned global listeners and layouts are released on exit. Only the
active scene's original stylesheet set is installed, avoiding garage/menu CSS
collisions. HTML templates discard scripts and noscript before inserting markup.

Music belongs to the document, not a scene. Menu/garage changes retain its
position and AudioContext. Entering a race fades the theme, loading/countdown stay
silent, GO starts the selected looping race recording, pause uses 30% volume, and
results/menu restore the theme. The same race media element switches between
land and water recordings. Muting, volume and the separate music license remain
unchanged. No iframe is used. The earlier persistent-garage iframe prototype is
superseded.

Verification for this F5 development update: TypeScript compilation, production
build, focused route/audio and menu mount/boot checks, and import-without-DOM
checks for both race modules. This is not a full geometry regression or a claim
of browser/mobile listening tests. Inherited frozen audit evidence has not been
rewritten to claim it reviewed this lifecycle refactor. Frame-time or device
resource stalls can still occur; a single page removes document replacement as
one cause, rather than guaranteeing no stutter.
