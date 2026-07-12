import { describe, expect, it } from "vitest";
import { AutopilotExecutor } from "../../src/flight/executor";
import { orientationFromForward, rotateVectorByQuaternion } from "../../src/flight/flightController";
import { createAuthorityState, createShipStateV2 } from "../../src/flight/state";
import type { ExecutorTelemetry, LockedTransitPhase, RoutePlan, ShipState, TargetDescriptor } from "../../src/core/types";
import { distance, dot, magnitude, normalize, sub, vec3 } from "../../src/core/vector";
import { DirectLocalPlanner, ObstacleAvoidanceLocalPlanner } from "../../src/navigation/planners";
import { bangBangFixedDeltaSeconds, getBangBangTransitScenario } from "../../src/test-harness/autopilotBangBangMetrics";
import { getAutopilotProvingGroundCourse } from "../../src/world/autopilotProvingGroundCourses";
import { playableLargeFieldRuntimeObstacles, playableLargeFieldTargets } from "../../src/world/provingGroundWorld";

const authority = createAuthorityState({ mode: "Autopilot" });

const createShip = (overrides: Parameters<typeof createShipStateV2>[0] = {}): ShipState => createShipStateV2({
  position: vec3(),
  velocity: vec3(),
  fuel: 200,
  authority,
  ...overrides
});

const stopTarget = (id: string, position: ReturnType<typeof vec3>): TargetDescriptor => ({
  id,
  label: id,
  kind: "Waypoint",
  position,
  arrivalEnvelope: { radius: 2, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
});

const consecutivePhases = (phases: readonly LockedTransitPhase[]): readonly LockedTransitPhase[] =>
  phases.filter((phase, index) => index === 0 || phase !== phases[index - 1]);

const publicPendingRampDownDeltaVMps = (currentCommandMps2: number, maximumJerkMps3: number, fixedDeltaSeconds: number): number => {
  if (
    !Number.isFinite(currentCommandMps2) || currentCommandMps2 < 0 ||
    !Number.isFinite(maximumJerkMps3) || maximumJerkMps3 <= 0 ||
    !Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0
  ) {
    return Number.NaN;
  }

  const maximumChangeMps2 = maximumJerkMps3 * fixedDeltaSeconds;
  if (!Number.isFinite(maximumChangeMps2) || maximumChangeMps2 <= 1e-9) {
    return Number.NaN;
  }

  let remainingCommandMps2 = currentCommandMps2;
  let pendingDeltaVMps = 0;
  for (let step = 0; step < 100_000 && remainingCommandMps2 > 1e-9; step += 1) {
    remainingCommandMps2 = Math.max(0, remainingCommandMps2 - maximumChangeMps2);
    pendingDeltaVMps += remainingCommandMps2 * fixedDeltaSeconds;
  }
  return remainingCommandMps2 <= 1e-9 ? pendingDeltaVMps : Number.NaN;
};

const terminalCloseCorrectionWindowObserved = (
  beforeShip: ShipState,
  beforeTelemetry: ExecutorTelemetry,
  afterTelemetry: ExecutorTelemetry,
  plan: RoutePlan
): boolean => {
  const segment = plan.segments[plan.segments.length - 1];
  const terminalSpeedMps = Math.min(0.5, plan.target.arrivalEnvelope.terminalSpeed ?? 0.5);
  const pendingRampDownDeltaVMps = publicPendingRampDownDeltaVMps(
    beforeTelemetry.commandedPoweredAccelerationMps2 ?? 0,
    plan.motionProfile?.maximumJerkMps3 ?? Number.NaN,
    bangBangFixedDeltaSeconds
  );
  const signedAlongRouteSpeedMps = dot(beforeShip.velocity, normalize(sub(segment.end, segment.start)));
  return beforeTelemetry.motionPhase === "Brake" &&
    afterTelemetry.status === "Executing" &&
    afterTelemetry.motionPhase === "Brake" &&
    afterTelemetry.arrivalPhase === "TerminalBrake" &&
    !afterTelemetry.terminalCaptureActive &&
    Number.isFinite(pendingRampDownDeltaVMps) &&
    signedAlongRouteSpeedMps <= terminalSpeedMps + pendingRampDownDeltaVMps + 0.05;
};

interface ExecutorTestInternals {
  commandedPoweredAccelerationMps2: number;
  activeSegmentIndex: number;
  activeMotionPhase: LockedTransitPhase | null;
  brakingCommitted: boolean;
  pendingRampDownDeltaVMps(maximumJerkMps3: number, fixedDeltaSeconds: number): number;
  advanceToNextSegment(
    plan: RoutePlan,
    segment: RoutePlan["segments"][number],
    ship: ShipState,
    fixedDeltaSeconds: number
  ): void;
}

const testInternals = (executor: AutopilotExecutor): ExecutorTestInternals => executor as unknown as ExecutorTestInternals;

describe("locked bang-bang transit execution", () => {
  it("uses deterministic AlignForBurn, Accelerate, Flip, Brake, TerminalCapture, and Holding phases without a CrewSprint coast", () => {
    const initialShip = createShip({ orientation: orientationFromForward(vec3(0, 0, 1)) });
    const target = stopTarget("ordered-transit", vec3(600, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const run = (): { readonly phases: readonly LockedTransitPhase[]; readonly ship: ShipState; readonly executor: AutopilotExecutor } => {
      const executor = new AutopilotExecutor({ divergenceDistance: 50 });
      executor.lockPlan(plan, initialShip);
      let ship = initialShip;
      const phases: LockedTransitPhase[] = [];
      for (let tick = 1; tick <= 10_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
        ship = executor.step(ship, 1 / 30, tick);
        const phase = executor.getTelemetry().motionPhase;
        if (phase) {
          phases.push(phase);
        }
      }
      return { phases, ship, executor };
    };

    const first = run();
    const second = run();
    const ordered = consecutivePhases(first.phases);
    const indexOf = (phase: LockedTransitPhase): number => ordered.indexOf(phase);

    expect(first.phases).toEqual(second.phases);
    expect(first.executor.getTelemetry().status).toBe("Arrived");
    expect(first.executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(first.executor.getLockedPlan()).toBeNull();
    expect(indexOf("AlignForBurn")).toBeGreaterThanOrEqual(0);
    expect(indexOf("Accelerate")).toBeGreaterThan(indexOf("AlignForBurn"));
    expect(indexOf("Flip")).toBeGreaterThan(indexOf("Accelerate"));
    expect(indexOf("Brake")).toBeGreaterThan(indexOf("Flip"));
    expect(indexOf("TerminalCapture")).toBeGreaterThan(indexOf("Brake"));
    expect(indexOf("Holding")).toBeGreaterThan(indexOf("TerminalCapture"));
    expect(ordered).not.toContain("Coast");
    expect(distance(first.ship.position, target.position)).toBeLessThanOrEqual(target.arrivalEnvelope.radius);
    expect(magnitude(first.ship.velocity)).toBeLessThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("starts a finite physical 180-degree flip before braking instead of reversing velocity or orientation", () => {
    const brakingShip = createShip({ position: vec3(640, 0, 0), velocity: vec3(60, 0, 0), sasEnabled: false });
    const target = stopTarget("flip-before-brake", vec3(1_150, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: brakingShip, target, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, brakingShip);

    const first = executor.step(brakingShip, 1 / 30, 1);
    const firstOrientation = first.orientation;
    let ship = first;
    let flipTicks = 0;
    let appliedBraking = false;
    let velocityBeforeAppliedBraking = ship.velocity.x;
    for (let tick = 2; tick <= 600 && !appliedBraking; tick += 1) {
      velocityBeforeAppliedBraking = ship.velocity.x;
      ship = executor.step(ship, 1 / 30, tick);
      if (executor.getTelemetry().motionPhase === "Flip") {
        flipTicks += 1;
      }
      appliedBraking = dot(ship.actuatorTelemetry.lastAppliedAcceleration, brakingShip.velocity) < 0;
    }

    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(first.position).not.toEqual(plan.target.position);
    expect(flipTicks).toBeGreaterThan(1);
    expect(appliedBraking).toBe(true);
    expect(ship.orientation).not.toEqual(firstOrientation);
    expect(dot(ship.actuatorTelemetry.lastAppliedAcceleration, brakingShip.velocity)).toBeLessThan(0);
    expect(ship.velocity.x).toBeLessThan(velocityBeforeAppliedBraking);
  });

  it("retains the immutable locked profile hash while live mass changes alter execution authority", () => {
    const initialShip = createShip();
    const target = stopTarget("live-mass", vec3(300, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const profileBefore = JSON.stringify(plan.motionProfile);
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, initialShip);

    const after = executor.step(createShip({ dryMass: 4_000 }), 1 / 30, 1);

    expect(after.mass.totalMass).toBeGreaterThan(initialShip.mass.totalMass);
    expect(executor.getLockedPlan()).not.toBe(plan);
    expect(executor.getLockedPlan()).toStrictEqual(plan);
    expect(Object.isFrozen(executor.getLockedPlan())).toBe(true);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(JSON.stringify(plan.motionProfile)).toBe(profileBefore);
    expect(executor.getTelemetry().replanRequired).toBe(false);
  });

  it("limits both burn ramp-up and ramp-down command deltas to the locked jerk ceiling", () => {
    const initialShip = createShip({ orientation: orientationFromForward(vec3(0, 0, 1)) });
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target: stopTarget("jerk-symmetric", vec3(600, 0, 0)), transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, initialShip);
    const maxDelta = (plan.motionProfile?.maximumJerkMps3 ?? 0) / 30 + 1e-6;
    let ship = initialShip;
    let previousCommand = 0;
    let observedRampDown = false;

    for (let tick = 1; tick <= 10_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
      const command = executor.getTelemetry().commandedPoweredAccelerationMps2 ?? 0;
      if (executor.getTelemetry().status === "Executing") {
        expect(Math.abs(command - previousCommand), `tick ${tick}`).toBeLessThanOrEqual(maxDelta);
        observedRampDown = observedRampDown || command < previousCommand - 1e-6;
        previousCommand = command;
      }
    }

    expect(observedRampDown).toBe(true);
  });

  it("uses the exact discrete post-update ramp-down delta-v before latching terminal committed-brake correction", () => {
    const executor = new AutopilotExecutor();
    const internals = testInternals(executor);
    internals.commandedPoweredAccelerationMps2 = 60;

    expect(internals.pendingRampDownDeltaVMps(60, 1 / 30)).toBeCloseTo(29, 10);
    expect(internals.pendingRampDownDeltaVMps(Number.NaN, 1 / 30)).toBeNaN();
  });

  it("publishes terminal-brake correction before terminal capture while retaining physical caps and terminal completion", () => {
    const scenario = getBangBangTransitScenario("drone-sprint-high-g-1000m");
    const plan = new DirectLocalPlanner().plan({
      tick: 0,
      ship: scenario.initialShip,
      target: scenario.target,
      transitPolicy: scenario.transitPolicy
    });
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    executor.lockPlan(plan, scenario.initialShip);

    const routeDirection = normalize(sub(plan.segments[plan.segments.length - 1].end, plan.segments[plan.segments.length - 1].start));
    const maximumJerkMps3 = plan.motionProfile?.maximumJerkMps3 ?? 0;
    const maximumCommandDeltaMps2 = maximumJerkMps3 * bangBangFixedDeltaSeconds + 1e-6;
    let ship = scenario.initialShip;
    let previousCommandMps2 = 0;
    let previousAppliedMainAccelerationMps2 = 0;
    let previousMainThrustActive = false;
    let peakAppliedG = 0;
    let terminalBrakeSpeedMps: number | null = null;
    let terminalBrakeObserved = false;
    let terminalCloseCorrectionWindow = false;
    let terminalCaptureObserved = false;

    for (let tick = 1; tick <= scenario.maxTicks && executor.getTelemetry().status === "Executing"; tick += 1) {
      const beforeShip = ship;
      const beforeTelemetry = executor.getTelemetry();
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      const telemetry = executor.getTelemetry();
      const commandMps2 = telemetry.commandedPoweredAccelerationMps2 ?? 0;
      const appliedMainAccelerationMps2 = ship.actuatorTelemetry.appliedMainAccelerationMps2 ?? 0;
      const combinedAccelerationLimitMps2 = ship.actuatorTelemetry.combinedAccelerationLimitMps2 ?? 0;
      const actualMainThrustDirection = ship.actuatorTelemetry.actualMainThrustDirection ?? vec3();

      if (telemetry.status === "Executing") {
        expect(Math.abs(commandMps2 - previousCommandMps2), `command jerk at tick ${tick}`).toBeLessThanOrEqual(maximumCommandDeltaMps2);
        if (previousMainThrustActive && ship.actuatorTelemetry.mainThrustActive) {
          expect(Math.abs(appliedMainAccelerationMps2 - previousAppliedMainAccelerationMps2), `continuous actual main jerk at tick ${tick}`).toBeLessThanOrEqual(maximumCommandDeltaMps2);
        }
      }
      expect(magnitude(ship.actuatorTelemetry.lastAppliedAcceleration), `combined cap at tick ${tick}`).toBeLessThanOrEqual(combinedAccelerationLimitMps2 + 1e-6);
      if (ship.actuatorTelemetry.mainThrustActive) {
        const localPositiveX = normalize(rotateVectorByQuaternion(ship.orientation, vec3(1, 0, 0)));
        expect(dot(actualMainThrustDirection, localPositiveX), `body-forward thrust at tick ${tick}`).toBeGreaterThan(0.999);
      }

      if (!terminalBrakeObserved && telemetry.motionPhase === "Brake" && telemetry.arrivalPhase === "TerminalBrake") {
        terminalBrakeObserved = true;
        terminalBrakeSpeedMps = dot(beforeShip.velocity, routeDirection);
      }
      terminalCloseCorrectionWindow = terminalCloseCorrectionWindow || terminalCloseCorrectionWindowObserved(beforeShip, beforeTelemetry, telemetry, plan);
      if (telemetry.terminalCaptureActive || telemetry.motionPhase === "TerminalCapture") {
        expect(terminalBrakeObserved, `no early terminal capture at tick ${tick}`).toBe(true);
        expect(terminalCloseCorrectionWindow, `no early terminal close correction at tick ${tick}`).toBe(true);
        terminalCaptureObserved = true;
      }
      if (terminalBrakeObserved && !terminalCaptureObserved) {
        expect(telemetry.motionPhase, `committed terminal phase at tick ${tick}`).toBe("Brake");
      }

      peakAppliedG = Math.max(peakAppliedG, magnitude(ship.actuatorTelemetry.lastAppliedAcceleration) / 9.80665);
      previousCommandMps2 = commandMps2;
      previousAppliedMainAccelerationMps2 = appliedMainAccelerationMps2;
      previousMainThrustActive = ship.actuatorTelemetry.mainThrustActive;
    }

    expect(terminalBrakeObserved).toBe(true);
    expect(terminalBrakeSpeedMps).not.toBeNull();
    expect(terminalBrakeSpeedMps ?? 0).toBeGreaterThan(0);
    expect(terminalCloseCorrectionWindow).toBe(true);
    expect(terminalCaptureObserved).toBe(true);
    expect(peakAppliedG).toBeCloseTo(6.1183, 4);
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(distance(ship.position, scenario.target.position)).toBeCloseTo(1.4528, 4);
    expect(magnitude(ship.velocity)).toBeCloseTo(0.496, 4);
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getTelemetry().replanRequired).toBe(false);
  });

  it("resets and re-latches terminal close correction through two public route lifecycles", () => {
    const scenario = getBangBangTransitScenario("drone-sprint-high-g-1000m");
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    const firstPlan = new DirectLocalPlanner().plan({
      tick: 0,
      ship: scenario.initialShip,
      target: scenario.target,
      transitPolicy: scenario.transitPolicy
    });
    executor.lockPlan(firstPlan, scenario.initialShip);

    let ship = scenario.initialShip;
    let tick = 1;
    let firstTerminalBrakeObserved = false;
    let firstTerminalCloseCorrectionWindow = false;
    const firstPhases: LockedTransitPhase[] = [];
    for (; tick <= scenario.maxTicks && executor.getTelemetry().status === "Executing"; tick += 1) {
      const beforeShip = ship;
      const beforeTelemetry = executor.getTelemetry();
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      const telemetry = executor.getTelemetry();
      if (telemetry.motionPhase) {
        firstPhases.push(telemetry.motionPhase);
      }
      firstTerminalBrakeObserved = firstTerminalBrakeObserved || (telemetry.motionPhase === "Brake" && telemetry.arrivalPhase === "TerminalBrake");
      firstTerminalCloseCorrectionWindow = firstTerminalCloseCorrectionWindow || terminalCloseCorrectionWindowObserved(beforeShip, beforeTelemetry, telemetry, firstPlan);
      if (telemetry.terminalCaptureActive) {
        expect(firstTerminalBrakeObserved, `first route terminal gate at tick ${tick}`).toBe(true);
        expect(firstTerminalCloseCorrectionWindow, `first route close correction at tick ${tick}`).toBe(true);
      }
    }

    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().completedPlanHash).toBe(firstPlan.planHash);
    expect(firstTerminalBrakeObserved).toBe(true);
    expect(firstTerminalCloseCorrectionWindow).toBe(true);
    expect(consecutivePhases(firstPhases)).toEqual(expect.arrayContaining(["Accelerate", "Flip", "Brake", "TerminalCapture", "Holding"]));

    const secondTarget = stopTarget("close-correction-second-route", vec3(scenario.target.position.x + 1_000, scenario.target.position.y, scenario.target.position.z));
    const secondPlan = new DirectLocalPlanner().plan({
      tick,
      ship,
      target: secondTarget,
      transitPolicy: scenario.transitPolicy
    });
    executor.lockPlan(secondPlan, ship, tick);

    expect(executor.getTelemetry().status).toBe("Executing");
    expect(executor.getTelemetry().planHash).toBe(secondPlan.planHash);
    expect(executor.getTelemetry().completedPlanHash).toBe(firstPlan.planHash);
    expect(executor.getTelemetry().stationKeepingActive).toBe(false);

    const secondFirstShip = ship;
    const secondBeforeTelemetry = executor.getTelemetry();
    ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
    let telemetry = executor.getTelemetry();
    const secondPhases: LockedTransitPhase[] = telemetry.motionPhase ? [telemetry.motionPhase] : [];
    let secondTerminalBrakeObserved = telemetry.motionPhase === "Brake" && telemetry.arrivalPhase === "TerminalBrake";
    let secondTerminalCloseCorrectionWindow = terminalCloseCorrectionWindowObserved(secondFirstShip, secondBeforeTelemetry, telemetry, secondPlan);

    expect(telemetry.status).toBe("Executing");
    expect(["AlignForBurn", "Accelerate"]).toContain(telemetry.motionPhase);
    expect(telemetry.arrivalPhase).toBe("None");
    expect(telemetry.planHash).toBe(secondPlan.planHash);
    expect(telemetry.completedPlanHash).toBe(firstPlan.planHash);

    for (tick += 1; tick <= scenario.maxTicks * 2 && executor.getTelemetry().status === "Executing"; tick += 1) {
      const beforeShip = ship;
      const beforeTelemetry = executor.getTelemetry();
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      telemetry = executor.getTelemetry();
      if (telemetry.motionPhase) {
        secondPhases.push(telemetry.motionPhase);
      }
      secondTerminalBrakeObserved = secondTerminalBrakeObserved || (telemetry.motionPhase === "Brake" && telemetry.arrivalPhase === "TerminalBrake");
      secondTerminalCloseCorrectionWindow = secondTerminalCloseCorrectionWindow || terminalCloseCorrectionWindowObserved(beforeShip, beforeTelemetry, telemetry, secondPlan);
      if (telemetry.terminalCaptureActive) {
        expect(secondTerminalBrakeObserved, `second route terminal gate at tick ${tick}`).toBe(true);
        expect(secondTerminalCloseCorrectionWindow, `second route close correction at tick ${tick}`).toBe(true);
      }
      expect(telemetry.status === "Executing" ? telemetry.planHash : telemetry.completedPlanHash, `second route hash at tick ${tick}`).toBe(secondPlan.planHash);
    }

    const secondPhaseOrder = consecutivePhases(secondPhases);
    const secondPhaseIndex = (phase: LockedTransitPhase): number => secondPhaseOrder.indexOf(phase);
    expect(secondTerminalBrakeObserved).toBe(true);
    expect(secondTerminalCloseCorrectionWindow).toBe(true);
    expect(secondPhaseIndex("Accelerate")).toBeGreaterThanOrEqual(0);
    expect(secondPhaseIndex("Flip")).toBeGreaterThan(secondPhaseIndex("Accelerate"));
    expect(secondPhaseIndex("Brake")).toBeGreaterThan(secondPhaseIndex("Flip"));
    expect(secondPhaseIndex("TerminalCapture")).toBeGreaterThan(secondPhaseIndex("Brake"));
    expect(secondPhaseIndex("Holding")).toBeGreaterThan(secondPhaseIndex("TerminalCapture"));
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().completedPlanHash).toBe(secondPlan.planHash);
    expect(executor.getTelemetry().replanRequired).toBe(false);
    expect(distance(ship.position, secondTarget.position)).toBeLessThanOrEqual(secondTarget.arrivalEnvelope.radius);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(secondTarget.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it.each(["CrewComfort", "CrewSprint"] as const)("reserves projected post-ramp angular drift for %s before stable reverse thrust", (transitPolicy) => {
    const initialShip = createShip();
    const target = stopTarget(`post-ramp-angular-drift-${transitPolicy}`, vec3(1_000, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy });
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, initialShip);

    const maximumJerkMps3 = plan.motionProfile?.maximumJerkMps3 ?? 0;
    const maximumCommandDeltaMps2 = maximumJerkMps3 * bangBangFixedDeltaSeconds + 1e-6;
    let ship = initialShip;
    let previousCommandMps2 = 0;
    let flipStartSpeedMps: number | null = null;
    let projectedPostRampSpeedMps: number | null = null;
    let flipStartPositionM: number | null = null;
    let flipStartTick: number | null = null;
    let rampDownReserveM: number | null = null;
    let correctedAngularDriftReserveM: number | null = null;
    let staleAngularDriftReserveM: number | null = null;
    let observedRampDownAndAngularDriftM: number | null = null;
    let stableReverseThrustObserved = false;
    const phases: LockedTransitPhase[] = [];

    for (let tick = 1; tick <= 10_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
      const beforeShip = ship;
      const beforeTelemetry = executor.getTelemetry();
      const beforeCommandMps2 = beforeTelemetry.commandedPoweredAccelerationMps2 ?? 0;
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      const telemetry = executor.getTelemetry();
      const commandMps2 = telemetry.commandedPoweredAccelerationMps2 ?? 0;

      if (telemetry.motionPhase) {
        phases.push(telemetry.motionPhase);
      }
      expect(telemetry.status === "Executing" ? telemetry.planHash : telemetry.completedPlanHash, `tick ${tick}`).toBe(plan.planHash);
      expect(telemetry.replanRequired, `tick ${tick}`).toBe(false);
      if (telemetry.status === "Executing") {
        expect(Math.abs(commandMps2 - previousCommandMps2), `symmetric jerk at tick ${tick}`).toBeLessThanOrEqual(maximumCommandDeltaMps2);
        previousCommandMps2 = commandMps2;
      }

      if (
        beforeTelemetry.motionPhase === "Accelerate" &&
        telemetry.motionPhase === "Flip" &&
        beforeCommandMps2 > 1e-6
      ) {
        const rampDownSeconds = beforeCommandMps2 / maximumJerkMps3;
        flipStartSpeedMps = Math.max(0, beforeShip.velocity.x);
        projectedPostRampSpeedMps = flipStartSpeedMps + 0.5 * beforeCommandMps2 * rampDownSeconds;
        flipStartPositionM = beforeShip.position.x;
        flipStartTick = tick - 1;
        rampDownReserveM = flipStartSpeedMps * rampDownSeconds + beforeCommandMps2 * rampDownSeconds * rampDownSeconds / 3;
      }

      if (
        flipStartPositionM !== null &&
        flipStartTick !== null &&
        rampDownReserveM !== null &&
        projectedPostRampSpeedMps !== null &&
        flipStartSpeedMps !== null &&
        ship.actuatorTelemetry.mainThrustActive &&
        ship.actuatorTelemetry.lastAppliedAcceleration.x < -1e-6
      ) {
        const observedStableFlipSeconds = (tick - flipStartTick) * bangBangFixedDeltaSeconds;
        const angularSettlingSeconds =
          (plan.motionProfile?.propulsionCapability.maximumAngularVelocity ?? 0) /
          Math.max(plan.motionProfile?.propulsionCapability.maximumAngularAcceleration ?? 0, 1e-9);
        observedRampDownAndAngularDriftM = ship.position.x - flipStartPositionM;
        correctedAngularDriftReserveM = rampDownReserveM + projectedPostRampSpeedMps * (observedStableFlipSeconds + angularSettlingSeconds);
        staleAngularDriftReserveM = rampDownReserveM + flipStartSpeedMps * (observedStableFlipSeconds + angularSettlingSeconds);
        const actualMainThrustDirection = telemetry.actualMainThrustDirection ?? vec3();
        const localPositiveX = normalize(rotateVectorByQuaternion(ship.orientation, vec3(1, 0, 0)));
        expect(dot(actualMainThrustDirection, localPositiveX)).toBeGreaterThan(0.999);
        expect(telemetry.mainThrustAlignmentErrorRadians ?? Number.MAX_VALUE).toBeLessThanOrEqual((plan.motionProfile?.mainThrustAlignmentToleranceRadians ?? 0) + 1e-6);
        stableReverseThrustObserved = true;
      }
    }

    const ordered = consecutivePhases(phases);
    const indexOf = (phase: LockedTransitPhase): number => ordered.indexOf(phase);
    expect(flipStartSpeedMps).not.toBeNull();
    expect(projectedPostRampSpeedMps).toBeGreaterThan(flipStartSpeedMps ?? Number.MAX_VALUE);
    expect(observedRampDownAndAngularDriftM).not.toBeNull();
    expect(correctedAngularDriftReserveM).not.toBeNull();
    expect(staleAngularDriftReserveM).not.toBeNull();
    expect(correctedAngularDriftReserveM ?? 0).toBeGreaterThanOrEqual((observedRampDownAndAngularDriftM ?? Number.MAX_VALUE) - 0.05);
    expect(correctedAngularDriftReserveM ?? 0).toBeGreaterThan(staleAngularDriftReserveM ?? Number.MAX_VALUE);
    expect(stableReverseThrustObserved).toBe(true);
    expect(indexOf("Accelerate")).toBeGreaterThanOrEqual(0);
    expect(indexOf("Flip")).toBeGreaterThan(indexOf("Accelerate"));
    expect(indexOf("Brake")).toBeGreaterThan(indexOf("Flip"));
    expect(indexOf("TerminalCapture")).toBeGreaterThan(indexOf("Brake"));
    expect(indexOf("Holding")).toBeGreaterThan(indexOf("TerminalCapture"));
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getTelemetry().replanRequired).toBe(false);
    expect(distance(ship.position, target.position)).toBeLessThanOrEqual(target.arrivalEnvelope.radius);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(target.arrivalEnvelope.terminalSpeed ?? 0);
  });

  it("keeps terminal capture and holding controller-integrated without snapping position or zeroing velocity", () => {
    const initialShip = createShip();
    const target = stopTarget("terminal-holding", vec3(100, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor({ divergenceDistance: 50 });
    executor.lockPlan(plan, initialShip);

    let ship = executor.step(createShip({ position: vec3(99.2, 0, 0), velocity: vec3(0.2, 0, 0), sasEnabled: false }), 1 / 30, 1);
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().motionPhase).toBe("Holding");
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(ship.position).not.toEqual(target.position);

    for (let tick = 2; tick <= 300 && magnitude(ship.actuatorTelemetry.lastAppliedAcceleration) <= 1e-6; tick += 1) {
      ship = executor.step(ship, 1 / 30, tick);
    }

    expect(executor.getTelemetry().routeLifecycle).toBe("Holding");
    expect(executor.getTelemetry().motionPhase).toBe("Holding");
    expect(executor.getTelemetry().stationKeepingActive).toBe(true);
    expect(ship.position).not.toEqual(target.position);
    expect(magnitude(ship.velocity)).toBeGreaterThan(0);
    expect(magnitude(ship.actuatorTelemetry.lastAppliedAcceleration)).toBeGreaterThan(0);
  });

  it("fails closed with the locked hash intact when live attitude authority is unavailable", () => {
    const initialShip = createShip();
    const target = stopTarget("missing-attitude-authority", vec3(300, 0, 0));
    const plan = new DirectLocalPlanner().plan({ tick: 1, ship: initialShip, target, transitPolicy: "CrewSprint" });
    const executor = new AutopilotExecutor();
    executor.lockPlan(plan, initialShip);
    const noRcs = createShip({ rcsEnabled: false, sasEnabled: false });

    const after = executor.step(noRcs, 1 / 30, 1);

    expect(after).toBe(noRcs);
    expect(executor.getTelemetry().status).toBe("NoAuthority");
    expect(executor.getTelemetry().replanRequired).toBe(true);
    expect(executor.getTelemetry().invalidationReasons).toContain("AuthorityInsufficient");
    expect(executor.getTelemetry().planHash).toBe(plan.planHash);
    expect(executor.getLockedPlan()?.planHash).toBe(plan.planHash);
  });

  it("uses bounded physical RCS to remove lateral initial velocity before locked-route divergence", () => {
    const course = getAutopilotProvingGroundCourse("lateral-initial-velocity");
    const plan = new DirectLocalPlanner().plan({ tick: 0, ship: course.initialShip, target: course.target, speedProfile: "Balanced" });
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    executor.lockPlan(plan, course.initialShip);

    let ship = executor.step(course.initialShip, bangBangFixedDeltaSeconds, 1);
    let maximumOffRouteDistance = executor.getTelemetry().offRouteDistance;
    let observedRcsTranslation = ship.actuatorTelemetry.rcsTranslationActive;

    // The first fixed step must retain real cross-track momentum; neither the
    // position nor the velocity may be snapped to the locked direct route.
    expect(ship.position).not.toEqual(course.target.position);
    expect(Math.abs(ship.velocity.y)).toBeGreaterThan(0);

    for (let tick = 2; tick <= course.acceptance.maxTicks && executor.getTelemetry().status === "Executing"; tick += 1) {
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      maximumOffRouteDistance = Math.max(maximumOffRouteDistance, executor.getTelemetry().offRouteDistance);
      observedRcsTranslation = observedRcsTranslation || ship.actuatorTelemetry.rcsTranslationActive;
    }

    expect(observedRcsTranslation).toBe(true);
    expect(maximumOffRouteDistance).toBeLessThan(30);
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(distance(ship.position, course.target.position)).toBeLessThanOrEqual(3);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(0.5);
    expect(executor.getTelemetry().replanRequired).toBe(false);
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
  });

  it("keeps the origin-to-Range-500m obstacle route inside the locked corridor through both waypoint handoffs", () => {
    const initialShip = createShip({ fuel: 100 });
    const plan = new ObstacleAvoidanceLocalPlanner().plan({
      tick: 0,
      ship: initialShip,
      target: playableLargeFieldTargets.range500,
      obstacles: playableLargeFieldRuntimeObstacles,
      speedProfile: "Balanced"
    });
    const executor = new AutopilotExecutor({ divergenceDistance: 24 });
    executor.lockPlan(plan, initialShip);

    let ship = initialShip;
    let maximumOffRouteDistanceM = 0;
    const observedSegmentIds = new Set<string>();
    for (let tick = 1; tick <= 3_000 && executor.getTelemetry().status === "Executing"; tick += 1) {
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      const telemetry = executor.getTelemetry();
      maximumOffRouteDistanceM = Math.max(maximumOffRouteDistanceM, telemetry.offRouteDistance);
      if (telemetry.activeSegmentId) {
        observedSegmentIds.add(telemetry.activeSegmentId);
      }
    }

    expect([...observedSegmentIds]).toEqual(plan.segments.map((segment) => segment.id));
    expect(maximumOffRouteDistanceM).toBeLessThan(24);
    expect(executor.getTelemetry().tick).toBeLessThanOrEqual(1_600);
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(executor.getTelemetry().replanRequired).toBe(false);
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(distance(ship.position, plan.target.position)).toBeLessThanOrEqual(3);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(0.5);
  });

  it("hands non-collinear corners across at their locked entry speed without spending the terminal leg or changing the plan", () => {
    const scenario = getBangBangTransitScenario("sharp-corner-geometry-1000m");
    const plan = new ObstacleAvoidanceLocalPlanner().plan({
      tick: 0,
      ship: scenario.initialShip,
      target: scenario.target,
      obstacles: scenario.obstacles,
      transitPolicy: scenario.transitPolicy
    });
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    executor.lockPlan(plan, scenario.initialShip);

    const segmentById = (id: string | null) => plan.segments.find((segment) => segment.id === id) ?? null;
    const directionFor = (segment: (typeof plan.segments)[number]) =>
      vec3(
        (segment.end.x - segment.start.x) / distance(segment.start, segment.end),
        (segment.end.y - segment.start.y) / distance(segment.start, segment.end),
        (segment.end.z - segment.start.z) / distance(segment.start, segment.end)
      );
    const handoffToleranceMps = (plan.motionProfile?.plannedUsableBrakingAccelerationMps2 ?? 0) * bangBangFixedDeltaSeconds + 0.05;
    let ship = scenario.initialShip;
    let maxOffRouteDistance = 0;
    let nonCollinearEntryHandoffObserved = false;
    let pendingPositiveRampObserved = false;
    let stableBrakeBeforeExitObserved = false;
    let terminalHandoffSpeedMps: number | null = null;
    let handoffSegmentId: string | null = null;

    for (let tick = 1; tick <= scenario.maxTicks && executor.getTelemetry().status === "Executing"; tick += 1) {
      const beforeTelemetry = executor.getTelemetry();
      const previousSegment = segmentById(beforeTelemetry.activeSegmentId);
      ship = executor.step(ship, bangBangFixedDeltaSeconds, tick);
      const telemetry = executor.getTelemetry();
      maxOffRouteDistance = Math.max(maxOffRouteDistance, telemetry.offRouteDistance);
      const activeSegment = segmentById(telemetry.activeSegmentId);

      if (previousSegment && activeSegment && previousSegment.id !== activeSegment.id) {
        const previousDirection = directionFor(previousSegment);
        const activeDirection = directionFor(activeSegment);
        const previousExitSpeedMps = previousSegment.motionConstraint?.exitSpeedMps ?? previousSegment.desiredSpeed;
        const speedAtPreviousExitMps = Math.max(0, dot(ship.velocity, previousDirection));
        const projectedActiveSpeedMps = Math.max(0, dot(ship.velocity, activeDirection));
        const activeEntrySpeedMps = activeSegment.motionConstraint?.entrySpeedMps ?? activeSegment.desiredSpeed;

        expect(speedAtPreviousExitMps, `${previousSegment.id} exit`).toBeLessThanOrEqual(previousExitSpeedMps + handoffToleranceMps + 0.01);
        if (dot(previousDirection, activeDirection) < 0.999) {
          expect(projectedActiveSpeedMps, `${activeSegment.id} entry`).toBeLessThanOrEqual(activeEntrySpeedMps + handoffToleranceMps);
          expect(telemetry.motionPhase, `${previousSegment.id} -> ${activeSegment.id}`).toBe("AlignForBurn");
          nonCollinearEntryHandoffObserved = true;
          handoffSegmentId = activeSegment.id;
        }
        if (activeSegment.kind === "Terminal") {
          terminalHandoffSpeedMps = speedAtPreviousExitMps;
        }
      }

      if (telemetry.activeSegmentId === handoffSegmentId && telemetry.motionPhase === "AlignForBurn" && (telemetry.commandedPoweredAccelerationMps2 ?? 0) > 1e-6) {
        pendingPositiveRampObserved = true;
      }
      if (
        telemetry.motionPhase === "Brake" &&
        ship.actuatorTelemetry.mainThrustActive &&
        activeSegment &&
        dot(ship.actuatorTelemetry.lastAppliedAcceleration, directionFor(activeSegment)) < 0
      ) {
        stableBrakeBeforeExitObserved = true;
      }
    }

    expect(nonCollinearEntryHandoffObserved).toBe(true);
    expect(pendingPositiveRampObserved).toBe(true);
    expect(stableBrakeBeforeExitObserved).toBe(true);
    expect(terminalHandoffSpeedMps).not.toBeNull();
    const terminalEntrySegment = plan.segments[plan.segments.length - 2];
    expect(terminalHandoffSpeedMps).toBeLessThanOrEqual((terminalEntrySegment.motionConstraint?.exitSpeedMps ?? terminalEntrySegment.desiredSpeed) + handoffToleranceMps + 0.01);
    expect(maxOffRouteDistance).toBeLessThan(30);
    expect(executor.getTelemetry().status).toBe("Arrived");
    expect(distance(ship.position, scenario.target.position)).toBeLessThanOrEqual(3);
    expect(magnitude(ship.velocity)).toBeLessThanOrEqual(0.5);
    expect(executor.getTelemetry().completedPlanHash).toBe(plan.planHash);
    expect(executor.getTelemetry().replanRequired).toBe(false);
  });

  it("retains an overspeed non-collinear handoff as one Flip on the immediate next locked segment", () => {
    const scenario = getBangBangTransitScenario("sharp-corner-geometry-1000m");
    const plan = new ObstacleAvoidanceLocalPlanner().plan({
      tick: 0,
      ship: scenario.initialShip,
      target: scenario.target,
      obstacles: scenario.obstacles,
      transitPolicy: scenario.transitPolicy
    });
    const executor = new AutopilotExecutor({ divergenceDistance: 30 });
    executor.lockPlan(plan, scenario.initialShip);

    const lockedPlan = executor.getLockedPlan();
    expect(lockedPlan).not.toBeNull();
    const currentSegment = lockedPlan!.segments[0];
    const nextSegment = lockedPlan!.segments[1];
    expect(nextSegment).toBeDefined();

    const currentDirection = normalize(sub(currentSegment.end, currentSegment.start));
    const nextDirection = normalize(sub(nextSegment.end, nextSegment.start));
    expect(dot(currentDirection, nextDirection)).toBeLessThan(0.999);

    const nextEntrySpeedMps = nextSegment.motionConstraint?.entrySpeedMps ?? nextSegment.desiredSpeed;
    const entryToleranceMps =
      (nextSegment.motionConstraint?.plannedUsableBrakingAccelerationMps2 ?? 0) * bangBangFixedDeltaSeconds + 0.05;
    const overspeedMps = nextEntrySpeedMps + entryToleranceMps + 1;
    const overspeedShip = createShip({
      position: currentSegment.end,
      velocity: vec3(
        nextDirection.x * overspeedMps,
        nextDirection.y * overspeedMps,
        nextDirection.z * overspeedMps
      )
    });
    expect(dot(overspeedShip.velocity, nextDirection)).toBeGreaterThan(nextEntrySpeedMps + entryToleranceMps);

    const internals = testInternals(executor);
    internals.brakingCommitted = true;
    internals.activeMotionPhase = "Brake";
    const lockedHash = lockedPlan!.planHash;

    internals.advanceToNextSegment(lockedPlan!, currentSegment, overspeedShip, bangBangFixedDeltaSeconds);

    expect(internals.activeSegmentIndex).toBe(1);
    expect(lockedPlan!.segments[internals.activeSegmentIndex].id).toBe(nextSegment.id);
    expect(internals.activeMotionPhase).toBe("Flip");
    expect(internals.brakingCommitted).toBe(true);
    expect(executor.getLockedPlan()?.planHash).toBe(lockedHash);
    expect(executor.getLockedPlan()?.segments.map((segment) => segment.id)).toEqual(
      lockedPlan!.segments.map((segment) => segment.id)
    );
  });
});
