# Land circuit visual polish, October 2026

This iteration targets the twelve land circuits. A01 waterpark, every road spline,
collision rule, AI path and item rule remain unchanged. `main` and the v1.0.0
release stay frozen; only the isolated `dev/` preview is published.

## Visual direction and sequence

Use the waterpark's bright, controlled hierarchy: a broad main color, one quieter
supporting family and a small navigation accent. Keep the drivable surface more
neutral than the surroundings. Group props at selected viewpoints instead of
lining every metre. Add silhouette, plinth, eave and structural detail before tiny
ornament. Inner corners remain low and open; distant scenery becomes lighter.

1. **Coast, first sample:** blue sky and turquoise sea, cream sand/plaster,
   restrained coral accents; lighthouse, cabanas, parasols, slatted marina and
   anchored sailboats. Roof overhangs, shutters, verandas, lighthouse lantern
   frames and piling caps provide readable modeling detail.
2. **Mountain:** clear blue haze, fresh muted meadow and cream rock; trail shelter,
   lookout decks and grouped conifers. Refine rock ledges and timber joints.
3. **Old town:** cream walls, muted terracotta roofs and teal shutters; continuous
   cornices, window sills, recessed doors and clustered market awnings.
4. **Quarry:** warm ochre rock and cool blue-grey steel; stepped cut faces,
   conveyor supports, graded aggregate heaps and one crane silhouette.
5. **Forest:** layered fresh greens, warm timber and small amber lamps; root
   shelves, lookout platforms, fern groups and a legible observatory landmark.
6. **Workshop:** cream, copper and blue-grey; framed sheds, rivet bands and pipe
   junctions, with large gears concentrated at one or two focal points.
7. **Harvest:** golden crops, soft green fields and cream farm buildings; layered
   barn roofs, grain silos, grouped bales, windmill and boundary hedges.
8. **Desert:** pale golden sandstone, teal shade cloth and restrained terracotta;
   shaded caravan court, layered masonry, arch recesses and oasis clusters.
9. **Snow station:** blue-white snow, warm cream timber and amber guide accents;
   roof snow lips, cabin frames, cable pylons and one station landmark.
10. **Caldera:** blue-charcoal basalt, warm pale stone and controlled orange lava;
    layered rock faces, vent structures and a readable rim observatory.
11. **Garden:** cream architecture, layered green foliage and small pink/coral
    flower groups; pergola joints, greenhouse frames and raised planting beds.
12. **Airfield:** pale structures, deep blue glazing and small amber markings;
    hangar ribs, layered tower crown, grouped ground-service carts and windsocks.

Each subsequent map requires its own scene inspection and bounded change set;
this list is a plan, not a claim that the remaining eleven maps have changed.

## Coast sample budget and boundaries

- Eight added opaque material batches, 5,004 triangles, no new model downloads
- Static geometry only; no new animation loop, physics, reflection pass or texture
- Every declared cluster footprint checked against the full sampled road corridor
- Existing road/gameplay geometry retains its 141,356-triangle allocation; new
  scenery has a separate maximum of 6,000 triangles, rather than weakening the
  original budget
- TypeScript and production build passed. Focused native tests validate geometry,
  placement, shader interface and unchanged road/pickup sampling
- GPU visuals and device frame rate are separate checks. Browser screenshot
  verification was blocked by local cloud-browser access, so it is not claimed

## References

Official game imagery was used for general art-direction study, not extracted
assets or copied map layouts. The new geometry is original and built in code.

- Disney Speedstorm official Kaua'i environment: https://dst.assets.gameloft.com/assets/DS_Home_Page_Enviroment_Map_Kaua_l_92acae3a1a.jpg
- Nintendo Mario Kart 8 Deluxe official course imagery: https://mariokart8.nintendo.com/

The previously discussed 45-theme asset archive has not yet been located and
verified in this workspace; this sample does not depend on it.
