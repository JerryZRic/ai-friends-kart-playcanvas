/** Cancel transfers before destroying their parser's app/asset registry.
 * A GLB already parsing must settle first, so its load/error callbacks stay valid.
 */
export function createWaterparkLifetime(dispose: () => void) {
  const controller = new AbortController();
  let closed = false, pending = 0, disposed = false;
  const finish = () => {
    if (closed && pending === 0 && !disposed) { disposed = true; dispose(); }
  };
  return {
    signal: controller.signal,
    get closed() { return closed; },
    async run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
      if (closed) throw new DOMException('Waterpark closed', 'AbortError');
      pending++;
      try { return await task(controller.signal); }
      finally { pending--; finish(); }
    },
    close() {
      if (closed) return;
      closed = true; controller.abort(); finish();
    },
  };
}
