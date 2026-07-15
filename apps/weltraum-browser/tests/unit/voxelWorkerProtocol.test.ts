import { beforeAll, describe, expect, it } from "vitest";
import { PerformanceTelemetry, createMemoryContentCacheTelemetryObserver, createWorkerPoolTelemetryObserver } from "../../src/diagnostics/performance";
import {
  MemoryContentCache,
  admitHestiaVoxelWorkerOutputToCache,
  contentKeysEqual,
  createCachedHestiaVoxelInputBundle,
  createHestiaVoxelCacheKey,
} from "../../src/streaming";
import {
  HESTIA_EDIT_REVISION_V1,
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_PRESET_ID,
  HESTIA_SOURCE_REVISION_V1,
  generateHestiaVoxelBrick,
  generateHestiaVoxelBrickInSlices,
} from "../../src/world-generation/hestia";
import {
  VOXEL_CHANNEL_BYTES,
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  VOXEL_MESH_ALGORITHM_VERSION,
  calculateVoxelSpatialJobTargetKey,
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  voxelMeshRepresentationKey,
} from "../../src/voxel";
import {
  GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND,
  MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES,
  StreamingWorkerRuntime,
  WorkerPool,
  algorithmVersion,
  byteCount,
  contentRevision,
  fnv1aBytes,
  integrateWorkerResult,
  isWorkerToHostMessage,
  jobDeadline,
  planningEpoch,
  validateHestiaVoxelBrickMeshPayload,
  validateHestiaVoxelWorkerOutputByteLength,
  validateHestiaVoxelWorkerOutput,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type GenerateHestiaVoxelBrickMeshPayload,
  type HostToWorkerMessage,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobResult,
  type WorkerToHostMessage,
  type WorkerTransport,
} from "../../src/workers";

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

class HeldCompletionTransport implements WorkerTransport {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly outputDelivered: Promise<void>;
  #resolveOutputDelivered!: () => void;
  #heldCompletion: WorkerToHostMessage | undefined;
  #terminated = false;
  readonly #runtime = new StreamingWorkerRuntime((message, transfer = []) => {
    const cloned = structuredClone(message, { transfer: [...transfer] }) as WorkerToHostMessage;
    if (cloned.type === "JobCompleted") {
      this.#heldCompletion = cloned;
      return;
    }
    queueMicrotask(() => {
      if (this.#terminated) return;
      this.onmessage?.({ data: cloned } as MessageEvent<unknown>);
      if (cloned.type === "JobOutputData") this.#resolveOutputDelivered();
    });
  });

  public constructor() {
    this.outputDelivered = new Promise<void>((resolve) => { this.#resolveOutputDelivered = resolve; });
  }

  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    const cloned = structuredClone(message, { transfer }) as HostToWorkerMessage;
    queueMicrotask(() => { if (!this.#terminated) this.#runtime.handleMessage(cloned); });
  }

  public releaseCompletion(transformResult?: (result: WorkerJobResult) => WorkerJobResult): void {
    const completion = this.#heldCompletion;
    if (completion === undefined) throw new Error("No worker completion is being held.");
    this.#heldCompletion = undefined;
    const released = transformResult !== undefined && completion.type === "JobCompleted"
      ? Object.freeze({ ...completion, result: transformResult(completion.result) })
      : completion;
    queueMicrotask(() => { if (!this.#terminated) this.onmessage?.({ data: released } as MessageEvent<unknown>); });
  }

  public terminate(): void { this.#terminated = true; }
}

const generatedPayload = (): GenerateHestiaVoxelBrickMeshPayload => validateHestiaVoxelBrickMeshPayload({
  presetId: HESTIA_PRESET_ID,
  inputMode: "Generate",
  rootSeed: "hestia-worker-fixture-alpha",
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
  regionId: voxelRegionId("region:hestia.worker-preview"),
  brickCoordinate: { x: 0, y: -1, z: 0 },
  voxelSizeMeters: 0.5,
  generatorVersion: HESTIA_GENERATOR_VERSION_V1,
  materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  sourceRevision: HESTIA_SOURCE_REVISION_V1,
  editRevision: HESTIA_EDIT_REVISION_V1,
  meshAlgorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
  outputRevision: contentRevision(2),
  generationColumnsPerSlice: 4,
});

const emptyInput = (): TransferableBufferBundle => Object.freeze({
  ownership: "SenderToWorker",
  revision: contentRevision(0),
  byteLength: byteCount(0),
  buffers: Object.freeze([]),
  views: Object.freeze([]),
  contentHash: fnv1aBytes([]),
});

const requestFor = (
  payload: GenerateHestiaVoxelBrickMeshPayload,
  id = "hestia-worker-job",
): WorkerJobRequest => Object.freeze({
  jobId: workerJobId(id),
  jobKind: workerJobKind(GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND),
  targetKey: workerTargetKey(calculateVoxelSpatialJobTargetKey(payload)),
  planningEpoch: planningEpoch(1),
  workerEpoch: workerEpoch(3),
  inputRevision: contentRevision(0),
  algorithmVersion: algorithmVersion(1),
  priority: "Normal",
  deadline: jobDeadline(10),
  estimatedInputBytes: byteCount(payload.inputMode === "Generate" ? 0 : VOXEL_CHANNEL_BYTES),
  estimatedOutputBytes: byteCount(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES),
  payload,
});

interface RuntimeArtifact {
  readonly request: WorkerJobRequest;
  readonly result: WorkerJobResult;
  readonly output: TransferableBufferBundle;
  readonly transfers: readonly Transferable[];
}

const executeRuntime = async (
  payload: GenerateHestiaVoxelBrickMeshPayload,
  input: TransferableBufferBundle,
  id: string,
): Promise<RuntimeArtifact> => {
  const emitted: WorkerToHostMessage[] = [];
  const transfers: Transferable[][] = [];
  const runtime = new StreamingWorkerRuntime((message, transfer = []) => {
    emitted.push(message);
    transfers.push([...transfer]);
  });
  const request = requestFor(payload, id);
  runtime.handleMessage({ type: "InitializeWorker", workerEpoch: request.workerEpoch });
  runtime.handleMessage({ type: "EnqueueJob", request });
  runtime.handleMessage({ type: "JobInputData", jobId: request.jobId, workerEpoch: request.workerEpoch, bundle: input });
  for (let attempt = 0; attempt < 300 && !emitted.some((message) => message.type === "JobCompleted"); attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  const outputIndex = emitted.findIndex((message) => message.type === "JobOutputData");
  const outputMessage = emitted[outputIndex];
  const completed = emitted.find((message) => message.type === "JobCompleted");
  if (outputMessage?.type !== "JobOutputData" || completed?.type !== "JobCompleted") throw new Error("Worker did not publish a complete artifact.");
  return Object.freeze({ request, result: completed.result, output: outputMessage.bundle, transfers: transfers[outputIndex] ?? [] });
};

describe("Hestia voxel worker protocol", () => {
  let generated: RuntimeArtifact;

  beforeAll(async () => {
    generated = await executeRuntime(generatedPayload(), emptyInput(), "hestia-generated");
  }, 20_000);

  it("shares deterministic generation between synchronous and cooperative sliced APIs", async () => {
    const payload = generatedPayload();
    let checkpoints = 0;
    const sliced = await generateHestiaVoxelBrickInSlices(payload, {
      columnsPerSlice: 7,
      checkpoint: async () => { checkpoints += 1; },
    });
    const synchronous = generateHestiaVoxelBrick(payload);
    expect(checkpoints).toBeGreaterThan(1);
    expect(sliced.contentHash).toBe(synchronous.contentHash);
    expect(new Uint8Array(sliced.densityBuffer.buffer)).toEqual(new Uint8Array(synchronous.densityBuffer.buffer));
    expect(sliced.materialBuffer).toEqual(synchronous.materialBuffer);
  }, 20_000);

  it("publishes one canonical brick plus mesh as five exact transfer-owned buffers", () => {
    const payload = generatedPayload();
    const validated = validateHestiaVoxelWorkerOutput(payload, generated.result, generated.output);
    expect(generated.output.ownership).toBe("WorkerToConsumer");
    expect(generated.output.buffers).toHaveLength(5);
    expect(generated.output.views.map((view) => [view.name, view.bufferIndex, view.kind])).toEqual([
      ["density", 0, "Float32Array"],
      ["material", 1, "Uint8Array"],
      ["positions", 2, "Float32Array"],
      ["normals", 3, "Float32Array"],
      ["indices", 4, validated.details.indexKind],
    ]);
    expect(new Set(generated.output.buffers).size).toBe(5);
    expect(generated.transfers).toEqual(generated.output.buffers);
    expect(generated.output.byteLength).toBeLessThanOrEqual(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES);
    expect(validated.details.generationMilliseconds).toBeGreaterThanOrEqual(0);
    expect(validated.details.meshingMilliseconds).toBeGreaterThanOrEqual(0);
    expect(validated.brick.contentHash).toBe(validated.details.brickContentHash);
    expect(validated.mesh.contentHash).toBe(validated.details.meshContentHash);
  });

  it("routes the real Hestia job through the existing WorkerPool and result gate", async () => {
    const telemetry = new PerformanceTelemetry();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 2,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => new RuntimeTransport(),
      observe: createWorkerPoolTelemetryObserver(telemetry, 1),
    });
    await pool.start();
    const payload = generatedPayload();
    const request = Object.freeze({ ...requestFor(payload, "hestia-pool"), workerEpoch: workerEpoch(0) });
    const terminal = await pool.enqueue(request, emptyInput()).result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") validateHestiaVoxelWorkerOutput(payload, terminal.result, terminal.output);
    expect(telemetry.snapshot()).toMatchObject({ completedJobs: 1, failedJobs: 0, queuedJobs: 0, runningJobs: 0 });
    await pool.shutdown();
  }, 20_000);

  it("rejects stale, hash-mismatched, and malformed-layout results before integration", () => {
    const payload = generatedPayload();
    const expectation = {
      jobId: generated.result.jobId,
      cancelled: false,
      planningEpoch: generated.result.planningEpoch,
      workerEpoch: generated.result.workerEpoch,
      targetKey: generated.result.targetKey,
      inputRevision: generated.result.inputRevision,
      outputRevision: generated.result.outputRevision,
      algorithmVersion: generated.result.algorithmVersion,
      maximumOutputBytes: byteCount(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES),
      expectedHestiaPayload: payload,
    } as const;
    expect(integrateWorkerResult({ ...expectation, planningEpoch: planningEpoch(2) }, generated.result, generated.output).kind)
      .toBe("RejectedStalePlanningEpoch");
    expect(integrateWorkerResult({ ...expectation, targetKey: workerTargetKey("voxel_spatial:0000000000000000") }, generated.result, generated.output).kind)
      .toBe("RejectedTargetMismatch");
    expect(integrateWorkerResult(expectation, { ...generated.result, contentHash: "00000000" }, generated.output).kind)
      .toBe("RejectedContentHashMismatch");
    expect(integrateWorkerResult({ ...expectation, maximumOutputBytes: byteCount(generated.output.byteLength - 1) }, generated.result, generated.output).kind)
      .toBe("RejectedOverBudget");
    const malformed = {
      ...generated.output,
      views: generated.output.views.map((view, index) => index === 2 ? { ...view, name: "wrong" } : view),
    };
    expect(integrateWorkerResult(expectation, generated.result, malformed).kind).toBe("RejectedInvalidLayout");
  });

  it("validates canonical brick content before accepting post-generation representation identity", () => {
    const payload = generatedPayload();
    const details = generated.result.details;
    if (details === undefined) throw new Error("Expected Hestia result details.");

    expect(() => validateHestiaVoxelWorkerOutput(payload, {
      ...generated.result,
      details: {
        ...details,
        representationKey: voxelMeshRepresentationKey("voxel_mesh:0000000000000000"),
      },
    }, generated.output)).toThrow(/representation key/);

    expect(() => validateHestiaVoxelWorkerOutput(payload, {
      ...generated.result,
      details: { ...details, meshAlgorithmVersion: "surface_nets_v2" } as unknown as typeof details,
    }, generated.output)).toThrow(/version|revision/);

    const density = generated.output.buffers[0].slice(0);
    new Uint8Array(density)[0] ^= 1;
    const buffers = Object.freeze([density, ...generated.output.buffers.slice(1)]);
    const contentHash = fnv1aBytes(buffers);
    const tamperedOutput = Object.freeze({ ...generated.output, buffers, contentHash });
    const tamperedResult = Object.freeze({
      ...generated.result,
      contentHash,
      details: Object.freeze({
        ...details,
        representationKey: voxelMeshRepresentationKey("voxel_mesh:0000000000000000"),
      }),
    });
    expect(() => validateHestiaVoxelWorkerOutput(payload, tamperedResult, tamperedOutput))
      .toThrow(/brick is invalid/);
  });

  it("accepts the exact 16 MiB Hestia output boundary and rejects one byte over it", () => {
    expect(validateHestiaVoxelWorkerOutputByteLength(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES))
      .toBe(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES);
    expect(() => validateHestiaVoxelWorkerOutputByteLength(MAX_HESTIA_VOXEL_WORKER_OUTPUT_BYTES + 1))
      .toThrow(/16 MiB/);
  });

  it("binds cached-mode output to the requested canonical brick hash", () => {
    const generatedInput = generatedPayload();
    const differentBrick = generateHestiaVoxelBrick({ ...generatedInput, rootSeed: "hestia-worker-poisoned-cache" });
    const generatedDetails = validateHestiaVoxelWorkerOutput(generatedInput, generated.result, generated.output).details;
    expect(differentBrick.contentHash).not.toBe(generatedDetails.brickContentHash);
    const poisonedPayload = validateHestiaVoxelBrickMeshPayload({
      ...generatedInput,
      inputMode: "CachedCanonicalBrick",
      cachedBrickContentHash: differentBrick.contentHash,
    });
    const selfConsistentReturnedResult: WorkerJobResult = Object.freeze({
      ...generated.result,
      details: Object.freeze({ ...generatedDetails, inputMode: "CachedCanonicalBrick" }),
    });

    expect(() => validateHestiaVoxelWorkerOutput(poisonedPayload, selfConsistentReturnedResult, generated.output))
      .toThrow(/requested cached brick/);
  }, 20_000);

  it("caches only canonical density/material channels and replays them through the same worker job", async () => {
    const telemetry = new PerformanceTelemetry();
    const cache = new MemoryContentCache(2 * VOXEL_CHANNEL_BYTES, createMemoryContentCacheTelemetryObserver(telemetry));
    const generatedInput = generatedPayload();
    expect(() => admitHestiaVoxelWorkerOutputToCache(cache, generatedInput, {
      kind: "Failed",
      failure: { jobId: generated.result.jobId, code: "ProtocolFault", message: "rejected stale artifact" },
    })).toThrow(/WorkerPool result gate/);
    expect(() => admitHestiaVoxelWorkerOutputToCache(cache, generatedInput, {
      kind: "Cancelled",
      reason: "CancelledDuringExecution",
    })).toThrow(/WorkerPool result gate/);
    expect(() => admitHestiaVoxelWorkerOutputToCache(cache, generatedInput, {
      kind: "Completed",
      result: generated.result,
      output: generated.output,
    })).toThrow(/WorkerPool result gate/);
    expect(cache.size).toBe(0);
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 2,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => new RuntimeTransport(),
    });
    await pool.start();
    const terminal = await pool.enqueue(
      Object.freeze({ ...requestFor(generatedInput, "hestia-cache-admission"), workerEpoch: workerEpoch(0) }),
      emptyInput(),
    ).result;
    if (terminal.kind !== "Completed") throw new Error(`Expected accepted Hestia output, received ${terminal.kind}.`);
    const trustedAlgorithmVersion = terminal.result.algorithmVersion;
    const redirectedAlgorithmVersion = algorithmVersion(Number(trustedAlgorithmVersion) + 1);
    const redirectedAlgorithmKey = createHestiaVoxelCacheKey(generatedInput, redirectedAlgorithmVersion);
    expect(Reflect.set(terminal.result, "algorithmVersion", redirectedAlgorithmVersion)).toBe(false);
    expect(terminal.result.algorithmVersion).toBe(trustedAlgorithmVersion);
    if (terminal.result.details === undefined) throw new Error("Expected normalized Hestia result details.");
    expect(Reflect.set(terminal.result.details, "rootSeed", "hestia-mutated-after-gate")).toBe(false);
    expect(terminal.result.details.rootSeed).toBe(generatedInput.rootSeed);
    const key = admitHestiaVoxelWorkerOutputToCache(cache, generatedInput, terminal);
    const expectedKey = createHestiaVoxelCacheKey(generatedInput, terminal.result.algorithmVersion);
    const wrongKey = createHestiaVoxelCacheKey(
      validateHestiaVoxelBrickMeshPayload({ ...generatedInput, rootSeed: "hestia-wrong-cache-key" }),
      terminal.result.algorithmVersion,
    );
    expect(contentKeysEqual(key, expectedKey)).toBe(true);
    expect(cache.has(redirectedAlgorithmKey)).toBe(false);
    expect(cache.has(wrongKey)).toBe(false);
    expect(cache.snapshot()).toMatchObject({ entryCount: 1, totalBytes: VOXEL_CHANNEL_BYTES });
    const lease = cache.get(key);
    expect(lease).toMatchObject({ layout: "hestia-canonical-density-material-v1", byteLength: VOXEL_CHANNEL_BYTES });
    lease?.release();

    const generatedDetails = validateHestiaVoxelWorkerOutput(generatedInput, terminal.result, terminal.output).details;
    const cachedPayload = validateHestiaVoxelBrickMeshPayload({
      ...generatedInput,
      inputMode: "CachedCanonicalBrick",
      cachedBrickContentHash: generatedDetails.brickContentHash,
    });
    const cachedBundle = createCachedHestiaVoxelInputBundle(cache, key, cachedPayload, contentRevision(0));
    if (cachedBundle === undefined) throw new Error("Expected cached canonical channels.");
    expect(cachedBundle.buffers).toHaveLength(2);
    expect(cachedBundle.views.map((view) => view.name)).toEqual(["density", "material"]);
    const replay = await executeRuntime(cachedPayload, cachedBundle, "hestia-cached");
    const replayed = validateHestiaVoxelWorkerOutput(cachedPayload, replay.result, replay.output);
    expect(replayed.details.brickContentHash).toBe(generatedDetails.brickContentHash);
    expect(replayed.details.meshContentHash).toBe(generatedDetails.meshContentHash);
    expect(replayed.details.generationMilliseconds).toBe(0);
    expect(telemetry.snapshot()).toMatchObject({ cacheEntries: 1, cacheBytes: VOXEL_CHANNEL_BYTES, cacheHits: 2, cacheMisses: 0 });
    await pool.shutdown();
  }, 20_000);

  it("cooperatively cancels sliced generation without publishing output", async () => {
    const payload = validateHestiaVoxelBrickMeshPayload({ ...generatedPayload(), generationColumnsPerSlice: 1 });
    const request = requestFor(payload, "hestia-cancelled");
    const emitted: WorkerToHostMessage[] = [];
    const runtime = new StreamingWorkerRuntime((message) => emitted.push(message));
    runtime.handleMessage({ type: "InitializeWorker", workerEpoch: request.workerEpoch });
    runtime.handleMessage({ type: "EnqueueJob", request });
    runtime.handleMessage({ type: "JobInputData", jobId: request.jobId, workerEpoch: request.workerEpoch, bundle: emptyInput() });
    setTimeout(() => runtime.handleMessage({ type: "CancelJob", jobId: request.jobId, workerEpoch: request.workerEpoch }), 0);
    await expect.poll(() => emitted.some((message) => message.type === "JobCancelled"), { timeout: 5_000 }).toBe(true);
    expect(emitted.some((message) => message.type === "JobOutputData" || message.type === "JobCompleted")).toBe(false);
  });

  it("rejects a host-side cancellation racing a held completion without consumer or cache admission", async () => {
    const transport = new HeldCompletionTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 2,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport,
    });
    await pool.start();
    const payload = generatedPayload();
    const ticket = pool.enqueue(
      Object.freeze({ ...requestFor(payload, "hestia-host-cancel-race"), workerEpoch: workerEpoch(0) }),
      emptyInput(),
    );
    await transport.outputDelivered;
    expect(ticket.cancel()).toBe(true);
    transport.releaseCompletion();
    const terminal = await ticket.result;
    expect(terminal).toEqual({ kind: "Cancelled", reason: "CancelledDuringExecution" });
    const cache = new MemoryContentCache(VOXEL_CHANNEL_BYTES);
    expect(() => admitHestiaVoxelWorkerOutputToCache(cache, payload, terminal)).toThrow(/WorkerPool result gate/);
    expect(cache.size).toBe(0);
    await pool.shutdown();
  }, 20_000);

  it("rejects a stale pool result before Hestia cache admission", async () => {
    const transport = new HeldCompletionTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 2,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport,
    });
    await pool.start();
    const payload = generatedPayload();
    const ticket = pool.enqueue(
      Object.freeze({ ...requestFor(payload, "hestia-stale-cache-rejection"), workerEpoch: workerEpoch(0) }),
      emptyInput(),
    );
    await transport.outputDelivered;
    transport.releaseCompletion((result) => Object.freeze({ ...result, planningEpoch: planningEpoch(2) }));
    const terminal = await ticket.result;
    expect(terminal.kind).toBe("Failed");
    const cache = new MemoryContentCache(VOXEL_CHANNEL_BYTES);
    expect(() => admitHestiaVoxelWorkerOutputToCache(cache, payload, terminal)).toThrow(/WorkerPool result gate/);
    expect(cache.size).toBe(0);
    await pool.shutdown();
  }, 20_000);

  it("publishes and validates an empty mesh through the five-buffer worker protocol", async () => {
    const payload = validateHestiaVoxelBrickMeshPayload({
      ...generatedPayload(),
      brickCoordinate: { x: 0, y: 100, z: 0 },
    });
    const artifact = await executeRuntime(payload, emptyInput(), "hestia-empty-mesh");
    const validated = validateHestiaVoxelWorkerOutput(payload, artifact.result, artifact.output);
    expect(validated.mesh.positions).toHaveLength(0);
    expect(validated.mesh.normals).toHaveLength(0);
    expect(validated.mesh.indices).toHaveLength(0);
    expect(artifact.output.buffers.slice(2).map((buffer) => buffer.byteLength)).toEqual([0, 0, 0]);
    expect(artifact.output.buffers).toHaveLength(5);
  }, 20_000);

  it("preserves TransformBuffer publication when no chunk checkpoint is reached", async () => {
    const jobId = workerJobId("transform-no-final-checkpoint");
    const epoch = workerEpoch(9);
    const emitted: WorkerToHostMessage[] = [];
    const runtime = new StreamingWorkerRuntime((message) => emitted.push(message));
    const transformRequest: WorkerJobRequest = Object.freeze({
      jobId,
      jobKind: workerJobKind("TransformBuffer"),
      targetKey: workerTargetKey("transform:no-final-checkpoint"),
      planningEpoch: planningEpoch(1),
      workerEpoch: epoch,
      inputRevision: contentRevision(1),
      algorithmVersion: algorithmVersion(1),
      priority: "Normal",
      deadline: jobDeadline(10),
      estimatedInputBytes: byteCount(8),
      estimatedOutputBytes: byteCount(8),
      payload: { xorMask: 0x5a, chunkBytes: 1024, outputRevision: contentRevision(2) },
    });
    const inputBuffer = new ArrayBuffer(8);
    const input: TransferableBufferBundle = Object.freeze({
      ownership: "SenderToWorker",
      revision: contentRevision(1),
      byteLength: byteCount(8),
      buffers: Object.freeze([inputBuffer]),
      views: Object.freeze([{ name: "bytes", bufferIndex: 0, kind: "Uint8Array" as const, byteOffset: 0, elementCount: 8 }]),
    });
    runtime.handleMessage({ type: "InitializeWorker", workerEpoch: epoch });
    runtime.handleMessage({ type: "EnqueueJob", request: transformRequest });
    runtime.handleMessage({ type: "JobInputData", jobId, workerEpoch: epoch, bundle: input });
    setTimeout(() => runtime.handleMessage({ type: "CancelJob", jobId, workerEpoch: epoch }), 0);
    await expect.poll(() => emitted.some((message) => message.type === "JobCompleted"), { timeout: 2_000 }).toBe(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(emitted.some((message) => message.type === "JobCancelled")).toBe(false);
  });

  it("rejects malformed payload and result-detail contracts without coercion", () => {
    expect(() => validateHestiaVoxelBrickMeshPayload({ ...generatedPayload(), generationColumnsPerSlice: "4" })).toThrow(/generationColumnsPerSlice/);
    expect(() => validateHestiaVoxelBrickMeshPayload({ ...generatedPayload(), inputMode: "CachedCanonicalBrick" })).toThrow(/cachedBrickContentHash/);
    expect(() => validateHestiaVoxelBrickMeshPayload({ ...generatedPayload(), generatorVersion: 2 })).toThrow(/generatorVersion/);
    expect(() => validateHestiaVoxelWorkerOutput(generatedPayload(), { ...generated.result, inputRevision: contentRevision(1) }, generated.output))
      .toThrow(/revisions/);
    expect(isWorkerToHostMessage({ type: "JobCompleted", result: { ...generated.result, details: { ...generated.result.details, layoutVersion: "wrong" } } })).toBe(false);
  });

  it("projects pool lifecycle, byte, timing, and cache events into observation-only telemetry", () => {
    const telemetry = new PerformanceTelemetry();
    const observe = createWorkerPoolTelemetryObserver(telemetry, 2);
    const jobId = workerJobId("telemetry-hestia");
    observe({ type: "Queued", jobId, queueDepth: 1 });
    observe({ type: "Dispatched", jobId, workerEpoch: workerEpoch(1), inputBytes: 0 });
    observe({ type: "OutputTransferred", jobId, outputBytes: 1024 });
    observe({ type: "Completed", jobId, outputBytes: 1024, executionDurationMs: 3.5 });
    observe({ type: "WorkerStateChanged", workerCount: 2, activeWorkers: 2 });
    observe({ type: "WorkerRestarted", workerEpoch: workerEpoch(2) });
    expect(telemetry.snapshot()).toMatchObject({
      workerCount: 2,
      activeWorkers: 2,
      queuedJobs: 0,
      runningJobs: 0,
      completedJobs: 1,
      inputBytesTransferred: 0,
      outputBytesTransferred: 1024,
      workerRestarts: 1,
      executionLatencyMs: { sampleCount: 1, totalMs: 3.5, latestMs: 3.5, maxMs: 3.5 },
    });
  });
});
