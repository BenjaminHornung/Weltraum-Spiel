import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  backendRevision,
  createMeshArtifact,
  frameId,
  materialProfileId,
  renderCommandResult,
  representationKey,
  sourceRevision,
  type RenderBackend,
  type RenderBackendCapabilities,
  type RenderBackendDiagnostics,
  type RenderCommand,
  type RenderCommandResult
} from "../../src/presentation";
import { ThreeRenderBackend, type ThreeRendererPort } from "../../src/render/three/backend";
import {
  SurfaceLabController,
  createSurfaceLabFrameChain,
  decodeSurfaceLabCompletedChunk,
  type SurfaceLabCompletedDecoder,
  type SurfaceLabWorkerPool
} from "../../src/surface-lab/surfaceLabController";
import { createSurfaceLabPresentationBackend } from "../../src/surface-lab/surfaceLabPresentationBackend";
import { isSurfaceLabQuery } from "../../src/surface-lab/surfaceLabQuery";
import {
  MemoryContentCache,
  admitHestiaVoxelWorkerOutputToCache,
  computeContentHash,
  createCachedHestiaVoxelInputBundle,
  createHestiaVoxelCacheKey
} from "../../src/streaming";
import {
  VOXEL_CHANNEL_BYTES,
  VOXEL_MESH_ALGORITHM_VERSION,
  calculateVoxelMeshRepresentationKey,
  calculateVoxelSpatialJobTargetKey,
  voxelContentHash
} from "../../src/voxel";
import {
  algorithmVersion,
  byteCount,
  contentRevision,
  expectedHestiaVoxelInputBytes,
  fnv1aBytes,
  StreamingWorkerRuntime,
  WorkerPool,
  validateHestiaVoxelBrickMeshPayload,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerTargetKey,
  type GenerateHestiaVoxelBrickMeshPayload,
  type HostToWorkerMessage,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobTerminal,
  type WorkerJobTicket,
  type WorkerPoolSnapshot,
  type WorkerToHostMessage,
  type WorkerTransport
} from "../../src/workers";

interface PendingJob {
  readonly request: WorkerJobRequest<GenerateHestiaVoxelBrickMeshPayload>;
  readonly resolve: (terminal: WorkerJobTerminal) => void;
  cancelled: boolean;
  settled: boolean;
}

class FakeWorkerPool implements SurfaceLabWorkerPool {
  readonly jobs: PendingJob[] = [];
  planningEpoch = 0;
  restarts = 0;
  latestWorkerEpoch = 1;
  state: WorkerPoolSnapshot["state"] = "Stopped";
  shutdownRequested = false;
  startError: Error | undefined;
  replacementError: Error | undefined;
  enqueueFailureAfter: number | undefined;
  #startGate: Promise<void> | undefined;
  #releaseStart: (() => void) | undefined;
  #replaceGate: Promise<void> | undefined;
  #releaseReplace: (() => void) | undefined;

  public async start(): Promise<void> {
    await this.#startGate;
    if (this.startError !== undefined) throw this.startError;
    if (!this.shutdownRequested) this.state = "Running";
  }

  public holdStart(): () => void {
    this.#startGate = new Promise<void>((resolve) => { this.#releaseStart = resolve; });
    return () => this.#releaseStart?.();
  }

  public holdReplacement(): () => void {
    this.#replaceGate = new Promise<void>((resolve) => { this.#releaseReplace = resolve; });
    return () => this.#releaseReplace?.();
  }

  public setPlanningEpoch(value: ReturnType<typeof planningEpoch>): void { this.planningEpoch = value; }

  public enqueue(source: WorkerJobRequest, _input: TransferableBufferBundle): WorkerJobTicket {
    if (this.enqueueFailureAfter !== undefined && this.jobs.length >= this.enqueueFailureAfter) {
      throw new Error("synthetic enqueue failure");
    }
    let resolve!: (terminal: WorkerJobTerminal) => void;
    const result = new Promise<WorkerJobTerminal>((complete) => { resolve = complete; });
    const pending: PendingJob = {
      request: source as WorkerJobRequest<GenerateHestiaVoxelBrickMeshPayload>,
      resolve,
      cancelled: false,
      settled: false
    };
    this.jobs.push(pending);
    return Object.freeze({
      jobId: source.jobId,
      result,
      cancel: () => {
        if (pending.cancelled || pending.settled) return false;
        pending.cancelled = true;
        pending.settled = true;
        pending.resolve(Object.freeze({ kind: "Cancelled", reason: "CancelledBeforeStart" }));
        return true;
      }
    });
  }

  public async replaceWorker(_slot: number): Promise<ReturnType<typeof workerEpoch>> {
    await this.#replaceGate;
    if (this.shutdownRequested) throw new Error("Replacement worker was terminated during shutdown.");
    if (this.replacementError !== undefined) throw this.replacementError;
    this.restarts += 1;
    this.latestWorkerEpoch += 1;
    return workerEpoch(this.latestWorkerEpoch);
  }

  public async shutdown(): Promise<void> {
    this.shutdownRequested = true;
    this.state = "Stopped";
    for (const pending of this.jobs.filter((job) => !job.settled)) {
      pending.settled = true;
      pending.resolve(Object.freeze({ kind: "Cancelled", reason: "CancelledBeforeStart" }));
    }
  }

  public snapshot(): WorkerPoolSnapshot {
    const unresolved = this.jobs.filter((job) => !job.settled).length;
    return Object.freeze({
      state: this.state,
      workerCount: 4,
      activeWorkers: this.state === "Running" ? 4 : 0,
      runningJobs: 0,
      workerRestarts: this.restarts,
      currentPlanningEpoch: planningEpoch(this.planningEpoch),
      latestWorkerEpoch: workerEpoch(this.latestWorkerEpoch),
      queue: Object.freeze({
        capacity: 32,
        size: unresolved,
        urgentDepth: 0,
        highDepth: 0,
        normalDepth: unresolved,
        consecutiveUrgentDispatches: 0,
        consecutiveNonNormalDispatches: 0,
        jobs: Object.freeze([])
      }),
      workers: Object.freeze([])
    });
  }

  public completePlanning(epoch: number): void {
    for (const pending of this.jobs.filter((job) => job.request.planningEpoch === epoch && !job.settled)) {
      pending.settled = true;
      pending.resolve(Object.freeze({
        kind: "Completed",
        result: Object.freeze({}) as Extract<WorkerJobTerminal, { kind: "Completed" }>["result"],
        output: Object.freeze({}) as Extract<WorkerJobTerminal, { kind: "Completed" }>["output"]
      }));
    }
  }

  public rejectPlanningAsStale(epoch: number): void {
    for (const pending of this.jobs.filter((job) => job.request.planningEpoch === epoch && !job.settled)) {
      pending.settled = true;
      pending.resolve(Object.freeze({
        kind: "Failed",
        failure: Object.freeze({ jobId: pending.request.jobId, code: "ProtocolFault", message: "stale result" }),
        integrationDecision: Object.freeze({ kind: "RejectedStalePlanningEpoch" })
      }));
    }
  }

  public failPlanning(epoch: number, count: number): void {
    for (const pending of this.jobs.filter((job) => job.request.planningEpoch === epoch && !job.settled).slice(0, count)) {
      pending.settled = true;
      pending.resolve(Object.freeze({
        kind: "Failed",
        failure: Object.freeze({ jobId: pending.request.jobId, code: "JobExecutionFailed", message: "fixture failure" })
      }));
    }
  }
}

class FakeBackend implements RenderBackend {
  readonly commands: RenderCommand[] = [];
  readonly resident = new Map<string, Extract<RenderCommand, { kind: "UpsertMeshArtifact" }>["artifact"]>();
  upsertResult: RenderCommandResult | undefined;
  state: RenderBackendDiagnostics["backendState"] = "Uninitialized";
  readonly ledger = new Map<string, Readonly<{
    sourceRevision: number;
    artifactRevision: number;
    contentHash: string;
    state: "Resident" | "Removed";
  }>>();

  public dispatch(command: RenderCommand): RenderCommandResult {
    this.commands.push(command);
    if (command.kind === "InitializeBackend") this.state = "Available";
    if (command.kind === "UpsertMeshArtifact") {
      if (this.upsertResult !== undefined) return this.upsertResult;
      const previous = this.ledger.get(command.artifact.representationKey);
      const incoming = [Number(command.artifact.sourceRevision), Number(command.artifact.artifactRevision)] as const;
      const prior = previous === undefined ? undefined : [previous.sourceRevision, previous.artifactRevision] as const;
      if (prior !== undefined && (incoming[0] < prior[0] || incoming[0] === prior[0] && incoming[1] < prior[1])) {
        return renderCommandResult("RejectedStaleRevision");
      }
      if (previous !== undefined && incoming[0] === prior?.[0] && incoming[1] === prior[1]) {
        if (previous.contentHash !== command.artifact.contentHash) return renderCommandResult("RejectedContentConflict");
        if (previous.state === "Removed") return renderCommandResult("RejectedStaleRevision");
        return renderCommandResult("AlreadyApplied");
      }
      this.resident.set(command.artifact.representationKey, command.artifact);
      this.ledger.set(command.artifact.representationKey, Object.freeze({
        sourceRevision: incoming[0],
        artifactRevision: incoming[1],
        contentHash: command.artifact.contentHash,
        state: "Resident"
      }));
    }
    if (command.kind === "RemoveRepresentation") {
      const previous = this.ledger.get(command.representationKey);
      if (previous === undefined || previous.state === "Removed") return renderCommandResult("NotFound");
      this.resident.delete(command.representationKey);
      this.ledger.set(command.representationKey, Object.freeze({ ...previous, state: "Removed" }));
    }
    if (command.kind === "DisposeBackend") this.state = "Disposed";
    return renderCommandResult("Accepted");
  }

  public renderFrame(): RenderCommandResult { return renderCommandResult("Accepted"); }

  public getCapabilities(): RenderBackendCapabilities {
    return Object.freeze({
      supportedIndexWidths: Object.freeze([16, 32] as const),
      supportedMaterialKinds: Object.freeze(["Unlit", "BasicLit", "DebugWireframe"] as const),
      supportsPerspectiveProjection: true,
      supportsEviction: true
    });
  }

  public readDiagnostics(): RenderBackendDiagnostics {
    return {
      acceptedArtifacts: 0,
      rejectedArtifacts: 0,
      activeRepresentations: this.resident.size,
      activeFallbacks: 0,
      geometryAllocations: 0,
      geometryDisposals: 0,
      materialAllocations: 0,
      materialDisposals: 0,
      estimatedGpuBytes: 0,
      ownedCpuBytes: 0,
      replacementCount: 0,
      removeCount: 0,
      staleRejectCount: 0,
      resetCount: 0,
      evictionCount: 0,
      evictionRejectCount: 0,
      rehydrationCount: 0,
      renderTargetAllocations: 0,
      renderTargetDisposals: 0,
      activeRenderTargets: 0,
      backendRevision: backendRevision(0),
      backendState: this.state,
      residentRepresentationKeys: Object.freeze([...this.resident.keys()].map(representationKey)),
      visibleRepresentationKeys: Object.freeze([]),
      pinnedFallbackRepresentationKeys: Object.freeze([])
    };
  }
}

class FakeThreeRenderer implements ThreeRendererPort {
  public setPixelRatio(): void {}
  public setSize(): void {}
  public render(): void {}
  public dispose(): void {}
}

type PresentationFaultKind = "ApplyFrameProjection" | "ApplyVisibilityPlan";

const realBackendFixture = (rejectOnce?: PresentationFaultKind): Readonly<{
  backend: RenderBackend;
  realBackend: ThreeRenderBackend;
  commands: RenderCommand[];
}> => {
  const realBackend = new ThreeRenderBackend({
    canvas: {} as HTMLCanvasElement,
    rendererFactory: () => new FakeThreeRenderer()
  });
  const commands: RenderCommand[] = [];
  let pendingRejection = rejectOnce;
  const recordingBackend: RenderBackend = {
    dispatch: (command) => {
      commands.push(command);
      if (command.kind === pendingRejection) {
        pendingRejection = undefined;
        return renderCommandResult("RejectedInvalidArtifact", "NotApplicable", "SyntheticPresentationFault");
      }
      return realBackend.dispatch(command);
    },
    renderFrame: () => realBackend.renderFrame(),
    getCapabilities: () => realBackend.getCapabilities(),
    readDiagnostics: () => realBackend.readDiagnostics()
  };
  const backend = createSurfaceLabPresentationBackend({
    backend: recordingBackend,
    readCamera: () => ({
      position: realBackend.camera.position,
      orientation: realBackend.camera.quaternion,
      verticalFovDegrees: realBackend.camera.fov,
      aspect: realBackend.camera.aspect,
      near: realBackend.camera.near,
      far: realBackend.camera.far
    })
  });
  return Object.freeze({ backend, realBackend, commands });
};

class RuntimeTransport implements WorkerTransport {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  #terminated = false;
  readonly #runtime = new StreamingWorkerRuntime((message, transfer = []) => {
    const cloned = structuredClone(message, { transfer: [...transfer] }) as WorkerToHostMessage;
    queueMicrotask(() => { if (!this.#terminated) this.onmessage?.({ data: cloned } as MessageEvent<unknown>); });
  });

  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    const cloned = structuredClone(message, { transfer }) as HostToWorkerMessage;
    queueMicrotask(() => { if (!this.#terminated) this.#runtime.handleMessage(cloned); });
  }

  public terminate(): void { this.#terminated = true; }
}

const emptyInput = (): TransferableBufferBundle => Object.freeze({
  ownership: "SenderToWorker",
  revision: contentRevision(0),
  byteLength: byteCount(0),
  buffers: Object.freeze([]),
  views: Object.freeze([]),
  contentHash: fnv1aBytes([])
});

const runAcceptedWorkerJob = async (
  source: WorkerJobRequest<GenerateHestiaVoxelBrickMeshPayload>,
  payload: GenerateHestiaVoxelBrickMeshPayload,
  id: string,
  inputBundle = emptyInput()
): Promise<Extract<WorkerJobTerminal, { kind: "Completed" }>> => {
  const pool = new WorkerPool({
    workerCount: 1,
    queueCapacity: 2,
    initialPlanningEpoch: source.planningEpoch,
    transportFactory: () => new RuntimeTransport()
  });
  await pool.start();
  const request = Object.freeze({
    ...source,
    jobId: workerJobId(id),
    targetKey: workerTargetKey(calculateVoxelSpatialJobTargetKey(payload)),
    workerEpoch: workerEpoch(0),
    estimatedInputBytes: expectedHestiaVoxelInputBytes(payload),
    payload
  });
  const terminal = await pool.enqueue(request, inputBundle).result;
  await pool.shutdown();
  if (terminal.kind !== "Completed") throw new Error(`Expected accepted worker output, received ${terminal.kind}.`);
  return terminal;
};

const deterministicScalar = (payload: GenerateHestiaVoxelBrickMeshPayload): number => {
  let value = payload.voxelSizeMeters === 0.25 ? 17 : 29;
  for (const character of payload.rootSeed) value = (value * 31 + character.charCodeAt(0)) % 997;
  return value / 997;
};

const decode: SurfaceLabCompletedDecoder = (payload, _terminal, presentationRevision) => {
  const offset = deterministicScalar(payload);
  const brickContentHash = voxelContentHash(`fnv1a64:${Math.floor(offset * 0xffffffffffff)
    .toString(16)
    .padStart(16, "0")}`);
  const key = calculateVoxelMeshRepresentationKey(
    { ...payload, contentHash: brickContentHash },
    VOXEL_MESH_ALGORITHM_VERSION
  );
  const positions = new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0]);
  const artifact = createMeshArtifact({
    representationKey: representationKey(key),
    sourceRevision: sourceRevision(0),
    artifactRevision: presentationRevision,
    algorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    frameId: frameId(payload.surfaceFrameId),
    positions,
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
    materialRanges: [{
      materialProfileId: materialProfileId("surface-lab:dark_rock"),
      startIndex: 0,
      indexCount: 3
    }],
    bounds: {
      min: { x: positions[0], y: 0, z: 0 },
      max: { x: positions[3], y: 1, z: 0 }
    }
  });
  return Object.freeze({
    representationKey: key,
    meshContentHash: artifact.contentHash,
    brickContentHash,
    artifact,
    vertices: 3,
    triangles: 1,
    meshBytes: artifact.positions.byteLength + artifact.normals.byteLength + artifact.indices.byteLength,
    generationMilliseconds: 2,
    meshingMilliseconds: 1
  });
};

const fixture = () => {
  const workerPool = new FakeWorkerPool();
  const backend = new FakeBackend();
  const controller = new SurfaceLabController({
    workerPool,
    backend,
    decodeCompleted: decode,
    admitToCache: (_cache, payload) => createHestiaVoxelCacheKey(payload, algorithmVersion(1))
  });
  return { workerPool, backend, controller };
};

const commandCount = (backend: FakeBackend, kind: RenderCommand["kind"]): number =>
  backend.commands.filter((command) => command.kind === kind).length;

describe("Surface Lab controller", () => {
  it("starts Idle at zero requests and preserves zero when worker startup fails", async () => {
    const workerPool = new FakeWorkerPool();
    workerPool.startError = new Error("synthetic start failure");
    const backend = new FakeBackend();
    const controller = new SurfaceLabController({ workerPool, backend });
    expect(controller.readTelemetry()).toMatchObject({ lifecycle: "Idle", requestedChunks: 0 });

    await expect(controller.start()).rejects.toThrow("synthetic start failure");
    expect(controller.readTelemetry()).toMatchObject({ lifecycle: "Failed", requestedChunks: 0 });
    expect(workerPool.jobs).toHaveLength(0);
    expect(commandCount(backend, "DisposeBackend")).toBe(1);
  });

  it("uses the real Hestia frame chain and requests the deterministic 4 x 1 x 4 region", async () => {
    const frames = createSurfaceLabFrameChain();
    expect(frames.bodyId).toBe("planet.hestia");
    expect(frames.bodyFixedFrame.frameId).toBe("frame:body-fixed.planet.hestia");
    expect(frames.surfaceFrame.frameId).toBe("frame:surface_hestia_surface_lab_v1");
    expect(frames.surfaceFrame.time.tick).toBe(7_200);

    const { workerPool, backend, controller } = fixture();
    await controller.start();
    expect(workerPool.jobs).toHaveLength(16);
    expect(new Set(workerPool.jobs.map((job) => JSON.stringify(job.request.payload.brickCoordinate))).size).toBe(16);
    expect(workerPool.jobs.every((job) => job.request.jobKind === "GenerateHestiaVoxelBrickMesh")).toBe(true);
    expect(workerPool.jobs.every((job) => job.request.targetKey === calculateVoxelSpatialJobTargetKey(job.request.payload))).toBe(true);
    expect(workerPool.jobs.every((job) => job.request.workerEpoch === 0 && job.request.planningEpoch === 1)).toBe(true);
    expect(workerPool.jobs.every((job) => job.request.payload.surfaceFrameId === frames.surfaceFrame.frameId)).toBe(true);
    workerPool.completePlanning(1);
    const ready = await controller.whenSettled();
    expect(ready).toMatchObject({
      lifecycle: "Ready",
      requestedChunks: 16,
      readyChunks: 16,
      failedChunks: 0,
      regionExtentMeters: { x: 64, y: 32, z: 64 }
    });
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(16);
    expect(ready.cacheMisses).toBe(16);
  });

  it("fails closed without publishing when an artifact upsert reports NotFound", async () => {
    const { workerPool, backend, controller } = fixture();
    backend.upsertResult = renderCommandResult("NotFound");
    await controller.start();
    workerPool.completePlanning(1);

    await expect(controller.whenSettled()).resolves.toMatchObject({
      lifecycle: "Failed",
      requestedChunks: 16,
      readyChunks: 0,
      failedChunks: 16
    });
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(16);
    expect(backend.resident.size).toBe(0);
  });

  it("settles after synchronous enqueue failures and reports only successful tickets as requested", async () => {
    const { workerPool, backend, controller } = fixture();
    workerPool.enqueueFailureAfter = 5;
    await controller.start();
    expect(workerPool.jobs).toHaveLength(5);
    workerPool.completePlanning(1);

    await expect(controller.whenSettled()).resolves.toMatchObject({
      lifecycle: "Failed",
      requestedChunks: 5,
      readyChunks: 5,
      failedChunks: 11
    });
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(5);
    expect(backend.resident.size).toBe(5);
  });

  it("emits terminal failure when every regeneration enqueue fails synchronously", async () => {
    const { workerPool, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const emitted: ReturnType<SurfaceLabController["readTelemetry"]>[] = [];
    const unsubscribe = controller.subscribe((snapshot) => { emitted.push(snapshot); });
    workerPool.enqueueFailureAfter = 0;

    const settled = await controller.regenerate("hestia-surface-lab-sync-enqueue-failure");

    expect(settled).toMatchObject({ lifecycle: "Failed", requestedChunks: 0, readyChunks: 0, failedChunks: 16 });
    expect(emitted.at(-1)).toMatchObject({ lifecycle: "Failed", requestedChunks: 0, readyChunks: 0, failedChunks: 16 });
    expect(controller.readTelemetry()).toMatchObject({
      lifecycle: "Failed",
      requestedChunks: 0,
      readyChunks: 0,
      failedChunks: 16
    });
    unsubscribe();
  });

  it("adopts exact accepted worker buffers, snapshots untrusted buffers and omits empty artifacts", async () => {
    const source = fixture();
    await source.controller.start();
    const request = source.workerPool.jobs[0]?.request;
    if (request === undefined) throw new Error("Expected a Surface Lab worker request.");
    await source.controller.dispose();

    const accepted = await runAcceptedWorkerJob(request, request.payload, "surface-lab-decoder-adopt");
    const untrusted = structuredClone(accepted) as Extract<WorkerJobTerminal, { kind: "Completed" }>;
    const revision = artifactRevision(request.payload.outputRevision);
    const adopted = decodeSurfaceLabCompletedChunk(request.payload, accepted, revision);
    const snapshotted = decodeSurfaceLabCompletedChunk(request.payload, untrusted, revision);
    expect(adopted.artifact?.positions.buffer).toBe(accepted.output.buffers[2]);
    expect(snapshotted.artifact?.positions.buffer).not.toBe(untrusted.output.buffers[2]);
    expect(snapshotted.artifact?.positions).toEqual(new Float32Array(untrusted.output.buffers[2]));

    const cache = new MemoryContentCache(2 * VOXEL_CHANNEL_BYTES);
    const cacheKey = admitHestiaVoxelWorkerOutputToCache(cache, request.payload, accepted);
    const beforeLease = cache.get(cacheKey);
    if (beforeLease === undefined) throw new Error("Expected admitted canonical cache entry.");
    const cachedBytes = new Uint8Array(beforeLease.buffer).slice();
    beforeLease.release();
    const cachedPayload = validateHestiaVoxelBrickMeshPayload({
      ...request.payload,
      inputMode: "CachedCanonicalBrick",
      cachedBrickContentHash: adopted.brickContentHash,
      outputRevision: contentRevision(2)
    });
    const cachedBundle = createCachedHestiaVoxelInputBundle(
      cache,
      cacheKey,
      cachedPayload,
      contentRevision(0)
    );
    if (cachedBundle === undefined) throw new Error("Expected cached worker input.");
    const cachedTerminal = await runAcceptedWorkerJob(
      request,
      cachedPayload,
      "surface-lab-decoder-cached-snapshot",
      cachedBundle
    );
    const cached = decodeSurfaceLabCompletedChunk(cachedPayload, cachedTerminal, artifactRevision(2));
    expect(cached.artifact?.ownership).toBe("SnapshotOwned");
    expect(cached.artifact?.positions.buffer).not.toBe(cachedTerminal.output.buffers[2]);
    const afterLease = cache.get(cacheKey);
    if (afterLease === undefined) throw new Error("Expected canonical cache entry after cached meshing.");
    expect(new Uint8Array(afterLease.buffer)).toEqual(cachedBytes);
    afterLease.release();

    const emptyPayload = validateHestiaVoxelBrickMeshPayload({
      ...request.payload,
      brickCoordinate: { x: 0, y: 100, z: 0 }
    });
    const emptyTerminal = await runAcceptedWorkerJob(request, emptyPayload, "surface-lab-decoder-empty");
    const empty = decodeSurfaceLabCompletedChunk(emptyPayload, emptyTerminal, artifactRevision(emptyPayload.outputRevision));
    expect(empty).toMatchObject({ vertices: 0, triangles: 0, meshBytes: 0 });
    expect(empty.artifact).toBeUndefined();
  }, 120_000);

  it("uses one canonical cache for real misses, accepted admission and hits", async () => {
    const cache = new MemoryContentCache(32 * VOXEL_CHANNEL_BYTES);
    const backend = new FakeBackend();
    const workerPool = new WorkerPool({
      workerCount: 4,
      queueCapacity: 32,
      transportFactory: () => new RuntimeTransport()
    });
    const controller = new SurfaceLabController({ workerPool, backend, cache });
    await controller.start();
    const first = await controller.whenSettled();
    expect(first).toMatchObject({ lifecycle: "Ready", cacheHits: 0, cacheMisses: 16, cacheBypasses: 0 });
    expect(cache.snapshot()).toMatchObject({ entryCount: 16, totalBytes: 16 * VOXEL_CHANNEL_BYTES });

    const cached = await controller.restartWorker(0);
    expect(cached).toMatchObject({ lifecycle: "Ready", cacheHits: 16, cacheMisses: 0, cacheBypasses: 0 });
    expect(cached.brickHashes).toEqual(first.brickHashes);
    expect(cached.meshHashes).toEqual(first.meshHashes);

    expect(backend.commands.some((command) => command.kind === "UpsertMeshArtifact")).toBe(true);
    await controller.dispose();
  }, 120_000);

  it("degrades corrupt cache input to Generate misses and prunes shadow lookup on input changes", async () => {
    const cache = new MemoryContentCache(32 * VOXEL_CHANNEL_BYTES);
    const workerPool = new FakeWorkerPool();
    const backend = new FakeBackend();
    const controller = new SurfaceLabController({
      workerPool,
      backend,
      cache,
      decodeCompleted: decode,
      admitToCache: (_cache, payload) => createHestiaVoxelCacheKey(payload, algorithmVersion(1))
    });
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const firstRequest = workerPool.jobs.find((job) => job.request.planningEpoch === 1)?.request;
    if (firstRequest === undefined) throw new Error("Expected a first-generation request.");
    const corruptKey = createHestiaVoxelCacheKey(firstRequest.payload, algorithmVersion(1));
    const corruptBuffer = new ArrayBuffer(8);
    cache.put({
      key: corruptKey,
      buffer: corruptBuffer,
      byteLength: corruptBuffer.byteLength,
      contentHash: computeContentHash(corruptBuffer),
      layout: "corrupt-hestia-layout"
    });

    const restarted = controller.restartWorker(0);
    await Promise.resolve();
    await Promise.resolve();
    const restartedJobs = workerPool.jobs.filter((job) => job.request.planningEpoch === 2);
    expect(restartedJobs).toHaveLength(16);
    expect(restartedJobs.every((job) => job.request.payload.inputMode === "Generate")).toBe(true);
    workerPool.completePlanning(2);
    await expect(restarted).resolves.toMatchObject({ lifecycle: "Ready", cacheHits: 0, cacheMisses: 16 });

    const changedInput = controller.setResolution(0.25);
    const changedJobs = workerPool.jobs.filter((job) => job.request.planningEpoch === 3);
    expect(changedJobs).toHaveLength(16);
    expect(changedJobs.every((job) => job.request.payload.inputMode === "Generate")).toBe(true);
    workerPool.completePlanning(3);
    await expect(changedInput).resolves.toMatchObject({ lifecycle: "Ready", cacheHits: 0, cacheMisses: 16 });
  });

  it("keeps same-seed regeneration stable and revision-safely replaces changed seed and resolution", async () => {
    const { workerPool, backend, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    const first = await controller.whenSettled();
    const initialUpserts = commandCount(backend, "UpsertMeshArtifact");
    const firstKeys = [...backend.resident.keys()].sort();
    expect(new Set([...backend.resident.values()].map((artifact) => artifact.artifactRevision))).toEqual(new Set([1]));

    const sameSeed = controller.regenerate();
    workerPool.completePlanning(2);
    const repeated = await sameSeed;
    expect(repeated.meshHashes).toEqual(first.meshHashes);
    expect(repeated.cacheBypasses).toBe(16);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(16);
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(initialUpserts + 16);
    expect([...backend.resident.keys()].sort()).toEqual(firstKeys);
    expect(new Set([...backend.resident.values()].map((artifact) => artifact.artifactRevision))).toEqual(new Set([2]));

    const changedSeed = controller.regenerate("hestia-surface-lab-v1-b");
    workerPool.completePlanning(3);
    const reseeded = await changedSeed;
    expect(reseeded.meshHashes).not.toEqual(first.meshHashes);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(32);
    expect(new Set([...backend.resident.values()].map((artifact) => artifact.artifactRevision))).toEqual(new Set([3]));

    const quarterMeter = controller.setResolution(0.25);
    workerPool.completePlanning(4);
    const resized = await quarterMeter;
    expect(resized.regionExtentMeters).toEqual({ x: 32, y: 16, z: 32 });
    expect(resized.meshHashes).not.toEqual(reseeded.meshHashes);
    expect(resized.planningEpoch).toBe(4);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(48);
    expect(new Set([...backend.resident.values()].map((artifact) => artifact.artifactRevision))).toEqual(new Set([4]));
  });

  it("preserves canonical keys across A-B-A and resurrects them above tombstones in the real Three backend", async () => {
    const workerPool = new FakeWorkerPool();
    const { backend, realBackend, commands } = realBackendFixture();
    const controller = new SurfaceLabController({
      workerPool,
      backend,
      decodeCompleted: decode,
      admitToCache: (_cache, payload) => createHestiaVoxelCacheKey(payload, algorithmVersion(1))
    });
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const upserts = () => commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
      command.kind === "UpsertMeshArtifact");
    const firstA = upserts().filter((command) => command.artifact.artifactRevision === 1).map((command) => command.artifact);
    expect(firstA).toHaveLength(16);
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 16,
      residentRepresentationKeys: firstA.map((artifact) => artifact.representationKey).sort(),
      visibleRepresentationKeys: firstA.map((artifact) => artifact.representationKey).sort()
    });

    const sameInput = controller.regenerate();
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 0,
      residentRepresentationKeys: [],
      visibleRepresentationKeys: []
    });
    workerPool.completePlanning(2);
    await sameInput;
    const sameA = upserts().filter((command) => command.artifact.artifactRevision === 2).map((command) => command.artifact);
    expect(sameA.map((artifact) => artifact.representationKey).sort()).toEqual(
      firstA.map((artifact) => artifact.representationKey).sort()
    );
    expect(sameA.map((artifact) => artifact.contentHash).sort()).toEqual(
      firstA.map((artifact) => artifact.contentHash).sort()
    );
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 16,
      visibleRepresentationKeys: sameA.map((artifact) => artifact.representationKey).sort(),
      staleRejectCount: 0,
      removeCount: 16
    });

    const restarted = controller.restartWorker(0);
    await Promise.resolve();
    await Promise.resolve();
    workerPool.completePlanning(3);
    await restarted;
    const restartedA = upserts().filter((command) => command.artifact.artifactRevision === 3).map((command) => command.artifact);
    expect(restartedA.map((artifact) => artifact.representationKey).sort()).toEqual(
      firstA.map((artifact) => artifact.representationKey).sort()
    );
    expect(new Set(restartedA.map((artifact) => artifact.artifactRevision))).toEqual(new Set([3]));
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 16,
      visibleRepresentationKeys: restartedA.map((artifact) => artifact.representationKey).sort(),
      staleRejectCount: 0,
      removeCount: 32
    });

    const seedB = controller.regenerate("hestia-surface-lab-v1-b");
    workerPool.completePlanning(4);
    await seedB;
    const seedBArtifacts = upserts().filter((command) => command.artifact.artifactRevision === 4).map((command) => command.artifact);
    expect(new Set(seedBArtifacts.map((artifact) => artifact.representationKey))).not.toEqual(
      new Set(firstA.map((artifact) => artifact.representationKey))
    );
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 16,
      residentRepresentationKeys: seedBArtifacts.map((artifact) => artifact.representationKey).sort(),
      visibleRepresentationKeys: seedBArtifacts.map((artifact) => artifact.representationKey).sort(),
      staleRejectCount: 0
    });

    const resolutionB = controller.setResolution(0.25);
    workerPool.completePlanning(5);
    await resolutionB;
    const resolutionBArtifacts = upserts().filter((command) => command.artifact.artifactRevision === 5).map((command) => command.artifact);
    expect(new Set(resolutionBArtifacts.map((artifact) => artifact.representationKey))).not.toEqual(
      new Set(seedBArtifacts.map((artifact) => artifact.representationKey))
    );

    const restoreResolution = controller.setResolution(0.5);
    workerPool.completePlanning(6);
    await restoreResolution;
    const restoreA = controller.regenerate("hestia-surface-lab-v1");
    workerPool.completePlanning(7);
    await restoreA;

    const finalA = upserts().filter((command) => command.artifact.artifactRevision === 7).map((command) => command.artifact);
    expect(finalA).toHaveLength(16);
    expect(finalA.map((artifact) => artifact.representationKey).sort()).toEqual(
      firstA.map((artifact) => artifact.representationKey).sort()
    );
    expect(finalA.map((artifact) => artifact.contentHash).sort()).toEqual(
      firstA.map((artifact) => artifact.contentHash).sort()
    );
    expect(new Set(finalA.map((artifact) => artifact.artifactRevision))).toEqual(new Set([7]));
    const firstKey = firstA[0]?.representationKey;
    if (firstKey === undefined) throw new Error("Expected an A representation.");
    expect(commands.some((command) => command.kind === "RemoveRepresentation"
      && command.representationKey === firstKey
      && command.expectedArtifactRevision === 1)).toBe(true);
    expect(realBackend.readDiagnostics()).toMatchObject({
      activeRepresentations: 16,
      residentRepresentationKeys: finalA.map((artifact) => artifact.representationKey).sort(),
      visibleRepresentationKeys: finalA.map((artifact) => artifact.representationKey).sort(),
      staleRejectCount: 0,
      removeCount: 96
    });
    const projectionRevisions = commands
      .filter((command): command is Extract<RenderCommand, { kind: "ApplyFrameProjection" }> => command.kind === "ApplyFrameProjection")
      .map((command) => Number(command.snapshot.frameRevision));
    const visibilityRevisions = commands
      .filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> => command.kind === "ApplyVisibilityPlan")
      .map((command) => Number(command.plan.planRevision));
    expect(projectionRevisions).toEqual(projectionRevisions.map((_value, index) => index + 1));
    expect(visibilityRevisions).toEqual(projectionRevisions);
    await controller.dispose();
  });

  it.each(["ApplyFrameProjection", "ApplyVisibilityPlan"] as const)(
    "compensates an accepted artifact when %s rejects and prevents later resurrection or generation mixing",
    async (faultKind) => {
      const workerPool = new FakeWorkerPool();
      const { backend, realBackend, commands } = realBackendFixture(faultKind);
      const controller = new SurfaceLabController({
        workerPool,
        backend,
        decodeCompleted: decode,
        admitToCache: (_cache, payload) => createHestiaVoxelCacheKey(payload, algorithmVersion(1))
      });
      await controller.start();
      workerPool.completePlanning(1);
      await expect(controller.whenSettled()).resolves.toMatchObject({
        lifecycle: "Failed",
        requestedChunks: 16,
        readyChunks: 15,
        failedChunks: 1
      });

      const firstGeneration = commands
        .filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
          command.kind === "UpsertMeshArtifact" && command.artifact.artifactRevision === 1)
        .map((command) => command.artifact);
      expect(firstGeneration).toHaveLength(16);
      const rejectedArtifact = firstGeneration[0];
      if (rejectedArtifact === undefined) throw new Error("Expected a rejected first-generation artifact.");
      expect(realBackend.readDiagnostics()).toMatchObject({ activeRepresentations: 15 });
      expect(realBackend.readDiagnostics().residentRepresentationKeys).not.toContain(rejectedArtifact.representationKey);
      expect(realBackend.readDiagnostics().visibleRepresentationKeys).not.toContain(rejectedArtifact.representationKey);

      const changedSeed = controller.regenerate(`hestia-surface-lab-${faultKind}-recovery`);
      workerPool.completePlanning(2);
      await expect(changedSeed).resolves.toMatchObject({
        lifecycle: "Ready",
        requestedChunks: 16,
        readyChunks: 16,
        failedChunks: 0
      });
      const secondGeneration = commands
        .filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
          command.kind === "UpsertMeshArtifact" && command.artifact.artifactRevision === 2)
        .map((command) => command.artifact);
      expect(secondGeneration).toHaveLength(16);
      const secondKeys = secondGeneration.map((artifact) => artifact.representationKey).sort();
      const firstKeys = new Set(firstGeneration.map((artifact) => artifact.representationKey));
      expect(secondKeys.some((key) => firstKeys.has(key))).toBe(false);
      expect(realBackend.readDiagnostics()).toMatchObject({
        activeRepresentations: 16,
        residentRepresentationKeys: secondKeys,
        visibleRepresentationKeys: secondKeys
      });
      expect(commands.filter((command) => command.kind === "RemoveRepresentation"
        && command.representationKey === rejectedArtifact.representationKey
        && command.expectedArtifactRevision === rejectedArtifact.artifactRevision)).toHaveLength(1);
      await controller.dispose();
    }
  );

  it("prevalidates invalid seeds without mutating active generation state", async () => {
    const invalidFixture = () => new SurfaceLabController({
      workerPool: new FakeWorkerPool(),
      backend: new FakeBackend(),
      initialSeed: "invalid seed"
    });
    expect(invalidFixture).toThrow(/rootSeed/);

    const { workerPool, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const before = controller.readTelemetry();
    expect(() => controller.regenerate("invalid seed")).toThrow(/rootSeed/);
    expect(controller.readTelemetry()).toMatchObject({
      seed: before.seed,
      planningEpoch: before.planningEpoch,
      lifecycle: before.lifecycle,
      requestedChunks: before.requestedChunks,
      readyChunks: before.readyChunks
    });
  });

  it("reports partial progress and settles a one-of-sixteen failure", async () => {
    const { workerPool, controller } = fixture();
    await controller.start();
    workerPool.failPlanning(1, 1);
    await Promise.resolve();
    expect(controller.readTelemetry()).toMatchObject({ lifecycle: "Partial", readyChunks: 0, failedChunks: 1 });
    workerPool.completePlanning(1);
    await expect(controller.whenSettled()).resolves.toMatchObject({
      lifecycle: "Failed",
      requestedChunks: 16,
      readyChunks: 15,
      failedChunks: 1
    });
  });

  it("clears a complete same-input generation before a one-of-sixteen replacement failure", async () => {
    const { workerPool, backend, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const firstUpsert = backend.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
      command.kind === "UpsertMeshArtifact");
    if (firstUpsert === undefined) throw new Error("Expected a published first-generation artifact.");

    const replacement = controller.regenerate();
    expect(backend.resident.size).toBe(0);
    workerPool.failPlanning(2, 1);
    workerPool.completePlanning(2);
    await expect(replacement).resolves.toMatchObject({ lifecycle: "Failed", readyChunks: 15, failedChunks: 1 });
    expect(backend.resident.size).toBe(15);
    expect(backend.resident.has(firstUpsert.artifact.representationKey)).toBe(false);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(16);
  });

  it("cancels superseded jobs, records a genuine stale rejection and regenerates after worker replacement", async () => {
    const { workerPool, backend, controller } = fixture();
    await controller.start();
    const current = controller.regenerate("replacement-seed");
    expect(controller.readTelemetry().cancelledJobs).toBe(16);

    workerPool.rejectPlanningAsStale(2);
    await Promise.resolve();
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(0);
    expect(controller.readTelemetry().staleRejects).toBe(16);

    expect((await current).lifecycle).toBe("Failed");

    const recovered = controller.regenerate("replacement-seed");
    workerPool.completePlanning(3);
    expect((await recovered).lifecycle).toBe("Ready");

    const restarted = controller.restartWorker(0);
    await Promise.resolve();
    await Promise.resolve();
    workerPool.completePlanning(4);
    const afterRestart = await restarted;
    expect(afterRestart.lifecycle).toBe("Ready");
    expect(afterRestart.workerRestarts).toBe(1);
    expect(afterRestart.planningEpoch).toBe(4);
  });

  it("surfaces a genuine worker replacement rejection as an explicit controller failure", async () => {
    const { workerPool, backend, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const jobsBefore = workerPool.jobs.length;
    const removalsBefore = commandCount(backend, "RemoveRepresentation");
    workerPool.replacementError = new Error("synthetic replacement rejection");

    await expect(controller.restartWorker(0)).rejects.toThrow("synthetic replacement rejection");
    expect(controller.readTelemetry().lifecycle).toBe("Failed");
    expect(workerPool.jobs).toHaveLength(jobsBefore);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(removalsBefore);
    expect(backend.resident.size).toBe(16);
  });

  it("removes all published artifacts and shuts down exactly once", async () => {
    const { workerPool, backend, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    expect(backend.resident.size).toBe(16);

    await controller.dispose();
    await controller.dispose();
    expect(controller.readTelemetry().lifecycle).toBe("Disposed");
    expect(workerPool.state).toBe("Stopped");
    expect(backend.resident.size).toBe(0);
    expect(commandCount(backend, "RemoveRepresentation")).toBe(16);
    expect(commandCount(backend, "DisposeBackend")).toBe(1);
  });

  it("does not enqueue or publish when disposal races asynchronous start and restart", async () => {
    const startPool = new FakeWorkerPool();
    const startBackend = new FakeBackend();
    const releaseStart = startPool.holdStart();
    const startController = new SurfaceLabController({ workerPool: startPool, backend: startBackend });
    const starting = startController.start();
    const disposing = startController.dispose();
    releaseStart();
    await Promise.all([starting, disposing]);
    expect(startPool.jobs).toHaveLength(0);
    expect(startPool.state).toBe("Stopped");
    expect(commandCount(startBackend, "DisposeBackend")).toBe(1);

    const { workerPool, backend, controller } = fixture();
    await controller.start();
    workerPool.completePlanning(1);
    await controller.whenSettled();
    const jobCount = workerPool.jobs.length;
    const releaseReplacement = workerPool.holdReplacement();
    const restarting = controller.restartWorker(0);
    const restartDisposal = controller.dispose();
    releaseReplacement();
    await expect(restarting).resolves.toMatchObject({ lifecycle: "Disposed" });
    await restartDisposal;
    expect(workerPool.jobs).toHaveLength(jobCount);
    expect(controller.readTelemetry().lifecycle).toBe("Disposed");
    await expect(controller.whenSettled()).resolves.toMatchObject({ lifecycle: "Disposed" });
    expect(commandCount(backend, "UpsertMeshArtifact")).toBe(16);
    expect(commandCount(backend, "DisposeBackend")).toBe(1);
  });

  it("keeps the normal runtime behind a singular exact executable query gate", () => {
    expect(isSurfaceLabQuery(new URLSearchParams("surfaceLab=1"))).toBe(true);
    for (const query of [
      "",
      "surfaceLab=",
      "surfaceLab=0",
      "surfaceLab=01",
      "surfaceLab=true",
      "surfaceLab=1&surfaceLab=1",
      "surfaceLab=1&surfaceLab=0",
      "surfaceLab=1&surfaceLab="
    ]) {
      expect(isSurfaceLabQuery(new URLSearchParams(query))).toBe(false);
    }
    expect(isSurfaceLabQuery(new URLSearchParams("surfaceLab=1&unrelated=value"))).toBe(true);
    const mainSource = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
    expect(mainSource).toContain("isSurfaceLabQuery(searchParams)");
    expect(mainSource).toContain('import("./surface-lab")');
  });
});
