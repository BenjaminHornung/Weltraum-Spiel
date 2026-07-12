import { describe, expect, it } from "vitest";
import { ObstacleAvoidanceLocalPlanner } from "../../src/core";
import {
  bangBangTransitScenarioCatalog,
  getBangBangTransitScenario,
  runBangBangTransitScenario,
  runBangBangTransitScenarioMatrix
} from "../../src/test-harness/autopilotBangBangMetrics";

describe("bang-bang proving-ground safety scenarios", () => {
  it("declares exactly the required deterministic 22-scenario matrix", () => {
    expect(bangBangTransitScenarioCatalog).toHaveLength(22);
    expect(new Set(bangBangTransitScenarioCatalog.map((scenario) => scenario.id)).size).toBe(22);
    expect(bangBangTransitScenarioCatalog.map((scenario) => scenario.id)).toEqual(expect.arrayContaining([
      "crew-comfort-500m",
      "crew-sprint-1000m",
      "economy-2500m",
      "drone-sprint-high-g-1000m",
      "underpowered-crew-comfort-1000m",
      "low-rcs-attitude-expected-fail",
      "single-obstacle-corner-1000m",
      "sharp-corner-geometry-1000m",
      "terminal-holding-no-snap",
      "hash-determinism-1000m",
      "no-silent-replan-1000m"
    ]));
  });

  it("keeps no-RCS finite-attitude, thrust, fuel, braking, and divergence negatives fail-closed", () => {
    const expectedFailures = [
      "low-rcs-attitude-expected-fail",
      "no-main-thruster-expected-fail",
      "low-fuel-expected-fail",
      "brake-reserve-expected-fail",
      "off-route-expected-fail"
    ] as const;

    for (const id of expectedFailures) {
      const result = runBangBangTransitScenario(id);
      const expectedCodes = getBangBangTransitScenario(id).expectation.expectedFailureReasonCodes ?? [];
      const observedCodes = [...result.signals.failureReasonCodes, ...result.signals.invalidationReasons];

      expect(result.classification, id).toBe("ExpectedFail");
      expect(result.lockedPlan.stable, id).toBe(true);
      expect(result.signals.replanRequired, id).toBe(true);
      expect(observedCodes, id).toEqual(expect.arrayContaining([...expectedCodes]));
    }
  });

  it("does not grant low-RCS ships fake attitude thrust or a world-space bypass", () => {
    const result = runBangBangTransitScenario("low-rcs-attitude-expected-fail");

    expect(result.status).toBe("NoAuthority");
    expect(result.signals.failureReasonCodes).toContain("AuthorityInsufficient");
    expect(result.actualAcceleration.peakAppliedG).toBe(0);
    expect(result.modeledPropulsion.impulseNewtonSeconds).toBe(0);
    expect(result.lockedPlan.before).toBe(result.lockedPlan.after);
  });

  it("keeps obstacle and sharp-corner scenarios geometry-aware, clear, terminal-gated, and locked", () => {
    const singleObstacle = runBangBangTransitScenario("single-obstacle-corner-1000m");
    const sharpCorner = runBangBangTransitScenario("sharp-corner-geometry-1000m");

    for (const result of [singleObstacle, sharpCorner]) {
      expect(result.classification, result.scenarioId).toBe("Pass");
      expect(result.minObstacleClearanceMeters, result.scenarioId).toBeGreaterThanOrEqual(0);
      expect(result.firstArrival.finalDistanceMeters, result.scenarioId).toBeLessThanOrEqual(3);
      expect(result.firstArrival.finalSpeedMps, result.scenarioId).toBeLessThanOrEqual(0.5);
      expect(result.lockedPlan.stable, result.scenarioId).toBe(true);
      expect(result.signals.replanRequired, result.scenarioId).toBe(false);
    }

    const scenario = getBangBangTransitScenario("sharp-corner-geometry-1000m");
    const plan = new ObstacleAvoidanceLocalPlanner().plan({
      tick: 0,
      ship: scenario.initialShip,
      target: scenario.target,
      obstacles: scenario.obstacles,
      transitPolicy: scenario.transitPolicy
    });
    expect(plan.segments.length).toBeGreaterThan(1);
    expect(plan.segments.some((segment) => segment.motionConstraint?.turnConstraint.kind === "Corner")).toBe(true);
  });

  it("keeps no-snap terminal holding and proves a disturbed locked plan stays latched instead of silently replanning", () => {
    const holding = runBangBangTransitScenario("terminal-holding-no-snap");
    const noReplan = runBangBangTransitScenario("no-silent-replan-1000m");

    expect(holding.classification).toBe("Pass");
    expect(holding.signals.holdingObserved).toBe(true);
    expect(holding.firstArrival.finalDistanceMeters).toBeGreaterThan(0);
    expect(holding.settledTerminal.distanceMeters).toBeGreaterThan(0);
    expect(holding.lockedPlan.completed).toBe(holding.lockedPlan.before);
    expect(noReplan.classification).toBe("ExpectedFail");
    expect(noReplan.status).toBe("Diverged");
    expect(noReplan.signals.replanRequired).toBe(true);
    expect(noReplan.signals.invalidationReasons).toContain("OffLockedRoute");
    expect(noReplan.signals.latchedFailureObserved).toBe(true);
    expect(noReplan.lockedPlan.before).toBe(noReplan.lockedPlan.after);
    expect(noReplan.lockedPlan.completed).toBeNull();
  });

  it("makes every declared row classify as its finite declared outcome", () => {
    const results = runBangBangTransitScenarioMatrix();

    expect(results).toHaveLength(22);
    expect(results.filter((result) => result.classification !== result.expectedOutcome)).toEqual([]);
    expect(results.every((result) => result.lockedPlan.stable)).toBe(true);
  });
});
