import { fnv1aHash, stableStringify } from "../core/hash";
import { fnv1aBytes, type GenerateHestiaVoxelBrickMeshPayload, type TransferableBufferBundle, type WorkerJobResult, type WorkerJobTerminal } from "../workers";
import { type ContentKey } from "../streaming";
import { type ResidencyState } from "../streaming/residency";
import type { AlgorithmVersion, ContentRevision, PlanningEpoch, WorkerEpoch, WorkerJobId, WorkerTargetKey } from "../workers/ids";

export interface SurfaceLabWorkerAdoptionExpectation {
  readonly authorityEpoch: number;
  readonly jobId: WorkerJobId;
  readonly planningEpoch: PlanningEpoch;
  readonly workerEpoch: WorkerEpoch;
  readonly targetKey: WorkerTargetKey;
  readonly inputRevision: ContentRevision;
  readonly outputRevision: ContentRevision;
  readonly algorithmVersion: AlgorithmVersion;
  readonly sourceInputDigest: string;
  readonly cacheKey?: ContentKey;
}

export interface SurfaceLabWorkerAdoptionContext {
  readonly currentAuthorityEpoch: number;
  readonly residency: ResidencyState;
  readonly sourceResidency: ResidencyState;
  readonly consumed: boolean;
  readonly cacheResident: boolean;
  readonly poolAccepted: boolean;
}

export type SurfaceLabWorkerAdoptionRejectionCode =
  | "RejectedUnknownJob"
  | "RejectedDuplicateDelivery"
  | "RejectedStaleAuthorityEpoch"
  | "RejectedCancelled"
  | "RejectedTerminalFailure"
  | "RejectedForeignJob"
  | "RejectedStalePlanningEpoch"
  | "RejectedStaleWorkerEpoch"
  | "RejectedTargetMismatch"
  | "RejectedRevisionMismatch"
  | "RejectedAlgorithmMismatch"
  | "RejectedSourceInputDigestMismatch"
  | "RejectedEvictedResidency"
  | "RejectedUnknownPoolTerminal"
  | "RejectedInvalidLayout"
  | "RejectedOverBudget"
  | "RejectedContentHashMismatch";

export type SurfaceLabWorkerAdoptionDecision =
  | { readonly kind: "Accepted" }
  | { readonly kind: SurfaceLabWorkerAdoptionRejectionCode };

const reject = (kind: SurfaceLabWorkerAdoptionRejectionCode): SurfaceLabWorkerAdoptionDecision => Object.freeze({ kind });

/** Stable identity of the source and input that produced one Surface Lab job. */
export const createSurfaceLabSourceInputDigest = (
  payload: GenerateHestiaVoxelBrickMeshPayload,
  input: TransferableBufferBundle
): string => fnv1aHash(stableStringify({
  presetId: payload.presetId,
  inputMode: payload.inputMode,
  rootSeed: payload.rootSeed,
  bodyId: payload.bodyId,
  surfaceFrameId: payload.surfaceFrameId,
  regionId: payload.regionId,
  brickCoordinate: payload.brickCoordinate,
  voxelSizeMeters: payload.voxelSizeMeters,
  generatorVersion: payload.generatorVersion,
  materialRegistryVersion: payload.materialRegistryVersion,
  sourceRevision: payload.sourceRevision,
  editRevision: payload.editRevision,
  meshAlgorithmVersion: payload.meshAlgorithmVersion,
  cachedBrickContentHash: payload.cachedBrickContentHash ?? null,
  inputRevision: input.revision,
  inputByteLength: input.byteLength,
  inputContentHash: input.contentHash ?? fnv1aBytes(input.buffers)
}));

export const createSurfaceLabWorkerAdoptionExpectation = (value: SurfaceLabWorkerAdoptionExpectation): SurfaceLabWorkerAdoptionExpectation =>
  Object.freeze({ ...value });

const decisionForFailedTerminal = (terminal: Extract<WorkerJobTerminal, { readonly kind: "Failed" }>): SurfaceLabWorkerAdoptionDecision => {
  switch (terminal.integrationDecision?.kind) {
    case "RejectedUnknownJob": return reject("RejectedUnknownPoolTerminal");
    case "RejectedCancelled": return reject("RejectedCancelled");
    case "RejectedStalePlanningEpoch": return reject("RejectedStalePlanningEpoch");
    case "RejectedStaleWorkerEpoch": return reject("RejectedStaleWorkerEpoch");
    case "RejectedTargetMismatch": return reject("RejectedTargetMismatch");
    case "RejectedRevisionMismatch": return reject("RejectedRevisionMismatch");
    case "RejectedAlgorithmMismatch": return reject("RejectedAlgorithmMismatch");
    case "RejectedSourceInputDigestMismatch": return reject("RejectedSourceInputDigestMismatch");
    case "RejectedInvalidLayout": return reject("RejectedInvalidLayout");
    case "RejectedOverBudget": return reject("RejectedOverBudget");
    case "RejectedContentHashMismatch": return reject("RejectedContentHashMismatch");
    default: return reject("RejectedTerminalFailure");
  }
};

export const decideSurfaceLabWorkerAdoption = (
  expectation: SurfaceLabWorkerAdoptionExpectation | undefined,
  terminal: WorkerJobTerminal,
  context: SurfaceLabWorkerAdoptionContext
): SurfaceLabWorkerAdoptionDecision => {
  if (expectation === undefined) return reject("RejectedUnknownJob");
  if (context.consumed) return reject("RejectedDuplicateDelivery");
  if (expectation.authorityEpoch !== context.currentAuthorityEpoch) return reject("RejectedStaleAuthorityEpoch");
  if (terminal.kind === "Failed") return decisionForFailedTerminal(terminal);
  if (context.residency === "Cancelled" || terminal.kind === "Cancelled") return reject("RejectedCancelled");
  if (context.residency === "Evicted" || context.sourceResidency === "Evicted"
    || expectation.cacheKey !== undefined && !context.cacheResident) return reject("RejectedEvictedResidency");
  if (!context.poolAccepted) return reject("RejectedUnknownPoolTerminal");

  const result: WorkerJobResult = terminal.result;
  if (result.jobId !== expectation.jobId) return reject("RejectedForeignJob");
  if (result.planningEpoch !== expectation.planningEpoch) return reject("RejectedStalePlanningEpoch");
  if (result.workerEpoch !== expectation.workerEpoch) return reject("RejectedStaleWorkerEpoch");
  if (result.targetKey !== expectation.targetKey) return reject("RejectedTargetMismatch");
  if (result.inputRevision !== expectation.inputRevision || result.outputRevision !== expectation.outputRevision) {
    return reject("RejectedRevisionMismatch");
  }
  if (result.algorithmVersion !== expectation.algorithmVersion) return reject("RejectedAlgorithmMismatch");
  if (result.sourceInputDigest !== expectation.sourceInputDigest) return reject("RejectedSourceInputDigestMismatch");
  return Object.freeze({ kind: "Accepted" });
};
