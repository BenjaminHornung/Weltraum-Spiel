import { add, distance, magnitude, normalize, projectPointOnSegment, scale, sub, vec3 } from "../core/vector";
import type { ArrivalEnvelope, ExecutorTelemetry, FailureReasonCode, RoutePlan, RouteSegment, ShipState } from "../core/types";
import { arrivalEnvelopeForTarget, arrivalRadiusForTarget } from "../navigation/validation";
import { accelerationLimitForMass, burnFuel, createFlightSnapshot, createShipStateV2 } from "./state";

export interface AutopilotExecutorOptions {
  readonly maxAcceleration: number;
  readonly maxThrustKilonewtons: number;
  readonly divergenceDistance: number;
}

const defaultOptions: AutopilotExecutorOptions = {
  maxAcceleration: 10,
  maxThrustKilonewtons: 10,
  divergenceDistance: 30
};

const unique = (codes: readonly FailureReasonCode[]): readonly FailureReasonCode[] => [...new Set(codes)];

const capVelocity = (velocity: ShipState["velocity"], terminalSpeed: number | undefined): ShipState["velocity"] => {
  if (terminalSpeed === undefined) {
    return velocity;
  }

  const speed = magnitude(velocity);
  if (speed <= terminalSpeed) {
    return velocity;
  }

  return terminalSpeed <= 0 ? vec3() : scale(normalize(velocity), terminalSpeed);
};

const terminalVelocityForArrival = (velocity: ShipState["velocity"], envelope: ArrivalEnvelope | null): ShipState["velocity"] => {
  const stopBehavior = envelope?.stopBehavior ?? "NoStopRequired";
  if (stopBehavior === "NoStopRequired") {
    return capVelocity(velocity, envelope?.terminalSpeed);
  }

  return envelope?.terminalSpeed === undefined ? vec3() : capVelocity(velocity, envelope.terminalSpeed);
};

const crossedTerminalTarget = (from: ShipState["position"], to: ShipState["position"], target: ShipState["position"], arrivalRadius: number): boolean => {
  if (!Number.isFinite(arrivalRadius) || arrivalRadius < 0) {
    return false;
  }

  const before = sub(target, from);
  const after = sub(target, to);
  const crossesTargetPlane = before.x * after.x + before.y * after.y + before.z * after.z <= 0;
  if (!crossesTargetPlane) {
    return false;
  }

  return distance(target, projectPointOnSegment(target, from, to)) <= arrivalRadius;
};

export class AutopilotExecutor {
  private readonly options: AutopilotExecutorOptions;
  private lockedPlan: RoutePlan | null = null;
  private activeSegmentIndex = 0;
  private telemetry: ExecutorTelemetry;

  constructor(options: Partial<AutopilotExecutorOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.telemetry = this.createTelemetry(0, "Idle", null, this.emptyShip(), false, []);
  }

  lockPlan(plan: RoutePlan, ship: ShipState, tick = this.telemetry.tick): void {
    this.lockedPlan = plan;
    this.activeSegmentIndex = 0;
    this.telemetry = this.createTelemetry(tick, "Executing", plan, ship, false, []);
  }

  cancelPlan(ship: ShipState, tick = this.telemetry.tick): ShipState {
    const stoppedShip: ShipState = { ...ship, velocity: vec3() };
    this.lockedPlan = null;
    this.activeSegmentIndex = 0;
    this.telemetry = this.createTelemetry(tick, "Idle", null, stoppedShip, false, []);
    return stoppedShip;
  }

  getLockedPlan(): RoutePlan | null {
    return this.lockedPlan;
  }

  getTelemetry(): ExecutorTelemetry {
    return this.telemetry;
  }

  step(ship: ShipState, fixedDeltaSeconds: number, tick: number): ShipState {
    const plan = this.lockedPlan;
    if (!plan) {
      const stoppedShip: ShipState = { ...ship, velocity: vec3() };
      this.telemetry = this.createTelemetry(tick, "Idle", null, stoppedShip, false, []);
      return stoppedShip;
    }

    const segment = this.currentSegment(plan);
    const distanceToTarget = distance(ship.position, plan.target.position);
    const arrivalEnvelope = arrivalEnvelopeForTarget(plan.target);
    const arrivalRadius = arrivalRadiusForTarget(plan.target);
    if (Number.isFinite(arrivalRadius) && distanceToTarget <= arrivalRadius) {
      const arrivedShip = { ...ship, position: plan.target.position, velocity: terminalVelocityForArrival(ship.velocity, arrivalEnvelope) };
      this.telemetry = this.createTelemetry(tick, "Arrived", plan, arrivedShip, false, []);
      return arrivedShip;
    }

    const preflight = createFlightSnapshot(ship, plan, this.options);
    if (preflight.failureReasonCodes.includes("FuelDepleted") || preflight.failureReasonCodes.includes("FuelReserveViolated")) {
      this.telemetry = this.createTelemetry(tick, "OutOfFuel", plan, ship, true, preflight.failureReasonCodes);
      return ship;
    }

    if (preflight.failureReasonCodes.includes("AutopilotUnavailable") || preflight.failureReasonCodes.includes("AuthorityInsufficient")) {
      this.telemetry = this.createTelemetry(tick, "NoAuthority", plan, ship, true, preflight.failureReasonCodes);
      return ship;
    }

    if (!preflight.brakingReserve.canBrake) {
      this.telemetry = this.createTelemetry(tick, "BrakeReserveInsufficient", plan, ship, true, preflight.failureReasonCodes);
      return ship;
    }

    const offRouteDistance = this.offRouteDistance(ship.position, segment);
    const invalidationReasons: readonly FailureReasonCode[] = offRouteDistance > this.options.divergenceDistance ? ["OffLockedRoute"] : [];
    if (invalidationReasons.length > 0) {
      this.telemetry = this.createTelemetry(tick, "Diverged", plan, ship, true, invalidationReasons);
      return ship;
    }

    const direction = normalize(sub(segment.end, ship.position));
    const desiredSpeed = Math.min(segment.desiredSpeed, Math.max(4, distance(ship.position, segment.end) * 0.55));
    const speedError = desiredSpeed - magnitude(ship.velocity);
    const accelerationLimit = accelerationLimitForMass(ship.mass, this.options);
    const accelerationMagnitude = Math.max(0, Math.min(accelerationLimit, speedError + 4));
    const acceleration = scale(direction, accelerationMagnitude);
    const nextVelocity = add(ship.velocity, scale(acceleration, fixedDeltaSeconds));
    const nextPosition = add(ship.position, scale(nextVelocity, fixedDeltaSeconds));
    const kilonewtonSeconds = accelerationMagnitude * (ship.mass.totalMass / 1_000) * fixedDeltaSeconds;
    const nextShip: ShipState = burnFuel({
      ...ship,
      position: nextPosition,
      velocity: nextVelocity
    }, kilonewtonSeconds);

    const isTerminalSegment = this.activeSegmentIndex >= plan.segments.length - 1;
    const reachedArrivalEnvelope = isTerminalSegment && distance(nextPosition, plan.target.position) <= arrivalRadius;
    const crossedArrivalTarget = isTerminalSegment && crossedTerminalTarget(ship.position, nextPosition, plan.target.position, arrivalRadius);
    if (reachedArrivalEnvelope || crossedArrivalTarget) {
      const arrivedShip: ShipState = {
        ...nextShip,
        position: plan.target.position,
        velocity: terminalVelocityForArrival(nextVelocity, arrivalEnvelope)
      };
      this.telemetry = this.createTelemetry(tick, "Arrived", plan, arrivedShip, false, []);
      return arrivedShip;
    }

    const reachedRouteWaypoint = !isTerminalSegment && (distance(nextPosition, segment.end) <= 2 || crossedTerminalTarget(ship.position, nextPosition, segment.end, 2));
    if (reachedRouteWaypoint) {
      this.activeSegmentIndex = Math.min(this.activeSegmentIndex + 1, plan.segments.length - 1);
      const waypointShip: ShipState = {
        ...nextShip,
        position: segment.end,
        velocity: vec3()
      };
      this.telemetry = this.createTelemetry(tick, "Executing", plan, waypointShip, false, []);
      return waypointShip;
    }

    if (distance(nextPosition, segment.end) <= 2) {
      this.activeSegmentIndex = Math.min(this.activeSegmentIndex + 1, plan.segments.length - 1);
    }

    this.telemetry = this.createTelemetry(tick, "Executing", plan, nextShip, false, []);
    return nextShip;
  }

  private currentSegment(plan: RoutePlan): RouteSegment {
    return plan.segments[Math.min(this.activeSegmentIndex, plan.segments.length - 1)] ?? plan.segments[0];
  }

  private offRouteDistance(position: ShipState["position"], segment: RouteSegment): number {
    return distance(position, projectPointOnSegment(position, segment.start, segment.end));
  }

  private createTelemetry(
    tick: number,
    status: ExecutorTelemetry["status"],
    plan: RoutePlan | null,
    ship: ShipState,
    replanRequired: boolean,
    invalidationReasons: readonly FailureReasonCode[]
  ): ExecutorTelemetry {
    const segment = plan ? this.currentSegment(plan) : null;
    const baseFlightSnapshot = createFlightSnapshot(ship, plan, this.options);
    const failureReasonCodes = unique([...baseFlightSnapshot.failureReasonCodes, ...invalidationReasons]);
    const flightSnapshot = {
      ...baseFlightSnapshot,
      routeValid: failureReasonCodes.length === 0,
      failureReasonCodes
    };
    return {
      tick,
      status,
      planHash: plan?.planHash ?? null,
      activeSegmentId: segment?.id ?? null,
      distanceToTarget: plan ? distance(ship.position, plan.target.position) : 0,
      offRouteDistance: plan && segment ? this.offRouteDistance(ship.position, segment) : 0,
      replanRequired,
      invalidationReasons,
      failureReasonCodes,
      fuel: ship.fuel,
      flightSnapshot,
      position: ship.position,
      velocity: ship.velocity
    };
  }

  private emptyShip(): ShipState {
    return createShipStateV2({ position: vec3(), velocity: vec3(), fuel: 0, authority: { mode: "Manual", mainThrustersAvailable: false, rcsAvailable: false, sasAvailable: false, autopilotAvailable: false } });
  }
}
