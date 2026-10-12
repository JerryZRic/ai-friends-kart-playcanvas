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

`tests/helpers/audit-fixture-publication-revisions.ts` enumerates exactly two
incoming/current identities: the fixture and its Garden validation helper. The
Airfield lineage applies these only after its unchanged art review. Wrong incoming
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
