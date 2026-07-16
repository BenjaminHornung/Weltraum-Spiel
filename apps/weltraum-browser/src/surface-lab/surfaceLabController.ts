import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  requireCelestialBody
} from "../celestial";
import { createUniverseClock } from "../persistence";
import {
  artifactRevision,
  backendRevision,
  createMaterialProfile,
  createRenderCommand,
  materialProfileId,
  type MaterialProfile,
  type MeshArtifact,
  type ArtifactRevision,
  type RenderBackend,
  type RenderCommandResult
} from "../presentation";
import {
  createBodyFixedFrameState,
  createBodyInertialFrameState,
  createSurfaceLocalFrameDefinition,
  createSurfaceLocalFrameState,
  createSystemInertialFrameId,
  type FrameStateAtTime,
  type SurfaceLocalFrameState
} from "../spatial";
import {
  MemoryContentCache,
  admitHestiaVoxelWorkerOutputToCache,
  canonicalizeContentKey,
  createCachedHestiaVoxelInputBundle,
  createHestiaVoxelCacheKey
} from "../streaming";
import {
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_CHANNEL_BYTES,
  VOXEL_MESH_ALGORITHM_VERSION,
  calculateVoxelSpatialJobTargetKey,
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  type VoxelMeshProduct
} from "../voxel";
import {
  HESTIA_EDIT_REVISION_V1,
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_PRESET_ID,
  HESTIA_SOURCE_REVISION_V1,
  assertHestiaRootSeed,
  type HestiaVoxelSizeMeters
} from "../world-generation/hestia";
import {
  GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND,
  MAX_HESTIA_GENERATION_COLUMNS_PER_SLICE,
  MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES,
  algorithmVersion,
  byteCount,
  contentRevision,
  expectedHestiaVoxelInputBytes,
  fnv1aBytes,
  isWorkerPoolAcceptedCompletedTerminal,
  jobDeadline,
  planningEpoch,
  validateHestiaVoxelBrickMeshPayload,
  validateHestiaVoxelWorkerOutput,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type GenerateHestiaVoxelBrickMeshPayload,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobTerminal,
  type WorkerJobTicket,
  type WorkerPool
} from "../workers";
import {
  adoptMeshArtifactFromVoxelMeshProduct,
  createMeshArtifactFromVoxelMeshProduct
} from "../voxel/meshArtifactAdapter";
import {
  snapshotSurfaceLabTelemetry,
  type SurfaceLabTelemetryListener,
  type SurfaceLabTelemetrySnapshot
} from "./surfaceLabTelemetry";
import { SURFACE_LAB_REGION } from "./surfaceLabRegion";

export type SurfaceLabLifecycleState = "Idle" | "Requesting" | "Partial" | "Ready" | "Failed" | "Regenerating" | "Disposed";

export interface SurfaceLabFrameChain {
  readonly bodyId: string;
  readonly systemFrameId: string;
  readonly bodyInertialFrame: FrameStateAtTime;
  readonly bodyFixedFrame: FrameStateAtTime;
  readonly surfaceFrame: SurfaceLocalFrameState;
}

export type SurfaceLabWorkerPool = Pick<
  WorkerPool,
  "start" | "setPlanningEpoch" | "enqueue" | "replaceWorker" | "shutdown" | "snapshot"
>;

export interface SurfaceLabDecodedChunk {
  readonly representationKey: string;
  readonly meshContentHash: string;
  readonly brickContentHash: string;
  readonly artifact?: MeshArtifact;
  readonly vertices: number;
  readonly triangles: number;
  readonly meshBytes: number;
  readonly generationMilliseconds: number;
  readonly meshingMilliseconds: number;
}

export type SurfaceLabCompletedDecoder = (
  payload: GenerateHestiaVoxelBrickMeshPayload,
  terminal: Extract<WorkerJobTerminal, { readonly kind: "Completed" }>,
  presentationArtifactRevision: ArtifactRevision
) => SurfaceLabDecodedChunk;

export interface SurfaceLabControllerOptions {
  readonly workerPool: SurfaceLabWorkerPool;
  readonly backend: RenderBackend;
  readonly initialSeed?: string;
  readonly initialVoxelSizeMeters?: HestiaVoxelSizeMeters;
  readonly cache?: MemoryContentCache;
  readonly admitToCache?: typeof admitHestiaVoxelWorkerOutputToCache;
  readonly decodeCompleted?: SurfaceLabCompletedDecoder;
  readonly nowMilliseconds?: () => number;
}

const SURFACE_FRAME_ID = "frame:surface_hestia_surface_lab_v1";
const REGION_ID = "region:hestia.surface-lab.v1";
const DEFAULT_SEED = "hestia-surface-lab-v1";

const MATERIAL_COLORS: Readonly<Record<string, Readonly<{ r: number; g: number; b: number }>>> = Object.freeze({
  dark_rock: Object.freeze({ r: 0.08, g: 0.12, b: 0.11 }),
  wet_soil: Object.freeze({ r: 0.18, g: 0.23, b: 0.18 }),
  moss: Object.freeze({ r: 0.18, g: 0.38, b: 0.27 }),
  dense_biological_surface: Object.freeze({ r: 0.08, g: 0.31, b: 0.3 }),
  shallow_water_boundary: Object.freeze({ r: 0.12, g: 0.42, b: 0.46 })
});

export const SURFACE_LAB_MATERIAL_PROFILES: readonly MaterialProfile[] = Object.freeze(
  Object.entries(MATERIAL_COLORS).map(([key, baseColor]) => createMaterialProfile({
    id: materialProfileId(`surface-lab:${key}`),
    kind: "BasicLit",
    baseColor,
    opacity: 1,
    doubleSided: false,
    wireframe: false,
    depthWrite: true
  }))
);

const materialProfileForKey = (key: string) => materialProfileId(`surface-lab:${key}`);

const resultAccepted = (result: RenderCommandResult, operation: string): void => {
  if (result.status !== "Accepted" && result.status !== "AlreadyApplied") {
    throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
  }
};

const removalResultAccepted = (result: RenderCommandResult, operation: string): void => {
  if (result.status === "NotFound") return;
  resultAccepted(result, operation);
};

export const createSurfaceLabFrameChain = (): SurfaceLabFrameChain => {
  const time = createUniverseClock(7_200);
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
  const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
    epochSeconds: 0,
    requestedTimeSeconds: time.epochSeconds
  });
  const runtimeState = ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) throw new Error("Hestia runtime state is missing.");
  const systemFrameId = createSystemInertialFrameId();
  const bodyInertialFrame = createBodyInertialFrameState({ body, runtimeState, time, systemFrameId });
  const bodyFixedFrame = createBodyFixedFrameState(bodyInertialFrame, {
    body,
    runtimeState,
    time,
    rotationEpoch: createUniverseClock(0)
  });
  const definition = createSurfaceLocalFrameDefinition({
    frameId: SURFACE_FRAME_ID,
    anchor: {
      bodyId: body.bodyId,
      latitudeRadians: 0.41,
      longitudeRadians: -1.2,
      altitudeMeters: 0
    }
  });
  const surfaceFrame = createSurfaceLocalFrameState(definition, body, bodyFixedFrame, time);
  return Object.freeze({ bodyId: body.bodyId, systemFrameId, bodyInertialFrame, bodyFixedFrame, surfaceFrame });
};

const hasExclusiveWorkerBufferIdentity = (
  mesh: VoxelMeshProduct,
  terminal: Extract<WorkerJobTerminal, { readonly kind: "Completed" }>,
  validatedBuffers: readonly ArrayBuffer[]
): boolean => validatedBuffers.length === terminal.output.buffers.length
  && validatedBuffers.every((buffer, index) => buffer === terminal.output.buffers[index])
  && mesh.positions.buffer === terminal.output.buffers[2]
  && mesh.normals.buffer === terminal.output.buffers[3]
  && mesh.indices.buffer === terminal.output.buffers[4];

export const decodeSurfaceLabCompletedChunk: SurfaceLabCompletedDecoder = (payload, terminal, presentationArtifactRevision) => {
  const validated = validateHestiaVoxelWorkerOutput(payload, terminal.result, terminal.output);
  const mesh = validated.mesh;
  const representationKey = mesh.representationKey;
  const meshContentHash = mesh.contentHash;
  const brickContentHash = validated.brick.contentHash;
  const vertices = mesh.positions.length / 3;
  const triangles = mesh.indices.length / 3;
  const meshBytes = mesh.positions.byteLength + mesh.normals.byteLength + mesh.indices.byteLength;
  const generationMilliseconds = validated.details.generationMilliseconds;
  const meshingMilliseconds = validated.details.meshingMilliseconds;
  const artifact = mesh.positions.length === 0
    ? undefined
    : payload.inputMode === "Generate"
      && isWorkerPoolAcceptedCompletedTerminal(terminal)
      && hasExclusiveWorkerBufferIdentity(mesh, terminal, validated.bundle.buffers)
      ? adoptMeshArtifactFromVoxelMeshProduct(mesh, {
          materialProfileIdForKey: materialProfileForKey,
          artifactRevision: presentationArtifactRevision
        })
      : createMeshArtifactFromVoxelMeshProduct(mesh, {
          materialProfileIdForKey: materialProfileForKey,
          artifactRevision: presentationArtifactRevision
        });
  return Object.freeze({
    representationKey,
    meshContentHash,
    brickContentHash,
    ...(artifact === undefined ? {} : { artifact }),
    vertices,
    triangles,
    meshBytes,
    generationMilliseconds,
    meshingMilliseconds
  });
};

interface PublishedArtifact {
  readonly artifact: MeshArtifact;
  readonly meshContentHash: string;
}

interface MutableGenerationMetrics {
  requestedChunks: number;
  readyChunks: number;
  failedChunks: number;
  vertices: number;
  triangles: number;
  meshBytes: number;
  generationMilliseconds: number;
  meshingMilliseconds: number;
  uploadMilliseconds: number;
  cacheHits: number;
  cacheMisses: number;
  cacheBypasses: number;
  brickHashes: string[];
  meshHashes: string[];
}

const freshMetrics = (): MutableGenerationMetrics => ({
  requestedChunks: 0,
  readyChunks: 0,
  failedChunks: 0,
  vertices: 0,
  triangles: 0,
  meshBytes: 0,
  generationMilliseconds: 0,
  meshingMilliseconds: 0,
  uploadMilliseconds: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheBypasses: 0,
  brickHashes: [],
  meshHashes: []
});

const emptyInputBundle = (): TransferableBufferBundle => Object.freeze({
  ownership: "SenderToWorker",
  revision: contentRevision(0),
  byteLength: byteCount(0),
  buffers: Object.freeze([]),
  views: Object.freeze([]),
  contentHash: fnv1aBytes([])
});

export class SurfaceLabController {
  readonly #pool: SurfaceLabWorkerPool;
  readonly #backend: RenderBackend;
  readonly #cache: MemoryContentCache;
  readonly #admitToCache: typeof admitHestiaVoxelWorkerOutputToCache;
  readonly #decode: SurfaceLabCompletedDecoder;
  readonly #now: () => number;
  readonly #frameChain = createSurfaceLabFrameChain();
  readonly #listeners = new Set<SurfaceLabTelemetryListener>();
  readonly #published = new Map<string, PublishedArtifact>();
  readonly #cachedBrickHashes = new Map<string, string>();
  #lifecycle: SurfaceLabLifecycleState = "Idle";
  #seed: string;
  #voxelSizeMeters: HestiaVoxelSizeMeters;
  #plan = 0;
  #generation = 0;
  #metrics = freshMetrics();
  #tickets: WorkerJobTicket[] = [];
  #cancelledJobs = 0;
  #staleRejects = 0;
  #publishedInputSignature: string | undefined;
  #disposeRequested = false;
  #disposePromise: Promise<void> | undefined;
  #settledPromise: Promise<SurfaceLabTelemetrySnapshot>;
  #resolveSettled: ((snapshot: SurfaceLabTelemetrySnapshot) => void) | undefined;

  public constructor(options: SurfaceLabControllerOptions) {
    this.#pool = options.workerPool;
    this.#backend = options.backend;
    this.#cache = options.cache ?? new MemoryContentCache(32 * VOXEL_CHANNEL_BYTES);
    this.#admitToCache = options.admitToCache ?? admitHestiaVoxelWorkerOutputToCache;
    this.#seed = options.initialSeed ?? DEFAULT_SEED;
    assertHestiaRootSeed(this.#seed);
    this.#voxelSizeMeters = options.initialVoxelSizeMeters ?? 0.5;
    this.#decode = options.decodeCompleted ?? decodeSurfaceLabCompletedChunk;
    this.#now = options.nowMilliseconds ?? (() => 0);
    this.#settledPromise = Promise.resolve(this.readTelemetry());
  }

  public async start(): Promise<void> {
    if (this.#lifecycle !== "Idle") throw new Error("Surface Lab can only start from Idle.");
    const initialized = this.#backend.dispatch(createRenderCommand({
      kind: "InitializeBackend",
      backendRevision: backendRevision(0)
    }));
    resultAccepted(initialized, "Surface Lab backend initialization");
    try {
      await this.#pool.start();
      if (this.#disposeRequested) return;
      this.#beginGeneration("Requesting", true);
    } catch (error) {
      if (this.#disposeRequested) return;
      this.#lifecycle = "Failed";
      this.#emit();
      resultAccepted(this.#backend.dispatch(createRenderCommand({
        kind: "DisposeBackend",
        backendRevision: this.#backend.readDiagnostics().backendRevision
      })), "Surface Lab backend cleanup");
      throw error;
    }
  }

  public regenerate(seed = this.#seed): Promise<SurfaceLabTelemetrySnapshot> {
    this.#assertActive();
    assertHestiaRootSeed(seed);
    this.#seed = seed;
    return this.#beginGeneration("Regenerating", false);
  }

  public setResolution(voxelSizeMeters: HestiaVoxelSizeMeters): Promise<SurfaceLabTelemetrySnapshot> {
    this.#assertActive();
    if (voxelSizeMeters !== 0.25 && voxelSizeMeters !== 0.5) {
      throw new RangeError("Surface Lab voxel size must be 0.25 or 0.5 metres.");
    }
    this.#voxelSizeMeters = voxelSizeMeters;
    return this.#beginGeneration("Regenerating", true);
  }

  public async restartWorker(slot: number): Promise<SurfaceLabTelemetrySnapshot> {
    this.#assertActive();
    const generation = this.#generation;
    try {
      await this.#pool.replaceWorker(slot);
    } catch (error) {
      if (this.#disposeRequested || this.#lifecycle === "Disposed") return this.readTelemetry();
      this.#lifecycle = "Failed";
      this.#emit();
      throw error;
    }
    if (this.#disposeRequested) return this.readTelemetry();
    if (generation !== this.#generation) return this.#settledPromise;
    return this.#beginGeneration("Regenerating", true);
  }

  public whenSettled(): Promise<SurfaceLabTelemetrySnapshot> {
    return this.#settledPromise;
  }

  public subscribe(listener: SurfaceLabTelemetryListener): () => void {
    this.#listeners.add(listener);
    listener(this.readTelemetry());
    return () => this.#listeners.delete(listener);
  }

  public readTelemetry(): SurfaceLabTelemetrySnapshot {
    const pool = this.#pool.snapshot();
    const time = this.#frameChain.surfaceFrame.time;
    return snapshotSurfaceLabTelemetry({
      lifecycle: this.#lifecycle,
      seed: this.#seed,
      presetId: HESTIA_PRESET_ID,
      voxelSizeMeters: this.#voxelSizeMeters,
      regionExtentMeters: {
        x: SURFACE_LAB_REGION.chunkCounts.x * VOXEL_BRICK_CELL_DIMENSIONS.x * this.#voxelSizeMeters,
        y: VOXEL_BRICK_CELL_DIMENSIONS.y * this.#voxelSizeMeters,
        z: SURFACE_LAB_REGION.chunkCounts.z * VOXEL_BRICK_CELL_DIMENSIONS.z * this.#voxelSizeMeters
      },
      requestedChunks: this.#metrics.requestedChunks,
      readyChunks: this.#metrics.readyChunks,
      failedChunks: this.#metrics.failedChunks,
      cancelledJobs: this.#cancelledJobs,
      staleRejects: this.#staleRejects,
      workerQueueDepth: pool.queue.size,
      runningWorkers: pool.runningJobs,
      workerRestarts: pool.workerRestarts,
      planningEpoch: this.#plan,
      latestWorkerEpoch: pool.latestWorkerEpoch,
      vertices: this.#metrics.vertices,
      triangles: this.#metrics.triangles,
      meshBytes: this.#metrics.meshBytes,
      generationMilliseconds: this.#metrics.generationMilliseconds,
      meshingMilliseconds: this.#metrics.meshingMilliseconds,
      uploadMilliseconds: this.#metrics.uploadMilliseconds,
      cacheHits: this.#metrics.cacheHits,
      cacheMisses: this.#metrics.cacheMisses,
      cacheBypasses: this.#metrics.cacheBypasses,
      brickHashes: [...this.#metrics.brickHashes].sort(),
      meshHashes: [...this.#metrics.meshHashes].sort(),
      bodyId: this.#frameChain.bodyId,
      systemFrameId: this.#frameChain.systemFrameId,
      bodyInertialFrameId: this.#frameChain.bodyInertialFrame.frameId,
      bodyFixedFrameId: this.#frameChain.bodyFixedFrame.frameId,
      surfaceFrameId: this.#frameChain.surfaceFrame.frameId,
      universeTick: time.tick,
      universeEpochSeconds: time.epochSeconds
    });
  }

  public dispose(): Promise<void> {
    if (this.#disposePromise !== undefined) return this.#disposePromise;
    this.#disposeRequested = true;
    this.#generation += 1;
    this.#cancelTickets();
    for (const published of [...this.#published.values()]) this.#removeArtifact(published.artifact);
    this.#published.clear();
    this.#publishedInputSignature = undefined;
    this.#lifecycle = "Disposed";
    const snapshot = this.readTelemetry();
    this.#resolveSettled?.(snapshot);
    this.#resolveSettled = undefined;
    this.#settledPromise = Promise.resolve(snapshot);
    this.#emit();
    this.#disposePromise = this.#finishDisposal();
    return this.#disposePromise;
  }

  async #finishDisposal(): Promise<void> {
    await this.#pool.shutdown();
    const disposed = this.#backend.dispatch(createRenderCommand({
      kind: "DisposeBackend",
      backendRevision: this.#backend.readDiagnostics().backendRevision
    }));
    resultAccepted(disposed, "Surface Lab backend disposal");
  }

  #assertActive(): void {
    if (this.#lifecycle === "Idle" || this.#disposeRequested || this.#lifecycle === "Disposed") {
      throw new Error("Surface Lab controller is not active.");
    }
  }

  #beginGeneration(lifecycle: "Requesting" | "Regenerating", allowCacheRead: boolean): Promise<SurfaceLabTelemetrySnapshot> {
    if (this.#disposeRequested || this.#pool.snapshot().state !== "Running") {
      throw new Error("Surface Lab cannot begin generation while its worker pool is stopped.");
    }
    this.#resolveSettled?.(this.readTelemetry());
    this.#generation += 1;
    const generation = this.#generation;
    this.#plan += 1;
    this.#pool.setPlanningEpoch(planningEpoch(this.#plan));
    this.#cancelTickets();
    this.#clearPublishedForGeneration();
    this.#lifecycle = lifecycle;
    this.#metrics = freshMetrics();
    this.#settledPromise = new Promise<SurfaceLabTelemetrySnapshot>((resolve) => { this.#resolveSettled = resolve; });
    this.#tickets = [];
    for (const coordinate of SURFACE_LAB_REGION.chunkCoordinates) {
      const prepared = this.#prepareInput(coordinate, allowCacheRead);
      const payload = prepared.payload;
      const request = this.#requestFor(payload, generation);
      try {
        const ticket = this.#pool.enqueue(request, prepared.bundle);
        this.#tickets.push(ticket);
        this.#metrics.requestedChunks += 1;
        void ticket.result.then((terminal) => this.#handleTerminal(generation, payload, terminal));
      } catch {
        this.#recordFailure(generation);
      }
    }
    this.#finishIfSettled(generation);
    this.#emit();
    return this.#settledPromise;
  }

  #inputSignature(): string {
    return `${this.#seed}\n${this.#voxelSizeMeters}`;
  }

  #clearPublishedForGeneration(): void {
    const signature = this.#inputSignature();
    if (this.#publishedInputSignature !== undefined && this.#publishedInputSignature !== signature) {
      this.#cachedBrickHashes.clear();
    }
    this.#publishedInputSignature = signature;
    for (const published of [...this.#published.values()]) this.#removeArtifact(published.artifact);
    this.#published.clear();
  }

  #prepareInput(
    brickCoordinate: Readonly<{ x: number; y: number; z: number }>,
    allowCacheRead: boolean
  ): Readonly<{ payload: GenerateHestiaVoxelBrickMeshPayload; bundle: TransferableBufferBundle }> {
    const generatedPayload = this.#payloadFor(brickCoordinate);
    if (!allowCacheRead) {
      this.#metrics.cacheBypasses += 1;
      return Object.freeze({ payload: generatedPayload, bundle: emptyInputBundle() });
    }
    const key = createHestiaVoxelCacheKey(generatedPayload, algorithmVersion(1));
    const canonicalKey = canonicalizeContentKey(key);
    const cachedBrickContentHash = this.#cachedBrickHashes.get(canonicalKey);
    if (cachedBrickContentHash !== undefined) {
      try {
        const cachedPayload = validateHestiaVoxelBrickMeshPayload({
          ...generatedPayload,
          inputMode: "CachedCanonicalBrick",
          cachedBrickContentHash
        });
        const cachedBundle = createCachedHestiaVoxelInputBundle(
          this.#cache,
          key,
          cachedPayload,
          contentRevision(HESTIA_SOURCE_REVISION_V1)
        );
        if (cachedBundle !== undefined) {
          this.#metrics.cacheHits += 1;
          return Object.freeze({ payload: cachedPayload, bundle: cachedBundle });
        }
      } catch {
        // A stale or corrupt cache entry is advisory only; generation remains authoritative.
      }
      this.#cachedBrickHashes.delete(canonicalKey);
    }
    this.#metrics.cacheMisses += 1;
    return Object.freeze({ payload: generatedPayload, bundle: emptyInputBundle() });
  }

  #payloadFor(brickCoordinate: Readonly<{ x: number; y: number; z: number }>): GenerateHestiaVoxelBrickMeshPayload {
    return validateHestiaVoxelBrickMeshPayload({
      presetId: HESTIA_PRESET_ID,
      inputMode: "Generate",
      rootSeed: this.#seed,
      bodyId: voxelBodyId(this.#frameChain.bodyId),
      surfaceFrameId: surfaceFrameId(this.#frameChain.surfaceFrame.frameId),
      regionId: voxelRegionId(REGION_ID),
      brickCoordinate,
      voxelSizeMeters: this.#voxelSizeMeters,
      generatorVersion: HESTIA_GENERATOR_VERSION_V1,
      materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
      sourceRevision: HESTIA_SOURCE_REVISION_V1,
      editRevision: HESTIA_EDIT_REVISION_V1,
      meshAlgorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
      outputRevision: contentRevision(this.#plan),
      generationColumnsPerSlice: MAX_HESTIA_GENERATION_COLUMNS_PER_SLICE
    });
  }

  #requestFor(payload: GenerateHestiaVoxelBrickMeshPayload, generation: number): WorkerJobRequest {
    const coordinate = payload.brickCoordinate;
    const id = `surface-lab:${generation}:${coordinate.x}:${coordinate.y}:${coordinate.z}`;
    return Object.freeze({
      jobId: workerJobId(id),
      jobKind: workerJobKind(GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND),
      targetKey: workerTargetKey(calculateVoxelSpatialJobTargetKey(payload)),
      planningEpoch: planningEpoch(this.#plan),
      workerEpoch: workerEpoch(0),
      inputRevision: contentRevision(HESTIA_SOURCE_REVISION_V1),
      algorithmVersion: algorithmVersion(1),
      priority: "Normal",
      deadline: jobDeadline(Number.MAX_SAFE_INTEGER),
      estimatedInputBytes: expectedHestiaVoxelInputBytes(payload),
      estimatedOutputBytes: byteCount(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES),
      payload
    });
  }

  #handleTerminal(generation: number, payload: GenerateHestiaVoxelBrickMeshPayload, terminal: WorkerJobTerminal): void {
    if (this.#disposeRequested || this.#lifecycle === "Disposed") return;
    if (generation !== this.#generation) {
      if (terminal.kind === "Completed" || terminal.kind === "Failed" && terminal.integrationDecision?.kind.startsWith("RejectedStale")) {
        this.#staleRejects += 1;
        this.#emit();
      }
      return;
    }
    if (terminal.kind !== "Completed") {
      if (terminal.kind === "Failed" && terminal.integrationDecision?.kind.startsWith("RejectedStale")) this.#staleRejects += 1;
      this.#metrics.failedChunks += 1;
    } else {
      try {
        const decoded = this.#decode(payload, terminal, artifactRevision(payload.outputRevision));
        const cacheKey = this.#admitToCache(this.#cache, payload, terminal);
        this.#cachedBrickHashes.set(canonicalizeContentKey(cacheKey), decoded.brickContentHash);
        this.#publish(decoded);
        this.#metrics.readyChunks += 1;
        this.#metrics.vertices += decoded.vertices;
        this.#metrics.triangles += decoded.triangles;
        this.#metrics.meshBytes += decoded.meshBytes;
        this.#metrics.generationMilliseconds += decoded.generationMilliseconds;
        this.#metrics.meshingMilliseconds += decoded.meshingMilliseconds;
        this.#metrics.brickHashes.push(decoded.brickContentHash);
        this.#metrics.meshHashes.push(decoded.meshContentHash);
      } catch {
        this.#metrics.failedChunks += 1;
      }
    }
    const settled = this.#metrics.readyChunks + this.#metrics.failedChunks;
    this.#lifecycle = settled >= SURFACE_LAB_REGION.chunkCount
      ? this.#metrics.failedChunks === 0 ? "Ready" : "Failed"
      : settled > 0 ? "Partial" : this.#lifecycle;
    this.#emit();
    this.#finishIfSettled(generation);
  }

  #publish(decoded: SurfaceLabDecodedChunk): void {
    const previous = this.#published.get(decoded.representationKey);
    if (decoded.artifact === undefined) {
      if (previous !== undefined) {
        this.#removeArtifact(previous.artifact);
        this.#published.delete(decoded.representationKey);
      }
      return;
    }
    if (previous?.artifact.contentHash === decoded.artifact.contentHash) return;
    if (previous !== undefined) {
      this.#removeArtifact(previous.artifact);
      this.#published.delete(decoded.representationKey);
    }
    const referencedProfiles = new Set(decoded.artifact.materialRanges.map((range) => range.materialProfileId));
    const profiles = SURFACE_LAB_MATERIAL_PROFILES.filter((profile) => referencedProfiles.has(profile.id));
    const before = this.#now();
    const backendRevision = this.#backend.readDiagnostics().backendRevision;
    let result: RenderCommandResult;
    try {
      result = this.#backend.dispatch(createRenderCommand({
        kind: "UpsertMeshArtifact",
        backendRevision,
        artifact: decoded.artifact,
        materialProfiles: profiles
      }));
    } catch (publicationError) {
      try {
        this.#removeArtifact(decoded.artifact);
      } catch {
        // Preserve the publication failure while still attempting exact, version-aware compensation.
      }
      throw publicationError;
    }
    this.#metrics.uploadMilliseconds += Math.max(0, this.#now() - before);
    resultAccepted(result, "Surface Lab artifact upsert");
    this.#published.set(decoded.representationKey, Object.freeze({
      artifact: decoded.artifact,
      meshContentHash: decoded.meshContentHash
    }));
  }

  #removeArtifact(artifact: MeshArtifact): void {
    const result = this.#backend.dispatch(createRenderCommand({
      kind: "RemoveRepresentation",
      backendRevision: this.#backend.readDiagnostics().backendRevision,
      representationKey: artifact.representationKey,
      expectedSourceRevision: artifact.sourceRevision,
      expectedArtifactRevision: artifact.artifactRevision,
      expectedContentHash: artifact.contentHash
    }));
    removalResultAccepted(result, "Surface Lab artifact removal");
  }

  #recordFailure(generation: number): void {
    if (this.#disposeRequested || generation !== this.#generation) return;
    this.#metrics.failedChunks += 1;
  }

  #finishIfSettled(generation: number): void {
    if (this.#disposeRequested || generation !== this.#generation) return;
    if (this.#metrics.readyChunks + this.#metrics.failedChunks < SURFACE_LAB_REGION.chunkCount) return;
    this.#lifecycle = this.#metrics.failedChunks === 0 ? "Ready" : "Failed";
    const snapshot = this.readTelemetry();
    this.#resolveSettled?.(snapshot);
    this.#resolveSettled = undefined;
  }

  #cancelTickets(): void {
    for (const ticket of this.#tickets) {
      if (ticket.cancel()) this.#cancelledJobs += 1;
    }
    this.#tickets = [];
  }

  #emit(): void {
    if (this.#disposeRequested && this.#lifecycle !== "Disposed") return;
    const snapshot = this.readTelemetry();
    for (const listener of this.#listeners) {
      try { listener(snapshot); } catch {
        // Read-only telemetry observers cannot alter controller decisions.
      }
    }
  }
}

export const createSurfaceLabController = (options: SurfaceLabControllerOptions): SurfaceLabController =>
  new SurfaceLabController(options);
