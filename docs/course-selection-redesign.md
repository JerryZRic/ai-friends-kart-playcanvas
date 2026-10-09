# Course selection redesign

The desktop map picker presents compact, side-by-side course cards on the left
and the selected course's larger scenic preview on the right. On smaller screens
the cards move above the preview. Both cards use uncropped, complete-route 3D
overviews, with a clear selected state and arrow/Home/End keyboard navigation.

The right-hand camera fits the actual route and landmark geometry from an
elevated position. Its limited, slow orbit avoids the former close-up view where
foreground palm leaves could obscure the track. It is independent of the title
screen's camera distance, motion and scene-switch timing.

The course overview assets are generated from the same PlayCanvas scene meshes
as the game, using an offline CPU renderer. They are not browser/GPU screenshots;
see [asset provenance and regeneration](map-preview-assets.md). If WebGL is
unavailable or its context is lost, the selected overview remains visible in the
large preview panel with a `3D 俯视图` label.

The two race routes use original geometry and varied sequences of straights,
counter-turns, open hairpins and sweeping bends. Their complexity is a project
design description, not an official Nintendo difficulty category. General
inspiration includes corner planning, drift timing and choosing a pickup line:

- [Nintendo's Mario Kart 8 Deluxe driving basics](https://www.nintendo.com/jp/ichikara/aabpa/index_en.html)
- [Nintendo's official Booster Course Pass course overview](https://mariokart8.nintendo.com/booster-course-pass/)

No Nintendo course geometry, artwork, characters, audio or other assets are
included. The width, six-character racing systems and route-relative item lines
remain part of this project's own game.

Validation distinguishes CPU geometry, navigation, resource lifecycle and race
simulation checks from actual GPU play. These automated and offline-render
checks do not establish target-device GPU appearance, shader behavior or frame
rate. Test the live preview on the intended browser and hardware for those checks.
