/** Read-only analysis of real CPU-race outcomes. The independent unit is a
 * seeded six-rotation block, NEVER a race or a racer. No simulation imports. */
export const BALANCE_CHARACTERS = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'] as const;
export const BALANCE_MAPS = ['coast', 'mountain', 'town', 'quarry', 'forest', 'workshop', 'harvest', 'desert', 'snow', 'caldera', 'garden', 'airfield'] as const;
export type BalanceStatus = 'pass' | 'fail' | 'inconclusive';
export type BalanceStage = 'training' | 'holdout' | 'exploratory';
export interface BalanceRacer {
  characterId: string; seat: number; phase: number; rank: number; finishedAt: number | null;
  dnf: boolean; total: number; laps: number; lapTimes: number[]; pickups: number; uses: number;
  collisionCount: number; railContacts: number; slowSeconds: number; driftSeconds: number;
  maxObservedSpeed: number; invalidSteps: number; rejectionReasons?: Record<string, number>; build?: unknown;
}
export interface BalanceRace {
  map: string; block: number; seed: number; rotation: number; winner: string | null;
  difficulty: string; equipment: string; items: boolean; elapsed: number; steps: number;
  complete: boolean; timeout: boolean; racers: BalanceRacer[];
}
export interface BalanceManifest {
  domain?: string; maps?: string[]; blocks?: number; rotations?: number[]; plannedRaces?: number;
  options?: {difficulty?: string; equipment?: string; items?: boolean; timeoutSeconds?: number; identityControl?: boolean; profiles?: Record<string, unknown>};
  dt?: number; laps?: number; sourceHashes?: Record<string, string>; instrumentationVersion?: number;
}
export interface BalanceInput { rows: BalanceRace[]; manifest?: BalanceManifest; name?: string }
export interface BalanceAnalysisOptions {
  maps?: readonly string[]; draws?: number; seed?: number; stage?: BalanceStage;
}
interface Block { map: string; index: number; seed: number; rows: BalanceRace[]; wins: number[] }
interface Prepared {
  name: string; rows: BalanceRace[]; manifest?: BalanceManifest; blocks: Map<string, Block[]>;
  incomplete: Array<{map: string; block: number; seed: number; rotations: number[]}>;
  missingMaps: string[]; warnings: string[];
}
export interface BalanceEndpoint {
  id: string; cohort: 'primary' | 'mixed'; scope: 'aggregate' | 'map'; map?: string;
  character: string; estimate: number | null; standardError: number | null;
  lower: number | null; upper: number | null; degenerate: boolean; blocks: number;
  intervalMethod: string; weightsSquared: number | null;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function variance(xs: number[], average = mean(xs)) {
  return xs.length > 1 ? xs.reduce((s, x) => s + (x - average) ** 2, 0) / (xs.length - 1) : 0;
}
function fail(message: string): never { throw new Error(`Invalid balance data: ${message}`); }
function finite(value: unknown, label: string, nonnegative = true) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0)) fail(label);
}
function integer(value: unknown, min: number, max: number, label: string) {
  finite(value, label); if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(label);
}
function prepare(input: BalanceInput, maps: readonly string[], expectedEquipment: string): Prepared {
  const grouped = new Map<string, Block>(), seen = new Set<string>(), seeds = new Map<string, number>();
  const warnings: string[] = [];
  input.rows.forEach((row, index) => {
    const label = `${input.name ?? expectedEquipment} row ${index + 1}`;
    if (!row || !maps.includes(row.map)) fail(`${label}: unknown/unselected map`);
    integer(row.block, 0, Number.MAX_SAFE_INTEGER, `${label}: block`);
    integer(row.seed, 0, 0xffffffff, `${label}: seed`);
    integer(row.rotation, 0, 5, `${label}: rotation`);
    finite(row.elapsed, `${label}: elapsed`); integer(row.steps, 0, Number.MAX_SAFE_INTEGER, `${label}: steps`);
    if (typeof row.complete !== 'boolean' || typeof row.timeout !== 'boolean' || typeof row.items !== 'boolean') fail(`${label}: race flags`);
    if (!['easy', 'normal', 'hard'].includes(row.difficulty) || !['equal', 'mixed'].includes(row.equipment)) fail(`${label}: conditions`);
    if (row.equipment !== expectedEquipment) fail(`${label}: expected ${expectedEquipment} equipment`);
    const key = `${row.map}:${row.block}`, raceKey = `${key}:${row.rotation}`, seedKey = `${row.map}:${row.seed}`;
    if (seen.has(raceKey)) fail(`${label}: duplicate race ${raceKey}`);
    seen.add(raceKey);
    if (seeds.has(seedKey) && seeds.get(seedKey) !== row.block) fail(`${label}: seed reused in separate blocks`);
    seeds.set(seedKey, row.block);
    if (!Array.isArray(row.racers) || row.racers.length !== 6) fail(`${label}: expected six racers`);
    const chars = new Set<string>(), seats = new Set<number>(), phases = new Set<number>(), ranks = new Set<number>();
    for (const racer of row.racers) {
      if (!racer || !BALANCE_CHARACTERS.includes(racer.characterId as any) || chars.has(racer.characterId)) fail(`${label}: duplicate/unknown character`);
      chars.add(racer.characterId);
      integer(racer.seat, 0, 5, `${label}: seat`); integer(racer.phase, 0, 5, `${label}: phase`);
      integer(racer.rank, 1, 6, `${label}: rank`);
      if (seats.has(racer.seat) || phases.has(racer.phase) || ranks.has(racer.rank)) fail(`${label}: duplicate seat/phase/rank`);
      seats.add(racer.seat); phases.add(racer.phase); ranks.add(racer.rank);
      if (typeof racer.dnf !== 'boolean' || (racer.finishedAt === null) !== racer.dnf) fail(`${label}: inconsistent DNF/finish`);
      if (racer.finishedAt !== null) finite(racer.finishedAt, `${label}: finishedAt`);
      finite(racer.total, `${label}: nonfinite progress`, false);
      integer(racer.laps, 0, 3, `${label}: laps`);
      if (!racer.dnf && racer.laps !== 3) fail(`${label}: finisher without three laps`);
      if (!Array.isArray(racer.lapTimes) || racer.lapTimes.length > 3) fail(`${label}: lapTimes`);
      for (const time of racer.lapTimes) finite(time, `${label}: lap time`);
      for (const metric of ['pickups', 'uses', 'collisionCount', 'railContacts', 'invalidSteps'] as const) integer(racer[metric], 0, Number.MAX_SAFE_INTEGER, `${label}: ${metric}`);
      for (const metric of ['slowSeconds', 'driftSeconds', 'maxObservedSpeed'] as const) finite(racer[metric], `${label}: ${metric}`);
      if (racer.rejectionReasons !== undefined) {
        if (racer.rejectionReasons === null || typeof racer.rejectionReasons !== 'object' || Array.isArray(racer.rejectionReasons)) fail(`${label}: rejectionReasons must be a reason/count object`);
        const counts = Object.values(racer.rejectionReasons);
        for (const count of counts) integer(count, 0, Number.MAX_SAFE_INTEGER, `${label}: rejection reason count`);
        if (counts.reduce((sum, count) => sum + count, 0) !== racer.invalidSteps) fail(`${label}: rejectionReasons total does not equal invalidSteps`);
      }
    }
    const finishers = row.racers.filter(r => !r.dnf), winner = row.racers.find(r => r.characterId === row.winner);
    if (row.winner === null ? finishers.length !== 0 : !winner || winner.dnf || winner.rank !== 1) fail(`${label}: invalid winner`);
    if (row.complete !== (finishers.length === 6) || row.timeout === row.complete) fail(`${label}: inconsistent completion/timeout`);
    let block = grouped.get(key);
    if (!block) { block = {map: row.map, index: row.block, seed: row.seed, rows: [], wins: [0, 0, 0, 0, 0, 0]}; grouped.set(key, block); }
    if (block.seed !== row.seed) fail(`${label}: inconsistent seed within block`);
    const first = block.rows[0];
    if (first && (first.difficulty !== row.difficulty || first.items !== row.items || first.equipment !== row.equipment)) fail(`${label}: conditions changed within block`);
    block.rows.push(row);
    if (row.winner !== null) block.wins[BALANCE_CHARACTERS.indexOf(row.winner as any)] += 1 / 6;
  });
  const blocks = new Map(maps.map(map => [map, [] as Block[]])), incomplete: Prepared['incomplete'] = [];
  for (const block of grouped.values()) {
    if (block.rows.length !== 6) { incomplete.push({map: block.map, block: block.index, seed: block.seed, rotations: block.rows.map(r => r.rotation).sort()}); continue; }
    for (const character of BALANCE_CHARACTERS) {
      const seats = block.rows.map(row => row.racers.find(r => r.characterId === character)!.seat);
      if (new Set(seats).size !== 6) fail(`${block.map}:${block.index}: ${character} does not rotate through all six seats`);
    }
    for (let seat = 0; seat < 6; seat++) {
      const roles = block.rows.map(row => row.racers.find(r => r.seat === seat)!);
      if (roles.some(r => r.phase !== roles[0].phase || JSON.stringify(r.build) !== JSON.stringify(roles[0].build))) fail(`${block.map}:${block.index}: seat role/loadout changes across rotations`);
    }
    blocks.get(block.map)!.push(block);
  }
  for (const list of blocks.values()) list.sort((a, b) => a.index - b.index || a.seed - b.seed);
  const missingMaps = maps.filter(map => blocks.get(map)!.length === 0);
  if (incomplete.length) warnings.push(`${incomplete.length} incomplete six-rotation blocks excluded from inferential rates/intervals; every row remains in raw descriptive diagnostics`);
  if (missingMaps.length) warnings.push(`No complete blocks for ${missingMaps.join(', ')}; full equal-map aggregate is unavailable`);
  const manifest = input.manifest;
  if (!manifest) warnings.push('Manifest unavailable: protocol configuration and planned completeness cannot be verified');
  if (!Number.isInteger(manifest?.instrumentationVersion) || manifest!.instrumentationVersion! < 2) warnings.push('Invalid-progress instrumentationVersion is missing, invalid, or below 2: recorded invalidSteps are descriptive only; an observed zero does not verify absence of rejected advances');
  if (manifest) {
    if (manifest.domain) for (const block of grouped.values()) {
      let expected = 2166136261;
      for (const char of `${manifest.domain}:${block.map}:${block.index}`) expected = Math.imul(expected ^ char.charCodeAt(0), 16777619) >>> 0;
      if (block.seed !== expected) fail(`${block.map}:${block.index}: seed does not match manifest domain`);
    }
    if (manifest.plannedRaces !== undefined && manifest.plannedRaces !== input.rows.length) warnings.push(`Partial/unexpected row count: ${input.rows.length} of ${manifest.plannedRaces} planned races`);
    if (manifest.blocks !== undefined) for (const map of maps) {
      const list = blocks.get(map)!;
      if (list.length !== manifest.blocks || list.some(block => block.index >= manifest.blocks!)) warnings.push(`${map}: expected blocks 0–${manifest.blocks - 1}; found ${list.length} complete blocks`);
    }
    if (manifest.maps && (manifest.maps.length !== maps.length || maps.some(map => !manifest.maps!.includes(map)))) warnings.push('Manifest map set differs from the requested estimand');
  }
  return {name: input.name ?? expectedEquipment, rows: input.rows, manifest, blocks, incomplete, missingMaps, warnings};
}
function endpointsFor(data: Prepared, cohort: 'primary' | 'mixed', maps: readonly string[]): BalanceEndpoint[] {
  const endpoints: BalanceEndpoint[] = [];
  const endpoint = (character: string, c: number, selected: readonly string[], map?: string): BalanceEndpoint => {
    const groups = selected.map(id => data.blocks.get(id)!);
    const available = groups.every(group => group.length > 0);
    const estimates = groups.map(group => group.length ? mean(group.map(block => block.wins[c])) : 0);
    const v = available ? groups.reduce((sum, group, i) => sum + variance(group.map(block => block.wins[c]), estimates[i]) / group.length, 0) / groups.length ** 2 : null;
    const inadequate = groups.some(group => group.length < 2);
    return {id: `${cohort}:${map ?? 'aggregate'}:${character}`, cohort, scope: map ? 'map' : 'aggregate', ...(map ? {map} : {}), character,
      estimate: available ? mean(estimates) : null, standardError: v === null ? null : Math.sqrt(v), lower: null, upper: null,
      degenerate: available && (inadequate || v! < 1e-24), blocks: groups.reduce((sum, group) => sum + group.length, 0),
      intervalMethod: available ? 'pending' : 'unavailable-missing-map', weightsSquared: available ? groups.reduce((sum, group) => sum + 1 / group.length, 0) / groups.length ** 2 : null};
  };
  BALANCE_CHARACTERS.forEach((character, c) => endpoints.push(endpoint(character, c, maps)));
  if (cohort === 'primary') for (const map of maps) BALANCE_CHARACTERS.forEach((character, c) => endpoints.push(endpoint(character, c, [map], map)));
  return endpoints;
}
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Stratified vector bootstrap: one set of sampled blocks drives all six
 * characters and both aggregate and map endpoints in each replicate. */
function simultaneousBand(primary: Prepared, mixed: Prepared | undefined, endpoints: BalanceEndpoint[], maps: readonly string[], draws: number, seed: number) {
  const rng = random(seed), maxima = new Float64Array(draws);
  const active = endpoints.filter(endpoint => endpoint.estimate !== null && !endpoint.degenerate);
  // Reserve 2.5% error probability for conservative degenerate bounds and 2.5%
  // for the bootstrap family. This is a conservative nominal joint 95% band;
  // bootstrap coverage is approximate, not an exact finite-sample guarantee.
  const bootstrapAlpha = .025, boundedAlpha = .025;
  const cohorts = [{data: primary, name: 'primary'}, ...(mixed ? [{data: mixed, name: 'mixed'}] : [])];
  for (let draw = 0; draw < draws && active.length; draw++) {
    const values = new Map<string, number>();
    for (const {data, name} of cohorts) {
      const aggregate = [0, 0, 0, 0, 0, 0];
      for (const map of maps) {
        const blocks = data.blocks.get(map)!;
        if (!blocks.length) continue;
        const wins = [0, 0, 0, 0, 0, 0];
        for (let b = 0; b < blocks.length; b++) {
          const block = blocks[Math.floor(rng() * blocks.length)];
          for (let c = 0; c < 6; c++) wins[c] += block.wins[c];
        }
        for (let c = 0; c < 6; c++) { const value = wins[c] / blocks.length; values.set(`${name}:${map}:${BALANCE_CHARACTERS[c]}`, value); aggregate[c] += value / maps.length; }
      }
      for (let c = 0; c < 6; c++) values.set(`${name}:aggregate:${BALANCE_CHARACTERS[c]}`, aggregate[c]);
    }
    let maximum = 0;
    for (const endpoint of active) maximum = Math.max(maximum, Math.abs(values.get(endpoint.id)! - endpoint.estimate!) / endpoint.standardError!);
    maxima[draw] = maximum;
  }
  maxima.sort();
  const criticalValue = active.length ? maxima[Math.min(draws - 1, Math.ceil((draws + 1) * (1 - bootstrapAlpha)) - 1)] : null;
  const degenerateCount = endpoints.filter(e => e.degenerate).length;
  for (const endpoint of endpoints) {
    if (endpoint.estimate === null) continue;
    if (endpoint.degenerate) {
      // Hoeffding for independent bounded [0,1] block fractions, with stratified
      // weights w=1/(maps*n_map). Bonferroni covers every potential endpoint,
      // not only the endpoints selected as degenerate after seeing the data.
      const radius = Math.sqrt(endpoint.weightsSquared! * Math.log(2 * endpoints.length / boundedAlpha) / 2);
      endpoint.lower = Math.max(0, endpoint.estimate - radius); endpoint.upper = Math.min(1, endpoint.estimate + radius);
      endpoint.intervalMethod = 'bounded-block-Hoeffding-Bonferroni';
    } else {
      endpoint.lower = Math.max(0, endpoint.estimate - criticalValue! * endpoint.standardError!);
      endpoint.upper = Math.min(1, endpoint.estimate + criticalValue! * endpoint.standardError!);
      endpoint.intervalMethod = 'max-t-block-bootstrap-original-SE';
    }
  }
  return {draws, seed: seed >>> 0, confidence: .95, familySize: endpoints.length, bootstrapAlpha, boundedAlpha, criticalValue, degenerateCount,
    method: 'Map-stratified six-rotation vector resampling; max absolute deviation studentized by original cluster SE; independent primary/mixed cohorts; 97.5th-percentile max-t plus simultaneous 97.5% bounded-block fallback',
    caveat: 'Bootstrap coverage is approximate. Degenerate/one-block endpoints use conservative weighted Hoeffding bounds. Individual races and racers are never independent bootstrap observations.'};
}
export function describe(values: number[]) {
  if (!values.length) return {n: 0, sum: 0, mean: null, sd: null, min: null, p05: null, p25: null, median: null, p75: null, p95: null, max: null};
  const sorted = [...values].sort((a, b) => a - b), average = mean(values);
  const q = (p: number) => { const at = (sorted.length - 1) * p, i = Math.floor(at); return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (at - i); };
  return {n: values.length, sum: values.reduce((a, b) => a + b, 0), mean: average, sd: values.length > 1 ? Math.sqrt(variance(values, average)) : null,
    min: sorted[0], p05: q(.05), p25: q(.25), median: q(.5), p75: q(.75), p95: q(.95), max: sorted[sorted.length - 1]};
}
function rejectionDiagnostics(racers: BalanceRacer[]) {
  const counts = new Map<string, number>();
  for (const racer of racers) for (const [reason, count] of Object.entries(racer.rejectionReasons ?? {})) counts.set(reason, (counts.get(reason) ?? 0) + count);
  return {rejectionReasons: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    racerStartsWithRejectionReasons: racers.filter(r => r.rejectionReasons !== undefined).length,
    racerStartsWithoutRejectionReasons: racers.filter(r => r.rejectionReasons === undefined).length,
    invalidStepsWithoutRejectionReasons: racers.filter(r => r.rejectionReasons === undefined).reduce((sum, r) => sum + r.invalidSteps, 0)};
}
function diagnostics(rows: BalanceRace[]) {
  const characters = Object.fromEntries(BALANCE_CHARACTERS.map(character => {
    const racers = rows.flatMap(row => row.racers.filter(racer => racer.characterId === character));
    const wins = rows.filter(row => row.winner === character).length, dnfs = racers.filter(r => r.dnf).length;
    return [character, {...rejectionDiagnostics(racers), starts: racers.length, wins, rawWinRate: rows.length ? wins / rows.length : null, dnfs, dnfRate: racers.length ? dnfs / racers.length : null,
      ranks: Array.from({length: 6}, (_, rank) => ({rank: rank + 1, count: racers.filter(r => r.rank === rank + 1).length})),
      finishSeconds: describe(racers.flatMap(r => r.finishedAt === null ? [] : [r.finishedAt])),
      lapsCompleted: Array.from({length: 4}, (_, laps) => ({laps, count: racers.filter(r => r.laps === laps).length})),
      lapSeconds: [0, 1, 2].map(lap => describe(racers.flatMap(r => r.lapTimes[lap] === undefined ? [] : [r.lapTimes[lap]]))),
      metrics: Object.fromEntries((['pickups', 'uses', 'collisionCount', 'railContacts', 'slowSeconds', 'driftSeconds', 'maxObservedSpeed', 'invalidSteps'] as const).map(metric => [metric, describe(racers.map(r => r[metric]))]))}];
  }));
  return {...rejectionDiagnostics(rows.flatMap(row => row.racers)), races: rows.length, racerStarts: rows.length * 6, dnfs: rows.reduce((n, row) => n + row.racers.filter(r => r.dnf).length, 0),
    racesWithDnf: rows.filter(row => row.racers.some(r => r.dnf)).length, timeouts: rows.filter(row => row.timeout).length,
    noWinnerRaces: rows.filter(row => row.winner === null).length, invalidSteps: rows.reduce((n, row) => n + row.racers.reduce((sum, r) => sum + r.invalidSteps, 0), 0),
    elapsedSeconds: describe(rows.map(row => row.elapsed)), characters};
}
function cohortSummary(data: Prepared, maps: readonly string[]) {
  const completeRows = maps.flatMap(map => data.blocks.get(map)!.flatMap(block => block.rows));
  return {name: data.name, manifest: data.manifest ?? null, totalRows: data.rows.length, analyzedRows: completeRows.length,
    completeBlocks: completeRows.length / 6, blocksByMap: Object.fromEntries(maps.map(map => [map, data.blocks.get(map)!.length])),
    incompleteBlocks: data.incomplete, missingMaps: data.missingMaps, excludedInferentialRows: data.rows.length - completeRows.length,
    denominators: 'Win rates retain all six rotations in each complete block, including DNF/no-winner races. Raw diagnostics retain every input row. Finish-time summaries condition on finishers; lap-time summaries condition on recorded laps. Raw pooled diagnostics are not equal-map estimands.',
    diagnostics: diagnostics(data.rows), maps: Object.fromEntries(maps.map(map => [map, diagnostics(data.rows.filter(row => row.map === map))]))};
}
const combine = (statuses: BalanceStatus[]): BalanceStatus => statuses.includes('fail') ? 'fail' : statuses.includes('inconclusive') ? 'inconclusive' : 'pass';
function equivalence(endpoints: BalanceEndpoint[], margin: number): BalanceStatus {
  const low = 1 / 6 - margin, high = 1 / 6 + margin;
  return combine(endpoints.map(e => e.lower === null || e.upper === null ? 'inconclusive' : e.lower >= low - 1e-12 && e.upper <= high + 1e-12 ? 'pass' : e.upper < low || e.lower > high ? 'fail' : 'inconclusive'));
}
function protocolEligibility(data: Prepared, maps: readonly string[], minimumBlocks: number, equipment: string): string[] {
  const issues: string[] = [], m = data.manifest;
  if (maps.length !== 12 || BALANCE_MAPS.some(map => !maps.includes(map))) issues.push('All twelve protocol maps are required');
  if (!m) issues.push('Runner manifest is required');
  if (data.incomplete.length || data.missingMaps.length) issues.push('Incomplete map/rotation coverage');
  if (maps.some(map => data.blocks.get(map)!.length < minimumBlocks)) issues.push(`Requires at least ${minimumBlocks} independent complete blocks per map`);
  if (data.rows.some(row => row.difficulty !== 'normal' || row.equipment !== equipment || !row.items)) issues.push('Non-primary race configuration');
  if (!m?.sourceHashes || !Object.keys(m.sourceHashes).length) issues.push('Source hashes are missing');
  // Final candidates must be baked into the hashed roster. Runtime overrides
  // are permitted for descriptive training, never held-out certification.
  const profiles = m?.options?.profiles;
  if (profiles != null && (typeof profiles !== 'object' || Array.isArray(profiles) || Object.keys(profiles).length > 0)) issues.push('Nonempty runtime profile overrides are prohibited for holdout certification; bake the candidate roster into source');
  // Version 1 did not fully observe invalid progress. Preserve old reports as
  // descriptive data, but do not turn an unobserved zero into safety evidence.
  if (!Number.isInteger(m?.instrumentationVersion) || m!.instrumentationVersion! < 2) issues.push('Invalid-progress instrumentationVersion >= 2 is required for certification');
  if (m?.dt !== 1 / 60 || m?.laps !== 3 || m?.options?.timeoutSeconds !== 600 || m?.options?.identityControl) issues.push('Manifest does not verify frozen 60 Hz / three laps / 600-second conditions');
  if (m?.plannedRaces !== data.rows.length || !m?.blocks || maps.some(map => data.blocks.get(map)!.length !== m.blocks || data.blocks.get(map)!.some(block => block.index >= m.blocks!))) issues.push('Manifest planned sample is incomplete or inconsistent');
  if (!m?.maps || m.maps.length !== maps.length || maps.some(map => !m.maps!.includes(map))) issues.push('Manifest map set mismatch');
  return issues;
}
export function analyzeBalance(primaryInput: BalanceInput, mixedInput?: BalanceInput, options: BalanceAnalysisOptions = {}) {
  const maps = [...(options.maps ?? BALANCE_MAPS)], draws = options.draws ?? 10_000, seed = options.seed ?? 0x7a31b09d;
  if (!maps.length || new Set(maps).size !== maps.length) throw new Error('Expected a nonempty distinct map list');
  if (!Number.isInteger(draws) || draws < 1 || !Number.isInteger(seed)) throw new Error('Invalid draws/seed');
  const primary = prepare(primaryInput, maps, 'equal'), mixed = mixedInput ? prepare(mixedInput, maps, 'mixed') : undefined;
  if (mixed) for (const map of maps) {
    const primarySeeds = new Set(primary.rows.filter(row => row.map === map).map(row => row.seed));
    if (mixed.rows.some(row => row.map === map && primarySeeds.has(row.seed))) fail(`Primary/mixed cohorts reuse seeds on ${map}`);
  }
  const stage = options.stage ?? (primary.manifest?.domain?.includes('training') ? 'training' : primary.manifest?.domain?.includes('holdout') && !primary.manifest?.domain?.includes('mixed') ? 'holdout' : 'exploratory');
  const endpoints = [...endpointsFor(primary, 'primary', maps), ...(mixed ? endpointsFor(mixed, 'mixed', maps) : [])];
  const uncertainty = simultaneousBand(primary, mixed, endpoints, maps, draws, seed);
  const primarySummary = cohortSummary(primary, maps), mixedSummary = mixed ? cohortSummary(mixed, maps) : null;
  const aggregate = endpoints.filter(e => e.cohort === 'primary' && e.scope === 'aggregate'), perMap = endpoints.filter(e => e.scope === 'map'), mixedAggregate = endpoints.filter(e => e.cohort === 'mixed');
  const observedTarget = combine(aggregate.map(e => e.estimate === null ? 'inconclusive' : Math.abs(e.estimate - 1 / 6) <= .03 + 1e-12 ? 'pass' : 'fail'));
  const primaryEquivalence = equivalence(aggregate, .04);
  const mapUpperBound = combine(perMap.map(e => e.upper === null ? 'inconclusive' : e.upper < .4 ? 'pass' : e.lower! >= .4 ? 'fail' : 'inconclusive'));
  const cleanPrimary = primarySummary.diagnostics.dnfs === 0 && primarySummary.diagnostics.invalidSteps === 0 && primarySummary.diagnostics.timeouts === 0 ? 'pass' : 'fail';
  const primaryStatus = combine([observedTarget, primaryEquivalence, mapUpperBound, cleanPrimary]);
  const mixedEquivalence = mixed ? equivalence(mixedAggregate, .05) : 'inconclusive';
  const eligibilityIssues = [...protocolEligibility(primary, maps, 128, 'equal').map(issue => `Primary: ${issue}`), ...(mixed ? protocolEligibility(mixed, maps, 64, 'mixed').map(issue => `Mixed: ${issue}`) : ['Mixed-equipment holdout not supplied'])];
  if (stage !== 'holdout') eligibilityIssues.push('Training/exploratory data cannot certify held-out balance');
  if (!primary.manifest?.domain?.includes('holdout') || primary.manifest.domain.includes('mixed')) eligibilityIssues.push('Primary independent holdout seed domain is unverified');
  if (mixed && !mixed.manifest?.domain?.includes('mixed-holdout')) eligibilityIssues.push('Mixed independent holdout seed domain is unverified');
  if (draws !== 10_000) eligibilityIssues.push('Protocol requires exactly 10,000 bootstrap draws');
  if (mixed && JSON.stringify(Object.entries(primary.manifest?.sourceHashes ?? {}).sort()) !== JSON.stringify(Object.entries(mixed.manifest?.sourceHashes ?? {}).sort())) eligibilityIssues.push('Primary/mixed source hashes differ');
  const statisticsStatus = combine([primaryStatus, mixedEquivalence]);
  const certificationStatus = eligibilityIssues.length ? 'inconclusive' : statisticsStatus;
  const warnings = [...primary.warnings.map(w => `Primary: ${w}`), ...(mixed?.warnings.map(w => `Mixed: ${w}`) ?? [])];
  if (stage !== 'holdout') warnings.push('Uncertainty is descriptive only: training/exploratory outcomes are not independent confirmation of a tuned candidate');
  if (uncertainty.degenerateCount) warnings.push(`${uncertainty.degenerateCount} degenerate/one-block endpoints use conservative bounded-block fallback, not a zero-width bootstrap interval`);
  return {schema: 1, stage, maps, characters: BALANCE_CHARACTERS, estimand: 'Each character first-place probability, equally weighted across all selected maps, with complete six-rotation blocks as independent units',
    uncertainty, acceptance: {statisticsStatus, certificationStatus, primaryStatus, observedTarget, primaryEquivalence, mapUpperBound, cleanPrimary, mixedEquivalence,
      thresholds: {target: 1 / 6, observedMargin: .03, primaryMargin: .04, perMapUpperExclusive: .4, mixedMargin: .05}, eligibilityIssues,
      scope: 'Statistical criteria only. Candidate freezing, untouched holdout provenance, identical-role controls, deterministic replay, archetype ordering, and source-integrity review require separate evidence.'},
    warnings, endpoints, primary: primarySummary, mixed: mixedSummary};
}
export type BalanceAnalysis = ReturnType<typeof analyzeBalance>;
const pct = (value: number | null) => value === null ? 'unavailable' : `${(value * 100).toFixed(2)}%`;
export function renderBalanceReport(report: BalanceAnalysis): string {
  const lines = ['# Land CPU balance analysis', '', `Stage: **${report.stage}**. Statistical assessment: **${report.acceptance.statisticsStatus}**. Held-out statistical certification: **${report.acceptance.certificationStatus}**.`, '',
    `Primary input: ${report.primary.totalRows} races; ${report.primary.completeBlocks} complete independent blocks; ${report.primary.excludedInferentialRows} incomplete-block rows excluded from inference.`,
    `Primary DNFs: ${report.primary.diagnostics.dnfs}/${report.primary.diagnostics.racerStarts}; timeouts: ${report.primary.diagnostics.timeouts}; observed invalid steps: ${report.primary.diagnostics.invalidSteps}; no-winner races: ${report.primary.diagnostics.noWinnerRaces}.`, '',
    '## Acceptance checks', '', ...Object.entries(report.acceptance).filter(([key]) => ['observedTarget', 'primaryEquivalence', 'mapUpperBound', 'cleanPrimary', 'mixedEquivalence'].includes(key)).map(([key, value]) => `- ${key}: **${value}**`), '',
    'Observed primary aim: 16.6667% ±3 percentage points. Joint primary intervals must lie inside ±4 points. Every per-map upper bound must be strictly below 40%. Mixed aggregate intervals must lie inside ±5 points.', '',
    '## Equal-map aggregate win rates', '', '| Cohort | Character | Rate | Simultaneous lower | Simultaneous upper | Cluster SE | Method |', '|---|---|---:|---:|---:|---:|---|'];
  for (const e of report.endpoints.filter(e => e.scope === 'aggregate')) lines.push(`| ${e.cohort} | ${e.character} | ${pct(e.estimate)} | ${pct(e.lower)} | ${pct(e.upper)} | ${pct(e.standardError)} | ${e.degenerate ? 'bounded-block fallback' : e.intervalMethod} |`);
  lines.push('', '## All primary per-map win rates', '', '| Map | Character | Rate | Simultaneous lower | Simultaneous upper | Independent blocks |', '|---|---|---:|---:|---:|---:|');
  for (const e of report.endpoints.filter(e => e.scope === 'map')) lines.push(`| ${e.map} | ${e.character} | ${pct(e.estimate)} | ${pct(e.lower)} | ${pct(e.upper)} | ${e.blocks} |`);
  for (const [name, cohort] of [['Primary', report.primary], ['Mixed', report.mixed]] as const) {
    if (!cohort) continue;
    const reasons = Object.entries(cohort.diagnostics.rejectionReasons).map(([reason, count]) => `${reason}: ${count}`).join('; ') || 'none recorded';
    lines.push('', `## ${name} racer diagnostics (raw input rows)`, '', `Rejected-advance reasons: ${reasons}. Reason detail is present for ${cohort.diagnostics.racerStartsWithRejectionReasons}/${cohort.diagnostics.racerStarts} racer starts; ${cohort.diagnostics.invalidStepsWithoutRejectionReasons} recorded invalid steps have no reason detail.`, '', '| Character | Wins / starts | DNF | Rank counts 1–6 | Finish seconds p05 / median / p95 | Pickups mean | Uses mean | Collisions mean | Rails mean | Slow seconds mean |', '|---|---:|---:|---|---|---:|---:|---:|---:|---:|');
    const f = (value: number | null) => value === null ? 'n/a' : value.toFixed(2);
    for (const character of report.characters) {
      const d = cohort.diagnostics.characters[character];
      lines.push(`| ${character} | ${d.wins} / ${d.starts} | ${d.dnfs} | ${d.ranks.map(r => r.count).join(' / ')} | ${[d.finishSeconds.p05, d.finishSeconds.median, d.finishSeconds.p95].map(f).join(' / ')} | ${f(d.metrics.pickups.mean)} | ${f(d.metrics.uses.mean)} | ${f(d.metrics.collisionCount.mean)} | ${f(d.metrics.railContacts.mean)} | ${f(d.metrics.slowSeconds.mean)} |`);
    }
    lines.push('', 'Full per-map/character rank counts, completion/lap distributions, finish-time quantiles, pickup/use totals and distributions, contact metrics, drift, and speed diagnostics are in the companion summary JSON.');
  }
  lines.push('', '## Uncertainty and interpretation', '', report.uncertainty.method + '.', '', `${report.uncertainty.draws.toLocaleString('en-US')} deterministic bootstrap draws; seed ${report.uncertainty.seed}; ${report.uncertainty.familySize} joint endpoints; critical max-t ${report.uncertainty.criticalValue?.toFixed(6) ?? 'not applicable (all endpoints degenerate/unavailable)'}.`, '', report.uncertainty.caveat, '', report.primary.denominators, '', 'Fail means a failed observed/safety criterion or an interval fully beyond a permitted boundary. Inconclusive means insufficient precision, missing coverage, or unverified holdout eligibility. A pass applies only to the stated statistical checks.', '', report.acceptance.scope);
  if (report.acceptance.eligibilityIssues.length) lines.push('', '## Certification blockers', '', ...report.acceptance.eligibilityIssues.map(issue => `- ${issue}`));
  if (report.warnings.length) lines.push('', '## Warnings', '', ...report.warnings.map(warning => `- ${warning}`));
  return lines.join('\n') + '\n';
}
