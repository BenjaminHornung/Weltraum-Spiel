import { describe, expect, it, vi } from "vitest";
import { runHvpBounded } from "../../src/workers/hvpBoundedPump";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { createHvpTerrainCompiler } from "../../src/hestia-prototype/terrain/terrainProducts";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { readHvpBodyCells } from "../../src/hestia-prototype/physics/bodyCutPlan";
import type { HvpMovingCutPreparation } from "../../src/hestia-prototype/physics/bodyCutSession";
import { decodeHvpBodyCutOutput, executeHvpBodyCutJob, hvpBodyCutInputDigest } from "../../src/workers/hvpBodyCutJob";
import * as terrainJob from "../../src/workers/hvpTerrainJob";
import { StreamingWorkerRuntime, algorithmVersion, byteCount, contentRevision, type HostToWorkerMessage,
  type WorkerToHostMessage, type WorkerTransport, type WorkerJobRequest, type TransferableBufferBundle } from "../../src/workers";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe("P05 bounded lanes", () => {
  it("refills the free lane before its sibling finishes and retains input order", async () => {
    const gates = Array.from({ length: 4 }, () => deferred<number>());
    const thirdStarted = deferred<void>();
    const fourthStarted = deferred<void>();
    const starts: number[] = [];
    let active = 0, maximum = 0;
    const values = Object.freeze([10, 20, 30, 40]);
    const result = runHvpBounded(values, 2, async (value, index) => {
      expect(value).toBe(values[index]);
      starts.push(index); active += 1; maximum = Math.max(maximum, active);
      if (index === 2) { thirdStarted.resolve(); }
      if (index === 3) { fourthStarted.resolve(); }
      try { return await gates[index]!.promise; } finally { active -= 1; }
    });
    expect(starts).toEqual([0, 1]);
    gates[1]!.resolve(200);
    await thirdStarted.promise;
    expect(starts).toEqual([0, 1, 2]);
    gates[2]!.resolve(300);
    await fourthStarted.promise;
    expect(starts).toEqual([0, 1, 2, 3]);
    gates[3]!.resolve(400); gates[0]!.resolve(100);
    expect(await result).toEqual([100, 200, 300, 400]);
    expect(maximum).toBe(2); expect(active).toBe(0);
    expect(values).toEqual([10, 20, 30, 40]);
  });

  it("keeps concurrency one serial", async () => {
    const first = deferred<number>(), secondStarted = deferred<void>();
    const starts: number[] = [];
    const result = runHvpBounded([0, 1], 1, async (_, index) => {
      starts.push(index);
      if (index === 0) { return first.promise; }
      secondStarted.resolve(); return 20;
    });
    expect(starts).toEqual([0]); first.resolve(10);
    await secondStarted.promise;
    expect(await result).toEqual([10, 20]); expect(starts).toEqual([0, 1]);
  });

  it.each([1, 2])("does no work for empty input at concurrency %i", async parallel => {
    let calls = 0;
    expect(await runHvpBounded([], parallel, async () => { calls += 1; })).toEqual([]);
    expect(calls).toBe(0);
  });

  it.each([0, -1, 3, 1.5, NaN, Infinity])("rejects invalid concurrency %s even for empty input", async parallel => {
    let calls = 0;
    await expect(runHvpBounded([], parallel, async () => { calls += 1; })).rejects.toThrow("Invalid HVP concurrency");
    expect(calls).toBe(0);
  });

  it("waits for started siblings after first failure, ignores later failures and starts nothing new", async () => {
    const first = deferred<number>(), sibling = deferred<number>(), failed = deferred<void>();
    const original = new Error("first"), later = new Error("sibling"), cancellation = new Error("cancel");
    const starts: number[] = [], observed: unknown[] = [];
    let settled = false;
    const result = runHvpBounded([0, 1, 2], 2, (_, index) => {
      starts.push(index); return index === 0 ? first.promise : sibling.promise;
    }, error => { observed.push(error); failed.resolve(); throw cancellation; });
    const outcome = result.then(() => { settled = true; return null; }, error => { settled = true; return error; });
    first.reject(original); await failed.promise;
    // Flush rejection notifications, without releasing the Deferred-controlled sibling.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(settled).toBe(false); expect(starts).toEqual([0, 1]); expect(observed).toEqual([original]);
    sibling.reject(later);
    expect(await outcome).toBe(original); expect(starts).toEqual([0, 1]); expect(observed).toEqual([original]);
  });

  it("preserves a synchronous undefined failure without starting the second lane", async () => {
    const starts: number[] = [], failures: unknown[] = [];
    const outcome = runHvpBounded([0, 1, 2], 2, (_, index): Promise<number> => {
      starts.push(index); throw undefined;
    }, error => { failures.push(error); }).then(() => "unexpected success", error => error);
    expect(await outcome).toBeUndefined(); expect(starts).toEqual([0]); expect(failures).toEqual([undefined]);
  });

  it("preserves an asynchronous undefined failure and still drains the successful sibling", async () => {
    const first = deferred<number>(), sibling = deferred<number>(), failed = deferred<void>();
    let settled = false;
    const result = runHvpBounded([0, 1, 2], 2, (_, index) => index === 0 ? first.promise : sibling.promise,
      () => { failed.resolve(); });
    const outcome = result.then(() => { settled = true; return "unexpected success"; }, error => { settled = true; return error; });
    first.reject(undefined); await failed.promise;
    await new Promise<void>(resolve => setTimeout(resolve, 0)); expect(settled).toBe(false);
    sibling.resolve(10); expect(await outcome).toBeUndefined();
  });
});

/** The real pool/kernel/gate run here; only delivery of actual terminal messages is held. */
const compilerFixture = () => {
  let reads = 0, readFailure: Error | undefined;
  const root = createHvpTerrainRoot({ sizeX: 256, sizeY: 128, sizeZ: 256, cellMeters: .125,
    originMeters: { x: -16, y: -8, z: -16 }, sourceDigest: "12345678",
    readSlot: (x, y, z) => { reads += 1; if (readFailure) { throw readFailure; } return (x === 63 || x === 65) && y === 1 && z === 63 ? 1 : 0; }
  }, "pump-session", 0);
  const before = root.read();
  const plan = root.prepare({ sessionId: before.sessionId, epoch: before.epoch, revision: before.revision,
    sourceDigest: before.sourceDigest, commandId: "pump-cut", toolPolicy: "hvp-plasma-v1",
    shape: { kind: "Box", min: [63, 1, 63], max: [64, 2, 64] } });
  reads = 0;
  const requests: WorkerJobRequest[] = [], cancelled: number[] = [], inputBytes: number[] = [];
  const detachedInputs: boolean[] = [], outputLayouts: string[][] = [];
  const holds = new Set<number>(), held = new Map<number, () => void>(), active = new Set<string>();
  const transports: RuntimeTransport[] = [];
  const controls = { corruptOutput: -1, throwCancel: -1, maximum: 0 };
  class RuntimeTransport implements WorkerTransport {
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
    terminated = false;
    private assigned: string | undefined;
    constructor() { transports.push(this); }
    private readonly runtime = new StreamingWorkerRuntime((message, transfer = []) => {
      const cloned = structuredClone(message, { transfer: [...transfer] }) as WorkerToHostMessage;
      if (cloned.type === "JobOutputData") {
        outputLayouts.push(cloned.bundle.views.map(view => view.name));
        if (requests.findIndex(request => request.jobId === cloned.jobId) === controls.corruptOutput) {
          const bytes = new Uint8Array(cloned.bundle.buffers[0]!);
          if (bytes.length === 0) { throw new Error("Corruption fixture requires actual output bytes"); }
          bytes[0] = bytes[0]! ^ 1;
        }
      }
      const id = cloned.type === "JobCompleted" ? cloned.result.jobId : cloned.type === "JobCancelled" ? cloned.jobId
        : cloned.type === "JobFailed" ? cloned.failure.jobId : undefined;
      const deliver = () => queueMicrotask(() => {
        if (this.terminated) { return; }
        if (id !== undefined) { active.delete(id); this.assigned = undefined; }
        this.onmessage?.({ data: cloned } as MessageEvent<unknown>);
      });
      const index = requests.findIndex(request => request.jobId === id);
      if (id !== undefined && holds.has(index)) { held.set(index, deliver); } else { deliver(); }
    });
    postMessage(message: HostToWorkerMessage, transfer: Transferable[] = []): void {
      if (message.type === "EnqueueJob") {
        requests.push(message.request); this.assigned = message.request.jobId; active.add(this.assigned);
        controls.maximum = Math.max(controls.maximum, active.size);
      }
      if (message.type === "CancelJob") {
        const index = requests.findIndex(request => request.jobId === message.jobId); cancelled.push(index);
        if (index === controls.throwCancel) { throw new Error("cancel transport failed"); }
      }
      if (message.type === "JobInputData") { inputBytes.push(message.bundle.byteLength); }
      const cloned = structuredClone(message, { transfer }) as HostToWorkerMessage;
      if (message.type === "JobInputData") { detachedInputs.push(message.bundle.buffers.every(buffer => buffer.byteLength === 0)); }
      queueMicrotask(() => { if (!this.terminated) { this.runtime.handleMessage(cloned); } });
    }
    terminate(): void { this.terminated = true; if (this.assigned) { active.delete(this.assigned); } }
  }
  vi.stubGlobal("navigator", { hardwareConcurrency: 3 });
  vi.stubGlobal("Worker", RuntimeTransport);
  const compiler = createHvpTerrainCompiler();
  const release = (index: number) => { holds.delete(index); const deliver = held.get(index); held.delete(index); deliver?.(); };
  return { root, plan, compiler, requests, cancelled, inputBytes, detachedInputs, outputLayouts, holds, held, controls,
    reads: () => reads, failReads: (error?: Error) => { readFailure = error; }, release,
    async dispose() {
      readFailure = undefined; holds.clear(); for (const index of [...held.keys()]) { release(index); }
      try { await compiler.dispose(); expect(transports.every(transport => transport.terminated)).toBe(true); }
      finally { vi.unstubAllGlobals(); }
    }
  };
};

describe("P05 actual compiler transport", () => {
  it("packs at most two active inputs, refills before the held sibling, and returns work-list order", async () => {
    const f = compilerFixture(); f.holds.add(0); f.holds.add(1);
    const result = f.compiler.compile(f.plan); void result.catch(() => {});
    try {
      await vi.waitFor(() => expect(f.held.size).toBe(2), { timeout: 10_000 });
      expect(f.requests).toHaveLength(2); expect(f.inputBytes).toEqual([66 * 130 * 66, 66 * 130 * 66]);
      expect(f.reads()).toBeLessThanOrEqual(2 * 66 * 128 * 66);
      expect(f.detachedInputs).toEqual([true, true]); expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 2, queue: 0 });
      f.release(1);
      await vi.waitFor(() => expect(f.requests.length).toBeGreaterThan(2), { timeout: 2_000 });
      expect(f.held.has(0)).toBe(true); f.release(0);
      const products = await result;
      expect([...products.render.keys()]).toEqual([0, 1, 4, 5]);
      expect([...products.collision.keys()]).toEqual([9, 10, 17, 18]);
      expect(products.source).toBe(f.plan.after); expect(f.root.read()).toBe(f.plan.before);
      expect(f.controls.maximum).toBe(2); expect(f.requests).toHaveLength(8);
      expect(f.requests.every(request => request.algorithmVersion === 1)).toBe(true);
      expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0 });
    } finally { await f.dispose(); }
  }, 30_000);

  it.each([false, true])("cancels and drains a real held sibling after packing fails (cancellation throws: %s)", async throws => {
    const f = compilerFixture(); f.holds.add(0); f.holds.add(1);
    if (throws) { f.controls.throwCancel = 0; }
    const original = new Error("source packing failed"); let settled = false;
    const result = f.compiler.compile(f.plan).then(value => { settled = true; return value; }, error => { settled = true; return error; });
    try {
      await vi.waitFor(() => expect(f.held.size).toBe(2), { timeout: 10_000 });
      f.failReads(original); f.release(1);
      await vi.waitFor(() => expect(f.cancelled).toContain(0), { timeout: 2_000 });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(settled).toBe(false); expect(f.requests).toHaveLength(2);
      f.release(0); expect(await result).toBe(original);
      expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0 });
      expect(f.root.read()).toBe(f.plan.before);
    } finally { await f.dispose(); }
  }, 30_000);

  it("preserves serial restore order and the empty restore path", async () => {
    const f = compilerFixture(); f.holds.add(0);
    const result = f.compiler.restore(f.plan.before, f.plan.after, true); void result.catch(() => {});
    try {
      await vi.waitFor(() => expect(f.held.has(0)).toBe(true), { timeout: 10_000 });
      expect(f.requests).toHaveLength(1); f.release(0);
      const products = await result;
      expect([...products.render.keys()]).toEqual([0, 1, 4, 5]); expect([...products.collision.keys()]).toEqual([9, 10, 17, 18]);
      expect(f.controls.maximum).toBe(1);
      const count = f.requests.length, empty = await f.compiler.restore(f.plan.before, f.plan.before, true);
      expect(empty.render.size).toBe(0); expect(empty.collision.size).toBe(0); expect(f.requests).toHaveLength(count);
    } finally { await f.dispose(); }
  }, 30_000);

  it("does not pack or enqueue pre-aborted work", async () => {
    const f = compilerFixture(), abort = new AbortController(); abort.abort();
    try {
      await expect(f.compiler.neighborSeams(f.plan.before, undefined, abort.signal, false, true)).rejects.toThrow(/Cancelled/);
      expect(f.reads()).toBe(0); expect(f.requests).toHaveLength(0);
    } finally { await f.dispose(); }
  });

  it.each([false, true])("waits for actual terminals on abort and removes listeners (first cancel throws: %s)", async throws => {
    const f = compilerFixture(), abort = new AbortController(); f.holds.add(0); f.holds.add(1);
    if (throws) { f.controls.throwCancel = 0; }
    const add = vi.spyOn(abort.signal, "addEventListener"), remove = vi.spyOn(abort.signal, "removeEventListener");
    let settled = false;
    const result = f.compiler.neighborSeams(f.plan.before, undefined, abort.signal, false, true)
      .then(value => { settled = true; return value; }, error => { settled = true; return error; });
    try {
      await vi.waitFor(() => expect(f.held.size).toBe(2), { timeout: 10_000 }); abort.abort();
      expect(f.cancelled).toEqual([0, 1]); expect(settled).toBe(false);
      f.release(0); await new Promise<void>(resolve => setTimeout(resolve, 0)); expect(settled).toBe(false);
      f.release(1); expect(await result).toBeInstanceOf(Error); expect(f.requests).toHaveLength(2);
      expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0 });
      expect(remove.mock.calls.map(call => call[1])).toEqual(expect.arrayContaining(add.mock.calls.map(call => call[1])));
      expect(remove).toHaveBeenCalledTimes(add.mock.calls.length);
    } finally { add.mockRestore(); remove.mockRestore(); await f.dispose(); }
  }, 30_000);

  it("rejects a real corrupted output through the existing gate and drains the other ticket", async () => {
    const f = compilerFixture(); f.holds.add(0); f.holds.add(1); f.controls.corruptOutput = 1;
    let settled = false;
    const result = f.compiler.compile(f.plan).then(value => { settled = true; return value; }, error => { settled = true; return error; });
    try {
      await vi.waitFor(() => expect(f.held.size).toBe(2), { timeout: 10_000 }); f.release(1);
      await vi.waitFor(() => expect(f.cancelled).toContain(0), { timeout: 2_000 });
      await new Promise<void>(resolve => setTimeout(resolve, 0)); expect(settled).toBe(false);
      // The unchanged pool translates a rejected integration gate into a Failed ticket.
      f.release(0); expect(String(await result)).toBe("Error: Terrain prepare Failed");
      expect(f.requests).toHaveLength(2); expect(f.root.read()).toBe(f.plan.before);
    } finally { await f.dispose(); }
  }, 30_000);

  it("rejects an abort during the real post-decode timer yield rather than publishing success", async () => {
    const f = compilerFixture(), abort = new AbortController(), decode = terrainJob.decodeHvpTerrainOutput;
    const spy = vi.spyOn(terrainJob, "decodeHvpTerrainOutput").mockImplementation((...args) => {
      const value = decode(...args);
      // The pool also validates with this decoder. Only the consumer runs after its ticket settles.
      if (f.requests.length === 4 && f.compiler.diagnostics().runningJobs === 0) { queueMicrotask(() => abort.abort()); }
      return value;
    });
    try {
      await expect(f.compiler.neighborSeams(f.plan.before, undefined, abort.signal, true, true)).rejects.toThrow(/Cancelled/);
      expect(f.requests).toHaveLength(4); expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0 });
    } finally { spy.mockRestore(); await f.dispose(); }
  }, 30_000);

  it("rejects disposal with outstanding tickets without packing more inputs", async () => {
    const f = compilerFixture(); f.holds.add(0); f.holds.add(1);
    const result = f.compiler.compile(f.plan).then(() => "unexpected success", error => error);
    try {
      await vi.waitFor(() => expect(f.held.size).toBe(2), { timeout: 10_000 });
      const reads = f.reads(); await f.compiler.dispose();
      expect(await result).toBeInstanceOf(Error); expect(f.requests).toHaveLength(2); expect(f.reads()).toBe(reads);
      expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0, workers: 0 });
      await expect(f.compiler.compile(f.plan)).rejects.toThrow("Terrain compiler disposed");
    } finally { await f.dispose(); }
  }, 30_000);
});

const movingPreparation = (): HvpMovingCutPreparation => {
  const cells = Array.from({ length: 5 }, (_, x) => ({ x, y: 0, z: 0, materialId: 1 }));
  const source = ingestHvpStructuralCells("pump-body-source", cells,
    [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "wood", destructible: true, tags: null }]);
  return { issuedTick: 1, cells: readHvpBodyCells(source), payload: { sessionId: "pump-session", epoch: 0,
    commandId: "body-cut", ownerId: "hvp:body", sourceId: source.objectId, sourceDigest: source.contentHash,
    revision: source.objectRevision, cellCount: cells.length, massKg: 5, cell: [2, 0, 0], edge: 1, materials: source.materials } };
};

describe("P05 body binary activation", () => {
  it("requests algorithm two through the real compiler/pool and preserves legacy semantic products", async () => {
    const f = compilerFixture(), preparation = movingPreparation();
    try {
      const before = JSON.stringify(preparation), products = await f.compiler.compileBody(preparation);
      expect(f.requests).toHaveLength(1); expect(f.requests[0]!.algorithmVersion).toBe(2);
      expect(f.outputLayouts).toEqual([["metadata", "cells", "positions", "normals", "colors", "indices", "ranges"]]);
      expect(f.detachedInputs).toEqual([true]); expect(JSON.stringify(preparation)).toBe(before);
      const values = new Int32Array(preparation.cells.flatMap(cell => [cell.x, cell.y, cell.z, cell.materialId]));
      const input: TransferableBufferBundle = { ownership: "SenderToWorker", revision: contentRevision(preparation.payload.revision),
        byteLength: byteCount(values.byteLength), buffers: [values.buffer],
        views: [{ name: "cells", kind: "Int32Array", bufferIndex: 0, byteOffset: 0, elementCount: values.length }] };
      const legacy = executeHvpBodyCutJob({ ...f.requests[0]!, algorithmVersion: algorithmVersion(1),
        sourceInputDigest: hvpBodyCutInputDigest(preparation.payload, input.buffers) }, input);
      expect(products).toEqual(decodeHvpBodyCutOutput(legacy.bundle, preparation.payload));
      expect(products.removedCells).toBe(1); expect(products.parts).toHaveLength(2);
    } finally { await f.dispose(); }
  }, 30_000);

  it("does not retry a corrupted binary result as legacy JSON", async () => {
    const f = compilerFixture(); f.controls.corruptOutput = 0;
    try {
      await expect(f.compiler.compileBody(movingPreparation())).rejects.toThrow("Body prepare Failed");
      expect(f.requests).toHaveLength(1); expect(f.requests[0]!.algorithmVersion).toBe(2);
      expect(f.outputLayouts).toHaveLength(1); expect(f.outputLayouts[0]).toHaveLength(7);
      expect(f.compiler.diagnostics()).toMatchObject({ runningJobs: 0, queue: 0 });
    } finally { await f.dispose(); }
  }, 30_000);
});
