import type { MemoryContentCacheObserver } from "../../streaming";
import type { WorkerPoolEvent } from "../../workers";
import type { WorkerJobId } from "../../workers/ids";
import { PerformanceTelemetry } from "./snapshots";

/** Projects WorkerPool events into diagnostics without feeding data back into scheduling. */
export const createWorkerPoolTelemetryObserver = (
  telemetry: PerformanceTelemetry,
  workerCount: number,
): ((event: WorkerPoolEvent) => void) => {
  if (!Number.isSafeInteger(workerCount) || workerCount <= 0) throw new RangeError("workerCount must be a positive safe integer.");
  const queued = new Set<WorkerJobId>();
  const running = new Set<WorkerJobId>();
  telemetry.setWorkerState(workerCount, 0);

  const updateQueueState = (): void => telemetry.setQueueState(queued.size, running.size);
  return (event): void => {
    switch (event.type) {
      case "Queued":
        queued.add(event.jobId);
        telemetry.observeQueueDepth(event.queueDepth);
        break;
      case "Dispatched":
        queued.delete(event.jobId);
        running.add(event.jobId);
        telemetry.recordInputBytesTransferred(event.inputBytes);
        break;
      case "OutputTransferred":
        telemetry.recordOutputBytesTransferred(event.outputBytes);
        return;
      case "Completed":
        queued.delete(event.jobId);
        running.delete(event.jobId);
        telemetry.recordJobCompleted();
        if (event.executionDurationMs !== undefined) telemetry.observeExecutionLatency(event.executionDurationMs);
        break;
      case "Cancelled":
        queued.delete(event.jobId);
        running.delete(event.jobId);
        telemetry.recordJobCancelled();
        break;
      case "Failed":
        queued.delete(event.jobId);
        running.delete(event.jobId);
        telemetry.recordJobFailed();
        break;
      case "StaleResultRejected":
        telemetry.recordStaleResultRejected();
        return;
      case "WorkerRestarted":
        telemetry.recordWorkerRestart();
        return;
      case "WorkerStateChanged":
        telemetry.setWorkerState(event.workerCount, event.activeWorkers);
        return;
    }
    updateQueueState();
  };
};

/** Projects cache ownership events into counters and gauges; it never reads cache payload bytes. */
export const createMemoryContentCacheTelemetryObserver = (
  telemetry: PerformanceTelemetry,
): MemoryContentCacheObserver => {
  let entries = 0;
  let bytes = 0;
  let pinnedEntries = 0;
  const updateCacheState = (): void => telemetry.setCacheState(entries, bytes, pinnedEntries);
  return (event): void => {
    switch (event.kind) {
      case "Hit":
        telemetry.recordCacheHit();
        return;
      case "Miss":
        telemetry.recordCacheMiss();
        return;
      case "Admitted":
        entries += 1;
        bytes += event.byteLength;
        break;
      case "Evicted":
        entries = Math.max(0, entries - 1);
        bytes = Math.max(0, bytes - event.byteLength);
        telemetry.recordCacheEviction();
        break;
      case "Pinned":
        pinnedEntries += 1;
        break;
      case "Unpinned":
        pinnedEntries = Math.max(0, pinnedEntries - 1);
        break;
      case "Cleared":
        entries = 0;
        bytes = 0;
        pinnedEntries = 0;
        break;
    }
    updateCacheState();
  };
};
