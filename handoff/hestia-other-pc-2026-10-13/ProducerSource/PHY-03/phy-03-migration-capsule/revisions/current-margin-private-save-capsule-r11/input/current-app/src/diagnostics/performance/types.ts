export const PERFORMANCE_TELEMETRY_VERSION = 1 as const;

export type PerformanceTelemetryVersion = typeof PERFORMANCE_TELEMETRY_VERSION;

export interface LatencySummary {
  readonly sampleCount: number;
  readonly totalMs: number;
  readonly maxMs: number;
  readonly latestMs: number;
}

export interface BrowserPerformanceDiagnostics {
  readonly performanceNowTimestamp?: number;
  readonly heapEstimate?: number;
  readonly longTaskCount?: number;
}

export interface PerformanceTelemetrySnapshot extends BrowserPerformanceDiagnostics {
  readonly version: PerformanceTelemetryVersion;
  readonly resetEpoch: number;
  readonly workerCount: number;
  readonly activeWorkers: number;
  readonly workerRestarts: number;
  readonly queuedJobs: number;
  readonly runningJobs: number;
  readonly completedJobs: number;
  readonly failedJobs: number;
  readonly cancelledJobs: number;
  readonly staleResultsRejected: number;
  readonly inputBytesTransferred: number;
  readonly outputBytesTransferred: number;
  readonly queueLatencyMs: LatencySummary;
  readonly executionLatencyMs: LatencySummary;
  readonly integrationLatencyMs: LatencySummary;
  readonly cacheEntries: number;
  readonly cacheBytes: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheEvictions: number;
  readonly pinnedEntries: number;
  readonly loaderRequests: number;
  readonly loaderDeduplications: number;
  readonly largestObservedQueueDepth: number;
}

export interface CanonicalPerformanceTelemetrySnapshot {
  readonly version: PerformanceTelemetryVersion;
  readonly resetEpoch: number;
  readonly workerCount: number;
  readonly activeWorkers: number;
  readonly workerRestarts: number;
  readonly queuedJobs: number;
  readonly runningJobs: number;
  readonly completedJobs: number;
  readonly failedJobs: number;
  readonly cancelledJobs: number;
  readonly staleResultsRejected: number;
  readonly inputBytesTransferred: number;
  readonly outputBytesTransferred: number;
  readonly cacheEntries: number;
  readonly cacheBytes: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheEvictions: number;
  readonly pinnedEntries: number;
  readonly loaderRequests: number;
  readonly loaderDeduplications: number;
  readonly largestObservedQueueDepth: number;
}

export type PerformanceTelemetrySignature = `fnv1a32:${string}`;

export type PerformanceTelemetryGauge =
  | "workerCount"
  | "activeWorkers"
  | "queuedJobs"
  | "runningJobs"
  | "cacheEntries"
  | "cacheBytes"
  | "pinnedEntries";

export type PerformanceTelemetryCounter =
  | "workerRestarts"
  | "completedJobs"
  | "failedJobs"
  | "cancelledJobs"
  | "staleResultsRejected"
  | "inputBytesTransferred"
  | "outputBytesTransferred"
  | "cacheHits"
  | "cacheMisses"
  | "cacheEvictions"
  | "loaderRequests"
  | "loaderDeduplications";

export type PerformanceLatencyKind = "queue" | "execution" | "integration";
