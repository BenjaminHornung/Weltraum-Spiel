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

  it("routes browser UI autopilot commands through the runtime controller", () => {
    const { controller } = createBrowserRuntime();

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });
    expect(canceled.executor.status).toBe("Idle");
    expect(canceled.executor.planHash).toBeNull();
    expect(controller.getLockedPlan()).toBeNull();

    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    expect(engaged.executor.status).toBe("Executing");
    expect(engaged.lockedPlan?.planner).toBe("DirectLocal");
    expect(controller.getLockedPlan()?.planHash).toBe(engaged.executor.planHash);
  });

  it("ignores malformed browser UI commands without canceling the active plan", () => {
    const { controller } = createBrowserRuntime();
    const before = controller.getTelemetry();

    const after = controller.dispatchCommand({ type: "UnknownCommand" } as never);

    expect(after.executor.planHash).toBe(before.executor.planHash);
    expect(after.executor.status).toBe(before.executor.status);
    expect(controller.getLockedPlan()?.planHash).toBe(before.executor.planHash);
  });

  it("cancels a non-zero-velocity autopilot into a stable stopped idle state", () => {
    const movingShip = createShipStateV2({ position: vec3(3, 0, 0), velocity: vec3(12, 0, 0), authority: { mode: "Autopilot" } });
    const { controller } = createBrowserRuntime({ initialShip: movingShip });

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });
    const afterSteps = controller.step(5);

    expect(canceled.executor.status).toBe("Idle");
    expect(canceled.executor.planHash).toBeNull();
    expect(canceled.ship.position).toEqual(movingShip.position);
    expect(canceled.ship.velocity).toEqual(vec3());
    expect(canceled.executor.position).toEqual(movingShip.position);
    expect(canceled.executor.velocity).toEqual(vec3());
    expect(afterSteps.ship.position).toEqual(movingShip.position);
    expect(afterSteps.ship.velocity).toEqual(vec3());
    expect(afterSteps.executor.position).toEqual(movingShip.position);
    expect(afterSteps.executor.velocity).toEqual(vec3());
  });
});
