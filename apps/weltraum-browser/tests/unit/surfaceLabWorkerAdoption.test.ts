import { describe, expect, it } from "vitest";
import {
  algorithmVersion,
  byteCount,
  contentRevision,
  planningEpoch,
  workerEpoch,
  workerJobId,
  workerTargetKey,
  type TransferableBufferBundle,
  type WorkerResultIntegrationDecision,
  type WorkerJobTerminal
} from "../../src/workers";
import { createContentKey } from "../../src/streaming";
import {
  decideSurfaceLabWorkerAdoption,
  type SurfaceLabWorkerAdoptionContext,
  type SurfaceLabWorkerAdoptionExpectation
} from "../../src/surface-lab/surfaceLabWorkerAdoption";

const expectation: SurfaceLabWorkerAdoptionExpectation = Object.freeze({
  authorityEpoch: 7,
  jobId: workerJobId("surface-lab:7:0:0:0"),
  planningEpoch: planningEpoch(7),
  workerEpoch: workerEpoch(3),
  targetKey: workerTargetKey("target-0-0-0"),
  inputRevision: contentRevision(0),
  outputRevision: contentRevision(7),
  algorithmVersion: algorithmVersion(1),
  sourceInputDigest: "source-a"
});

const completed = (overrides: Record<string, unknown> = {}): WorkerJobTerminal => ({
  kind: "Completed",
  result: {
    jobId: expectation.jobId,
    planningEpoch: expectation.planningEpoch,
    workerEpoch: expectation.workerEpoch,
    targetKey: expectation.targetKey,
    inputRevision: expectation.inputRevision,
    outputRevision: expectation.outputRevision,
    algorithmVersion: expectation.algorithmVersion,
    outputBytes: byteCount(0),
    sourceInputDigest: expectation.sourceInputDigest,
    ...overrides
  },
  output: {} as TransferableBufferBundle
});

const failed = (kind: Exclude<WorkerResultIntegrationDecision["kind"], "Accepted">): WorkerJobTerminal => ({
  kind: "Failed",
  failure: { jobId: expectation.jobId, code: "ProtocolFault", message: "synthetic rejection" },
  integrationDecision: { kind } as WorkerResultIntegrationDecision
});

const context = (overrides: Partial<SurfaceLabWorkerAdoptionContext> = {}): SurfaceLabWorkerAdoptionContext => ({
  currentAuthorityEpoch: expectation.authorityEpoch,
  residency: "Queued",
  sourceResidency: "NotRequested",
  consumed: false,
  cacheResident: true,
  poolAccepted: true,
  ...overrides
});

describe("Surface Lab worker adoption gate", () => {
  it("accepts one current result and rejects a duplicate delivery", () => {
    expect(decideSurfaceLabWorkerAdoption(expectation, completed(), context())).toEqual({ kind: "Accepted" });
    expect(decideSurfaceLabWorkerAdoption(expectation, completed(), context({ consumed: true }))).toEqual({
      kind: "RejectedDuplicateDelivery"
    });
  });

  it.each([
    ["authority", { currentAuthorityEpoch: 8 }, "RejectedStaleAuthorityEpoch"],
    ["foreign job", {}, "RejectedForeignJob"],
    ["planning epoch", {}, "RejectedStalePlanningEpoch"],
    ["worker epoch", {}, "RejectedStaleWorkerEpoch"],
    ["target", {}, "RejectedTargetMismatch"],
    ["revision", {}, "RejectedRevisionMismatch"],
    ["algorithm", {}, "RejectedAlgorithmMismatch"],
    ["source digest", {}, "RejectedSourceInputDigestMismatch"]
  ] as const)("rejects %s before adoption", (_label, contextOverrides, expectedKind) => {
    const resultOverrides = _label === "foreign job"
      ? { jobId: workerJobId("foreign") }
      : _label === "planning epoch"
        ? { planningEpoch: planningEpoch(6) }
        : _label === "worker epoch"
          ? { workerEpoch: workerEpoch(2) }
          : _label === "target"
            ? { targetKey: workerTargetKey("foreign-target") }
            : _label === "revision"
              ? { outputRevision: contentRevision(6) }
              : _label === "algorithm"
                ? { algorithmVersion: algorithmVersion(2) }
                : _label === "source digest"
                  ? { sourceInputDigest: "source-b" }
                  : {};
    expect(decideSurfaceLabWorkerAdoption(expectation, completed(resultOverrides), context(contextOverrides))).toEqual({
      kind: expectedKind
    });
  });

  it("rejects cancelled and evicted residency without a continuation path", () => {
    expect(decideSurfaceLabWorkerAdoption(expectation, { kind: "Cancelled", reason: "CancelledDuringExecution" }, context())).toEqual({
      kind: "RejectedCancelled"
    });
    expect(decideSurfaceLabWorkerAdoption(
      { ...expectation, cacheKey: createContentKey({ namespace: "voxel.brick", contentId: "hestia:0", inputRevision: 0, algorithmVersion: 1, outputRevision: 0 }) },
      completed(),
      context({ sourceResidency: "Evicted", cacheResident: false })
    )).toEqual({ kind: "RejectedEvictedResidency" });
  });

  it("rejects a completed terminal that the pool did not authorize", () => {
    expect(decideSurfaceLabWorkerAdoption(expectation, completed(), context({ poolAccepted: false }))).toEqual({
      kind: "RejectedUnknownPoolTerminal"
    });
  });

  it.each([
    ["unknown", "RejectedUnknownJob", "RejectedUnknownPoolTerminal"],
    ["stale planning", "RejectedStalePlanningEpoch", "RejectedStalePlanningEpoch"],
    ["stale worker", "RejectedStaleWorkerEpoch", "RejectedStaleWorkerEpoch"],
    ["target", "RejectedTargetMismatch", "RejectedTargetMismatch"],
    ["revision", "RejectedRevisionMismatch", "RejectedRevisionMismatch"],
    ["algorithm", "RejectedAlgorithmMismatch", "RejectedAlgorithmMismatch"],
    ["digest", "RejectedSourceInputDigestMismatch", "RejectedSourceInputDigestMismatch"],
    ["layout", "RejectedInvalidLayout", "RejectedInvalidLayout"],
    ["budget", "RejectedOverBudget", "RejectedOverBudget"],
    ["content hash", "RejectedContentHashMismatch", "RejectedContentHashMismatch"]
  ] as const)("preserves the pool rejection classification for %s", (_label, poolKind, expectedKind) => {
    expect(decideSurfaceLabWorkerAdoption(expectation, failed(poolKind), context())).toEqual({ kind: expectedKind });
  });

  it("preserves a pool failure classification over cancelled residency", () => {
    expect(decideSurfaceLabWorkerAdoption(
      expectation,
      failed("RejectedStaleWorkerEpoch"),
      context({ residency: "Cancelled" })
    )).toEqual({ kind: "RejectedStaleWorkerEpoch" });
  });
});
