import {
  algorithmVersion,
  byteCount,
  contentRevision,
  jobDeadline,
  PREPARED_STRUCTURAL_FIRE_JOB_KIND,
  planningEpoch,
  safeNonNegativeInteger,
  stableAsciiId,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobResult
} from "../../workers";
import { fnv1aBytes, snapshotWorkerJobRequest, validateTransferableBundle } from "../../workers/protocol";
import {
  canonicalAdaptiveJson,
  hashAdaptiveCanonical
} from "../../voxel/adaptive/canonical";
import type {
  PreparedStructuralFireCommand as PreparedStructuralFireCommandV2,
  PreparedStructuralFireHash,
  PreparedStructuralFirePageEnvelope,
  PreparedStructuralFireReady,
  PreparedStructuralFireRequest as PreparedStructuralFireRequestV2,
  PreparedStructuralFireSeedManifest,
  PreparedStructuralFireSeedViewName
} from "./preparedStructuralFireWire";

export const PREPARED_STRUCTURAL_FIRE_JOB_SCHEMA_VERSION =
  "prepared-structural-fire-job-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION =
  "prepared-structural-fire-result-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION =
  "prepared-structural-fire-input-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION =
  "prepared-structural-fire-result-transfer-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION = 1 as const;
export const PREPARED_STRUCTURAL_FIRE_MAX_CONTINUATION_INPUT_BYTES = 4096 as const;
export const PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION =
  "prepared-structural-fire-private-worker-control-v2" as const;

export interface PreparedStructuralFireBindSeedControl {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION;
  readonly kind: "BindSeed";
  readonly workerEpoch: number;
  readonly request: Readonly<PreparedStructuralFireRequestV2>;
  readonly manifest: Readonly<PreparedStructuralFireSeedManifest>;
}

export interface PreparedStructuralFireExecuteCommandControl {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION;
  readonly kind: "ExecuteCommand";
  readonly workerEpoch: number;
  readonly request: Readonly<PreparedStructuralFireRequestV2>;
  readonly command: Readonly<PreparedStructuralFireCommandV2>;
  readonly dispatchIndex: number;
  readonly attemptIndex: number;
  readonly previousChainHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireReleaseSeedControl {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION;
  readonly kind: "ReleaseSeed";
  readonly workerEpoch: number;
  readonly seedHash: PreparedStructuralFireHash;
}

export type PreparedStructuralFirePrivateDiagnosticPhase = "WarmSeed" | "Fire";
export type PreparedStructuralFirePrivateDiagnosticStatus =
  | "Queued"
  | "Running"
  | "Completed"
  | "ReadyToAdopt"
  | "Deferred"
  | "Failed"
  | "Cancelled"
  | "Stale";

export interface PreparedStructuralFirePrivateMainDiagnostics {
  readonly clockDomain: "Main";
  readonly prepareSeedStartAtMilliseconds: number | null;
  readonly prepareSeedPostStartAtMilliseconds: number | null;
  readonly prepareSeedPostEndAtMilliseconds: number | null;
  readonly seedPreparedReceiptAtMilliseconds: number | null;
  readonly seedValidationCompleteAtMilliseconds: number | null;
  readonly prepareSeedEndAtMilliseconds: number | null;
  readonly prepareSeedDurationMilliseconds: number | null;
  readonly prepareSeedPostDurationMilliseconds: number | null;
  readonly seedValidationDurationMilliseconds: number | null;
  readonly executePostStartAtMilliseconds: number | null;
  readonly executePostReturnedAtMilliseconds: number | null;
  readonly firstResultOrReadyReceiptAtMilliseconds: number | null;
  readonly executeReadyReceiptAtMilliseconds: number | null;
  readonly executeValidationCompleteAtMilliseconds: number | null;
  readonly executePostDurationMilliseconds: number | null;
  readonly executeReceiptToValidationDurationMilliseconds: number | null;
}

export interface PreparedStructuralFirePrivateWorkerOperationDiagnostics {
  readonly receiptAtMilliseconds: number | null;
  readonly computeStartedAtMilliseconds: number | null;
  readonly computeCompletedAtMilliseconds: number | null;
  readonly computeDurationMilliseconds: number | null;
}

export interface PreparedStructuralFirePrivateWorkerDiagnosticSpan {
  readonly startAtMilliseconds: number | null;
  readonly endAtMilliseconds: number | null;
  readonly durationMilliseconds: number | null;
}

export interface PreparedStructuralFirePrivateWorkerConnectivityFacts {
  readonly mode: "Full" | "RevisionOnly" | "TopologyRetained" | "DeletionFrontier";
  readonly candidateCellCount: number;
  readonly sourceBrickCount: number;
  readonly rebuiltBrickCount: number;
  readonly reusedBrickCount: number;
  readonly removedCellCount: number;
  readonly fullVoxelTraversalCount: number;
  readonly frontierVisitedCellCount: number;
  readonly coordinateNeighborProbeCount: number;
  readonly indexedActiveCellVisitCount: number;
  readonly cachedAdjacencyProbeCount: number;
}

export interface PreparedStructuralFirePrivateWorkerCollisionFacts {
  readonly mode: "Full" | "Incremental";
  readonly sourceBrickCount: number;
  readonly changedBrickCount: number;
  readonly recomputedCellCount: number;
  readonly reusedCellCount: number;
  readonly invalidatedCellCount: number;
  readonly materializationOperationCount: number;
  readonly canonicalHashCellCount: number;
}

export interface PreparedStructuralFirePrivateWorkerPrepareSeedFacts {
  readonly authority: Readonly<{
    readonly brickCount: number;
    readonly occupiedCellCount: number;
    readonly anchorCount: number;
    readonly jointCount: number;
  }> | null;
  readonly connectivity: Readonly<PreparedStructuralFirePrivateWorkerConnectivityFacts> | null;
  readonly mass: Readonly<{ readonly occupiedVoxelCount: number }> | null;
  readonly collision: Readonly<PreparedStructuralFirePrivateWorkerCollisionFacts> | null;
  readonly physics: Readonly<{
    readonly terrainColliderCount: number;
    readonly bodyCount: number;
  }>;
  readonly colliderDerivation: "NotApplicableBodyFreeSeed";
}

export type PreparedStructuralFirePrivateWorkerPrepareSeedStage =
  | "constructSeed"
  | "materializeAndRetainPages"
  | "bindSeed"
  | "treeAndObjectCanonicalValidation"
  | "structuralConnectivity"
  | "structuralMass"
  | "authorityPublicationAndFinalCompare"
  | "collisionCanonicalValidation"
  | "collisionPublicationAndIndex";

export interface PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver {
  start(stage: PreparedStructuralFirePrivateWorkerPrepareSeedStage): void;
  finish(
    stage: PreparedStructuralFirePrivateWorkerPrepareSeedStage,
    facts?: Readonly<{
      readonly authority?: Readonly<{
        readonly brickCount: number;
        readonly occupiedCellCount: number;
        readonly anchorCount: number;
        readonly jointCount: number;
      }>;
      readonly connectivity?: Readonly<PreparedStructuralFirePrivateWorkerConnectivityFacts>;
      readonly mass?: Readonly<{ readonly occupiedVoxelCount: number }>;
      readonly collision?: Readonly<PreparedStructuralFirePrivateWorkerCollisionFacts>;
    }>
  ): void;
  startView(logicalViewName: PreparedStructuralFireSeedViewName): void;
  finishView(logicalViewName: PreparedStructuralFireSeedViewName): void;
}

export interface PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics {
  readonly constructSeed: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
  readonly materializeAndRetainPages: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
  readonly bindSeed: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
  readonly views: readonly Readonly<{
    readonly logicalViewName: PreparedStructuralFireSeedViewName;
    readonly itemCount: number | null;
    readonly byteLength: number | null;
    readonly pageCount: number | null;
    readonly decodeDurationMilliseconds: number | null;
  }>[];
  readonly authority: Readonly<{
    readonly treeAndObjectCanonicalValidation: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
    readonly structuralConnectivity: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
    readonly structuralMass: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
    readonly authorityPublicationAndFinalCompare: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
  }>;
  readonly collision: Readonly<{
    readonly collisionCanonicalValidation: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
    readonly collisionPublicationAndIndex: Readonly<PreparedStructuralFirePrivateWorkerDiagnosticSpan>;
  }>;
  readonly facts: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedFacts>;
}

export interface PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics
  extends PreparedStructuralFirePrivateWorkerOperationDiagnostics,
    PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics {}

export interface PreparedStructuralFirePrivateWorkerDiagnostics {
  readonly clockDomain: "Worker";
  readonly prepareSeed: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics> | null;
  readonly execute: Readonly<PreparedStructuralFirePrivateWorkerOperationDiagnostics> | null;
}

export interface PreparedStructuralFirePrivateBoundaryDiagnostics {
  readonly rootJobId: string | null;
  readonly workerEpoch: number | null;
  readonly main: Readonly<PreparedStructuralFirePrivateMainDiagnostics>;
  readonly worker: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null;
  /** Sum of manifest descriptor byteLength values; not structured-clone transport bytes. */
  readonly seedCanonicalBytes: number | null;
  /** Sum of manifest descriptor byteLength values; not structured-clone transport bytes. */
  readonly resultCanonicalBytes: number | null;
  readonly structuredCloneBytes: null;
}

export interface PreparedStructuralFirePrivateRuntimeDiagnostics {
  readonly clockDomain: "Main";
  readonly inputAcceptedAtMilliseconds: number | null;
  readonly queuedAtMilliseconds: number | null;
  readonly runningAtMilliseconds: number | null;
  readonly workerPreparationStateStartAtMilliseconds: number | null;
  readonly workerPreparationStateEndAtMilliseconds: number | null;
  readonly readyToAdoptAtMilliseconds: number | null;
  readonly prewarmStartAtMilliseconds: number | null;
  readonly prewarmWorkerPreparationStateStartAtMilliseconds: number | null;
  readonly prewarmWorkerPreparationStateEndAtMilliseconds: number | null;
  readonly prewarmEndAtMilliseconds: number | null;
  readonly queueWaitDurationMilliseconds: number | null;
  readonly workerPreparationStateDurationMilliseconds: number | null;
  readonly fireDurationMilliseconds: number | null;
  readonly prewarmWorkerPreparationStateDurationMilliseconds: number | null;
  readonly prewarmDurationMilliseconds: number | null;
}

export interface PreparedStructuralFirePrivateDiagnosticTrace {
  readonly phase: PreparedStructuralFirePrivateDiagnosticPhase;
  readonly status: PreparedStructuralFirePrivateDiagnosticStatus;
  readonly reason: string | null;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceEditRevision: number;
  readonly sourceContentHash: string;
  readonly rootJobId: string | null;
  readonly workerEpoch: number | null;
  readonly runtime: Readonly<PreparedStructuralFirePrivateRuntimeDiagnostics>;
  readonly main: Readonly<PreparedStructuralFirePrivateMainDiagnostics>;
  readonly worker: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null;
  readonly seedCanonicalBytes: number | null;
  readonly resultCanonicalBytes: number | null;
  readonly structuredCloneBytes: null;
  readonly canonicalBytesBasis: "ManifestDescriptorByteLengthSum";
  readonly publication: Readonly<{
    readonly status: "Unavailable";
    readonly atMilliseconds: null;
  }>;
}

export type PreparedStructuralFirePrivateWorkerOutput =
  | Readonly<{
      readonly kind: "PreparedResultPage";
      readonly envelope: Readonly<PreparedStructuralFirePageEnvelope>;
    }>
  | Readonly<{
      readonly kind: "Ready";
      readonly ready: Readonly<PreparedStructuralFireReady>;
    }>;
export const PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS = [
  "ExactBoxes",
  "SparseBoxes",
  "HierarchicalBounds",
  "AdaptiveCoarse"
] as const;
export type PreparedStructuralFirePhysicsRepresentationLevel =
  (typeof PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS)[number];
export type PreparedStructuralFireAdaptationReason =
  | "None"
  | "ColliderBudget"
  | "ContactBudget"
  | "SubstepBudget";

export interface PreparedStructuralFireWorkBudgets {
  readonly maxVisitedBricks: number;
  readonly maxVisitedCells: number;
  readonly maxConnectivityFacts: number;
  readonly maxComponents: number;
  readonly maxMassCells: number;
}

export interface PreparedStructuralFireBudgets {
  readonly maxInputBytes: number;
  readonly maxResultBytes: number;
  readonly maxResultCount: number;
  readonly maxChangedBricks: number;
  readonly maxChangedCells: number;
  readonly maxDetachedComponents: number;
  readonly work: Readonly<PreparedStructuralFireWorkBudgets>;
}

export interface PreparedStructuralFirePayloadDescriptor {
  readonly ownership: "CallerToSchedulerToWorker";
  readonly layoutVersion: typeof PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION;
  readonly byteLength: number;
  readonly bufferCount: number;
  readonly contentHash: string;
  readonly inputCommitmentHash: string;
}

export interface PreparedStructuralFireContinuation {
  readonly rootJobId: string;
  readonly batchIndex: number;
  readonly attemptIndex: number;
  readonly tokenHash: string | null;
  readonly chainHash: string | null;
  readonly completedUnits: number;
  readonly totalUnits: number | null;
  readonly physicsRepresentationLevel:
    PreparedStructuralFirePhysicsRepresentationLevel | null;
}

export interface PreparedStructuralFirePhysicsRepresentationPolicy {
  readonly authorityResolution: "ExactStructural";
  readonly levels: readonly PreparedStructuralFirePhysicsRepresentationLevel[];
}

export interface PreparedStructuralFireJob {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_JOB_SCHEMA_VERSION;
  readonly kind: typeof PREPARED_STRUCTURAL_FIRE_JOB_KIND;
  readonly jobId: string;
  readonly algorithmVersion: typeof PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION;
  readonly inputLayoutVersion: typeof PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION;
  readonly resultLayoutVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION;
  readonly objectId: string;
  readonly expectedObjectRevision: number;
  readonly expectedEditRevision: number;
  readonly contentHash: string;
  readonly fireCommandId: string;
  readonly structuralCommandId: string;
  readonly activationTick: number;
  readonly deadlineTick: number;
  readonly continuation: Readonly<PreparedStructuralFireContinuation>;
  readonly physicsRepresentationPolicy:
    Readonly<PreparedStructuralFirePhysicsRepresentationPolicy>;
  readonly budgets: Readonly<PreparedStructuralFireBudgets>;
  readonly payload: Readonly<PreparedStructuralFirePayloadDescriptor>;
}

export interface PreparedStructuralFireWorkCounters {
  readonly visitedBricks: number;
  readonly visitedCells: number;
  readonly connectivityFacts: number;
  readonly components: number;
  readonly massCells: number;
}

export type PreparedStructuralFireWorkProgress =
  | Readonly<{ readonly status: "Unavailable" }>
  | Readonly<{
      readonly status: "Available";
      readonly completedUnits: number;
      readonly totalUnits: number;
    }>;

export interface PreparedStructuralFireResultDetails {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION;
  readonly kind: "PreparedStructuralFireResult";
  readonly layoutVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION;
  readonly algorithmVersion: typeof PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION;
  readonly jobId: string;
  readonly rootJobId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceEditRevision: number;
  readonly sourceContentHash: string;
  readonly inputCommitmentHash: string;
  readonly fireCommandId: string;
  readonly structuralCommandId: string;
  readonly activationTick: number;
  readonly deadlineTick: number;
  readonly authorityResolution: "ExactStructural";
  readonly physicsRepresentationLevel: PreparedStructuralFirePhysicsRepresentationLevel;
  readonly adaptationReason: PreparedStructuralFireAdaptationReason;
  readonly status: "Applied" | "NoChange" | "ContinuationRequired";
  readonly resultingObjectRevision: number;
  readonly resultingEditRevision: number;
  readonly resultingContentHash: string;
  readonly changedBrickCount: number;
  readonly changedCellCount: number;
  readonly detachedComponentCount: number;
  readonly resultCount: number;
  readonly resultBytes: number;
  readonly work: Readonly<PreparedStructuralFireWorkCounters>;
  readonly workProgress: PreparedStructuralFireWorkProgress;
  /** Transport-continuation receipt only. It must never drive user-visible loading progress. */
  readonly progress: Readonly<{
    readonly completedUnits: number;
    readonly totalUnits: number;
    readonly nextBatchIndex: number | null;
    readonly continuationTokenHash: string | null;
    readonly chainHash: string;
  }>;
  readonly transferHash: string;
  readonly manifestHash: string;
  readonly receiptHash: string;
}

export type PreparedStructuralFireResultDraft = Omit<
  PreparedStructuralFireResultDetails,
  "transferHash" | "manifestHash" | "receiptHash" | "progress"
> & Readonly<{
  readonly progress: Readonly<{
    readonly completedUnits: number;
    readonly totalUnits: number;
    readonly nextBatchIndex: number | null;
  }>;
}>;

export interface PreparedStructuralFireResultEnvelope {
  readonly workerResult: WorkerJobResult;
  readonly details: Readonly<PreparedStructuralFireResultDetails>;
  readonly bundle: TransferableBufferBundle;
  readonly consumedInput: TransferableBufferBundle;
}

const positiveSafeInteger = (value: number, field: string): number => {
  const parsed = safeNonNegativeInteger<number>(value, field);
  if (parsed === 0) throw new RangeError(`${field} must be positive.`);
  return parsed;
};

export const preparedStructuralFireBatchJobId = (
  rootJobIdValue: string,
  batchIndexValue: number,
  attemptIndexValue: number
): string => {
  const rootJobId = stableAsciiId<string>(rootJobIdValue, "rootJobId", 192);
  const batchIndex = safeNonNegativeInteger(batchIndexValue, "batchIndex");
  const attemptIndex = safeNonNegativeInteger(attemptIndexValue, "attemptIndex");
  return batchIndex === 0 && attemptIndex === 0
    ? workerJobId(rootJobId)
    : workerJobId(`${rootJobId}:batch:${batchIndex}:attempt:${attemptIndex}`);
};

const immutableWorkBudgets = (
  source: Readonly<PreparedStructuralFireWorkBudgets>
): Readonly<PreparedStructuralFireWorkBudgets> => Object.freeze({
  maxVisitedBricks: safeNonNegativeInteger(source.maxVisitedBricks, "maxVisitedBricks"),
  maxVisitedCells: safeNonNegativeInteger(source.maxVisitedCells, "maxVisitedCells"),
  maxConnectivityFacts: safeNonNegativeInteger(source.maxConnectivityFacts, "maxConnectivityFacts"),
  maxComponents: safeNonNegativeInteger(source.maxComponents, "maxComponents"),
  maxMassCells: safeNonNegativeInteger(source.maxMassCells, "maxMassCells")
});

const immutableBudgets = (
  source: Readonly<PreparedStructuralFireBudgets>
): Readonly<PreparedStructuralFireBudgets> => Object.freeze({
  maxInputBytes: positiveSafeInteger(source.maxInputBytes, "maxInputBytes"),
  maxResultBytes: positiveSafeInteger(source.maxResultBytes, "maxResultBytes"),
  maxResultCount: safeNonNegativeInteger(source.maxResultCount, "maxResultCount"),
  maxChangedBricks: safeNonNegativeInteger(source.maxChangedBricks, "maxChangedBricks"),
  maxChangedCells: safeNonNegativeInteger(source.maxChangedCells, "maxChangedCells"),
  maxDetachedComponents: safeNonNegativeInteger(
    source.maxDetachedComponents,
    "maxDetachedComponents"
  ),
  work: immutableWorkBudgets(source.work)
});

export const preparedStructuralFireInputCommitmentHash = (
  source: TransferableBufferBundle
): string => {
  const bundle = validateTransferableBundle(source);
  const metadata = new TextEncoder().encode(canonicalAdaptiveJson({
    schemaVersion: "prepared-structural-fire-input-commitment-v1",
    revision: bundle.revision,
    byteLength: bundle.byteLength,
    bufferByteLengths: Object.freeze(bundle.buffers.map((buffer) => buffer.byteLength)),
    views: Object.freeze(bundle.views.map((view) => Object.freeze({
      name: view.name,
      bufferIndex: view.bufferIndex,
      kind: view.kind,
      byteOffset: view.byteOffset,
      elementCount: view.elementCount
    })))
  }));
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  const update = (byte: number): void => {
    low = (low ^ byte) >>> 0;
    const lowProduct = low * 0x1b3;
    const nextLow = lowProduct >>> 0;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    const nextHigh = (high * 0x1b3 + carry) >>> 0;
    high = (nextHigh + ((low << 8) >>> 0)) >>> 0;
    low = nextLow;
  };
  for (const byte of metadata) update(byte);
  for (const buffer of bundle.buffers) {
    for (const byte of new Uint8Array(buffer)) update(byte);
  }
  return `fnv1a64-v1:${high.toString(16).padStart(8, "0")}${low
    .toString(16)
    .padStart(8, "0")}`;
};

export const preparedStructuralFireInputsEqual = (
  leftValue: TransferableBufferBundle,
  rightValue: TransferableBufferBundle
): boolean => {
  const left = validateTransferableBundle(leftValue);
  const right = validateTransferableBundle(rightValue);
  if (left.ownership !== right.ownership
    || left.revision !== right.revision
    || left.byteLength !== right.byteLength
    || left.buffers.length !== right.buffers.length
    || left.views.length !== right.views.length) {
    return false;
  }
  for (let index = 0; index < left.views.length; index += 1) {
    const leftView = left.views[index];
    const rightView = right.views[index];
    if (leftView.name !== rightView.name
      || leftView.bufferIndex !== rightView.bufferIndex
      || leftView.kind !== rightView.kind
      || leftView.byteOffset !== rightView.byteOffset
      || leftView.elementCount !== rightView.elementCount) {
      return false;
    }
  }
  for (let bufferIndex = 0; bufferIndex < left.buffers.length; bufferIndex += 1) {
    const leftBytes = new Uint8Array(left.buffers[bufferIndex]);
    const rightBytes = new Uint8Array(right.buffers[bufferIndex]);
    if (leftBytes.byteLength !== rightBytes.byteLength) return false;
    for (let byteIndex = 0; byteIndex < leftBytes.byteLength; byteIndex += 1) {
      if (leftBytes[byteIndex] !== rightBytes[byteIndex]) return false;
    }
  }
  return true;
};

export const createPreparedStructuralFireJob = (
  source: Readonly<PreparedStructuralFireJob>
): PreparedStructuralFireJob => {
  if (source.schemaVersion !== PREPARED_STRUCTURAL_FIRE_JOB_SCHEMA_VERSION) {
    throw new RangeError("Prepared Structural Fire job schemaVersion is invalid.");
  }
  if (source.kind !== "PreparedStructuralFire") {
    throw new RangeError("Prepared Structural Fire job kind is invalid.");
  }
  if (source.algorithmVersion !== PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION) {
    throw new RangeError("Prepared Structural Fire algorithmVersion is invalid.");
  }
  if (source.inputLayoutVersion !== PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION
    || source.resultLayoutVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION) {
    throw new RangeError("Prepared Structural Fire layout version is invalid.");
  }
  if (source.payload.ownership !== "CallerToSchedulerToWorker"
    || source.payload.layoutVersion !== PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION) {
    throw new RangeError("Prepared Structural Fire payload ownership or layout is invalid.");
  }
  const budgets = immutableBudgets(source.budgets);
  const payload = Object.freeze({
    ownership: source.payload.ownership,
    layoutVersion: source.payload.layoutVersion,
    byteLength: positiveSafeInteger(source.payload.byteLength, "payload.byteLength"),
    bufferCount: positiveSafeInteger(source.payload.bufferCount, "payload.bufferCount"),
    contentHash: stableAsciiId<string>(source.payload.contentHash, "payload.contentHash", 128),
    inputCommitmentHash: stableAsciiId<string>(
      source.payload.inputCommitmentHash,
      "payload.inputCommitmentHash",
      128
    )
  });
  const activationTick = safeNonNegativeInteger(source.activationTick, "activationTick");
  const deadlineTick = safeNonNegativeInteger(source.deadlineTick, "deadlineTick");
  if (deadlineTick < activationTick) {
    throw new RangeError("Prepared Structural Fire deadlineTick cannot precede activationTick.");
  }
  const rootJobId = stableAsciiId<string>(
    source.continuation.rootJobId,
    "continuation.rootJobId",
    192
  );
  const batchIndex = safeNonNegativeInteger(source.continuation.batchIndex, "batchIndex");
  const attemptIndex = safeNonNegativeInteger(
    source.continuation.attemptIndex,
    "attemptIndex"
  );
  const tokenHash = source.continuation.tokenHash === null
    ? null
    : stableAsciiId<string>(source.continuation.tokenHash, "continuation.tokenHash", 128);
  const chainHash = source.continuation.chainHash === null
    ? null
    : stableAsciiId<string>(source.continuation.chainHash, "continuation.chainHash", 128);
  const completedUnits = safeNonNegativeInteger(
    source.continuation.completedUnits,
    "continuation.completedUnits"
  );
  const totalUnits = source.continuation.totalUnits === null
    ? null
    : safeNonNegativeInteger(source.continuation.totalUnits, "continuation.totalUnits");
  const previousRepresentation = source.continuation.physicsRepresentationLevel;
  const maximumInputBytes = batchIndex === 0
    ? budgets.maxInputBytes
    : PREPARED_STRUCTURAL_FIRE_MAX_CONTINUATION_INPUT_BYTES;
  if (payload.byteLength > maximumInputBytes) {
    throw new RangeError("Prepared Structural Fire payload exceeds its batch input budget.");
  }
  if (previousRepresentation !== null
    && !PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS.includes(
      previousRepresentation
    )) {
    throw new RangeError("Prepared Structural Fire previous representation is invalid.");
  }
  const initialBatch = batchIndex === 0;
  if (preparedStructuralFireBatchJobId(rootJobId, batchIndex, attemptIndex)
      !== workerJobId(source.jobId)
    || (initialBatch
      && (tokenHash !== null
        || chainHash !== null
        || completedUnits !== 0
        || totalUnits !== null
        || previousRepresentation !== null))
    || (!initialBatch
      && (tokenHash === null
        || chainHash === null
        || totalUnits === null
        || completedUnits <= 0
        || completedUnits >= totalUnits
        || previousRepresentation === null))) {
    throw new RangeError("Prepared Structural Fire continuation identity is invalid.");
  }
  const expectedLevels = PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS;
  if (source.physicsRepresentationPolicy.authorityResolution !== "ExactStructural"
    || source.physicsRepresentationPolicy.levels.length !== expectedLevels.length
    || source.physicsRepresentationPolicy.levels.some((level, index) =>
      level !== expectedLevels[index])) {
    throw new RangeError("Prepared Structural Fire Physics representation policy is invalid.");
  }
  const continuation = Object.freeze({
    rootJobId,
    batchIndex,
    attemptIndex,
    tokenHash,
    chainHash,
    completedUnits,
    totalUnits,
    physicsRepresentationLevel: previousRepresentation
  });
  const physicsRepresentationPolicy = Object.freeze({
    authorityResolution: "ExactStructural" as const,
    levels: Object.freeze([...expectedLevels])
  });
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_JOB_SCHEMA_VERSION,
    kind: PREPARED_STRUCTURAL_FIRE_JOB_KIND,
    jobId: workerJobId(source.jobId),
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION,
    inputLayoutVersion: PREPARED_STRUCTURAL_FIRE_INPUT_LAYOUT_VERSION,
    resultLayoutVersion: PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION,
    objectId: workerTargetKey(source.objectId),
    expectedObjectRevision: contentRevision(
      source.expectedObjectRevision,
      "expectedObjectRevision"
    ),
    expectedEditRevision: contentRevision(source.expectedEditRevision, "expectedEditRevision"),
    contentHash: stableAsciiId<string>(source.contentHash, "contentHash", 128),
    fireCommandId: stableAsciiId<string>(source.fireCommandId, "fireCommandId"),
    structuralCommandId: stableAsciiId<string>(
      source.structuralCommandId,
      "structuralCommandId"
    ),
    activationTick,
    deadlineTick,
    continuation,
    physicsRepresentationPolicy,
    budgets,
    payload
  });
};

export const createPreparedStructuralFireWorkerRequest = (
  source: Readonly<PreparedStructuralFireJob>,
  dispatchEpochValue: number = source.expectedObjectRevision
): WorkerJobRequest<PreparedStructuralFireJob> => {
  const job = createPreparedStructuralFireJob(source);
  const estimatedPhysicalOutputBytes = job.payload.byteLength + job.budgets.maxResultBytes;
  return snapshotWorkerJobRequest({
    jobId: workerJobId(job.jobId),
    jobKind: workerJobKind(job.kind),
    targetKey: workerTargetKey(job.objectId),
    planningEpoch: planningEpoch(dispatchEpochValue),
    workerEpoch: workerEpoch(0),
    inputRevision: contentRevision(job.expectedEditRevision),
    algorithmVersion: algorithmVersion(job.algorithmVersion),
    priority: "High",
    deadline: jobDeadline(job.deadlineTick),
    estimatedInputBytes: byteCount(job.payload.byteLength),
    estimatedOutputBytes: byteCount(
      estimatedPhysicalOutputBytes,
      "estimatedPhysicalOutputBytes"
    ),
    payload: job
  });
};

export const validatePreparedStructuralFireInput = (
  job: Readonly<PreparedStructuralFireJob>,
  source: TransferableBufferBundle
): TransferableBufferBundle => {
  const bundle = validateTransferableBundle(source);
  if (bundle.ownership !== "SenderToWorker") {
    throw new RangeError("Prepared Structural Fire input ownership must be SenderToWorker.");
  }
  if (bundle.revision !== job.expectedEditRevision
    || bundle.byteLength !== job.payload.byteLength
    || bundle.buffers.length !== job.payload.bufferCount) {
    throw new RangeError("Prepared Structural Fire input does not match its job descriptor.");
  }
  const contentHash = fnv1aBytes(bundle.buffers);
  if (bundle.contentHash !== contentHash
    || job.payload.contentHash !== contentHash
    || job.payload.inputCommitmentHash
      !== preparedStructuralFireInputCommitmentHash(bundle)) {
    throw new RangeError("Prepared Structural Fire input content hash is invalid.");
  }
  return bundle;
};

const immutableWorkCounters = (
  source: Readonly<PreparedStructuralFireWorkCounters>
): Readonly<PreparedStructuralFireWorkCounters> => Object.freeze({
  visitedBricks: safeNonNegativeInteger(source.visitedBricks, "visitedBricks"),
  visitedCells: safeNonNegativeInteger(source.visitedCells, "visitedCells"),
  connectivityFacts: safeNonNegativeInteger(source.connectivityFacts, "connectivityFacts"),
  components: safeNonNegativeInteger(source.components, "components"),
  massCells: safeNonNegativeInteger(source.massCells, "massCells")
});

const exceedsWorkBudget = (
  counters: Readonly<PreparedStructuralFireWorkCounters>,
  budgets: Readonly<PreparedStructuralFireWorkBudgets>
): boolean => counters.visitedBricks > budgets.maxVisitedBricks
  || counters.visitedCells > budgets.maxVisitedCells
  || counters.connectivityFacts > budgets.maxConnectivityFacts
  || counters.components > budgets.maxComponents
  || counters.massCells > budgets.maxMassCells;

const representationRank = (
  value: PreparedStructuralFirePhysicsRepresentationLevel
): number => PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS.indexOf(value);

const bundleProjection = (
  bundle: TransferableBufferBundle,
  transferHash: string
): Readonly<Record<string, unknown>> => Object.freeze({
  revision: bundle.revision,
  byteLength: bundle.byteLength,
  bufferByteLengths: Object.freeze(bundle.buffers.map((buffer) => buffer.byteLength)),
  views: Object.freeze(bundle.views.map((view) => Object.freeze({
    name: view.name,
    bufferIndex: view.bufferIndex,
    kind: view.kind,
    byteOffset: view.byteOffset,
    elementCount: view.elementCount
  }))),
  transferHash
});

const resultManifestCore = (
  source: Readonly<PreparedStructuralFireResultDraft>,
  bundle: TransferableBufferBundle,
  transferHash: string
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: source.schemaVersion,
  kind: source.kind,
  layoutVersion: source.layoutVersion,
  algorithmVersion: source.algorithmVersion,
  jobId: source.jobId,
  rootJobId: source.rootJobId,
  objectId: source.objectId,
  sourceObjectRevision: source.sourceObjectRevision,
  sourceEditRevision: source.sourceEditRevision,
  sourceContentHash: source.sourceContentHash,
  inputCommitmentHash: source.inputCommitmentHash,
  fireCommandId: source.fireCommandId,
  structuralCommandId: source.structuralCommandId,
  activationTick: source.activationTick,
  deadlineTick: source.deadlineTick,
  authorityResolution: source.authorityResolution,
  physicsRepresentationLevel: source.physicsRepresentationLevel,
  adaptationReason: source.adaptationReason,
  status: source.status,
  resultingObjectRevision: source.resultingObjectRevision,
  resultingEditRevision: source.resultingEditRevision,
  resultingContentHash: source.resultingContentHash,
  changedBrickCount: source.changedBrickCount,
  changedCellCount: source.changedCellCount,
  detachedComponentCount: source.detachedComponentCount,
  resultCount: source.resultCount,
  resultBytes: source.resultBytes,
  work: source.work,
  workProgress: source.workProgress,
  progress: Object.freeze({
    completedUnits: source.progress.completedUnits,
    totalUnits: source.progress.totalUnits,
    nextBatchIndex: source.progress.nextBatchIndex
  }),
  bundle: bundleProjection(bundle, transferHash)
});

const resultChainHash = (
  job: Readonly<PreparedStructuralFireJob>,
  source: Readonly<PreparedStructuralFireResultDraft>,
  bundle: TransferableBufferBundle,
  transferHash: string
): string => hashAdaptiveCanonical({
  schemaVersion: "prepared-structural-fire-chain-v1",
  rootJobId: job.continuation.rootJobId,
  previousChainHash: job.continuation.chainHash,
  batchIndex: job.continuation.batchIndex,
  attemptIndex: job.continuation.attemptIndex,
  manifestCore: resultManifestCore(source, bundle, transferHash)
});

const resultContinuationTokenHash = (
  job: Readonly<PreparedStructuralFireJob>,
  source: Readonly<PreparedStructuralFireResultDraft>,
  chainHash: string
): string | null => source.status !== "ContinuationRequired" ? null : hashAdaptiveCanonical({
  schemaVersion: "prepared-structural-fire-continuation-token-v1",
  rootJobId: job.continuation.rootJobId,
  objectId: job.objectId,
  sourceObjectRevision: job.expectedObjectRevision,
  sourceEditRevision: job.expectedEditRevision,
  sourceContentHash: job.contentHash,
  inputCommitmentHash: job.payload.inputCommitmentHash,
  fireCommandId: job.fireCommandId,
  structuralCommandId: job.structuralCommandId,
  previousTokenHash: job.continuation.tokenHash,
  previousChainHash: job.continuation.chainHash,
  batchIndex: job.continuation.batchIndex,
  nextBatchIndex: source.progress.nextBatchIndex,
  completedUnits: source.progress.completedUnits,
  totalUnits: source.progress.totalUnits,
  chainHash,
  physicsRepresentationLevel: source.physicsRepresentationLevel
});

const resultManifestHash = (
  source: Readonly<PreparedStructuralFireResultDraft>,
  bundle: TransferableBufferBundle,
  transferHash: string,
  chainHash: string,
  continuationTokenHash: string | null
): string => hashAdaptiveCanonical({
  schemaVersion: "prepared-structural-fire-manifest-v1",
  core: resultManifestCore(source, bundle, transferHash),
  progressReceipt: Object.freeze({ chainHash, continuationTokenHash })
});

const resultReceiptHash = (manifestHash: string, transferHash: string): string =>
  hashAdaptiveCanonical({
    schemaVersion: "prepared-structural-fire-receipt-v1",
    manifestHash,
    transferHash
  });

export const validatePreparedStructuralFireResultDetails = (
  job: Readonly<PreparedStructuralFireJob>,
  source: Readonly<PreparedStructuralFireResultDetails>,
  bundleValue: TransferableBufferBundle
): PreparedStructuralFireResultDetails => {
  const bundle = validateTransferableBundle(bundleValue);
  if (source.schemaVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION
    || source.kind !== "PreparedStructuralFireResult"
    || source.layoutVersion !== PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION
    || source.algorithmVersion !== PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION) {
    throw new RangeError("Prepared Structural Fire result protocol is invalid.");
  }
  if (source.status !== "Applied"
    && source.status !== "NoChange"
    && source.status !== "ContinuationRequired") {
    throw new RangeError("Prepared Structural Fire result status is invalid.");
  }
  if (source.authorityResolution !== "ExactStructural"
    || !PREPARED_STRUCTURAL_FIRE_PHYSICS_REPRESENTATION_LEVELS.includes(
      source.physicsRepresentationLevel
    )) {
    throw new RangeError("Prepared Structural Fire result representation is invalid.");
  }
  const previousRepresentation = job.continuation.physicsRepresentationLevel;
  if (previousRepresentation !== null
    && representationRank(source.physicsRepresentationLevel)
      < representationRank(previousRepresentation)) {
    throw new RangeError("Prepared Structural Fire representation cannot become finer across batches.");
  }
  const adaptationReasons: readonly PreparedStructuralFireAdaptationReason[] = [
    "None",
    "ColliderBudget",
    "ContactBudget",
    "SubstepBudget"
  ];
  if (!adaptationReasons.includes(source.adaptationReason)
    || (source.physicsRepresentationLevel === "ExactBoxes")
      !== (source.adaptationReason === "None")) {
    throw new RangeError("Prepared Structural Fire result adaptation reason is invalid.");
  }
  if (workerJobId(source.jobId) !== job.jobId
    || stableAsciiId<string>(source.rootJobId, "rootJobId", 192)
      !== job.continuation.rootJobId
    || workerTargetKey(source.objectId) !== job.objectId
    || contentRevision(source.sourceObjectRevision) !== job.expectedObjectRevision
    || contentRevision(source.sourceEditRevision) !== job.expectedEditRevision
    || stableAsciiId<string>(source.sourceContentHash, "sourceContentHash", 128)
      !== job.contentHash
    || stableAsciiId<string>(
      source.inputCommitmentHash,
      "inputCommitmentHash",
      128
    ) !== job.payload.inputCommitmentHash
    || stableAsciiId<string>(source.fireCommandId, "fireCommandId") !== job.fireCommandId
    || stableAsciiId<string>(source.structuralCommandId, "structuralCommandId")
      !== job.structuralCommandId
    || safeNonNegativeInteger(source.activationTick, "activationTick") !== job.activationTick
    || safeNonNegativeInteger(source.deadlineTick, "deadlineTick") !== job.deadlineTick) {
    throw new RangeError("Prepared Structural Fire result source facts do not match its job.");
  }
  const resultingObjectRevision = contentRevision(
    source.resultingObjectRevision,
    "resultingObjectRevision"
  );
  const resultingEditRevision = contentRevision(
    source.resultingEditRevision,
    "resultingEditRevision"
  );
  const resultingContentHash = stableAsciiId<string>(
    source.resultingContentHash,
    "resultingContentHash",
    128
  );
  if (source.status === "Applied"
    && (resultingObjectRevision !== job.expectedObjectRevision + 1
      || resultingEditRevision !== job.expectedEditRevision + 1
      || resultingContentHash === job.contentHash)) {
    throw new RangeError("Applied Prepared Structural Fire results must advance revisions exactly once.");
  }
  if (source.status === "NoChange"
    && (resultingObjectRevision !== job.expectedObjectRevision + 1
      || resultingEditRevision !== job.expectedEditRevision
      || resultingContentHash !== job.contentHash)) {
    throw new RangeError("NoChange Prepared Structural Fire results must advance only the object revision.");
  }
  if (source.status === "ContinuationRequired"
    && (resultingObjectRevision !== job.expectedObjectRevision
      || resultingEditRevision !== job.expectedEditRevision
      || resultingContentHash !== job.contentHash)) {
    throw new RangeError("Continuation results must preserve Structural identity.");
  }
  if (bundle.revision !== resultingObjectRevision) {
    throw new RangeError(
      "Prepared Structural Fire bundle revision must match the resulting object revision."
    );
  }
  const changedBrickCount = safeNonNegativeInteger(
    source.changedBrickCount,
    "changedBrickCount"
  );
  const changedCellCount = safeNonNegativeInteger(source.changedCellCount, "changedCellCount");
  const detachedComponentCount = safeNonNegativeInteger(
    source.detachedComponentCount,
    "detachedComponentCount"
  );
  const resultCount = safeNonNegativeInteger(source.resultCount, "resultCount");
  const resultBytes = byteCount(source.resultBytes, "resultBytes");
  const work = immutableWorkCounters(source.work);
  let workProgress: PreparedStructuralFireWorkProgress;
  if (source.workProgress.status === "Unavailable") {
    workProgress = Object.freeze({ status: "Unavailable" as const });
  } else if (source.workProgress.status === "Available") {
    const completedWorkUnits = safeNonNegativeInteger(
      source.workProgress.completedUnits,
      "workProgress.completedUnits"
    );
    const totalWorkUnits = positiveSafeInteger(
      source.workProgress.totalUnits,
      "workProgress.totalUnits"
    );
    if (completedWorkUnits > totalWorkUnits) {
      throw new RangeError("Prepared Structural Fire work progress exceeds its total.");
    }
    workProgress = Object.freeze({
      status: "Available" as const,
      completedUnits: completedWorkUnits,
      totalUnits: totalWorkUnits
    });
  } else {
    throw new RangeError("Prepared Structural Fire work progress is invalid.");
  }
  if (source.status === "NoChange"
    && (changedBrickCount !== 0
      || changedCellCount !== 0
      || detachedComponentCount !== 0
      || resultCount !== 1
      || resultBytes === 0
      || bundle.byteLength === 0
      || bundle.buffers.length !== 1
      || bundle.views.length !== 1)) {
    throw new RangeError(
      "NoChange Prepared Structural Fire results must carry one evidence-only authority delta."
    );
  }
  if (changedBrickCount > job.budgets.maxChangedBricks
    || changedCellCount > job.budgets.maxChangedCells
    || detachedComponentCount > job.budgets.maxDetachedComponents
    || resultCount > job.budgets.maxResultCount
    || resultBytes > job.budgets.maxResultBytes
    || exceedsWorkBudget(work, job.budgets.work)) {
    throw new RangeError("Prepared Structural Fire result exceeds its declared budgets.");
  }
  if (resultBytes !== bundle.byteLength) {
    throw new RangeError("Prepared Structural Fire resultBytes do not match its bundle.");
  }
  const completedUnits = safeNonNegativeInteger(
    source.progress.completedUnits,
    "progress.completedUnits"
  );
  const totalUnits = safeNonNegativeInteger(source.progress.totalUnits, "progress.totalUnits");
  if (completedUnits > totalUnits
    || (job.continuation.totalUnits !== null
      && totalUnits !== job.continuation.totalUnits)) {
    throw new RangeError("Prepared Structural Fire progress exceeds totalUnits.");
  }
  const nextBatchIndex = source.progress.nextBatchIndex === null
    ? null
    : safeNonNegativeInteger(source.progress.nextBatchIndex, "progress.nextBatchIndex");
  const continuationTokenHash = source.progress.continuationTokenHash === null
    ? null
    : stableAsciiId<string>(
      source.progress.continuationTokenHash,
      "progress.continuationTokenHash",
      128
    );
  if (source.status === "ContinuationRequired") {
    if (completedUnits <= job.continuation.completedUnits
      || completedUnits >= totalUnits
      || nextBatchIndex !== job.continuation.batchIndex + 1
      || continuationTokenHash === null) {
      throw new RangeError("Prepared Structural Fire continuation progress is invalid.");
    }
  } else if (completedUnits !== totalUnits
    || (job.continuation.batchIndex > 0
      && completedUnits <= job.continuation.completedUnits)
    || nextBatchIndex !== null
    || continuationTokenHash !== null) {
    throw new RangeError("Terminal Prepared Structural Fire progress is incomplete.");
  }
  const chainHash = stableAsciiId<string>(source.progress.chainHash, "progress.chainHash", 128);
  const draft: PreparedStructuralFireResultDraft = Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION,
    kind: "PreparedStructuralFireResult",
    layoutVersion: PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION,
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION,
    jobId: job.jobId,
    rootJobId: job.continuation.rootJobId,
    objectId: job.objectId,
    sourceObjectRevision: job.expectedObjectRevision,
    sourceEditRevision: job.expectedEditRevision,
    sourceContentHash: job.contentHash,
    inputCommitmentHash: job.payload.inputCommitmentHash,
    fireCommandId: job.fireCommandId,
    structuralCommandId: job.structuralCommandId,
    activationTick: job.activationTick,
    deadlineTick: job.deadlineTick,
    authorityResolution: "ExactStructural",
    physicsRepresentationLevel: source.physicsRepresentationLevel,
    adaptationReason: source.adaptationReason,
    status: source.status,
    resultingObjectRevision,
    resultingEditRevision,
    resultingContentHash,
    changedBrickCount,
    changedCellCount,
    detachedComponentCount,
    resultCount,
    resultBytes,
    work,
    workProgress,
    progress: Object.freeze({ completedUnits, totalUnits, nextBatchIndex })
  });
  const actualTransferHash = fnv1aBytes(bundle.buffers);
  const expectedChainHash = resultChainHash(job, draft, bundle, actualTransferHash);
  const expectedTokenHash = resultContinuationTokenHash(job, draft, expectedChainHash);
  if (chainHash !== expectedChainHash || continuationTokenHash !== expectedTokenHash) {
    throw new RangeError("Prepared Structural Fire continuation chain or token is invalid.");
  }
  const progress = Object.freeze({
    completedUnits,
    totalUnits,
    nextBatchIndex,
    continuationTokenHash,
    chainHash
  });
  const transferHash = stableAsciiId<string>(source.transferHash, "transferHash", 128);
  const manifestHash = stableAsciiId<string>(source.manifestHash, "manifestHash", 128);
  const receiptHash = stableAsciiId<string>(source.receiptHash, "receiptHash", 128);
  const expectedManifestHash = resultManifestHash(
    draft,
    bundle,
    actualTransferHash,
    expectedChainHash,
    expectedTokenHash
  );
  const expectedReceiptHash = resultReceiptHash(expectedManifestHash, actualTransferHash);
  if (bundle.ownership !== "WorkerToConsumer"
    || transferHash !== actualTransferHash
    || bundle.contentHash !== actualTransferHash
    || manifestHash !== expectedManifestHash
    || receiptHash !== expectedReceiptHash) {
    throw new RangeError("Prepared Structural Fire result hash or ownership is invalid.");
  }
  return Object.freeze({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION,
    kind: "PreparedStructuralFireResult",
    layoutVersion: PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION,
    algorithmVersion: PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION,
    jobId: job.jobId,
    rootJobId: job.continuation.rootJobId,
    objectId: job.objectId,
    sourceObjectRevision: job.expectedObjectRevision,
    sourceEditRevision: job.expectedEditRevision,
    sourceContentHash: job.contentHash,
    inputCommitmentHash: job.payload.inputCommitmentHash,
    fireCommandId: job.fireCommandId,
    structuralCommandId: job.structuralCommandId,
    activationTick: job.activationTick,
    deadlineTick: job.deadlineTick,
    authorityResolution: "ExactStructural",
    physicsRepresentationLevel: source.physicsRepresentationLevel,
    adaptationReason: source.adaptationReason,
    status: source.status,
    resultingObjectRevision,
    resultingEditRevision,
    resultingContentHash,
    changedBrickCount,
    changedCellCount,
    detachedComponentCount,
    resultCount,
    resultBytes,
    work,
    workProgress,
    progress,
    transferHash,
    manifestHash,
    receiptHash
  });
};

export const createPreparedStructuralFireResultDetails = (
  job: Readonly<PreparedStructuralFireJob>,
  source: Readonly<PreparedStructuralFireResultDraft>,
  bundleValue: TransferableBufferBundle
): PreparedStructuralFireResultDetails => {
  const bundle = validateTransferableBundle(bundleValue);
  const transferHash = fnv1aBytes(bundle.buffers);
  const chainHash = resultChainHash(job, source, bundle, transferHash);
  const continuationTokenHash = resultContinuationTokenHash(job, source, chainHash);
  const manifestHash = resultManifestHash(
    source,
    bundle,
    transferHash,
    chainHash,
    continuationTokenHash
  );
  const receiptHash = resultReceiptHash(manifestHash, transferHash);
  return validatePreparedStructuralFireResultDetails(job, Object.freeze({
    ...source,
    progress: Object.freeze({
      ...source.progress,
      continuationTokenHash,
      chainHash
    }),
    transferHash,
    manifestHash,
    receiptHash
  }), bundle);
};
