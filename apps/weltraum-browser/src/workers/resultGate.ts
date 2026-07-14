import type { AlgorithmVersion, ByteCount, ContentRevision, PlanningEpoch, WorkerEpoch, WorkerJobId, WorkerTargetKey } from "./ids";
import { fnv1aBytes, validateTransferableBundle, type TransferableBufferBundle, type WorkerJobResult } from "./protocol";

export interface WorkerResultExpectation {
  readonly jobId: WorkerJobId;
  readonly cancelled: boolean;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly targetKey: WorkerTargetKey;
  readonly inputRevision: ContentRevision;
  readonly outputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly maximumOutputBytes: ByteCount;
  readonly expectedContentHash?: string;
}

export type WorkerResultIntegrationDecision =
  | { readonly kind: "Accepted"; readonly bundle: TransferableBufferBundle }
  | { readonly kind: "RejectedUnknownJob" }
  | { readonly kind: "RejectedCancelled" }
  | { readonly kind: "RejectedStalePlanningEpoch" }
  | { readonly kind: "RejectedStaleWorkerEpoch" }
  | { readonly kind: "RejectedTargetMismatch" }
  | { readonly kind: "RejectedRevisionMismatch" }
  | { readonly kind: "RejectedAlgorithmMismatch" }
  | { readonly kind: "RejectedInvalidLayout"; readonly message: string }
  | { readonly kind: "RejectedOverBudget" }
  | { readonly kind: "RejectedContentHashMismatch" };

export const integrateWorkerResult = (
  expectation: WorkerResultExpectation | undefined,
  result: WorkerJobResult,
  bundle: TransferableBufferBundle,
): WorkerResultIntegrationDecision => {
  if (!expectation || expectation.jobId !== result.jobId) return Object.freeze({ kind: "RejectedUnknownJob" });
  if (expectation.cancelled) return Object.freeze({ kind: "RejectedCancelled" });
  if (expectation.planningEpoch !== result.planningEpoch) return Object.freeze({ kind: "RejectedStalePlanningEpoch" });
  if (expectation.workerEpoch !== result.workerEpoch) return Object.freeze({ kind: "RejectedStaleWorkerEpoch" });
  if (expectation.targetKey !== result.targetKey) return Object.freeze({ kind: "RejectedTargetMismatch" });
  if (expectation.inputRevision !== result.inputRevision || expectation.outputRevision !== result.outputRevision) return Object.freeze({ kind: "RejectedRevisionMismatch" });
  let bundleRevision: unknown;
  try { bundleRevision = typeof bundle === "object" && bundle !== null ? (bundle as { readonly revision?: unknown }).revision : undefined; }
  catch { return Object.freeze({ kind: "RejectedInvalidLayout", message: "Invalid output bundle envelope." }); }
  if (typeof bundleRevision !== "number" || !Number.isSafeInteger(bundleRevision) || bundleRevision < 0) return Object.freeze({ kind: "RejectedInvalidLayout", message: "Invalid output bundle revision." });
  if (bundleRevision !== result.outputRevision) return Object.freeze({ kind: "RejectedRevisionMismatch" });
  if (expectation.algorithmVersion !== result.algorithmVersion) return Object.freeze({ kind: "RejectedAlgorithmMismatch" });
  let validated: TransferableBufferBundle;
  try { validated = validateTransferableBundle(bundle); }
  catch (error) { return Object.freeze({ kind: "RejectedInvalidLayout", message: error instanceof Error ? error.message : "Invalid output layout." }); }
  if (validated.ownership !== "WorkerToConsumer") return Object.freeze({ kind: "RejectedInvalidLayout", message: "Output bundle ownership must be WorkerToConsumer." });
  if (validated.byteLength !== result.outputBytes || validated.byteLength > expectation.maximumOutputBytes) return Object.freeze({ kind: "RejectedOverBudget" });
  const actualHash = fnv1aBytes(validated.buffers);
  const declaredHash = result.contentHash ?? validated.contentHash;
  if ((expectation.expectedContentHash !== undefined && actualHash !== expectation.expectedContentHash) || (declaredHash !== undefined && actualHash !== declaredHash)) return Object.freeze({ kind: "RejectedContentHashMismatch" });
  return Object.freeze({ kind: "Accepted", bundle: validated });
};
