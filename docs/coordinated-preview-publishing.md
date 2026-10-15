# Coordinated preview publication

`dev` and `feature/home-portraits-live2d` publish in sequence, not concurrently. Each workflow downloads the exact latest successful complete Pages artifact specified by `docs/pages-snapshot.json`, verifies its ZIP digest and originating successful run, then replaces only its own directory (`dev` or `cover-preview`). Every other path is hashed before and after composition. Stable root is never rebuilt, and the other preview is preserved byte for byte.

Both pipelines share the `github-pages` concurrency group. They verify all three exact branch refs and the latest successful GitHub `github-pages` environment deployment before composition and again immediately before publication. A newer successful deployment, foreign pending deployment, moved ref, failed/unfinished baseline run, expired artifact, or mismatched provenance fails closed. A newer failed deployment is not treated as published. Repin the manifest to the actual latest success; never reuse an older snapshot to roll back a newer site.

The workflow's own branch uses `CURRENT` to bind it to the immutable `GITHUB_SHA`; the other refs are full commit IDs. The baseline records full SHA, originating branch, run ID, artifact ID and digest, and environment deployment ID. The baseline is reviewed and refreshed before every later publication.

The complete `github-pages` artifact and preservation report explicitly use 30-day retention. This avoids the previous one-day snapshot expiration without uploading a duplicate large site. Hosting remains live when an artifact expires, but publication deliberately stops if its pinned snapshot is unavailable; do not silently rebuild or substitute untouched trees. If no artifact remains, recover a current byte-verified snapshot with explicit provenance before repinning.

Only the two preview workflows are changed. `main` and its workflow remain untouched; a later main deployment still needs deliberate three-tree coordination rather than assuming it preserves previews. No new environment permission or Windows release is required.
