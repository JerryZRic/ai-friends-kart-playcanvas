# Isolated cover preview

The `/cover-preview/` page reviews approved portraits and custom PlayCanvas 2D motion. It is not a complete feature-game deployment. Its gameplay link uses the existing `/dev/` build.

Publication now uses the coordinated snapshot protocol in [coordinated-preview-publishing.md](coordinated-preview-publishing.md). The old fixed dev artifact from run 38639517124 is no longer the active baseline. See `pages-snapshot.json` for the exact current successful deployment/run/artifact and expected source refs.

Each cover publication replaces only `/cover-preview/`, preserving every stable root and `/dev/` byte. Each dev publication preserves the current cover directory. Both complete Pages artifacts have 30-day retention and share the same concurrency lock. A changed published baseline or source ref fails closed and must be deliberately repinned.

`main` is not modified by this feature. A future stable publication needs deliberate coordination because its legacy workflow may still replace previews. No Windows package is produced here.
