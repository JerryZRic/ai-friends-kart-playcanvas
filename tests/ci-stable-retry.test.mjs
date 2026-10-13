import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchStableFile, retryDelay, sha256 } from '../scripts/compose-dev-pages.mjs';
const bytes = Buffer.from('stable bytes');
const record = { path: 'index.html', bytes: bytes.length, sha256: sha256(bytes) };
const options = delays => ({ sleep: async delay => { delays.push(delay); }, random: () => 0, now: () => 0 });
for (const status of [429, 502, 503, 504]) test(`transient HTTP ${status} retries with bounded exponential backoff`, async () => {
  let calls = 0; const delays = [];
  const result = await fetchStableFile(record, async () => ++calls < 4 ? new Response('', { status }) : new Response(bytes), options(delays));
  assert.deepEqual(result, bytes); assert.equal(calls, 4); assert.deepEqual(delays, [1000, 2000, 4000]);
});
test('repeated transient failure stops after four attempts', async () => {
  let calls = 0; const delays = [];
  await assert.rejects(fetchStableFile(record, async () => { calls++; return new Response('', { status: 503 }); }, options(delays)), /HTTP 503/);
  assert.equal(calls, 4); assert.equal(delays.length, 3);
});
for (const status of [400, 401, 403, 404, 500]) test(`HTTP ${status} remains a permanent failure`, async () => {
  let calls = 0; const delays = [];
  await assert.rejects(fetchStableFile(record, async () => { calls++; return new Response('', { status }); }, options(delays)), new RegExp(`HTTP ${status}`));
  assert.equal(calls, 1); assert.deepEqual(delays, []);
});
test('Retry-After seconds and dates are respected within a thirty-second cap', () => {
  const config = { random: () => 0, now: () => 0 };
  assert.equal(retryDelay(0, '8', config), 8000);
  assert.equal(retryDelay(0, 'Thu, 01 Jan 1970 00:00:10 GMT', config), 10000);
  assert.equal(retryDelay(0, '3600', config), 30000);
  assert.equal(retryDelay(1, 'nonsense', config), 2000);
  assert.equal(retryDelay(1, '-5', config), 2000);
});
test('recognized transport interruption retries but redirect and permission failures do not', async () => {
  const delays = []; let calls = 0;
  await fetchStableFile(record, async () => {
    if (++calls === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    return new Response(bytes);
  }, options(delays));
  assert.equal(calls, 2); assert.deepEqual(delays, [1000]);
  for (const error of [new TypeError('unexpected redirect'), Object.assign(new Error('denied'), { code: 'EACCES' })]) {
    calls = 0;
    await assert.rejects(fetchStableFile(record, async () => { calls++; throw error; }, options([])));
    assert.equal(calls, 1);
  }
});
test('byte mismatch, truncation and oversized responses never retry', async () => {
  for (const body of [Buffer.alloc(bytes.length, 65), bytes.subarray(1), Buffer.concat([bytes, bytes])]) {
    let calls = 0; const delays = [];
    await assert.rejects(fetchStableFile(record, async () => { calls++; return new Response(body); }, options(delays)));
    assert.equal(calls, 1); assert.deepEqual(delays, []);
  }
});
