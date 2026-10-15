# Isolated cover visual preview

This feature-only workflow publishes `/cover-preview/` as a small visual review of the approved title-screen portraits. It is not the complete feature game. Any game link goes to the existing `/dev/` build.

No main or dev branch files are changed. Both existing publication trees are copied byte for byte from successful run `38639517124` (dev commit `4357252f2a356b46426419325e4fb3ff70b2f053`). Baseline Pages artifact `11930010985` is pinned by its SHA-256 ZIP digest. Composition rejects symlinks, existing output, a previous preview tree, missing entries and a total site above 1,000,000,000 bytes. It compares complete baseline inventories before and after addition and uploads an auditable preservation report.

The workflow shares `github-pages` concurrency with both existing publishers. It checks the feature HEAD, stable main `b665343da013f5cfec0a0f45797adcd347f9607b`, and dev HEAD before building and immediately before deployment. A moved branch fails closed and requires deliberate repinning.

Publication is intentionally triggered only by changes to the feature workflow or `docs/cover-preview-publish.json`. Ordinary feature source edits do not automatically publish an unfinished preview. A publication commit must follow the approved visual QA.

## Lifetime limitation

The current main/dev workflows own the entire Pages site and do not preserve third directories. A later main/dev deployment will remove this visual preview. This change deliberately does not alter those branches. To restore the preview after an authorized later deployment, pin its new successful artifact and branch identities, verify them, and republish this feature workflow. Do not reuse the old artifact to roll back new root/dev content.

The initial artifact expires on 2026-10-15 at 21:22:15 UTC. If it has expired, stop and acquire an exact current baseline through a verified new artifact rather than rebuilding stable/dev or silently substituting sources.
