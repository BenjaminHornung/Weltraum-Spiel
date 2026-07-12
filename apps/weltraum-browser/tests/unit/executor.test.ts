import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, createAuthorityState, createShipStateV2, distance, magnitude, orientationFromForward, vec3 } from "../../src/core";
import type { RoutePlan, ShipState, TargetDescriptor } from "../../src/core";
import { normalCrewedScoutPropulsionCapability } from "../../src/flight/propulsionCapability";
import { provingGroundTargets } from "../../src/world/provingGroundWorld";

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

const stopCaptureTarget: TargetDescriptor = {
  ...target,
  id: "stop-capture",
  arrivalEnvelope: { radius: 2, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
};

const quaternionDistance = (a: ShipState["orientation"], b: ShipState["orientation"]): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w);

const stepUntilLongitudinalBraking = (
  executor: AutopilotExecutor,
  initialShip: ShipState,
  initialTick: number
): ShipState => {
  let ship = initialShip;
  for (let tick = initialTick; tick < initialTick + 600; tick += 1) {
    ship = executor.step(ship, 1 / 30, tick);
    if (ship.velocity.x < initialShip.velocity.x && ship.actuatorTelemetry.lastAppliedAcceleration.x < -1e-6) {
      return ship;
    }
  }
  return ship;
};

const lockedRoutePlan = (
  initialShip: ShipState,
  routeTarget: TargetDescriptor,
  segments: RoutePlan["segments"],
  planHash: string
): RoutePlan => ({
  ...(() => {
    const { motionProfile: _profile, ...legacyPlan } = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: routeTarget });
    return legacyPlan;
  })(),
  id: `route-${planHash}`,
  segments,
  planHash
});

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

    const lightFirst = lightExecutor.step(createShip({ dryMass: 900 }), 1, 2);
    const heavyFirst = heavyExecutor.step(createShip({ dryMass: 4_000 }), 1, 2);
    const light = lightExecutor.step(lightFirst, 1, 3);
    const heavy = heavyExecutor.step(heavyFirst, 1, 3);

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

  it("clones and freezes the complete profile plan at lock while rejecting a pre-lock hash mismatch", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor();
    const externallyMutablePlan = JSON.parse(JSON.stringify(plan)) as RoutePlan;
    const mutablePayload = externallyMutablePlan as unknown as {
      target: { position: { x: number } };
      motionProfile: { resolvedPolicy: { maximumJerkMps3: number } };
    };

    executor.lockPlan(externallyMutablePlan, initialShip);
    mutablePayload.target.position.x = 9_999;
    mutablePayload.motionProfile.resolvedPolicy.maximumJerkMps3 = 0;

    const locked = executor.getLockedPlan();
    expect(locked).not.toBe(externallyMutablePlan);
    expect(locked?.target.position.x).toBe(target.position.x);
    expect(locked?.motionProfile?.resolvedPolicy.maximumJerkMps3).toBe(plan.motionProfile?.resolvedPolicy.maximumJerkMps3);
    expect(Object.isFrozen(locked)).toBe(true);
    expect(Object.isFrozen(locked?.target.position ?? {})).toBe(true);
    expect(Object.isFrozen(locked?.target.arrivalEnvelope ?? {})).toBe(true);
    expect(Object.isFrozen(locked?.validation ?? {})).toBe(true);
    expect(Object.isFrozen(locked?.score ?? {})).toBe(true);
    expect(Object.isFrozen(locked?.motionProfile ?? {})).toBe(true);

    const tampered = { ...plan, target: { ...plan.target, position: vec3(777, 0, 0) } };
    expect(() => new AutopilotExecutor().lockPlan(tampered, initialShip)).toThrow(/hash mismatch/i);
  });

  it("latches a divergence through a restored follow-up step until cancel or a new lock", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan, initialShip);
    executor.step(createShip({ position: vec3(10, 40, 0) }), 1 / 30, 2);

    const restoredShip = createShip();
    const afterRestore = executor.step(restoredShip, 1 / 30, 3);
    expect(afterRestore).toBe(restoredShip);
    expect(executor.getTelemetry().status).toBe("Diverged");
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(executor.getTelemetry().replanRequired).toBe(true);

    executor.cancelPlan(restoredShip, 4);
    executor.lockPlan(plan, restoredShip, 5);
    executor.step(restoredShip, 1 / 30, 6);
    expect(executor.getTelemetry().status).toBe("Executing");
  });

  it("fails a zero-jerk powered route before reserve math and keeps the locked failure latched", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({
      tick: 1,
      ship: initialShip,
      target: stopCaptureTarget,
      transitPolicy: "Custom",
      customTransitPolicyConstraints: {
        targetAccelerationFraction: 1,
        maximumAccelerationMps2: 100,
        maximumJerkMps3: 0,
        coastAllowed: false,
        coastFraction: 0,
        minimumTime: true,
        brakingReserveMultiplier: 1,
        turnBehavior: "Balanced",
        waypointBehavior: "BrakeForWaypoint",
        gravityFloorPolicy: "Preferred"
      }
    });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const afterFailure = executor.step(initialShip, 1 / 30, 2);
    const failureTelemetry = executor.getTelemetry();
    const restoredShip = createShip();
    const afterRestore = executor.step(restoredShip, 1 / 30, 3);

    expect(afterFailure).toBe(initialShip);
    expect(failureTelemetry.status).toBe("NoAuthority");
    expect(failureTelemetry.invalidationReasons).toEqual(["JerkAuthorityUnavailable"]);
    expect(failureTelemetry.failureReasonCodes).toEqual(["JerkAuthorityUnavailable"]);
    expect(failureTelemetry.replanRequired).toBe(true);
    expect(failureTelemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(afterRestore).toBe(restoredShip);
    expect(executor.getTelemetry().status).toBe("NoAuthority");
    expect(executor.getTelemetry().failureReasonCodes).toEqual(["JerkAuthorityUnavailable"]);
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("allows a zero-jerk plan already satisfying its terminal gates to complete without powered transit", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({
      tick: 1,
      ship: initialShip,
      target: stopCaptureTarget,
      transitPolicy: "Custom",
      customTransitPolicyConstraints: {
        targetAccelerationFraction: 1,
        maximumAccelerationMps2: 100,
        maximumJerkMps3: 0,
        coastAllowed: false,
        coastFraction: 0,
        minimumTime: true,
        brakingReserveMultiplier: 1,
        turnBehavior: "Balanced",
        waypointBehavior: "BrakeForWaypoint",
        gravityFloorPolicy: "Preferred"
      }
    });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const arrivedShip = executor.step(createShip({ position: vec3(99.2, 0, 0), velocity: vec3(0.2, 0, 0) }), 1 / 30, 2);

    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().replanRequired).toBe(false);
    expect(executor.getTelemetry().failureReasonCodes).toEqual([]);
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()).toBeNull();
    expect(arrivedShip.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(magnitude(arrivedShip.velocity)).toBeLessThanOrEqual(stopCaptureTarget.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("fails closed for a sufficient-fuel high-speed stopping deficit caused by reduced live braking authority", () => {
    const initialShip = createShip({ fuel: 200 });
    const targetAtRange = { ...stopCaptureTarget, id: "reduced-brake-authority", position: vec3(1_000, 0, 0) };
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: targetAtRange, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);
    const after = executor.step(createShip({
      fuel: 200,
      position: vec3(600, 0, 0),
      velocity: vec3(60, 0, 0),
      propulsionCapability: { ...normalCrewedScoutPropulsionCapability, effectiveBrakingThrustNewton: 500 }
    }), 1 / 30, 2);

    expect(after.position).toEqual(vec3(600, 0, 0));
    expect(executor.getTelemetry().status).toBe("BrakeReserveInsufficient");
    expect(executor.getTelemetry().failureReasonCodes).toContain("BrakeReserveInsufficient");
    expect(executor.getTelemetry().failureReasonCodes).not.toContain("FuelInsufficient");
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("latches a finite live braking degradation discovered during an active Brake phase", () => {
    const initialShip = createShip({ fuel: 200 });
    const targetAtRange = { ...stopCaptureTarget, id: "committed-brake-authority-loss", position: vec3(1_000, 0, 0) };
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: targetAtRange, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, initialShip);

    let ship = initialShip;
    let brakeTick = 0;
    for (let tick = 1; tick <= 6_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
      if (executor.getTelemetry().motionPhase === "Brake" && ship.actuatorTelemetry.lastAppliedAcceleration.x < -1e-6) {
        brakeTick = tick;
        break;
      }
    }

    expect(brakeTick).toBeGreaterThan(0);
    expect(executor.getTelemetry().motionPhase).toBe("Brake");
    const degradedShip: ShipState = {
      ...ship,
      propulsionCapability: {
        ...ship.propulsionCapability,
        effectiveBrakingThrustNewton: 500
      }
    };
    const afterFailure = executor.step(degradedShip, 1 / 30, brakeTick + 1);
    const failureTelemetry = executor.getTelemetry();
    const afterRestore = executor.step(ship, 1 / 30, brakeTick + 2);

    expect(degradedShip.propulsionCapability.effectiveBrakingThrustNewton).toBeGreaterThan(0);
    expect(afterFailure).toBe(degradedShip);
    expect(failureTelemetry.status).toBe("BrakeReserveInsufficient");
    expect(failureTelemetry.invalidationReasons).toEqual(["BrakeReserveInsufficient"]);
    expect(failureTelemetry.failureReasonCodes).toEqual(["BrakeReserveInsufficient"]);
    expect(failureTelemetry.replanRequired).toBe(true);
    expect(failureTelemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(afterRestore).toBe(ship);
    expect(executor.getTelemetry().status).toBe("BrakeReserveInsufficient");
    expect(executor.getTelemetry().failureReasonCodes).toEqual(["BrakeReserveInsufficient"]);
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("advances a high-speed waypoint crossing onto the next locked segment without false divergence", () => {
    const initialShip = createShip();
    const handoffTarget: TargetDescriptor = {
      ...stopCaptureTarget,
      id: "handoff-target",
      position: vec3(250, 0, 0)
    };
    const plan = lockedRoutePlan(initialShip, handoffTarget, [
      { id: "approach", kind: "Avoidance", start: vec3(0, 0, 0), end: vec3(100, 0, 0), desiredSpeed: 20, clearanceRadius: 8 },
      { id: "terminal", kind: "Terminal", start: vec3(100, 0, 0), end: handoffTarget.position, desiredSpeed: 12, clearanceRadius: 2 }
    ], "high-speed-handoff");
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan, initialShip);

    const crossingShip = createShip({ position: vec3(98, 0, 0), velocity: vec3(90, 0, 0) });
    const afterCrossing = executor.step(crossingShip, 1 / 30, 2);
    const crossingTelemetry = executor.getTelemetry();
    executor.step(afterCrossing, 1 / 30, 3);
    const terminalTelemetry = executor.getTelemetry();

    expect(afterCrossing.position.x).toBeGreaterThan(100);
    expect(crossingTelemetry.status).toBe("Executing");
    expect(crossingTelemetry.activeSegmentId).toBe("terminal");
    expect(crossingTelemetry.replanRequired).toBe(false);
    expect(crossingTelemetry.invalidationReasons).toEqual([]);
    expect(terminalTelemetry.status).toBe("Executing");
    expect(terminalTelemetry.activeSegmentId).toBe("terminal");
    expect(terminalTelemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("still fails closed for a true lateral departure beside a segment handoff", () => {
    const initialShip = createShip();
    const handoffTarget: TargetDescriptor = {
      ...stopCaptureTarget,
      id: "departure-target",
      position: vec3(250, 0, 0)
    };
    const plan = lockedRoutePlan(initialShip, handoffTarget, [
      { id: "approach", kind: "Avoidance", start: vec3(0, 0, 0), end: vec3(100, 0, 0), desiredSpeed: 20, clearanceRadius: 8 },
      { id: "terminal", kind: "Terminal", start: vec3(100, 0, 0), end: handoffTarget.position, desiredSpeed: 12, clearanceRadius: 2 }
    ], "handoff-departure");
    const executor = new AutopilotExecutor({ divergenceDistance: 12 });
    executor.lockPlan(plan, initialShip);

    const departedShip = createShip({ position: vec3(99, 20, 0), velocity: vec3(30, 0, 0) });
    const after = executor.step(departedShip, 1 / 30, 2);
    const telemetry = executor.getTelemetry();

    expect(after).toBe(departedShip);
    expect(telemetry.status).toBe("Diverged");
    expect(telemetry.replanRequired).toBe(true);
    expect(telemetry.failureReasonCodes).toContain("OffLockedRoute");
    expect(telemetry.invalidationReasons).toContain("OffLockedRoute");
    expect(telemetry.planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("physically captures a long StopWithinEnvelope terminal segment without overshooting the locked route", () => {
    const initialShip = createShip({ fuel: 200 });
    const longTarget: TargetDescriptor = {
      ...stopCaptureTarget,
      id: "long-terminal-target",
      position: vec3(650, 0, 0)
    };
    const plan = lockedRoutePlan(initialShip, longTarget, [
      { id: "long-terminal", kind: "Terminal", start: initialShip.position, end: longTarget.position, desiredSpeed: 12, clearanceRadius: 2 }
    ], "long-terminal-capture");
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    executor.lockPlan(plan, initialShip);

    let ship = initialShip;
    let peakSpeed = magnitude(ship.velocity);
    for (let tick = 1; tick <= 4_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
      peakSpeed = Math.max(peakSpeed, magnitude(ship.velocity));
    }

    const telemetry = executor.getTelemetry();
    expect(telemetry.status).toBe("Arrived");
    expect(telemetry.replanRequired).toBe(false);
    expect(telemetry.failureReasonCodes).toEqual([]);
    expect(telemetry.invalidationReasons).toEqual([]);
    expect(telemetry.completedPlanHash).toBe(plan.planHash);
    expect(distance(ship.position, longTarget.position)).toBeLessThanOrEqual(longTarget.arrivalEnvelope.radius);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(longTarget.arrivalEnvelope.terminalSpeed ?? 0);
    expect(peakSpeed).toBeLessThanOrEqual(12.5);
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

  it("keeps default navigation targets as stop/capture goals instead of 8 m/s arrivals", () => {
    expect(provingGroundTargets.navigationAlpha.arrivalEnvelope).toEqual({ radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" });
    expect(provingGroundTargets.navigationBeta.arrivalEnvelope).toEqual({ radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" });
  });

  it("does not report Arrived near 8 m/s for StopWithinEnvelope targets", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: stopCaptureTarget });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const fastInsideEnvelopeShip = createShip({ position: vec3(99, 0, 0), velocity: vec3(8, 0, 0) });
    const after = stepUntilLongitudinalBraking(executor, fastInsideEnvelopeShip, 2);
    const telemetry = executor.getTelemetry();

    expect(telemetry.status).toBe("Executing");
    expect(telemetry.arrivalPhase).toBe("Capture");
    expect(telemetry.terminalSpeedLimit).toBe(0.5);
    expect(telemetry.currentSpeed).toBeGreaterThan(0.5);
    expect(telemetry.terminalSpeedError).toBeGreaterThan(0);
    expect(telemetry.terminalCaptureActive).toBe(true);
    expect(after.velocity.x).toBeLessThan(fastInsideEnvelopeShip.velocity.x);
    expect(after.position).not.toEqual(plan.target.position);
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
    expect(executor.getTelemetry().arrivalPhase).toBe("Holding");
    expect(executor.getTelemetry().routeLifecycle).toBe("Holding");
    expect(executor.getTelemetry().planHash).toBeNull();
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getTelemetry().lockedPlanActive).toBe(false);
    expect(executor.getTelemetry().stationKeepingActive).toBe(true);
    expect(executor.getTelemetry().canAcceptNewPlan).toBe(true);
    expect(executor.getTelemetry().canSelectNewTarget).toBe(true);
    expect(executor.getLockedPlan()).toBeNull();
    expect(executor.getTelemetry().distanceToTarget).toBeLessThan(1);
    expect(after.position).not.toEqual(insideEnvelopeShip.position);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeLessThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("keeps holding ticks on the FlightController path without a velocity-zero shortcut", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: stopCaptureTarget });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const capturedShip = createShip({ position: vec3(99.2, 0, 0), velocity: vec3(0.2, 0, 0) });
    const firstHold = executor.step(capturedShip, 1 / 30, 2);
    const firstTelemetry = executor.getTelemetry();
    const secondHold = executor.step(firstHold, 1 / 30, 3);
    const secondTelemetry = executor.getTelemetry();

    expect(firstTelemetry.status).toBe("Arrived");
    expect(firstTelemetry.arrivalPhase).toBe("Holding");
    expect(firstTelemetry.terminalHoldingActive).toBe(true);
    expect(firstTelemetry.desiredTerminalVelocity).toEqual(vec3());
    expect(firstTelemetry.planHash).toBeNull();
    expect(firstTelemetry.completedPlanHash).toBe(plan.planHash);
    expect(firstTelemetry.canAcceptNewPlan).toBe(true);
    expect(firstTelemetry.canSelectNewTarget).toBe(true);
    expect(secondTelemetry.status).toBe("Arrived");
    expect(secondTelemetry.planHash).toBeNull();
    expect(secondTelemetry.completedPlanHash).toBe(plan.planHash);
    expect(secondTelemetry.stationKeepingActive).toBe(true);
    expect(executor.getLockedPlan()).toBeNull();
    expect(firstHold.position).not.toEqual(capturedShip.position);
    expect(secondHold.position).not.toEqual(firstHold.position);
    expect(magnitude(firstHold.velocity)).toBeGreaterThan(0);
    expect(magnitude(secondHold.actuatorTelemetry.lastAppliedAcceleration)).toBeGreaterThan(0);
    expect(secondHold.position).not.toEqual(plan.target.position);
  });

  it("keeps braking through the controller when inside the envelope above terminal speed", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const fastInsideEnvelopeShip = createShip({ position: vec3(99, 0, 0), velocity: vec3(50, 0, 0) });
    const after = stepUntilLongitudinalBraking(executor, fastInsideEnvelopeShip, 2);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(after.position).not.toEqual(plan.target.position);
    expect(after.velocity.x).toBeLessThan(fastInsideEnvelopeShip.velocity.x);
    expect(after.actuatorTelemetry.mainThrustActive || after.actuatorTelemetry.rcsTranslationActive).toBe(true);
  });

  it("brakes exact-target StopWithinEnvelope overspeed through terminal PD instead of the zero-direction guard", () => {
    const initialShip = createShip();
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: stopCaptureTarget });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);

    const overspeedAtTarget = createShip({ position: stopCaptureTarget.position, velocity: vec3(8, 0, 0) });
    const after = stepUntilLongitudinalBraking(executor, overspeedAtTarget, 2);
    const telemetry = executor.getTelemetry();

    expect(telemetry.status).toBe("Executing");
    expect(telemetry.arrivalPhase).toBe("Capture");
    expect(telemetry.terminalCaptureActive).toBe(true);
    expect(telemetry.terminalHoldingActive).toBe(false);
    expect(after.velocity.x).toBeLessThan(overspeedAtTarget.velocity.x);
    expect(after.actuatorTelemetry.lastAppliedAcceleration.x).toBeLessThan(0);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
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
    expect(executor.getTelemetry().completedPlanHash).toBeNull();
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
    expect(executor.getTelemetry().planHash).toBeNull();
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()).toBeNull();
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
    expect(executor.getTelemetry().completedPlanHash).toBeNull();
  });

  it("preserves fly-through telemetry for fast NoStopRequired arrivals when no terminal speed is requested", () => {
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
    const arrivalTelemetry = executor.getTelemetry();
    const afterIdleTick = executor.step(after, 1 / 30, 3);
    const idleTelemetry = executor.getTelemetry();

    expect(arrivalTelemetry.status).toBe("Arrived");
    expect(arrivalTelemetry.routeLifecycle).toBe("Arrived");
    expect(arrivalTelemetry.arrivalPhase).toBe("None");
    expect(arrivalTelemetry.terminalSpeedLimit).toBeNull();
    expect(arrivalTelemetry.terminalCaptureActive).toBe(false);
    expect(arrivalTelemetry.terminalHoldingActive).toBe(false);
    expect(arrivalTelemetry.stationKeepingActive).toBe(false);
    expect(arrivalTelemetry.lockedPlanActive).toBe(false);
    expect(arrivalTelemetry.planHash).toBeNull();
    expect(arrivalTelemetry.completedPlanHash).toBe(plan.planHash);
    expect(distance(after.position, plan.target.position)).toBeLessThanOrEqual(noStopTarget.arrivalEnvelope.radius);
    expect(after.position).not.toEqual(plan.target.position);
    expect(magnitude(after.velocity)).toBeGreaterThan(100);
    expect(idleTelemetry.status).toBe("Idle");
    expect(idleTelemetry.routeLifecycle).toBe("Idle");
    expect(idleTelemetry.stationKeepingActive).toBe(false);
    expect(idleTelemetry.terminalHoldingActive).toBe(false);
    expect(idleTelemetry.planHash).toBeNull();
    expect(idleTelemetry.completedPlanHash).toBe(plan.planHash);
    expect(afterIdleTick.position).not.toEqual(plan.target.position);
    expect(magnitude(afterIdleTick.velocity)).toBeCloseTo(magnitude(after.velocity), 8);
    expect(magnitude(afterIdleTick.actuatorTelemetry.lastAppliedAcceleration)).toBe(0);
    expect(afterIdleTick.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(executor.getLockedPlan()).toBeNull();
  });

  it("clears terminal station-keeping when a new route is locked after arrival", () => {
    const initialShip = createShip();
    const firstPlan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: stopCaptureTarget });
    const secondTarget: TargetDescriptor = { ...target, id: "second", position: vec3(140, 0, 0) };
    const executor = new AutopilotExecutor({ divergenceDistance: 80 });
    executor.lockPlan(firstPlan, initialShip);

    const holdingShip = executor.step(createShip({ position: vec3(99.2, 0, 0), velocity: vec3(0.2, 0, 0) }), 1 / 30, 2);
    expect(executor.getTelemetry().stationKeepingActive).toBe(true);
    expect(executor.getTelemetry().canAcceptNewPlan).toBe(true);

    const secondPlan = new DirectLocalPlanner().plan({ tick: 3, ship: holdingShip, target: secondTarget });
    executor.lockPlan(secondPlan, holdingShip, 3);

    expect(executor.getLockedPlan()?.planHash).toBe(secondPlan.planHash);
    expect(executor.getTelemetry().routeLifecycle).toBe("Executing");
    expect(executor.getTelemetry().planHash).toBe(secondPlan.planHash);
    expect(executor.getTelemetry().completedPlanHash).toBe(firstPlan.planHash);
    expect(executor.getTelemetry().stationKeepingActive).toBe(false);
    expect(executor.getTelemetry().canAcceptNewPlan).toBe(false);
    expect(executor.getTelemetry().canSelectNewTarget).toBe(false);
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
