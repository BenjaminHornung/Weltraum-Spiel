// src/init.ts
function disposeOwned(actions) {
  const errors = [];
  for (const action of [...actions].reverse()) try {
    action();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, "ATM_CLEANUP_FAILED");
}
async function disposeOwnedAsync(actions) {
  const errors = [];
  for (const action of [...actions].reverse()) try {
    await action();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, "ATM_CLEANUP_FAILED");
}
function createSingleFlight(factory) {
  let pending = null, ready = null, controller = null, disposed = false, cancelReleaseError = null;
  return {
    get busy() {
      return pending !== null;
    },
    load() {
      if (disposed) return Promise.reject(Error("INIT_DISPOSED"));
      if (ready) return Promise.resolve(ready);
      if (pending) return pending;
      controller = new AbortController();
      const signal = controller.signal;
      pending = Promise.resolve().then(() => factory(signal)).then((value) => {
        if (disposed || signal.aborted) {
          try {
            value.dispose();
          } catch (error) {
            cancelReleaseError = { error };
            throw error;
          }
          throw Error("INIT_CANCELLED");
        }
        ready = value;
        return value;
      }).finally(() => {
        pending = null;
        controller = null;
      });
      return pending;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      controller?.abort();
      await pending?.catch(() => {
      });
      const value = ready;
      ready = null;
      if (cancelReleaseError) throw cancelReleaseError.error;
      value?.dispose();
    }
  };
}
export {
  createSingleFlight,
  disposeOwned,
  disposeOwnedAsync
};
