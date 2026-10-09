# Isolated dev preview

The `dev` branch publishes the complete free-mode test game at:

https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/

The stable game and waterpark keep their existing root URLs. This branch does not
change `main`, create a Windows build, or publish a Windows release.

See [free-mode features and validation boundaries](free-mode.md).

## Water rendering

The water surface uses an additional static-scenery color/depth capture through
PlayCanvas's official `PlanarRenderer`. Depth reconstruction uses the matching
oblique capture inverse view-projection matrix, rather than the main camera's
depth buffer. The extra target is half-resolution, capped at 768 pixels on its
long side, with no MSAA. The existing reflection capture is unchanged.

The complete race circuit underwater floor uses two batches and 9,676 triangles
(the separate short study route remains below 4,200). The player wake uses two
draws. The 水面 / FPS controls include a refraction switch, which is locked while
a performance capture is running. Exported JSON version 2 records the selected
settings. Switching refraction off is an A/B check for the extra capture and its
shader contribution; it does not recreate the previous complete visual baseline,
because the floor and wake improvements remain enabled.

This renderer currently targets WebGL2; WebGPU is not validated. Water absorption
is an artistic approximation applied to tone-mapped captured color, rather than
a physically complete light-transport model. This is bounded rendering, not a
fluid simulation. Automated CPU, matrix, resource lifecycle, packaging, and source
checks do not establish GPU appearance or speed. Native checks are not real
framebuffer completeness or GPU shader-link validation.
The available cloud browser could not provide supported WebGL for visual or GPU
performance validation. Compare both switch settings on the target device before
treating this build as visually or performance-validated.

## One Pages site, two directories

GitHub Pages deploys a complete site artifact. A different branch or environment
alone does not create a second website. The `dev` copy of `pages.yml` therefore:

1. Runs only on a `dev` push, or a manual `dev` dispatch with Publish checked
2. Checks that `main` still matches the pinned stable commit
3. Checks, tests and builds the current dev source, including its source ZIP
4. Restores every stable file from the existing public site and verifies its size
   and SHA-256 against `stable-pages-manifest.json`
5. Copies the complete dev build under `dev/` and rechecks both directory trees
6. Deploys the combined artifact through the existing `github-pages` environment

The 33-file stable inventory was generated from the successful main deployment:

- Commit: `9bde1b3d5e39d0ea960977685a03f1b2ace98ff9`
- [Workflow run 37773296870](https://github.com/JerryZRic/ai-friends-kart-playcanvas/actions/runs/37773296870)
- Artifact ID: `11548154979`
- Artifact ZIP SHA-256: `9d3005c9ff91a1f255cd17963ad390fa9d18832642eed2ede6a2e28c97680153`

The Pages upload excludes hidden files, so the original artifact contains no
`.nojekyll` marker. The stable root is copied, not rebuilt, including its original source ZIP,
JavaScript bundles, source maps, models and notices. The preview has its own source
ZIP and all paths remain relative. No production HTML is edited to add a preview
link. The stable manifest is small and permanent; subsequent preview deployments
do not depend on an expiring Actions artifact.

## Safety gates and limitations

Both main and dev workflows use concurrency group `github-pages`, with
`cancel-in-progress: false`. The current main workflow is manual-only. Normal main
pushes do not deploy. The existing environment must explicitly allow `dev` before
its deployment job can run; branch protection is not bypassed or changed by this
workflow.

If main advances, a root file changes, a pinned file disappears, or a download
fails, preview publication stops. Refresh the manifest from the next verified,
successful stable deployment before publishing another preview. Do not update the
hashes merely to make a failed download pass.

A later manual main publication replaces the whole Pages artifact and therefore
removes `/dev/`. This is a limitation of leaving the main workflow unchanged. A
subsequent dev publication restores `/dev/` after its stable manifest has been
updated for that new main deployment. Never manually run the main workflow just
to publish a dev test.

Checks:

```sh
npm run check && npm test && npm run build && npm run test:dist
node scripts/compose-dev-pages.mjs
node scripts/compose-dev-pages.mjs verify-output
node scripts/compose-dev-pages.mjs verify-live
```

Composition requires a fresh `dist-pages/` directory and refuses to overwrite an
existing one. `verify-live` performs read-only hash checks against the stable
public site. Verify the preview entry, assets, and matching source ZIP after a
successful Pages deployment. Also run `verify-live` again to confirm the stable
root is unchanged.

## GitHub documentation

- [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Manual dispatch and branch selection](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [Deployment concurrency and environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [deploy-pages inputs](https://github.com/actions/deploy-pages): the separate
  `preview` deployment feature is not publicly available
