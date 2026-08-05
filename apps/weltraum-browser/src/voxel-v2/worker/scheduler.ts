import { DEFAULT_WORLD_SEED, WORLD_VERSION } from "../domain/constants";
import { chunkKey } from "../domain/coordinates";
import type { ChunkCoord, HaloSnapshot } from "../domain/types";
import {
  assertVoxelV2WorkerRequest,
  assertVoxelV2WorkerResponse,
  workerRequestTransferList,
  type VoxelV2WorkerCompleted,
  type VoxelV2WorkerOperation,
  type VoxelV2WorkerRequest
} from "./protocol";

export interface VoxelV2WorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: VoxelV2WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

export type VoxelV2WorkerTransportFactory = () => VoxelV2WorkerTransport;

export const createVoxelV2BrowserWorker: VoxelV2WorkerTransportFactory = () =>
  new Worker(new URL("./voxelV2.worker.ts", import.meta.url), { type: "module" });

export interface VoxelV2GenerationJobInput {
  readonly coord: ChunkCoord;
  readonly requestedRevision: number;
  readonly seed?: string;
  readonly worldVersion?: string;
}

interface JobTerminalBase {
  readonly jobId: number;
  readonly operation: VoxelV2WorkerOperation;
  readonly key: string;
  readonly requestedRevision: number;
}

export type VoxelV2JobTerminal =
  | (JobTerminalBase & {
    readonly kind: "Completed";
    readonly result: VoxelV2WorkerCompleted;
    readonly queueWaitMs: number;
  })
  | (JobTerminalBase & {
    readonly kind: "Coalesced" | "Stale" | "Rejected" | "Failed" | "Disposed";
    readonly reason: string;
  });

export interface VoxelV2JobTicket {
  readonly jobId: number;
  readonly operation: VoxelV2WorkerOperation;
  readonly key: string;
  readonly requestedRevision: number;
  readonly result: Promise<VoxelV2JobTerminal>;
}

export interface VoxelV2LatencySnapshot {
  readonly count: number;
  readonly current: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

export interface VoxelV2SchedulerTelemetry {
  readonly workerCount: 1;
  readonly activeWorkers: 0 | 1;
  readonly queueCapacity: number;
  readonly pendingJobs: number;
  readonly inFlightJobs: 0 | 1;
  readonly submittedJobs: number;
  readonly completedJobs: number;
  readonly failedJobs: number;
  readonly coalescedJobs: number;
  readonly staleResults: number;
  readonly staleRequests: number;
  readonly rejectedJobs: number;
  readonly disposedJobs: number;
  readonly transferredToWorkerBytes: number;
  readonly transferredFromWorkerBytes: number;
  readonly queueWaitMs: VoxelV2LatencySnapshot;
  readonly generationMs: VoxelV2LatencySnapshot;
  readonly meshingMs: VoxelV2LatencySnapshot;
  readonly disposed: boolean;
}

export interface VoxelV2SchedulerOptions {
  readonly queueCapacity?: number;
  readonly transportFactory?: VoxelV2WorkerTransportFactory;
  readonly now?: () => number;
}

interface QueueEntry {
  readonly request: VoxelV2WorkerRequest;
  readonly identity: string;
  readonly enqueuedAt: number;
  readonly resolve: (terminal: VoxelV2JobTerminal) => void;
  readonly result: Promise<VoxelV2JobTerminal>;
  queueWaitMs: number;
}

class LatencyMetric {
  private readonly samples: number[] = [];
  private latest = 0;

  public record(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.latest = value;
    this.samples.push(value);
    if (this.samples.length > 512) this.samples.shift();
  }

  public snapshot(): VoxelV2LatencySnapshot {
    if (this.samples.length === 0) return Object.freeze({ count: 0, current: 0, p50: 0, p95: 0, max: 0 });
    const sorted = [...this.samples].sort((left, right) => left - right);
    const percentile = (ratio: number): number => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]!;
    return Object.freeze({
      count: this.samples.length,
      current: this.latest,
      p50: percentile(0.5),
      p95: percentile(0.95),
      max: sorted[sorted.length - 1]!
    });
  }
}

const identityOf = (request: VoxelV2WorkerRequest): string => `${request.operation}:${request.key}`;

const terminalBase = (request: VoxelV2WorkerRequest): JobTerminalBase => ({
  jobId: request.jobId,
  operation: request.operation,
  key: request.key,
  requestedRevision: request.requestedRevision
});

export class VoxelV2WorkerScheduler {
  private readonly queueCapacity: number;
  private readonly transport: VoxelV2WorkerTransport;
  private readonly now: () => number;
  private readonly queue: QueueEntry[] = [];
  private readonly latestRevision = new Map<string, number>();
  private readonly queueWaitMetric = new LatencyMetric();
  private readonly generationMetric = new LatencyMetric();
  private readonly meshingMetric = new LatencyMetric();
  private inFlight: QueueEntry | null = null;
  private nextJobId = 1;
  private isDisposed = false;
  private submittedJobs = 0;
  private completedJobs = 0;
  private failedJobs = 0;
  private coalescedJobs = 0;
  private staleResults = 0;
  private staleRequests = 0;
  private rejectedJobs = 0;
  private disposedJobs = 0;
  private transferredToWorkerBytes = 0;
  private transferredFromWorkerBytes = 0;

  public constructor(options: VoxelV2SchedulerOptions = {}) {
    const queueCapacity = options.queueCapacity ?? 256;
    if (!Number.isSafeInteger(queueCapacity) || queueCapacity < 1 || queueCapacity > 1024) {
      throw new Error("V2 worker queue capacity must be between one and 1024.");
    }
    this.queueCapacity = queueCapacity;
    this.now = options.now ?? (() => performance.now());
    this.transport = (options.transportFactory ?? createVoxelV2BrowserWorker)();
    this.transport.onmessage = (event) => this.receive(event.data);
    this.transport.onerror = (event) => this.fault(event.message || "V2 worker error event.");
    this.transport.onmessageerror = () => this.fault("V2 worker messageerror event.");
  }

  public scheduleGeneration(input: VoxelV2GenerationJobInput): VoxelV2JobTicket {
    const request: VoxelV2WorkerRequest = {
      type: "RunVoxelV2Job",
      operation: "Generate",
      jobId: this.allocateJobId(),
      key: chunkKey(input.coord),
      coord: { ...input.coord },
      requestedRevision: input.requestedRevision,
      seed: input.seed ?? DEFAULT_WORLD_SEED,
      worldVersion: input.worldVersion ?? WORLD_VERSION
    };
    return this.schedule(assertVoxelV2WorkerRequest(request));
  }

  public scheduleMeshing(snapshot: HaloSnapshot): VoxelV2JobTicket {
    const request: VoxelV2WorkerRequest = {
      type: "RunVoxelV2Job",
      operation: "Mesh",
      jobId: this.allocateJobId(),
      key: snapshot.key,
      coord: { ...snapshot.coord },
      requestedRevision: snapshot.requestedRevision,
      chunkAuthorityRevision: snapshot.chunkAuthorityRevision,
      // The scheduler transfers its own copy; callers retain their authoritative snapshot.
      cells: snapshot.cells.slice()
    };
    return this.schedule(assertVoxelV2WorkerRequest(request));
  }

  public telemetry(): VoxelV2SchedulerTelemetry {
    return Object.freeze({
      workerCount: 1,
      activeWorkers: this.isDisposed ? 0 : 1,
      queueCapacity: this.queueCapacity,
      pendingJobs: this.queue.length,
      inFlightJobs: this.inFlight === null ? 0 : 1,
      submittedJobs: this.submittedJobs,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      coalescedJobs: this.coalescedJobs,
      staleResults: this.staleResults,
      staleRequests: this.staleRequests,
      rejectedJobs: this.rejectedJobs,
      disposedJobs: this.disposedJobs,
      transferredToWorkerBytes: this.transferredToWorkerBytes,
      transferredFromWorkerBytes: this.transferredFromWorkerBytes,
      queueWaitMs: this.queueWaitMetric.snapshot(),
      generationMs: this.generationMetric.snapshot(),
      meshingMs: this.meshingMetric.snapshot(),
      disposed: this.isDisposed
    });
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.detachTransport();
    this.transport.terminate();
    if (this.inFlight !== null) {
      this.disposedJobs += 1;
      this.inFlight.resolve({ ...terminalBase(this.inFlight.request), kind: "Disposed", reason: "V2 scheduler disposed." });
      this.inFlight = null;
    }
    for (const entry of this.queue.splice(0)) {
      this.disposedJobs += 1;
      entry.resolve({ ...terminalBase(entry.request), kind: "Disposed", reason: "V2 scheduler disposed." });
    }
  }

  private allocateJobId(): number {
    if (!Number.isSafeInteger(this.nextJobId)) throw new Error("V2 worker job ID space is exhausted.");
    const id = this.nextJobId;
    this.nextJobId += 1;
    return id;
  }

  private schedule(request: VoxelV2WorkerRequest): VoxelV2JobTicket {
    this.submittedJobs += 1;
    const identity = identityOf(request);
    const latest = this.latestRevision.get(identity);
    const queuedIndex = this.queue.findIndex((entry) => entry.identity === identity);
    let resolve!: (terminal: VoxelV2JobTerminal) => void;
    const result = new Promise<VoxelV2JobTerminal>((complete) => { resolve = complete; });
    const entry: QueueEntry = { request, identity, enqueuedAt: this.now(), resolve, result, queueWaitMs: 0 };
    const ticket: VoxelV2JobTicket = {
      jobId: request.jobId,
      operation: request.operation,
      key: request.key,
      requestedRevision: request.requestedRevision,
      result
    };

    if (this.isDisposed) {
      this.disposedJobs += 1;
      resolve({ ...terminalBase(request), kind: "Disposed", reason: "V2 scheduler is disposed." });
      return ticket;
    }
    if (latest !== undefined && request.requestedRevision < latest) {
      this.staleRequests += 1;
      resolve({ ...terminalBase(request), kind: "Stale", reason: "A newer V2 revision was already requested." });
      return ticket;
    }
    if (latest !== undefined && request.requestedRevision === latest) {
      this.coalescedJobs += 1;
      resolve({ ...terminalBase(request), kind: "Coalesced", reason: "The same V2 revision is already scheduled or complete." });
      return ticket;
    }
    if (queuedIndex >= 0) {
      const replaced = this.queue[queuedIndex]!;
      this.coalescedJobs += 1;
      replaced.resolve({ ...terminalBase(replaced.request), kind: "Coalesced", reason: "A newer V2 revision replaced this queued job." });
      this.queue[queuedIndex] = entry;
      this.latestRevision.set(identity, request.requestedRevision);
      return ticket;
    }
    if (this.queue.length >= this.queueCapacity) {
      this.rejectedJobs += 1;
      resolve({ ...terminalBase(request), kind: "Rejected", reason: "V2 worker queue capacity reached." });
      return ticket;
    }

    this.latestRevision.set(identity, request.requestedRevision);
    this.queue.push(entry);
    this.dispatchNext();
    return ticket;
  }

  private dispatchNext(): void {
    if (this.isDisposed || this.inFlight !== null) return;
    const entry = this.queue.shift();
    if (!entry) return;
    entry.queueWaitMs = Math.max(0, this.now() - entry.enqueuedAt);
    this.queueWaitMetric.record(entry.queueWaitMs);
    this.inFlight = entry;
    const transfer = workerRequestTransferList(entry.request);
    const transferBytes = entry.request.operation === "Mesh" ? entry.request.cells.byteLength : 0;
    try {
      this.transport.postMessage(entry.request, transfer);
      this.transferredToWorkerBytes += transferBytes;
    } catch (error) {
      this.inFlight = null;
      this.failedJobs += 1;
      this.clearLatestIfOwned(entry);
      entry.resolve({
        ...terminalBase(entry.request),
        kind: "Failed",
        reason: error instanceof Error ? error.message : "V2 worker postMessage failed."
      });
      this.dispatchNext();
    }
  }

  private receive(value: unknown): void {
    if (this.isDisposed) return;
    let response;
    try {
      response = assertVoxelV2WorkerResponse(value);
    } catch (error) {
      this.fault(error instanceof Error ? error.message : "V2 worker emitted an invalid response.");
      return;
    }
    const entry = this.inFlight;
    if (entry === null
      || response.jobId !== entry.request.jobId
      || response.operation !== entry.request.operation
      || response.key !== entry.request.key
      || response.requestedRevision !== entry.request.requestedRevision) {
      this.fault("V2 worker response does not match the in-flight job.");
      return;
    }
    this.inFlight = null;
    const latest = this.latestRevision.get(entry.identity);
    if (response.type === "VoxelV2JobCompleted") {
      this.transferredFromWorkerBytes += response.outputBytes;
      if (response.operation === "Generate") this.generationMetric.record(response.workerDurationMs);
      else this.meshingMetric.record(response.workerDurationMs);
      if (response.operation === "Mesh" && entry.request.operation === "Mesh"
        && response.mesh.chunkAuthorityRevision !== entry.request.chunkAuthorityRevision) {
        this.failedJobs += 1;
        this.clearLatestIfOwned(entry);
        entry.resolve({ ...terminalBase(entry.request), kind: "Failed", reason: "V2 worker mesh authority revision mismatch." });
        this.dispatchNext();
        return;
      }
    }
    if (latest !== response.requestedRevision) {
      this.staleResults += 1;
      entry.resolve({ ...terminalBase(entry.request), kind: "Stale", reason: "A newer V2 revision superseded this worker result." });
      this.dispatchNext();
      return;
    }
    if (response.type === "VoxelV2JobFailed") {
      this.failedJobs += 1;
      this.clearLatestIfOwned(entry);
      entry.resolve({ ...terminalBase(entry.request), kind: "Failed", reason: response.message });
      this.dispatchNext();
      return;
    }

    this.completedJobs += 1;
    entry.resolve({ ...terminalBase(entry.request), kind: "Completed", result: response, queueWaitMs: entry.queueWaitMs });
    this.dispatchNext();
  }

  private fault(reason: string): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.detachTransport();
    this.transport.terminate();
    if (this.inFlight !== null) {
      this.failedJobs += 1;
      this.clearLatestIfOwned(this.inFlight);
      this.inFlight.resolve({ ...terminalBase(this.inFlight.request), kind: "Failed", reason });
      this.inFlight = null;
    }
    for (const entry of this.queue.splice(0)) {
      this.failedJobs += 1;
      this.clearLatestIfOwned(entry);
      entry.resolve({ ...terminalBase(entry.request), kind: "Failed", reason });
    }
  }

  private detachTransport(): void {
    this.transport.onmessage = null;
    this.transport.onerror = null;
    this.transport.onmessageerror = null;
  }

  private clearLatestIfOwned(entry: QueueEntry): void {
    if (this.latestRevision.get(entry.identity) === entry.request.requestedRevision) {
      this.latestRevision.delete(entry.identity);
    }
  }
}
