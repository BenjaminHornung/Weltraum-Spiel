import { byteCount, planningEpoch, workerEpoch, type PlanningEpoch, type WorkerEpoch, type WorkerJobId } from "./ids";
import type { JobOutputDataMessage } from "./messages";
import {
  snapshotWorkerJobRequest,
  transferListFor,
  validateTransferableBundle,
  validateTransformPayload,
  type TransferableBufferBundle,
  type WorkerJobFailure,
  type WorkerJobRequest,
  type WorkerJobResult,
} from "./protocol";
import { StableWorkerJobQueue, type WorkerJobQueueSnapshot } from "./queue";
import { integrateWorkerResult, type WorkerResultIntegrationDecision } from "./resultGate";
import { WorkerHandle, createBrowserWorkerTransport, type WorkerHandleCallbacks, type WorkerTransportFactory } from "./workerHandle";

export type WorkerJobTerminal =
  | { readonly kind: "Completed"; readonly result: WorkerJobResult; readonly output: TransferableBufferBundle }
  | { readonly kind: "Cancelled"; readonly reason: "CancelledBeforeStart" | "CancelledDuringExecution" }
  | { readonly kind: "Failed"; readonly failure: WorkerJobFailure; readonly integrationDecision?: WorkerResultIntegrationDecision };

export interface WorkerJobTicket {
  readonly jobId: WorkerJobId;
  readonly result: Promise<WorkerJobTerminal>;
  cancel(): boolean;
}

export type WorkerPoolEvent =
  | { readonly type: "Queued"; readonly jobId: WorkerJobId; readonly queueDepth: number }
  | { readonly type: "Dispatched"; readonly jobId: WorkerJobId; readonly workerEpoch: WorkerEpoch; readonly inputBytes: number }
  | { readonly type: "OutputTransferred"; readonly jobId: WorkerJobId; readonly outputBytes: number }
  | { readonly type: "Completed"; readonly jobId: WorkerJobId; readonly outputBytes: number }
  | { readonly type: "Cancelled" | "Failed" | "StaleResultRejected"; readonly jobId: WorkerJobId }
  | { readonly type: "WorkerRestarted"; readonly workerEpoch: WorkerEpoch };

export interface WorkerPoolOptions {
  readonly workerCount: number;
  readonly queueCapacity: number;
  readonly initialPlanningEpoch?: PlanningEpoch;
  readonly transportFactory?: WorkerTransportFactory;
  readonly observe?: (event: WorkerPoolEvent) => void;
}

interface TicketRecord {
  readonly request: WorkerJobRequest;
  input: TransferableBufferBundle | undefined;
  readonly promise: Promise<WorkerJobTerminal>;
  readonly resolve: (terminal: WorkerJobTerminal) => void;
  status: "Queued" | "Running" | "Terminal";
  handle: WorkerHandle | undefined;
  cancelRequested: boolean;
}

export interface WorkerPoolSnapshot {
  readonly state: "Stopped" | "Starting" | "Running" | "ShuttingDown";
  readonly workerCount: number;
  readonly activeWorkers: number;
  readonly runningJobs: number;
  readonly workerRestarts: number;
  readonly currentPlanningEpoch: PlanningEpoch;
  readonly latestWorkerEpoch: WorkerEpoch;
  readonly queue: WorkerJobQueueSnapshot;
  readonly workers: readonly { readonly slot: number; readonly workerEpoch: WorkerEpoch; readonly state: string; readonly jobId?: WorkerJobId }[];
}

export class WorkerPool {
  private readonly queue: StableWorkerJobQueue;
  private readonly records = new Map<WorkerJobId, TicketRecord>();
  private readonly seen = new Set<WorkerJobId>();
  private readonly handles: WorkerHandle[] = [];
  private readonly transportFactory: WorkerTransportFactory;
  private lifecycle: WorkerPoolSnapshot["state"] = "Stopped";
  private epoch: WorkerEpoch = workerEpoch(0);
  private plan: PlanningEpoch;
  private restarts = 0;

  public constructor(private readonly options: WorkerPoolOptions) {
    if (!Number.isSafeInteger(options.workerCount) || options.workerCount <= 0) throw new RangeError("workerCount must be a positive safe integer.");
    this.queue = new StableWorkerJobQueue(options.queueCapacity);
    this.transportFactory = options.transportFactory ?? createBrowserWorkerTransport;
    this.plan = planningEpoch(options.initialPlanningEpoch ?? 0);
  }

  public async start(): Promise<void> {
    if (this.lifecycle !== "Stopped") throw new Error("WorkerPool can only start from Stopped.");
    this.lifecycle = "Starting";
    try {
      await Promise.all(Array.from({ length: this.options.workerCount }, (_, slot) => this.createHandle(slot, false)));
      this.lifecycle = "Running";
      this.dispatch();
    } catch (error) {
      for (const handle of this.handles) handle.terminate();
      this.handles.length = 0;
      this.lifecycle = "Stopped";
      throw error;
    }
  }

  public setPlanningEpoch(value: PlanningEpoch): void {
    const next = planningEpoch(value);
    if (next < this.plan) throw new RangeError("Planning epoch cannot move backwards.");
    this.plan = next;
  }

  public enqueue(source: WorkerJobRequest, sourceInput: TransferableBufferBundle): WorkerJobTicket {
    if (this.lifecycle !== "Running") throw new Error("WorkerPool is not accepting jobs.");
    const request = snapshotWorkerJobRequest(source);
    if (request.workerEpoch !== 0) throw new RangeError("Caller requests must use workerEpoch 0; the pool binds it at dispatch.");
    if (request.planningEpoch !== this.plan) throw new RangeError("Request planningEpoch does not match the pool planning epoch.");
    if (request.jobKind === "TransformBuffer") validateTransformPayload(request.payload);
    const input = validateTransferableBundle(sourceInput);
    if (input.ownership !== "SenderToWorker" || input.revision !== request.inputRevision || input.byteLength !== request.estimatedInputBytes) {
      throw new RangeError("Input bundle does not match request ownership, revision, or byte estimate.");
    }
    const record = this.createRecord(request, input);
    if (this.seen.has(request.jobId)) {
      this.fail(record, "DuplicateJob", "Job IDs are unique for the lifetime of a pool.");
      return this.ticket(record);
    }
    this.seen.add(request.jobId);
    const queued = this.queue.enqueue(request);
    if (queued.kind === "RejectedQueueFull") this.fail(record, "QueueFull", "Worker queue capacity is exhausted.");
    else if (queued.kind === "RejectedDuplicateJob") this.fail(record, "DuplicateJob", "Job ID is already queued.");
    else {
      try {
        const ownedInput = structuredClone(input, { transfer: transferListFor(input) }) as TransferableBufferBundle;
        record.input = validateTransferableBundle(ownedInput);
      } catch (error) {
        this.queue.cancel(request.jobId);
        this.fail(record, "InvalidInput", error instanceof Error ? error.message : "Input ownership transfer failed.");
        return this.ticket(record);
      }
      this.records.set(request.jobId, record);
      this.emit({ type: "Queued", jobId: request.jobId, queueDepth: this.queue.size });
      this.dispatch();
    }
    return this.ticket(record);
  }

  public cancel(jobId: WorkerJobId): boolean {
    const record = this.records.get(jobId);
    if (!record || record.status === "Terminal") return false;
    if (record.status === "Queued") {
      if (!this.queue.cancel(jobId)) return false;
      this.settle(record, Object.freeze({ kind: "Cancelled", reason: "CancelledBeforeStart" }));
      this.emit({ type: "Cancelled", jobId });
      return true;
    }
    if (record.cancelRequested) return true;
    record.cancelRequested = true;
    return record.handle?.cancel(jobId) ?? false;
  }

  public async replaceWorker(slot: number): Promise<WorkerEpoch> {
    if (this.lifecycle !== "Running") throw new Error("WorkerPool is not running.");
    const old = this.handles.find((handle) => handle.slot === slot);
    if (!old) throw new RangeError(`Unknown worker slot ${slot}.`);
    this.failActive(old, "Worker was explicitly replaced.");
    old.terminate();
    try {
      const replacement = await this.createHandle(slot, true);
      this.dispatch();
      return replacement.workerEpoch;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Replacement worker failed to start.";
      for (const record of [...this.records.values()].filter((entry) => entry.status !== "Terminal").sort(compareRecords)) {
        this.fail(record, "WorkerFault", message);
      }
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.lifecycle === "Stopped") return;
    this.lifecycle = "ShuttingDown";
    for (const request of this.queue.drain()) {
      const record = this.records.get(request.jobId);
      if (record) {
        this.settle(record, Object.freeze({ kind: "Cancelled", reason: "CancelledBeforeStart" }));
        this.emit({ type: "Cancelled", jobId: request.jobId });
      }
    }
    const running = [...this.records.values()].filter((record) => record.status === "Running").sort(compareRecords);
    for (const record of running) this.fail(record, "Shutdown", "Worker pool shut down before completion.", record.handle?.workerEpoch);
    for (const handle of this.handles) {
      try { handle.stop(); }
      finally { handle.terminate(); }
    }
    this.handles.length = 0;
    this.lifecycle = "Stopped";
  }

  public snapshot(): WorkerPoolSnapshot {
    return Object.freeze({
      state: this.lifecycle,
      workerCount: this.options.workerCount,
      activeWorkers: this.handles.filter((handle) => handle.state === "Ready" || handle.state === "Busy").length,
      runningJobs: [...this.records.values()].filter((record) => record.status === "Running").length,
      workerRestarts: this.restarts,
      currentPlanningEpoch: this.plan,
      latestWorkerEpoch: this.epoch,
      queue: this.queue.snapshot(),
      workers: Object.freeze(this.handles.map((handle) => Object.freeze({
        slot: handle.slot, workerEpoch: handle.workerEpoch, state: handle.state,
        ...(handle.jobId === undefined ? {} : { jobId: handle.jobId }),
      }))),
    });
  }

  private createRecord(request: WorkerJobRequest, input: TransferableBufferBundle): TicketRecord {
    let resolve!: (terminal: WorkerJobTerminal) => void;
    const promise = new Promise<WorkerJobTerminal>((complete) => { resolve = complete; });
    return { request, input, promise, resolve, status: "Queued", handle: undefined, cancelRequested: false };
  }

  private ticket(record: TicketRecord): WorkerJobTicket {
    return Object.freeze({ jobId: record.request.jobId, result: record.promise, cancel: () => this.cancel(record.request.jobId) });
  }

  private nextEpoch(): WorkerEpoch {
    if (this.epoch >= Number.MAX_SAFE_INTEGER) throw new RangeError("Worker epoch space is exhausted.");
    this.epoch = workerEpoch(this.epoch + 1);
    return this.epoch;
  }

  private async createHandle(slot: number, replacement: boolean): Promise<WorkerHandle> {
    const callbacks: WorkerHandleCallbacks = {
      onCompleted: (handle, result, output) => this.completed(handle, result, output),
      onCancelled: (handle, jobId) => this.cancelled(handle, jobId),
      onFailed: (handle, failure) => this.workerFailed(handle, failure),
      onFault: (handle, reason) => this.faulted(handle, reason),
    };
    const handle = new WorkerHandle(slot, this.nextEpoch(), this.transportFactory, callbacks);
    const index = this.handles.findIndex((entry) => entry.slot === slot);
    if (index < 0) this.handles.push(handle); else this.handles.splice(index, 1, handle);
    this.handles.sort((left, right) => left.slot - right.slot);
    await handle.start();
    if (replacement) {
      this.restarts += 1;
      this.emit({ type: "WorkerRestarted", workerEpoch: handle.workerEpoch });
    }
    return handle;
  }

  private dispatch(): void {
    if (this.lifecycle !== "Running") return;
    for (const handle of this.handles) {
      if (handle.state !== "Ready") continue;
      const request = this.queue.dispatchNext();
      if (!request) return;
      const record = this.records.get(request.jobId);
      if (!record || !record.input) continue;
      const input = record.input;
      record.input = undefined;
      record.status = "Running";
      record.handle = handle;
      try {
        handle.assign(snapshotWorkerJobRequest({ ...request, workerEpoch: handle.workerEpoch }), input);
        this.emit({ type: "Dispatched", jobId: request.jobId, workerEpoch: handle.workerEpoch, inputBytes: input.byteLength });
      } catch (error) {
        this.fail(record, "WorkerFault", error instanceof Error ? error.message : "Worker dispatch failed.", handle.workerEpoch);
        this.replaceAfterFault(handle, "Worker dispatch failed.");
      }
    }
  }

  private completed(handle: WorkerHandle, result: WorkerJobResult, output: JobOutputDataMessage): void {
    this.emit({ type: "OutputTransferred", jobId: result.jobId, outputBytes: output.outputBytes });
    const record = this.records.get(result.jobId);
    if (!record || record.handle !== handle) return this.replaceAfterFault(handle, "Result belongs to an unknown job.");
    const decision = integrateWorkerResult(Object.freeze({
      jobId: record.request.jobId,
      cancelled: record.cancelRequested,
      planningEpoch: this.plan,
      workerEpoch: handle.workerEpoch,
      targetKey: record.request.targetKey,
      inputRevision: record.request.inputRevision,
      outputRevision: validateTransformPayload(record.request.payload).outputRevision,
      algorithmVersion: record.request.algorithmVersion,
      maximumOutputBytes: byteCount(record.request.estimatedOutputBytes, "maximumOutputBytes"),
    }), result, output.bundle);
    if (decision.kind === "Accepted") {
      this.settle(record, Object.freeze({ kind: "Completed", result, output: decision.bundle }));
      this.emit({ type: "Completed", jobId: result.jobId, outputBytes: output.outputBytes });
    } else if (record.cancelRequested) {
      this.settle(record, Object.freeze({ kind: "Cancelled", reason: "CancelledDuringExecution" }));
      this.emit({ type: "Cancelled", jobId: result.jobId });
    } else {
      this.fail(record, "ProtocolFault", `Worker result rejected: ${decision.kind}.`, handle.workerEpoch, decision);
      if (decision.kind === "RejectedStalePlanningEpoch" || decision.kind === "RejectedStaleWorkerEpoch") {
        this.emit({ type: "StaleResultRejected", jobId: result.jobId });
      }
    }
    this.dispatch();
  }

  private cancelled(handle: WorkerHandle, jobId: WorkerJobId): void {
    const record = this.records.get(jobId);
    if (!record || record.handle !== handle) return this.replaceAfterFault(handle, "Cancellation belongs to an unknown job.");
    this.settle(record, Object.freeze({ kind: "Cancelled", reason: "CancelledDuringExecution" }));
    this.emit({ type: "Cancelled", jobId });
    this.dispatch();
  }

  private workerFailed(handle: WorkerHandle, failure: WorkerJobFailure): void {
    const record = this.records.get(failure.jobId);
    if (!record || record.handle !== handle) return this.replaceAfterFault(handle, "Failure belongs to an unknown job.");
    this.settle(record, Object.freeze({ kind: "Failed", failure }));
    this.emit({ type: "Failed", jobId: failure.jobId });
    if (failure.code === "ProtocolFault" || failure.code === "WrongWorkerEpoch" || failure.code === "UnknownJob") {
      this.replaceAfterFault(handle, failure.message);
      return;
    }
    this.dispatch();
  }

  private faulted(handle: WorkerHandle, reason: string): void { this.replaceAfterFault(handle, reason); }

  private replaceAfterFault(handle: WorkerHandle, reason: string): void {
    this.failActive(handle, reason);
    handle.terminate();
    if (this.lifecycle !== "Running") return;
    void this.createHandle(handle.slot, true).then(() => this.dispatch()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Replacement worker failed to start.";
      for (const record of [...this.records.values()].filter((entry) => entry.status !== "Terminal").sort(compareRecords)) {
        this.fail(record, "WorkerFault", message);
      }
    });
  }

  private failActive(handle: WorkerHandle, reason: string): void {
    const record = handle.jobId === undefined ? undefined : this.records.get(handle.jobId);
    if (record) this.fail(record, "WorkerFault", reason, handle.workerEpoch);
  }

  private fail(record: TicketRecord, code: WorkerJobFailure["code"], message: string, epoch?: WorkerEpoch, decision?: WorkerResultIntegrationDecision): void {
    const failure: WorkerJobFailure = Object.freeze({ jobId: record.request.jobId, code, message, ...(epoch === undefined ? {} : { workerEpoch: epoch }) });
    this.settle(record, Object.freeze({ kind: "Failed", failure, ...(decision === undefined ? {} : { integrationDecision: decision }) }));
    this.emit({ type: "Failed", jobId: record.request.jobId });
  }

  private settle(record: TicketRecord, terminal: WorkerJobTerminal): void {
    if (record.status === "Terminal") return;
    record.status = "Terminal";
    record.handle = undefined;
    record.input = undefined;
    if (this.records.get(record.request.jobId) === record) this.records.delete(record.request.jobId);
    record.resolve(terminal);
  }

  private emit(event: WorkerPoolEvent): void {
    try {
      this.options.observe?.(event);
    } catch {
      // Diagnostics cannot alter queue, dispatch, or lifecycle decisions.
    }
  }
}

const compareRecords = (left: TicketRecord, right: TicketRecord): number =>
  left.request.jobId < right.request.jobId ? -1 : left.request.jobId > right.request.jobId ? 1 : 0;
