# Standalone static hosting and GitHub Pages

The contents of `dist/` are a complete static site. Three.js is bundled into
`game.js`; the five original GLBs and six character GLBs are local. There is no ChatGPT/Sites runtime, login,
API, CDN, external font, or server-side dependency. Use an HTTP(S) server;
`file:` URLs are unsuitable for module and GLB loading. A WebGL-capable browser
is still required.

## Distribution layout

```text
dist/
├── index.html            # Game entry point
├── game.js               # Game + bundled Three.js
├── assets/               # original assets and six runtime character GLBs
├── .nojekyll             # Disable Jekyll for branch-based Pages hosting
├── source.html           # Visible Source / License link destination
├── source.zip            # Corresponding project source, including Blender files
├── SOURCE.txt
├── LICENSE               # GNU AGPL v3 full text
├── MODEL-NOTICE.txt      # Separate character-model restrictions
├── NOTICE
└── THIRD-PARTY-NOTICES.txt
```

All runtime and source-download links are relative. The same files work at `/`,
`/ai-friends-kart-web/`, or another nested directory without changing a base URL. The
server must resolve directory URLs to `index.html` and redirect a directory URL
without a trailing slash to one with it, as GitHub Pages does. Do not move only
`index.html`: deploy the entire contents of `dist/`, including dotfiles.

`npm run build` bundles the current game code, preserves original GLB bytes, regenerates
the source package from an explicit allowlist, and adds only a small visible
Source / License link to the distribution HTML. `src/index.html` is unchanged.
The source ZIP omits dependency caches and generated runtime files except the
GLBs; after extraction, `npm ci && npm run build` recreates a runnable `dist/`.
Do not publish the distribution without its source and license files.

## Recommended: deploy `dist/` with the manual workflow

The prepared `.github/workflows/pages.yml` uploads `dist/` directly as the Pages
artifact; its `index.html` becomes the website's root entry. A separate `docs/`
copy or a `gh-pages` branch is unnecessary. It deploys the reviewed prebuilt
files rather than silently rebuilding a different runtime in CI.

**Preparing or committing this workflow does not enable Pages or publish the
site.** It has only `workflow_dispatch`, no push, pull-request or scheduled
trigger, and requires its `publish` checkbox to be selected.

After the owner has reviewed the repository and approved public hosting:

1. Open the repository's **Settings → Pages** and choose **GitHub Actions** as
   the build/deployment source.
2. Under **Actions**, open **Publish static game to GitHub Pages**.
3. Choose **Run workflow**, select the reviewed ref, and explicitly check
   **Publish dist and its source archive to the public web**.
4. Wait for both jobs to succeed. Use the actual page URL reported by the
   deployment job. For this repository the usual project-site URL is
   `https://jerryzric.github.io/ai-friends-kart-web/`; this is an expected address, not a
   claim that a deployment already exists.

Pages availability for a private repository depends on the GitHub plan. A
private source repository does **not** generally make its Pages website
private. Publishing this distribution also exposes its bundled source archive.
Do not use repository privacy as a website-access control.

## Alternative: branch root or `/docs`

GitHub's branch-based Pages source picker accepts only the branch root (`/`)
or `/docs`, not an arbitrary `/dist` folder.

- **Dedicated branch:** copy the contents of `dist/`, including `.nojekyll`, to
  the root of a publishing branch such as `gh-pages`, then select that branch
  and `/(root)`.
- **`/docs`:** copy the full contents of `dist/` into `docs/` and select that
  branch's `/docs` folder. This repository already uses `docs/` for release
  documentation, so preserve that documentation and avoid an unreviewed
  overwrite. The manual artifact workflow is cleaner here.
- **Repository root:** selecting `main / (root)` as-is will not host the game
  because the game entry point is inside `dist/`; use one of the arrangements
  above instead.

Branch-source updates publish automatically when pushed once configured. No
branch source, repository visibility, or Pages setting is changed by this
package. For any other static host, set its publish directory to `dist` or
upload the contents of `dist/` to the desired site directory.

## Verification

```bash
npm run check
npm test
npm run build
npm run test:dist
npm run serve
```

The distribution test verifies same-origin relative HTML links, local runtime
and model paths, embedded GLB buffers/images, the exact packaging-only HTML
change, and the self-contained source archive. It checks root and nested URL
resolution without starting a network server. It extracts the complete source,
rebuilds with already-installed pinned dependencies and compares every code/original-asset `dist/` byte. The six large runtime characters are separately checked against their manifest and intentionally excluded from the source ZIP. Game tests use original synthetic geometry, mocked DOM/WebGL rendering,
and real Three.js CPU animation. Native file-picker behavior, browser rendering,
GPU performance, pointer lock and deployed HTTP responses need separate checks.

Local imports use memory-only file reads. They are never added to the static
website, source archive or repository. A deployment includes the original open assets and exactly six final runtime character GLBs served as lossless .glb.gz archives with separate rights and restrictions. The source ZIP does not duplicate those character files. Read MODEL-NOTICE.txt before reuse.

## Official references

- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Creating a Pages site and `.nojekyll`](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
