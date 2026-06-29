import { add, distance, magnitude, normalize, projectPointOnSegment, scale, sub, vec3 } from "../core/vector";
import type { ExecutorTelemetry, RoutePlan, RouteSegment, ShipState } from "../core/types";

export interface AutopilotExecutorOptions {
  readonly maxAcceleration: number;
  readonly fuelBurnPerNewtonSecond: number;
  readonly divergenceDistance: number;
}

const defaultOptions: AutopilotExecutorOptions = {
  maxAcceleration: 10,
  fuelBurnPerNewtonSecond: 0.02,
  divergenceDistance: 30
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

  lockPlan(plan: RoutePlan): void {
    this.lockedPlan = plan;
    this.activeSegmentIndex = 0;
    this.telemetry = this.createTelemetry(this.telemetry.tick, "Executing", plan, this.emptyShip(), false, []);
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

    if (!ship.authority.autopilot || !ship.authority.mainThrusters) {
      this.telemetry = this.createTelemetry(tick, "NoAuthority", plan, ship, true, ["AuthorityUnavailable"]);
      return ship;
    }

    if (ship.fuel <= 0) {
      this.telemetry = this.createTelemetry(tick, "OutOfFuel", plan, ship, true, ["FuelDepleted"]);
      return ship;
    }

    const offRouteDistance = this.offRouteDistance(ship.position, segment);
    const invalidationReasons = offRouteDistance > this.options.divergenceDistance ? ["OffLockedRoute"] : [];
    const direction = normalize(sub(segment.end, ship.position));
    const desiredSpeed = Math.min(segment.desiredSpeed, Math.max(4, distance(ship.position, segment.end) * 0.55));
    const speedError = desiredSpeed - magnitude(ship.velocity);
    const accelerationMagnitude = Math.max(0, Math.min(this.options.maxAcceleration, speedError + 4));
    const acceleration = scale(direction, accelerationMagnitude);
    const nextVelocity = add(ship.velocity, scale(acceleration, fixedDeltaSeconds));
    const nextPosition = add(ship.position, scale(nextVelocity, fixedDeltaSeconds));
    const fuelBurn = accelerationMagnitude * fixedDeltaSeconds * this.options.fuelBurnPerNewtonSecond;
    const nextShip: ShipState = {
      ...ship,
      position: nextPosition,
      velocity: nextVelocity,
      fuel: Math.max(0, ship.fuel - fuelBurn)
    };

    if (distance(nextPosition, segment.end) <= Math.max(2, segment.clearanceRadius)) {
      this.activeSegmentIndex = Math.min(this.activeSegmentIndex + 1, plan.segments.length - 1);
    }

    const status = invalidationReasons.length > 0 ? "Diverged" : "Executing";
    this.telemetry = this.createTelemetry(tick, status, plan, nextShip, invalidationReasons.length > 0, invalidationReasons);
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
    invalidationReasons: readonly string[]
  ): ExecutorTelemetry {
    const segment = plan ? this.currentSegment(plan) : null;
    return {
      tick,
      status,
      planHash: plan?.planHash ?? null,
      activeSegmentId: segment?.id ?? null,
      distanceToTarget: plan ? distance(ship.position, plan.target.position) : 0,
      offRouteDistance: plan && segment ? this.offRouteDistance(ship.position, segment) : 0,
      replanRequired,
      invalidationReasons,
      fuel: ship.fuel,
      position: ship.position,
      velocity: ship.velocity
    };
  }

  private emptyShip(): ShipState {
    return {
      position: vec3(),
      velocity: vec3(),
      fuel: 0,
      authority: {
        mode: "Manual",
        mainThrusters: false,
        rcs: false,
        autopilot: false
      }
    };
  }
}
