import { describe, expect, it } from "vitest";
import { runAutopilotProvingGroundMatrix } from "../../src/test-harness/scenarioRunner";

const finiteMetricNames = [
  "tick",
  "simulatedSeconds",
  "targetDistance",
  "averageSpeed",
  "peakSpeed",
  "finalSpeed",
  "finalDistance",
  "settledSpeed",
  "settledDistance",
  "settlingTicks",
  "minObstacleClearance",
  "fuelUsed",
  "fuelReserveRemaining",
  "terminalCaptureTicks",
  "holdingTicks"
] as const;

describe("autopilot course runner metrics", () => {
  it("emits finite metrics and preserves locked/completed plan hashes", () => {
    const results = runAutopilotProvingGroundMatrix("Balanced");

    for (const result of results) {
      for (const metricName of finiteMetricNames) {
        expect(Number.isFinite(result[metricName]), `${result.courseId}.${metricName}`).toBe(true);
      }

      expect(result.planHashAfter).toBe(result.planHashBefore);
      if (result.completedPlanHash !== null) {
        expect(result.completedPlanHash).toBe(result.planHashBefore);
      }
      expect(result.routeLifecycle === null || typeof result.routeLifecycle === "string").toBe(true);
      expect(typeof result.stationKeepingActive).toBe("boolean");
      expect(typeof result.holdingActive).toBe("boolean");
    }
  });

  it("does not let Pass courses violate final distance or terminal speed", () => {
    const passResults = runAutopilotProvingGroundMatrix("Balanced").filter((result) => result.expectedOutcome === "Pass");

    expect(passResults.length).toBeGreaterThan(0);
    for (const result of passResults) {
      expect(result.classification, result.courseId).toBe("Pass");
      expect(result.status, result.courseId).toBe("Arrived");
      expect(result.finalDistance, result.courseId).toBeLessThanOrEqual(3);
      expect(result.finalSpeed, result.courseId).toBeLessThanOrEqual(0.5);
      expect(result.terminalSpeedLimit, result.courseId).toBeLessThanOrEqual(0.5);
    }
  });
});
