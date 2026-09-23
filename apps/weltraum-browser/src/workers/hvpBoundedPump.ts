/** HVP-only mapper: refill at most two lanes, but drain every started callback on failure. */
export async function runHvpBounded<T, R>(
  items: readonly T[],
  parallel: number,
  run: (item: T, index: number) => Promise<R>,
  onFailure: (error: unknown) => void = () => {}
): Promise<R[]> {
  if (!Number.isInteger(parallel) || parallel < 1 || parallel > 2) {
    throw new Error("Invalid HVP concurrency");
  }
  const results = new Array<R>(items.length);
  let cursor = 0, failed = false;
  let firstError: unknown;
  const lane = async (): Promise<void> => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await run(items[index]!, index);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
          try { onFailure(error); } catch { /* Cancellation cannot replace the first failure. */ }
        }
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, lane));
  if (failed) { throw firstError; }
  return results;
}
