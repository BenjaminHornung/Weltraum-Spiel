import { describe, expect, it } from "vitest";
import { DirectLocalPlanner, ObstacleAvoidanceLocalPlanner, vec3 } from "../../src/core";
import type { ShipState, TargetDescriptor } from "../../src/core";

const ship: ShipState = {
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 100,
  authority: { mode: "Autopilot", mainThrusters: true, rcs: true, autopilot: true }
};

const target: TargetDescriptor = {
  id: "alpha",
  label: "Alpha",
  position: vec3(100, 0, 0),
  arrivalRadius: 2
};

describe("local planners", () => {
  it("creates deterministic hashes for equal direct plans", () => {
    const planner = new DirectLocalPlanner();
    const a = planner.plan({ tick: 4, ship, target });
    const b = planner.plan({ tick: 4, ship, target });

    expect(a.planHash).toBe(b.planHash);
    expect(a.segments).toHaveLength(1);
    expect(a.segments[0].kind).toBe("Direct");
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
});
