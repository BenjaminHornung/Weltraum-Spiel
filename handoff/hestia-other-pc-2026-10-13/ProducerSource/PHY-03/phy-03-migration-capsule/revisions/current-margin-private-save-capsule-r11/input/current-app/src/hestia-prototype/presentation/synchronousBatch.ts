/** Coalesces synchronous projection requests; never schedules publication. */
export function createSynchronousBatch(flush: () => void) {
  let depth = 0;
  let dirty = false;
  const flushIfReady = (): void => {
    if (depth !== 0 || !dirty) { return; }
    dirty = false;
    flush();
  };
  return {
    request(): void { dirty = true; flushIfReady(); },
    run<T>(action: () => T): T {
      depth += 1;
      let result!: T;
      let failed = false;
      let actionError: unknown;
      try {
        result = action();
        if (result !== null && result !== undefined
          && (typeof result === "object" || typeof result === "function")
          && typeof (result as { then?: unknown }).then === "function") {
          throw new Error("Presentation batch must be synchronous");
        }
      } catch (error) { failed = true; actionError = error; }
      depth -= 1;
      try { flushIfReady(); }
      catch (flushError) {
        if (failed) {
          let message = "Presentation action and flush failed";
          try { message += `: ${String(actionError)}; ${String(flushError)}`; }
          catch { /* Formatting must not replace either original cause. */ }
          throw new AggregateError([actionError, flushError], message);
        }
        throw flushError;
      }
      if (failed) { throw actionError; }
      return result;
    }
  };
}
