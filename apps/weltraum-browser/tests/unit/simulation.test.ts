import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, createShipStateV2, vec3 } from "../../src/core";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import type { ShipState, TargetDescriptor } from "../../src/core";

const ship: ShipState = createShipStateV2({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 50,
  authority: { mode: "Autopilot" }
});

const target: TargetDescriptor = {
  id: "beta",
  label: "Beta",
  kind: "Point",
  position: vec3(60, 0, 0),
  arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
};

describe("FixedStepSimulationLoop", () => {
  it("advances in deterministic fixed ticks", () => {
    const executorA = new AutopilotExecutor();
    const executorB = new AutopilotExecutor();
    const plan = new DirectLocalPlanner().plan({ tick: 0, ship, target });
    executorA.lockPlan(plan, ship);
    executorB.lockPlan(plan, ship);

    const loopA = new FixedStepSimulationLoop(ship, executorA, { fixedDeltaSeconds: 1 / 10, maxSubSteps: 20 });
    const loopB = new FixedStepSimulationLoop(ship, executorB, { fixedDeltaSeconds: 1 / 10, maxSubSteps: 20 });

    loopA.advance(0.5);
    loopB.step(5);

    expect(loopA.getTick()).toBe(5);
    expect(loopA.getShip().position.x).toBeCloseTo(loopB.getShip().position.x, 8);
    expect(loopA.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("exposes elapsed-time fixed-step advancement through the app bridge", () => {
    const { controller } = createBrowserRuntime();

    const before = controller.getTelemetry();
    const partial = controller.advance(1 / 60);
    const afterOneTick = controller.advance(1 / 60);

    expect(partial.executor.tick).toBe(before.executor.tick);
    expect(afterOneTick.executor.tick).toBe(before.executor.tick + 1);
    expect(afterOneTick.executor.planHash).toBe(before.executor.planHash);
  });

  it("publishes real flight telemetry before the first browser runtime step", () => {
    const { controller } = createBrowserRuntime();

    const initial = controller.getTelemetry();

    expect(initial.executor.tick).toBe(0);
    expect(initial.ship.fuel.current).toBeGreaterThan(0);
    expect(initial.flightSnapshot.fuel.current).toBe(initial.ship.fuel.current);
    expect(initial.flightSnapshot.mass.totalMass).toBe(initial.ship.mass.totalMass);
    expect(initial.flightSnapshot.authority.mode).toBe(initial.ship.authority.mode);
    expect(initial.flightSnapshot.authority.autopilotAvailable).toBe(true);
    expect(initial.flightSnapshot.routeValid).toBe(true);
    expect(initial.flightSnapshot.failureReasonCodes).not.toContain("FuelDepleted");
    expect(initial.flightSnapshot.failureReasonCodes).not.toContain("AutopilotUnavailable");
  });
});
