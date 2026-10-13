# Runtime geometry contract correction (2026-10-13)

Parent dev: `969175890f5353eeb54c81f8c70b3af3e7ede736`.

The user's browser reported `Snow bounded append geometry contract changed`.
That message combined two independent conditions: an exact offline original
triangle count (106286), and an enrichment cap (12000). The report alone does
not identify which condition failed. Desert used the same mechanism with
107224 and 16000 respectively.

Runtime now snapshots the actual emitted index count before enrichment, then
checks the completed mesh against that snapshot plus the counted append. It
also validates finite position/UV data, complete attribute arrays, valid index
ranges, and integer counts. The existing enrichment and total scene budgets
are unchanged. Failures identify the independent condition and actual values.
Frozen offline reference counts and audit receipts remain unchanged; their
exact source hashes are historical and were not repinned or recertified.

This separates runtime mesh safety from a specific offline triangulation count.
Cross-engine floating-point clipping is a possible explanation, not a reproduced
browser root cause. The user's actual counts remain unknown. An actual
budget overrun still fails with an informative error.

Verification: focused runtime-contract tests passed (3/3); both source builders
succeeded with the new checks (snow: 114800 triangles / 172192 vertices;
desert: 118490 / 154180). TypeScript and production build pass. No full geometry
audit, browser/GPU verification or Pages HTTP fetch was performed. A local
headless Chromium attempt could not start because the sandbox blocked its
socket creation. User-browser retesting is still required.
