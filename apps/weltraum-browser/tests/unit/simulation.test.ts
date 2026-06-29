import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, vec3 } from "../../src/core";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import type { ShipState, TargetDescriptor } from "../../src/core";

const ship: ShipState = {
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 50,
  authority: { mode: "Autopilot", mainThrusters: true, rcs: true, autopilot: true }
};

const target: TargetDescriptor = {
  id: "beta",
  label: "Beta",
  position: vec3(60, 0, 0),
  arrivalRadius: 2
};

describe("FixedStepSimulationLoop", () => {
  it("advances in deterministic fixed ticks", () => {
    const executorA = new AutopilotExecutor();
    const executorB = new AutopilotExecutor();
    const plan = new DirectLocalPlanner().plan({ tick: 0, ship, target });
    executorA.lockPlan(plan);
    executorB.lockPlan(plan);

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
});
