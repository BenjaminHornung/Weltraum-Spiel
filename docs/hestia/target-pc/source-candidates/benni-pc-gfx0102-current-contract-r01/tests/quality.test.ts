import { describe, expect, it } from "vitest";
import fixture from "../fixtures/quality-sequences.json";
import {
  decideQuality,
  INITIAL_QUALITY_CONTROLLER_STATE,
  type QualityMetrics,
  type DesiredQuality,
  type CurrentQuality
} from "../src/quality";

type Scenario = {
  id: string;
  desired?: Partial<DesiredQuality>;
  current?: Partial<CurrentQuality>;
  windows: Array<Partial<QualityMetrics> & Pick<QualityMetrics, "sequence" | "startMs" | "endMs">>;
  expected: Array<{
    quality: [number, number];
    action: string;
    reason: string;
    slowWindows: number;
    reserveWindows: number;
  }>;
};

const defaults = fixture.defaults as {
  desired: DesiredQuality;
  current: CurrentQuality;
  metrics: Omit<QualityMetrics, "sequence" | "startMs" | "endMs">;
};

const run = (scenario: Scenario) => {
  const desired = { ...defaults.desired, ...scenario.desired };
  let current = { ...defaults.current, ...scenario.current };
  let state = { ...INITIAL_QUALITY_CONTROLLER_STATE };
  return scenario.windows.map(window => {
    const metrics = {
      ...defaults.metrics,
      sequence: window.sequence,
      startMs: window.startMs,
      endMs: window.endMs,
      ...window
    } as QualityMetrics;
    const result = decideQuality(metrics, desired, current, state);
    current = result.quality;
    state = result.state;
    return {
      quality: [result.quality.renderScale, result.quality.maxDevicePixelRatio],
      action: result.action,
      reason: result.reason,
      slowWindows: result.state.slowWindows,
      reserveWindows: result.state.reserveWindows
    };
  });
};

describe("adaptive quality golden sequences", () => {
  for (const scenario of fixture.scenarios as Scenario[]) {
    it(scenario.id, () => {
      expect(run(scenario)).toEqual(scenario.expected);
    });
  }

  it("replays an identical sequence deterministically", () => {
    const scenario = (fixture.scenarios as Scenario[]).find(value => value.id === "sustained-gpu")!;
    expect(run(scenario)).toEqual(run(scenario));
  });

  it("raises render scale only after DPR has no remaining headroom", () => {
    const scenario: Scenario = {
      id: "scale-after-dpr",
      current: { renderScale: 1, maxDevicePixelRatio: 2 },
      windows: Array.from({ length: 8 }, (_, index) => ({
        sequence: index + 1,
        startMs: index * 500,
        endMs: (index + 1) * 500,
        frameP95Ms: 10,
        cpuP95Ms: 6,
        gpuP95Ms: 5
      })),
      expected: []
    };
    const decisions = run(scenario);
    expect(decisions.slice(0, 7).every(value => value.action === "hold")).toBe(true);
    expect(decisions[7]).toEqual({
      quality: [1.1, 2],
      action: "increase-render-scale",
      reason: "sustained-reserve",
      slowWindows: 0,
      reserveWindows: 0
    });
  });

  it("holds repeated, overlapping, backward, short, and stale windows", () => {
    let state = { ...INITIAL_QUALITY_CONTROLLER_STATE };
    const desired = defaults.desired;
    const current = defaults.current;
    const window = (sequence: number, startMs: number, endMs: number): QualityMetrics => ({
      ...defaults.metrics,
      sequence, startMs, endMs,
      frameP95Ms: 20,
      cpuP95Ms: 5,
      gpuP95Ms: 16
    });
    const first = decideQuality(window(1, 0, 500), desired, current, state);
    state = first.state;
    expect(first.state.slowWindows).toBe(1);
    const duplicate = decideQuality(window(1, 500, 1000), desired, current, state);
    expect(duplicate.action).toBe("hold");
    expect(duplicate.reason).toBe("repeated-or-out-of-order-window");
    expect(duplicate.state.slowWindows).toBe(0);
    const overlapping = decideQuality(window(2, 400, 900), desired, current, duplicate.state);
    expect(overlapping.reason).toBe("repeated-or-out-of-order-window");
    const backwards = decideQuality(window(3, 200, 700), desired, current, overlapping.state);
    expect(backwards.reason).toBe("repeated-or-out-of-order-window");
    const tooShort = decideQuality(window(4, 1000, 1300), desired, current, backwards.state);
    expect(tooShort.reason).toBe("ineligible-window");
    expect(tooShort.state.slowWindows).toBe(0);
  });

  it("resets streaks when desired limits change and rejects a repeated frozen window", () => {
    const overload = (sequence: number, startMs: number): QualityMetrics => ({
      ...defaults.metrics,
      sequence,
      startMs,
      endMs: startMs + 500,
      frameP95Ms: 20,
      cpuP95Ms: 5,
      gpuP95Ms: 16
    });
    const first = decideQuality(overload(1, 0), defaults.desired, defaults.current, { ...INITIAL_QUALITY_CONTROLLER_STATE });
    const second = decideQuality(overload(2, 500), defaults.desired, defaults.current, first.state);
    const changed = decideQuality(
      overload(3, 1000),
      { ...defaults.desired, minRenderScale: 0.6 },
      defaults.current,
      second.state
    );
    expect(changed.action).toBe("hold");
    expect(changed.state.slowWindows).toBe(1);

    const frozenMetrics = { ...overload(4, 1500), referenceFrozen: true };
    const frozen = decideQuality(frozenMetrics, defaults.desired, defaults.current, changed.state);
    const duplicate = decideQuality(frozenMetrics, defaults.desired, defaults.current, frozen.state);
    expect(frozen.reason).toBe("reference-frozen");
    expect(duplicate.reason).toBe("repeated-or-out-of-order-window");
  });

  it("requires valid timers, positive finite manual values, and a real window", () => {
    const desired = defaults.desired;
    const current = defaults.current;
    const valid = {
      ...defaults.metrics,
      sequence: 1,
      startMs: 0,
      endMs: 500
    } satisfies QualityMetrics;
    const noCpu = decideQuality({ ...valid, cpuP95Ms: null }, desired, current, { ...INITIAL_QUALITY_CONTROLLER_STATE });
    expect(noCpu.reason).toBe("missing-sensor");
    const badMetric = decideQuality({ ...valid, valid: false }, desired, current, { ...INITIAL_QUALITY_CONTROLLER_STATE });
    expect(badMetric.reason).toBe("invalid-window");
    expect(() => decideQuality(valid, { ...desired, minRenderScale: 0 }, current, { ...INITIAL_QUALITY_CONTROLLER_STATE })).toThrow();
    expect(() => decideQuality(valid, desired, { ...current, renderScale: Number.NaN }, { ...INITIAL_QUALITY_CONTROLLER_STATE })).toThrow();
  });

  it("does not count overload from adjacent frames without a 400 ms, 30-sample window", () => {
    const metrics = {
      ...defaults.metrics,
      sequence: 1,
      startMs: 0,
      endMs: 30,
      sampleCount: 3,
      frameP95Ms: 20,
      cpuP95Ms: 5,
      gpuP95Ms: 16
    };
    const result = decideQuality(metrics, defaults.desired, defaults.current, { ...INITIAL_QUALITY_CONTROLLER_STATE });
    expect(result.action).toBe("hold");
    expect(result.reason).toBe("ineligible-window");
  });
});
