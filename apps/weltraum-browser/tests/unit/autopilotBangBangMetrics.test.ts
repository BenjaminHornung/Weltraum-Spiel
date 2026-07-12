import { describe, expect, it } from "vitest";
import {
  bangBangFixedStepHz,
  bangBangTransitPhases,
  finiteEvidenceNumber,
  runBangBangTransitScenario
} from "../../src/test-harness/autopilotBangBangMetrics";

const finite = (value: number, label: string): void => {
  expect(Number.isFinite(value), label).toBe(true);
};

describe("bang-bang executor truth metrics", () => {
  it("samples finite 30 Hz phase, gravity, impulse, fuel, thermal, terminal, and hash metrics from controller output", () => {
    const result = runBangBangTransitScenario("crew-sprint-1000m");

    expect(result.classification).toBe("Pass");
    expect(result.fixedStepHz).toBe(30);
    expect(bangBangFixedStepHz).toBe(30);
    expect(result.lockedPlan.stable).toBe(true);
    expect(result.lockedPlan.completed).toBe(result.lockedPlan.before);
    expect(result.signals.replanRequired).toBe(false);
    expect(result.firstArrival.tick).not.toBeNull();
    expect(result.settledTerminal.settlingTicks).toBe(30);

    for (const phase of bangBangTransitPhases) {
      finite(result.phaseDurationsSeconds[phase], phase);
    }
    for (const entry of result.phaseTimeline) {
      finite(entry.durationSeconds, `${entry.phase}.durationSeconds`);
      finite(entry.peakPositiveG, `${entry.phase}.peakPositiveG`);
      finite(entry.peakNegativeG, `${entry.phase}.peakNegativeG`);
      finite(entry.averageAppliedG, `${entry.phase}.averageAppliedG`);
      expect(entry.durationSeconds).toBeCloseTo(entry.sampleCount / 30, 4);
      expect(entry.poweredSeconds).toBeLessThanOrEqual(entry.durationSeconds);
      expect(entry.mainThrustSeconds).toBeLessThanOrEqual(entry.durationSeconds);
      expect(entry.rcsTranslationSeconds).toBeLessThanOrEqual(entry.durationSeconds);
    }

    for (const value of Object.values(result.actualAcceleration)) {
      finite(value, "actualAcceleration");
    }
    for (const value of Object.values(result.actuatorTelemetry)) {
      finite(value, "actuatorTelemetry");
    }
    expect(result.actuatorTelemetry.requestedBurnSamples).toBeGreaterThan(0);
    expect(result.actuatorTelemetry.actualMainThrustSamples).toBeGreaterThan(0);
    expect(result.actuatorTelemetry.flipSamples).toBeGreaterThan(0);
    expect(result.actuatorTelemetry.peakAppliedAccelerationMps2).toBeGreaterThan(0);
    for (const value of Object.values(result.modeledPropulsion)) {
      if (typeof value === "number") {
        finite(value, "modeledPropulsion");
      }
    }
    for (const value of Object.values(result.modeledThermal)) {
      if (typeof value === "number") {
        finite(value, "modeledThermal");
      }
    }
  });

  it("rejects non-finite evidence values instead of coercing them to zero", () => {
    expect(() => finiteEvidenceNumber(Number.NaN, "nan-metric")).toThrow(RangeError);
    expect(() => finiteEvidenceNumber(Number.POSITIVE_INFINITY, "infinite-metric")).toThrow(RangeError);
  });

  it("records coast, flip, capture, and holding as actual actuator output rather than invented gravity", () => {
    const sprint = runBangBangTransitScenario("crew-sprint-1000m");
    const economy = runBangBangTransitScenario("economy-2500m");
    const holding = runBangBangTransitScenario("terminal-holding-no-snap");
    const findPhase = (entries: readonly typeof sprint.phaseTimeline[number][], phase: string) => entries.find((entry) => entry.phase === phase);

    const flip = findPhase(sprint.phaseTimeline, "Flip");
    const coast = findPhase(economy.phaseTimeline, "Coast");
    const terminalCapture = findPhase(sprint.phaseTimeline, "TerminalCapture");
    const holdingEntry = findPhase(holding.phaseTimeline, "Holding");

    expect(flip).toBeDefined();
    expect(flip?.mainThrustSeconds).toBeLessThanOrEqual(flip?.durationSeconds ?? 0);
    expect(coast).toBeDefined();
    expect(coast?.mainThrustSeconds).toBeLessThanOrEqual(coast?.durationSeconds ?? 0);
    expect(terminalCapture).toBeDefined();
    expect(terminalCapture?.poweredSeconds).toBeLessThanOrEqual(terminalCapture?.durationSeconds ?? 0);
    expect(holdingEntry).toBeDefined();
    expect(holdingEntry?.rcsTranslationSeconds).toBeGreaterThan(0);
    expect(holding.firstArrival.finalDistanceMeters).toBeGreaterThan(0);
  });

  it("repeats a fixed-step run byte-for-byte without non-finite values or mutable plan hashes", () => {
    const first = runBangBangTransitScenario("hash-determinism-1000m");
    const second = runBangBangTransitScenario("hash-determinism-1000m");

    expect(first).toEqual(second);
    expect(first.lockedPlan.before).toBe(first.lockedPlan.after);
    expect(first.lockedPlan.completed).toBe(first.lockedPlan.before);
    expect(first.phaseTimeline.map((entry) => entry.phase)).toContain("Flip");
    expect(first.phaseTimeline.map((entry) => entry.phase)).toContain("Holding");
  });
});
