import { describe, expect, it } from "vitest";
import { runBangBangTransitScenario } from "../../src/test-harness/autopilotBangBangMetrics";

const scenarioIdFor = (policy: "crew-comfort" | "crew-sprint" | "economy", distance: 500 | 1000 | 2500) =>
  `${policy}-${distance}m` as const;

describe("bang-bang transit policy comparisons", () => {
  it.each([500, 1000, 2500] as const)("compares CrewComfort, CrewSprint, and Economy at %im", (distance) => {
    const comfort = runBangBangTransitScenario(scenarioIdFor("crew-comfort", distance));
    const sprint = runBangBangTransitScenario(scenarioIdFor("crew-sprint", distance));
    const economy = runBangBangTransitScenario(scenarioIdFor("economy", distance));

    for (const result of [comfort, sprint, economy]) {
      expect(result.classification, result.scenarioId).toBe("Pass");
      expect(result.status, result.scenarioId).toBe("Arrived");
      expect(result.targetDistanceMeters, result.scenarioId).toBe(distance);
      expect(result.firstArrival.finalDistanceMeters, result.scenarioId).toBeLessThanOrEqual(3);
      expect(result.firstArrival.finalSpeedMps, result.scenarioId).toBeLessThanOrEqual(0.5);
      expect(result.lockedPlan.stable, result.scenarioId).toBe(true);
      expect(result.signals.replanRequired, result.scenarioId).toBe(false);
    }

    expect((sprint.firstArrival.simulatedSeconds ?? Number.MAX_VALUE)).toBeLessThan(comfort.firstArrival.simulatedSeconds ?? 0);
    expect((economy.firstArrival.simulatedSeconds ?? 0)).toBeGreaterThan(sprint.firstArrival.simulatedSeconds ?? Number.MAX_VALUE);
    expect(economy.peakSpeedMps).toBeLessThan(sprint.peakSpeedMps);
    expect(economy.modeledPropulsion.totalDeltaVMps).toBeLessThan(sprint.modeledPropulsion.totalDeltaVMps);
    expect(economy.modeledPropulsion.impulseNewtonSeconds).toBeLessThan(sprint.modeledPropulsion.impulseNewtonSeconds);
    expect(economy.modeledPropulsion.actualFuelUsedKg).toBeLessThan(sprint.modeledPropulsion.actualFuelUsedKg);
    expect(economy.modeledPropulsion.throttleEfficiencyClaim).toBe(false);
  });

  it("keeps high-thrust human Sprint at its finite human cap while a drone uses higher finite physical authority", () => {
    const human = runBangBangTransitScenario("human-sprint-high-thrust-1000m");
    const drone = runBangBangTransitScenario("drone-sprint-high-g-1000m");

    expect(human.classification).toBe("Pass");
    expect(drone.classification).toBe("Pass");
    expect(human.actualAcceleration.peakAppliedG).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(human.actualAcceleration.aboveHumanMaximumSeconds).toBe(0);
    expect(drone.physicalLimits.maximumHumanG).toBeNull();
    expect(drone.actualAcceleration.peakAppliedG).toBeGreaterThan(human.actualAcceleration.peakAppliedG);
    expect(drone.actualAcceleration.peakAppliedG).toBeGreaterThan(1.5);
    expect(drone.actualAcceleration.peakAppliedAccelerationMps2).toBeLessThanOrEqual(drone.physicalLimits.sustainedThermalMaxAccelerationMps2 + 1e-6);
  });

  it("fails an underpowered CrewComfort route before actuation instead of inventing comfort gravity", () => {
    const result = runBangBangTransitScenario("underpowered-crew-comfort-1000m");

    expect(result.classification).toBe("ExpectedFail");
    expect(result.status).toBe("NoAuthority");
    expect(result.actualAcceleration.belowComfortMainBurnSeconds).toBe(0);
    expect(result.actualAcceleration.peakAppliedAccelerationMps2).toBe(0);
    expect(result.actualAcceleration.aboveHumanMaximumSeconds).toBe(0);
    expect(result.modeledPropulsion.totalDeltaVMps).toBe(0);
    expect(result.modeledPropulsion.impulseNewtonSeconds).toBe(0);
    expect(result.modeledPropulsion.actualFuelUsedKg).toBe(0);
    expect(result.signals.replanRequired).toBe(true);
    expect(result.signals.failureReasonCodes).toEqual(["ComfortAccelerationUnavailable"]);
    expect(result.signals.invalidationReasons).toEqual(["ComfortAccelerationUnavailable"]);
  });
});
