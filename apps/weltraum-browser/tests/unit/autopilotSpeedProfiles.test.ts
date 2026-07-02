import { describe, expect, it } from "vitest";
import { runAutopilotProvingGroundCourse } from "../../src/test-harness/scenarioRunner";

const comparableMetrics = (courseId: "direct-long-stop" | "direct-medium-stop" | "direct-very-long-stop", profile: "Safe" | "Balanced" | "Fast") => {
  const result = runAutopilotProvingGroundCourse(courseId, profile);
  return {
    classification: result.classification,
    ticksToArrival: result.ticksToArrival,
    simulatedSeconds: result.simulatedSeconds,
    averageSpeed: result.averageSpeed,
    targetDistance: result.targetDistance,
    peakSpeed: result.peakSpeed,
    finalSpeed: result.finalSpeed,
    finalDistance: result.finalDistance,
    settledSpeed: result.settledSpeed,
    settledDistance: result.settledDistance,
    settlingTicks: result.settlingTicks,
    planHashBefore: result.planHashBefore,
    planHashAfter: result.planHashAfter
  };
};

describe("autopilot speed profile course metrics", () => {
  it("uses the catalog speed profile when no explicit override is supplied", () => {
    const safeDefault = runAutopilotProvingGroundCourse("direct-long-safe");
    const fastDefault = runAutopilotProvingGroundCourse("direct-long-fast");
    const explicitBalanced = runAutopilotProvingGroundCourse("direct-long-safe", "Balanced");

    expect(safeDefault.catalogSpeedProfile).toBe("Safe");
    expect(safeDefault.profile).toBe("Safe");
    expect(fastDefault.catalogSpeedProfile).toBe("Fast");
    expect(fastDefault.profile).toBe("Fast");
    expect(explicitBalanced.catalogSpeedProfile).toBe("Safe");
    expect(explicitBalanced.profile).toBe("Balanced");
  });

  it("runs Safe, Balanced, and Fast deterministically on a long direct stop", () => {
    for (const profile of ["Safe", "Balanced", "Fast"] as const) {
      expect(comparableMetrics("direct-long-stop", profile)).toEqual(comparableMetrics("direct-long-stop", profile));
    }
  });

  it("keeps Balanced faster than Safe on two long-range direct distances", () => {
    for (const courseId of ["direct-medium-stop", "direct-long-stop"] as const) {
      const safe = runAutopilotProvingGroundCourse(courseId, "Safe");
      const balanced = runAutopilotProvingGroundCourse(courseId, "Balanced");

      expect(safe.classification).toBe("Pass");
      expect(balanced.classification).toBe("Pass");
      expect(balanced.ticksToArrival).toEqual(expect.any(Number));
      expect(safe.ticksToArrival).toEqual(expect.any(Number));
      expect(balanced.ticksToArrival as number).toBeLessThan(safe.ticksToArrival as number);
      expect(balanced.averageSpeed).toBeGreaterThan(safe.averageSpeed);
      expect(balanced.finalSpeed).toBeLessThanOrEqual(0.5);
      expect(safe.finalSpeed).toBeLessThanOrEqual(0.5);
    }
  });

  it("exercises the 2500m direct tier across Safe, Balanced, and Fast", () => {
    const safe = runAutopilotProvingGroundCourse("direct-very-long-stop", "Safe");
    const balanced = runAutopilotProvingGroundCourse("direct-very-long-stop", "Balanced");
    const fast = runAutopilotProvingGroundCourse("direct-very-long-stop", "Fast");

    for (const result of [safe, balanced, fast]) {
      expect(result.targetDistance, `${result.profile} targetDistance`).toBeCloseTo(2_500, 4);
      expect(result.classification, result.profile).toBe("Pass");
      expect(result.status, result.profile).toBe("Arrived");
      expect(result.finalDistance, result.profile).toBeLessThanOrEqual(3);
      expect(result.finalSpeed, result.profile).toBeLessThanOrEqual(result.terminalSpeedLimit ?? 0.5);
      expect(result.finalSpeed, `${result.profile} first-arrival finalSpeed`).toEqual(expect.any(Number));
      expect(result.settlingTicks, `${result.profile} settlingTicks`).toBe(30);
      expect(result.settledDistance, `${result.profile} settledDistance`).toEqual(expect.any(Number));
      expect(result.settledSpeed, `${result.profile} settledSpeed`).toEqual(expect.any(Number));
      expect(result.replanRequired, result.profile).toBe(false);
      expect(result.failureReasonCodes, result.profile).toEqual([]);
      expect(result.invalidationReasons, result.profile).toEqual([]);
      expect(result.planHashAfter, result.profile).toBe(result.planHashBefore);
    }

    expect(fast.finalSpeed).toBeLessThanOrEqual(fast.terminalSpeedLimit ?? 0.5);
    expect(fast.settledSpeed).toBeLessThanOrEqual(0.45);
    expect(fast.settledSpeed).toBeLessThanOrEqual(fast.finalSpeed);
    expect(balanced.ticksToArrival as number).toBeLessThan(safe.ticksToArrival as number);
    expect(fast.ticksToArrival as number).toBeLessThanOrEqual(balanced.ticksToArrival as number);
    expect(balanced.averageSpeed).toBeGreaterThan(safe.averageSpeed);
    expect(fast.averageSpeed).toBeGreaterThanOrEqual(balanced.averageSpeed);
  });
});
