import { MAX_TELEMETRY_VALUE, saturatingAdd } from "./counters";
import type { LatencySummary } from "./types";

const assertLatency = (milliseconds: number): number => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError("Latency observations must be finite non-negative milliseconds.");
  }
  return Math.min(milliseconds, MAX_TELEMETRY_VALUE);
};

export class LatencyAccumulator {
  private sampleCountValue = 0;
  private totalMsValue = 0;
  private maxMsValue = 0;
  private latestMsValue = 0;

  public observe(milliseconds: number): void {
    const value = assertLatency(milliseconds);
    this.sampleCountValue = saturatingAdd(this.sampleCountValue, 1);
    this.totalMsValue = Math.min(MAX_TELEMETRY_VALUE, this.totalMsValue + value);
    this.maxMsValue = Math.max(this.maxMsValue, value);
    this.latestMsValue = value;
  }

  public snapshot(): LatencySummary {
    return Object.freeze({
      sampleCount: this.sampleCountValue,
      totalMs: this.totalMsValue,
      maxMs: this.maxMsValue,
      latestMs: this.latestMsValue
    });
  }

  public reset(): void {
    this.sampleCountValue = 0;
    this.totalMsValue = 0;
    this.maxMsValue = 0;
    this.latestMsValue = 0;
  }
}
