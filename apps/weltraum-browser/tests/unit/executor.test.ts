import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, vec3 } from "../../src/core";
import type { ShipState, TargetDescriptor } from "../../src/core";

const authority = { mode: "Autopilot" as const, mainThrusters: true, rcs: true, autopilot: true };

const createShip = (): ShipState => ({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 100,
  authority
});

const target: TargetDescriptor = {
  id: "alpha",
  label: "Alpha",
  position: vec3(100, 0, 0),
  arrivalRadius: 2
};

describe("AutopilotExecutor", () => {
  it("executes a locked plan without replacing its hash", () => {
    const planner = new DirectLocalPlanner();
    const plan = planner.plan({ tick: 1, ship: createShip(), target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan);

    let ship = createShip();
    for (let tick = 1; tick <= 12; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
    }

    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(executor.getTelemetry().status).toBe("Executing");
    expect(ship.position.x).toBeGreaterThan(0);
  });

  it("marks divergence as replanRequired without silently replacing the plan", () => {
    const planner = new DirectLocalPlanner();
    const plan = planner.plan({ tick: 1, ship: createShip(), target });
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan);

    const divergentShip: ShipState = {
      ...createShip(),
      position: vec3(10, 40, 0)
    };

    executor.step(divergentShip, 1 / 30, 2);
    const telemetry = executor.getTelemetry();

    expect(telemetry.status).toBe("Diverged");
    expect(telemetry.replanRequired).toBe(true);
    expect(telemetry.invalidationReasons).toContain("OffLockedRoute");
    expect(telemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("reports fuel depletion without building a replacement plan", () => {
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: createShip(), target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan);

    executor.step({ ...createShip(), fuel: 0 }, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("OutOfFuel");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().invalidationReasons).toContain("FuelDepleted");
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("reports missing authority without building a replacement plan", () => {
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: createShip(), target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan);

    executor.step(
      {
        ...createShip(),
        authority: { mode: "Manual", mainThrusters: true, rcs: true, autopilot: false }
      },
      1 / 30,
      2
    );

    expect(executor.getTelemetry().status).toBe("NoAuthority");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().invalidationReasons).toContain("AuthorityUnavailable");
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });
});
