# Candidate 21 final evidence

The untouched holdout contains 9,216 primary races in 1,536 map/seed blocks and 4,608 mixed-equipment races in 768 blocks. Each block has six rotated races. Only these 13,824 holdout races and 2,304 independent blocks support the final held-out assessment.

Final classification: aggregate checks PASS; per-map guardrail INCONCLUSIVE; overall certification INCONCLUSIVE. The original thresholds and all 84 joint statistical endpoints remain in official.summary.json. This package is evidence for a dev candidate, not a claim of full balance certification.

The frozen candidate hash is recorded in freeze.sha256. All 148 source hashes in freeze.json still match the repository snapshot. The freeze and its hash file are byte-identical to their original files. The raw CSV and JSONL archives use deterministic gzip with mtime zero and decompress byte-for-byte to the original results.

Archive references in analysis sources and audits are relative to public/balance-results. Compressed fileSha256 values identify gzip bytes; contentSha256 and rowsSha256 identify decompressed raw JSONL bytes. Source-code hashes remain unchanged. archive-provenance.json records original and published hashes for every copied input. In particular, independent-official-comparison.json retains the original pre-publication official summary hash; the published summary differs only in source paths, cohort file display names and source fileSha256 fields, never outcomes or statistics.

Training screen records reused in full training are not counted again. training-reuse.audit.json verifies exact preservation of 576 primary and 288 mixed screen records within candidate 21 full training. Candidate 22 was rejected and stopped after its completed fixed screen. Historical training audits retain their contemporaneous recommendations for provenance; they do not authorize further tuning. No holdout-driven tuning was performed by this packaging step.

The primary run resumed after 8,010 saved races. Restart and resumption records, the complete compressed execution logs, and independent-resumption-audit.json preserve the interruption history and verify no duplicate races or blocks. Both cohorts completed before the final independent and official outcome analyses.

The initially failing 106/107 test run remains in frozen-focused.log. test-correction.md explains the pre-freeze test correction and the subsequent 107/107 rerun. Typecheck and exact replay evidence are retained separately. Tests are engineering evidence, not statistical certification.

Nonessential repeated training progress logs and cache files are omitted. Completed raw race data, manifests, completion markers, full analyses, independent audits, freeze records, replay evidence and test evidence are retained. The preexisting 257 indexed artifacts remain unchanged.

File evidence verifies recorded hashes, seeds, chronology and source agreement. It cannot prove absence of unrecorded prior access; no Git metadata is available in this local source snapshot.
