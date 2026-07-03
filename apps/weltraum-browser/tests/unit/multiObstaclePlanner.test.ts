import { describe, expect, it } from "vitest";
import { createShipStateV2, DirectLocalPlanner, ObstacleAvoidanceLocalPlanner, vec3 } from "../../src/core";
import type { ObstacleDescriptor, PlannerContext, RouteSegment, ShipState, TargetDescriptor } from "../../src/core";
import { orderObstaclesForMultiObstacleRoute, waypointCandidatesForViolation } from "../../src/navigation/multiObstaclePlanner";
import { validatePlanningContext, validateRouteSegments } from "../../src/navigation/validation";

const ship: ShipState = createShipStateV2({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 100,
  authority: { mode: "Autopilot" }
});

const target: TargetDescriptor = {
  id: "multi-alpha",
  label: "Multi Alpha",
  kind: "Waypoint",
  position: vec3(140, 0, 0),
  arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
};

const contextFor = (obstacles: readonly ObstacleDescriptor[], speedProfile: PlannerContext["speedProfile"] = "Balanced"): PlannerContext => ({
  tick: 7,
  ship,
  target,
  obstacles,
  speedProfile
});

describe("deterministic multi-obstacle planner", () => {
  it("orders obstacles and waypoint candidates deterministically", () => {
    const obstacles: readonly ObstacleDescriptor[] = [
      { id: "rock-c", center: vec3(82, 0, 0), radius: 9, padding: 5 },
      { id: "rock-a", center: vec3(38, 0, 0), radius: 9, padding: 5 },
      { id: "rock-b", center: vec3(38, 0, 2), radius: 9, padding: 5 }
    ];
    const ordered = orderObstaclesForMultiObstacleRoute(contextFor(obstacles));
    const candidates = waypointCandidatesForViolation(contextFor(obstacles), ship.position, target.position, ordered[0]);

    expect(ordered.map((obstacle) => obstacle.id)).toEqual(["rock-a", "rock-b", "rock-c"]);
    expect(candidates.slice(0, 4)).toEqual([vec3(38, 0, 26), vec3(38, 0, -26), vec3(38, 26, 0), vec3(38, -26, 0)]);
  });

  it("keeps route shape and planHash stable for identical multi-obstacle input", () => {
    const obstacles: readonly ObstacleDescriptor[] = [
      { id: "second", center: vec3(82, 0, 0), radius: 10, padding: 5 },
      { id: "first", center: vec3(42, 0, 0), radius: 10, padding: 5 }
    ];
    const planner = new ObstacleAvoidanceLocalPlanner();
    const a = planner.plan(contextFor(obstacles));
    const b = planner.plan(contextFor([...obstacles].reverse()));

    expect(a.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end }))).toEqual(b.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end })));
    expect(a.planHash).toBe(b.planHash);
    expect(a.segments.filter((segment) => segment.kind === "Avoidance").length).toBeGreaterThanOrEqual(1);
    expect(a.segments.at(-1)?.kind).toBe("Terminal");
    expect(a.segments.at(-1)?.end).toEqual(target.position);
  });

  it("constructs a solvable S-curve style route with multiple avoidance segments", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const plan = planner.plan(
      contextFor([
        { id: "s-a", center: vec3(35, 0, 0), radius: 9, padding: 5 },
        { id: "s-b", center: vec3(70, 0, 0), radius: 9, padding: 5 },
        { id: "s-c", center: vec3(105, 0, 0), radius: 9, padding: 5 }
      ])
    );

    expect(plan.validation.ok).toBe(true);
    expect(plan.segments.filter((segment) => segment.kind === "Avoidance").length).toBeGreaterThan(1);
    expect(plan.segments.at(-1)?.kind).toBe("Terminal");
    expect(plan.score.reasons).toEqual(expect.arrayContaining([`segments:${plan.segments.length}`]));
    expect(plan.score.reasons).toEqual(expect.arrayContaining([`plannerComplexity:${plan.segments.filter((segment) => segment.kind === "Avoidance").length}`]));
  });

  it("chooses the first candidate whose full route validates against later obstacles", () => {
    const reproShip = createShipStateV2({
      position: vec3(0, 0, 0),
      velocity: vec3(0, 0, 0),
      fuel: 100,
      authority: { mode: "Autopilot" }
    });
    const reproTarget: TargetDescriptor = {
      id: "greedy-candidate-regression",
      label: "Greedy Candidate Regression",
      kind: "Waypoint",
      position: vec3(200, 0, 0),
      arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
    };
    const reproContext: PlannerContext = {
      tick: 7,
      ship: reproShip,
      target: reproTarget,
      obstacles: [
        { id: "a", center: vec3(50, 0, 0), radius: 10, padding: 6 },
        { id: "b0", center: vec3(160, 3, -33), radius: 15, padding: 6 },
        { id: "b1", center: vec3(129, 8, 32), radius: 19, padding: 5 },
        { id: "b2", center: vec3(142, 25, -26), radius: 20, padding: 10 }
      ],
      speedProfile: "Balanced"
    };
    const planner = new ObstacleAvoidanceLocalPlanner();
    const result = planner.planResult(reproContext);
    const repeat = planner.planResult({ ...reproContext, obstacles: [...(reproContext.obstacles ?? [])].reverse() });

    expect(result.ok).toBe(true);
    expect(repeat.ok).toBe(true);
    if (result.ok && repeat.ok) {
      expect(result.plan.validation.ok).toBe(true);
      expect(result.plan.planHash).toBe(repeat.plan.planHash);
      expect(result.plan.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end }))).toEqual(repeat.plan.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end })));
      expect(result.plan.segments.at(-1)?.end).toEqual(reproTarget.position);
      expect(result.plan.segments.some((segment) => segment.end.x === 50 && segment.end.y === -28 && segment.end.z === 0)).toBe(true);
    }
  });

  it("constructs a corridor-equivalent route while validating all route segments", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const plan = planner.plan(
      contextFor([
        { id: "gate-top", center: vec3(48, 16, 18), radius: 8, padding: 4 },
        { id: "gate-bottom", center: vec3(48, -16, -18), radius: 8, padding: 4 },
        { id: "downstream", center: vec3(88, 0, 0), radius: 10, padding: 4 }
      ])
    );
    const validation = validateRouteSegments(contextFor([{ id: "downstream", center: vec3(88, 0, 0), radius: 10, padding: 4 }]), plan.segments, validatePlanningContext(contextFor([])));

    expect(plan.validation.ok).toBe(true);
    expect(plan.segments.filter((segment) => segment.kind === "Avoidance").length).toBeGreaterThanOrEqual(1);
    expect(validation.ok).toBe(true);
  });

  it("rejects unsafe direct candidates with a structured all-segment reason", () => {
    const result = new DirectLocalPlanner().planResult(contextFor([{ id: "blocking-rock", center: vec3(60, 0, 0), radius: 12, padding: 4 }]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.reasonCodes).toEqual(["UnsafeRouteSegment"]);
      expect(result.rejection.issues[0]).toEqual(expect.objectContaining({ obstacleId: "blocking-rock", segmentId: "direct-0" }));
      expect(result.candidate?.validation.ok).toBe(false);
    }
  });

  it("rejects an unsafe manually shaped candidate across every segment", () => {
    const validation = validatePlanningContext(contextFor([]));
    const unsafeSegments: readonly RouteSegment[] = [
      { id: "manual-avoid-0", kind: "Avoidance", start: ship.position, end: vec3(40, 0, 30), desiredSpeed: 14, clearanceRadius: 12 },
      { id: "manual-terminal-1", kind: "Terminal", start: vec3(40, 0, 30), end: target.position, desiredSpeed: 12, clearanceRadius: 3 }
    ];
    const routeValidation = validateRouteSegments(contextFor([{ id: "late-rock", center: vec3(85, 0, 18), radius: 12, padding: 4 }]), unsafeSegments, validation);

    expect(routeValidation.ok).toBe(false);
    expect(routeValidation.rejectedReasonCodes).toEqual(["UnsafeRouteSegment"]);
    expect(routeValidation.issues[0]).toEqual(expect.objectContaining({ obstacleId: "late-rock", segmentId: "manual-terminal-1" }));
  });

  it("constructs a deterministic dense-field route within budget when geometry is safe", () => {
    const denseObstacles: readonly ObstacleDescriptor[] = Array.from({ length: 8 }, (_, index) => ({
      id: `budget-rock-${index}`,
      center: vec3(18 + index * 14, 0, index % 2 === 0 ? 0 : 2),
      radius: 8,
      padding: 5
    }));
    const planner = new ObstacleAvoidanceLocalPlanner();
    const result = planner.planResult(contextFor(denseObstacles));
    const repeat = planner.planResult(contextFor([...denseObstacles].reverse()));

    expect(result.ok).toBe(true);
    expect(repeat.ok).toBe(true);
    if (result.ok && repeat.ok) {
      expect(result.plan.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end }))).toEqual(repeat.plan.segments.map((segment) => ({ kind: segment.kind, start: segment.start, end: segment.end })));
      expect(result.plan.planHash).toBe(repeat.plan.planHash);
      expect(result.plan.validation.ok).toBe(true);
      expect(result.plan.segments.filter((segment) => segment.kind === "Avoidance").length).toBeGreaterThanOrEqual(1);
      expect(result.plan.segments.at(-1)?.kind).toBe("Terminal");
      expect(result.plan.segments.at(-1)?.end).toEqual(target.position);
    }
  });

  it("lets speed profiles change route intent speeds without changing terminal gates", () => {
    const obstacles: readonly ObstacleDescriptor[] = [{ id: "profile-rock", center: vec3(60, 0, 0), radius: 12, padding: 4 }];
    const safe = new ObstacleAvoidanceLocalPlanner().plan(contextFor(obstacles, "Safe"));
    const balanced = new ObstacleAvoidanceLocalPlanner().plan(contextFor(obstacles, "Balanced"));
    const fast = new ObstacleAvoidanceLocalPlanner().plan(contextFor(obstacles, "Fast"));

    expect(safe.segments.map((segment) => segment.desiredSpeed)).toEqual([10, 8]);
    expect(balanced.segments.map((segment) => segment.desiredSpeed)).toEqual([14, 12]);
    expect(fast.segments.map((segment) => segment.desiredSpeed)).toEqual([18, 15]);
    expect(safe.target.arrivalEnvelope).toEqual(target.arrivalEnvelope);
    expect(balanced.target.arrivalEnvelope).toEqual(target.arrivalEnvelope);
    expect(fast.target.arrivalEnvelope).toEqual(target.arrivalEnvelope);
    expect(safe.segments.at(-1)?.clearanceRadius).toBe(target.arrivalEnvelope.radius);
    expect(fast.segments.at(-1)?.brakeMarginMultiplier).toBeUndefined();
  });
});
