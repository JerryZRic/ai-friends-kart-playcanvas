// Only transient transport failures are retried. Parsing/integrity errors are not.
export class DownloadError extends Error {
  constructor(message, retryable = false) { super(message); this.name = 'DownloadError'; this.retryable = retryable; }
}
export const isTransient = error => error instanceof TypeError || error?.retryable === true;
export function backoffDelay(attempt, random = Math.random) {
  return Math.min(15000, 1000 * 2 ** (attempt - 1) * (.75 + random() * .5));
}
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
});
export async function fetchStream(path, { signal, onProgress = () => {}, expectedBytes, decodedBytes } = {}) {
  const response = await fetch(path, { credentials: 'omit', redirect: 'error', signal });
  if (!response.ok) throw new DownloadError(`HTTP ${response.status}`, [408,429].includes(response.status) || response.status >= 500);
  const encoded = response.headers?.get('content-encoding');
  // fetch exposes decoded bytes for Content-Encoding, so use the decoded manifest size.
  const length = encoded ? decodedBytes : Number(response.headers?.get('content-length')) || expectedBytes;
  const totalBytes = Number.isFinite(length) && length > 0 ? length : null;
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer(); onProgress({ receivedBytes: buffer.byteLength, totalBytes: totalBytes || buffer.byteLength }); return buffer;
  }
  const reader = response.body.getReader(), chunks = []; let receivedBytes = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); receivedBytes += value.byteLength; onProgress({ receivedBytes, totalBytes }); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(receivedBytes); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  onProgress({ receivedBytes, totalBytes: receivedBytes });
  return bytes.buffer;
}
export async function fetchWithRetry(path, {
  fetchAsset = fetchStream, signal, onProgress = () => {}, onRetry = () => {}, onAttempt = () => {},
  expectedBytes, decodedBytes, timeoutMs = 60000, maxAttempts = 4, random = Math.random, wait = sleep,
} = {}) {
  const attempts = Math.max(1, Math.min(4, Math.floor(maxAttempts) || 4));
  const deadline = Math.max(1, Math.min(180000, Number.isFinite(timeoutMs) ? timeoutMs : 60000));
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    const abort = new AbortController();
    const cancel = () => abort.abort(signal.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let timer, active = true;
    onAttempt({ attempt, maxAttempts: attempts });
    try {
      return await Promise.race([
        fetchAsset(path, { signal: abort.signal, expectedBytes, decodedBytes, onProgress: progress => { if (active) onProgress(progress); } }),
        new Promise((_, reject) => { timer = setTimeout(() => { reject(new DownloadError('下载超时', true)); abort.abort(); }, deadline); }),
        new Promise((_, reject) => { abort.signal.addEventListener('abort', () => reject(signal?.reason || new DOMException('Aborted', 'AbortError')), { once: true }); }),
      ]);
    } catch (error) {
      if (signal?.aborted || !isTransient(error) || attempt === attempts) throw error;
      // Close the attempt before waiting: stale progress cannot modify a newer attempt.
      active = false; clearTimeout(timer); abort.abort();
      let remaining = Math.ceil(backoffDelay(attempt, random));
      while (remaining > 0) { onRetry({ attempt, maxAttempts: attempts, retryInMs: remaining }); const tick = Math.min(1000, remaining); await wait(tick, signal); remaining -= tick; }
    } finally { active = false; clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
}
