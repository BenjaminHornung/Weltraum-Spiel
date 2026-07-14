import { describe, expect, it } from "vitest";
import {
  StreamingWorkerRuntime,
  WorkerPool,
  algorithmVersion,
  byteCount,
  contentRevision,
  jobDeadline,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type HostToWorkerMessage,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerToHostMessage,
  type WorkerTransport
} from "../../src/workers";

class RuntimeTransport implements WorkerTransport {
  private messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
  private retiredMessageHandler: ((event: MessageEvent<unknown>) => void) | null = null;
  public get onmessage(): ((event: MessageEvent<unknown>) => void) | null { return this.messageHandler; }
  public set onmessage(value: ((event: MessageEvent<unknown>) => void) | null) {
    if (value !== null) this.retiredMessageHandler = value;
    this.messageHandler = value;
  }
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public terminated = false;
  public corruptNextOutputOwnership = false;
  readonly #runtime = new StreamingWorkerRuntime((message, transfer = []) => {
    const cloned = structuredClone(message, { transfer: [...transfer] }) as WorkerToHostMessage;
    const delivered: WorkerToHostMessage = this.corruptNextOutputOwnership && cloned.type === "JobOutputData"
      ? { ...cloned, bundle: { ...cloned.bundle, ownership: "SenderToWorker" } }
      : cloned;
    if (cloned.type === "JobOutputData") this.corruptNextOutputOwnership = false;
    queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: delivered } as MessageEvent<unknown>); });
  });

  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    const cloned = structuredClone(message, { transfer }) as HostToWorkerMessage;
    queueMicrotask(() => { if (!this.terminated) this.#runtime.handleMessage(cloned); });
  }

  public terminate(): void { this.terminated = true; }
  public fail(message = "synthetic worker error"): void { this.onerror?.({ message } as ErrorEvent); }
  public failMessage(): void { this.onmessageerror?.({ data: undefined } as MessageEvent<unknown>); }
  public emitMalformed(): void { this.onmessage?.({ data: { type: "WorkerReady" } } as MessageEvent<unknown>); }
  public emitAfterTermination(message: WorkerToHostMessage): void {
    this.retiredMessageHandler?.({ data: message } as MessageEvent<unknown>);
  }
}

class PendingStartupTransport implements WorkerTransport {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public terminated = false;
  public postMessage(): void {}
  public terminate(): void { this.terminated = true; }
}

class ThrowingInitializeTransport extends PendingStartupTransport {
  public postMessage(): void { throw new Error("synthetic initialize post failure"); }
}

class ThrowingShutdownTransport extends RuntimeTransport {
  public postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
    if (message.type === "ShutdownWorker") throw new Error("synthetic shutdown post failure");
    super.postMessage(message, transfer);
  }
}

const request = (id: string, bytes: number, planning = 1): WorkerJobRequest => ({
  jobId: workerJobId(id), jobKind: workerJobKind("TransformBuffer"), targetKey: workerTargetKey(`target-${id}`),
  planningEpoch: planningEpoch(planning), workerEpoch: workerEpoch(0), inputRevision: contentRevision(1),
  algorithmVersion: algorithmVersion(1), priority: "Normal", deadline: jobDeadline(1),
  estimatedInputBytes: byteCount(bytes), estimatedOutputBytes: byteCount(bytes),
  payload: { xorMask: 0x33, chunkBytes: 1024, outputRevision: contentRevision(2) }
});

const input = (bytes: number): TransferableBufferBundle => {
  const buffer = new ArrayBuffer(bytes);
  return {
    ownership: "SenderToWorker", revision: contentRevision(1), byteLength: byteCount(bytes), buffers: [buffer],
    views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: bytes }]
  };
};

const createPool = async (workerCount = 1) => {
  const transports: RuntimeTransport[] = [];
  const pool = new WorkerPool({
    workerCount, queueCapacity: 16, initialPlanningEpoch: planningEpoch(1),
    transportFactory: () => { const transport = new RuntimeTransport(); transports.push(transport); return transport; }
  });
  await pool.start();
  return { pool, transports };
};

describe("WorkerPool lifecycle", () => {
  it("completes deterministic work and detaches transferred input", async () => {
    const { pool } = await createPool();
    const source = input(32);
    const sender = source.buffers[0];
    const ticket = pool.enqueue(request("complete", 32), source);
    expect(sender.byteLength).toBe(0);
    const terminal = await ticket.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") expect(terminal.output.buffers[0].byteLength).toBe(32);
    await pool.shutdown();
  });

  it("takes transferable ownership before an accepted job waits in the queue", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("ownership-running", 512 * 1024), input(512 * 1024));
    const queuedInput = input(8);
    new Uint8Array(queuedInput.buffers[0]).fill(0x11);
    const sender = queuedInput.buffers[0];
    const queued = pool.enqueue(request("ownership-queued", 8), queuedInput);

    expect(sender.byteLength).toBe(0);
    expect(running.cancel()).toBe(true);
    expect(await running.result).toEqual({ kind: "Cancelled", reason: "CancelledDuringExecution" });
    const terminal = await queued.result;
    expect(terminal.kind).toBe("Completed");
    if (terminal.kind === "Completed") {
      expect([...new Uint8Array(terminal.output.buffers[0])]).toEqual(Array(8).fill(0x22));
    }
    await pool.shutdown();
  });

  it("cancels queued and running jobs with distinct outcomes", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("queued", 8), input(8));
    expect(queued.cancel()).toBe(true);
    expect(running.cancel()).toBe(true);
    expect(await queued.result).toEqual({ kind: "Cancelled", reason: "CancelledBeforeStart" });
    expect(await running.result).toEqual({ kind: "Cancelled", reason: "CancelledDuringExecution" });
    await pool.shutdown();
  });

  it("settles affected requests on worker error and replaces with a higher epoch", async () => {
    const { pool, transports } = await createPool();
    const ticket = pool.enqueue(request("fault", 512 * 1024), input(512 * 1024));
    const before = pool.snapshot().latestWorkerEpoch;
    transports[0].fail();
    expect(await ticket.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);
    expect(pool.snapshot().latestWorkerEpoch).toBeGreaterThan(before);
    await pool.shutdown();
  });

  it("stops fail-closed when a fault replacement cannot start", async () => {
    const transports: RuntimeTransport[] = [];
    let creations = 0;
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        creations += 1;
        if (creations > 1) throw new Error("synthetic replacement start failure");
        const transport = new RuntimeTransport();
        transports.push(transport);
        return transport;
      }
    });
    await pool.start();
    const running = pool.enqueue(request("failed-replacement-running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("failed-replacement-queued", 8), input(8));

    transports[0].fail();

    const terminals = await Promise.all([running.result, queued.result]);
    expect(terminals).toEqual([
      expect.objectContaining({ kind: "Failed", failure: expect.objectContaining({ code: "WorkerFault" }) }),
      expect.objectContaining({ kind: "Failed", failure: expect.objectContaining({ code: "WorkerFault" }) })
    ]);
    await expect.poll(() => pool.snapshot().state).toBe("Stopped");
    expect(pool.snapshot()).toMatchObject({ activeWorkers: 0, runningJobs: 0, queue: { size: 0 } });
    expect(() => pool.enqueue(request("after-failed-replacement", 8), input(8))).toThrow("WorkerPool is not accepting jobs");
  });

  it("explicit replacement advances epoch and never retries active work", async () => {
    const { pool } = await createPool();
    const ticket = pool.enqueue(request("replace", 512 * 1024), input(512 * 1024));
    const before = pool.snapshot().latestWorkerEpoch;
    const after = await pool.replaceWorker(0);
    expect(after).toBeGreaterThan(before);
    expect(await ticket.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await pool.shutdown();
  });

  it("ignores late output from a terminated worker epoch after replacement", async () => {
    const { pool, transports } = await createPool();
    const oldEpoch = pool.snapshot().latestWorkerEpoch;
    const oldTicket = pool.enqueue(request("late-old", 512 * 1024), input(512 * 1024));
    await pool.replaceWorker(0);
    expect(await oldTicket.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });

    const staleBundle: TransferableBufferBundle = {
      ownership: "WorkerToConsumer", revision: contentRevision(2), byteLength: byteCount(8), buffers: [new ArrayBuffer(8)],
      views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: 8 }]
    };
    transports[0].emitAfterTermination({ type: "JobOutputData", jobId: workerJobId("late-old"), workerEpoch: oldEpoch, outputBytes: byteCount(8), bundle: staleBundle });
    transports[0].emitAfterTermination({
      type: "JobCompleted",
      result: {
        jobId: workerJobId("late-old"), targetKey: workerTargetKey("target-late-old"), planningEpoch: planningEpoch(1),
        workerEpoch: oldEpoch, inputRevision: contentRevision(1), outputRevision: contentRevision(2),
        algorithmVersion: algorithmVersion(1), outputBytes: byteCount(8)
      }
    });
    expect(pool.snapshot().workerRestarts).toBe(1);
    const replacement = pool.enqueue(request("replacement-work", 8), input(8));
    expect(await replacement.result).toMatchObject({ kind: "Completed" });
    await pool.shutdown();
  });

  it("does not let a rejected late cancellation replace a completed outcome", async () => {
    const transports: RuntimeTransport[] = [];
    let ticket: ReturnType<WorkerPool["enqueue"]> | undefined;
    let lateCancelAccepted: boolean | undefined;
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => {
        const transport = new RuntimeTransport();
        transports.push(transport);
        return transport;
      },
      observe: (event) => {
        if (event.type === "OutputTransferred") lateCancelAccepted = ticket?.cancel();
      }
    });
    await pool.start();
    ticket = pool.enqueue(request("late-cancel", 8), input(8));

    const terminal = await ticket.result;

    expect(lateCancelAccepted).toBe(false);
    expect(terminal).toMatchObject({ kind: "Completed" });
    await pool.shutdown();
  });

  it("rejects stale planning results after the planning epoch advances", async () => {
    const { pool } = await createPool();
    const ticket = pool.enqueue(request("stale", 64 * 1024), input(64 * 1024));
    pool.setPlanningEpoch(planningEpoch(2));
    const terminal = await ticket.result;
    expect(terminal).toMatchObject({
      kind: "Failed", integrationDecision: { kind: "RejectedStalePlanningEpoch" }
    });
    await pool.shutdown();
  });

  it("shutdown leaves no queued or running ticket unresolved", async () => {
    const { pool } = await createPool();
    const running = pool.enqueue(request("shutdown-running", 512 * 1024), input(512 * 1024));
    const queued = pool.enqueue(request("shutdown-queued", 8), input(8));
    await pool.shutdown();
    const terminals = await Promise.all([running.result, queued.result]);
    expect(terminals.map((terminal) => terminal.kind).sort()).toEqual(["Cancelled", "Failed"]);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", runningJobs: 0, queue: { size: 0 } });
  });

  it("rejects a pending pool start when shutdown terminates the starting handle", async () => {
    const transport = new PendingStartupTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport
    });
    const starting = pool.start();
    const rejectedStart = expect(starting).rejects.toThrow("Worker terminated before becoming ready");
    await Promise.resolve();

    await pool.shutdown();

    await rejectedStart;
    expect(transport.terminated).toBe(true);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("rejects startup when the initialize control message cannot be posted", async () => {
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => new ThrowingInitializeTransport()
    });

    await expect(pool.start()).rejects.toThrow("synthetic initialize post failure");

    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("finishes shutdown when the final control message cannot be posted", async () => {
    const transport = new ThrowingShutdownTransport();
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => transport
    });
    await pool.start();

    await expect(pool.shutdown()).resolves.toBeUndefined();

    expect(transport.terminated).toBe(true);
    expect(pool.snapshot()).toMatchObject({ state: "Stopped", activeWorkers: 0, runningJobs: 0 });
  });

  it("isolates throwing diagnostic observers from queue and lifecycle decisions", async () => {
    const transports: RuntimeTransport[] = [];
    const pool = new WorkerPool({
      workerCount: 1,
      queueCapacity: 4,
      initialPlanningEpoch: planningEpoch(1),
      transportFactory: () => { const transport = new RuntimeTransport(); transports.push(transport); return transport; },
      observe: () => { throw new Error("observer failure"); }
    });
    await pool.start();
    let ticket!: ReturnType<WorkerPool["enqueue"]>;
    expect(() => { ticket = pool.enqueue(request("observer", 32), input(32)); }).not.toThrow();
    expect(await ticket.result).toMatchObject({ kind: "Completed" });
    expect(pool.snapshot().workerRestarts).toBe(0);
    await pool.shutdown();
  });

  it("faults malformed protocol and messageerror events and replaces each worker", async () => {
    const { pool, transports } = await createPool();
    const malformed = pool.enqueue(request("malformed", 512 * 1024), input(512 * 1024));
    transports[0].emitMalformed();
    expect(await malformed.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);

    const messageError = pool.enqueue(request("message-error", 512 * 1024), input(512 * 1024));
    transports[1].failMessage();
    expect(await messageError.result).toMatchObject({ kind: "Failed", failure: { code: "WorkerFault" } });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(2);
    await pool.shutdown();
  });

  it("retires a worker whose completed result violates the integration contract", async () => {
    const { pool, transports } = await createPool();
    transports[0].corruptNextOutputOwnership = true;
    const rejected = pool.enqueue(request("invalid-result-owner", 8), input(8));
    const queued = pool.enqueue(request("after-invalid-result", 8), input(8));

    expect(await rejected.result).toMatchObject({
      kind: "Failed",
      failure: { code: "ProtocolFault" },
      integrationDecision: { kind: "RejectedInvalidLayout" }
    });
    await expect.poll(() => pool.snapshot().workerRestarts).toBe(1);
    expect(await queued.result).toMatchObject({ kind: "Completed" });
    expect(transports).toHaveLength(2);
    await pool.shutdown();
  });

  it("settles duplicate and full-queue rejections explicitly", async () => {
    const transports: RuntimeTransport[] = [];
    const pool = new WorkerPool({ workerCount: 1, queueCapacity: 1, initialPlanningEpoch: planningEpoch(1), transportFactory: () => {
      const transport = new RuntimeTransport(); transports.push(transport); return transport;
    } });
    await pool.start();
    const active = pool.enqueue(request("active", 8), input(8));
    const queued = pool.enqueue(request("queued-full", 8), input(8));
    const full = pool.enqueue(request("overflow", 8), input(8));
    const duplicate = pool.enqueue(request("queued-full", 8), input(8));
    expect(await full.result).toMatchObject({ kind: "Failed", failure: { code: "QueueFull" } });
    expect(await duplicate.result).toMatchObject({ kind: "Failed", failure: { code: "DuplicateJob" } });
    expect(active.cancel()).toBe(true);
    expect(queued.cancel()).toBe(true);
    await Promise.all([active.result, queued.result]);
    await pool.shutdown();
  });
});
