import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeBalance, BALANCE_CHARACTERS, BALANCE_MAPS, type BalanceRace, renderBalanceReport} from '../src/cpu-balance-statistics';

function block(map: string, index: number, winner: (rotation: number) => string | null, equipment = 'equal', seedOffset = 0): BalanceRace[] {
  return Array.from({length: 6}, (_, rotation) => {
    const win = winner(rotation);
    const order = win === null ? [...BALANCE_CHARACTERS] : [win, ...BALANCE_CHARACTERS.filter(character => character !== win)];
    return {map, block: index, seed: index + seedOffset, rotation, winner: win, difficulty: 'normal', equipment, items: true,
      elapsed: win === null ? 600 : 120, steps: win === null ? 36000 : 7200, complete: win !== null, timeout: win === null,
      racers: order.map((characterId, i) => ({characterId, seat: (BALANCE_CHARACTERS.indexOf(characterId as any) + 6 - rotation) % 6,
        phase: (BALANCE_CHARACTERS.indexOf(characterId as any) + 6 - rotation) % 6, rank: i + 1, finishedAt: win === null ? null : 110 + i,
        dnf: win === null, total: win === null ? 50 : 300, laps: win === null ? 0 : 3, lapTimes: win === null ? [] : [30, 40, 40 + i],
        pickups: 10, uses: 8, collisionCount: i, railContacts: 2, slowSeconds: 4, driftSeconds: 5, maxObservedSpeed: 50, invalidSteps: 0}))};
  });
}
const opts = {maps: ['coast'], draws: 256, seed: 1234};

test('identical-role rotating labels give 1/6 but degenerate intervals never claim certainty', () => {
  const rows = Array.from({length: 4}, (_, i) => block('coast', i, r => BALANCE_CHARACTERS[r])).flat();
  const result = analyzeBalance({rows}, undefined, opts);
  assert.equal(result.primary.completeBlocks, 4);
  for (const e of result.endpoints) {
    assert.ok(Math.abs(e.estimate! - 1 / 6) < 1e-12);
    assert.equal(e.degenerate, true);
    assert.ok(e.upper! > e.lower!);
    assert.match(e.intervalMethod, /bounded-block/);
  }
  assert.equal(result.acceptance.certificationStatus, 'inconclusive');
  assert.equal(result.primary.diagnostics.characters.whale.metrics.pickups.sum, 240);
  assert.equal(result.primary.diagnostics.characters.whale.finishSeconds.n, 24);
  assert.match(renderBalanceReport(result), /All primary per-map win rates/);
});

test('extreme all-win character fails and retains bounded uncertainty for zero/one endpoints', () => {
  const rows = Array.from({length: 32}, (_, i) => block('coast', i, () => 'gpt')).flat();
  const result = analyzeBalance({rows}, undefined, opts);
  const winner = result.endpoints.find(e => e.id === 'primary:aggregate:gpt')!;
  assert.ok(Math.abs(winner.estimate! - 1) < 1e-12);
  assert.equal(winner.upper, 1);
  assert.ok(winner.lower! < 1 && winner.lower! > .4);
  assert.equal(result.acceptance.observedTarget, 'fail');
  assert.equal(result.acceptance.primaryStatus, 'fail');
});

test('correlated rotations are resampled as four blocks, not 24 independent races', () => {
  const rows = Array.from({length: 4}, (_, i) => block('coast', i, () => i % 2 ? 'gpt' : 'whale')).flat();
  const result = analyzeBalance({rows}, undefined, opts);
  const whale = result.endpoints.find(e => e.id === 'primary:aggregate:whale')!;
  // Cluster observations are [1,0,1,0]. Their sample variance is 1/3, so
  // SE(mean)=sqrt((1/3)/4). A race-level SE would incorrectly be ~0.102.
  assert.ok(Math.abs(whale.standardError! - Math.sqrt(1 / 12)) < 1e-12);
  assert.equal(whale.blocks, 4);
  assert.equal(result.uncertainty.familySize, 12);
  assert.deepEqual(result, analyzeBalance({rows: [...rows].reverse()}, undefined, opts));
});

test('incomplete blocks stay in diagnostics but are excluded from inference; missing map is not reweighted away', () => {
  const rows = [...block('coast', 0, r => BALANCE_CHARACTERS[r]), ...block('coast', 1, () => 'gpt').slice(0, 5)];
  const result = analyzeBalance({rows}, undefined, {...opts, maps: ['coast', 'mountain']});
  assert.equal(result.primary.totalRows, 11);
  assert.equal(result.primary.analyzedRows, 6);
  assert.equal(result.primary.excludedInferentialRows, 5);
  assert.equal(result.primary.incompleteBlocks.length, 1);
  assert.equal(result.primary.diagnostics.characters.gpt.starts, 11);
  assert.ok(result.endpoints.filter(e => e.scope === 'aggregate').every(e => e.estimate === null && e.lower === null));
  assert.match(result.warnings.join('\n'), /incomplete/);
  assert.equal(result.acceptance.certificationStatus, 'inconclusive');
});

test('duplicate races, reused scenario seeds, bad role rotations and malformed progress are rejected', () => {
  const rows = block('coast', 0, r => BALANCE_CHARACTERS[r]);
  assert.throws(() => analyzeBalance({rows: [...rows, rows[0]]}, undefined, opts), /duplicate race/);
  assert.throws(() => analyzeBalance({rows: [...rows, ...rows.map(row => ({...row, block: 1}))]}, undefined, opts), /seed reused/);
  const roles = structuredClone(rows); roles[1].racers = structuredClone(rows[0].racers); roles[1].winner = roles[0].winner;
  assert.throws(() => analyzeBalance({rows: roles}, undefined, opts), /rotate through all six/);
  const bad = structuredClone(rows); bad[0].racers[0].total = NaN;
  assert.throws(() => analyzeBalance({rows: bad}, undefined, opts), /nonfinite progress/);
});

test('all-DNF races never invent a winner, and all starts remain in denominators', () => {
  const rows = [...block('coast', 0, r => BALANCE_CHARACTERS[r]), ...block('coast', 1, () => null)];
  const result = analyzeBalance({rows}, undefined, opts);
  const gpt = result.endpoints.find(e => e.id === 'primary:aggregate:gpt')!;
  assert.ok(Math.abs(gpt.estimate! - 1 / 12) < 1e-12);
  assert.equal(result.primary.diagnostics.dnfs, 36);
  assert.equal(result.primary.diagnostics.timeouts, 6);
  assert.equal(result.primary.diagnostics.noWinnerRaces, 6);
  assert.equal(result.primary.diagnostics.characters.gpt.starts, 12);
  assert.equal(result.primary.diagnostics.characters.gpt.finishSeconds.n, 6);
  assert.equal(result.acceptance.cleanPrimary, 'fail');
});

test('one joint family includes six primary, 72 map and six mixed endpoints with equal map weighting', () => {
  const rows = BALANCE_MAPS.flatMap((map, m) => Array.from({length: m === 0 ? 4 : 2}, (_, i) => block(map, i, r => BALANCE_CHARACTERS[(r + i) % 6])).flat());
  const mixed = BALANCE_MAPS.flatMap(map => [0, 1].flatMap(i => block(map, i, r => BALANCE_CHARACTERS[(r + 1) % 6], 'mixed', 100)));
  const result = analyzeBalance({rows}, {rows: mixed}, {draws: 64});
  assert.equal(result.uncertainty.familySize, 84);
  assert.equal(result.endpoints.filter(e => e.scope === 'aggregate').length, 12);
  assert.equal(result.endpoints.filter(e => e.scope === 'map').length, 72);
  assert.ok(result.endpoints.every(e => Math.abs(e.estimate! - 1 / 6) < 1e-12));
  assert.equal(result.mixed!.diagnostics.characters.gpt.starts, 144);
  const reused = mixed.map(row => ({...row, seed: row.seed - 100}));
  assert.throws(() => analyzeBalance({rows}, {rows: reused}, {draws: 1}), /cohorts reuse seeds/);
});

test('aggregate weights maps equally even when completed block counts differ', () => {
  const rows = [...Array.from({length: 4}, (_, i) => block('coast', i, () => 'gpt')).flat(), ...block('mountain', 0, () => 'whale')];
  const result = analyzeBalance({rows}, undefined, {...opts, maps: ['coast', 'mountain']});
  assert.ok(Math.abs(result.endpoints.find(e => e.id === 'primary:aggregate:gpt')!.estimate! - .5) < 1e-12);
  assert.equal(result.primary.diagnostics.characters.gpt.rawWinRate, .8);
});

test('manifest seed-domain mismatch is rejected rather than mislabeled holdout evidence', () => {
  const rows = block('coast', 0, r => BALANCE_CHARACTERS[r]);
  assert.throws(() => analyzeBalance({rows, manifest: {domain: 'land-balance-holdout-v1'}}, undefined, opts), /seed does not match manifest domain/);
});

function provenanceInput(equipment: 'equal' | 'mixed', profiles?: Record<string, unknown>, instrumentationVersion?: number) {
  const domain = equipment === 'equal' ? 'land-balance-holdout-v1' : 'land-balance-mixed-holdout-v1';
  let seed = 2166136261;
  for (const char of `${domain}:coast:0`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return {rows: block('coast', 0, r => BALANCE_CHARACTERS[r], equipment, seed), manifest: {
    domain, maps: ['coast'], blocks: 1, rotations: [0, 1, 2, 3, 4, 5], plannedRaces: 6, dt: 1 / 60, laps: 3,
    options: {difficulty: 'normal', equipment, items: true, timeoutSeconds: 600, identityControl: false, profiles},
    sourceHashes: {'src/character-profiles.ts': 'same-frozen-roster-hash'}, instrumentationVersion,
  }};
}

test('holdout certification rejects every nonempty runtime profile override despite matching source hashes', () => {
  const profilesA = {whale: {acceleration: 1.1, topSpeed: 1, steering: 1}};
  const profilesB = {whale: {acceleration: 1.2, topSpeed: 1, steering: 1}};
  for (const [primaryProfiles, mixedProfiles] of [[profilesA, undefined], [undefined, profilesA], [profilesA, profilesA], [profilesA, profilesB]]) {
    const report = analyzeBalance(provenanceInput('equal', primaryProfiles, 2), provenanceInput('mixed', mixedProfiles, 2), opts);
    const issues = report.acceptance.eligibilityIssues;
    assert.equal(issues.some(issue => issue === 'Primary/mixed source hashes differ'), false);
    assert.equal(issues.some(issue => issue.startsWith('Primary: Nonempty runtime profile overrides')), primaryProfiles !== undefined);
    assert.equal(issues.some(issue => issue.startsWith('Mixed: Nonempty runtime profile overrides')), mixedProfiles !== undefined);
    assert.equal(report.acceptance.certificationStatus, 'inconclusive');
  }
  const empty = analyzeBalance(provenanceInput('equal', {}, 2), provenanceInput('mixed', undefined, 2), opts);
  assert.equal(empty.acceptance.eligibilityIssues.some(issue => issue.includes('profile overrides')), false);
});

test('certification requires valid invalid-progress instrumentation in both cohorts; older reports remain readable', () => {
  for (const version of [undefined, 0, 1]) {
    const report = analyzeBalance(provenanceInput('equal', undefined, version), provenanceInput('mixed', undefined, version), opts);
    assert.ok(report.acceptance.eligibilityIssues.includes('Primary: Invalid-progress instrumentationVersion >= 2 is required for certification'));
    assert.ok(report.acceptance.eligibilityIssues.includes('Mixed: Invalid-progress instrumentationVersion >= 2 is required for certification'));
    assert.equal(report.primary.diagnostics.invalidSteps, 0);
    assert.equal(report.acceptance.certificationStatus, 'inconclusive');
  }
  const current = analyzeBalance(provenanceInput('equal', undefined, 2), provenanceInput('mixed', undefined, 2), opts);
  assert.equal(current.acceptance.eligibilityIssues.some(issue => issue.includes('instrumentationVersion')), false);
  const legacyTraining = analyzeBalance({rows: block('coast', 0, r => BALANCE_CHARACTERS[r])}, undefined, {...opts, stage: 'training'});
  assert.equal(legacyTraining.stage, 'training');
  assert.equal(legacyTraining.primary.totalRows, 6);
  assert.equal(legacyTraining.acceptance.certificationStatus, 'inconclusive');
});

test('rejected-advance reasons are validated and aggregated by cohort, map, and character', () => {
  const rows = block('coast', 0, r => BALANCE_CHARACTERS[r]);
  for (const row of rows) for (const racer of row.racers) racer.rejectionReasons = {};
  const first = rows[0].racers.find(r => r.characterId === 'gpt')!;
  first.invalidSteps = 3; first.rejectionReasons = {'teleport': 1, 'off-road': 2};
  const second = rows[1].racers.find(r => r.characterId === 'gpt')!;
  second.invalidSteps = 2; second.rejectionReasons = {'teleport': 1, 'invalid-step': 1};
  const report = analyzeBalance({rows, manifest: {instrumentationVersion: 2}}, undefined, opts);
  const expected = {'invalid-step': 1, 'off-road': 2, 'teleport': 2};
  assert.deepEqual(report.primary.diagnostics.rejectionReasons, expected);
  assert.deepEqual(report.primary.maps.coast.rejectionReasons, expected);
  assert.deepEqual(report.primary.diagnostics.characters.gpt.rejectionReasons, expected);
  assert.equal(report.primary.diagnostics.invalidSteps, 5);
  assert.equal(report.primary.diagnostics.racerStartsWithRejectionReasons, 36);
  assert.equal(report.primary.diagnostics.racerStartsWithoutRejectionReasons, 0);
  assert.equal(report.primary.diagnostics.invalidStepsWithoutRejectionReasons, 0);
  assert.match(renderBalanceReport(report), /teleport: 2/);
  assert.equal(report.warnings.some(warning => warning.includes('observed zero')), false);
  const mismatched = structuredClone(rows); mismatched[0].racers[0].rejectionReasons = {teleport: 1};
  assert.throws(() => analyzeBalance({rows: mismatched}, undefined, opts), /rejectionReasons total does not equal invalidSteps/);
  const negative = structuredClone(rows); negative[0].racers[0].rejectionReasons = {'off-road': -1};
  assert.throws(() => analyzeBalance({rows: negative}, undefined, opts), /rejection reason count/);
});

test('legacy reason-free diagnostics remain readable and explicitly warn that observed zeros are unverified', () => {
  for (const instrumentationVersion of [undefined, 1]) {
    const rows = block('coast', 0, r => BALANCE_CHARACTERS[r]);
    const report = analyzeBalance({rows, manifest: {instrumentationVersion}}, undefined, {...opts, stage: 'training'});
    assert.deepEqual(report.primary.diagnostics.rejectionReasons, {});
    assert.equal(report.primary.diagnostics.racerStartsWithRejectionReasons, 0);
    assert.equal(report.primary.diagnostics.racerStartsWithoutRejectionReasons, 36);
    assert.match(report.warnings.join('\n'), /observed zero does not verify absence of rejected advances/);
    assert.match(renderBalanceReport(report), /observed zero does not verify absence of rejected advances/);
  }
  const legacyWithCount = block('coast', 0, r => BALANCE_CHARACTERS[r]);
  legacyWithCount[0].racers[0].invalidSteps = 2;
  assert.equal(analyzeBalance({rows: legacyWithCount}, undefined, opts).primary.diagnostics.invalidStepsWithoutRejectionReasons, 2);
});
