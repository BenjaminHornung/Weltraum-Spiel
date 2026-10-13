import {
  assertTelemetryInteger,
  createCounterValues,
  createGaugeValues,
  incrementCounter,
  saturatingAdd,
  setGauge,
  type CounterValues,
  type GaugeValues
} from "./counters";
import { LatencyAccumulator } from "./timing";
import {
  PERFORMANCE_TELEMETRY_VERSION,
  type BrowserPerformanceDiagnostics,
  type PerformanceLatencyKind,
  type PerformanceTelemetryCounter,
  type PerformanceTelemetryGauge,
  type PerformanceTelemetrySnapshot
} from "./types";

const assertDiagnosticNumber = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`);
  }
  return value;
};

const frozenDiagnostics = (
  diagnostics: BrowserPerformanceDiagnostics
): Readonly<BrowserPerformanceDiagnostics> => {
  const result: { performanceNowTimestamp?: number; heapEstimate?: number; longTaskCount?: number } = {};
  if (diagnostics.performanceNowTimestamp !== undefined) {
    result.performanceNowTimestamp = assertDiagnosticNumber(
      diagnostics.performanceNowTimestamp,
      "performanceNowTimestamp"
    );
  }
  if (diagnostics.heapEstimate !== undefined) {
    result.heapEstimate = assertTelemetryInteger(diagnostics.heapEstimate, "heapEstimate");
  }
  if (diagnostics.longTaskCount !== undefined) {
    result.longTaskCount = assertTelemetryInteger(diagnostics.longTaskCount, "longTaskCount");
  }
  return Object.freeze(result);
};

/**
 * O(1) telemetry event recorder. Event recording never scans payloads. Snapshot
 * creation is O(1) for the fixed schema; consumers decide how often to serialize.
 * Browser clocks are accepted only as explicit diagnostic samples and never read
 * internally, so observations cannot influence scheduling or other domain logic.
 */
export class PerformanceTelemetry {
  private readonly counters: CounterValues = createCounterValues();
  private readonly gauges: GaugeValues = createGaugeValues();
  private readonly queueLatency = new LatencyAccumulator();
  private readonly executionLatency = new LatencyAccumulator();
  private readonly integrationLatency = new LatencyAccumulator();
  private resetEpochValue = 0;
  private largestObservedQueueDepthValue = 0;
  private diagnostics: Readonly<BrowserPerformanceDiagnostics> = Object.freeze({});

  public setGauge(gauge: PerformanceTelemetryGauge, value: number): void {
    setGauge(this.gauges, gauge, value);
    if (gauge === "queuedJobs") {
      this.observeQueueDepth(value);
    }
  }

  public increment(counter: PerformanceTelemetryCounter, amount = 1): void {
    incrementCounter(this.counters, counter, amount);
  }

  public setWorkerState(workerCount: number, activeWorkers: number): void {
    const validatedWorkerCount = assertTelemetryInteger(workerCount, "workerCount");
    const validatedActiveWorkers = assertTelemetryInteger(activeWorkers, "activeWorkers");
    if (validatedActiveWorkers > validatedWorkerCount) {
      throw new RangeError("activeWorkers cannot exceed workerCount.");
    }
    setGauge(this.gauges, "workerCount", validatedWorkerCount);
    setGauge(this.gauges, "activeWorkers", validatedActiveWorkers);
  }

  public setQueueState(queuedJobs: number, runningJobs: number): void {
    const validatedQueuedJobs = assertTelemetryInteger(queuedJobs, "queuedJobs");
    const validatedRunningJobs = assertTelemetryInteger(runningJobs, "runningJobs");
    this.setGauge("queuedJobs", validatedQueuedJobs);
    setGauge(this.gauges, "runningJobs", validatedRunningJobs);
  }

  public setCacheState(cacheEntries: number, cacheBytes: number, pinnedEntries: number): void {
    const validatedCacheEntries = assertTelemetryInteger(cacheEntries, "cacheEntries");
    const validatedCacheBytes = assertTelemetryInteger(cacheBytes, "cacheBytes");
    const validatedPinnedEntries = assertTelemetryInteger(pinnedEntries, "pinnedEntries");
    if (validatedPinnedEntries > validatedCacheEntries) {
      throw new RangeError("pinnedEntries cannot exceed cacheEntries.");
    }
    setGauge(this.gauges, "cacheEntries", validatedCacheEntries);
    setGauge(this.gauges, "cacheBytes", validatedCacheBytes);
    setGauge(this.gauges, "pinnedEntries", validatedPinnedEntries);
  }

  public observeQueueDepth(queueDepth: number): void {
    const value = assertTelemetryInteger(queueDepth, "queueDepth");
    this.largestObservedQueueDepthValue = Math.max(this.largestObservedQueueDepthValue, value);
  }

  public observeLatency(kind: PerformanceLatencyKind, milliseconds: number): void {
    if (kind === "queue") {
      this.queueLatency.observe(milliseconds);
    } else if (kind === "execution") {
      this.executionLatency.observe(milliseconds);
    } else {
      this.integrationLatency.observe(milliseconds);
    }
  }

  public observeQueueLatency(milliseconds: number): void {
    this.queueLatency.observe(milliseconds);
  }

  public observeExecutionLatency(milliseconds: number): void {
    this.executionLatency.observe(milliseconds);
  }

  public observeIntegrationLatency(milliseconds: number): void {
    this.integrationLatency.observe(milliseconds);
  }

  public recordWorkerRestart(amount = 1): void { this.increment("workerRestarts", amount); }
  public recordJobCompleted(amount = 1): void { this.increment("completedJobs", amount); }
  public recordJobFailed(amount = 1): void { this.increment("failedJobs", amount); }
  public recordJobCancelled(amount = 1): void { this.increment("cancelledJobs", amount); }
  public recordStaleResultRejected(amount = 1): void { this.increment("staleResultsRejected", amount); }
  public recordInputBytesTransferred(bytes: number): void { this.increment("inputBytesTransferred", bytes); }
  public recordOutputBytesTransferred(bytes: number): void { this.increment("outputBytesTransferred", bytes); }
  public recordCacheHit(amount = 1): void { this.increment("cacheHits", amount); }
  public recordCacheMiss(amount = 1): void { this.increment("cacheMisses", amount); }
  public recordCacheEviction(amount = 1): void { this.increment("cacheEvictions", amount); }
  public recordLoaderRequest(amount = 1): void { this.increment("loaderRequests", amount); }
  public recordLoaderDeduplication(amount = 1): void { this.increment("loaderDeduplications", amount); }

  public sampleDiagnostics(diagnostics: BrowserPerformanceDiagnostics): void {
    this.diagnostics = frozenDiagnostics(diagnostics);
  }

  public snapshot(): PerformanceTelemetrySnapshot {
    return Object.freeze({
      version: PERFORMANCE_TELEMETRY_VERSION,
      resetEpoch: this.resetEpochValue,
      workerCount: this.gauges.workerCount,
      activeWorkers: this.gauges.activeWorkers,
      workerRestarts: this.counters.workerRestarts,
      queuedJobs: this.gauges.queuedJobs,
      runningJobs: this.gauges.runningJobs,
      completedJobs: this.counters.completedJobs,
      failedJobs: this.counters.failedJobs,
      cancelledJobs: this.counters.cancelledJobs,
      staleResultsRejected: this.counters.staleResultsRejected,
      inputBytesTransferred: this.counters.inputBytesTransferred,
      outputBytesTransferred: this.counters.outputBytesTransferred,
      queueLatencyMs: this.queueLatency.snapshot(),
      executionLatencyMs: this.executionLatency.snapshot(),
      integrationLatencyMs: this.integrationLatency.snapshot(),
      cacheEntries: this.gauges.cacheEntries,
      cacheBytes: this.gauges.cacheBytes,
      cacheHits: this.counters.cacheHits,
      cacheMisses: this.counters.cacheMisses,
      cacheEvictions: this.counters.cacheEvictions,
      pinnedEntries: this.gauges.pinnedEntries,
      loaderRequests: this.counters.loaderRequests,
      loaderDeduplications: this.counters.loaderDeduplications,
      largestObservedQueueDepth: this.largestObservedQueueDepthValue,
      ...this.diagnostics
    });
  }

  public reset(): PerformanceTelemetrySnapshot {
    this.resetEpochValue = saturatingAdd(this.resetEpochValue, 1);
    Object.assign(this.counters, createCounterValues());
    this.largestObservedQueueDepthValue = this.gauges.queuedJobs;
    this.queueLatency.reset();
    this.executionLatency.reset();
    this.integrationLatency.reset();
    this.diagnostics = Object.freeze({});
    return this.snapshot();
  }
}
