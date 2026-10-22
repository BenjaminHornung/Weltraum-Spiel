import type { AlgorithmVersion, ByteCount, ContentRevision, PlanningEpoch, WorkerEpoch, WorkerJobId, WorkerTargetKey } from "./ids";
import {
  fnv1aBytes,
  validateHestiaVoxelWorkerOutput,
  validateTransferableBundle,
  type GenerateHestiaVoxelBrickMeshPayload,
  type TransferableBufferBundle,
  type WorkerJobResult,
} from "./protocol";
import {fnv1aBytesSteps,HVP_BODY_CUT_MAX_OUTPUT} from "./hvpBodyCutWire";

export interface WorkerResultExpectation {
  readonly jobId: WorkerJobId;
  readonly cancelled: boolean;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly targetKey: WorkerTargetKey;
  readonly inputRevision: ContentRevision;
  readonly sourceInputDigest?: string;
  readonly outputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly maximumOutputBytes: ByteCount;
  readonly expectedContentHash?: string;
  readonly expectedHestiaPayload?: GenerateHestiaVoxelBrickMeshPayload;
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
  | { readonly kind: "RejectedSourceInputDigestMismatch" }
  | { readonly kind: "RejectedContentHashMismatch" };

const validateWorkerResultHeader = (
  expectation: WorkerResultExpectation | undefined,
  result: WorkerJobResult,
  bundle: TransferableBufferBundle,
  privateChannels?:1|2|6|7|8,
): WorkerResultIntegrationDecision => {
  if (!expectation || expectation.jobId !== result.jobId) return Object.freeze({ kind: "RejectedUnknownJob" });
  if (expectation.cancelled) return Object.freeze({ kind: "RejectedCancelled" });
  if (expectation.planningEpoch !== result.planningEpoch) return Object.freeze({ kind: "RejectedStalePlanningEpoch" });
  if (expectation.workerEpoch !== result.workerEpoch) return Object.freeze({ kind: "RejectedStaleWorkerEpoch" });
  if (expectation.targetKey !== result.targetKey) return Object.freeze({ kind: "RejectedTargetMismatch" });
  if (expectation.inputRevision !== result.inputRevision || expectation.outputRevision !== result.outputRevision) return Object.freeze({ kind: "RejectedRevisionMismatch" });
  if (expectation.sourceInputDigest !== result.sourceInputDigest) return Object.freeze({ kind: "RejectedSourceInputDigestMismatch" });
  let bundleRevision: unknown;
  try { bundleRevision = typeof bundle === "object" && bundle !== null ? (bundle as { readonly revision?: unknown }).revision : undefined; }
  catch { return Object.freeze({ kind: "RejectedInvalidLayout", message: "Invalid output bundle envelope." }); }
  if (typeof bundleRevision !== "number" || !Number.isSafeInteger(bundleRevision) || bundleRevision < 0) return Object.freeze({ kind: "RejectedInvalidLayout", message: "Invalid output bundle revision." });
  if (bundleRevision !== result.outputRevision) return Object.freeze({ kind: "RejectedRevisionMismatch" });
  if (expectation.algorithmVersion !== result.algorithmVersion) return Object.freeze({ kind: "RejectedAlgorithmMismatch" });
  let validated: TransferableBufferBundle;
  try {
    if(privateChannels!==undefined&&(!Array.isArray(bundle.buffers)||bundle.buffers.length!==privateChannels||!Array.isArray(bundle.views)||bundle.views.length!==privateChannels)) {
      throw new Error("Invalid body-mesh output channel count.");
    }
    validated = validateTransferableBundle(bundle);
  }
  catch (error) { return Object.freeze({ kind: "RejectedInvalidLayout", message: error instanceof Error ? error.message : "Invalid output layout." }); }
  if (validated.ownership !== "WorkerToConsumer") return Object.freeze({ kind: "RejectedInvalidLayout", message: "Output bundle ownership must be WorkerToConsumer." });
  if (validated.byteLength !== result.outputBytes || validated.byteLength > expectation.maximumOutputBytes) return Object.freeze({ kind: "RejectedOverBudget" });
  return {kind:"Accepted",bundle:validated};
};

const finishWorkerResult = (expectation:WorkerResultExpectation,result:WorkerJobResult,
  validated:TransferableBufferBundle,actualHash:string):WorkerResultIntegrationDecision => {
  if ((expectation.expectedContentHash !== undefined && actualHash !== expectation.expectedContentHash)
    || (result.contentHash !== undefined && actualHash !== result.contentHash)
    || (validated.contentHash !== undefined && actualHash !== validated.contentHash)) return Object.freeze({ kind: "RejectedContentHashMismatch" });
  if (expectation.expectedHestiaPayload !== undefined) {
    try { validateHestiaVoxelWorkerOutput(expectation.expectedHestiaPayload, result, validated); }
    catch (error) { return Object.freeze({ kind: "RejectedInvalidLayout", message: error instanceof Error ? error.message : "Invalid Hestia voxel output." }); }
  }
  return Object.freeze({ kind: "Accepted", bundle: validated });
};

export const integrateWorkerResult = (
  expectation:WorkerResultExpectation|undefined,result:WorkerJobResult,bundle:TransferableBufferBundle
):WorkerResultIntegrationDecision => {
  const header=validateWorkerResultHeader(expectation,result,bundle);
  if(header.kind!=="Accepted") return header;
  return finishWorkerResult(expectation!,result,header.bundle,fnv1aBytes(header.bundle.buffers));
};

/** Private module-only body route; the owning pool keeps buffers exclusive through every yield. */
export function* integrateBodyMeshWorkerResultSteps(
  expectation:WorkerResultExpectation|undefined,result:WorkerJobResult,bundle:TransferableBufferBundle
):Generator<string,WorkerResultIntegrationDecision,unknown> {
  const header=validateWorkerResultHeader(expectation,result,bundle,7);
  if(header.kind!=="Accepted") return header;
  if(header.bundle.byteLength>HVP_BODY_CUT_MAX_OUTPUT) return Object.freeze({kind:"RejectedOverBudget"});
  const hash=yield* fnv1aBytesSteps(header.bundle.buffers);
  return finishWorkerResult(expectation!,result,header.bundle,hash);
}

/** Same header/hash gate for an exclusive support result; schema admission follows in its owning pool. */
export function* integrateHvpSupportWorkerResultSteps(
  expectation:WorkerResultExpectation|undefined,result:WorkerJobResult,bundle:TransferableBufferBundle
):Generator<string,WorkerResultIntegrationDecision,unknown>{
  const header=validateWorkerResultHeader(expectation,result,bundle,1);
  if(header.kind!=="Accepted"){return header;}
  if(header.bundle.byteLength>HVP_BODY_CUT_MAX_OUTPUT){return Object.freeze({kind:"RejectedOverBudget"});}
  return finishWorkerResult(expectation!,result,header.bundle,yield* fnv1aBytesSteps(header.bundle.buffers));
}
export function* integrateHvpDerivativeWorkerResultSteps(expectation:WorkerResultExpectation|undefined,result:WorkerJobResult,
  bundle:TransferableBufferBundle,channels:2|6|8):Generator<string,WorkerResultIntegrationDecision,unknown>{
  const header=validateWorkerResultHeader(expectation,result,bundle,channels);if(header.kind!=="Accepted"){return header;}
  if(header.bundle.byteLength>HVP_BODY_CUT_MAX_OUTPUT){return Object.freeze({kind:"RejectedOverBudget"});}
  return finishWorkerResult(expectation!,result,header.bundle,yield* fnv1aBytesSteps(header.bundle.buffers));
}
