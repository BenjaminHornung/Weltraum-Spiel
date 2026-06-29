import { add, distance, magnitude, normalize, projectPointOnSegment, scale, sub, vec3 } from "../core/vector";
import type { ExecutorTelemetry, FailureReasonCode, RoutePlan, RouteSegment, ShipState } from "../core/types";
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

  getLockedPlan(): RoutePlan | null {
    return this.lockedPlan;
  }

  getTelemetry(): ExecutorTelemetry {
    return this.telemetry;
  }

  step(ship: ShipState, fixedDeltaSeconds: number, tick: number): ShipState {
    const plan = this.lockedPlan;
    if (!plan) {
      this.telemetry = this.createTelemetry(tick, "Idle", null, ship, false, []);
      return ship;
    }

    const segment = this.currentSegment(plan);
    const distanceToTarget = distance(ship.position, plan.target.position);
    if (distanceToTarget <= plan.target.arrivalRadius) {
      const stoppedShip = { ...ship, velocity: scale(ship.velocity, 0.82) };
      this.telemetry = this.createTelemetry(tick, "Arrived", plan, stoppedShip, false, []);
      return stoppedShip;
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

    if (distance(nextPosition, segment.end) <= Math.max(2, segment.clearanceRadius)) {
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
