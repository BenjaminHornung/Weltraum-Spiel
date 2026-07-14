import { describe, expect, it } from "vitest";
import {
  MAX_TELEMETRY_VALUE,
  PerformanceTelemetry,
  canonicalizePerformanceTelemetrySnapshot,
  createPerformanceTelemetrySignature
} from "../../src/diagnostics/performance";

describe("PerformanceTelemetry", () => {
  it("counts jobs, transfers, cache, loader and queue depth", () => {
    const telemetry = new PerformanceTelemetry();
    telemetry.setWorkerState(2, 1);
    telemetry.setQueueState(3, 1);
    telemetry.recordWorkerRestart();
    telemetry.recordJobCompleted(2);
    telemetry.recordJobFailed();
    telemetry.recordJobCancelled();
    telemetry.recordStaleResultRejected();
    telemetry.recordInputBytesTransferred(256);
    telemetry.recordOutputBytesTransferred(128);
    telemetry.setCacheState(2, 384, 1);
    telemetry.recordCacheHit();
    telemetry.recordCacheMiss(2);
    telemetry.recordCacheEviction();
    telemetry.recordLoaderRequest(3);
    telemetry.recordLoaderDeduplication();

    expect(telemetry.snapshot()).toMatchObject({
      workerCount: 2, activeWorkers: 1, workerRestarts: 1, queuedJobs: 3, runningJobs: 1,
      completedJobs: 2, failedJobs: 1, cancelledJobs: 1, staleResultsRejected: 1,
      inputBytesTransferred: 256, outputBytesTransferred: 128,
      cacheEntries: 2, cacheBytes: 384, pinnedEntries: 1,
      cacheHits: 1, cacheMisses: 2, cacheEvictions: 1,
      loaderRequests: 3, loaderDeduplications: 1, largestObservedQueueDepth: 3
    });
  });

  it("keeps diagnostics and timings out of canonical snapshots", () => {
    const a = new PerformanceTelemetry();
    const b = new PerformanceTelemetry();
    a.recordJobCompleted();
    b.recordJobCompleted();
    a.observeQueueLatency(10);
    b.observeQueueLatency(999);
    a.sampleDiagnostics({ performanceNowTimestamp: 10, heapEstimate: 20, longTaskCount: 1 });
    b.sampleDiagnostics({ performanceNowTimestamp: 99, heapEstimate: 200, longTaskCount: 9 });

    expect(canonicalizePerformanceTelemetrySnapshot(a.snapshot())).toEqual(
      canonicalizePerformanceTelemetrySnapshot(b.snapshot())
    );
    expect(createPerformanceTelemetrySignature(a.snapshot())).toBe(createPerformanceTelemetrySignature(b.snapshot()));
  });

  it("resets counters and diagnostics while preserving gauges", () => {
    const telemetry = new PerformanceTelemetry();
    telemetry.setWorkerState(2, 2);
    telemetry.setQueueState(4, 1);
    telemetry.setCacheState(1, 64, 1);
    telemetry.recordJobCompleted();
    telemetry.observeExecutionLatency(3);
    telemetry.sampleDiagnostics({ performanceNowTimestamp: 2 });
    const reset = telemetry.reset();
    expect(reset).toMatchObject({
      resetEpoch: 1, workerCount: 2, activeWorkers: 2, queuedJobs: 4, runningJobs: 1,
      cacheEntries: 1, cacheBytes: 64, pinnedEntries: 1, completedJobs: 0,
      largestObservedQueueDepth: 4, executionLatencyMs: { sampleCount: 0 }
    });
    expect(reset).not.toHaveProperty("performanceNowTimestamp");
  });

  it("saturates counters and freezes snapshots", () => {
    const telemetry = new PerformanceTelemetry();
    telemetry.recordInputBytesTransferred(MAX_TELEMETRY_VALUE);
    telemetry.recordInputBytesTransferred(1);
    const snapshot = telemetry.snapshot();
    expect(snapshot.inputBytesTransferred).toBe(MAX_TELEMETRY_VALUE);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.queueLatencyMs)).toBe(true);
  });
});
