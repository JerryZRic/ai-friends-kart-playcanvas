# Development and release quality tiers

## 1. Dev: F5-style preview

A push to `dev` installs locked dependencies and runs `npm run build`, including
TypeScript checking and the matching corresponding-source ZIP. A successful
build is saved as a run/SHA-bound artifact, then published under `/dev/` while
preserving the exact pinned main site. Neither full tests, targeted regressions,
nor the source-rebuild distribution test block this development preview.

Compilation, artifact integrity, stable-site preservation and deployment errors
still stop publication. Retry a failed compose/deploy job to reuse the successful
build; there is no need to rebuild it. Build artifacts expire after seven days;
Pages artifacts expire after one day, so an expired Pages artifact requires
rerunning composition.

## 2. Main merges and releases: nonstable by default

Unless a stable release is explicitly requested, a main merge or release is
nonstable. Publishing a release should use the prerelease classification by
default. Existing releases are not retroactively relabeled.

Main pushes run changed-module regression, compilation and distribution/source
checks. `scripts/test-targeted.mjs` records the exact comparison commit, changed
paths, selected modules and selected test files. The comparison uses the push's
previous SHA; release/manual runs use an optional exact `base_sha`, otherwise
the pinned stable SHA. A missing comparison commit fails visibly; it never
silently switches to full certification.

Publication smoke tests always run. Music, menu, input, race, garage and affected
course modules add a small explicit regression set. Shared or unknown runtime
changes select the combined quick module smoke sets. Large geometry, camera and
collision matrices remain outside this nonstable gate. A quick regression pass
is not a full stable certification.

The release-quality workflow validates a published release without creating,
editing, tagging, packaging or deploying a release. It always defaults to
nonstable; a version tag, release name or GitHub prerelease flag never requests
large-scale testing. Complete this same nonstable gate before issuing a release;
the published-event run records a matching post-publication check.

## 3. Stable: explicit full certification

Only an explicit stable request enables the large suite. Run the relevant
workflow manually with `quality: stable` against the exact intended revision.
It runs `npm run check`, `npm test`, `npm run build` and `npm run test:dist`, with
failure blocking the remaining work. There is no automatic stable-tag trigger.
Do not publish stable release assets until this explicit certification succeeds
for their exact source revision.

`pages-stable.yml` remains the existing main-site publisher filename; its default
quality is now nonstable. A manual stable invocation of that publisher requires
the main branch. The separate release-quality workflow only validates the
selected revision and has no release-write or deployment permissions.

These workflow changes are prepared on dev. Main and release event behavior only
changes after the policy is merged into the relevant default/main branch.
