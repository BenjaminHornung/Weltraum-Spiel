import { WorkerCancellationRegistry, yieldToWorkerEventLoop } from "./cancellation";
import { isMessageRecord, type HostToWorkerMessage, type WorkerToHostMessage } from "./messages";
import {
  fnv1aBytes,
  transferListFor,
  validateTransferableBundle,
  validateTransformPayload,
  type TransferableBufferBundle,
  type WorkerJobRequest,
} from "./protocol";
import { byteCount, type WorkerEpoch, type WorkerJobId } from "./ids";

export type WorkerMessageEmitter = (message: WorkerToHostMessage, transfer?: readonly Transferable[]) => void;

export class StreamingWorkerRuntime {
  private epoch: WorkerEpoch | undefined;
  private readonly requests = new Map<WorkerJobId, WorkerJobRequest>();
  private readonly cancellation = new WorkerCancellationRegistry();
  private runningJobId: WorkerJobId | undefined;
  private stopping = false;

  public constructor(private readonly emit: WorkerMessageEmitter) {}

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
      await yieldToWorkerEventLoop();
      if (token.isCancellationRequested) {
        this.emit({ type: "JobCancelled", jobId, workerEpoch: request.workerEpoch, reason: "CancelledDuringExecution" });
        return;
      }
      const input = validateTransferableBundle(sourceBundle);
      if (input.ownership !== "SenderToWorker" || input.revision !== request.inputRevision || input.byteLength !== request.estimatedInputBytes) throw new RangeError("Input ownership, revision, or byte length does not match the request.");
      if (request.jobKind !== "TransformBuffer") throw new RangeError(`Unsupported worker job kind: ${request.jobKind}.`);
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
            await yieldToWorkerEventLoop();
            if (token.isCancellationRequested) {
              this.emit({ type: "JobCancelled", jobId, workerEpoch: request.workerEpoch, reason: "CancelledDuringExecution" });
              return;
            }
          }
        }
      }
      if (token.isCancellationRequested) {
        this.emit({ type: "JobCancelled", jobId, workerEpoch: request.workerEpoch, reason: "CancelledDuringExecution" });
        return;
      }
      const hash = fnv1aBytes(outputBuffers);
      const output: TransferableBufferBundle = Object.freeze({
        ownership: "WorkerToConsumer", revision: payload.outputRevision, byteLength: byteCount(outputBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), "outputBytes"),
        buffers: Object.freeze(outputBuffers), views: input.views, contentHash: hash,
      });
      this.emit({ type: "JobOutputData", jobId, workerEpoch: request.workerEpoch, outputBytes: output.byteLength, bundle: output }, transferListFor(output));
      this.emit({ type: "JobCompleted", result: Object.freeze({
        jobId, targetKey: request.targetKey, planningEpoch: request.planningEpoch, workerEpoch: request.workerEpoch,
        inputRevision: request.inputRevision, outputRevision: payload.outputRevision, algorithmVersion: request.algorithmVersion,
        outputBytes: output.byteLength, contentHash: hash,
      }) });
    } catch (error) {
      this.fail(jobId, "JobExecutionFailed", error instanceof Error ? error.message : "Worker job failed.");
    } finally {
      this.cancellation.release(jobId);
      this.requests.delete(jobId);
      this.runningJobId = undefined;
      if (this.stopping && this.epoch !== undefined) this.emit({ type: "WorkerStopped", workerEpoch: this.epoch });
    }
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
