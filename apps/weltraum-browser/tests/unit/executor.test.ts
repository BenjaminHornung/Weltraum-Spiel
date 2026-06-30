import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, createAuthorityState, createShipStateV2, distance, magnitude, orientationFromForward, vec3 } from "../../src/core";
import type { ShipState, TargetDescriptor } from "../../src/core";

const authority = createAuthorityState({ mode: "Autopilot" });

const createShip = (overrides: Parameters<typeof createShipStateV2>[0] = {}): ShipState =>
  createShipStateV2({
    position: vec3(0, 0, 0),
    velocity: vec3(0, 0, 0),
    fuel: 100,
    authority,
    ...overrides
  });

const target: TargetDescriptor = {
  id: "alpha",
  label: "Alpha",
  kind: "Waypoint",
  position: vec3(100, 0, 0),
  arrivalEnvelope: { radius: 2, terminalSpeed: 6, stopBehavior: "MatchTerminalSpeed" }
};

const quaternionDistance = (a: ShipState["orientation"], b: ShipState["orientation"]): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w);

describe("AutopilotExecutor", () => {
  it("executes a locked plan without replacing its hash", () => {
    const planner = new DirectLocalPlanner();
    const initialShip = createShip();
    const plan = planner.plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    let ship = createShip();
    for (let tick = 1; tick <= 12; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
    }

    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(executor.getTelemetry().status).toBe("Executing");
    expect(ship.position.x).toBeGreaterThan(0);
  });

  it("preserves linear drift when idle without a locked plan", () => {
    const executor = new AutopilotExecutor();
    const driftingShip = createShip({ position: vec3(3, 0, 0), velocity: vec3(6, 0, 0), mainThrottleCommand: 1 });

    const after = executor.step(driftingShip, 0.5, 1);

    expect(executor.getTelemetry().status).toBe("Idle");
    expect(after.velocity).toEqual(driftingShip.velocity);
    expect(after.position.x).toBeCloseTo(6, 8);
    expect(after.actuatorTelemetry.mainThrustActive).toBe(false);
  });

  it("preserves velocity when canceling a locked plan", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);
    const movingShip = createShip({ position: vec3(3, 0, 0), velocity: vec3(12, 0, 0), mainThrottleCommand: 1 });

    const canceled = executor.cancelPlan(movingShip, 2);

    expect(executor.getTelemetry().status).toBe("Idle");
    expect(executor.getTelemetry().planHash).toBeNull();
    expect(canceled.position).toEqual(movingShip.position);
    expect(canceled.velocity).toEqual(movingShip.velocity);
    expect(canceled.throttle).toBe(0);
    expect(canceled.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(executor.getLockedPlan()).toBeNull();
  });

  it("burns fuel deterministically and updates mass through the owner model", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executorA = new AutopilotExecutor();
    const executorB = new AutopilotExecutor();
    executorA.lockPlan(plan, initialShip);
    executorB.lockPlan(plan, initialShip);

    const afterA = executorA.step(createShip(), 1 / 30, 2);
    const afterB = executorB.step(createShip(), 1 / 30, 2);

    expect(afterA.fuel.current).toBeLessThan(100);
    expect(afterA.fuel.current).toBeCloseTo(afterB.fuel.current, 8);
    expect(afterA.mass.totalMass).toBeCloseTo(afterA.mass.dryMass + (afterA.mass.cargoMass ?? 0) + afterA.fuel.current, 8);
  });

  it("uses mass to change acceleration and braking reserve estimates", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const lightExecutor = new AutopilotExecutor();
    const heavyExecutor = new AutopilotExecutor();
    lightExecutor.lockPlan(plan, initialShip);
    heavyExecutor.lockPlan(plan, initialShip);

    const light = lightExecutor.step(createShip({ dryMass: 900 }), 1, 2);
    const heavy = heavyExecutor.step(createShip({ dryMass: 4_000 }), 1, 2);

    expect(light.position.x).toBeGreaterThan(heavy.position.x);
    expect(heavyExecutor.getTelemetry().flightSnapshot.brakingReserve.availableDeltaV).toBeLessThan(
      lightExecutor.getTelemetry().flightSnapshot.brakingReserve.availableDeltaV
    );
  });

  it("marks divergence as replanRequired without silently replacing the plan", () => {
    const planner = new DirectLocalPlanner();
    const initialShip = createShip();
    const plan = planner.plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan, initialShip);

    const divergentShip: ShipState = {
      ...createShip(),
      position: vec3(10, 40, 0)
    };

    const after = executor.step(divergentShip, 1 / 30, 2);
    const telemetry = executor.getTelemetry();

    expect(after).toBe(divergentShip);
    expect(after.position).toEqual(divergentShip.position);
    expect(after.velocity).toEqual(divergentShip.velocity);
    expect(after.fuel.current).toBe(divergentShip.fuel.current);
    expect(telemetry.status).toBe("Diverged");
    expect(telemetry.replanRequired).toBe(true);
    expect(telemetry.invalidationReasons).toContain("OffLockedRoute");
    expect(telemetry.failureReasonCodes).toContain("OffLockedRoute");
    expect(telemetry.flightSnapshot.routeValid).toBe(false);
    expect(telemetry.flightSnapshot.failureReasonCodes).toContain("OffLockedRoute");
    expect(telemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("does not turn a high-speed terminal crossing into a snapped arrival", () => {
    const planner = new DirectLocalPlanner();
    const initialShip = createShip();
    const plan = planner.plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan, initialShip);

    const crossingShip = createShip({ position: vec3(96, 0, 0), velocity: vec3(180, 0, 0) });
    const after = executor.step(crossingShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(executor.getTelemetry().distanceToTarget).toBeLessThanOrEqual(target.arrivalEnvelope.radius);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeGreaterThan(target.arrivalEnvelope.terminalSpeed ?? 0);
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("accepts already-inside-envelope arrivals only when terminal speed is satisfied and does not snap", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const insideEnvelopeShip = createShip({ position: vec3(99, 0, 0), velocity: vec3(4, 0, 0) });
    const after = executor.step(insideEnvelopeShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().distanceToTarget).toBe(1);
    expect(after.position).toEqual(insideEnvelopeShip.position);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeLessThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("keeps braking through the controller when inside the envelope above terminal speed", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const fastInsideEnvelopeShip = createShip({ position: vec3(99, 0, 0), velocity: vec3(50, 0, 0) });
    const after = executor.step(fastInsideEnvelopeShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(after.position).not.toEqual(plan.target.position);
    expect(after.velocity.x).toBeLessThan(fastInsideEnvelopeShip.velocity.x);
    expect(after.actuatorTelemetry.mainThrustActive).toBe(true);
  });

  it("holds MatchTerminalSpeed as the braking target instead of commanding a stop", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor({ divergenceDistance: 40 });
    executor.lockPlan(plan, initialShip);

    const terminalSpeedShip = createShip({ position: vec3(97, 0, 0), velocity: vec3(target.arrivalEnvelope.terminalSpeed ?? 0, 0, 0) });
    const after = executor.step(terminalSpeedShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(magnitude(after.velocity)).toBeGreaterThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
    expect(after.actuatorTelemetry.lastAppliedAcceleration.x).toBeGreaterThanOrEqual(0);
  });

  it("arrives for MatchTerminalSpeed only after satisfying the terminal speed envelope without snapping the plan hash", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor({ divergenceDistance: 40 });
    executor.lockPlan(plan, initialShip);

    const insideEnvelopeShip = createShip({ position: vec3(99, 0, 0), velocity: vec3((target.arrivalEnvelope.terminalSpeed ?? 0) + 0.5, 0, 0) });
    executor.step(insideEnvelopeShip, 1 / 30, 2);
    expect(executor.getTelemetry().status).toBe("Executing");

    const after = executor.step(createShip({ position: vec3(99, 0, 0), velocity: vec3(target.arrivalEnvelope.terminalSpeed ?? 0, 0, 0) }), 1 / 30, 3);

    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeLessThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("rotates autopilot facing through the flight controller instead of overwriting orientation in one tick", () => {
    const sidewaysTarget: TargetDescriptor = {
      ...target,
      id: "sideways",
      position: vec3(0, 0, 100)
    };
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: sidewaysTarget });
    const executor = new AutopilotExecutor({ divergenceDistance: 40 });
    executor.lockPlan(plan, initialShip);

    const after = executor.step(initialShip, 1 / 30, 2);
    const desiredOrientation = orientationFromForward(vec3(0, 0, 1));

    expect(quaternionDistance(after.orientation, desiredOrientation)).toBeGreaterThan(0.01);
    expect(magnitude(after.angularVelocity)).toBeGreaterThan(0);
    expect(after.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("preserves velocity for terminal-crossing NoStopRequired arrivals when no terminal speed is requested", () => {
    const noStopTarget: TargetDescriptor = {
      ...target,
      id: "no-stop",
      arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
    };
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: noStopTarget });
    const executor = new AutopilotExecutor({ divergenceDistance: 40 });
    executor.lockPlan(plan, initialShip);

    const crossingShip = createShip({ position: vec3(96, 0, 0), velocity: vec3(180, 0, 0) });
    const after = executor.step(crossingShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(distance(after.position, plan.target.position)).toBeLessThanOrEqual(noStopTarget.arrivalEnvelope.radius);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeGreaterThan(100);
  });

  it("does not snap tangential terminal swings that stay outside the arrival envelope", () => {
    const tangentialTarget: TargetDescriptor = {
      ...target,
      id: "tangent",
      position: vec3(0, 0, 0),
      arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
    };
    const initialShip = createShip({ position: vec3(-10, 3, 0) });
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: tangentialTarget });
    const executor = new AutopilotExecutor({ divergenceDistance: 100 });
    executor.lockPlan(plan, initialShip);

    const tangentialShip = createShip({ position: vec3(-10, 3, 0), velocity: vec3(600, 0, 0) });
    const after = executor.step(tangentialShip, 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(after.position).not.toEqual(plan.target.position);
    expect(executor.getTelemetry().distanceToTarget).toBeGreaterThan(tangentialTarget.arrivalEnvelope.radius);
  });

  it("reports fuel depletion without building a replacement plan", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    executor.step(createShip({ fuel: 0 }), 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("OutOfFuel");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().invalidationReasons).toContain("FuelDepleted");
    expect(executor.getTelemetry().failureReasonCodes).toContain("FuelInsufficient");
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("reports missing authority without building a replacement plan", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    executor.step(
      createShip({ authority: createAuthorityState({ mode: "Manual", mainThrustersAvailable: true, rcsAvailable: true, sasAvailable: true, autopilotAvailable: false }) }),
      1 / 30,
      2
    );

    expect(executor.getTelemetry().status).toBe("NoAuthority");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().invalidationReasons).toContain("AutopilotUnavailable");
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("reports no main thrusters as no authority with a braking reserve blocker", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    executor.step(createShip({ authority: createAuthorityState({ mode: "Autopilot", mainThrustersAvailable: false, autopilotAvailable: true }) }), 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("NoAuthority");
    expect(executor.getTelemetry().failureReasonCodes).toContain("MainThrustersUnavailable");
    expect(executor.getTelemetry().flightSnapshot.brakingReserve.canBrake).toBe(false);
  });

  it("blocks routes when brake reserve is insufficient", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    executor.step(createShip({ fuel: { current: 6, reserve: 5, capacity: 100, burnRate: 0.02 }, velocity: vec3(80, 0, 0) }), 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("BrakeReserveInsufficient");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().failureReasonCodes).toContain("FuelInsufficient");
    expect(executor.getTelemetry().failureReasonCodes).toContain("BrakeReserveInsufficient");
    expect(executor.getTelemetry().flightSnapshot.failureReasonCodes).toEqual(expect.arrayContaining(["FuelInsufficient", "BrakeReserveInsufficient"]));
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
  });
});
