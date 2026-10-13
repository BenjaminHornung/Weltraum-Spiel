export type Result =
  | { status: "NOT_RUN" }
  | { status: "PASS"; result: unknown }
  | { status: "FAIL"; error: unknown };

export interface DisposableBatch {
  poisoned: boolean;
}

export interface CaseObservation {
  caseId: string;
  primary: Result;
  cleanup: Result;
  releaseAttempts: number;
  disposition: "PREPARED" | "RELEASED" | "POISONED";
}

// Same synchronous try/catch/finally precedence as frozen withWorld; no resource acquisition here.
export function prepareCase(batch: DisposableBatch, caseId: string) {
  if (batch.poisoned) throw new Error("Source disposable batch is poisoned");
  let consumed = false;
  const observation: CaseObservation = {
    caseId, primary: { status: "NOT_RUN" }, cleanup: { status: "NOT_RUN" },
    releaseAttempts: 0, disposition: "PREPARED",
  };
  return {
    observation,
    run<T>(body: () => T, dispose: () => void): T {
      if (consumed || batch.poisoned) throw new Error("Source disposable case cannot be reused");
      consumed = true;
      try {
        const result = body();
        observation.primary = { status: "PASS", result };
        return result;
      } catch (error) {
        observation.primary = { status: "FAIL", error };
        throw error;
      } finally {
        observation.releaseAttempts++;
        try {
          const result = dispose();
          observation.cleanup = { status: "PASS", result };
          observation.disposition = "RELEASED";
        } catch (error) {
          observation.cleanup = { status: "FAIL", error };
          observation.disposition = "POISONED";
          batch.poisoned = true;
          // Explicit status also preserves a primary throw of undefined.
          if (observation.primary.status !== "FAIL") throw error;
        }
      }
    },
  };
}
