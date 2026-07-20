import { WorkerCancellationRegistry, yieldToWorkerEventLoop } from "./cancellation";
import { isMessageRecord, type HostToWorkerMessage, type WorkerToHostMessage } from "./messages";
import {
  GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND,
  HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION,
  expectedHestiaVoxelInputBytes,
  fnv1aBytes,
  transferListFor,
  validateHestiaVoxelBrickMeshPayload,
  validateHestiaVoxelInputBundle,
  validateHestiaVoxelWorkerOutputByteLength,
  validateTransferableBundle,
  validateTransformPayload,
  type HestiaVoxelBrickMeshResultDetails,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerJobResult,
} from "./protocol";
import { byteCount, type WorkerEpoch, type WorkerJobId } from "./ids";
import { generateHestiaVoxelBrickInSlices } from "../world-generation/hestia";
import { createSurfaceNetsVoxelMeshProduct, type VoxelBrick } from "../voxel";

export type WorkerMessageEmitter = (message: WorkerToHostMessage, transfer?: readonly Transferable[]) => void;

class WorkerJobCancelled extends Error {}

const monotonicNow = (): number => globalThis.performance?.now() ?? 0;

const exactArrayBuffer = (view: ArrayBufferView, name: string): ArrayBuffer => {
  if (!(view.buffer instanceof ArrayBuffer) || view.byteOffset !== 0 || view.byteLength !== view.buffer.byteLength) {
    throw new RangeError(`${name} must own its complete ArrayBuffer.`);
  }
  return view.buffer;
};

interface WorkerExecutionOutput {
  readonly bundle: TransferableBufferBundle;
  readonly result: WorkerJobResult;
}

export class StreamingWorkerRuntime {
  private epoch: WorkerEpoch | undefined;
  private readonly requests = new Map<WorkerJobId, WorkerJobRequest>();
  private readonly cancellation = new WorkerCancellationRegistry();
  private runningJobId: WorkerJobId | undefined;
  private stopping = false;

  public constructor(
    private readonly emit: WorkerMessageEmitter,
    private readonly checkpoint: () => Promise<void> = yieldToWorkerEventLoop,
  ) {}

  public handleMessage(message: HostToWorkerMessage): void {
    if (!isMessageRecord(message)) {
      this.failUnknown("ProtocolFault", "Message is not a protocol record.");
      return;
    }
    switch (message.type) {
      case "InitializeWorker":
        if (this.epoch !== undefined || this.stopping) return this.failUnknown("ProtocolFault", "Worker was initialized more than once.");
        this.epoch = message.workerEpoch;
        this.emit({ type: "WorkerReady", workerEpoch: message.workerEpoch });
        return;
      case "EnqueueJob":
        if (!this.requireEpoch(message.request.workerEpoch, message.request.jobId)) return;
        if (this.requests.size > 0 || this.runningJobId !== undefined) return this.fail(message.request.jobId, "ProtocolFault", "Worker accepts only one active job.");
        this.requests.set(message.request.jobId, message.request);
        this.emit({ type: "JobAccepted", jobId: message.request.jobId, workerEpoch: message.request.workerEpoch });
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
        return;
      case "ReadStatus":
        if (!this.requireEpoch(message.workerEpoch)) return;
        this.emit({ type: "WorkerStatus", workerEpoch: message.workerEpoch, state: this.runningJobId ? "Busy" : this.stopping ? "Stopping" : "Ready", ...(this.runningJobId ? { jobId: this.runningJobId } : {}) });
        return;
      case "ShutdownWorker":
        if (!this.requireEpoch(message.workerEpoch)) return;
        this.stopping = true;
        if (this.runningJobId) this.cancellation.cancel(this.runningJobId);
        else this.emit({ type: "WorkerStopped", workerEpoch: message.workerEpoch });
        return;
    }
  }

  private async execute(jobId: WorkerJobId, sourceBundle: TransferableBufferBundle): Promise<void> {
    const request = this.requests.get(jobId);
    if (!request || this.runningJobId !== undefined) {
      this.fail(jobId, "UnknownJob", "Input data has no matching accepted job.");
      return;
    }
    this.runningJobId = jobId;
    const token = this.cancellation.register(jobId);
    try {
      await this.checkpoint();
      if (token.isCancellationRequested) {
        this.emit({ type: "JobCancelled", jobId, workerEpoch: request.workerEpoch, reason: "CancelledDuringExecution" });
        return;
      }
      const input = validateTransferableBundle(sourceBundle);
      if (input.ownership !== "SenderToWorker" || input.revision !== request.inputRevision || input.byteLength !== request.estimatedInputBytes) throw new RangeError("Input ownership, revision, or byte length does not match the request.");
      const execution = request.jobKind === "TransformBuffer"
        ? await this.executeTransform(request, input, async () => {
            await this.checkpoint();
            if (token.isCancellationRequested) throw new WorkerJobCancelled();
          })
        : request.jobKind === GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND
          ? await this.executeHestiaVoxelMesh(request, input, async () => {
              await this.checkpoint();
              if (token.isCancellationRequested) throw new WorkerJobCancelled();
            })
          : (() => { throw new RangeError(`Unsupported worker job kind: ${request.jobKind}.`); })();
      this.emit({ type: "JobOutputData", jobId, workerEpoch: request.workerEpoch, outputBytes: execution.bundle.byteLength, bundle: execution.bundle }, transferListFor(execution.bundle));
      this.emit({ type: "JobCompleted", result: execution.result });
    } catch (error) {
      if (error instanceof WorkerJobCancelled) {
        this.emit({ type: "JobCancelled", jobId, workerEpoch: request.workerEpoch, reason: "CancelledDuringExecution" });
      } else {
        this.fail(jobId, "JobExecutionFailed", error instanceof Error ? error.message : "Worker job failed.");
      }
    } finally {
      this.cancellation.release(jobId);
      this.requests.delete(jobId);
      this.runningJobId = undefined;
      if (this.stopping && this.epoch !== undefined) this.emit({ type: "WorkerStopped", workerEpoch: this.epoch });
    }
  }

  private async executeTransform(
    request: WorkerJobRequest,
    input: TransferableBufferBundle,
    checkpoint: () => Promise<void>,
  ): Promise<WorkerExecutionOutput> {
    const payload = validateTransformPayload(request.payload);
    const outputBuffers = input.buffers.map((buffer) => new ArrayBuffer(buffer.byteLength));
    let sinceYield = 0;
    for (let bufferIndex = 0; bufferIndex < input.buffers.length; bufferIndex += 1) {
      const source = new Uint8Array(input.buffers[bufferIndex]);
      const target = new Uint8Array(outputBuffers[bufferIndex]);
      for (let index = 0; index < source.length; index += 1) {
        target[index] = source[index] ^ payload.xorMask;
        sinceYield += 1;
        if (sinceYield >= payload.chunkBytes) {
          sinceYield = 0;
          await checkpoint();
        }
      }
    }
    const hash = fnv1aBytes(outputBuffers);
    const output: TransferableBufferBundle = Object.freeze({
      ownership: "WorkerToConsumer", revision: payload.outputRevision, byteLength: byteCount(outputBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), "outputBytes"),
      buffers: Object.freeze(outputBuffers), views: input.views, contentHash: hash,
    });
    return Object.freeze({
      bundle: output,
      result: Object.freeze({
        jobId: request.jobId, targetKey: request.targetKey, planningEpoch: request.planningEpoch, workerEpoch: request.workerEpoch,
        inputRevision: request.inputRevision, outputRevision: payload.outputRevision, algorithmVersion: request.algorithmVersion,
        outputBytes: output.byteLength, contentHash: hash,
      }),
    });
  }

  private async executeHestiaVoxelMesh(
    request: WorkerJobRequest,
    input: TransferableBufferBundle,
    checkpoint: () => Promise<void>,
  ): Promise<WorkerExecutionOutput> {
    const payload = validateHestiaVoxelBrickMeshPayload(request.payload);
    if (Number(request.inputRevision) !== Number(payload.sourceRevision)) throw new RangeError("Hestia inputRevision must match sourceRevision.");
    if (request.estimatedInputBytes !== expectedHestiaVoxelInputBytes(payload)) throw new RangeError("Hestia estimated input bytes are invalid.");
    if (request.estimatedOutputBytes < byteCount(1, "minimumOutputBytes")) throw new RangeError("Hestia estimated output bytes must be positive.");
    validateHestiaVoxelWorkerOutputByteLength(request.estimatedOutputBytes);
    const validatedInput = validateHestiaVoxelInputBundle(payload, input);
    let brick: VoxelBrick;
    let generationMilliseconds = 0;
    if (payload.inputMode === "Generate") {
      const generationStarted = monotonicNow();
      brick = await generateHestiaVoxelBrickInSlices(payload, {
        columnsPerSlice: payload.generationColumnsPerSlice,
        checkpoint,
      });
      generationMilliseconds = monotonicNow() - generationStarted;
    } else {
      brick = validatedInput.brick!;
    }
    await checkpoint();
    const meshingStarted = monotonicNow();
    const mesh = createSurfaceNetsVoxelMeshProduct(brick);
    const meshingMilliseconds = monotonicNow() - meshingStarted;
    await checkpoint();
    const outputBuffers = Object.freeze([
      exactArrayBuffer(brick.densityBuffer, "density"),
      exactArrayBuffer(brick.materialBuffer, "material"),
      exactArrayBuffer(mesh.positions, "positions"),
      exactArrayBuffer(mesh.normals, "normals"),
      exactArrayBuffer(mesh.indices, "indices"),
    ]);
    const outputBytes = outputBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    validateHestiaVoxelWorkerOutputByteLength(outputBytes);
    if (outputBytes > request.estimatedOutputBytes) throw new RangeError("Hestia output exceeds its declared byte budget.");
    const indexKind = mesh.indices instanceof Uint16Array ? "Uint16Array" as const : "Uint32Array" as const;
    const hash = fnv1aBytes(outputBuffers);
    const output: TransferableBufferBundle = Object.freeze({
      ownership: "WorkerToConsumer",
      revision: payload.outputRevision,
      byteLength: byteCount(outputBytes, "outputBytes"),
      buffers: outputBuffers,
      views: Object.freeze([
        Object.freeze({ name: "density", bufferIndex: 0, kind: "Float32Array" as const, byteOffset: 0, elementCount: brick.densityBuffer.length }),
        Object.freeze({ name: "material", bufferIndex: 1, kind: "Uint8Array" as const, byteOffset: 0, elementCount: brick.materialBuffer.length }),
        Object.freeze({ name: "positions", bufferIndex: 2, kind: "Float32Array" as const, byteOffset: 0, elementCount: mesh.positions.length }),
        Object.freeze({ name: "normals", bufferIndex: 3, kind: "Float32Array" as const, byteOffset: 0, elementCount: mesh.normals.length }),
        Object.freeze({ name: "indices", bufferIndex: 4, kind: indexKind, byteOffset: 0, elementCount: mesh.indices.length }),
      ]),
      contentHash: hash,
    });
    const details: HestiaVoxelBrickMeshResultDetails = Object.freeze({
      kind: GENERATE_HESTIA_VOXEL_BRICK_MESH_JOB_KIND,
      layoutVersion: HESTIA_VOXEL_OUTPUT_LAYOUT_VERSION,
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
      representationKey: mesh.representationKey,
      brickContentHash: brick.contentHash,
      meshContentHash: mesh.contentHash,
      indexKind,
      materialRanges: mesh.materialRanges,
      bounds: mesh.bounds,
      generationMilliseconds,
      meshingMilliseconds,
    });
    return Object.freeze({
      bundle: output,
      result: Object.freeze({
        jobId: request.jobId, targetKey: request.targetKey, planningEpoch: request.planningEpoch, workerEpoch: request.workerEpoch,
        inputRevision: request.inputRevision, outputRevision: payload.outputRevision, algorithmVersion: request.algorithmVersion,
        outputBytes: output.byteLength, contentHash: hash, details,
      }),
    });
  }

  private requireEpoch(epoch: WorkerEpoch, jobId?: WorkerJobId): boolean {
    if (this.epoch === epoch && !this.stopping) return true;
    if (jobId) this.fail(jobId, "WrongWorkerEpoch", "Message worker epoch does not match this worker instance.");
    else this.failUnknown("WrongWorkerEpoch", "Message worker epoch does not match this worker instance.");
    return false;
  }

  private fail(jobId: WorkerJobId, code: "ProtocolFault" | "WrongWorkerEpoch" | "UnknownJob" | "JobExecutionFailed", message: string): void {
    this.emit({ type: "JobFailed", failure: Object.freeze({ jobId, code, message, ...(this.epoch === undefined ? {} : { workerEpoch: this.epoch }) }) });
  }

  private failUnknown(code: "ProtocolFault" | "WrongWorkerEpoch", message: string): void {
    const first = [...this.requests.keys()].sort()[0];
    if (first) this.fail(first, code, message);
  }
}

interface RuntimeWorkerScope {
  onmessage: ((event: MessageEvent<HostToWorkerMessage>) => void) | null;
  postMessage(message: WorkerToHostMessage, transfer: Transferable[]): void;
}

const isDedicatedWorkerScope = (): boolean =>
  typeof document === "undefined" && "postMessage" in globalThis && "onmessage" in globalThis;

if (isDedicatedWorkerScope()) {
  const scope = globalThis as unknown as RuntimeWorkerScope;
  const runtime = new StreamingWorkerRuntime((message, transfer = []) => scope.postMessage(message, [...transfer]));
  scope.onmessage = (event: MessageEvent<HostToWorkerMessage>) => runtime.handleMessage(event.data);
}
