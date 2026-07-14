import { describe, expect, it } from "vitest";
import {
  StreamingWorkerRuntime,
  algorithmVersion,
  byteCount,
  contentRevision,
  fnv1aBytes,
  jobDeadline,
  isWorkerToHostMessage,
  planningEpoch,
  snapshotWorkerJobRequest,
  transferListFor,
  validateTransferableBundle,
  validateTransformPayload,
  workerEpoch,
  workerJobId,
  workerJobKind,
  workerTargetKey,
  type TransferableBufferBundle,
  type WorkerJobRequest,
  type WorkerToHostMessage
} from "../../src/workers";

const makeRequest = (bytes: number, chunkBytes = 1024): WorkerJobRequest => ({
  jobId: workerJobId("protocol-job"), jobKind: workerJobKind("TransformBuffer"), targetKey: workerTargetKey("neutral"),
  planningEpoch: planningEpoch(1), workerEpoch: workerEpoch(3), inputRevision: contentRevision(4),
  algorithmVersion: algorithmVersion(2), priority: "Normal", deadline: jobDeadline(10),
  estimatedInputBytes: byteCount(bytes), estimatedOutputBytes: byteCount(bytes),
  payload: { xorMask: 0x5a, chunkBytes, outputRevision: contentRevision(5) }
});

const bundle = (buffer: ArrayBuffer): TransferableBufferBundle => ({
  ownership: "SenderToWorker", revision: contentRevision(4), byteLength: byteCount(buffer.byteLength),
  buffers: [buffer], views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: buffer.byteLength }]
});

describe("worker protocol", () => {
  it("rejects non-string values at stable identifier boundaries", () => {
    expect(() => workerJobId(123 as unknown as string)).toThrow(/stable ASCII identifier/);
    expect(() => workerJobKind({} as unknown as string)).toThrow(/stable ASCII identifier/);
    expect(() => workerTargetKey(true as unknown as string)).toThrow(/stable ASCII identifier/);
  });

  it("validates aligned typed-array byte ranges", () => {
    const valid = validateTransferableBundle({
      ownership: "SenderToWorker", revision: contentRevision(1), byteLength: byteCount(16), buffers: [new ArrayBuffer(16)],
      views: [{ name: "values", bufferIndex: 0, kind: "Uint32Array", byteOffset: 4, elementCount: 3 }]
    });
    expect(valid.views[0]).toMatchObject({ byteOffset: 4, elementCount: 3 });
    expect(() => validateTransferableBundle({ ...valid, views: [{ ...valid.views[0], byteOffset: 2 }] })).toThrow(/aligned/);
    expect(() => validateTransferableBundle({ ...valid, views: [{ ...valid.views[0], elementCount: 4 }] })).toThrow(/exceeds/);
    expect(() => validateTransferableBundle({ ...valid, byteLength: byteCount(15) })).toThrow(/does not match/);
    expect(() => validateTransferableBundle({ ...valid, views: [{ ...valid.views[0], byteOffset: "0" as unknown as number }] })).toThrow(/Invalid view range/);
    expect(() => validateTransferableBundle({ ...valid, views: [{ ...valid.views[0], elementCount: true as unknown as number }] })).toThrow(/Invalid view range/);
  });

  it("rejects duplicate transferable buffer ownership", () => {
    const shared = new ArrayBuffer(8);
    expect(() => validateTransferableBundle({
      ownership: "SenderToWorker", revision: contentRevision(1), byteLength: byteCount(16),
      buffers: [shared, shared], views: []
    })).toThrow(/more than once/);
  });

  it("uses explicit transfer lists that detach the sender buffer", () => {
    const source = new ArrayBuffer(32);
    const input = validateTransferableBundle(bundle(source));
    const cloned = structuredClone(input, { transfer: transferListFor(input) });
    expect(source.byteLength).toBe(0);
    expect(cloned.buffers[0].byteLength).toBe(32);
  });

  it("deeply snapshots requests without mutating caller input", () => {
    const payload = { xorMask: 1, chunkBytes: 2, outputRevision: 3, nested: { value: 4 } };
    const source = { ...makeRequest(4), payload };
    const snapshot = snapshotWorkerJobRequest(source);
    payload.nested.value = 99;
    expect(snapshot.payload).toMatchObject({ nested: { value: 4 } });
    expect(Object.isFrozen(snapshot.payload)).toBe(true);
    expect(Object.isFrozen((snapshot.payload as typeof payload).nested)).toBe(true);
    expect(() => snapshotWorkerJobRequest({
      ...makeRequest(4),
      payload: { createdAt: new Date(0) }
    })).toThrow(/plain records/);
  });

  it("preserves __proto__ as own data without exposing inherited payload fields", () => {
    const payload = JSON.parse('{"__proto__":{"xorMask":90,"chunkBytes":1,"outputRevision":2}}') as Record<string, unknown>;
    const snapshot = snapshotWorkerJobRequest({ ...makeRequest(4), payload });
    expect(Object.prototype.hasOwnProperty.call(snapshot.payload, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(snapshot.payload)).toBeNull();
    expect((snapshot.payload as Record<string, unknown>).xorMask).toBeUndefined();
  });

  it("rejects coerced numeric transform payload fields", () => {
    expect(() => validateTransformPayload({ xorMask: "90", chunkBytes: 1, outputRevision: 2 })).toThrow(/xorMask/);
    expect(() => validateTransformPayload({ xorMask: 90, chunkBytes: true, outputRevision: 2 })).toThrow(/chunkBytes/);
    expect(() => validateTransformPayload({ xorMask: 90, chunkBytes: 1, outputRevision: null })).toThrow(/outputRevision/);
  });

  it("rejects recognized message tags with malformed required fields", () => {
    expect(isWorkerToHostMessage({ type: "WorkerReady" })).toBe(false);
    expect(isWorkerToHostMessage({ type: "JobCancelled", jobId: "job", workerEpoch: 1, reason: "other" })).toBe(false);
    expect(isWorkerToHostMessage({ type: "JobCompleted", result: { jobId: "job" } })).toBe(false);
    expect(isWorkerToHostMessage({
      type: "JobOutputData", jobId: "job", workerEpoch: 1, outputBytes: 4,
      bundle: { ...bundle(new ArrayBuffer(4)), byteLength: 5 }
    })).toBe(false);
  });

  it("rejects a second job while the first accepted job awaits input data", () => {
    const emitted: WorkerToHostMessage[] = [];
    const runtime = new StreamingWorkerRuntime((message) => emitted.push(message));
    const first = makeRequest(4);
    const second = { ...makeRequest(4), jobId: workerJobId("protocol-second"), targetKey: workerTargetKey("neutral-second") };
    runtime.handleMessage({ type: "InitializeWorker", workerEpoch: first.workerEpoch });
    runtime.handleMessage({ type: "EnqueueJob", request: first });
    runtime.handleMessage({ type: "EnqueueJob", request: second });
    expect(emitted).toContainEqual({ type: "JobFailed", failure: expect.objectContaining({ jobId: second.jobId, code: "ProtocolFault" }) });
    expect(emitted.some((message) => message.type === "JobAccepted" && message.jobId === second.jobId)).toBe(false);
  });

  it("runs the neutral transform deterministically", async () => {
    const emitted: WorkerToHostMessage[] = [];
    const runtime = new StreamingWorkerRuntime((message) => emitted.push(message));
    const request = makeRequest(4, 2);
    const buffer = Uint8Array.from([0, 1, 2, 255]).buffer;
    runtime.handleMessage({ type: "InitializeWorker", workerEpoch: request.workerEpoch });
    runtime.handleMessage({ type: "EnqueueJob", request });
    runtime.handleMessage({ type: "JobInputData", jobId: request.jobId, workerEpoch: request.workerEpoch, bundle: bundle(buffer) });
    await expect.poll(() => emitted.some((message) => message.type === "JobCompleted")).toBe(true);
    const outputMessage = emitted.find((message) => message.type === "JobOutputData");
    expect(outputMessage?.type).toBe("JobOutputData");
    if (outputMessage?.type === "JobOutputData") {
      expect([...new Uint8Array(outputMessage.bundle.buffers[0])]).toEqual([0x5a, 0x5b, 0x58, 0xa5]);
      expect(outputMessage.bundle.contentHash).toBe(fnv1aBytes(outputMessage.bundle.buffers));
    }
    expect(emitted.at(-1)?.type).toBe("JobCompleted");
  });

  it("cooperatively cancels running work and emits no result", async () => {
    const emitted: WorkerToHostMessage[] = [];
    const runtime = new StreamingWorkerRuntime((message) => emitted.push(message));
    const request = makeRequest(256 * 1024, 1024);
    runtime.handleMessage({ type: "InitializeWorker", workerEpoch: request.workerEpoch });
    runtime.handleMessage({ type: "EnqueueJob", request });
    runtime.handleMessage({ type: "JobInputData", jobId: request.jobId, workerEpoch: request.workerEpoch, bundle: bundle(new ArrayBuffer(256 * 1024)) });
    runtime.handleMessage({ type: "CancelJob", jobId: request.jobId, workerEpoch: request.workerEpoch });
    await expect.poll(() => emitted.some((message) => message.type === "JobCancelled")).toBe(true);
    expect(emitted.some((message) => message.type === "JobOutputData" || message.type === "JobCompleted")).toBe(false);
  });
});
