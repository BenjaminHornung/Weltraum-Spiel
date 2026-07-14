import type { WorkerEpoch, WorkerJobId } from "./ids";
import { isWorkerToHostMessage, type HostToWorkerMessage, type JobOutputDataMessage, type WorkerToHostMessage } from "./messages";
import { transferListFor, type TransferableBufferBundle, type WorkerJobFailure, type WorkerJobRequest, type WorkerJobResult } from "./protocol";

export interface WorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: HostToWorkerMessage, transfer?: Transferable[]): void;
  terminate(): void;
}

export type WorkerTransportFactory = () => WorkerTransport;

export const createBrowserWorkerTransport: WorkerTransportFactory = () =>
  new Worker(new URL("./streamingWorker.ts", import.meta.url), { type: "module" });

export type WorkerHandleState = "Starting" | "Ready" | "Busy" | "Stopping" | "Stopped" | "Failed";

export interface WorkerHandleCallbacks {
  readonly onCompleted: (handle: WorkerHandle, result: WorkerJobResult, output: JobOutputDataMessage) => void;
  readonly onCancelled: (handle: WorkerHandle, jobId: WorkerJobId) => void;
  readonly onFailed: (handle: WorkerHandle, failure: WorkerJobFailure) => void;
  readonly onFault: (handle: WorkerHandle, reason: string) => void;
}

export class WorkerHandle {
  private transport: WorkerTransport | undefined;
  private readyResolve: (() => void) | undefined;
  private readyReject: ((error: Error) => void) | undefined;
  private output: JobOutputDataMessage | undefined;
  private activeJobId: WorkerJobId | undefined;
  public state: WorkerHandleState = "Stopped";

  public constructor(
    public readonly slot: number,
    public readonly workerEpoch: WorkerEpoch,
    private readonly factory: WorkerTransportFactory,
    private readonly callbacks: WorkerHandleCallbacks,
  ) {}

  public get jobId(): WorkerJobId | undefined { return this.activeJobId; }

  public start(): Promise<void> {
    if (this.state !== "Stopped") throw new Error("WorkerHandle can only start from Stopped.");
    this.state = "Starting";
    this.transport = this.factory();
    this.transport.onmessage = (event) => {
      try { this.receive(event.data); }
      catch (error) { this.fault(error instanceof Error ? error.message : "Worker emitted an invalid protocol message."); }
    };
    this.transport.onerror = (event) => this.fault(event.message || "Worker error event.");
    this.transport.onmessageerror = () => this.fault("Worker messageerror event.");
    const ready = new Promise<void>((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    this.post({ type: "InitializeWorker", workerEpoch: this.workerEpoch });
    return ready;
  }

  public assign(request: WorkerJobRequest, input: TransferableBufferBundle): void {
    if (this.state !== "Ready") throw new Error("WorkerHandle is not ready.");
    this.state = "Busy";
    this.activeJobId = request.jobId;
    this.output = undefined;
    this.post({ type: "EnqueueJob", request });
    this.post({ type: "JobInputData", jobId: request.jobId, workerEpoch: this.workerEpoch, bundle: input }, transferListFor(input));
  }

  public cancel(jobId: WorkerJobId): boolean {
    if (this.state !== "Busy" || this.activeJobId !== jobId) return false;
    this.post({ type: "CancelJob", jobId, workerEpoch: this.workerEpoch });
    return true;
  }

  public stop(): void {
    if (this.state === "Stopped") return;
    this.state = "Stopping";
    if (this.transport) this.post({ type: "ShutdownWorker", workerEpoch: this.workerEpoch });
  }

  public terminate(): void {
    if (this.transport) {
      this.transport.onmessage = null;
      this.transport.onerror = null;
      this.transport.onmessageerror = null;
      this.transport.terminate();
    }
    this.transport = undefined;
    this.activeJobId = undefined;
    this.output = undefined;
    this.state = "Stopped";
  }

  private post(message: HostToWorkerMessage, transfer?: Transferable[]): void {
    if (!this.transport) throw new Error("Worker transport is unavailable.");
    this.transport.postMessage(message, transfer);
  }

  private receive(value: unknown): void {
    if (!isWorkerToHostMessage(value)) return this.fault("Worker emitted an invalid protocol message.");
    const message: WorkerToHostMessage = value;
    const epoch = message.type === "JobCompleted" ? message.result.workerEpoch : message.type === "JobFailed" ? message.failure.workerEpoch : message.workerEpoch;
    if (epoch !== undefined && epoch !== this.workerEpoch) return this.fault("Worker emitted a message for the wrong worker epoch.");
    switch (message.type) {
      case "WorkerReady":
        if (this.state !== "Starting") return this.fault("Unexpected WorkerReady message.");
        this.state = "Ready"; this.readyResolve?.(); this.clearReadyPromise(); return;
      case "JobAccepted":
        if (this.state !== "Busy" || message.jobId !== this.activeJobId) return this.fault("Unexpected JobAccepted message.");
        return;
      case "JobOutputData":
        if (this.state !== "Busy" || message.jobId !== this.activeJobId || this.output) return this.fault("Unexpected JobOutputData message.");
        this.output = message; return;
      case "JobCompleted": {
        if (this.state !== "Busy" || message.result.jobId !== this.activeJobId || !this.output) return this.fault("JobCompleted has no matching output data.");
        const output = this.output; this.finishActive(); this.callbacks.onCompleted(this, message.result, output); return;
      }
      case "JobCancelled":
        if (this.state !== "Busy" || message.jobId !== this.activeJobId) return this.fault("Unexpected JobCancelled message.");
        this.finishActive(); this.callbacks.onCancelled(this, message.jobId); return;
      case "JobFailed":
        if (this.state !== "Busy" || message.failure.jobId !== this.activeJobId) return this.fault("Unexpected JobFailed message.");
        this.finishActive(); this.callbacks.onFailed(this, message.failure); return;
      case "WorkerStopped":
        if (this.state !== "Stopping") return this.fault("Unexpected WorkerStopped message.");
        this.terminate(); return;
      case "WorkerStatus": return;
    }
  }

  private finishActive(): void { this.activeJobId = undefined; this.output = undefined; this.state = "Ready"; }

  private fault(reason: string): void {
    if (this.state === "Failed" || this.state === "Stopped") return;
    this.state = "Failed";
    this.readyReject?.(new Error(reason));
    this.clearReadyPromise();
    this.callbacks.onFault(this, reason);
  }

  private clearReadyPromise(): void { this.readyResolve = undefined; this.readyReject = undefined; }
}
