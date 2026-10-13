export interface BoundedFrameWindowOptions {
  readonly capacity: number;
  readonly minimumSamples?: number;
  readonly minimumDurationMs?: number;
  readonly maximumGapMs?: number;
}

export interface FrameWindowInput {
  readonly timestampMs: number;
  readonly frameTimeMs: number;
  readonly cpuTimeMs?: number | null;
  readonly gpuTimeMs?: number | null;
  readonly gpuDisjoint?: boolean;
  readonly visible: boolean;
  readonly warmed: boolean;
  readonly valid: boolean;
  readonly backendGeneration: number | string;
}

export interface FrameWindowSnapshot {
  readonly sequence: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly frameP50Ms: number;
  readonly frameP95Ms: number;
  readonly cpuP95Ms: number | null;
  readonly gpuP95Ms: number | null;
  readonly visible: true;
  readonly warmed: true;
  readonly valid: true;
  readonly eligible: boolean;
}

interface StoredSample {
  readonly timestampMs: number;
  readonly frameTimeMs: number;
  readonly cpuTimeMs: number | null;
  readonly gpuTimeMs: number | null;
}

const MAX_CAPACITY = 300;
const DEFAULT_MINIMUM_SAMPLES = 30;
const DEFAULT_MINIMUM_DURATION_MS = 400;
const DEFAULT_MAXIMUM_GAP_MS = 1_000;

const validTimer = (value: number | null | undefined): number | null =>
  value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null;

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
};

export class BoundedFrameWindow {
  private readonly capacity: number;
  private readonly minimumSamples: number;
  private readonly minimumDurationMs: number;
  private readonly maximumGapMs: number;
  private samples: StoredSample[] = [];
  private lastTimestampMs: number | undefined;
  private backendGeneration: number | string | undefined;
  private nextSequence = 1;

  constructor(options: BoundedFrameWindowOptions) {
    const capacity = options.capacity;
    const minimumSamples = options.minimumSamples ?? DEFAULT_MINIMUM_SAMPLES;
    const minimumDurationMs = options.minimumDurationMs ?? DEFAULT_MINIMUM_DURATION_MS;
    const maximumGapMs = options.maximumGapMs ?? DEFAULT_MAXIMUM_GAP_MS;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY ||
        !Number.isInteger(minimumSamples) || minimumSamples < 1 || minimumSamples > capacity ||
        !Number.isFinite(minimumDurationMs) || minimumDurationMs <= 0 ||
        !Number.isFinite(maximumGapMs) || maximumGapMs <= 0) {
      throw new RangeError("Frame window bounds must be finite and capacity must be between 1 and 300.");
    }
    this.capacity = capacity;
    this.minimumSamples = minimumSamples;
    this.minimumDurationMs = minimumDurationMs;
    this.maximumGapMs = maximumGapMs;
  }

  push(input: FrameWindowInput): boolean {
    const timestampValid = Number.isFinite(input.timestampMs) && input.timestampMs >= 0;
    const frameValid = Number.isFinite(input.frameTimeMs) && input.frameTimeMs > 0;
    const generationValid =
      (typeof input.backendGeneration === "number" && Number.isFinite(input.backendGeneration)) ||
      (typeof input.backendGeneration === "string" && input.backendGeneration.length > 0);

    if (!timestampValid || !frameValid || !generationValid ||
        input.valid !== true || input.visible !== true || input.warmed !== true ||
        input.gpuDisjoint === true) {
      this.clearSamples(true);
      if (timestampValid && (this.lastTimestampMs === undefined || input.timestampMs > this.lastTimestampMs)) {
        this.lastTimestampMs = input.timestampMs;
      }
      return false;
    }

    if (this.backendGeneration !== undefined && input.backendGeneration !== this.backendGeneration) {
      this.clearSamples(true);
    }
    if (this.lastTimestampMs !== undefined && input.timestampMs <= this.lastTimestampMs) {
      this.clearSamples(true);
      return false;
    }
    if (this.lastTimestampMs !== undefined && input.timestampMs - this.lastTimestampMs > this.maximumGapMs) {
      this.clearSamples(true);
    }

    this.lastTimestampMs = input.timestampMs;
    this.backendGeneration = input.backendGeneration;
    this.samples.push({
      timestampMs: input.timestampMs,
      frameTimeMs: input.frameTimeMs,
      cpuTimeMs: validTimer(input.cpuTimeMs),
      gpuTimeMs: validTimer(input.gpuTimeMs)
    });
    if (this.samples.length > this.capacity) this.samples.shift();
    return true;
  }

  snapshot(): FrameWindowSnapshot | null {
    if (this.samples.length === 0) return null;
    const frames = this.samples.map(sample => sample.frameTimeMs);
    const cpu = this.samples.map(sample => sample.cpuTimeMs);
    const gpu = this.samples.map(sample => sample.gpuTimeMs);
    const startMs = this.samples[0]!.timestampMs;
    const endMs = this.samples[this.samples.length - 1]!.timestampMs;
    const sampleCount = this.samples.length;
    const durationMs = endMs - startMs;
    return Object.freeze({
      sequence: this.nextSequence,
      startMs,
      endMs,
      durationMs,
      sampleCount,
      frameP50Ms: percentile(frames, 0.5),
      frameP95Ms: percentile(frames, 0.95),
      cpuP95Ms: cpu.every((value): value is number => value !== null) ? percentile(cpu, 0.95) : null,
      gpuP95Ms: gpu.every((value): value is number => value !== null) ? percentile(gpu, 0.95) : null,
      visible: true,
      warmed: true,
      valid: true,
      eligible: sampleCount >= this.minimumSamples && durationMs >= this.minimumDurationMs
    });
  }

  take(): FrameWindowSnapshot | null {
    const snapshot = this.snapshot();
    if (snapshot === null || !snapshot.eligible) return null;
    this.nextSequence += 1;
    this.clearSamples();
    return snapshot;
  }

  reset(): void {
    this.clearSamples(true);
    this.lastTimestampMs = undefined;
    this.backendGeneration = undefined;
  }

  private clearSamples(breakContinuity = false): void {
    if (breakContinuity) this.nextSequence += 1;
    this.samples = [];
  }
}
