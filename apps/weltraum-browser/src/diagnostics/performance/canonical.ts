import { fnv1aHash } from "../../core/hash";
import type {
  CanonicalPerformanceTelemetrySnapshot,
  PerformanceTelemetrySignature,
  PerformanceTelemetrySnapshot
} from "./types";

export const canonicalizePerformanceTelemetrySnapshot = (
  snapshot: PerformanceTelemetrySnapshot
): CanonicalPerformanceTelemetrySnapshot => Object.freeze({
  version: snapshot.version,
  resetEpoch: snapshot.resetEpoch,
  workerCount: snapshot.workerCount,
  activeWorkers: snapshot.activeWorkers,
  workerRestarts: snapshot.workerRestarts,
  queuedJobs: snapshot.queuedJobs,
  runningJobs: snapshot.runningJobs,
  completedJobs: snapshot.completedJobs,
  failedJobs: snapshot.failedJobs,
  cancelledJobs: snapshot.cancelledJobs,
  staleResultsRejected: snapshot.staleResultsRejected,
  inputBytesTransferred: snapshot.inputBytesTransferred,
  outputBytesTransferred: snapshot.outputBytesTransferred,
  cacheEntries: snapshot.cacheEntries,
  cacheBytes: snapshot.cacheBytes,
  cacheHits: snapshot.cacheHits,
  cacheMisses: snapshot.cacheMisses,
  cacheEvictions: snapshot.cacheEvictions,
  pinnedEntries: snapshot.pinnedEntries,
  loaderRequests: snapshot.loaderRequests,
  loaderDeduplications: snapshot.loaderDeduplications,
  largestObservedQueueDepth: snapshot.largestObservedQueueDepth
});

export const serializeCanonicalPerformanceTelemetrySnapshot = (
  snapshot: PerformanceTelemetrySnapshot
): string => JSON.stringify(canonicalizePerformanceTelemetrySnapshot(snapshot));

export const createPerformanceTelemetrySignature = (
  snapshot: PerformanceTelemetrySnapshot
): PerformanceTelemetrySignature =>
  `fnv1a32:${fnv1aHash(serializeCanonicalPerformanceTelemetrySnapshot(snapshot))}`;
