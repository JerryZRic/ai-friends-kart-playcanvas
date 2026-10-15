#!/usr/bin/env -S node --import tsx
/** Usage: node --import tsx scripts/analyze-balance.ts --input=balance-results/baseline
 *   [--mixed=balance-results/mixed-holdout] [--out=balance-results/analysis]
 *   [--stage=training|holdout|exploratory] [--draws=10000] [--seed=2050076829]
 * Outputs <out>.summary.json and <out>.report.md. Never writes input outcomes.
 * A partial snapshot is allowed, but cannot certify. Malformed or duplicate
 * records are fatal. Prefix inputs discover the runner's matching manifest.
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {analyzeBalance, renderBalanceReport, type BalanceInput, type BalanceStage} from '../src/cpu-balance-statistics';
const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) throw new Error(`Unexpected argument ${arg}`);
  const at = arg.indexOf('='), key = arg.slice(2, at < 0 ? undefined : at);
  args[key] = at < 0 ? (process.argv[i + 1]?.startsWith('--') || !process.argv[i + 1] ? 'true' : process.argv[++i]) : arg.slice(at + 1);
}
if (args.help || !args.input) {
  console.log('Usage: node --import tsx scripts/analyze-balance.ts --input <prefix|file.jsonl[.gz]> [--mixed <prefix|file.jsonl[.gz]>] [--out <prefix>] [--stage training|holdout|exploratory] [--draws 10000] [--seed 2050076829]\nWrites <out>.summary.json and <out>.report.md; default out is <input-prefix>.analysis. Only complete six-rotation blocks enter inference. Every row remains in raw diagnostics.');
  process.exit(args.help ? 0 : 1);
}
for (const key of Object.keys(args)) if (!['input', 'mixed', 'mixedholdout', 'out', 'stage', 'draws', 'seed', 'help'].includes(key)) throw new Error(`Unknown option --${key}`);
if (args.stage && !['training', 'holdout', 'exploratory'].includes(args.stage)) throw new Error('Invalid --stage');
function load(path: string): BalanceInput & {source: {file: string; contentSha256: string; fileSha256: string; manifestSha256: string | null}} {
  const plain = resolve(existsSync(resolve(path)) || /\.jsonl(?:\.gz)?$/.test(path) ? path : path + '.jsonl');
  const file = existsSync(plain) ? plain : existsSync(plain + '.gz') ? plain + '.gz' : plain;
  const prefix = file.replace(/\.jsonl(?:\.gz)?$/, '');
  const bytes = readFileSync(file), contentBytes = file.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  const content = contentBytes.toString('utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const rows = lines.map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`${file}:${i + 1}: invalid JSON (if writer is active, wait for a complete block and retry)`); } });
  const manifestFile = prefix + '.manifest.json';
  const manifestContent = existsSync(manifestFile) ? readFileSync(manifestFile, 'utf8') : null;
  const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  return {name: file, rows, ...(manifestContent ? {manifest: JSON.parse(manifestContent)} : {}), source: {file, contentSha256: hash(contentBytes), fileSha256: hash(bytes), manifestSha256: manifestContent === null ? null : hash(manifestContent)}};
}
try {
  const input = load(args.input), mixedPath = args.mixed ?? args.mixedholdout, mixed = mixedPath ? load(mixedPath) : undefined;
  const report = {...analyzeBalance(input, mixed, {stage: args.stage as BalanceStage | undefined, draws: args.draws ? Number(args.draws) : undefined, seed: args.seed ? Number(args.seed) : undefined}), sources: {primary: input.source, mixed: mixed?.source ?? null}};
  const out = resolve(args.out ?? args.input.replace(/\.jsonl(?:\.gz)?$/, '') + '.analysis');
  const jsonPath = out + '.summary.json', markdownPath = out + '.report.md';
  if ([input.name, mixed?.name].includes(jsonPath) || [input.name, mixed?.name].includes(markdownPath)) throw new Error('Output must not overwrite input');
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n'); writeFileSync(markdownPath, renderBalanceReport(report));
  console.log(JSON.stringify({summary: jsonPath, report: markdownPath, stage: report.stage, statisticsStatus: report.acceptance.statisticsStatus, certificationStatus: report.acceptance.certificationStatus, races: report.primary.totalRows, completeBlocks: report.primary.completeBlocks, draws: report.uncertainty.draws, warnings: report.warnings}, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
