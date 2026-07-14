import type { PerformanceTelemetryCounter, PerformanceTelemetryGauge } from "./types";

export const MAX_TELEMETRY_VALUE = Number.MAX_SAFE_INTEGER;

export const assertTelemetryInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
  return value;
};

export const saturatingAdd = (current: number, increment: number): number => {
  assertTelemetryInteger(current, "current telemetry value");
  assertTelemetryInteger(increment, "telemetry increment");
  return increment > MAX_TELEMETRY_VALUE - current ? MAX_TELEMETRY_VALUE : current + increment;
};

export type CounterValues = Record<PerformanceTelemetryCounter, number>;
export type GaugeValues = Record<PerformanceTelemetryGauge, number>;

export const createCounterValues = (): CounterValues => ({
  workerRestarts: 0,
  completedJobs: 0,
  failedJobs: 0,
  cancelledJobs: 0,
  staleResultsRejected: 0,
  inputBytesTransferred: 0,
  outputBytesTransferred: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheEvictions: 0,
  loaderRequests: 0,
  loaderDeduplications: 0
});

export const createGaugeValues = (): GaugeValues => ({
  workerCount: 0,
  activeWorkers: 0,
  queuedJobs: 0,
  runningJobs: 0,
  cacheEntries: 0,
  cacheBytes: 0,
  pinnedEntries: 0
});

export const incrementCounter = (
  counters: CounterValues,
  counter: PerformanceTelemetryCounter,
  amount = 1
): void => {
  counters[counter] = saturatingAdd(counters[counter], amount);
};

export const setGauge = (gauges: GaugeValues, gauge: PerformanceTelemetryGauge, value: number): void => {
  gauges[gauge] = assertTelemetryInteger(value, gauge);
};
