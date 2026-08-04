import {
  PREPARED_STRUCTURAL_FIRE_JOB_KIND,
  WorkerCancellationRegistry,
  algorithmVersion,
  byteCount,
  contentRevision,
  fnv1aBytes,
  isMessageRecord,
  transferListFor,
  validateTransferableBundle,
  yieldToWorkerEventLoop,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerTargetKey,
  type HostToWorkerMessage,
  type PreparedStructuralFirePrivateInputMessage,
  type PreparedStructuralFirePrivateOutputMessage,
  type TransferableBufferBundle,
  type WorkerEpoch,
  type WorkerJobId,
  type WorkerJobRequest,
  type WorkerJobResult,
  type WorkerToHostMessage
} from "../../workers";
import {
  applyStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralDestructionCommand,
  type StructuralObject
} from "../../voxel/structural";
import { readStructuralConnectivityWork } from "../../voxel/structural/connectivityDiagnostics";
import {
  createPreparedStructuralFireResultBundle,
  decodePreparedStructuralFireInput,
  encodePreparedStructuralFireResultDelta,
  encodePreparedStructuralFireWorkerOutput,
  type PreparedStructuralFireAdoptionReceipt
} from "./preparedStructuralFireCodec";
import {
  PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION,
  PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION,
  PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
  createPreparedStructuralFireJob,
  createPreparedStructuralFireResultDetails,
  type PreparedStructuralFireBindSeedControl,
  type PreparedStructuralFireExecuteCommandControl,
  type PreparedStructuralFireJob,
  type PreparedStructuralFirePrivateWorkerDiagnostics,
  type PreparedStructuralFirePrivateWorkerOperationDiagnostics,
  type PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver,
  type PreparedStructuralFirePrivateWorkerPrepareSeedStage,
  type PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics,
  type PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics,
  type PreparedStructuralFirePrivateWorkerOutput,
  type PreparedStructuralFireReleaseSeedControl,
  type PreparedStructuralFireResultDraft,
  type PreparedStructuralFireWorkCounters
} from "./preparedStructuralFireProtocol";
import { PreparedStructuralFirePageStore } from "./preparedStructuralFirePageStore";
import {
  PreparedStructuralFireOwnerPayloadValidator,
  createPreparedStructuralFireCanonicalItemSource,
  createPreparedStructuralFireContinuationCursor,
  createPreparedStructuralFireLogicalViewDescriptor,
  createPreparedStructuralFireLogicalViewFacts,
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFirePhysicalPageFacts,
  createPreparedStructuralFireReady,
  createPreparedStructuralFireResultManifest,
  createPreparedStructuralFireResultReceipt,
  createPreparedStructuralFireResultViewProjections,
  preparedStructuralFireJobId,
  preparedStructuralFireSeedHash,
  streamPreparedStructuralFireLogicalView,
  streamPreparedStructuralFirePages,
  validatePreparedStructuralFireCommand,
  validatePreparedStructuralFireRequest,
  validatePreparedStructuralFireSeedManifest,
  type PreparedStructuralFireItemSource,
  type PreparedStructuralFireResultViewProjection
} from "./preparedStructuralFireWireCodec";
import type {
  PreparedStructuralFireSeedViewName,
  PreparedStructuralFireHash,
  PreparedStructuralFireLogicalViewDescriptor,
  PreparedStructuralFirePageEnvelope,
  PreparedStructuralFireReady,
  PreparedStructuralFireRequest,
  PreparedStructuralFireSeedManifest
} from "./preparedStructuralFireWire";
import { PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES } from "./preparedStructuralFireWire";
import {
  createSurfaceTreePreparedFireWorkerInput,
  type SurfaceTreeRuntimeState
} from "../vegetation/surfaceTreeRuntime";
import type { SurfaceTreeCollisionHit } from "../vegetation/surfaceTreeCollision";
import type { PreparedStructuralFireWorkerClientInput } from "./preparedStructuralFireWorkerClient";

export type PreparedStructuralFireWorkerMessageEmitter = (
  message: WorkerToHostMessage,
  transfer?: readonly Transferable[]
) => void;

interface PreparedRootState {
  readonly source: StructuralObject;
  readonly command: StructuralDestructionCommand;
  result?: StructuralAcceptedCommandResult;
}

interface PreparedExecutionOutput {
  readonly bundle: TransferableBufferBundle;
  readonly result: WorkerJobResult;
}

interface PendingReplicaAdoption {
  readonly rootJobId: string;
  readonly result: StructuralAcceptedCommandResult;
  readonly resultHash: string;
  readonly receiptHash: string;
}

interface PreparedBatchScope {
  readonly rootJobId: string;
  readonly objectId: string;
}

const MAX_PREPARED_STRUCTURAL_REPLICAS = 8;

class PreparedWorkerCancelled extends Error {}

type WorkerDiagnosticClock = () => number | null;

const safeDiagnosticCall = (call: (() => void) | undefined): void => {
  try {
    call?.();
  } catch {
    // Diagnostics cannot alter seed binding decisions.
  }
};

const monotonicWorkerDiagnosticClock = (
  source: () => number | null
): WorkerDiagnosticClock => {
  let previousValidMark: number | null = null;
  return () => {
    try {
      const value = source();
      if (typeof value !== "number"
        || !Number.isFinite(value)
        || value < 0
        || (previousValidMark !== null && value < previousValidMark)) {
        return null;
      }
      previousValidMark = value;
      return value;
    } catch {
      return null;
    }
  };
};

const workerOperationDiagnostics = (
  receiptAtMilliseconds: number | null,
  computeStartedAtMilliseconds: number | null,
  computeCompletedAtMilliseconds: number | null
): Readonly<PreparedStructuralFirePrivateWorkerOperationDiagnostics> => Object.freeze({
  receiptAtMilliseconds,
  computeStartedAtMilliseconds,
  computeCompletedAtMilliseconds: computeStartedAtMilliseconds === null
    ? null
    : computeCompletedAtMilliseconds,
  computeDurationMilliseconds: computeStartedAtMilliseconds === null
    || computeCompletedAtMilliseconds === null
    || computeCompletedAtMilliseconds < computeStartedAtMilliseconds
    ? null
    : computeCompletedAtMilliseconds - computeStartedAtMilliseconds
});

const workerReceiptDiagnostics = (
  receiptAtMilliseconds: number | null
): Readonly<PreparedStructuralFirePrivateWorkerOperationDiagnostics> => Object.freeze({
  receiptAtMilliseconds,
  computeStartedAtMilliseconds: null,
  computeCompletedAtMilliseconds: null,
  computeDurationMilliseconds: null
});

type MutableDiagnosticSpan = {
  startAtMilliseconds: number | null;
  endAtMilliseconds: number | null;
  durationMilliseconds: number | null;
};

type MutableDiagnosticView = {
  readonly logicalViewName: PreparedStructuralFireSeedViewName;
  itemCount: number | null;
  byteLength: number | null;
  pageCount: number | null;
  decodeDurationMilliseconds: number | null;
  decodeStartAtMilliseconds: number | null;
};

const PREPARE_SEED_DIAGNOSTIC_STAGES: readonly PreparedStructuralFirePrivateWorkerPrepareSeedStage[] = [
  "constructSeed",
  "materializeAndRetainPages",
  "bindSeed",
  "treeAndObjectCanonicalValidation",
  "structuralConnectivity",
  "structuralMass",
  "authorityPublicationAndFinalCompare",
  "collisionCanonicalValidation",
  "collisionPublicationAndIndex"
];

const emptyDiagnosticSpan = (): MutableDiagnosticSpan => ({
  startAtMilliseconds: null,
  endAtMilliseconds: null,
  durationMilliseconds: null
});

class PrepareSeedDiagnosticsRecorder
  implements PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver {
  readonly #now: WorkerDiagnosticClock;
  readonly #spans: Record<PreparedStructuralFirePrivateWorkerPrepareSeedStage, MutableDiagnosticSpan>;
  readonly #views: MutableDiagnosticView[];
  #authority: Readonly<{
    readonly brickCount: number;
    readonly occupiedCellCount: number;
    readonly anchorCount: number;
    readonly jointCount: number;
  }> | null = null;
  #connectivity: PreparedStructuralFirePrivateWorkerSubphaseFacts["connectivity"] = null;
  #mass: PreparedStructuralFirePrivateWorkerSubphaseFacts["mass"] = null;
  #collision: PreparedStructuralFirePrivateWorkerSubphaseFacts["collision"] = null;
  readonly #physics: Readonly<{
    readonly terrainColliderCount: number;
    readonly bodyCount: number;
  }>;

  constructor(
    state: Readonly<SurfaceTreeRuntimeState>,
    now: WorkerDiagnosticClock
  ) {
    this.#now = now;
    this.#spans = Object.fromEntries(
      PREPARE_SEED_DIAGNOSTIC_STAGES.map((stage) => [stage, emptyDiagnosticSpan()])
    ) as Record<PreparedStructuralFirePrivateWorkerPrepareSeedStage, MutableDiagnosticSpan>;
    this.#views = PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES.map((logicalViewName) => ({
      logicalViewName,
      itemCount: null,
      byteLength: null,
      pageCount: null,
      decodeDurationMilliseconds: null,
      decodeStartAtMilliseconds: null
    }));
    this.#physics = Object.freeze({
      terrainColliderCount: state.physicsWorld.terrainColliders.length,
      bodyCount: state.physicsWorld.bodies.length
    });
  }

  start(stage: PreparedStructuralFirePrivateWorkerPrepareSeedStage): void {
    try {
      const span = this.#spans[stage];
      if (span.startAtMilliseconds === null) span.startAtMilliseconds = this.#now();
    } catch {
      // Diagnostics are observational and cannot change the worker result.
    }
  }

  finish(
    stage: PreparedStructuralFirePrivateWorkerPrepareSeedStage,
    facts?: Readonly<{
      readonly authority?: Readonly<{
        readonly brickCount: number;
        readonly occupiedCellCount: number;
        readonly anchorCount: number;
        readonly jointCount: number;
      }>;
      readonly connectivity?: PreparedStructuralFirePrivateWorkerSubphaseFacts["connectivity"];
      readonly mass?: PreparedStructuralFirePrivateWorkerSubphaseFacts["mass"];
      readonly collision?: PreparedStructuralFirePrivateWorkerSubphaseFacts["collision"];
    }>
  ): void {
    try {
      const span = this.#spans[stage];
      if (span.startAtMilliseconds === null || span.endAtMilliseconds !== null) return;
      span.endAtMilliseconds = this.#now();
      span.durationMilliseconds = span.endAtMilliseconds === null
        ? null
        : span.endAtMilliseconds - span.startAtMilliseconds;
      if (facts?.authority !== undefined) this.#authority = Object.freeze({ ...facts.authority });
      if (facts?.connectivity !== undefined) this.#connectivity = facts.connectivity;
      if (facts?.mass !== undefined && facts.mass !== null) {
        this.#mass = Object.freeze({ occupiedVoxelCount: facts.mass.occupiedVoxelCount });
      }
      if (facts?.collision !== undefined) this.#collision = facts.collision;
    } catch {
      // Diagnostics are observational and cannot change the worker result.
    }
  }

  startView(logicalViewName: PreparedStructuralFireSeedViewName): void {
    try {
      const view = this.#views.find((candidate) => candidate.logicalViewName === logicalViewName);
      if (view !== undefined && view.decodeStartAtMilliseconds === null) {
        view.decodeStartAtMilliseconds = this.#now();
      }
    } catch {
      // Diagnostics are observational and cannot change the worker result.
    }
  }

  finishView(logicalViewName: PreparedStructuralFireSeedViewName): void {
    try {
      const view = this.#views.find((candidate) => candidate.logicalViewName === logicalViewName);
      if (view === undefined || view.decodeStartAtMilliseconds === null
        || view.decodeDurationMilliseconds !== null) return;
      const endAtMilliseconds = this.#now();
      view.decodeDurationMilliseconds = endAtMilliseconds === null
        ? null
        : endAtMilliseconds - view.decodeStartAtMilliseconds;
      view.decodeStartAtMilliseconds = null;
    } catch {
      // Diagnostics are observational and cannot change the worker result.
    }
  }

  setManifest(manifest: Readonly<PreparedStructuralFireSeedManifest>): void {
    try {
      for (const view of this.#views) {
        const descriptor = manifest.views.find((candidate) =>
          candidate.logicalViewName === view.logicalViewName);
        if (descriptor === undefined) continue;
        view.itemCount = descriptor.itemCount;
        view.byteLength = descriptor.byteLength;
        view.pageCount = descriptor.pageCount;
      }
    } catch {
      // Diagnostics are observational and cannot change the worker result.
    }
  }

  read(): Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics> {
    const span = (value: MutableDiagnosticSpan): Readonly<MutableDiagnosticSpan> =>
      Object.freeze({ ...value });
    return Object.freeze({
      constructSeed: span(this.#spans.constructSeed),
      materializeAndRetainPages: span(this.#spans.materializeAndRetainPages),
      bindSeed: span(this.#spans.bindSeed),
      views: Object.freeze(this.#views.map((view) => Object.freeze({
        logicalViewName: view.logicalViewName,
        itemCount: view.itemCount,
        byteLength: view.byteLength,
        pageCount: view.pageCount,
        decodeDurationMilliseconds: view.decodeDurationMilliseconds
      }))),
      authority: Object.freeze({
        treeAndObjectCanonicalValidation: span(this.#spans.treeAndObjectCanonicalValidation),
        structuralConnectivity: span(this.#spans.structuralConnectivity),
        structuralMass: span(this.#spans.structuralMass),
        authorityPublicationAndFinalCompare: span(this.#spans.authorityPublicationAndFinalCompare)
      }),
      collision: Object.freeze({
        collisionCanonicalValidation: span(this.#spans.collisionCanonicalValidation),
        collisionPublicationAndIndex: span(this.#spans.collisionPublicationAndIndex)
      }),
      facts: Object.freeze({
        authority: this.#authority,
        connectivity: this.#connectivity,
        mass: this.#mass,
        collision: this.#collision,
        physics: this.#physics,
        colliderDerivation: "NotApplicableBodyFreeSeed" as const
      })
    });
  }
}

type PreparedStructuralFirePrivateWorkerSubphaseFacts =
  PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics["facts"];

const workerDiagnostics = (
  prepareSeed: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics> | null,
  execute: Readonly<PreparedStructuralFirePrivateWorkerOperationDiagnostics> | null
): Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> => Object.freeze({
  clockDomain: "Worker" as const,
  prepareSeed,
  execute
});

const workerPrepareSeedDiagnostics = (
  operation: Readonly<PreparedStructuralFirePrivateWorkerOperationDiagnostics>,
  subphase: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics>
): Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedDiagnostics> => Object.freeze({
  ...operation,
  ...subphase
});

export type PreparedStructuralFirePrivateWorkerMessageEmitter = (
  output: PreparedStructuralFirePrivateWorkerOutput,
  transfer?: readonly Transferable[]
) => void;

export type PreparedStructuralFirePrivateWorkerInput =
  | Readonly<{
      readonly kind: "PrepareSeed";
      readonly state: Readonly<SurfaceTreeRuntimeState>;
      readonly input: Readonly<{
        readonly fireCommandId: string;
        readonly hit: Readonly<SurfaceTreeCollisionHit>;
        readonly simulationTick: number;
      }>;
    }>
  | Readonly<{
      readonly kind: "SeedPage";
      readonly request: Readonly<PreparedStructuralFireRequest>;
      readonly envelope: Readonly<PreparedStructuralFirePageEnvelope>;
    }>
  | Readonly<{
      readonly kind: "BindSeed";
      readonly control: Readonly<PreparedStructuralFireBindSeedControl>;
    }>
  | Readonly<{
      readonly kind: "ExecuteCommand";
      readonly control: Readonly<PreparedStructuralFireExecuteCommandControl>;
    }>
  | Readonly<{ readonly kind: "Cancel"; readonly rootJobId: string }>
  | Readonly<{ readonly kind: "ReleaseResult"; readonly rootJobId: string }>
  | Readonly<{
      readonly kind: "ReleaseSeed";
      readonly control: Readonly<PreparedStructuralFireReleaseSeedControl>;
    }>;

type PreparedStructuralFirePrivateWorkerReadyBridgeOutput = Readonly<{
  readonly kind: "Ready";
  readonly ready: Readonly<PreparedStructuralFireReady>;
  readonly workerDiagnostics?: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics>;
}>;

export type PreparedStructuralFirePrivateWorkerBridgeOutput =
  | Exclude<PreparedStructuralFirePrivateWorkerOutput, { readonly kind: "Ready" }>
  | PreparedStructuralFirePrivateWorkerReadyBridgeOutput
  | Readonly<{
      readonly kind: "SeedPrepared";
      readonly input: Readonly<PreparedStructuralFireWorkerClientInput>;
      readonly workerDiagnostics?: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics>;
    }>
  | Readonly<{
      readonly kind: "SeedPageDecision";
      readonly decision: ReturnType<PreparedStructuralFirePrivateWorkerRuntimeV2["acceptSeedPage"]>;
    }>
  | Readonly<{
      readonly kind: "SeedBound";
      readonly result: ReturnType<PreparedStructuralFirePrivateWorkerRuntimeV2["bindSeed"]>;
    }>
  | Readonly<{ readonly kind: "ReleasedResult" }>
  | Readonly<{ readonly kind: "ReleasedSeed"; readonly released: boolean }>
  | Readonly<{ readonly kind: "Cancelled" }>
  | Readonly<{ readonly kind: "Stale" }>
  | Readonly<{
      readonly kind: "Refused";
      readonly reason: string;
      readonly workerDiagnostics?: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics>;
    }>;

interface PreparedStructuralFireSeedReplica {
  readonly manifest: Readonly<PreparedStructuralFireSeedManifest>;
  readonly owner: PreparedStructuralFireOwnerPayloadValidator;
}

const privateWorkerEpoch = (value: number): WorkerEpoch => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Private Prepared Fire workerEpoch must be a non-negative safe integer.");
  }
  return workerEpoch(value);
};

const privateWorkerIndex = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${path} must be a non-negative safe integer.`);
  }
  return value;
};

const privateViewSources = (
  projection: Readonly<PreparedStructuralFireResultViewProjection>
): (() => Iterable<Readonly<PreparedStructuralFireItemSource>>) => function* () {
  for (const item of projection.openItems()) {
    yield createPreparedStructuralFireCanonicalItemSource(projection.logicalViewName, item);
  }
};

/** Private V2 composition only. Runtime adoption remains a Phase-5 owner. */
export class PreparedStructuralFirePrivateWorkerRuntimeV2 {
  readonly #replicas = new Map<PreparedStructuralFireHash, PreparedStructuralFireSeedReplica>();
  readonly #cancelledRoots = new Set<string>();
  readonly #now: WorkerDiagnosticClock;
  #pageStore: PreparedStructuralFirePageStore;
  #workerEpoch: number;
  #activeRootJobId: string | null = null;
  #disposed = false;
  #replicaSeedCount = 0;

  constructor(
    workerEpoch: number,
    private readonly emit: PreparedStructuralFirePrivateWorkerMessageEmitter,
    now: () => number | null = () => performance.now()
  ) {
    this.#now = monotonicWorkerDiagnosticClock(now);
    this.#workerEpoch = privateWorkerEpoch(workerEpoch);
    this.#pageStore = new PreparedStructuralFirePageStore(this.#workerEpoch);
  }

  prepareSeed(
    state: Readonly<SurfaceTreeRuntimeState>,
    input: Readonly<{
      readonly fireCommandId: string;
      readonly hit: Readonly<SurfaceTreeCollisionHit>;
      readonly simulationTick: number;
    }>,
    observeDiagnostics?: (
      diagnostics: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics>
    ) => void
  ): Readonly<PreparedStructuralFireWorkerClientInput> {
    const diagnostics = new PrepareSeedDiagnosticsRecorder(state, this.#now);
    const report = (): void => {
      try {
        observeDiagnostics?.(diagnostics.read());
      } catch {
        // Diagnostics are observational and cannot change the worker result.
      }
    };
    try {
      diagnostics.start("constructSeed");
      const prepared = createSurfaceTreePreparedFireWorkerInput(state, input);
      diagnostics.finish("constructSeed");
      if (prepared.seed === undefined) {
        throw new RangeError("Prepared Structural Fire seed preparation produced no seed.");
      }
      diagnostics.setManifest(prepared.seed.manifest);
      diagnostics.start("materializeAndRetainPages");
      for (const envelope of prepared.seed.openPages(workerEpoch(this.#workerEpoch))) {
        const accepted = this.acceptSeedPage(prepared.request, envelope);
        if (accepted.kind !== "Accepted" && accepted.kind !== "AlreadyPresent") {
          throw new RangeError(`Prepared seed page was not retained: ${accepted.kind}.`);
        }
      }
      diagnostics.finish("materializeAndRetainPages");
      diagnostics.start("bindSeed");
      const bound = this.bindSeed({
        schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
        kind: "BindSeed",
        workerEpoch: workerEpoch(this.#workerEpoch),
        request: prepared.request,
        manifest: prepared.seed.manifest
      }, diagnostics);
      diagnostics.finish("bindSeed");
      if (bound.seedHash !== prepared.request.seedHash) {
        throw new RangeError("Prepared seed worker commitment does not match its request.");
      }
      report();
      return Object.freeze({
        request: prepared.request,
        command: prepared.command,
        previousChainHash: prepared.previousChainHash,
        seedManifest: prepared.seed.manifest
      });
    } catch (error) {
      report();
      throw error;
    }
  }

  acceptSeedPage(
    request: Readonly<PreparedStructuralFireRequest>,
    envelope: Readonly<PreparedStructuralFirePageEnvelope>
  ) {
    this.#requireActiveEpoch(envelope.workerEpoch);
    if (envelope.header.direction !== "Seed") {
      throw new RangeError("Private Prepared Fire seed input requires Seed pages.");
    }
    return this.#pageStore.accept(request, envelope);
  }

  bindSeed(
    control: Readonly<PreparedStructuralFireBindSeedControl>,
    diagnostics?: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
  ): Readonly<{
    readonly kind: "Seeded" | "AlreadyPresent";
    readonly seedHash: PreparedStructuralFireHash;
  }> {
    this.#requireControl(control.schemaVersion, control.kind, "BindSeed", control.workerEpoch);
    const request = validatePreparedStructuralFireRequest(control.request);
    const manifest = validatePreparedStructuralFireSeedManifest(control.manifest);
    const seedHash = preparedStructuralFireSeedHash(manifest);
    if (request.seedHash !== seedHash) {
      this.#pageStore.refuse(request.rootJobId);
      throw new RangeError("Private Prepared Fire request does not bind its seed manifest.");
    }
    const existing = this.#replicas.get(seedHash);
    if (existing !== undefined) {
      if (existing.manifest.manifestHash !== manifest.manifestHash) {
        throw new RangeError("Private Prepared Fire seed hash collides with a different manifest.");
      }
      for (const descriptor of manifest.views) {
        for (let pageIndex = 0; pageIndex < descriptor.pageCount; pageIndex += 1) {
          this.#pageStore.consume({
            workerEpoch: this.#workerEpoch,
            rootJobId: request.rootJobId,
            direction: "Seed",
            logicalViewName: descriptor.logicalViewName,
            pageIndex
          });
        }
      }
      return Object.freeze({ kind: "AlreadyPresent", seedHash });
    }

    const owner = new PreparedStructuralFireOwnerPayloadValidator(diagnostics);
    try {
      for (const descriptor of manifest.views) {
        const pages = function* (
          store: PreparedStructuralFirePageStore,
          workerEpoch: number,
          rootJobId: string
        ) {
          for (let pageIndex = 0; pageIndex < descriptor.pageCount; pageIndex += 1) {
            const envelope = store.consume({
              workerEpoch,
              rootJobId,
              direction: "Seed",
              logicalViewName: descriptor.logicalViewName,
              pageIndex
            });
            if (envelope === undefined) {
              throw new RangeError(`Missing seed page ${descriptor.logicalViewName}/${pageIndex}.`);
            }
            yield Object.freeze({ header: envelope.header, bytes: envelope.bytes });
          }
        };
        const logicalViewName = descriptor.logicalViewName as PreparedStructuralFireSeedViewName;
        safeDiagnosticCall(() => diagnostics?.startView(logicalViewName));
        owner.decodeView(descriptor, pages(this.#pageStore, this.#workerEpoch, request.rootJobId));
        safeDiagnosticCall(() => diagnostics?.finishView(logicalViewName));
      }
      if (owner.bindSeedManifest(manifest) !== seedHash) {
        throw new RangeError("Private Prepared Fire seed commitment is invalid.");
      }
    } catch (error) {
      this.#pageStore.refuse(request.rootJobId);
      throw error;
    }
    this.#replicas.set(seedHash, Object.freeze({ manifest, owner }));
    this.#replicaSeedCount += 1;
    return Object.freeze({ kind: "Seeded", seedHash });
  }

  executeCommand(
    control: Readonly<PreparedStructuralFireExecuteCommandControl>,
    markComputeStarted?: () => void
  ): PreparedStructuralFireReady {
    this.#requireControl(
      control.schemaVersion,
      control.kind,
      "ExecuteCommand",
      control.workerEpoch
    );
    if (this.#activeRootJobId !== null) {
      throw new RangeError("Private Prepared Fire worker accepts one command at a time.");
    }
    const request = validatePreparedStructuralFireRequest(control.request);
    const command = validatePreparedStructuralFireCommand(control.command);
    if (request.seedHash !== command.seedHash || request.commandHash !== command.commandHash) {
      throw new RangeError("Private Prepared Fire request does not bind its command.");
    }
    const replica = this.#replicas.get(request.seedHash);
    if (replica === undefined) throw new RangeError("Private Prepared Fire seed replica is unavailable.");
    const dispatchIndex = privateWorkerIndex(control.dispatchIndex, "dispatchIndex");
    const attemptIndex = privateWorkerIndex(control.attemptIndex, "attemptIndex");
    this.#activeRootJobId = request.rootJobId;
    try {
      this.#throwIfCancelled(request.rootJobId);
      markComputeStarted?.();
      const owner = replica.owner.forkSeed();
      const prepared = owner.bindCommand(command);
      const projections = createPreparedStructuralFireResultViewProjections(prepared);
      const descriptors: PreparedStructuralFireLogicalViewDescriptor[] = [];
      for (const [viewOrdinal, projection] of projections.entries()) {
        const openItems = privateViewSources(projection);
        const logical = createPreparedStructuralFireLogicalViewFacts(
          projection.logicalViewName,
          openItems
        );
        const openBytes = () => streamPreparedStructuralFireLogicalView(
          projection.logicalViewName,
          openItems
        );
        const physical = createPreparedStructuralFirePhysicalPageFacts(
          logical,
          "PreparedResult",
          openBytes
        );
        descriptors.push(createPreparedStructuralFireLogicalViewDescriptor(
          viewOrdinal,
          logical,
          "PreparedResult",
          physical
        ));
      }

      for (const [viewOrdinal, projection] of projections.entries()) {
        const descriptor = descriptors[viewOrdinal];
        const openItems = privateViewSources(projection);
        const openBytes = () => streamPreparedStructuralFireLogicalView(
          projection.logicalViewName,
          openItems
        );
        const pages = function* (
          runtime: PreparedStructuralFirePrivateWorkerRuntimeV2
        ) {
          for (const page of streamPreparedStructuralFirePages(
            descriptor,
            "PreparedResult",
            openBytes
          )) {
            runtime.#throwIfCancelled(request.rootJobId);
            const envelope = createPreparedStructuralFirePageEnvelope(
              request,
              runtime.#workerEpoch,
              page.header,
              page.bytes
            );
            runtime.emit(
              Object.freeze({ kind: "PreparedResultPage", envelope }),
              [envelope.bytes.buffer]
            );
            yield page;
          }
        };
        owner.decodeView(descriptor, pages(this));
      }

      this.#throwIfCancelled(request.rootJobId);
      const manifest = createPreparedStructuralFireResultManifest(request, descriptors);
      const terminalJobId = preparedStructuralFireJobId(request, dispatchIndex, attemptIndex);
      const terminalContinuation = createPreparedStructuralFireContinuationCursor({
        rootJobId: request.rootJobId,
        requestHash: request.requestHash,
        domain: "result.work",
        lastItemKey: "@",
        ordinal: 1,
        globalOrdinal: descriptors.reduce((count, descriptor) => count + descriptor.itemCount, 0)
      }, control.previousChainHash);
      const transaction = owner.createTransaction({
        request,
        manifest,
        dispatchIndex,
        attemptIndex,
        terminalJobId,
        previousChainHash: control.previousChainHash,
        terminalContinuation
      });
      const receipt = createPreparedStructuralFireResultReceipt(transaction);
      const ready = createPreparedStructuralFireReady(manifest, transaction, receipt);
      this.#throwIfCancelled(request.rootJobId);
      this.emit(Object.freeze({ kind: "Ready", ready }));
      return ready;
    } catch (error) {
      if (!this.#cancelledRoots.has(request.rootJobId)) {
        this.#pageStore.refuse(request.rootJobId);
      }
      throw error;
    } finally {
      this.#activeRootJobId = null;
    }
  }

  cancel(rootJobId: string): void {
    this.#cancelledRoots.add(rootJobId);
    this.#pageStore.cancel(rootJobId);
  }

  releaseResult(rootJobId: string): void {
    this.#cancelledRoots.delete(rootJobId);
  }

  releaseSeed(control: Readonly<PreparedStructuralFireReleaseSeedControl>): boolean {
    this.#requireControl(control.schemaVersion, control.kind, "ReleaseSeed", control.workerEpoch);
    return this.#replicas.delete(control.seedHash);
  }

  restart(workerEpoch: number): void {
    const nextEpoch = privateWorkerEpoch(workerEpoch);
    if (!this.#pageStore.restart(nextEpoch)) {
      throw new RangeError("Private Prepared Fire worker epoch must advance on restart.");
    }
    this.#workerEpoch = nextEpoch;
    this.#replicas.clear();
    this.#cancelledRoots.clear();
    this.#activeRootJobId = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#pageStore.dispose();
    this.#replicas.clear();
    this.#cancelledRoots.clear();
    this.#activeRootJobId = null;
    this.#disposed = true;
  }

  readState(): Readonly<{
    readonly workerEpoch: number;
    readonly replicaCount: number;
    readonly replicaSeedCount: number;
    readonly activeResultCount: number;
    readonly retainedInputPageCount: number;
    readonly retainedInputBytes: number;
  }> {
    const store = this.#pageStore.readState();
    return Object.freeze({
      workerEpoch: this.#workerEpoch,
      replicaCount: this.#replicas.size,
      replicaSeedCount: this.#replicaSeedCount,
      activeResultCount: this.#activeRootJobId === null ? 0 : 1,
      retainedInputPageCount: store.retainedPageCount,
      retainedInputBytes: store.retainedBytes
    });
  }

  #requireControl(
    schemaVersion: string,
    kind: string,
    expectedKind: string,
    workerEpoch: number
  ): void {
    this.#requireActiveEpoch(workerEpoch);
    if (schemaVersion !== PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION
      || kind !== expectedKind) {
      throw new RangeError("Private Prepared Fire control version or kind is invalid.");
    }
  }

  #requireActiveEpoch(workerEpoch: number): void {
    if (this.#disposed) throw new RangeError("Private Prepared Fire worker is disposed.");
    if (privateWorkerEpoch(workerEpoch) !== this.#workerEpoch) {
      throw new RangeError("Private Prepared Fire worker epoch is stale.");
    }
  }

  #throwIfCancelled(rootJobId: string): void {
    if (this.#cancelledRoots.has(rootJobId)) throw new PreparedWorkerCancelled();
  }
}

const privateInput = (value: unknown): PreparedStructuralFirePrivateWorkerInput => {
  if (typeof value !== "object"
    || value === null
    || !("kind" in value)
    || typeof value.kind !== "string") {
    throw new RangeError("Private Prepared Fire payload must be a discriminated record.");
  }
  return value as PreparedStructuralFirePrivateWorkerInput;
};

/** Closed additive bridge; generic V1 jobs remain owned by the existing runtime. */
export class PreparedStructuralFireDedicatedWorkerRuntime {
  readonly #v1: PreparedStructuralFireWorkerRuntime;
  #v2: PreparedStructuralFirePrivateWorkerRuntimeV2 | undefined;
  #workerEpoch: WorkerEpoch | undefined;
  #activeExecuteTiming: {
    readonly receiptAtMilliseconds: number | null;
    computeStartedAtMilliseconds: number | null;
  } | null = null;
  readonly #readClock: WorkerDiagnosticClock;

  constructor(
    private readonly emit: PreparedStructuralFireWorkerMessageEmitter,
    now: () => number = () => performance.now()
  ) {
    this.#readClock = monotonicWorkerDiagnosticClock(now);
    this.#v1 = new PreparedStructuralFireWorkerRuntime(emit);
  }

  #readNow(): number | null { return this.#readClock(); }

  handleMessage(message: HostToWorkerMessage): void {
    if (message.type === "InitializeWorker") {
      this.#workerEpoch = message.workerEpoch;
      this.#v2 = new PreparedStructuralFirePrivateWorkerRuntimeV2(
        message.workerEpoch,
        (output, transfer = []) => {
          const bridgedOutput = output.kind !== "Ready"
            ? output
            : Object.freeze({
                ...output,
                workerDiagnostics: workerDiagnostics(
                  null,
                  this.#activeExecuteTiming === null
                    || this.#activeExecuteTiming.computeStartedAtMilliseconds === null
                    ? null
                    : workerOperationDiagnostics(
                        this.#activeExecuteTiming.receiptAtMilliseconds,
                        this.#activeExecuteTiming.computeStartedAtMilliseconds,
                        this.#readNow()
                      )
                )
              });
          this.#emitPrivate(
            output.kind === "PreparedResultPage"
              ? output.envelope.rootJobId
              : output.ready.receipt.rootJobId,
            bridgedOutput,
            transfer
          );
        },
        () => this.#readNow()
      );
      this.#v1.handleMessage(message);
      return;
    }
    if (message.type === "PreparedStructuralFirePrivateInput") {
      this.#handlePrivate(message);
      return;
    }
    if (message.type === "ShutdownWorker") this.#v2?.dispose();
    this.#v1.handleMessage(message);
  }

  #handlePrivate(message: PreparedStructuralFirePrivateInputMessage): void {
    if (this.#v2 === undefined
      || this.#workerEpoch === undefined
      || message.workerEpoch !== this.#workerEpoch) {
      this.#emitPrivate(message.rootJobId, { kind: "Stale" });
      return;
    }
    try {
      const payload = privateInput(message.payload);
      switch (payload.kind) {
        case "PrepareSeed": {
          const receiptAtMilliseconds = this.#readNow();
          let computeStartedAtMilliseconds: number | null = null;
          let prepareSeedSubphase: Readonly<PreparedStructuralFirePrivateWorkerPrepareSeedSubphaseDiagnostics> | null = null;
          void Promise.resolve()
            .then(() => {
              computeStartedAtMilliseconds = this.#readNow();
              const input = this.#v2!.prepareSeed(
                payload.state,
                payload.input,
                (diagnostics) => { prepareSeedSubphase = diagnostics; }
              );
              const computeCompletedAtMilliseconds = this.#readNow();
              return Object.freeze({
                input,
                workerDiagnostics: workerDiagnostics(
                  workerPrepareSeedDiagnostics(
                    workerOperationDiagnostics(
                      receiptAtMilliseconds,
                      computeStartedAtMilliseconds,
                      computeCompletedAtMilliseconds
                    ),
                    prepareSeedSubphase!
                  ),
                  null
                )
              });
            })
            .then(({ input, workerDiagnostics: diagnostics }) => this.#emitPrivate(message.rootJobId, {
              kind: "SeedPrepared",
              input,
              workerDiagnostics: diagnostics
            }))
            .catch((error: unknown) => {
              const diagnostics = computeStartedAtMilliseconds === null
                ? null
                : workerDiagnostics(
                    workerPrepareSeedDiagnostics(
                      workerOperationDiagnostics(
                        receiptAtMilliseconds,
                        computeStartedAtMilliseconds,
                        this.#readNow()
                      ),
                      prepareSeedSubphase!
                    ),
                    null
                  );
              this.#emitPrivate(message.rootJobId, {
                kind: "Refused",
                reason: error instanceof Error ? error.message : "Prepared seed worker failed.",
                ...(diagnostics === null ? {} : { workerDiagnostics: diagnostics })
              });
            });
          return;
        }
        case "SeedPage":
          this.#emitPrivate(message.rootJobId, {
            kind: "SeedPageDecision",
            decision: this.#v2.acceptSeedPage(payload.request, payload.envelope)
          });
          return;
        case "BindSeed":
          this.#emitPrivate(message.rootJobId, {
            kind: "SeedBound",
            result: this.#v2.bindSeed(payload.control)
          });
          return;
        case "ExecuteCommand": {
          const receiptAtMilliseconds = this.#readNow();
          this.#activeExecuteTiming = {
            receiptAtMilliseconds,
            computeStartedAtMilliseconds: null
          };
          try {
            this.#v2.executeCommand(payload.control, () => {
              if (this.#activeExecuteTiming !== null) {
                this.#activeExecuteTiming.computeStartedAtMilliseconds = this.#readNow();
              }
            });
          } catch (error) {
            if (error instanceof PreparedWorkerCancelled) {
              this.#emitPrivate(message.rootJobId, { kind: "Cancelled" });
            } else {
              const timing = this.#activeExecuteTiming!;
              this.#emitPrivate(message.rootJobId, {
                kind: "Refused",
                reason: error instanceof Error ? error.message : "Private worker request failed.",
                workerDiagnostics: workerDiagnostics(
                  null,
                  timing.computeStartedAtMilliseconds === null
                    ? workerReceiptDiagnostics(timing.receiptAtMilliseconds)
                    : workerOperationDiagnostics(
                        timing.receiptAtMilliseconds,
                        timing.computeStartedAtMilliseconds,
                        this.#readNow()
                      )
                )
              });
            }
          } finally {
            this.#activeExecuteTiming = null;
          }
          return;
        }
        case "Cancel":
          if (payload.rootJobId !== message.rootJobId) {
            throw new RangeError("Private cancel root is invalid.");
          }
          this.#v2.cancel(payload.rootJobId);
          this.#emitPrivate(message.rootJobId, { kind: "Cancelled" });
          return;
        case "ReleaseResult":
          if (payload.rootJobId !== message.rootJobId) {
            throw new RangeError("Private release root is invalid.");
          }
          this.#v2.releaseResult(payload.rootJobId);
          this.#emitPrivate(message.rootJobId, { kind: "ReleasedResult" });
          return;
        case "ReleaseSeed":
          this.#emitPrivate(message.rootJobId, {
            kind: "ReleasedSeed",
            released: this.#v2.releaseSeed(payload.control)
          });
          return;
      }
    } catch (error) {
      this.#emitPrivate(message.rootJobId, {
        kind: error instanceof PreparedWorkerCancelled ? "Cancelled" : "Refused",
        ...(error instanceof PreparedWorkerCancelled
          ? {}
          : { reason: error instanceof Error ? error.message : "Private worker request failed." })
      } as PreparedStructuralFirePrivateWorkerBridgeOutput);
    }
  }

  #emitPrivate(
    rootJobId: string,
    payload: PreparedStructuralFirePrivateWorkerBridgeOutput,
    transfer: readonly Transferable[] = []
  ): void {
    if (this.#workerEpoch === undefined) return;
    const output: PreparedStructuralFirePrivateOutputMessage = Object.freeze({
      type: "PreparedStructuralFirePrivateOutput",
      workerEpoch: this.#workerEpoch,
      rootJobId,
      payload
    });
    this.emit(output, transfer);
  }
}

const emptyWork = (): Readonly<PreparedStructuralFireWorkCounters> => Object.freeze({
  visitedBricks: 0,
  visitedCells: 0,
  connectivityFacts: 0,
  components: 0,
  massCells: 0
});

const appliedWork = (
  result: StructuralAcceptedCommandResult
): Readonly<PreparedStructuralFireWorkCounters> => {
  const diagnostics = readStructuralConnectivityWork(result.object);
  if (diagnostics === undefined) return emptyWork();
  return Object.freeze({
    visitedBricks: diagnostics.sourceBrickCount,
    visitedCells: diagnostics.fullVoxelTraversalCount
      + diagnostics.frontierVisitedCellCount
      + diagnostics.indexedActiveCellVisitCount,
    connectivityFacts: diagnostics.coordinateNeighborProbeCount
      + diagnostics.cachedAdjacencyProbeCount,
    components: 0,
    massCells: 0
  });
};

const validatePreparedRequest = (source: WorkerJobRequest): PreparedStructuralFireJob => {
  if (source.jobKind !== PREPARED_STRUCTURAL_FIRE_JOB_KIND) {
    throw new RangeError("Prepared worker received an unsupported job kind.");
  }
  const job = createPreparedStructuralFireJob(
    source.payload as Readonly<PreparedStructuralFireJob>
  );
  if (job.jobId !== source.jobId
    || job.objectId !== source.targetKey
    || job.expectedEditRevision !== source.inputRevision
    || job.algorithmVersion !== source.algorithmVersion) {
    throw new RangeError("Prepared worker request identity is invalid.");
  }
  return job;
};

export class PreparedStructuralFireWorkerRuntime {
  private readonly requests = new Map<WorkerJobId, WorkerJobRequest>();
  private readonly roots = new Map<string, PreparedRootState>();
  private readonly replicas = new Map<string, StructuralObject>();
  private readonly pendingAdoptions = new Map<string, PendingReplicaAdoption>();
  private readonly adoptedReceipts = new Map<string, PreparedStructuralFireAdoptionReceipt>();
  private readonly batchScopes = new Map<WorkerJobId, PreparedBatchScope>();
  private readonly cancellation = new WorkerCancellationRegistry();
  private epoch: WorkerEpoch | undefined;
  private runningJobId: WorkerJobId | undefined;
  private stopping = false;
  private replicaSeedCount = 0;

  public constructor(private readonly emit: PreparedStructuralFireWorkerMessageEmitter) {}

  public readReplicaSeedCount(): number {
    return this.replicaSeedCount;
  }

  public readRetainedRootCount(): number {
    return this.roots.size;
  }

  public readPendingAdoptionCount(): number {
    return this.pendingAdoptions.size;
  }

  public handleMessage(value: unknown): void {
    if (!isMessageRecord(value)) {
      this.failUnknown("ProtocolFault", "Worker message must be a record.");
      return;
    }
    const message = value as HostToWorkerMessage;
    switch (message.type) {
      case "InitializeWorker":
        if (this.epoch !== undefined || this.stopping) {
          this.failUnknown("ProtocolFault", "Worker is already initialized.");
          return;
        }
        this.epoch = message.workerEpoch;
        this.emit({ type: "WorkerReady", workerEpoch: message.workerEpoch });
        return;
      case "EnqueueJob":
        if (!this.requireEpoch(message.request.workerEpoch, message.request.jobId)) return;
        if (this.runningJobId !== undefined || this.requests.has(message.request.jobId)) {
          this.fail(message.request.jobId, "ProtocolFault", "Prepared worker accepts one job at a time.");
          return;
        }
        validatePreparedRequest(message.request);
        this.requests.set(message.request.jobId, message.request);
        this.emit({
          type: "JobAccepted",
          jobId: message.request.jobId,
          workerEpoch: message.request.workerEpoch
        });
        return;
      case "JobInputData":
        if (!this.requireEpoch(message.workerEpoch, message.jobId)) return;
        void this.execute(message.jobId, message.bundle);
        return;
      case "CancelJob":
        if (!this.requireEpoch(message.workerEpoch, message.jobId)) return;
        this.cancellation.cancel(message.jobId);
        return;
      case "ReleaseResult":
        if (!this.requireEpoch(message.workerEpoch, message.jobId)) return;
        {
          const scope = this.batchScopes.get(message.jobId);
          if (scope !== undefined
            && scope.rootJobId === message.rootJobId
            && scope.objectId === message.targetKey) {
            this.abandonRoot(scope.rootJobId, scope.objectId);
          }
        }
        return;
      case "ReadStatus":
        if (!this.requireEpoch(message.workerEpoch)) return;
        this.emit({
          type: "WorkerStatus",
          workerEpoch: message.workerEpoch,
          state: this.runningJobId ? "Busy" : this.stopping ? "Stopping" : "Ready",
          ...(this.runningJobId ? { jobId: this.runningJobId } : {})
        });
        return;
      case "ShutdownWorker":
        if (!this.requireEpoch(message.workerEpoch)) return;
        this.stopping = true;
        if (this.runningJobId) this.cancellation.cancel(this.runningJobId);
        else this.emit({ type: "WorkerStopped", workerEpoch: message.workerEpoch });
        return;
    }
  }

  private async execute(
    jobId: WorkerJobId,
    sourceBundle: TransferableBufferBundle
  ): Promise<void> {
    const request = this.requests.get(jobId);
    if (request === undefined || this.runningJobId !== undefined) {
      this.fail(jobId, "UnknownJob", "Input data has no matching Prepared job.");
      return;
    }
    this.runningJobId = jobId;
    const token = this.cancellation.register(jobId);
    let preparedJob: PreparedStructuralFireJob | undefined;
    try {
      await this.checkpoint(() => token.isCancellationRequested);
      const input = validateTransferableBundle(sourceBundle);
      if (input.ownership !== "SenderToWorker"
        || input.revision !== request.inputRevision
        || input.byteLength !== request.estimatedInputBytes) {
        throw new RangeError("Prepared input does not match its worker request.");
      }
      const job = validatePreparedRequest(request);
      preparedJob = job;
      const decoded = decodePreparedStructuralFireInput(job, input);
      if (decoded.kind === "Seed") this.abandonObject(job.objectId);
      this.batchScopes.set(jobId, Object.freeze({
        rootJobId: job.continuation.rootJobId,
        objectId: job.objectId
      }));
      const output = await this.executeBatch(
        job,
        request.planningEpoch,
        input,
        decoded,
        async () => {
        await this.checkpoint(() => token.isCancellationRequested);
        }
      );
      this.emit({
        type: "JobOutputData",
        jobId,
        workerEpoch: request.workerEpoch,
        outputBytes: output.bundle.byteLength,
        bundle: output.bundle
      }, transferListFor(output.bundle));
      this.emit({ type: "JobCompleted", result: output.result });
    } catch (error) {
      if (preparedJob !== undefined) {
        this.abandonRoot(
          preparedJob.continuation.rootJobId,
          preparedJob.objectId
        );
      }
      if (error instanceof PreparedWorkerCancelled) {
        this.emit({
          type: "JobCancelled",
          jobId,
          workerEpoch: request.workerEpoch,
          reason: "CancelledDuringExecution"
        });
      } else {
        this.fail(
          jobId,
          "JobExecutionFailed",
          error instanceof Error ? error.message : "Prepared worker job failed."
        );
      }
    } finally {
      this.cancellation.release(jobId);
      this.requests.delete(jobId);
      this.runningJobId = undefined;
      if (this.stopping && this.epoch !== undefined) {
        this.emit({ type: "WorkerStopped", workerEpoch: this.epoch });
      }
    }
  }

  private async executeBatch(
    job: PreparedStructuralFireJob,
    dispatchEpoch: number,
    input: TransferableBufferBundle,
    decoded: ReturnType<typeof decodePreparedStructuralFireInput>,
    checkpoint: () => Promise<void>
  ): Promise<PreparedExecutionOutput> {
    const rootJobId = job.continuation.rootJobId;
    if (job.continuation.batchIndex === 0) {
      let source: StructuralObject;
      let command: StructuralDestructionCommand;
      if (decoded.kind === "Seed") {
        const existing = this.replicas.get(job.objectId);
        if (existing === undefined && this.replicas.size >= MAX_PREPARED_STRUCTURAL_REPLICAS) {
          throw new RangeError("Prepared worker replica capacity is exhausted.");
        }
        this.replicas.set(job.objectId, decoded.object);
        this.replicaSeedCount += 1;
        source = decoded.object;
        command = decoded.command;
      } else if (decoded.kind === "AdoptedCommand") {
        this.adoptReplica(decoded.adoption, job);
        const replica = this.replicas.get(job.objectId);
        if (replica === undefined
          || replica.objectRevision !== job.expectedObjectRevision
          || replica.editRevision !== job.expectedEditRevision
          || replica.contentHash !== job.contentHash) {
          throw new RangeError("Prepared worker adopted command has no matching replica.");
        }
        source = replica;
        command = decoded.command;
      } else if (decoded.kind === "Command") {
        const replica = this.replicas.get(job.objectId);
        if (replica === undefined
          || replica.objectRevision !== job.expectedObjectRevision
          || replica.editRevision !== job.expectedEditRevision
          || replica.contentHash !== job.contentHash) {
          throw new RangeError("Prepared worker command requires a current replica seed.");
        }
        source = replica;
        command = decoded.command;
      } else {
        throw new RangeError("Prepared worker root input cannot be a continuation.");
      }
      if (command.commandId !== job.structuralCommandId) {
        throw new RangeError("Prepared worker command identity does not match its job.");
      }
      this.roots.set(rootJobId, { source, command });
      await checkpoint();
      return this.continuationOutput(job, dispatchEpoch, input, 1, 1);
    }

    if (decoded.kind !== "Continuation"
      || decoded.facts.rootJobId !== rootJobId
      || decoded.facts.batchIndex !== job.continuation.batchIndex
      || decoded.facts.tokenHash !== job.continuation.tokenHash
      || decoded.facts.chainHash !== job.continuation.chainHash) {
      throw new RangeError("Prepared worker continuation receipt is invalid.");
    }
    const root = this.roots.get(rootJobId);
    if (root === undefined) {
      throw new RangeError("Prepared worker continuation root is unavailable.");
    }
    if (job.continuation.batchIndex === 1) {
      await checkpoint();
      const result = applyStructuralDestructionCommand(root.source, root.command);
      if (result.status === "Rejected") {
        throw new RangeError(`Structural command rejected: ${result.code} at ${result.path}.`);
      }
      root.result = result;
      await checkpoint();
      return this.continuationOutput(job, dispatchEpoch, input, 2, 2);
    }
    if (job.continuation.batchIndex !== 2 || root.result === undefined) {
      throw new RangeError("Prepared worker continuation batch is out of order.");
    }
    await checkpoint();
    const delta = encodePreparedStructuralFireResultDelta(root.source, root.result);
    const logicalBundle = createPreparedStructuralFireResultBundle(
      root.result.object.objectRevision,
      delta
    );
    const bundle = encodePreparedStructuralFireWorkerOutput(input, logicalBundle);
    const details = createPreparedStructuralFireResultDetails(
      job,
      this.resultDraft(
        job,
        root.result.status,
        logicalBundle,
        3,
        null,
        root.result
      ),
      logicalBundle
    );
    this.pendingAdoptions.set(job.objectId, Object.freeze({
      rootJobId,
      result: root.result,
      resultHash: root.result.resultHash,
      receiptHash: details.receiptHash
    }));
    this.roots.delete(rootJobId);
    return Object.freeze({
      bundle,
      result: this.workerResult(job, dispatchEpoch, bundle, details)
    });
  }

  private continuationOutput(
    job: PreparedStructuralFireJob,
    dispatchEpoch: number,
    input: TransferableBufferBundle,
    completedUnits: number,
    nextBatchIndex: number
  ): PreparedExecutionOutput {
    const logicalBundle = createPreparedStructuralFireResultBundle(
      job.expectedObjectRevision,
      new Uint8Array(0)
    );
    const bundle = encodePreparedStructuralFireWorkerOutput(input, logicalBundle);
    const details = createPreparedStructuralFireResultDetails(
      job,
      this.resultDraft(
        job,
        "ContinuationRequired",
        logicalBundle,
        completedUnits,
        nextBatchIndex
      ),
      logicalBundle
    );
    return Object.freeze({
      bundle,
      result: this.workerResult(job, dispatchEpoch, bundle, details)
    });
  }

  private resultDraft(
    job: PreparedStructuralFireJob,
    status: "Applied" | "NoChange" | "ContinuationRequired",
    bundle: TransferableBufferBundle,
    completedUnits: number,
    nextBatchIndex: number | null,
    result?: StructuralAcceptedCommandResult
  ): PreparedStructuralFireResultDraft {
    const accepted = status !== "ContinuationRequired" && result !== undefined;
    return Object.freeze({
      schemaVersion: PREPARED_STRUCTURAL_FIRE_RESULT_SCHEMA_VERSION,
      kind: "PreparedStructuralFireResult",
      layoutVersion: PREPARED_STRUCTURAL_FIRE_RESULT_LAYOUT_VERSION,
      algorithmVersion: 1,
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
      physicsRepresentationLevel: "ExactBoxes",
      adaptationReason: "None",
      status,
      resultingObjectRevision: accepted ? result.object.objectRevision : job.expectedObjectRevision,
      resultingEditRevision: accepted ? result.object.editRevision : job.expectedEditRevision,
      resultingContentHash: accepted ? result.object.contentHash : job.contentHash,
      changedBrickCount: accepted ? result.changedBrickKeys.length : 0,
      changedCellCount: accepted ? result.changedVoxelCount : 0,
      detachedComponentCount: 0,
      resultCount: accepted ? 1 : 0,
      resultBytes: bundle.byteLength,
      work: accepted ? appliedWork(result) : emptyWork(),
      workProgress: Object.freeze({ status: "Unavailable" as const }),
      progress: Object.freeze({ completedUnits, totalUnits: 3, nextBatchIndex })
    });
  }

  private workerResult(
    job: PreparedStructuralFireJob,
    dispatchEpoch: number,
    bundle: TransferableBufferBundle,
    details: ReturnType<typeof createPreparedStructuralFireResultDetails>
  ): WorkerJobResult {
    if (this.epoch === undefined) throw new Error("Prepared worker epoch is unavailable.");
    return Object.freeze({
      jobId: workerJobId(job.jobId),
      targetKey: workerTargetKey(job.objectId),
      planningEpoch: planningEpoch(dispatchEpoch),
      workerEpoch: this.epoch,
      inputRevision: contentRevision(job.expectedEditRevision),
      outputRevision: contentRevision(details.resultingObjectRevision),
      algorithmVersion: algorithmVersion(job.algorithmVersion),
      outputBytes: byteCount(bundle.byteLength),
      contentHash: fnv1aBytes(bundle.buffers),
      protocolDetails: details
    });
  }

  private adoptReplica(
    adoption: Readonly<PreparedStructuralFireAdoptionReceipt>,
    job: Readonly<PreparedStructuralFireJob>
  ): void {
    if (adoption.objectId !== job.objectId
      || adoption.resultingObjectRevision !== job.expectedObjectRevision
      || adoption.resultingEditRevision !== job.expectedEditRevision
      || adoption.resultingContentHash !== job.contentHash) {
      throw new RangeError("Prepared worker adoption source does not match its command.");
    }
    const pending = this.pendingAdoptions.get(job.objectId);
    if (pending !== undefined) {
      if (pending.rootJobId !== adoption.rootJobId
        || pending.resultHash !== adoption.resultHash
        || pending.receiptHash !== adoption.receiptHash
        || pending.result.object.objectRevision !== adoption.resultingObjectRevision
        || pending.result.object.editRevision !== adoption.resultingEditRevision
        || pending.result.object.contentHash !== adoption.resultingContentHash
        || pending.result.object.evidenceHash !== adoption.resultingEvidenceHash) {
        throw new RangeError("Prepared worker adoption receipt does not match pending output.");
      }
      this.replicas.set(job.objectId, pending.result.object);
      this.pendingAdoptions.delete(job.objectId);
      this.adoptedReceipts.set(job.objectId, adoption);
      this.releaseBatchScopes(pending.rootJobId, job.objectId);
      return;
    }
    const committed = this.replicas.get(job.objectId);
    const adopted = this.adoptedReceipts.get(job.objectId);
    if (committed === undefined
      || adopted === undefined
      || adopted.rootJobId !== adoption.rootJobId
      || adopted.resultHash !== adoption.resultHash
      || adopted.receiptHash !== adoption.receiptHash
      || adopted.resultingEvidenceHash !== adoption.resultingEvidenceHash
      || committed.objectRevision !== adoption.resultingObjectRevision
      || committed.editRevision !== adoption.resultingEditRevision
      || committed.contentHash !== adoption.resultingContentHash
      || committed.evidenceHash !== adoption.resultingEvidenceHash) {
      throw new RangeError("Prepared worker adoption receipt is unavailable.");
    }
  }

  private abandonObject(objectId: string): void {
    const roots = [...this.roots.entries()]
      .filter(([, root]) => root.source.objectId === objectId)
      .map(([rootJobId]) => rootJobId);
    for (const rootJobId of roots) this.abandonRoot(rootJobId, objectId);
    this.pendingAdoptions.delete(objectId);
    this.adoptedReceipts.delete(objectId);
    for (const [jobId, scope] of this.batchScopes) {
      if (scope.objectId === objectId) this.batchScopes.delete(jobId);
    }
  }

  private abandonRoot(rootJobId: string, objectId: string): void {
    const root = this.roots.get(rootJobId);
    if (root?.source.objectId === objectId) this.roots.delete(rootJobId);
    const pending = this.pendingAdoptions.get(objectId);
    if (pending?.rootJobId === rootJobId) this.pendingAdoptions.delete(objectId);
    this.releaseBatchScopes(rootJobId, objectId);
  }

  private releaseBatchScopes(rootJobId: string, objectId: string): void {
    for (const [jobId, scope] of this.batchScopes) {
      if (scope.rootJobId === rootJobId && scope.objectId === objectId) {
        this.batchScopes.delete(jobId);
      }
    }
  }

  private async checkpoint(cancelled: () => boolean): Promise<void> {
    await yieldToWorkerEventLoop();
    if (cancelled()) throw new PreparedWorkerCancelled();
  }

  private requireEpoch(epoch: WorkerEpoch, jobId?: WorkerJobId): boolean {
    if (this.epoch === epoch && !this.stopping) return true;
    if (jobId) this.fail(jobId, "WrongWorkerEpoch", "Prepared worker epoch mismatch.");
    else this.failUnknown("WrongWorkerEpoch", "Prepared worker epoch mismatch.");
    return false;
  }

  private fail(
    jobId: WorkerJobId,
    code: "ProtocolFault" | "WrongWorkerEpoch" | "UnknownJob" | "JobExecutionFailed",
    message: string
  ): void {
    this.emit({
      type: "JobFailed",
      failure: Object.freeze({
        jobId,
        code,
        message,
        ...(this.epoch === undefined ? {} : { workerEpoch: this.epoch })
      })
    });
  }

  private failUnknown(
    code: "ProtocolFault" | "WrongWorkerEpoch",
    message: string
  ): void {
    const first = [...this.requests.keys()].sort()[0];
    if (first !== undefined) this.fail(first, code, message);
  }
}

interface PreparedWorkerScope {
  onmessage: ((event: MessageEvent<HostToWorkerMessage>) => void) | null;
  postMessage(message: WorkerToHostMessage, transfer: Transferable[]): void;
}

const isDedicatedWorkerScope = (): boolean =>
  typeof document === "undefined" && "postMessage" in globalThis && "onmessage" in globalThis;

if (isDedicatedWorkerScope()) {
  const scope = globalThis as unknown as PreparedWorkerScope;
  const runtime = new PreparedStructuralFireDedicatedWorkerRuntime((message, transfer = []) =>
    scope.postMessage(message, [...transfer]));
  scope.onmessage = (event: MessageEvent<HostToWorkerMessage>) =>
    runtime.handleMessage(event.data);
}
