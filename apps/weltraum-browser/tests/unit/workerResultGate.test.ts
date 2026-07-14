import { describe, expect, it } from "vitest";
import {
  algorithmVersion,
  byteCount,
  contentRevision,
  fnv1aBytes,
  integrateWorkerResult,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerTargetKey,
  type TransferableBufferBundle,
  type WorkerJobResult,
  type WorkerResultExpectation
} from "../../src/workers";

const buffer = Uint8Array.from([1, 2, 3, 4]).buffer;
const hash = fnv1aBytes([buffer]);
const output = (): TransferableBufferBundle => ({
  ownership: "WorkerToConsumer", revision: contentRevision(2), byteLength: byteCount(4), buffers: [buffer.slice(0)],
  views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array", byteOffset: 0, elementCount: 4 }], contentHash: hash
});
const expectation: WorkerResultExpectation = {
  jobId: workerJobId("gate"), cancelled: false, planningEpoch: planningEpoch(3), workerEpoch: workerEpoch(4),
  targetKey: workerTargetKey("target"), inputRevision: contentRevision(1), outputRevision: contentRevision(2),
  algorithmVersion: algorithmVersion(5), maximumOutputBytes: byteCount(4), expectedContentHash: hash
};
const result: WorkerJobResult = {
  jobId: expectation.jobId, planningEpoch: expectation.planningEpoch, workerEpoch: expectation.workerEpoch,
  targetKey: expectation.targetKey, inputRevision: expectation.inputRevision, outputRevision: expectation.outputRevision,
  algorithmVersion: expectation.algorithmVersion, outputBytes: byteCount(4), contentHash: hash
};

describe("worker result integration gate", () => {
  it("accepts a matching validated result", () => {
    expect(integrateWorkerResult(expectation, result, output()).kind).toBe("Accepted");
  });

  it("rejects unknown and cancelled jobs first", () => {
    expect(integrateWorkerResult(undefined, result, output()).kind).toBe("RejectedUnknownJob");
    expect(integrateWorkerResult({ ...expectation, cancelled: true }, result, output()).kind).toBe("RejectedCancelled");
  });

  it("rejects stale planning and worker epochs", () => {
    expect(integrateWorkerResult(expectation, { ...result, planningEpoch: planningEpoch(2) }, output()).kind)
      .toBe("RejectedStalePlanningEpoch");
    expect(integrateWorkerResult(expectation, { ...result, workerEpoch: workerEpoch(3) }, output()).kind)
      .toBe("RejectedStaleWorkerEpoch");
  });

  it("preserves revision and algorithm ordering before complete layout validation", () => {
    const malformed = { ...output(), byteLength: byteCount(99) };
    expect(integrateWorkerResult(expectation, { ...result, inputRevision: contentRevision(9) }, malformed).kind)
      .toBe("RejectedRevisionMismatch");
    expect(integrateWorkerResult(expectation, { ...result, algorithmVersion: algorithmVersion(9) }, malformed).kind)
      .toBe("RejectedAlgorithmMismatch");
    expect(integrateWorkerResult(expectation, result, malformed).kind).toBe("RejectedInvalidLayout");

    const missingRevision = { ...output(), revision: undefined } as unknown as TransferableBufferBundle;
    expect(() => integrateWorkerResult(expectation, result, missingRevision)).not.toThrow();
    expect(integrateWorkerResult(expectation, result, missingRevision).kind).toBe("RejectedInvalidLayout");
  });

  it("rejects invalid layouts and oversized outputs", () => {
    const invalid = { ...output(), views: [{ name: "bad", bufferIndex: 0, kind: "Uint32Array" as const, byteOffset: 2, elementCount: 1 }] };
    expect(integrateWorkerResult(expectation, result, invalid).kind).toBe("RejectedInvalidLayout");
    expect(integrateWorkerResult({ ...expectation, maximumOutputBytes: byteCount(3) }, result, output()).kind)
      .toBe("RejectedOverBudget");
  });

  it("rejects content hash mismatches", () => {
    expect(integrateWorkerResult({ ...expectation, expectedContentHash: "deadbeef" }, result, output()).kind)
      .toBe("RejectedContentHashMismatch");
  });
});
