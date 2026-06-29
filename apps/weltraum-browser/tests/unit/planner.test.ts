import { describe, expect, it } from "vitest";
import { DirectLocalPlanner, ObstacleAvoidanceLocalPlanner, createShipStateV2, vec3 } from "../../src/core";
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
});
