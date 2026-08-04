import {
  WorkerPool,
  planningEpoch,
  type PreparedStructuralFirePrivateOutputMessage,
  type WorkerEpoch,
  type WorkerPoolEvent,
  type WorkerPoolSnapshot,
  type WorkerTransportFactory
} from "../../workers";
import { hashAdaptiveCanonical } from "../../voxel/adaptive";
import type { SurfaceTreeCollisionHit } from "../vegetation/surfaceTreeCollision";
import type { SurfaceTreeRuntimeState } from "../vegetation/surfaceTreeRuntime";
import { PreparedStructuralFirePageStore } from "./preparedStructuralFirePageStore";
import {
  PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
  type PreparedStructuralFirePrivateBoundaryDiagnostics,
  type PreparedStructuralFirePrivateMainDiagnostics,
  type PreparedStructuralFirePrivateWorkerDiagnostics,
  type PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics,
  type PreparedStructuralFirePrivateWorkerOutput
} from "./preparedStructuralFireProtocol";
import {
  PreparedStructuralFirePhysicalPageAccumulator,
  preparedStructuralFireSeedHash,
  validatePreparedStructuralFireCommand,
  validatePreparedStructuralFireReadyAgainstRequest,
  validatePreparedStructuralFireRequest,
  validatePreparedStructuralFireSeedManifest
} from "./preparedStructuralFireWireCodec";
import type {
  PreparedStructuralFireCommand,
  PreparedStructuralFireHash,
  PreparedStructuralFirePageEnvelope,
  PreparedStructuralFireReady,
  PreparedStructuralFireRequest,
  PreparedStructuralFireResultViewName,
  PreparedStructuralFireSeedManifest
} from "./preparedStructuralFireWire";
import { PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES } from "./preparedStructuralFireWire";
import {
  PreparedStructuralFireScheduler,
  type PreparedStructuralFireEnqueueDecision,
  type PreparedStructuralFireSourceFacts,
  type PreparedStructuralFireTelemetry
} from "./preparedStructuralFireScheduler";
import {
  type PreparedStructuralFirePrivateWorkerBridgeOutput
} from "./preparedStructuralFireWorker";

export const createPreparedStructuralFireWorkerTransport: WorkerTransportFactory = () =>
  new Worker(new URL("./preparedStructuralFireWorker.ts", import.meta.url), { type: "module" });

export interface PreparedStructuralFireWorkerClientOptions {
  readonly transportFactory?: WorkerTransportFactory;
  readonly workerCount?: number;
  readonly now?: () => number;
  readonly observe?: (event: WorkerPoolEvent) => void;
}

export type PreparedStructuralFirePrivateDiagnosticsObserver = (
  diagnostics: Readonly<PreparedStructuralFirePrivateBoundaryDiagnostics>
) => void;

export interface PreparedStructuralFireWorkerClientTelemetry {
  readonly scheduler: PreparedStructuralFireTelemetry;
  readonly pool: WorkerPoolSnapshot;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly staleCount: number;
  readonly failedCount: number;
}

export interface PreparedStructuralFireWorkerClientSeed {
  readonly manifest: Readonly<PreparedStructuralFireSeedManifest>;
  readonly openPages: (workerEpoch: WorkerEpoch) => Iterable<
    Readonly<PreparedStructuralFirePageEnvelope>
  >;
}

export interface PreparedStructuralFireWorkerClientInput {
  readonly request: Readonly<PreparedStructuralFireRequest>;
  readonly command: Readonly<PreparedStructuralFireCommand>;
  readonly previousChainHash: PreparedStructuralFireHash;
  /** Seed identity returned by PrepareSeed; pages remain worker-owned. */
  readonly seedManifest?: Readonly<PreparedStructuralFireSeedManifest>;
  readonly seed?: Readonly<PreparedStructuralFireWorkerClientSeed>;
}

export interface PreparedStructuralFireWorkerSeedPreparationInput {
  readonly state: Readonly<SurfaceTreeRuntimeState>;
  readonly input: Readonly<{
    readonly fireCommandId: string;
    readonly hit: Readonly<SurfaceTreeCollisionHit>;
    readonly simulationTick: number;
  }>;
}

const emptyMainDiagnostics = (): Readonly<PreparedStructuralFirePrivateMainDiagnostics> => Object.freeze({
  clockDomain: "Main" as const,
  prepareSeedStartAtMilliseconds: null,
  prepareSeedPostStartAtMilliseconds: null,
  prepareSeedPostEndAtMilliseconds: null,
  seedPreparedReceiptAtMilliseconds: null,
  seedValidationCompleteAtMilliseconds: null,
  prepareSeedEndAtMilliseconds: null,
  prepareSeedDurationMilliseconds: null,
  prepareSeedPostDurationMilliseconds: null,
  seedValidationDurationMilliseconds: null,
  executePostStartAtMilliseconds: null,
  executePostReturnedAtMilliseconds: null,
  firstResultOrReadyReceiptAtMilliseconds: null,
  executeReadyReceiptAtMilliseconds: null,
  executeValidationCompleteAtMilliseconds: null,
  executePostDurationMilliseconds: null,
  executeReceiptToValidationDurationMilliseconds: null
});

const manifestCanonicalBytes = (
  manifest: Readonly<PreparedStructuralFireSeedManifest>
): number => manifest.views.reduce((total, view) => total + view.byteLength, 0);

const duration = (start: number | null, end: number | null): number | null =>
  start === null || end === null ? null : Math.max(0, end - start);

export type PreparedStructuralFireWorkerSeedPreparationResult =
  | Readonly<{
      readonly state: "Prepared";
      readonly input: Readonly<PreparedStructuralFireWorkerClientInput>;
    }>
  | Readonly<{ readonly state: "Deferred"; readonly reason: "WorkerCapacity" }>
  | Readonly<{ readonly state: "Cancelled" }>
  | Readonly<{ readonly state: "Stale" }>
  | Readonly<{ readonly state: "Failed"; readonly reason: string }>;

export type PreparedStructuralFireWorkerClientResult =
  | Readonly<{
      readonly state: "Completed";
      readonly ready: PreparedStructuralFireReady;
      readonly workerEpoch: WorkerEpoch;
    }>
  | Readonly<{
      readonly state: "Deferred";
      readonly reason: "WorkerCapacity" | "RetainedInFlightBackpressure";
      readonly enqueue?: PreparedStructuralFireEnqueueDecision;
    }>
  | Readonly<{
      readonly state: "Rejected";
      readonly reason: string;
      readonly enqueue?: PreparedStructuralFireEnqueueDecision;
    }>
  | Readonly<{ readonly state: "Cancelled" }>
  | Readonly<{ readonly state: "Stale" }>
  | Readonly<{
      readonly state: "ResyncRequired";
      readonly objectId: string;
      readonly reason: "WorkerReplicaRestarted" | "WorkerReplicaUnavailable";
    }>
  | Readonly<{ readonly state: "Failed"; readonly reason: string }>;

export interface PreparedStructuralFireWorkerClientRunOptions {
  readonly readSource: () => PreparedStructuralFireSourceFacts;
  readonly readTick: () => number;
  readonly signal?: AbortSignal;
  readonly observeDiagnostics?: PreparedStructuralFirePrivateDiagnosticsObserver;
}

interface KnownReplica {
  readonly seedHash: PreparedStructuralFireHash;
  readonly workerEpoch: WorkerEpoch;
  readonly seedCanonicalBytes: number;
}

const preparationRootJobId = (
  input: Readonly<PreparedStructuralFireWorkerSeedPreparationInput>
): string => `psf-prepare-v1:${hashAdaptiveCanonical({
  schemaVersion: "prepared-structural-fire-seed-preparation-v1",
  objectId: input.state.authority.objectId,
  objectRevision: input.state.authority.objectRevision,
  editRevision: input.state.authority.editRevision,
  fireCommandId: input.input.fireCommandId,
  simulationTick: input.input.simulationTick
}).slice("fnv1a64-v1:".length)}`;

type QueuedPrivateOutput = PreparedStructuralFirePrivateWorkerBridgeOutput
  | Readonly<{ readonly kind: "ClientCancelled" }>
  | Readonly<{ readonly kind: "TransportFailed"; readonly reason: string }>;

class PrivateOutputQueue {
  readonly #values: QueuedPrivateOutput[] = [];
  readonly #waiters: ((value: QueuedPrivateOutput) => void)[] = [];

  push(value: QueuedPrivateOutput): void {
    const waiter = this.#waiters.shift();
    if (waiter === undefined) this.#values.push(value);
    else waiter(value);
  }

  next(): Promise<QueuedPrivateOutput> {
    const value = this.#values.shift();
    if (value !== undefined) return Promise.resolve(value);
    return new Promise((resolve) => this.#waiters.push(resolve));
  }
}

interface ResultPageFacts {
  readonly accumulator: PreparedStructuralFirePhysicalPageAccumulator;
  readonly logicalViewRoot: PreparedStructuralFireHash;
  pageCount: number;
  byteLength: number;
}

const PRIVATE_OUTPUT_REASON_MAX_LENGTH = 256;

const isPrivateRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const hasExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): boolean => {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length
    && ownKeys.every((key) => typeof key === "string" && keys.includes(key));
};

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isFiniteNonNegativeOrNull = (value: unknown): value is number | null =>
  value === null || isFiniteNonNegative(value);

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

type DiagnosticSpanRecord = Readonly<{
  readonly startAtMilliseconds: number | null;
  readonly endAtMilliseconds: number | null;
  readonly durationMilliseconds: number | null;
}>;

const isDiagnosticSpan = (value: unknown): boolean => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, ["startAtMilliseconds", "endAtMilliseconds", "durationMilliseconds"])
    || !isFiniteNonNegativeOrNull(value.startAtMilliseconds)
    || !isFiniteNonNegativeOrNull(value.endAtMilliseconds)
    || !isFiniteNonNegativeOrNull(value.durationMilliseconds)) return false;
  const start = value.startAtMilliseconds;
  const end = value.endAtMilliseconds;
  const duration = value.durationMilliseconds;
  if (start === null) return end === null && duration === null;
  if (end === null) return duration === null;
  return end >= start && duration === end - start;
};

const isDiagnosticAuthorityFacts = (value: unknown): boolean => isPrivateRecord(value)
  && hasExactKeys(value, ["brickCount", "occupiedCellCount", "anchorCount", "jointCount"])
  && isSafeNonNegativeInteger(value.brickCount)
  && isSafeNonNegativeInteger(value.occupiedCellCount)
  && isSafeNonNegativeInteger(value.anchorCount)
  && isSafeNonNegativeInteger(value.jointCount);

const isDiagnosticConnectivityFacts = (value: unknown): boolean => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, [
      "mode",
      "candidateCellCount",
      "sourceBrickCount",
      "rebuiltBrickCount",
      "reusedBrickCount",
      "removedCellCount",
      "fullVoxelTraversalCount",
      "frontierVisitedCellCount",
      "coordinateNeighborProbeCount",
      "indexedActiveCellVisitCount",
      "cachedAdjacencyProbeCount"
    ])
    || (value.mode !== "Full"
      && value.mode !== "RevisionOnly"
      && value.mode !== "TopologyRetained"
      && value.mode !== "DeletionFrontier")) return false;
  return [
    value.candidateCellCount,
    value.sourceBrickCount,
    value.rebuiltBrickCount,
    value.reusedBrickCount,
    value.removedCellCount,
    value.fullVoxelTraversalCount,
    value.frontierVisitedCellCount,
    value.coordinateNeighborProbeCount,
    value.indexedActiveCellVisitCount,
    value.cachedAdjacencyProbeCount
  ].every(isSafeNonNegativeInteger);
};

const isDiagnosticCollisionFacts = (value: unknown): boolean => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, [
      "mode",
      "sourceBrickCount",
      "changedBrickCount",
      "recomputedCellCount",
      "reusedCellCount",
      "invalidatedCellCount",
      "materializationOperationCount",
      "canonicalHashCellCount"
    ])
    || (value.mode !== "Full" && value.mode !== "Incremental")) return false;
  return [
    value.sourceBrickCount,
    value.changedBrickCount,
    value.recomputedCellCount,
    value.reusedCellCount,
    value.invalidatedCellCount,
    value.materializationOperationCount,
    value.canonicalHashCellCount
  ].every(isSafeNonNegativeInteger);
};

const isPrepareSeedFacts = (
  value: unknown
): value is PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics["facts"] => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, ["authority", "connectivity", "mass", "collision", "physics", "colliderDerivation"])
    || (value.authority !== null && !isDiagnosticAuthorityFacts(value.authority))
    || (value.connectivity !== null && !isDiagnosticConnectivityFacts(value.connectivity))
    || (value.mass !== null
      && (!isPrivateRecord(value.mass)
        || !hasExactKeys(value.mass, ["occupiedVoxelCount"])
        || !isSafeNonNegativeInteger(value.mass.occupiedVoxelCount)))
    || (value.collision !== null && !isDiagnosticCollisionFacts(value.collision))
    || !isPrivateRecord(value.physics)
    || !hasExactKeys(value.physics, ["terrainColliderCount", "bodyCount"])
    || !isSafeNonNegativeInteger(value.physics.terrainColliderCount)
    || !isSafeNonNegativeInteger(value.physics.bodyCount)
    || value.colliderDerivation !== "NotApplicableBodyFreeSeed") return false;
  return true;
};

const isPrepareSeedViewFacts = (
  value: unknown,
  index: number
): boolean => isPrivateRecord(value)
  && hasExactKeys(value, [
    "logicalViewName",
    "itemCount",
    "byteLength",
    "pageCount",
    "decodeDurationMilliseconds"
  ])
  && value.logicalViewName === PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES[index]
  && (value.itemCount === null || isSafeNonNegativeInteger(value.itemCount))
  && (value.byteLength === null || isSafeNonNegativeInteger(value.byteLength))
  && (value.pageCount === null || isSafeNonNegativeInteger(value.pageCount))
  && isFiniteNonNegativeOrNull(value.decodeDurationMilliseconds);

const isWorkerOperationTiming = (value: Readonly<Record<string, unknown>>): boolean => {
  if (!isFiniteNonNegativeOrNull(value.receiptAtMilliseconds)
    || !isFiniteNonNegativeOrNull(value.computeStartedAtMilliseconds)
    || !isFiniteNonNegativeOrNull(value.computeCompletedAtMilliseconds)
    || !isFiniteNonNegativeOrNull(value.computeDurationMilliseconds)) return false;
  const receipt = value.receiptAtMilliseconds;
  const start = value.computeStartedAtMilliseconds;
  const end = value.computeCompletedAtMilliseconds;
  const duration = value.computeDurationMilliseconds;
  if (start === null) return end === null && duration === null;
  if (end === null) return duration === null;
  return (receipt === null || receipt <= start)
    && end >= start
    && duration === end - start;
};

const spansOrderedAndNonOverlapping = (
  spans: readonly DiagnosticSpanRecord[]
): boolean => {
  let previousStart: number | null = null;
  let previousEnd: number | null = null;
  for (const span of spans) {
    if (span.startAtMilliseconds !== null) {
      if (previousStart !== null && span.startAtMilliseconds < previousStart) return false;
      if (previousEnd !== null && span.startAtMilliseconds < previousEnd) return false;
      previousStart = span.startAtMilliseconds;
    }
    if (span.endAtMilliseconds !== null) previousEnd = span.endAtMilliseconds;
  }
  return true;
};

const completedDiagnosticSpansOrdered = (
  preceding: readonly DiagnosticSpanRecord[],
  following: readonly DiagnosticSpanRecord[]
): boolean => {
  const completedPreceding = preceding.filter((span) =>
    span.startAtMilliseconds !== null && span.endAtMilliseconds !== null);
  const completedFollowing = following.filter((span) =>
    span.startAtMilliseconds !== null && span.endAtMilliseconds !== null);
  if (completedPreceding.length === 0 || completedFollowing.length === 0) return true;
  const precedingEnd = Math.max(...completedPreceding.map((span) => span.endAtMilliseconds!));
  const followingStart = Math.min(...completedFollowing.map((span) => span.startAtMilliseconds!));
  return precedingEnd <= followingStart;
};

const spanContainedBy = (
  child: DiagnosticSpanRecord,
  parent: DiagnosticSpanRecord
): boolean => (child.startAtMilliseconds === null
  || parent.startAtMilliseconds === null
  || child.startAtMilliseconds >= parent.startAtMilliseconds)
  && (child.endAtMilliseconds === null
    || parent.endAtMilliseconds === null
    || child.endAtMilliseconds <= parent.endAtMilliseconds);

const isPrivateWorkerPrepareSeedDiagnostics = (
  value: unknown
): value is PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, [
      "receiptAtMilliseconds",
      "computeStartedAtMilliseconds",
      "computeCompletedAtMilliseconds",
      "computeDurationMilliseconds",
      "constructSeed",
      "materializeAndRetainPages",
      "bindSeed",
      "views",
      "authority",
      "collision",
      "facts"
    ])
    || !isWorkerOperationTiming(value)
    || !isDiagnosticSpan(value.constructSeed)
    || !isDiagnosticSpan(value.materializeAndRetainPages)
    || !isDiagnosticSpan(value.bindSeed)
    || !Array.isArray(value.views)
    || value.views.length !== PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES.length
    || !value.views.every((view, index) => isPrepareSeedViewFacts(view, index))
    || !isPrivateRecord(value.authority)
    || !hasExactKeys(value.authority, [
      "treeAndObjectCanonicalValidation",
      "structuralConnectivity",
      "structuralMass",
      "authorityPublicationAndFinalCompare"
    ])
    || !isDiagnosticSpan(value.authority.treeAndObjectCanonicalValidation)
    || !isDiagnosticSpan(value.authority.structuralConnectivity)
    || !isDiagnosticSpan(value.authority.structuralMass)
    || !isDiagnosticSpan(value.authority.authorityPublicationAndFinalCompare)
    || !isPrivateRecord(value.collision)
    || !hasExactKeys(value.collision, ["collisionCanonicalValidation", "collisionPublicationAndIndex"])
    || !isDiagnosticSpan(value.collision.collisionCanonicalValidation)
    || !isDiagnosticSpan(value.collision.collisionPublicationAndIndex)
    || !isPrepareSeedFacts(value.facts)) return false;

  const computeStart = value.computeStartedAtMilliseconds as number | null;
  const computeEnd = value.computeCompletedAtMilliseconds as number | null;
  const computeSpan: DiagnosticSpanRecord = {
    startAtMilliseconds: computeStart,
    endAtMilliseconds: computeEnd,
    durationMilliseconds: value.computeDurationMilliseconds as number | null
  };
  const bindSeed = value.bindSeed as DiagnosticSpanRecord;
  const authority = value.authority as Readonly<Record<string, unknown>>;
  const collision = value.collision as Readonly<Record<string, unknown>>;
  const seedSpans = [
    value.constructSeed as DiagnosticSpanRecord,
    value.materializeAndRetainPages as DiagnosticSpanRecord,
    value.bindSeed as DiagnosticSpanRecord
  ] as const;
  const authoritySpans = [
    authority.treeAndObjectCanonicalValidation as DiagnosticSpanRecord,
    authority.structuralConnectivity as DiagnosticSpanRecord,
    authority.structuralMass as DiagnosticSpanRecord,
    authority.authorityPublicationAndFinalCompare as DiagnosticSpanRecord
  ] as const;
  const collisionSpans = [
    collision.collisionCanonicalValidation as DiagnosticSpanRecord,
    collision.collisionPublicationAndIndex as DiagnosticSpanRecord
  ] as const;
  return spansOrderedAndNonOverlapping(seedSpans)
    && spansOrderedAndNonOverlapping(authoritySpans)
    && spansOrderedAndNonOverlapping(collisionSpans)
    && completedDiagnosticSpansOrdered(authoritySpans, collisionSpans)
    && seedSpans.every((span) => spanContainedBy(span, computeSpan))
    && authoritySpans.every((span) => spanContainedBy(span, bindSeed))
    && collisionSpans.every((span) => spanContainedBy(span, bindSeed));
};

const isPrivateWorkerOperationDiagnostics = (value: unknown): boolean => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, [
      "receiptAtMilliseconds",
      "computeStartedAtMilliseconds",
      "computeCompletedAtMilliseconds",
      "computeDurationMilliseconds"
    ])) return false;
  return isWorkerOperationTiming(value);
};

const isPrivateWorkerDiagnostics = (
  value: unknown
): value is Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, ["clockDomain", "prepareSeed", "execute"])
    || value.clockDomain !== "Worker") return false;
  return (value.prepareSeed === null
    || isPrivateWorkerPrepareSeedDiagnostics(value.prepareSeed))
    && (value.execute === null || isPrivateWorkerOperationDiagnostics(value.execute));
};

const isBoundedPrivateOutputReason = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.length <= PRIVATE_OUTPUT_REASON_MAX_LENGTH
  && value.trim().length > 0;

const isPreparedStructuralFireHash = (value: unknown): value is PreparedStructuralFireHash =>
  typeof value === "string" && /^fnv1a64-v1:[0-9a-f]{16}$/u.test(value);

const isPreparedStructuralFireWorkerClientInput = (
  value: unknown
): value is PreparedStructuralFireWorkerClientInput => {
  if (!isPrivateRecord(value)
    || !hasExactKeys(value, ["request", "command", "previousChainHash", "seedManifest"])
    || !isPreparedStructuralFireHash(value.previousChainHash)) return false;
  try {
    const request = validatePreparedStructuralFireRequest(value.request as PreparedStructuralFireRequest);
    const command = validatePreparedStructuralFireCommand(value.command as PreparedStructuralFireCommand);
    const manifest = validatePreparedStructuralFireSeedManifest(
      value.seedManifest as PreparedStructuralFireSeedManifest
    );
    return request.commandHash === command.commandHash
      && request.seedHash === command.seedHash
      && request.seedHash === preparedStructuralFireSeedHash(manifest);
  } catch {
    return false;
  }
};

const hasOptionalWorkerDiagnostics = (
  value: Readonly<Record<string, unknown>>,
  coreKeys: readonly string[]
): boolean => hasExactKeys(value, coreKeys)
  || hasExactKeys(value, [...coreKeys, "workerDiagnostics"]);

const isPrivateWorkerOutput = (
  value: unknown
): value is PreparedStructuralFirePrivateWorkerBridgeOutput => {
  if (!isPrivateRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "PreparedResultPage":
      return hasExactKeys(value, ["kind", "envelope"]) && isPrivateRecord(value.envelope);
    case "Ready":
      return hasOptionalWorkerDiagnostics(value, ["kind", "ready"])
        && isPrivateRecord(value.ready);
    case "SeedPrepared":
      return hasOptionalWorkerDiagnostics(value, ["kind", "input"])
        && isPreparedStructuralFireWorkerClientInput(value.input);
    case "SeedPageDecision":
      return hasExactKeys(value, ["kind", "decision"]) && isPrivateRecord(value.decision);
    case "SeedBound":
      return hasExactKeys(value, ["kind", "result"]) && isPrivateRecord(value.result);
    case "ReleasedResult":
    case "Cancelled":
    case "Stale":
      return hasExactKeys(value, ["kind"]);
    case "ReleasedSeed":
      return hasExactKeys(value, ["kind", "released"]) && typeof value.released === "boolean";
    case "Refused": {
      return hasOptionalWorkerDiagnostics(value, ["kind", "reason"])
        && isBoundedPrivateOutputReason(value.reason);
    }
    default:
      return false;
  }
};

const sanitizeOptionalWorkerDiagnostics = (
  value: Readonly<Record<string, unknown>>
): PreparedStructuralFirePrivateWorkerBridgeOutput => {
  const sanitized: Record<string, unknown> = { ...value };
  const diagnostics = sanitized.workerDiagnostics;
  delete sanitized.workerDiagnostics;
  if (isPrivateWorkerDiagnostics(diagnostics)) sanitized.workerDiagnostics = diagnostics;
  return Object.freeze(sanitized) as PreparedStructuralFirePrivateWorkerBridgeOutput;
};

const privateOutput = (
  message: PreparedStructuralFirePrivateOutputMessage,
  expectedRootJobId: string,
  expectedWorkerEpoch: number | null
): QueuedPrivateOutput => {
  try {
    if (message.rootJobId !== expectedRootJobId
      || expectedWorkerEpoch === null
      || message.workerEpoch !== expectedWorkerEpoch) {
      return Object.freeze({ kind: "TransportFailed", reason: "Private worker output is invalid." });
    }
    const payload = message.payload;
    if (isPrivateWorkerOutput(payload)) return sanitizeOptionalWorkerDiagnostics(payload);
  } catch {
    // A malformed private payload must not escape the client boundary.
  }
  return Object.freeze({ kind: "TransportFailed", reason: "Private worker output is invalid." });
};

const terminalPrivateOutput = (
  value: QueuedPrivateOutput
): value is Extract<QueuedPrivateOutput, { readonly kind: "ClientCancelled" | "Cancelled" | "Stale" | "Refused" | "TransportFailed" }> =>
  value.kind === "ClientCancelled"
  || value.kind === "Cancelled"
  || value.kind === "Stale"
  || value.kind === "Refused"
  || value.kind === "TransportFailed";

const terminalReason = (value: Extract<QueuedPrivateOutput, {
  readonly kind: "Refused" | "TransportFailed";
}>): string => value.reason;

export class PreparedStructuralFireWorkerClient {
  readonly #scheduler: PreparedStructuralFireScheduler;
  readonly #pool: WorkerPool;
  readonly #now: () => number;
  readonly #tails = new Map<string, Promise<void>>();
  readonly #knownReplicas = new Map<string, KnownReplica>();
  readonly #resyncRequiredObjects = new Set<string>();
  #started = false;
  #completedCount = 0;
  #cancelledCount = 0;
  #staleCount = 0;
  #failedCount = 0;

  constructor(options: Readonly<PreparedStructuralFireWorkerClientOptions> = {}) {
    const workerCount = options.workerCount ?? 2;
    if (!Number.isSafeInteger(workerCount) || workerCount <= 0) {
      throw new RangeError("workerCount must be a positive safe integer.");
    }
    this.#now = options.now ?? (() => performance.now());
    this.#scheduler = new PreparedStructuralFireScheduler({ now: this.#now });
    this.#pool = new WorkerPool({
      workerCount,
      queueCapacity: Math.max(4, workerCount * 2),
      initialPlanningEpoch: planningEpoch(0),
      transportFactory: options.transportFactory ?? createPreparedStructuralFireWorkerTransport,
      observe: (event) => {
        if (event.type === "WorkerRestarted") {
          for (const objectId of this.#knownReplicas.keys()) {
            this.#resyncRequiredObjects.add(objectId);
          }
          this.#knownReplicas.clear();
        }
        options.observe?.(event);
      }
    });
  }

  async start(): Promise<void> {
    if (this.#started) return;
    await this.#pool.start();
    this.#started = true;
  }

  hasPreparedSeed(objectId: string, seedHash: PreparedStructuralFireHash): boolean {
    return this.#knownReplicas.get(objectId)?.seedHash === seedHash;
  }

  async prepareSeed(
    input: Readonly<PreparedStructuralFireWorkerSeedPreparationInput>,
    options: Readonly<{
      readonly signal?: AbortSignal;
      readonly observeDiagnostics?: PreparedStructuralFirePrivateDiagnosticsObserver;
    }> = {}
  ): Promise<PreparedStructuralFireWorkerSeedPreparationResult> {
    if (!this.#started) throw new Error("Prepared Structural Fire worker client is not started.");
    const objectId = input.state.authority.objectId;
    const rootJobId = preparationRootJobId(input);
    let main = emptyMainDiagnostics();
    let worker: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null = null;
    let workerEpoch: number | null = null;
    let seedCanonicalBytes: number | null = null;
    const report = (): void => {
      try {
        options.observeDiagnostics?.(Object.freeze({
          rootJobId,
          workerEpoch,
          main,
          worker,
          seedCanonicalBytes,
          resultCanonicalBytes: null,
          structuredCloneBytes: null
        }));
      } catch {
        // Diagnostics must never affect preparation.
      }
    };
    const finishPrepareSeedDiagnostics = (): void => {
      const prepareSeedEndAtMilliseconds = this.#now();
      main = Object.freeze({
        ...main,
        prepareSeedEndAtMilliseconds,
        prepareSeedDurationMilliseconds: duration(
          main.prepareSeedStartAtMilliseconds,
          prepareSeedEndAtMilliseconds
        )
      });
      report();
    };
    const prepareSeedStartAtMilliseconds = this.#now();
    main = Object.freeze({ ...main, prepareSeedStartAtMilliseconds });
    report();
    const outputs = new PrivateOutputQueue();
    const session = this.#pool.openPrivateSession(
      rootJobId,
      (message) => outputs.push(privateOutput(message, rootJobId, workerEpoch)),
      (reason) => outputs.push(Object.freeze({ kind: "TransportFailed", reason }))
    );
    if (session === null) {
      finishPrepareSeedDiagnostics();
      return Object.freeze({ state: "Deferred", reason: "WorkerCapacity" });
    }
    workerEpoch = session.workerEpoch;
    report();
    let cancelRequested = false;
    const cancel = (): void => {
      if (cancelRequested) return;
      cancelRequested = true;
      try { session.post({ kind: "Cancel", rootJobId }); }
      catch { outputs.push(Object.freeze({ kind: "ClientCancelled" })); }
    };
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      if (options.signal?.aborted) {
        cancel();
        finishPrepareSeedDiagnostics();
        return Object.freeze({ state: "Cancelled" });
      }
      const prepareSeedPostStartAtMilliseconds = this.#now();
      main = Object.freeze({ ...main, prepareSeedPostStartAtMilliseconds });
      report();
      session.post({
        kind: "PrepareSeed",
        state: input.state,
        input: input.input
      });
      const prepareSeedPostEndAtMilliseconds = this.#now();
      main = Object.freeze({
        ...main,
        prepareSeedPostEndAtMilliseconds,
        prepareSeedPostDurationMilliseconds: duration(
          main.prepareSeedPostStartAtMilliseconds,
          prepareSeedPostEndAtMilliseconds
        )
      });
      report();
      while (true) {
        const output = await outputs.next();
        if (output.kind === "SeedPrepared") {
          const seedPreparedReceiptAtMilliseconds = this.#now();
          main = Object.freeze({ ...main, seedPreparedReceiptAtMilliseconds });
          worker = output.workerDiagnostics ?? null;
          report();
          if (!isPreparedStructuralFireWorkerClientInput(output.input)) {
            throw new RangeError("Prepared seed worker returned an invalid input envelope.");
          }
          const expectedSource = {
            objectId: input.state.authority.objectId,
            objectRevision: input.state.authority.objectRevision,
            editRevision: input.state.authority.editRevision,
            contentHash: input.state.authority.objectContentHash as PreparedStructuralFireHash
          };
          const returnedRequest = validatePreparedStructuralFireRequest(output.input.request);
          const returnedCommand = validatePreparedStructuralFireCommand(output.input.command);
          if (returnedRequest.source.objectId !== expectedSource.objectId
            || returnedRequest.source.objectRevision !== expectedSource.objectRevision
            || returnedRequest.source.editRevision !== expectedSource.editRevision
            || returnedRequest.source.contentHash !== expectedSource.contentHash
            || returnedCommand.fireCommandId !== input.input.fireCommandId
            || returnedCommand.simulationTick !== input.input.simulationTick
            || returnedRequest.activationTick !== input.input.simulationTick
            || returnedRequest.commandHash !== returnedCommand.commandHash
            || returnedRequest.seedHash !== returnedCommand.seedHash) {
            throw new RangeError("Prepared seed worker returned a seed for a different preparation.");
          }
          const seedManifest = output.input.seedManifest;
          if (seedManifest === undefined) {
            throw new RangeError("Prepared seed worker returned an unbound seed manifest.");
          }
          const validatedManifest = validatePreparedStructuralFireSeedManifest(seedManifest);
          if (preparedStructuralFireSeedHash(validatedManifest) !== output.input.request.seedHash) {
            throw new RangeError("Prepared seed worker returned an unbound seed manifest.");
          }
          seedCanonicalBytes = manifestCanonicalBytes(validatedManifest);
          if (worker?.prepareSeed !== null
            && worker?.prepareSeed !== undefined
            && (worker.prepareSeed.views.some((view) => view.byteLength === null)
              || worker.prepareSeed.views.reduce((total, view) => total + (view.byteLength ?? 0), 0)
                !== seedCanonicalBytes)) {
            throw new RangeError("Prepared seed worker diagnostics do not bind the seed manifest bytes.");
          }
          const seedValidationCompleteAtMilliseconds = this.#now();
          main = Object.freeze({
            ...main,
            seedValidationCompleteAtMilliseconds,
            seedValidationDurationMilliseconds: duration(
              main.seedPreparedReceiptAtMilliseconds,
              seedValidationCompleteAtMilliseconds
            ),
            prepareSeedEndAtMilliseconds: seedValidationCompleteAtMilliseconds,
            prepareSeedDurationMilliseconds: duration(
              main.prepareSeedStartAtMilliseconds,
              seedValidationCompleteAtMilliseconds
            )
          });
          report();
          this.#knownReplicas.set(objectId, Object.freeze({
            seedHash: output.input.request.seedHash,
            workerEpoch: session.workerEpoch,
            seedCanonicalBytes
          }));
          this.#resyncRequiredObjects.delete(objectId);
          return Object.freeze({
            state: "Prepared",
            input: output.input
          });
        }
        if (output.kind === "ClientCancelled" || output.kind === "Cancelled") {
          this.#cancelledCount += 1;
          finishPrepareSeedDiagnostics();
          return Object.freeze({ state: "Cancelled" });
        }
        if (output.kind === "Stale") {
          this.#staleCount += 1;
          finishPrepareSeedDiagnostics();
          return Object.freeze({ state: "Stale" });
        }
        if (output.kind === "Refused" || output.kind === "TransportFailed") {
          if (output.kind === "Refused" && output.workerDiagnostics !== undefined) {
            worker = output.workerDiagnostics;
            report();
          }
          this.#failedCount += 1;
          finishPrepareSeedDiagnostics();
          return Object.freeze({ state: "Failed", reason: terminalReason(output) });
        }
      }
    } catch (error) {
      finishPrepareSeedDiagnostics();
      this.#failedCount += 1;
      return Object.freeze({
        state: "Failed",
        reason: error instanceof Error ? error.message : "Prepared Structural Fire seed preparation failed."
      });
    } finally {
      options.signal?.removeEventListener("abort", cancel);
      session.close();
    }
  }

  async run(
    input: Readonly<PreparedStructuralFireWorkerClientInput>,
    options: Readonly<PreparedStructuralFireWorkerClientRunOptions>
  ): Promise<PreparedStructuralFireWorkerClientResult> {
    if (!this.#started) throw new Error("Prepared Structural Fire worker client is not started.");
    const objectId = input.request.source.objectId;
    const predecessor = this.#tails.get(objectId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.#tails.set(objectId, current);
    await predecessor;
    try {
      if (!this.#started) {
        return Object.freeze({
          state: "Failed",
          reason: "Prepared Structural Fire worker client was disposed before dispatch."
        });
      }
      return await this.#runExclusive(input, options);
    } finally {
      release();
      if (this.#tails.get(objectId) === current) this.#tails.delete(objectId);
    }
  }

  async #runExclusive(
    inputValue: Readonly<PreparedStructuralFireWorkerClientInput>,
    options: Readonly<PreparedStructuralFireWorkerClientRunOptions>
  ): Promise<PreparedStructuralFireWorkerClientResult> {
    let request: PreparedStructuralFireRequest;
    let command: PreparedStructuralFireCommand;
    try {
      request = validatePreparedStructuralFireRequest(inputValue.request);
      command = validatePreparedStructuralFireCommand(inputValue.command);
      if (request.commandHash !== command.commandHash || request.seedHash !== command.seedHash) {
        throw new RangeError("Prepared request does not bind its command.");
      }
    } catch (error) {
      return Object.freeze({
        state: "Rejected",
        reason: error instanceof Error ? error.message : "Prepared request is invalid."
      });
    }
    const objectId = request.source.objectId;
    const known = this.#knownReplicas.get(objectId);
    let main = emptyMainDiagnostics();
    let worker: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null = null;
    let workerEpoch: number | null = null;
    let seedCanonicalBytes = inputValue.seed === undefined
      ? known?.seedCanonicalBytes ?? null
      : manifestCanonicalBytes(inputValue.seed.manifest);
    let resultCanonicalBytes: number | null = null;
    const report = (): void => {
      try {
        options.observeDiagnostics?.(Object.freeze({
          rootJobId: request.rootJobId,
          workerEpoch,
          main,
          worker,
          seedCanonicalBytes,
          resultCanonicalBytes,
          structuredCloneBytes: null
        }));
      } catch {
        // Diagnostics must never affect execution.
      }
    };
    const terminal = (
      output: Extract<QueuedPrivateOutput, {
        readonly kind: "ClientCancelled" | "Cancelled" | "Stale" | "Refused" | "TransportFailed";
      }>
    ): PreparedStructuralFireWorkerClientResult => {
      if (output.kind === "Refused" && output.workerDiagnostics !== undefined) {
        worker = output.workerDiagnostics ?? null;
        report();
      }
      return this.#terminal(output);
    };
    report();
    if (inputValue.seed === undefined
      && (known === undefined || known.seedHash !== request.seedHash)) {
      return Object.freeze({
        state: "ResyncRequired",
        objectId,
        reason: this.#resyncRequiredObjects.has(objectId)
          ? "WorkerReplicaRestarted"
          : "WorkerReplicaUnavailable"
      });
    }

    const outputs = new PrivateOutputQueue();
    const session = this.#pool.openPrivateSession(
      request.rootJobId,
      (message) => outputs.push(privateOutput(message, request.rootJobId, workerEpoch)),
      (reason) => outputs.push(Object.freeze({ kind: "TransportFailed", reason })),
      inputValue.seed === undefined ? known?.workerEpoch : undefined
    );
    if (session === null) {
      report();
      return Object.freeze({ state: "Deferred", reason: "WorkerCapacity" });
    }
    workerEpoch = session.workerEpoch;
    report();
    const store = new PreparedStructuralFirePageStore(session.workerEpoch);
    let schedulerOwnsRoot = false;
    let completed = false;
    let cancelRequested = false;
    const cancel = (): void => {
      if (cancelRequested) return;
      cancelRequested = true;
      const decision = this.#scheduler.cancel(request.rootJobId);
      if (decision?.signalWorker) {
        session.post({ kind: "Cancel", rootJobId: request.rootJobId });
      }
      store.cancel(request.rootJobId);
      outputs.push(Object.freeze({ kind: "ClientCancelled" }));
    };
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      const enqueue = this.#scheduler.enqueue(request, command);
      if (enqueue.state !== "Queued") {
        return enqueue.state === "Deferred"
          ? Object.freeze({ state: "Deferred", reason: "WorkerCapacity", enqueue })
          : Object.freeze({ state: "Rejected", reason: enqueue.reason, enqueue });
      }
      schedulerOwnsRoot = true;
      const dispatch = this.#scheduler.startNext(options.readTick(), request.rootJobId);
      if (dispatch === null
        || !this.#scheduler.bindWorkerDispatch(
          request.rootJobId,
          session.workerEpoch,
          dispatch.jobId
        )) {
        throw new Error("Prepared command is not dispatchable.");
      }
      if (options.signal?.aborted) {
        cancel();
        this.#scheduler.acknowledgeCancellation(request.rootJobId);
        this.#cancelledCount += 1;
        return Object.freeze({ state: "Cancelled" });
      }

      if (inputValue.seed !== undefined) {
        const manifest = validatePreparedStructuralFireSeedManifest(inputValue.seed.manifest);
        seedCanonicalBytes = manifestCanonicalBytes(manifest);
        if (preparedStructuralFireSeedHash(manifest) !== request.seedHash) {
          throw new RangeError("Seed manifest does not bind the retained request.");
        }
        for (const page of inputValue.seed.openPages(session.workerEpoch)) {
          const accepted = store.accept(request, page);
          if (accepted.kind === "Deferred") {
            return Object.freeze({ state: "Deferred", reason: accepted.reason });
          }
          if (accepted.kind !== "Accepted" && accepted.kind !== "AlreadyPresent") {
            throw new RangeError(`Seed page was not retained: ${accepted.kind}.`);
          }
          session.post({ kind: "SeedPage", request, envelope: page });
          const response = await outputs.next();
           if (terminalPrivateOutput(response)) return terminal(response);
          if (response.kind !== "SeedPageDecision"
            || (response.decision.kind !== "Accepted"
              && response.decision.kind !== "AlreadyPresent")) {
            if (response.kind === "SeedPageDecision" && response.decision.kind === "Deferred") {
              return Object.freeze({ state: "Deferred", reason: response.decision.reason });
            }
            throw new RangeError("Worker rejected a retained seed page.");
          }
          store.consume({
            workerEpoch: session.workerEpoch,
            rootJobId: request.rootJobId,
            direction: "Seed",
            logicalViewName: page.header.logicalViewName,
            pageIndex: page.header.pageIndex
          });
        }
        session.post({
          kind: "BindSeed",
          control: {
            schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
            kind: "BindSeed",
            workerEpoch: session.workerEpoch,
            request,
            manifest
          }
        });
        const response = await outputs.next();
         if (terminalPrivateOutput(response)) return terminal(response);
        if (response.kind !== "SeedBound" || response.result.seedHash !== request.seedHash) {
          throw new RangeError("Worker did not bind the requested seed.");
        }
        this.#knownReplicas.set(objectId, Object.freeze({
          seedHash: request.seedHash,
          workerEpoch: session.workerEpoch,
          seedCanonicalBytes
        }));
        this.#resyncRequiredObjects.delete(objectId);
      }

      const executePostStartAtMilliseconds = this.#now();
      main = Object.freeze({ ...main, executePostStartAtMilliseconds });
      report();
      session.post({
        kind: "ExecuteCommand",
        control: {
          schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
          kind: "ExecuteCommand",
          workerEpoch: session.workerEpoch,
          request,
          command,
          dispatchIndex: 0,
          attemptIndex: 0,
          previousChainHash: inputValue.previousChainHash
        }
      });
      const executePostReturnedAtMilliseconds = this.#now();
      main = Object.freeze({
        ...main,
        executePostReturnedAtMilliseconds,
        executePostDurationMilliseconds: duration(
          main.executePostStartAtMilliseconds,
          executePostReturnedAtMilliseconds
        )
      });
      report();
      const pages = new Map<PreparedStructuralFireResultViewName, ResultPageFacts>();
      while (true) {
        const output = await outputs.next();
         if (terminalPrivateOutput(output)) return terminal(output);
        if (output.kind === "PreparedResultPage") {
          if (main.firstResultOrReadyReceiptAtMilliseconds === null) {
            main = Object.freeze({
              ...main,
              firstResultOrReadyReceiptAtMilliseconds: this.#now()
            });
            report();
          }
          this.#acceptResultPage(request, store, pages, output);
          continue;
        }
        if (output.kind !== "Ready") continue;
        const readyReceiptAtMilliseconds = this.#now();
        main = Object.freeze({
          ...main,
          firstResultOrReadyReceiptAtMilliseconds:
            main.firstResultOrReadyReceiptAtMilliseconds ?? readyReceiptAtMilliseconds,
          executeReadyReceiptAtMilliseconds: readyReceiptAtMilliseconds
        });
        worker = output.workerDiagnostics ?? null;
        resultCanonicalBytes = output.ready.manifest.views
          .reduce((total, view) => total + view.byteLength, 0);
        report();
        const ready = validatePreparedStructuralFireReadyAgainstRequest(
          request,
          output.ready,
          0,
          0
        );
        this.#assertCompleteResultPages(ready, pages);
        const executeValidationCompleteAtMilliseconds = this.#now();
        main = Object.freeze({
          ...main,
          executeValidationCompleteAtMilliseconds,
          executeReceiptToValidationDurationMilliseconds: duration(
            main.firstResultOrReadyReceiptAtMilliseconds,
            executeValidationCompleteAtMilliseconds
          )
        });
        report();
        const decision = this.#scheduler.acceptReady(
          request.rootJobId,
          ready,
          options.readSource(),
          session.workerEpoch
        );
        schedulerOwnsRoot = false;
        if (decision.state === "Cancelled") {
          this.#cancelledCount += 1;
          return Object.freeze({ state: "Cancelled" });
        }
        if (decision.state === "Stale") {
          this.#staleCount += 1;
          return Object.freeze({ state: "Stale" });
        }
        if (decision.state === "Rejected") {
          this.#failedCount += 1;
          return Object.freeze({ state: "Failed", reason: decision.reason });
        }
        session.post({ kind: "ReleaseResult", rootJobId: request.rootJobId });
        const released = await outputs.next();
         if (terminalPrivateOutput(released)) return terminal(released);
        if (released.kind !== "ReleasedResult") {
          throw new RangeError("Worker did not acknowledge Prepared result release.");
        }
        completed = true;
        this.#completedCount += 1;
        return Object.freeze({
          state: "Completed",
          ready: decision.ready,
          workerEpoch: session.workerEpoch
        });
      }
    } catch (error) {
      this.#failedCount += 1;
      return Object.freeze({
        state: "Failed",
        reason: error instanceof Error
          ? error.message
          : "Prepared Structural Fire private worker client failed."
      });
    } finally {
      options.signal?.removeEventListener("abort", cancel);
      if (schedulerOwnsRoot) {
        const cancellation = this.#scheduler.cancel(request.rootJobId);
        if (cancellation?.signalWorker && !completed) {
          try { session.post({ kind: "Cancel", rootJobId: request.rootJobId }); }
          catch { /* Worker failure already made the root terminal. */ }
        }
        if (cancellation !== null) this.#scheduler.acknowledgeCancellation(request.rootJobId);
        else this.#scheduler.acknowledgeWorkerFailure(request.rootJobId);
      }
      store.dispose();
      session.close();
    }
  }

  #acceptResultPage(
    request: PreparedStructuralFireRequest,
    store: PreparedStructuralFirePageStore,
    pages: Map<PreparedStructuralFireResultViewName, ResultPageFacts>,
    output: Extract<PreparedStructuralFirePrivateWorkerOutput, { readonly kind: "PreparedResultPage" }>
  ): void {
    const envelope = output.envelope;
    if (envelope.header.direction !== "PreparedResult") {
      throw new RangeError("Worker emitted a non-result page during result delivery.");
    }
    const decision = store.accept(request, envelope);
    if (decision.kind !== "Accepted") {
      throw new RangeError(`Prepared result page was not accepted: ${decision.kind}.`);
    }
    const name = envelope.header.logicalViewName as PreparedStructuralFireResultViewName;
    let facts = pages.get(name);
    if (facts === undefined) {
      facts = {
        accumulator: new PreparedStructuralFirePhysicalPageAccumulator("PreparedResult", name),
        logicalViewRoot: envelope.header.logicalViewRoot,
        pageCount: 0,
        byteLength: 0
      };
      pages.set(name, facts);
    }
    if (envelope.header.pageIndex !== facts.pageCount
      || envelope.header.byteOffset !== facts.byteLength
      || envelope.header.logicalViewRoot !== facts.logicalViewRoot) {
      throw new RangeError("Prepared result pages are incomplete or out of order.");
    }
    facts.accumulator.append(envelope.header);
    facts.pageCount += 1;
    facts.byteLength += envelope.header.byteLength;
    store.consume({
      workerEpoch: envelope.workerEpoch,
      rootJobId: envelope.rootJobId,
      direction: "PreparedResult",
      logicalViewName: envelope.header.logicalViewName,
      pageIndex: envelope.header.pageIndex
    });
  }

  #assertCompleteResultPages(
    ready: PreparedStructuralFireReady,
    pages: ReadonlyMap<PreparedStructuralFireResultViewName, ResultPageFacts>
  ): void {
    for (const descriptor of ready.manifest.views) {
      const facts = pages.get(descriptor.logicalViewName as PreparedStructuralFireResultViewName);
      if (descriptor.pageCount === 0) {
        if (facts !== undefined) throw new RangeError("Empty result view emitted pages.");
        const empty = new PreparedStructuralFirePhysicalPageAccumulator(
          "PreparedResult",
          descriptor.logicalViewName
        ).finish();
        if (empty.physicalPageRoot !== descriptor.physicalPageRoot) {
          throw new RangeError("Empty result view physical root is invalid.");
        }
        continue;
      }
      if (facts === undefined
        || facts.pageCount !== descriptor.pageCount
        || facts.byteLength !== descriptor.byteLength
        || facts.logicalViewRoot !== descriptor.logicalViewRoot
        || facts.accumulator.finish().physicalPageRoot !== descriptor.physicalPageRoot) {
        throw new RangeError("Prepared result manifest has incomplete physical pages.");
      }
    }
  }

  #terminal(
    output: Extract<QueuedPrivateOutput, {
      readonly kind: "ClientCancelled" | "Cancelled" | "Stale" | "Refused" | "TransportFailed";
    }>
  ): PreparedStructuralFireWorkerClientResult {
    if (output.kind === "ClientCancelled" || output.kind === "Cancelled") {
      this.#cancelledCount += 1;
      return Object.freeze({ state: "Cancelled" });
    }
    if (output.kind === "Stale") {
      this.#staleCount += 1;
      return Object.freeze({ state: "Stale" });
    }
    this.#failedCount += 1;
    return Object.freeze({ state: "Failed", reason: terminalReason(output) });
  }

  readTelemetry(): PreparedStructuralFireWorkerClientTelemetry {
    return Object.freeze({
      scheduler: this.#scheduler.readTelemetry(),
      pool: this.#pool.snapshot(),
      completedCount: this.#completedCount,
      cancelledCount: this.#cancelledCount,
      staleCount: this.#staleCount,
      failedCount: this.#failedCount
    });
  }

  async dispose(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    await this.#pool.shutdown();
    await Promise.all([...this.#tails.values()]);
    this.#tails.clear();
    this.#knownReplicas.clear();
    this.#resyncRequiredObjects.clear();
  }
}
