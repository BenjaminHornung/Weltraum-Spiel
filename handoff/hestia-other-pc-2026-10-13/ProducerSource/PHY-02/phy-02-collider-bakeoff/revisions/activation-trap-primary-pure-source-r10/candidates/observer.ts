export type Result =
  | { status: "NOT_RUN" }
  | { status: "PASS"; result: unknown }
  | { status: "FAIL"; error: unknown };

export interface DisposableBatch {
  poisoned: boolean;
}

// UNAPPLIED: shared only if a future owner loads both overlays in one module instance.
export const receiverBatch: DisposableBatch = { poisoned: false };

export type StopCause = "ACQUISITION_NATIVE_TRAP" | "BODY_NATIVE_TRAP" | "CLEANUP_FAILURE";

export interface CaseObservation {
  caseId: string;
  acquisition: { status: "NOT_RUN" | "PASS" } | { status: "FAIL"; error: unknown };
  acquired: boolean;
  primary: Result;
  primaryPresent: boolean;
  stopCauses: StopCause[];
  cleanup: Result;
  releaseAttempts: number;
  disposition: "PREPARED" | "NOT_ACQUIRED" | "RELEASED" | "POISONED";
}

// Frozen withWorld precedence; disposer is entered only after acquire returned a handle.
export function prepareCase(batch: DisposableBatch, caseId: string) {
  if (batch.poisoned) throw new Error("Source disposable batch is poisoned");
  let consumed = false;
  const observation: CaseObservation = {
    caseId, acquisition: { status: "NOT_RUN" }, acquired: false,
    primary: { status: "NOT_RUN" }, primaryPresent: false, stopCauses: [], cleanup: { status: "NOT_RUN" },
    releaseAttempts: 0, disposition: "PREPARED",
  };
  return {
    observation,
    run<W, T>(acquire: () => W, body: (resource: W) => T, dispose: (resource: W) => void): T {
      if (consumed || batch.poisoned) throw new Error("Source disposable case cannot be reused");
      consumed = true;
      let resource: W;
      try {
        resource = acquire();
        observation.acquisition = { status: "PASS" };
        observation.acquired = true;
      } catch (error) {
        observation.acquisition = { status: "FAIL", error };
        observation.disposition = "NOT_ACQUIRED";
        if (error instanceof WebAssembly.RuntimeError) {
          observation.stopCauses.push("ACQUISITION_NATIVE_TRAP");
          observation.disposition = "POISONED";
          batch.poisoned = true;
        }
        throw error;
      }
      try {
        const result = body(resource);
        observation.primary = { status: "PASS", result };
        return result;
      } catch (error) {
        observation.primaryPresent = true;
        observation.primary = { status: "FAIL", error };
        if (error instanceof WebAssembly.RuntimeError) {
          observation.stopCauses.push("BODY_NATIVE_TRAP");
          batch.poisoned = true;
        }
        throw error;
      } finally {
        observation.releaseAttempts++;
        try {
          const result = dispose(resource);
          observation.cleanup = { status: "PASS", result };
          observation.disposition = batch.poisoned ? "POISONED" : "RELEASED";
        } catch (error) {
          observation.cleanup = { status: "FAIL", error };
          observation.stopCauses.push("CLEANUP_FAILURE");
          observation.disposition = "POISONED";
          batch.poisoned = true;
          // Presence is independent of the thrown value, including undefined.
          if (!observation.primaryPresent) throw error;
        }
      }
    },
  };
}

