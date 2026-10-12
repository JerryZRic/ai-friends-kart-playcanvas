# Lossless audit-fixture publication compatibility

This is a technical-only packaging change after the sealed Airfield source commit
`caff951ba864212e77e3ac2f2ff3f6fa3d79d83a`. It changes no scenery, gameplay,
rendering, models, historical source snapshots, original inventory, or retained
assertion counts.

The Garden reviewed-change fixture exceeded the 16 MiB request ceiling once its
JSON content was escaped inside a publication request. The same JSON file is now
lexically compacted: whitespace outside strings is removed and one final newline
is retained. Numeric spellings, string escape sequences, key order, every nested
historical record, and all 108 certified incoming assertions remain intact.

| Representation | Bytes | SHA-256 |
| --- | ---: | --- |
| Sealed original | 16,116,032 | `9849bf067b63fa83f22ad75dac63ff4a560c601c210d241676ad06cbd6307afa` |
| Compact current file | 11,691,007 | `0bf147bda5bf2d63dbce87a5b5ad09e1dc24406c2d9fb39bc0c5573565a11813` |

`scripts/compact-garden-audit-fixture.mjs` validates the compact bytes and then
reconstructs the exact original indented bytes and independently checks their
length and SHA-256. This avoids numeric rewriting by JSON parse/stringify.
Normal JSON consumers continue to parse the compact file directly.

To reproduce from the independently sealed original, run:

```sh
node scripts/compact-garden-audit-fixture.mjs ORIGINAL.json COMPACT.json
```

The command rejects any other original hash, verifies byte and semantic equality,
and only then writes the compact destination. The compact fixture itself contains
all the information needed for exact historical restoration; no network or
external archive is needed by the test loader.

`tests/helpers/audit-fixture-publication-revisions.ts` enumerates exact
incoming/current identities for the fixture, its Garden validation helper, and
the separately documented CI compatibility corrections below. The Airfield
lineage applies these only after its unchanged art review. Wrong incoming
hashes and attempts to provide the current hash as an incoming baseline fail.
All historical manifests and inventories keep their original data and hashes;
only the current Airfield portable manifest records the new technical closure.
The earlier art-freezing script remains historical and is not a generator for
this subsequent publication-only revision.

For mapped publication history, replacing the oversized blob in Garden and later
trees necessarily changes their remote tree/commit identities. Original commit
IDs inside historical evidence continue to identify the sealed original source
lineage; they must not be rewritten as if the original evidence had been produced
from the publication mapping. The mapping must separately record original and
published identities. The final technical compatibility commit supplies this
codec, explicit identity revisions, tests, and updated current manifest.

Run `tests/audit-fixture-publication.test.ts` plus the retained enrichment inventory
tests, type checks, build, and distribution/source verification. Published CI must
validate the exact final published head. Older sealed source/art packages remain
unchanged; a new source package includes this technical revision.

## Garden cross-scene camera dependency

The Garden camera plan was frozen before the already-reviewed Airfield append-only
scene update. Its protected inventory still correctly records the original
Airfield source `a5414a810f061a5cb4da169f9c8f5577d377c2e76fb6c7aa6dca0eaf80f99cb2`.
The current reviewed source is
`96a84ea580575661041811f3414ea193afffc0d3e5d88c95541a1910996c74db`.
Only that exact path and incoming/current pair is accepted by the Garden camera
loader. This does not apply the broader art or publication overlays to camera
dependencies; every other protected dependency still requires the original bytes.

The Airfield review fixture is independently pinned at
`b036ddf5cd27fdd7dcb18a38715ea45c7ef426101ebcac77009c0e2f7dd44324`.
The retained Airfield geometry and camera suites described in
`docs/airfield-enrichment-qa-changes.md` still certify all 1,585 original ordered
components, indexed position/UV/normal prefixes, original road faces and camera
obstacle prefixes, and the full camera output matrices. No exemption replaces
those suites. Focused transition tests also recheck the immutable original scene
and geometry fixture, unchanged road/camera implementation dependencies, and both
Garden/Airfield camera output fixture identities.

The frozen Garden plan remains
`06c49fb8e7e4161c2be0380f887246cc6539a5792e0440c4adfc0dc92fb2d598` and its
complete output fixture remains
`8cdac054678a3f529619dcf0d93d45f6bc0ba592b063bbf2b118d99dc229c900`.
An exact inverse transformation of the loader restores its original
`54ddb157a3dd55e090239d2a58ef6e1231b7ad4a7cef0db0967d4953e443125a` bytes,
proving all original archive logic, output rows, comparison loops and assertions
are untouched. Mutation tests reject wrong historical hashes, wrong current
hashes, path aliases and changes to every other protected dependency. The complete
four-stage Garden camera run and full published CI remain required; focused
transition tests alone are not a camera parity result.

## Exact cross-runtime geometry fingerprints

The untouched original Garden and Caldera scene snapshots produce narrowly
different binary64 values under the certified Node 24.19.0 / V8 13.6 and
Node 22.23.3 / V8 12.4 Math.pow implementations. The independently reproduced
certificate in `tests/fixtures/geometry-runtime-portability.json` records 51 exact
position/UV/computed-normal scalar differences and their repeated original
camera-triangle coordinates. Corresponding binary32 geometry values are equal.
It binds all source/toolchain dependencies and complete original buffer hashes.

The profile is selected only from the two exact Math.pow probes, never candidate
geometry. A fresh original rebuild must match that profile's full contract and
complete binary64 buffers. Restoring just the enumerated exact scalar bits must
recover each historical whole-buffer and camera-payload hash. Unknown profiles,
new bits, certificate changes and dependency changes fail; no epsilon, rounding,
quantization or historical fixture replacement is used. The existing geometry
workers additionally compare every candidate original buffer prefix to the fresh
original bytes, including signed zero. Native ownership checks use the same
independently selected profile, retaining their existing safety assertions.

Seven existing QA helpers receive exact incoming/current identity transitions.
The certificate, generic helper and mutation tests are included in the current
Airfield portable manifest. Historical manifests, original geometry fixtures and
all camera output matrices remain byte-exact. The prior compact-publication
manifest is separately identified by commit
`0ea002f4b8ced63560e7305712f3dfad2f9ae0a8` and SHA-256
`d09e9371e181137f0be27b0a95528e44532395e75c5f2e82a4b46a6c0a6c7b46`.
