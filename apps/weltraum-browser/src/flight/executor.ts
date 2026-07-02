import { add, clamp, distance, dot, magnitude, normalize, projectPointOnSegment, scale, sub, vec3 } from "../core/vector";
import type { ArrivalEnvelope, ExecutorArrivalPhase, ExecutorTelemetry, FailureReasonCode, RouteLifecycle, RoutePlan, RouteSegment, ShipState } from "../core/types";
import { arrivalEnvelopeForTarget, arrivalRadiusForTarget } from "../navigation/validation";
import { applyFlightControllerStep } from "./flightController";
import { accelerationLimitForMass, createFlightSnapshot, createShipStateV2 } from "./state";

export interface AutopilotExecutorOptions {
  readonly maxAcceleration: number;
  readonly maxThrustKilonewtons: number;
  readonly divergenceDistance: number;
  readonly allowManualInputWhenIdle: boolean;
}

const defaultOptions: AutopilotExecutorOptions = {
  maxAcceleration: 10,
  maxThrustKilonewtons: 10,
  divergenceDistance: 30,
  allowManualInputWhenIdle: false
};

const unique = (codes: readonly FailureReasonCode[]): readonly FailureReasonCode[] => [...new Set(codes)];

const terminalSpeedForArrival = (envelope: ArrivalEnvelope | null): number | undefined => {
  if (!envelope) {
    return undefined;
  }
  if (envelope.terminalSpeed !== undefined) {
    return envelope.terminalSpeed;
  }
  return envelope.stopBehavior === "StopWithinEnvelope" || envelope.stopBehavior === "MatchTerminalSpeed" ? 0 : undefined;
};

const isArrivalSpeedSatisfied = (ship: ShipState, envelope: ArrivalEnvelope | null): boolean => {
  const terminalSpeed = terminalSpeedForArrival(envelope);
  return terminalSpeed === undefined || magnitude(ship.velocity) <= terminalSpeed + 1e-6;
};

const isStopCaptureEnvelope = (envelope: ArrivalEnvelope | null): boolean => envelope?.stopBehavior === "StopWithinEnvelope";

const isTerminalTelemetryEnvelope = (envelope: ArrivalEnvelope | null): boolean =>
  envelope?.stopBehavior !== "NoStopRequired" && terminalSpeedForArrival(envelope) !== undefined;

const terminalStateForPhase = (
  arrivalPhase: ExecutorArrivalPhase,
  desiredTerminalVelocity: ShipState["position"] = vec3()
): TerminalTelemetryState => ({
  desiredTerminalVelocity,
  arrivalPhase,
  terminalCaptureActive: arrivalPhase === "Capture",
  terminalHoldingActive: arrivalPhase === "Holding"
});

const clampMagnitude = (value: ShipState["position"], limit: number): ShipState["position"] => {
  const valueMagnitude = magnitude(value);
  if (valueMagnitude <= limit || valueMagnitude <= 1e-9) {
    return value;
  }

  return scale(normalize(value), Math.max(0, limit));
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

interface AutopilotActuatorRequest {
  readonly facingDirection: ShipState["position"];
  readonly throttle: number;
  readonly desiredAcceleration: ShipState["position"];
  readonly desiredTerminalVelocity: ShipState["position"];
  readonly arrivalPhase: ExecutorArrivalPhase;
  readonly terminalCaptureActive: boolean;
  readonly terminalHoldingActive: boolean;
  readonly braking: boolean;
}

interface TerminalTelemetryState {
  readonly desiredTerminalVelocity: ShipState["position"];
  readonly arrivalPhase: ExecutorArrivalPhase;
  readonly terminalCaptureActive: boolean;
  readonly terminalHoldingActive: boolean;
}

const inactiveTerminalTelemetry: TerminalTelemetryState = {
  desiredTerminalVelocity: vec3(),
  arrivalPhase: "None",
  terminalCaptureActive: false,
  terminalHoldingActive: false
};

export class AutopilotExecutor {
  private readonly options: AutopilotExecutorOptions;
  private lockedPlan: RoutePlan | null = null;
  private stationKeepingPlan: RoutePlan | null = null;
  private completedPlanHash: string | null = null;
  private activeSegmentIndex = 0;
  private telemetry: ExecutorTelemetry;

  constructor(options: Partial<AutopilotExecutorOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.telemetry = this.createTelemetry(0, "Idle", null, this.emptyShip(), false, []);
  }

  lockPlan(plan: RoutePlan, ship: ShipState, tick = this.telemetry.tick): void {
    this.lockedPlan = plan;
    this.stationKeepingPlan = null;
    this.activeSegmentIndex = 0;
    this.telemetry = this.createTelemetry(tick, "Executing", plan, ship, false, [], inactiveTerminalTelemetry, "Executing");
  }

  cancelPlan(ship: ShipState, tick = this.telemetry.tick): ShipState {
    const idleShip = applyFlightControllerStep(ship, { mainThrottleCommand: 0, translationCommand: vec3(), rotationCommand: vec3() }, 0, this.options);
    this.lockedPlan = null;
    this.stationKeepingPlan = null;
    this.activeSegmentIndex = 0;
    this.telemetry = this.createTelemetry(tick, "Idle", null, idleShip, false, [], inactiveTerminalTelemetry, "Cancelled");
    return idleShip;
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
      if (this.stationKeepingPlan) {
        return this.stepStationKeeping(ship, fixedDeltaSeconds, tick);
      }

      const idleRequest = this.options.allowManualInputWhenIdle
        ? {
            controlMode: ship.controlMode,
            mainThrottleCommand: ship.mainThrottleCommand,
            translationCommand: ship.translationCommand,
            rotationCommand: ship.rotationCommand,
            rcsEnabled: ship.rcsEnabled,
            sasEnabled: ship.sasEnabled
          }
        : { mainThrottleCommand: 0, translationCommand: vec3(), rotationCommand: vec3() };
      const driftingShip = applyFlightControllerStep(ship, idleRequest, fixedDeltaSeconds, this.options);
      this.telemetry = this.createTelemetry(tick, "Idle", null, driftingShip, false, [], inactiveTerminalTelemetry, "Idle");
      return driftingShip;
    }

    const preflight = createFlightSnapshot(ship, plan, this.options);
    if (preflight.failureReasonCodes.includes("FuelDepleted") || preflight.failureReasonCodes.includes("FuelReserveViolated")) {
      this.telemetry = this.createTelemetry(tick, "OutOfFuel", plan, ship, true, preflight.failureReasonCodes, inactiveTerminalTelemetry, "Executing");
      return ship;
    }

    if (preflight.failureReasonCodes.includes("AutopilotUnavailable") || preflight.failureReasonCodes.includes("AuthorityInsufficient")) {
      this.telemetry = this.createTelemetry(tick, "NoAuthority", plan, ship, true, preflight.failureReasonCodes, inactiveTerminalTelemetry, "Executing");
      return ship;
    }

    if (!preflight.brakingReserve.canBrake) {
      this.telemetry = this.createTelemetry(tick, "BrakeReserveInsufficient", plan, ship, true, preflight.failureReasonCodes, inactiveTerminalTelemetry, "Executing");
      return ship;
    }

    const segment = this.currentSegment(plan);
    const arrivalEnvelope = arrivalEnvelopeForTarget(plan.target);
    const arrivalRadius = arrivalRadiusForTarget(plan.target);
    const isTerminalSegment = this.activeSegmentIndex >= plan.segments.length - 1;
    const alreadyArrived = isTerminalSegment && this.isArrived(ship, plan, arrivalEnvelope, arrivalRadius);

    const offRouteDistance = this.offRouteDistance(ship.position, segment);
    const invalidationReasons: readonly FailureReasonCode[] = offRouteDistance > this.options.divergenceDistance ? ["OffLockedRoute"] : [];
    if (invalidationReasons.length > 0) {
      this.telemetry = this.createTelemetry(tick, "Diverged", plan, ship, true, invalidationReasons, inactiveTerminalTelemetry, "Executing");
      return ship;
    }

    const actuatorRequest = this.createAutopilotActuatorRequest(ship, segment, plan, arrivalEnvelope, arrivalRadius);
    const nextShip = applyFlightControllerStep(ship, {
      controlMode: "Cruise",
      mainThrottleCommand: actuatorRequest.throttle,
      desiredAcceleration: actuatorRequest.desiredAcceleration,
      desiredFacingDirection: actuatorRequest.facingDirection,
      translationCommand: vec3(),
      rotationCommand: vec3(),
      rcsEnabled: ship.rcsEnabled,
      sasEnabled: ship.sasEnabled
    }, fixedDeltaSeconds, this.options);
    const nextPosition = nextShip.position;

    if (isTerminalSegment && (alreadyArrived || this.isArrived(nextShip, plan, arrivalEnvelope, arrivalRadius))) {
      const shouldEnterStationKeeping = isTerminalTelemetryEnvelope(arrivalEnvelope);
      const terminalState = isTerminalTelemetryEnvelope(arrivalEnvelope)
        ? terminalStateForPhase("Holding", actuatorRequest.desiredTerminalVelocity)
        : inactiveTerminalTelemetry;
      this.completedPlanHash = plan.planHash;
      this.stationKeepingPlan = shouldEnterStationKeeping ? plan : null;
      this.lockedPlan = null;
      this.activeSegmentIndex = 0;
      this.telemetry = this.createTelemetry(tick, "Arrived", null, nextShip, false, [], terminalState, shouldEnterStationKeeping ? "Holding" : "Arrived", plan);
      return nextShip;
    }

    const waypointEnvelopeRadius = Math.max(2, Math.min(8, segment.clearanceRadius));
    const reachedRouteWaypoint = !isTerminalSegment && (distance(nextPosition, segment.end) <= waypointEnvelopeRadius || crossedTerminalTarget(ship.position, nextPosition, segment.end, waypointEnvelopeRadius));
    if (reachedRouteWaypoint) {
      this.activeSegmentIndex = Math.min(this.activeSegmentIndex + 1, plan.segments.length - 1);
    }

    const routeLifecycle: RouteLifecycle = actuatorRequest.terminalCaptureActive || actuatorRequest.arrivalPhase === "TerminalBrake" ? "TerminalCapture" : "Executing";
    this.telemetry = this.createTelemetry(tick, "Executing", plan, nextShip, false, [], actuatorRequest, routeLifecycle);
    return nextShip;
  }

  private stepStationKeeping(ship: ShipState, fixedDeltaSeconds: number, tick: number): ShipState {
    const plan = this.stationKeepingPlan;
    if (!plan) {
      return ship;
    }

    const arrivalEnvelope = arrivalEnvelopeForTarget(plan.target);
    const terminalSpeed = terminalSpeedForArrival(arrivalEnvelope);
    const desiredTerminalVelocity = arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed"
      ? scale(normalize(sub(plan.target.position, ship.position)), terminalSpeed ?? 0)
      : vec3();
    const accelerationLimit = accelerationLimitForMass(ship.mass, this.options);
    const positionError = sub(plan.target.position, ship.position);
    const velocityError = sub(desiredTerminalVelocity, ship.velocity);
    const desiredAcceleration = clampMagnitude(add(scale(positionError, 0.35), scale(velocityError, 1.4)), accelerationLimit);
    const desiredAccelerationMagnitude = magnitude(desiredAcceleration);
    const targetDirection = normalize(positionError);
    const nextShip = applyFlightControllerStep(ship, {
      controlMode: "Cruise",
      mainThrottleCommand: desiredAccelerationMagnitude <= 0.05 ? 0 : clamp(desiredAccelerationMagnitude / Math.max(accelerationLimit, 1), 0.15, 1),
      desiredAcceleration,
      desiredFacingDirection: desiredAccelerationMagnitude > 1e-6 ? desiredAcceleration : targetDirection,
      translationCommand: vec3(),
      rotationCommand: vec3(),
      rcsEnabled: ship.rcsEnabled,
      sasEnabled: ship.sasEnabled
    }, fixedDeltaSeconds, this.options);

    const terminalState = isTerminalTelemetryEnvelope(arrivalEnvelope)
      ? terminalStateForPhase("Holding", desiredTerminalVelocity)
      : inactiveTerminalTelemetry;
    this.completedPlanHash = this.completedPlanHash ?? plan.planHash;
    this.telemetry = this.createTelemetry(tick, "Arrived", null, nextShip, false, [], terminalState, "Holding", plan);
    return nextShip;
  }

  private isArrived(ship: ShipState, plan: RoutePlan, arrivalEnvelope: ArrivalEnvelope | null, arrivalRadius: number): boolean {
    if (!this.lockedPlan || this.lockedPlan.planHash !== plan.planHash) {
      return false;
    }
    return Number.isFinite(arrivalRadius) && distance(ship.position, plan.target.position) <= arrivalRadius && isArrivalSpeedSatisfied(ship, arrivalEnvelope);
  }

  private createAutopilotActuatorRequest(
    ship: ShipState,
    segment: RouteSegment,
    plan: RoutePlan,
    arrivalEnvelope: ArrivalEnvelope | null,
    arrivalRadius: number
  ): AutopilotActuatorRequest {
    const targetOffset = sub(segment.end, ship.position);
    const targetDirection = normalize(targetOffset);
    const accelerationLimit = accelerationLimitForMass(ship.mass, this.options);
    if (accelerationLimit <= 1e-6) {
      return { facingDirection: targetDirection, throttle: 0, desiredAcceleration: vec3(), desiredTerminalVelocity: vec3(), arrivalPhase: "None", terminalCaptureActive: false, terminalHoldingActive: false, braking: false };
    }

    const isTerminalSegment = this.currentSegment(plan).id === segment.id && this.activeSegmentIndex >= plan.segments.length - 1;
    const speed = magnitude(ship.velocity);
    const segmentEnvelopeRadius = isTerminalSegment ? Math.max(0, arrivalRadius) : Math.max(2, Math.min(8, segment.clearanceRadius));
    const arrivalTerminalSpeed = terminalSpeedForArrival(arrivalEnvelope);
    const terminalSpeed = isTerminalSegment
      ? arrivalEnvelope?.stopBehavior === "NoStopRequired"
        ? (arrivalTerminalSpeed ?? segment.desiredSpeed)
        : arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed"
          ? (arrivalTerminalSpeed ?? 0)
          : 0
      : this.waypointTurnSpeed(plan, segment);
    const distanceToSegmentEnd = magnitude(targetOffset);
    const brakingDistance = Math.max(0, (speed * speed - terminalSpeed * terminalSpeed) / (2 * accelerationLimit));
    const brakeMarginMultiplier = isTerminalSegment ? 1 : (segment.brakeMarginMultiplier ?? 1);
    const terminalBrakeMargin = segmentEnvelopeRadius + speed * 0.2 * brakeMarginMultiplier;
    const needsBraking = speed > terminalSpeed + 0.25 && distanceToSegmentEnd <= brakingDistance + terminalBrakeMargin;
    const publishTerminalTelemetry = isTerminalSegment && isTerminalTelemetryEnvelope(arrivalEnvelope);

    if (isTerminalSegment && isStopCaptureEnvelope(arrivalEnvelope)) {
      const desiredTerminalVelocity = vec3();
      const positionError = sub(plan.target.position, ship.position);
      const velocityError = sub(desiredTerminalVelocity, ship.velocity);
      const desiredAcceleration = clampMagnitude(add(scale(positionError, 0.35), scale(velocityError, 1.4)), accelerationLimit);
      const desiredAccelerationMagnitude = magnitude(desiredAcceleration);
      const insideCaptureEnvelope = Number.isFinite(arrivalRadius) && distanceToSegmentEnd <= Math.max(0, arrivalRadius);
      const arrivalPhase: ExecutorArrivalPhase = insideCaptureEnvelope ? "Capture" : needsBraking ? "TerminalBrake" : "Capture";
      const terminalState = terminalStateForPhase(arrivalPhase, desiredTerminalVelocity);

      return {
        facingDirection: desiredAccelerationMagnitude > 1e-6 ? desiredAcceleration : targetDirection,
        throttle: desiredAccelerationMagnitude <= 0.05 ? 0 : clamp(desiredAccelerationMagnitude / Math.max(accelerationLimit, 1), 0.15, 1),
        desiredAcceleration,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        arrivalPhase: terminalState.arrivalPhase,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive,
        braking: needsBraking
      };
    }

    if (magnitude(targetDirection) <= 1e-6) {
      return { facingDirection: targetDirection, throttle: 0, desiredAcceleration: vec3(), desiredTerminalVelocity: vec3(), arrivalPhase: "None", terminalCaptureActive: false, terminalHoldingActive: false, braking: false };
    }

    if (needsBraking) {
      const desiredAcceleration = magnitude(ship.velocity) > 1e-6 ? scale(normalize(ship.velocity), -accelerationLimit) : vec3();
      const arrivalPhase: ExecutorArrivalPhase = publishTerminalTelemetry ? "TerminalBrake" : "None";
      const terminalState = terminalStateForPhase(arrivalPhase, arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed" ? scale(targetDirection, terminalSpeed) : vec3());
      return {
        facingDirection: magnitude(desiredAcceleration) > 1e-6 ? desiredAcceleration : targetDirection,
        throttle: clamp(magnitude(desiredAcceleration) / accelerationLimit, 0.2, 1),
        desiredAcceleration,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        arrivalPhase: terminalState.arrivalPhase,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive,
        braking: true
      };
    }

    const distanceLimitedSpeed = Math.sqrt(Math.max(0, terminalSpeed * terminalSpeed + 2 * accelerationLimit * Math.max(0, distanceToSegmentEnd - segmentEnvelopeRadius)));
    const desiredSpeed = Math.min(segment.desiredSpeed, Math.max(terminalSpeed, distanceLimitedSpeed));
    const desiredVelocity = scale(targetDirection, desiredSpeed);
    const desiredAcceleration = scale(sub(desiredVelocity, ship.velocity), 1.35);
    const accelerationMagnitude = magnitude(desiredAcceleration);
    const throttle = accelerationMagnitude <= 0.05 ? 0 : clamp(accelerationMagnitude / Math.max(accelerationLimit, 1), 0.15, 1);
    const arrivalPhase: ExecutorArrivalPhase = publishTerminalTelemetry ? "Capture" : "None";
    const terminalState = terminalStateForPhase(arrivalPhase, arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed" ? scale(targetDirection, terminalSpeed) : vec3());
    return {
      facingDirection: accelerationMagnitude > 1e-6 ? desiredAcceleration : targetDirection,
      throttle,
      desiredAcceleration,
      desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
      arrivalPhase: terminalState.arrivalPhase,
      terminalCaptureActive: terminalState.terminalCaptureActive,
      terminalHoldingActive: terminalState.terminalHoldingActive,
      braking: false
    };
  }

  private waypointTurnSpeed(plan: RoutePlan, segment: RouteSegment): number {
    const nextSegment = plan.segments[this.activeSegmentIndex + 1];
    if (!nextSegment) {
      return segment.desiredSpeed;
    }

    const currentDirection = normalize(sub(segment.end, segment.start));
    const nextDirection = normalize(sub(nextSegment.end, nextSegment.start));
    const turnAlignment = dot(currentDirection, nextDirection);
    const sharpTurnSpeed = turnAlignment < 0.85 ? 4 : 8;
    return Math.min(segment.desiredSpeed, nextSegment.desiredSpeed, sharpTurnSpeed);
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
    invalidationReasons: readonly FailureReasonCode[],
    terminalState: TerminalTelemetryState = inactiveTerminalTelemetry,
    routeLifecycle: RouteLifecycle = status === "Executing" ? "Executing" : status === "Arrived" ? "Arrived" : "Idle",
    stationKeepingPlan: RoutePlan | null = null
  ): ExecutorTelemetry {
    const telemetryPlan = plan ?? stationKeepingPlan;
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
      routeLifecycle,
      arrivalPhase: terminalState.arrivalPhase,
      planHash: plan?.planHash ?? null,
      completedPlanHash: this.completedPlanHash,
      lockedPlanActive: plan !== null,
      stationKeepingActive: this.stationKeepingPlan !== null && plan === null,
      canAcceptNewPlan: this.lockedPlan === null,
      canSelectNewTarget: this.lockedPlan === null,
      activeSegmentId: segment?.id ?? null,
      distanceToTarget: telemetryPlan ? distance(ship.position, telemetryPlan.target.position) : 0,
      offRouteDistance: plan && segment ? this.offRouteDistance(ship.position, segment) : 0,
      ...this.createTerminalTelemetry(telemetryPlan, ship, terminalState),
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

  private createTerminalTelemetry(plan: RoutePlan | null, ship: ShipState, terminalState: TerminalTelemetryState): Pick<ExecutorTelemetry, "terminalSpeedLimit" | "currentSpeed" | "terminalError" | "terminalSpeedError" | "terminalRadialSpeed" | "terminalTangentialSpeed" | "desiredTerminalVelocity" | "terminalCaptureActive" | "terminalHoldingActive"> {
    const currentSpeed = magnitude(ship.velocity);
    if (!plan) {
      return {
        terminalSpeedLimit: null,
        currentSpeed,
        terminalError: null,
        terminalSpeedError: null,
        terminalRadialSpeed: 0,
        terminalTangentialSpeed: currentSpeed,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive
      };
    }

    const terminalSpeedLimit = terminalSpeedForArrival(arrivalEnvelopeForTarget(plan.target)) ?? null;
    const radialDirection = normalize(sub(plan.target.position, ship.position));
    const terminalRadialSpeed = magnitude(radialDirection) <= 1e-9 ? 0 : dot(ship.velocity, radialDirection);
    const terminalTangentialSpeed = Math.sqrt(Math.max(0, currentSpeed * currentSpeed - terminalRadialSpeed * terminalRadialSpeed));
    const terminalSpeedError = terminalSpeedLimit === null ? null : currentSpeed - terminalSpeedLimit;

    return {
      terminalSpeedLimit,
      currentSpeed,
      terminalError: terminalSpeedError,
      terminalSpeedError,
      terminalRadialSpeed,
      terminalTangentialSpeed,
      desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
      terminalCaptureActive: terminalState.terminalCaptureActive,
      terminalHoldingActive: terminalState.terminalHoldingActive
    };
  }
}
