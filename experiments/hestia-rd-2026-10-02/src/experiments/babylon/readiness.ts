// Cancellation bounds our authority, not the SDK's uncancellable native work.
// Its eventual result is still observed by the host's stage-aware late cleanup.
export function bounded<T>(work: Promise<T>, signal: AbortSignal, stage: string, milliseconds = 15_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false; let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: unknown, value?: T) => {
      if (settled) { return; } settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error !== undefined) { reject(error); } else { resolve(value as T); }
    };
    const abort = () => finish(new Error(`${stage} aborted`));
    timer = setTimeout(() => finish(new Error(`${stage} deadline exceeded (${milliseconds}ms)`)), milliseconds);
    signal.addEventListener('abort', abort, { once: true }); work.then((value) => finish(undefined, value), (error) => finish(error));
    if (signal.aborted) { abort(); }
  });
}
