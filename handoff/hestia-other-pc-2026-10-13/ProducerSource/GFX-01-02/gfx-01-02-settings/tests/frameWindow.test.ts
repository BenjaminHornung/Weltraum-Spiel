import { describe, expect, it } from "vitest";
import { BoundedFrameWindow } from "../src/frameWindow";

const sample = (index: number, overrides: Partial<Parameters<BoundedFrameWindow["push"]>[0]> = {}) => ({
  timestampMs: index * (500 / 30),
  frameTimeMs: 16,
  cpuTimeMs: 6,
  gpuTimeMs: 5,
  visible: true,
  warmed: true,
  valid: true,
  backendGeneration: 1,
  ...overrides
});

describe("BoundedFrameWindow", () => {
  it("emits actual p50/p95 metrics and consumes non-overlapping windows", () => {
    const window = new BoundedFrameWindow({ capacity: 300, minimumSamples: 30, minimumDurationMs: 400 });
    for (let index = 0; index < 31; index++) window.push(sample(index, { frameTimeMs: index + 1 }));
    const first = window.snapshot();
    expect(first).toMatchObject({ sequence: 1, sampleCount: 31, startMs: 0, eligible: true });
    expect(first?.endMs).toBeCloseTo(500);
    expect(first?.frameP50Ms).toBe(16);
    expect(first?.frameP95Ms).toBe(30);
    expect(window.take()).toEqual(first);
    expect(window.snapshot()).toBeNull();

    for (let index = 0; index < 31; index++) window.push(sample(index + 31));
    expect(window.take()).toMatchObject({ sequence: 2, startMs: 31 * (500 / 30) });
  });

  it("bounds samples at 300 and never treats missing or disjoint timers as zero", () => {
    const window = new BoundedFrameWindow({ capacity: 300, minimumSamples: 30, minimumDurationMs: 400 });
    for (let index = 0; index < 330; index++) {
      window.push(sample(index, { cpuTimeMs: null, gpuTimeMs: null }));
    }
    expect(window.snapshot()).toMatchObject({ sampleCount: 300, cpuP95Ms: null, gpuP95Ms: null, eligible: true });
    window.push(sample(330, { gpuDisjoint: true }));
    expect(window.snapshot()).toBeNull();
  });

  it("resets across invalid, hidden, warmup, backend, long-gap and backward-time boundaries", () => {
    for (const boundary of [
      { valid: false },
      { visible: false },
      { warmed: false },
      { backendGeneration: 2 }
    ]) {
      const window = new BoundedFrameWindow({ capacity: 300, minimumSamples: 30, minimumDurationMs: 400 });
      window.push(sample(0));
      window.push(sample(1, boundary));
      expect(window.snapshot()?.sampleCount).toBe(boundary.valid === false || boundary.visible === false || boundary.warmed === false ? undefined : 1);
    }

    const gap = new BoundedFrameWindow({ capacity: 300, minimumSamples: 30, minimumDurationMs: 400 });
    gap.push(sample(0));
    gap.push(sample(100, { timestampMs: 2000 }));
    expect(gap.snapshot()?.sampleCount).toBe(1);

    const backwards = new BoundedFrameWindow({ capacity: 300, minimumSamples: 30, minimumDurationMs: 400 });
    backwards.push(sample(2));
    backwards.push(sample(1));
    expect(backwards.snapshot()).toBeNull();
  });

  it("rejects non-finite, zero, negative, non-monotone, and invalid configuration inputs", () => {
    const window = new BoundedFrameWindow({ capacity: 30, minimumSamples: 30, minimumDurationMs: 400 });
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      window.push(sample(0, { frameTimeMs: invalid }));
      expect(window.snapshot()).toBeNull();
    }
    expect(() => new BoundedFrameWindow({ capacity: 301 })).toThrow();
    expect(() => new BoundedFrameWindow({ capacity: 0 })).toThrow();
    expect(() => new BoundedFrameWindow({ capacity: 10, minimumSamples: 11 })).toThrow();
  });
});
