import { describe, expect, it } from "vitest";
import { planHashFor, stableStringify } from "../../src/core";
import { runScenario, runScenarioMatrix } from "../../src/test-harness/scenarioRunner";
import { scenarioCatalog } from "../../src/test-harness/scenarios";

const authorityModes = ["Manual", "Assisted", "Autopilot"];

describe("browser proving-ground scenario matrix", () => {
  it("defines every required deterministic browser proving-ground scenario", () => {
    expect(scenarioCatalog.map((scenario) => scenario.id)).toEqual([
      "direct-local-arrival",
      "obstacle-avoidance-route",
      "insufficient-fuel",
      "no-authority",
      "off-route-divergence",
      "locked-plan-hash-preservation",
      "explicit-replan-required-signal"
    ]);
  });

  it("passes the complete scenario matrix without silent replans", () => {
    const results = runScenarioMatrix();

    expect(results).toHaveLength(7);
    expect(results.every((result) => result.classification === "PASS")).toBe(true);
    for (const result of results) {
      expect(result.planHashAfter).toBe(result.planHashBefore);
      expect(result.initialFuel).toEqual(expect.any(Number));
      expect(result.finalFuel).toEqual(expect.any(Number));
      expect(result.fuelUsed).toEqual(expect.any(Number));
      expect(result.finalSpeed).toEqual(expect.any(Number));
      expect(authorityModes).toContain(result.authority.mode);
      expect(result.authority.mainThrusters).toEqual(expect.any(Boolean));
      expect(result.authority.rcs).toEqual(expect.any(Boolean));
      expect(result.authority.autopilot).toEqual(expect.any(Boolean));
      expect(result.brakingReserve).toEqual(
        expect.objectContaining({
          autopilotAvailable: expect.any(Boolean),
          mainThrustersAvailable: expect.any(Boolean),
          fuelAvailable: expect.any(Boolean),
          canBrake: expect.any(Boolean)
        })
      );
    }
  });

  it("reports direct local arrival through the harness", () => {
    const result = runScenario("direct-local-arrival");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("Arrived");
    expect(result.replanRequired).toBe(false);
  });

  it("reports obstacle avoidance route selection", () => {
    const result = runScenario("obstacle-avoidance-route");

    expect(result.classification).toBe("PASS");
    expect(result.segmentKinds).toContain("Avoidance");
    expect(result.replanRequired).toBe(false);
  });

  it("reports insufficient fuel without replacing the locked plan", () => {
    const result = runScenario("insufficient-fuel");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("OutOfFuel");
    expect(result.invalidationReasons).toContain("FuelDepleted");
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(result.initialFuel).toBe(0);
    expect(result.finalFuel).toBe(0);
    expect(result.fuelUsed).toBe(0);
    expect(result.finalSpeed).toBe(0);
    expect(result.brakingReserve.canBrake).toBe(false);
    expect(result.brakingReserve.fuelAvailable).toBe(false);
  });

  it("reports missing authority without replacing the locked plan", () => {
    const result = runScenario("no-authority");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("NoAuthority");
    expect(result.invalidationReasons).toContain("AuthorityUnavailable");
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(result.authority.autopilot).toBe(false);
    expect(result.brakingReserve.autopilotAvailable).toBe(false);
    expect(result.brakingReserve.canBrake).toBe(false);
  });

  it("reports off-route divergence as an explicit replan requirement", () => {
    const result = runScenario("off-route-divergence");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("Diverged");
    expect(result.replanRequired).toBe(true);
    expect(result.invalidationReasons).toContain("OffLockedRoute");
  });

  it("preserves plan hashes across stable serialization", () => {
    const result = runScenario("locked-plan-hash-preservation");

    expect(result.classification).toBe("PASS");
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(stableStringify({ hash: result.planHashBefore })).toContain(result.planHashBefore);
    expect(planHashFor({ id: result.id, planHash: "ignored" })).toBe(planHashFor({ id: result.id }));
  });

  it("keeps explicit replan-required signaling separate from replanning", () => {
    const result = runScenario("explicit-replan-required-signal");

    expect(result.classification).toBe("PASS");
    expect(result.replanRequired).toBe(true);
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(result.invalidationReasons).toEqual(["OffLockedRoute"]);
  });
});
