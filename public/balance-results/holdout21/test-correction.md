# Focused test correction and retained failure evidence

The initial focused run completed 107 tests: 106 passed and one failed. Its complete output is retained in frozen-focused.log. Only its private checkout path has been replaced by a repository-relative path.

The failed assertion was in the preset-composition test. It compared water speed against the newly tuned land character profile. The implementation intentionally preserves the released water coefficients separately. The mismatch was actual 20.240000000000002 versus expected 21.009999999999998.

Before the candidate was frozen and before holdout measurement, the test was corrected to compare water speed, acceleration and steering with WATER_CHARACTER_MULTIPLIERS. The corrected test is archived as kart-presets.corrected.test.ts. The full rerun, frozen-focused-rerun.log, passed 107/107 and is byte-identical to the log hash recorded in freeze.json. The original failure is not erased or counted as a pass.

frozen-check.log records the TypeScript check. baked-replay.audit.json records 24 exact recorded-field replay matches without runtime overrides. source-integrity.audit.json verifies all 148 frozen sources and confirms the preserved water section is byte-identical to pre-bake-character-profiles.ts.

These are engineering checks. They do not replace the independent statistical acceptance criteria or establish full balance certification.
