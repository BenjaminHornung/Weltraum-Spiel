import { describe, expect, it } from "vitest";
import { planHashFor, stableStringify } from "../../src/core";
import { evaluateAutopilotProvingGroundCourseResult, runAutopilotProvingGroundCourse, runAutopilotProvingGroundMatrix, runScenario, runScenarioMatrix } from "../../src/test-harness/scenarioRunner";
import { scenarioCatalog } from "../../src/test-harness/scenarios";
import { autopilotProvingGroundCourses, getAutopilotProvingGroundCourse } from "../../src/world/autopilotProvingGroundCourses";
import { createShipState } from "../../src/world/provingGroundWorld";

const authorityModes = ["Manual", "Assisted", "Autopilot"];

describe("browser proving-ground scenario matrix", () => {
  it("defines every required deterministic browser proving-ground scenario", () => {
    expect(scenarioCatalog.map((scenario) => scenario.id)).toEqual([
      "direct-local-arrival",
      "obstacle-avoidance-route",
      "insufficient-fuel",
      "no-authority",
      "no-main-thrusters",
      "brake-reserve-insufficient",
      "off-route-divergence",
      "locked-plan-hash-preservation",
      "explicit-replan-required-signal"
    ]);
  });

  it("passes the complete scenario matrix without silent replans", () => {
    const results = runScenarioMatrix();

    expect(results).toHaveLength(9);
    expect(results.every((result) => result.classification === "PASS")).toBe(true);
    for (const result of results) {
      expect(result.planHashAfter).toBe(result.planHashBefore);
      expect(["Waypoint", "Point"]).toContain(result.targetKind);
      expect(result.arrivalEnvelope.radius).toEqual(expect.any(Number));
      expect(result.routeValidation.ok).toBe(true);
      expect(result.routeValidation.issues).toEqual(expect.any(Array));
      expect(result.routeScore).toEqual(
        expect.objectContaining({
          distance: expect.any(Number),
          segmentCount: expect.any(Number),
          clearanceRisk: expect.any(Number),
          fuelCostEstimate: expect.any(Number),
          authorityRisk: expect.any(Number),
          total: expect.any(Number),
          reasons: expect.any(Array)
        })
      );
      expect(result.initialMass).toEqual(expect.any(Number));
      expect(result.finalMass).toEqual(expect.any(Number));
      expect(result.initialFuel).toEqual(expect.any(Number));
      expect(result.finalFuel).toEqual(expect.any(Number));
      expect(result.fuelUsed).toEqual(expect.any(Number));
      expect(result.finalSpeed).toEqual(expect.any(Number));
      expect(result.finalPosition).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }));
      expect(result.targetPosition).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }));
      expect(result.failureReasonCodes).toEqual(expect.any(Array));
      expect(result.routeValid).toEqual(expect.any(Boolean));
      expect(authorityModes).toContain(result.authority.mode);
      expect(result.authority.mainThrustersAvailable).toEqual(expect.any(Boolean));
      expect(result.authority.rcsAvailable).toEqual(expect.any(Boolean));
      expect(result.authority.autopilotAvailable).toEqual(expect.any(Boolean));
      expect(result.brakingReserve).toEqual(
        expect.objectContaining({
          requiredDeltaV: expect.any(Number),
          availableDeltaV: expect.any(Number),
          reasonCodes: expect.any(Array),
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
    expect(result.finalPosition).not.toEqual(result.targetPosition);
    expect(result.distanceToTarget).toBeLessThanOrEqual(result.arrivalEnvelope.radius);
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
    expect(result.failureReasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "FuelDepleted"]));
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(result.initialFuel).toBe(0);
    expect(result.finalFuel).toBe(0);
    expect(result.fuelUsed).toBe(0);
    expect(result.finalSpeed).toBe(0);
    expect(result.brakingReserve.canBrake).toBe(false);
  });

  it("reports missing authority without replacing the locked plan", () => {
    const result = runScenario("no-authority");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("NoAuthority");
    expect(result.invalidationReasons).toContain("AutopilotUnavailable");
    expect(result.failureReasonCodes).toContain("AutopilotUnavailable");
    expect(result.planHashAfter).toBe(result.planHashBefore);
    expect(result.authority.autopilotAvailable).toBe(false);
    expect(result.brakingReserve.canBrake).toBe(false);
  });

  it("reports no main thrusters as a braking reserve blocker", () => {
    const result = runScenario("no-main-thrusters");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("NoAuthority");
    expect(result.failureReasonCodes).toContain("MainThrustersUnavailable");
    expect(result.brakingReserve.reasonCodes).toContain("MainThrustersUnavailable");
    expect(result.brakingReserve.canBrake).toBe(false);
  });

  it("reports brake reserve insufficiency as a visible route blocker", () => {
    const result = runScenario("brake-reserve-insufficient");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("BrakeReserveInsufficient");
    expect(result.replanRequired).toBe(true);
    expect(result.failureReasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "BrakeReserveInsufficient"]));
    expect(result.brakingReserve.reasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "BrakeReserveInsufficient"]));
    expect(result.brakingReserve.canBrake).toBe(false);
  });

  it("reports off-route divergence as an explicit replan requirement", () => {
    const result = runScenario("off-route-divergence");

    expect(result.classification).toBe("PASS");
    expect(result.status).toBe("Diverged");
    expect(result.replanRequired).toBe(true);
    expect(result.invalidationReasons).toContain("OffLockedRoute");
    expect(result.failureReasonCodes).toContain("OffLockedRoute");
    expect(result.routeValid).toBe(false);
    expect(result.finalFuel).toBe(result.initialFuel);
    expect(result.fuelUsed).toBe(0);
    expect(result.finalSpeed).toBe(0);
  });

  it("recomputes owner mass instead of trusting createShipState mass overrides", () => {
    const ship = createShipState({ mass: { dryMass: 1_500, cargoMass: 25, fuelMass: 999, totalMass: 1 } });

    expect(ship.mass.dryMass).toBe(1_500);
    expect(ship.mass.cargoMass).toBe(25);
    expect(ship.mass.fuelMass).toBe(ship.fuel.current);
    expect(ship.mass.totalMass).toBe(ship.mass.dryMass + (ship.mass.cargoMass ?? 0) + ship.fuel.current);
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
    expect(result.failureReasonCodes).toContain("OffLockedRoute");
    expect(result.routeValid).toBe(false);
  });

  it("defines the browser-native proving-ground v2 course catalog", () => {
    expect(autopilotProvingGroundCourses.map((course) => course.id)).toEqual([
      "direct-long",
      "s-curve-obstacles",
      "narrow-corridor",
      "offset-gates",
      "target-behind-obstacle",
      "target-near-obstacle",
      "high-initial-speed",
      "lateral-initial-velocity",
      "low-authority-terminal",
      "low-fuel-long-route",
      "off-route-disturbance-midcourse"
    ]);
    expect(autopilotProvingGroundCourses.every((course) => course.target.arrivalEnvelope.stopBehavior === "StopWithinEnvelope")).toBe(true);
    expect(autopilotProvingGroundCourses.every((course) => course.target.arrivalEnvelope.terminalSpeed === 0.5)).toBe(true);
  });

  it("runs the v2 proving-ground matrix without treating KnownStress or ExpectedFail as suite failures", () => {
    const results = runAutopilotProvingGroundMatrix("Balanced");

    expect(results).toHaveLength(11);
    expect(Object.fromEntries(results.map((result) => [result.courseId, result.classification]))).toEqual({
      "direct-long": "Pass",
      "s-curve-obstacles": "KnownStress",
      "narrow-corridor": "KnownStress",
      "offset-gates": "Pass",
      "target-behind-obstacle": "Pass",
      "target-near-obstacle": "Pass",
      "high-initial-speed": "Pass",
      "lateral-initial-velocity": "Pass",
      "low-authority-terminal": "Pass",
      "low-fuel-long-route": "ExpectedFail",
      "off-route-disturbance-midcourse": "ExpectedFail"
    });
    expect(results.every((result) => result.planHashBefore === result.planHashAfter || result.planHashBefore === null)).toBe(true);
    for (const result of results) {
      expect(result.profile).toBe("Balanced");
      expect(typeof result.peakSpeed).toBe("number");
      expect(typeof result.finalSpeed).toBe("number");
      expect(typeof result.finalDistance).toBe("number");
      expect(typeof result.minObstacleClearance).toBe("number");
      expect(typeof result.fuelUsed).toBe("number");
      expect(typeof result.arrivalPhase).toBe("string");
      expect(Array.isArray(result.notes)).toBe(true);
      expect(result.notes.join(" ")).toContain("closest sampled ship position");
    }
  });

  it("makes Balanced measurably faster than Safe on direct-long while preserving terminal capture", () => {
    const safe = runAutopilotProvingGroundCourse("direct-long", "Safe");
    const balanced = runAutopilotProvingGroundCourse("direct-long", "Balanced");

    expect(safe.classification).toBe("Pass");
    expect(balanced.classification).toBe("Pass");
    expect(balanced.ticksToArrival).toEqual(expect.any(Number));
    expect(safe.ticksToArrival).toEqual(expect.any(Number));
    expect(balanced.ticksToArrival as number).toBeLessThan(safe.ticksToArrival as number);
    expect(balanced.peakSpeed).toBeGreaterThan(safe.peakSpeed);
    expect(balanced.finalSpeed).toBeLessThanOrEqual(0.5);
    expect(safe.finalSpeed).toBeLessThanOrEqual(0.5);
    expect(balanced.planHashBefore).not.toBe(safe.planHashBefore);
  });

  it("measures obstacle clearance independently from rendering", () => {
    const result = runAutopilotProvingGroundCourse("target-behind-obstacle", "Balanced");

    expect(result.classification).toBe("Pass");
    expect(result.minObstacleClearance).toBeGreaterThanOrEqual(0);
    expect(result.segmentKinds).toContain("Avoidance");
    expect(result.notes.join(" ")).toContain("Obstacle clearance uses closest sampled ship position");
  });

  it("keeps KnownStress courses visible without failing the suite", () => {
    const result = runAutopilotProvingGroundCourse("narrow-corridor", "Balanced");

    expect(result.classification).toBe("KnownStress");
    expect(result.notes.join(" ")).toContain("one-obstacle");
    expect(result.planHashAfter).toBe(result.planHashBefore);
  });

  it("fails ExpectedFail classification when the expected failure signal or reason is absent", () => {
    const course = getAutopilotProvingGroundCourse("low-fuel-long-route");
    const result = runAutopilotProvingGroundCourse("low-fuel-long-route", "Balanced");

    expect(result.classification).toBe("ExpectedFail");

    const evaluation = evaluateAutopilotProvingGroundCourseResult(course, {
      ...result,
      status: "Arrived",
      replanRequired: false,
      failureReasonCodes: [],
      invalidationReasons: []
    });

    expect(evaluation.classification).toBe("Fail");
    expect(evaluation.notes.join(" ")).toContain("Expected a failure or replan signal");
    expect(evaluation.notes.join(" ")).toContain("FuelInsufficient");
  });

  it("fails KnownStress classification when terminal or locked-plan hard invariants are violated", () => {
    const course = getAutopilotProvingGroundCourse("narrow-corridor");
    const result = runAutopilotProvingGroundCourse("narrow-corridor", "Balanced");

    expect(result.classification).toBe("KnownStress");

    const terminalGateEvaluation = evaluateAutopilotProvingGroundCourseResult(course, {
      ...result,
      status: "Arrived",
      ticksToArrival: result.tick,
      finalDistance: course.acceptance.maxFinalDistance,
      finalSpeed: course.acceptance.maxFinalSpeed + 0.1
    });
    const planHashEvaluation = evaluateAutopilotProvingGroundCourseResult(course, { ...result, planHashAfter: `${result.planHashBefore ?? "plan"}-changed` });

    expect(terminalGateEvaluation.classification).toBe("Fail");
    expect(terminalGateEvaluation.notes.join(" ")).toContain("Arrived final speed");
    expect(planHashEvaluation.classification).toBe("Fail");
    expect(planHashEvaluation.notes.join(" ")).toContain("Locked plan hash changed");
  });
});
