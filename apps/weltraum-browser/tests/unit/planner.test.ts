import { describe, expect, it } from "vitest";
import { DirectLocalPlanner, ObstacleAvoidanceLocalPlanner, autopilotSpeedProfileFor, autopilotSpeedProfileIds, createShipStateV2, vec3 } from "../../src/core";
import type { ShipState, TargetDescriptor } from "../../src/core";

const ship: ShipState = createShipStateV2({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 100,
  authority: { mode: "Autopilot" }
});

const target: TargetDescriptor = {
  id: "alpha",
  label: "Alpha",
  kind: "Waypoint",
  position: vec3(100, 0, 0),
  arrivalEnvelope: { radius: 2, terminalSpeed: 6, stopBehavior: "MatchTerminalSpeed" }
};

describe("local planners", () => {
  it("creates deterministic hashes for equal direct plans", () => {
    const planner = new DirectLocalPlanner();
    const a = planner.plan({ tick: 4, ship, target });
    const b = planner.plan({ tick: 4, ship, target });

    expect(a.planHash).toBe(b.planHash);
    expect(a.segments).toHaveLength(1);
    expect(a.segments[0].kind).toBe("Direct");
    expect(a.target.kind).toBe("Waypoint");
    expect(a.target.arrivalEnvelope.radius).toBe(2);
    expect(a.validation.ok).toBe(true);
    expect(a.score).toEqual(b.score);
  });

  it("distinguishes waypoint and point target descriptors", () => {
    const planner = new DirectLocalPlanner();
    const waypointPlan = planner.plan({ tick: 4, ship, target });
    const pointTarget: TargetDescriptor = { ...target, id: "point-alpha", kind: "Point" };
    const pointPlan = planner.plan({ tick: 4, ship, target: pointTarget });

    expect(waypointPlan.target.kind).toBe("Waypoint");
    expect(pointPlan.target.kind).toBe("Point");
    expect(pointPlan.planHash).not.toBe(waypointPlan.planHash);
  });

  it("returns structured rejection for invalid targets", () => {
    const planner = new DirectLocalPlanner();
    const invalidTarget = { ...target, id: "", arrivalEnvelope: { radius: 0 } } as TargetDescriptor;
    const result = planner.planResult({ tick: 4, ship, target: invalidTarget });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.reasonCodes).toEqual(expect.arrayContaining(["InvalidTarget", "ImpossibleArrivalEnvelope"]));
    }
  });

  it("returns structured rejection for missing and null targets", () => {
    const planner = new DirectLocalPlanner();
    const missingTargetResult = planner.planResult({ tick: 4, ship } as never);
    const nullTargetResult = planner.planResult({ tick: 4, ship, target: null } as never);

    expect(missingTargetResult.ok).toBe(false);
    if (!missingTargetResult.ok) {
      expect(missingTargetResult.rejection.targetId).toBeNull();
      expect(missingTargetResult.rejection.reasonCodes).toContain("InvalidTarget");
    }

    expect(nullTargetResult.ok).toBe(false);
    if (!nullTargetResult.ok) {
      expect(nullTargetResult.rejection.targetId).toBeNull();
      expect(nullTargetResult.rejection.reasonCodes).toContain("InvalidTarget");
    }
  });

  it("returns structured rejection for unsupported future target kinds", () => {
    const planner = new DirectLocalPlanner();
    const unsupportedTarget: TargetDescriptor = { ...target, id: "landing-alpha", kind: "Landing" };
    const result = planner.planResult({ tick: 4, ship, target: unsupportedTarget });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.reasonCodes).toEqual(["UnsupportedTargetKind"]);
    }
  });

  it("returns structured rejection for unsafe targets inside obstacles", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const unsafeTarget: TargetDescriptor = { ...target, id: "inside-rock", kind: "Point", position: vec3(45, 0, 0), arrivalEnvelope: { radius: 3 } };
    const result = planner.planResult({
      tick: 4,
      ship,
      target: unsafeTarget,
      obstacles: [{ id: "rock", center: vec3(45, 0, 0), radius: 10, padding: 5 }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.reasonCodes).toEqual(["UnsafeObstacle"]);
      expect(result.rejection.issues[0]).toEqual(expect.objectContaining({ obstacleId: "rock" }));
    }
  });

  it("returns structured rejection for invalid obstacle radius and padding", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const result = planner.planResult({
      tick: 4,
      ship,
      target,
      obstacles: [{ id: "bad-rock", center: vec3(45, 0, 0), radius: Number.NaN, padding: Infinity }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.reasonCodes).toEqual(["UnsafeObstacle"]);
      expect(result.rejection.issues[0]).toEqual(expect.objectContaining({ obstacleId: "bad-rock" }));
    }
  });

  it("produces deterministic candidate scoring metadata", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const context = { tick: 4, ship, target, obstacles: [{ id: "rock", center: vec3(45, 0, 0), radius: 10, padding: 5 }] };
    const a = planner.planResult(context);
    const b = planner.planResult(context);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.candidate.score).toEqual(b.candidate.score);
      expect(a.plan.score).toEqual(a.candidate.score);
      expect(a.plan.validation.ok).toBe(true);
    }
  });

  it("creates avoidance segments when an obstacle blocks the direct line", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const plan = planner.plan({
      tick: 4,
      ship,
      target,
      obstacles: [{ id: "rock", center: vec3(45, 0, 0), radius: 10, padding: 5 }]
    });

    expect(plan.segments.map((segment) => segment.kind)).toEqual(["Avoidance", "Terminal"]);
    expect(plan.planHash).toMatch(/^[a-f0-9]{8}$/);
  });

  it("keeps the planner terminal segment aligned with the visible target position", () => {
    const directPlan = new DirectLocalPlanner().plan({ tick: 4, ship, target });
    const avoidancePlan = new ObstacleAvoidanceLocalPlanner().plan({
      tick: 4,
      ship,
      target,
      obstacles: [{ id: "rock", center: vec3(45, 0, 0), radius: 10, padding: 5 }]
    });

    expect(directPlan.segments.at(-1)?.end).toEqual(directPlan.target.position);
    expect(avoidancePlan.segments.at(-1)?.end).toEqual(avoidancePlan.target.position);
  });

  it("defines deterministic speed profile settings without changing acceleration authority", () => {
    expect(autopilotSpeedProfileIds).toEqual(["Safe", "Balanced", "Fast"]);
    expect(autopilotSpeedProfileFor("Safe")).toEqual(expect.objectContaining({ directDesiredSpeed: 12, brakeMarginMultiplier: 1.25 }));
    expect(autopilotSpeedProfileFor("Balanced")).toEqual(expect.objectContaining({ directDesiredSpeed: 18, brakeMarginMultiplier: 1 }));
    expect(autopilotSpeedProfileFor("Fast")).toEqual(expect.objectContaining({ directDesiredSpeed: 22, brakeMarginMultiplier: 0.9 }));
    expect(autopilotSpeedProfileFor(undefined).id).toBe("Balanced");
  });

  it("applies speed profiles to route segment desired speeds and non-terminal brake margins", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const context = {
      tick: 4,
      ship,
      target,
      obstacles: [{ id: "rock", center: vec3(45, 0, 0), radius: 10, padding: 5 }]
    };
    const safePlan = planner.plan({ ...context, speedProfile: "Safe" });
    const balancedPlan = planner.plan({ ...context, speedProfile: "Balanced" });
    const fastPlan = planner.plan({ ...context, speedProfile: "Fast" });

    expect(safePlan.speedProfile).toBe("Safe");
    expect(balancedPlan.speedProfile).toBe("Balanced");
    expect(fastPlan.speedProfile).toBe("Fast");
    expect(safePlan.segments.map((segment) => segment.desiredSpeed)).toEqual([10, 8]);
    expect(balancedPlan.segments.map((segment) => segment.desiredSpeed)).toEqual([14, 12]);
    expect(fastPlan.segments.map((segment) => segment.desiredSpeed)).toEqual([18, 15]);
    expect(safePlan.segments[0].brakeMarginMultiplier).toBe(1.25);
    expect(balancedPlan.segments[0].brakeMarginMultiplier).toBe(1);
    expect(fastPlan.segments[0].brakeMarginMultiplier).toBe(0.9);
    expect(safePlan.segments[1].brakeMarginMultiplier).toBeUndefined();
    expect(safePlan.planHash).toBe(new ObstacleAvoidanceLocalPlanner().plan({ ...context, speedProfile: "Safe" }).planHash);
    expect(safePlan.planHash).not.toBe(balancedPlan.planHash);
    expect(balancedPlan.planHash).not.toBe(fastPlan.planHash);
    expect(new Set([safePlan.planHash, balancedPlan.planHash, fastPlan.planHash]).size).toBe(3);
  });
});
