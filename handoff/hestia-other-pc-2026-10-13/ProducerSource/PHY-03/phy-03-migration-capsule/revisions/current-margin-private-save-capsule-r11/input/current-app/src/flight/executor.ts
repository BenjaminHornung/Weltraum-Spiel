import { add, clamp, distance, dot, magnitude, normalize, projectPointOnSegment, scale, sub, vec3 } from "../core/vector";
import { canonicalCloneAndDeepFreeze } from "../core/hash";
import type { ArrivalEnvelope, ExecutorArrivalPhase, ExecutorStatus, ExecutorTelemetry, FailureReasonCode, LockedTransitPhase, RouteLifecycle, RoutePlan, RouteSegment, ShipState } from "../core/types";
import { arrivalEnvelopeForTarget, arrivalRadiusForTarget, canonicalizeLockedRoutePlan } from "../navigation/validation";
import { applyFlightControllerStep, defaultFlightControllerOptions, rotateVectorByQuaternion } from "./flightController";
import { accelerationLimitForMass, createFlightSnapshot, createShipStateV2 } from "./state";
import { deriveEffectiveMotionAuthority } from "./propulsionCapability";

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
  if (envelope.stopBehavior === "StopWithinEnvelope") {
    return Math.min(0.5, envelope.terminalSpeed ?? 0.5);
  }
  if (envelope.terminalSpeed !== undefined) {
    return envelope.terminalSpeed;
  }
  return envelope.stopBehavior === "MatchTerminalSpeed" ? 0 : undefined;
};

const isArrivalSpeedSatisfied = (ship: ShipState, envelope: ArrivalEnvelope | null): boolean => {
  const terminalSpeed = terminalSpeedForArrival(envelope);
  return terminalSpeed === undefined || magnitude(ship.velocity) <= terminalSpeed + 1e-6;
};

const isStopCaptureEnvelope = (envelope: ArrivalEnvelope | null): boolean => envelope?.stopBehavior === "StopWithinEnvelope";

const isTerminalTelemetryEnvelope = (envelope: ArrivalEnvelope | null): boolean =>
  envelope?.stopBehavior !== "NoStopRequired" && terminalSpeedForArrival(envelope) !== undefined;

const terminalPdAcceleration = (
  ship: ShipState,
  targetPosition: ShipState["position"],
  desiredTerminalVelocity: ShipState["velocity"]
): ShipState["position"] =>
  add(scale(sub(targetPosition, ship.position), 0.35), scale(sub(desiredTerminalVelocity, ship.velocity), 1.4));

const isReadyForStopCaptureHolding = (ship: ShipState, plan: RoutePlan, envelope: ArrivalEnvelope | null): boolean =>
  !isStopCaptureEnvelope(envelope) || dot(terminalPdAcceleration(ship, plan.target.position, vec3()), ship.velocity) <= 1e-6;

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
  readonly translationCommand: ShipState["position"];
  readonly allowRcsTranslationOutsideTranslationMode: boolean;
  readonly mainThrustAlignmentToleranceRadians: number;
  readonly desiredTerminalVelocity: ShipState["position"];
  readonly arrivalPhase: ExecutorArrivalPhase;
  readonly terminalCaptureActive: boolean;
  readonly terminalHoldingActive: boolean;
  readonly braking: boolean;
  readonly motionPhase: LockedTransitPhase;
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

interface LiveMotionAuthority {
  readonly mainAccelerationMps2: number;
  readonly brakingAccelerationMps2: number;
  readonly combinedAccelerationLimitMps2: number;
  readonly maximumJerkMps3: number;
  readonly maximumPeakSpeedMps?: number;
  readonly brakingReserveMultiplier: number;
  readonly mainThrustAlignmentToleranceRadians: number;
  readonly flipCompletionToleranceRadians: number;
  readonly maximumAngularAccelerationRadps2: number;
  readonly maximumAngularVelocityRadps: number;
}

interface DynamicBrakingReserve {
  readonly brakingDirection: ShipState["position"];
  readonly brakeTargetSpeedMps: number;
  readonly brakeTargetDistanceM: number;
  /** Physical minimum before policy margin is added to start braking early. */
  readonly hardStoppingReserveM: number;
  readonly dynamicReserveM: number;
  readonly mustStartBraking: boolean;
  readonly insufficient: boolean;
}

const bodyForward = (ship: ShipState): ShipState["position"] => normalize(rotateVectorByQuaternion(ship.orientation, vec3(1, 0, 0)));

const angleBetween = (a: ShipState["position"], b: ShipState["position"]): number => {
  if (magnitude(a) <= 1e-9 || magnitude(b) <= 1e-9) {
    return 0;
  }
  return Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1));
};

const estimatedRotationSeconds = (
  angleRadians: number,
  maximumAngularAccelerationRadps2: number,
  maximumAngularVelocityRadps: number
): number => {
  if (angleRadians <= 1e-9) {
    return 0;
  }
  if (!Number.isFinite(maximumAngularAccelerationRadps2) || !Number.isFinite(maximumAngularVelocityRadps) || maximumAngularAccelerationRadps2 <= 1e-9 || maximumAngularVelocityRadps <= 1e-9) {
    return Number.NaN;
  }

  const accelerationTime = maximumAngularVelocityRadps / maximumAngularAccelerationRadps2;
  const accelerationDistance = 0.5 * maximumAngularAccelerationRadps2 * accelerationTime * accelerationTime;
  return angleRadians <= 2 * accelerationDistance
    ? 2 * Math.sqrt(angleRadians / maximumAngularAccelerationRadps2)
    : 2 * accelerationTime + (angleRadians - 2 * accelerationDistance) / maximumAngularVelocityRadps;
};

// This matches the established committed-brake handoff threshold. It is a
// geometric continuation test, not a corner-speed approximation: only a route
// whose directions differ by at most acos(0.999) may share stopping distance.
const collinearContinuationDirectionDot = 0.999;

const stableBurnAngularVelocityFor = (live: LiveMotionAuthority): number => {
  const burnAlignmentTolerance = Math.min(live.mainThrustAlignmentToleranceRadians, live.flipCompletionToleranceRadians);
  const angularSlewSeconds = live.maximumAngularVelocityRadps / Math.max(live.maximumAngularAccelerationRadps2, 1e-9);
  return Math.min(
    live.maximumAngularVelocityRadps,
    burnAlignmentTolerance / Math.max(angularSlewSeconds, 1e-9)
  );
};

/**
 * Bound the real heading controller, rather than treating a maximum-rate slew
 * as settled. `FlightController` applies a proportional facing request plus
 * SAS damping and does not allow a main burn until the same angular-velocity
 * gate below is met. The bound uses the controller's proportional gain and
 * damping decay directly, keeping the reserve coupled to locked angular limits.
 */
const estimatedStableBurnSeconds = (
  angleRadians: number,
  angularVelocityMagnitudeRadps: number,
  live: LiveMotionAuthority,
  sasEnabled: boolean
): number => {
  const burnAlignmentTolerance = Math.min(live.mainThrustAlignmentToleranceRadians, live.flipCompletionToleranceRadians);
  const stableAngularVelocity = stableBurnAngularVelocityFor(live);
  if (
    !Number.isFinite(angleRadians) ||
    !Number.isFinite(angularVelocityMagnitudeRadps) ||
    !Number.isFinite(burnAlignmentTolerance) ||
    !Number.isFinite(stableAngularVelocity) ||
    live.maximumAngularAccelerationRadps2 <= 1e-9 ||
    live.maximumAngularVelocityRadps <= 1e-9 ||
    burnAlignmentTolerance < 0 ||
    stableAngularVelocity < 0
  ) {
    return Number.NaN;
  }

  const initialAngle = Math.max(0, angleRadians);
  const initialAngularVelocity = clamp(Math.max(0, angularVelocityMagnitudeRadps), 0, live.maximumAngularVelocityRadps);
  if (initialAngle <= burnAlignmentTolerance && initialAngularVelocity <= stableAngularVelocity) {
    return 0;
  }

  const idealRotationSeconds = estimatedRotationSeconds(initialAngle, live.maximumAngularAccelerationRadps2, live.maximumAngularVelocityRadps);
  if (!Number.isFinite(idealRotationSeconds)) {
    return Number.NaN;
  }

  // Without SAS the current proportional controller has no damping guarantee.
  // Preserve the existing finite angular-capacity fallback while reserving both
  // the acceleration and deceleration legs of the velocity gate.
  if (!sasEnabled) {
    return idealRotationSeconds + 2 * live.maximumAngularVelocityRadps / live.maximumAngularAccelerationRadps2;
  }

  const damping = defaultFlightControllerOptions.sasDamping;
  if (!Number.isFinite(damping) || damping <= 1e-9) {
    return Number.NaN;
  }

  // `rotationCommandForFacing` has small-error gain a / (pi / 2); coupled with
  // SAS, its conservative convergence rate is bounded by both that natural
  // heading rate and the damping rate. The stable-burn velocity gate then needs
  // a separate exponential SAS decay from the capped angular velocity.
  const proportionalHeadingGain = live.maximumAngularAccelerationRadps2 / (Math.PI * 0.5);
  const headingConvergenceRate = Math.min(Math.sqrt(proportionalHeadingGain), damping);
  if (!Number.isFinite(headingConvergenceRate) || headingConvergenceRate <= 1e-9) {
    return Number.NaN;
  }
  const headingSettlingSeconds = Math.log(1 + initialAngle / Math.max(burnAlignmentTolerance, 1e-9)) / headingConvergenceRate;
  const angularVelocitySettlingSeconds = Math.log(
    Math.max(1, live.maximumAngularVelocityRadps / Math.max(stableAngularVelocity, 1e-9))
  ) / damping;
  return Math.max(idealRotationSeconds, headingSettlingSeconds + angularVelocitySettlingSeconds);
};

export class AutopilotExecutor {
  private readonly options: AutopilotExecutorOptions;
  private lockedPlan: RoutePlan | null = null;
  private stationKeepingPlan: RoutePlan | null = null;
  private completedPlanHash: string | null = null;
  private activeSegmentIndex = 0;
  private activeMotionPhase: LockedTransitPhase | null = null;
  private brakingCommitted = false;
  private terminalCommittedBrakeCloseCorrection = false;
  private terminalCaptureCommitted = false;
  private commandedPoweredAccelerationMps2 = 0;
  private latchedFailure: { readonly status: Extract<ExecutorStatus, "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient">; readonly reasonCodes: readonly FailureReasonCode[] } | null = null;
  private telemetry: ExecutorTelemetry;

  constructor(options: Partial<AutopilotExecutorOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.telemetry = this.createTelemetry(0, "Idle", null, this.emptyShip(), false, []);
  }

  lockPlan(plan: RoutePlan, ship: ShipState, tick = this.telemetry.tick): void {
    // Legacy manually-built plans predate canonical hashes. Preserve their
    // compatibility while cloning them defensively; every profile-bearing plan
    // must pass full payload hash validation before it can execute.
    const canonicalPlan = plan.motionProfile === undefined
      ? canonicalCloneAndDeepFreeze(plan)
      : canonicalizeLockedRoutePlan(plan);
    this.lockedPlan = canonicalPlan;
    this.stationKeepingPlan = null;
    this.activeSegmentIndex = 0;
    this.activeMotionPhase = "AlignForBurn";
    this.brakingCommitted = false;
    this.terminalCommittedBrakeCloseCorrection = false;
    this.terminalCaptureCommitted = false;
    this.commandedPoweredAccelerationMps2 = 0;
    this.latchedFailure = null;
    this.telemetry = this.createTelemetry(tick, "Executing", canonicalPlan, ship, false, [], inactiveTerminalTelemetry, "Executing");
  }

  cancelPlan(ship: ShipState, tick = this.telemetry.tick): ShipState {
    const idleShip = applyFlightControllerStep(ship, { mainThrottleCommand: 0, translationCommand: vec3(), rotationCommand: vec3() }, 0, this.options);
    this.lockedPlan = null;
    this.stationKeepingPlan = null;
    this.activeSegmentIndex = 0;
    this.activeMotionPhase = null;
    this.brakingCommitted = false;
    this.terminalCommittedBrakeCloseCorrection = false;
    this.terminalCaptureCommitted = false;
    this.commandedPoweredAccelerationMps2 = 0;
    this.latchedFailure = null;
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
      this.activeMotionPhase = null;
      this.commandedPoweredAccelerationMps2 = 0;
      this.telemetry = this.createTelemetry(tick, "Idle", null, driftingShip, false, [], inactiveTerminalTelemetry, "Idle");
      return driftingShip;
    }

    let segment = this.currentSegment(plan);
    if (this.latchedFailure) {
      this.telemetry = this.createTelemetry(
        tick,
        this.latchedFailure.status,
        plan,
        ship,
        true,
        this.latchedFailure.reasonCodes,
        inactiveTerminalTelemetry,
        "Executing"
      );
      return ship;
    }
    const preflight = createFlightSnapshot(ship, plan, this.options);
    if (preflight.failureReasonCodes.includes("FuelDepleted") || preflight.failureReasonCodes.includes("FuelReserveViolated")) {
      return this.latchFailure(tick, "OutOfFuel", plan, ship, preflight.failureReasonCodes);
    }

    if (preflight.failureReasonCodes.includes("AutopilotUnavailable") || preflight.failureReasonCodes.includes("AuthorityInsufficient")) {
      return this.latchFailure(tick, "NoAuthority", plan, ship, preflight.failureReasonCodes);
    }

    if (!preflight.brakingReserve.canBrake) {
      return this.latchFailure(tick, "BrakeReserveInsufficient", plan, ship, preflight.failureReasonCodes);
    }

    if (this.shouldHandoffToCollinearTerminalSegment(ship, plan, segment)) {
      this.advanceToNextSegment(plan, segment, ship, fixedDeltaSeconds);
      segment = this.currentSegment(plan);
    }

    const liveMotionAuthority = this.liveMotionAuthorityFor(ship, plan, segment);
    const requiresExplicitCrewComfortFloor =
      plan.motionProfile?.resolvedPolicy.requestedPolicyId === "CrewComfort" &&
      plan.motionProfile.occupantAccelerationEnvelope.occupantMode === "HumanCrew";
    if (
      requiresExplicitCrewComfortFloor &&
      liveMotionAuthority.mainAccelerationMps2 + 1e-6 < plan.motionProfile!.occupantAccelerationEnvelope.minimumComfortAccelerationMps2
    ) {
      return this.latchFailure(tick, "NoAuthority", plan, ship, ["ComfortAccelerationUnavailable"]);
    }
    const hasPhysicalAttitudeAuthority =
      ship.rcsEnabled &&
      ship.authority.rcsAvailable &&
      ship.authority.rotationAuthority > 1e-6 &&
      liveMotionAuthority.maximumAngularAccelerationRadps2 > 1e-6 &&
      liveMotionAuthority.maximumAngularVelocityRadps > 1e-6;
    if (
      !Number.isFinite(liveMotionAuthority.mainAccelerationMps2) ||
      !Number.isFinite(liveMotionAuthority.brakingAccelerationMps2) ||
      liveMotionAuthority.mainAccelerationMps2 <= 1e-6 ||
      liveMotionAuthority.brakingAccelerationMps2 <= 1e-6 ||
      !hasPhysicalAttitudeAuthority
    ) {
      return this.latchFailure(tick, "NoAuthority", plan, ship, ["AuthorityInsufficient"]);
    }

    const arrivalEnvelope = arrivalEnvelopeForTarget(plan.target);
    const arrivalRadius = arrivalRadiusForTarget(plan.target);
    const isTerminalSegment = this.activeSegmentIndex >= plan.segments.length - 1;
    const alreadyArrived = isTerminalSegment && this.isArrived(ship, plan, arrivalEnvelope, arrivalRadius);
    // Locked motion profiles allow zero jerk as serializable policy data, but a
    // powered route cannot execute or reserve a finite ramp with it. Arrival
    // completion itself requests no powered transit, so preserve that existing
    // terminal gate rather than rejecting an already-satisfied lock.
    if (
      !alreadyArrived &&
      (!Number.isFinite(liveMotionAuthority.maximumJerkMps3) || liveMotionAuthority.maximumJerkMps3 <= 1e-9)
    ) {
      return this.latchFailure(tick, "NoAuthority", plan, ship, ["JerkAuthorityUnavailable"]);
    }
    const shouldValidateTerminalCommittedBrakeCloseCorrection =
      isTerminalSegment &&
      isTerminalTelemetryEnvelope(arrivalEnvelope) &&
      (this.terminalCommittedBrakeCloseCorrection || (this.brakingCommitted && this.activeMotionPhase === "Brake"));
    if (shouldValidateTerminalCommittedBrakeCloseCorrection) {
      const pendingRampDownDeltaVMps = this.pendingRampDownDeltaVMps(liveMotionAuthority.maximumJerkMps3, fixedDeltaSeconds);
      const terminalPdDemand = terminalPdAcceleration(ship, plan.target.position, vec3());
      if (
        !Number.isFinite(pendingRampDownDeltaVMps) ||
        !Number.isFinite(terminalPdDemand.x) ||
        !Number.isFinite(terminalPdDemand.y) ||
        !Number.isFinite(terminalPdDemand.z)
      ) {
        return this.latchFailure(tick, "NoAuthority", plan, ship, ["AuthorityInsufficient"]);
      }
    }

    const offRouteDistance = this.offRouteDistance(ship.position, segment);
    const invalidationReasons: readonly FailureReasonCode[] = offRouteDistance > this.options.divergenceDistance ? ["OffLockedRoute"] : [];
    if (invalidationReasons.length > 0) {
      return this.latchFailure(tick, "Diverged", plan, ship, invalidationReasons);
    }

    const brakingReserve = alreadyArrived
      ? null
      : this.dynamicBrakingReserveFor(ship, segment, plan, arrivalEnvelope, arrivalRadius, liveMotionAuthority);
    const liveBrakingAuthorityReduced =
      plan.motionProfile !== undefined &&
      liveMotionAuthority.brakingAccelerationMps2 + 1e-6 < plan.motionProfile.plannedUsableBrakingAccelerationMps2;
    const isInsideStopCaptureEnvelope =
      isStopCaptureEnvelope(arrivalEnvelope) &&
      isTerminalSegment &&
      Number.isFinite(arrivalRadius) &&
      distance(ship.position, plan.target.position) <= Math.max(0, arrivalRadius);
    // The dynamic margin starts a brake early. Any live-authority deficit below
    // the physical stop reserve is irrecoverable, including one discovered after
    // braking has committed. Terminal capture owns recovery only once the craft
    // is already inside its StopWithinEnvelope terminal envelope.
    if (
      plan.motionProfile !== undefined &&
      isStopCaptureEnvelope(arrivalEnvelope) &&
      isTerminalSegment &&
      !alreadyArrived &&
      !isInsideStopCaptureEnvelope &&
      liveBrakingAuthorityReduced &&
      brakingReserve?.insufficient === true
    ) {
      return this.latchFailure(tick, "BrakeReserveInsufficient", plan, ship, ["BrakeReserveInsufficient"]);
    }

    const actuatorRequest = alreadyArrived
      ? this.createArrivalCompletionRequest(ship, plan, arrivalEnvelope)
      : this.createAutopilotActuatorRequest(ship, segment, plan, arrivalEnvelope, arrivalRadius, liveMotionAuthority, fixedDeltaSeconds);
    const nextShip = applyFlightControllerStep(ship, {
      controlMode: "Cruise",
      mainThrottleCommand: actuatorRequest.throttle,
      desiredAcceleration: actuatorRequest.desiredAcceleration,
      desiredFacingDirection: actuatorRequest.facingDirection,
      mainThrustAlignmentToleranceRadians: actuatorRequest.mainThrustAlignmentToleranceRadians,
      maximumMainAccelerationMps2: liveMotionAuthority.mainAccelerationMps2,
      maximumCombinedAccelerationMps2: liveMotionAuthority.combinedAccelerationLimitMps2,
      maximumAngularAccelerationRadps2: liveMotionAuthority.maximumAngularAccelerationRadps2,
      maximumAngularVelocityRadps: liveMotionAuthority.maximumAngularVelocityRadps,
      maximumJerkMps3: liveMotionAuthority.maximumJerkMps3,
      translationCommand: actuatorRequest.translationCommand,
      rotationCommand: vec3(),
      rcsEnabled: ship.rcsEnabled,
      sasEnabled: ship.sasEnabled,
      allowRcsTranslationOutsideTranslationMode: actuatorRequest.allowRcsTranslationOutsideTranslationMode
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
      this.activeMotionPhase = shouldEnterStationKeeping ? "Holding" : null;
      this.brakingCommitted = false;
      this.terminalCommittedBrakeCloseCorrection = false;
      this.terminalCaptureCommitted = false;
      this.commandedPoweredAccelerationMps2 = 0;
      this.telemetry = this.createTelemetry(tick, "Arrived", null, nextShip, false, [], terminalState, shouldEnterStationKeeping ? "Holding" : "Arrived", plan);
      return nextShip;
    }

    const waypointEnvelopeRadius = Math.max(2, Math.min(8, segment.clearanceRadius));
    const reachedRouteWaypoint = !isTerminalSegment && (distance(nextPosition, segment.end) <= waypointEnvelopeRadius || crossedTerminalTarget(ship.position, nextPosition, segment.end, waypointEnvelopeRadius));
    const routeLifecycle: RouteLifecycle = actuatorRequest.terminalCaptureActive || actuatorRequest.arrivalPhase === "TerminalBrake" ? "TerminalCapture" : "Executing";
    this.activeMotionPhase = actuatorRequest.motionPhase;
    if (reachedRouteWaypoint) {
      this.advanceToNextSegment(plan, segment, nextShip, fixedDeltaSeconds);
    }
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
    const terminalState = isTerminalTelemetryEnvelope(arrivalEnvelope)
      ? terminalStateForPhase("Holding", desiredTerminalVelocity)
      : inactiveTerminalTelemetry;
    const actuatorRequest = this.createTerminalRcsRequest(
      ship,
      terminalPdAcceleration(ship, plan.target.position, desiredTerminalVelocity),
      terminalState,
      "Holding",
      false
    );
    const nextShip = applyFlightControllerStep(ship, {
      controlMode: "Cruise",
      mainThrottleCommand: actuatorRequest.throttle,
      desiredAcceleration: actuatorRequest.desiredAcceleration,
      desiredFacingDirection: actuatorRequest.facingDirection,
      mainThrustAlignmentToleranceRadians: actuatorRequest.mainThrustAlignmentToleranceRadians,
      translationCommand: actuatorRequest.translationCommand,
      rotationCommand: vec3(),
      rcsEnabled: ship.rcsEnabled,
      sasEnabled: ship.sasEnabled,
      allowRcsTranslationOutsideTranslationMode: actuatorRequest.allowRcsTranslationOutsideTranslationMode
    }, fixedDeltaSeconds, this.options);

    this.completedPlanHash = this.completedPlanHash ?? plan.planHash;
    this.activeMotionPhase = "Holding";
    this.commandedPoweredAccelerationMps2 = 0;
    this.telemetry = this.createTelemetry(tick, "Arrived", null, nextShip, false, [], terminalState, "Holding", plan);
    return nextShip;
  }

  private isArrived(ship: ShipState, plan: RoutePlan, arrivalEnvelope: ArrivalEnvelope | null, arrivalRadius: number): boolean {
    if (!this.lockedPlan || this.lockedPlan.planHash !== plan.planHash) {
      return false;
    }
    return Number.isFinite(arrivalRadius) &&
      distance(ship.position, plan.target.position) <= arrivalRadius &&
      isArrivalSpeedSatisfied(ship, arrivalEnvelope) &&
      isReadyForStopCaptureHolding(ship, plan, arrivalEnvelope);
  }

  private createArrivalCompletionRequest(ship: ShipState, plan: RoutePlan, arrivalEnvelope: ArrivalEnvelope | null): AutopilotActuatorRequest {
    const targetDirection = normalize(sub(plan.target.position, ship.position));
    const terminalSpeed = terminalSpeedForArrival(arrivalEnvelope) ?? 0;
    const desiredTerminalVelocity = arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed"
      ? scale(targetDirection, terminalSpeed)
      : vec3();
    const terminalState = isTerminalTelemetryEnvelope(arrivalEnvelope)
      ? terminalStateForPhase("Holding", desiredTerminalVelocity)
      : inactiveTerminalTelemetry;
    this.commandedPoweredAccelerationMps2 = 0;
    return {
      facingDirection: targetDirection,
      throttle: 0,
      desiredAcceleration: vec3(),
      translationCommand: vec3(),
      allowRcsTranslationOutsideTranslationMode: false,
      mainThrustAlignmentToleranceRadians: plan.motionProfile?.mainThrustAlignmentToleranceRadians ?? 0.12,
      desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
      arrivalPhase: terminalState.arrivalPhase,
      terminalCaptureActive: terminalState.terminalCaptureActive,
      terminalHoldingActive: terminalState.terminalHoldingActive,
      braking: false,
      motionPhase: "Holding"
    };
  }

  private createTerminalRcsRequest(
    ship: ShipState,
    desiredWorldAcceleration: ShipState["position"],
    terminalState: TerminalTelemetryState,
    motionPhase: Extract<LockedTransitPhase, "TerminalCapture" | "Holding">,
    braking: boolean,
    rampDown?: { readonly live: LiveMotionAuthority; readonly fixedDeltaSeconds: number }
  ): AutopilotActuatorRequest {
    const translationCommand = this.createRcsTranslationCommand(ship, desiredWorldAcceleration);
    const rampedDownAccelerationMps2 = rampDown
      ? this.rampPoweredAcceleration(0, rampDown.live.maximumJerkMps3, rampDown.fixedDeltaSeconds)
      : 0;
    if (Number.isFinite(rampedDownAccelerationMps2) && rampedDownAccelerationMps2 > 1e-9) {
      const currentForward = bodyForward(ship);
      return {
        facingDirection: currentForward,
        throttle: clamp(rampedDownAccelerationMps2 / Math.max(rampDown?.live.mainAccelerationMps2 ?? 1e-6, 1e-6), 0, 1),
        desiredAcceleration: scale(currentForward, rampedDownAccelerationMps2),
        translationCommand,
        allowRcsTranslationOutsideTranslationMode: magnitude(translationCommand) > 1e-6,
        mainThrustAlignmentToleranceRadians: rampDown?.live.mainThrustAlignmentToleranceRadians ?? 0.12,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        arrivalPhase: terminalState.arrivalPhase,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive,
        braking,
        motionPhase
      };
    }
    this.commandedPoweredAccelerationMps2 = 0;
    return {
      facingDirection: vec3(),
      throttle: 0,
      desiredAcceleration: vec3(),
      translationCommand,
      allowRcsTranslationOutsideTranslationMode: true,
      mainThrustAlignmentToleranceRadians: 0.12,
      desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
      arrivalPhase: terminalState.arrivalPhase,
      terminalCaptureActive: terminalState.terminalCaptureActive,
      terminalHoldingActive: terminalState.terminalHoldingActive,
      braking,
      motionPhase
    };
  }

  private createRcsTranslationCommand(ship: ShipState, desiredWorldAcceleration: ShipState["position"]): ShipState["position"] {
    if (!ship.rcsEnabled || !ship.authority.rcsAvailable || ship.authority.translationAuthority <= 1e-9) {
      return vec3();
    }
    const rcsAccelerationLimit = defaultFlightControllerOptions.rcsAcceleration * Math.max(0, ship.authority.translationAuthority);
    const clampedWorldAcceleration = clampMagnitude(desiredWorldAcceleration, rcsAccelerationLimit);
    const inverseOrientation = {
      x: -ship.orientation.x,
      y: -ship.orientation.y,
      z: -ship.orientation.z,
      w: ship.orientation.w
    };
    const localDirection = rotateVectorByQuaternion(inverseOrientation, clampedWorldAcceleration);
    return magnitude(localDirection) <= 1e-9 || rcsAccelerationLimit <= 1e-9
      ? vec3()
      : scale(normalize(localDirection), clamp(magnitude(clampedWorldAcceleration) / rcsAccelerationLimit, 0, 1));
  }

  private routeTrackingRcsAcceleration(ship: ShipState, segment: RouteSegment): ShipState["position"] {
    const segmentOffset = sub(segment.end, segment.start);
    const segmentLength = magnitude(segmentOffset);
    if (segmentLength <= 1e-9) {
      return vec3();
    }

    const segmentDirection = scale(segmentOffset, 1 / segmentLength);
    const closestPoint = projectPointOnSegment(ship.position, segment.start, segment.end);
    const crossTrackOffset = sub(closestPoint, ship.position);
    const longitudinalVelocity = scale(segmentDirection, dot(ship.velocity, segmentDirection));
    const crossTrackVelocity = sub(ship.velocity, longitudinalVelocity);
    // Main thrust remains body-forward; only RCS removes cross-track drift.
    return add(scale(crossTrackOffset, 0.35), scale(crossTrackVelocity, -1.4));
  }

  private liveMotionAuthorityFor(ship: ShipState, plan: RoutePlan, segment: RouteSegment): LiveMotionAuthority {
    const controllerAccelerationLimit = accelerationLimitForMass(ship.mass, this.options, ship.propulsionCapability, ship.occupantAccelerationEnvelope);
    const profile = plan.motionProfile;
    const authorityScale = clamp(ship.authority.rotationAuthority, 0, 1);

    if (!profile) {
      return {
        mainAccelerationMps2: controllerAccelerationLimit,
        brakingAccelerationMps2: controllerAccelerationLimit,
        combinedAccelerationLimitMps2: controllerAccelerationLimit,
        maximumJerkMps3: Math.max(1, controllerAccelerationLimit),
        ...(Number.isFinite(segment.desiredSpeed) && segment.desiredSpeed > 0 ? { maximumPeakSpeedMps: segment.desiredSpeed } : {}),
        brakingReserveMultiplier: segment.brakeMarginMultiplier ?? 1,
        mainThrustAlignmentToleranceRadians: 0.12,
        flipCompletionToleranceRadians: 0.08,
        maximumAngularAccelerationRadps2: Math.min(1.8, ship.propulsionCapability.maximumAngularAcceleration) * authorityScale,
        maximumAngularVelocityRadps: ship.propulsionCapability.maximumAngularVelocity * authorityScale
      };
    }

    const usable = deriveEffectiveMotionAuthority({
      mass: ship.mass,
      liveCapability: ship.propulsionCapability,
      liveOccupantAccelerationEnvelope: ship.occupantAccelerationEnvelope,
      policy: profile.resolvedPolicy,
      lockedCapability: profile.propulsionCapability,
      lockedOccupantAccelerationEnvelope: profile.occupantAccelerationEnvelope
    });
    const turnConstraint = segment.motionConstraint?.turnConstraint;
    const lockedAngularAcceleration = Math.min(
      profile.propulsionCapability.maximumAngularAcceleration,
      turnConstraint?.attitudeAngularAccelerationLimitRadps2 ?? profile.propulsionCapability.maximumAngularAcceleration
    );
    const lockedAngularVelocity = Math.min(
      profile.propulsionCapability.maximumAngularVelocity,
      turnConstraint?.attitudeAngularVelocityLimitRadps ?? profile.propulsionCapability.maximumAngularVelocity
    );

    const lockedAuthorityScale = clamp(profile.planningAuthority.rotationAuthority, 0, 1);
    const effectiveAuthorityScale = Math.min(authorityScale, lockedAuthorityScale);
    return {
      mainAccelerationMps2: Math.min(usable.mainAccelerationMps2, profile.plannedUsableMainAccelerationMps2),
      brakingAccelerationMps2: Math.min(usable.brakingAccelerationMps2, profile.plannedUsableBrakingAccelerationMps2),
      combinedAccelerationLimitMps2: Math.min(
        usable.combinedAccelerationLimitMps2,
        profile.plannedUsableMainAccelerationMps2,
        profile.plannedUsableBrakingAccelerationMps2
      ),
      maximumJerkMps3: Math.min(usable.maximumJerkMps3, profile.maximumJerkMps3),
      ...(!segment.motionConstraint && Number.isFinite(segment.desiredSpeed) && segment.desiredSpeed > 0
        ? { maximumPeakSpeedMps: segment.desiredSpeed }
        : segment.motionConstraint?.maximumPeakSpeedMps === undefined && profile.maximumPeakSpeedMps === undefined
          ? {}
          : { maximumPeakSpeedMps: segment.motionConstraint?.maximumPeakSpeedMps ?? profile.maximumPeakSpeedMps }),
      brakingReserveMultiplier: profile.brakingReserveMultiplier,
      mainThrustAlignmentToleranceRadians: profile.mainThrustAlignmentToleranceRadians,
      flipCompletionToleranceRadians: profile.flipCompletionToleranceRadians,
      maximumAngularAccelerationRadps2: Math.min(lockedAngularAcceleration, ship.propulsionCapability.maximumAngularAcceleration) * effectiveAuthorityScale,
      maximumAngularVelocityRadps: Math.min(lockedAngularVelocity, ship.propulsionCapability.maximumAngularVelocity) * effectiveAuthorityScale
    };
  }

  private rampPoweredAcceleration(targetAccelerationMps2: number, maximumJerkMps3: number, fixedDeltaSeconds: number): number {
    if (!Number.isFinite(targetAccelerationMps2) || targetAccelerationMps2 < 0) {
      return Number.NaN;
    }
    const elapsed = Math.max(0, fixedDeltaSeconds);
    const maximumChange = Number.isFinite(maximumJerkMps3) && maximumJerkMps3 > 0 ? maximumJerkMps3 * elapsed : 0;
    if (maximumChange <= 1e-9) {
      return this.commandedPoweredAccelerationMps2;
    }
    const current = Math.max(0, this.commandedPoweredAccelerationMps2);
    this.commandedPoweredAccelerationMps2 = targetAccelerationMps2 >= current
      ? Math.min(targetAccelerationMps2, current + maximumChange)
      : Math.max(targetAccelerationMps2, current - maximumChange);
    return this.commandedPoweredAccelerationMps2;
  }

  /**
   * `rampPoweredAcceleration` updates its command before the controller applies
   * a fixed-step impulse. Sum those post-update commands exactly so the close
   * terminal correction reserves the delta-v that a direction change cannot
   * avoid. The finite bound turns malformed authority into a fail-closed path
   * rather than an unbounded calculation.
   */
  private pendingRampDownDeltaVMps(maximumJerkMps3: number, fixedDeltaSeconds: number): number {
    const currentCommandMps2 = this.commandedPoweredAccelerationMps2;
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
      if (!Number.isFinite(remainingCommandMps2) || !Number.isFinite(pendingDeltaVMps)) {
        return Number.NaN;
      }
    }

    return remainingCommandMps2 <= 1e-9 ? pendingDeltaVMps : Number.NaN;
  }

  private isFacingStableForBurn(ship: ShipState, requestedDirection: ShipState["position"], live: LiveMotionAuthority): boolean {
    const burnAlignmentTolerance = Math.min(live.mainThrustAlignmentToleranceRadians, live.flipCompletionToleranceRadians);
    if (angleBetween(bodyForward(ship), requestedDirection) > burnAlignmentTolerance) {
      return false;
    }

    return magnitude(ship.angularVelocity) <= stableBurnAngularVelocityFor(live);
  }

  /** Reused by the pre-step fail-closed gate and the normal braking switch. */
  private dynamicBrakingReserveFor(
    ship: ShipState,
    segment: RouteSegment,
    plan: RoutePlan,
    arrivalEnvelope: ArrivalEnvelope | null,
    arrivalRadius: number,
    live: LiveMotionAuthority
  ): DynamicBrakingReserve {
    const targetOffset = sub(segment.end, ship.position);
    const targetDirection = normalize(targetOffset);
    const isTerminalSegment = this.currentSegment(plan).id === segment.id && this.activeSegmentIndex >= plan.segments.length - 1;
    const segmentDirection = magnitude(normalize(sub(segment.end, segment.start))) > 1e-6 ? normalize(sub(segment.end, segment.start)) : targetDirection;
    const projectedSegmentSpeed = Math.max(0, dot(ship.velocity, segmentDirection));
    const segmentEnvelopeRadius = isTerminalSegment ? Math.max(0, arrivalRadius) : Math.max(2, Math.min(8, segment.clearanceRadius));
    const arrivalTerminalSpeed = terminalSpeedForArrival(arrivalEnvelope);
    const terminalSpeed = isTerminalSegment
      ? segment.motionConstraint?.terminalSpeedMps ?? (arrivalEnvelope?.stopBehavior === "NoStopRequired" ? segment.motionConstraint?.exitSpeedMps ?? segment.desiredSpeed : arrivalTerminalSpeed ?? 0)
      : segment.motionConstraint?.exitSpeedMps ?? this.waypointTurnSpeed(plan, segment);
    const nextSegment = plan.segments[this.activeSegmentIndex + 1];
    const nextSegmentDirection = nextSegment ? normalize(sub(nextSegment.end, nextSegment.start)) : vec3();
    const canContinueTerminalLookahead =
      nextSegment?.kind === "Terminal" &&
      magnitude(segmentDirection) > 1e-6 &&
      magnitude(nextSegmentDirection) > 1e-6 &&
      dot(segmentDirection, nextSegmentDirection) >= collinearContinuationDirectionDot;
    const requiresConservativeCornerSettling =
      segment.motionConstraint?.turnConstraint.kind === "Corner" ||
      (nextSegment !== undefined && !canContinueTerminalLookahead);
    const nextTerminalSpeed = canContinueTerminalLookahead
      ? nextSegment.motionConstraint?.terminalSpeedMps ?? nextSegment.motionConstraint?.exitSpeedMps
      : undefined;
    const brakeTargetSpeedMps = nextTerminalSpeed === undefined ? terminalSpeed : nextTerminalSpeed;
    const brakeTargetDistanceM = nextTerminalSpeed === undefined
      ? magnitude(targetOffset)
      : magnitude(targetOffset) + distance(nextSegment?.start ?? segment.end, nextSegment?.end ?? segment.end);
    const brakingDirection = scale(segmentDirection, -1);
    const rampDownSeconds = this.commandedPoweredAccelerationMps2 / live.maximumJerkMps3;
    // A pending positive main-thrust command cannot vanish at the braking
    // decision. Include its jerk-limited delta-v before evaluating the reverse
    // burn so commitment never relies on stale pre-ramp speed.
    const pendingPositiveRampDeltaVMps = 0.5 * this.commandedPoweredAccelerationMps2 * rampDownSeconds;
    const projectedPostRampSpeedMps = projectedSegmentSpeed + pendingPositiveRampDeltaVMps;
    const brakingProjectionSpeedMps = projectedPostRampSpeedMps;
    const brakingDistance = (brakingProjectionSpeedMps * brakingProjectionSpeedMps - brakeTargetSpeedMps * brakeTargetSpeedMps) / (2 * live.brakingAccelerationMps2);
    const flipAngle = angleBetween(bodyForward(ship), brakingDirection);
    // Every brake/flip must reserve the real heading-controller settling time.
    // Direct terminal legs have the same finite SAS/RCS convergence gate as
    // constrained corners; ideal angular kinematics are not an executable burn
    // readiness guarantee.
    const flipSeconds = estimatedStableBurnSeconds(
      flipAngle,
      magnitude(ship.angularVelocity),
      live,
      ship.sasEnabled && ship.authority.sasAvailable
    );
    const rampSeconds = live.brakingAccelerationMps2 / live.maximumJerkMps3;
    const rampDeltaV = 0.5 * live.brakingAccelerationMps2 * rampSeconds;
    const brakingRampReserve = brakingProjectionSpeedMps - brakeTargetSpeedMps <= rampDeltaV
      ? 0
      : Math.max(
          0,
          brakingProjectionSpeedMps * rampSeconds - live.brakingAccelerationMps2 * rampSeconds * rampSeconds / 6 +
            Math.max(0, ((brakingProjectionSpeedMps - rampDeltaV) ** 2 - brakeTargetSpeedMps * brakeTargetSpeedMps) / (2 * live.brakingAccelerationMps2)) -
            Math.max(0, brakingDistance)
        );
    // While a positive powered command ramps down linearly, it still advances
    // by v₀t + a₀t²/3. Reserve that derived forward displacement before the
    // flip/brake can apply; using the former quarter-term undercounted the
    // direct-route ramp and left high-authority runs to recover in terminal
    // capture.
    const rampDownReserve = projectedSegmentSpeed * rampDownSeconds + this.commandedPoweredAccelerationMps2 * rampDownSeconds * rampDownSeconds / 3;
    const angularSettlingReserve = requiresConservativeCornerSettling
      ? brakingProjectionSpeedMps * flipSeconds
      : brakingProjectionSpeedMps * (live.maximumAngularVelocityRadps / live.maximumAngularAccelerationRadps2);
    const brakingMargin = segmentEnvelopeRadius + projectedSegmentSpeed * 0.2 * live.brakingReserveMultiplier;
    const hardStoppingReserveM = Math.max(0, brakingDistance) + rampDownReserve + brakingProjectionSpeedMps * flipSeconds + brakingRampReserve + angularSettlingReserve;
    const dynamicReserveM = Math.max(0, brakingDistance) * live.brakingReserveMultiplier + rampDownReserve + brakingProjectionSpeedMps * flipSeconds + brakingRampReserve + angularSettlingReserve + brakingMargin;
    const finite = [brakeTargetSpeedMps, brakeTargetDistanceM, brakingProjectionSpeedMps, hardStoppingReserveM, dynamicReserveM, live.brakingAccelerationMps2, live.maximumJerkMps3, flipSeconds].every(Number.isFinite);
    // A constrained corner cannot wait for the current velocity to cross its
    // locked exit: the active positive jerk ramp would carry it past that gate.
    // Direct terminal capture retains its established switch behavior.
    const brakingDecisionSpeedMps = brakingProjectionSpeedMps;
    const needsBraking = brakingDecisionSpeedMps > brakeTargetSpeedMps + 0.05;
    // A controller tick begins the flip/brake response immediately. Permit one
    // fixed-step of travel for that handoff, but never coerce non-finite data or
    // a material stopping deficit into a recoverable command.
    const controllerStepAllowanceM = Math.max(0.5, projectedSegmentSpeed / 30);
    return {
      brakingDirection,
      brakeTargetSpeedMps,
      brakeTargetDistanceM,
      hardStoppingReserveM,
      dynamicReserveM,
      mustStartBraking: finite && needsBraking && brakeTargetDistanceM <= dynamicReserveM,
      insufficient: !finite || (needsBraking && brakeTargetDistanceM + controllerStepAllowanceM < hardStoppingReserveM)
    };
  }

  private latchFailure(
    tick: number,
    status: Extract<ExecutorStatus, "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient">,
    plan: RoutePlan,
    ship: ShipState,
    reasonCodes: readonly FailureReasonCode[]
  ): ShipState {
    this.latchedFailure = { status, reasonCodes: unique(reasonCodes) };
    this.commandedPoweredAccelerationMps2 = 0;
    this.terminalCommittedBrakeCloseCorrection = false;
    this.telemetry = this.createTelemetry(tick, status, plan, ship, true, this.latchedFailure.reasonCodes, inactiveTerminalTelemetry, "Executing");
    return ship;
  }

  private createAutopilotActuatorRequest(
    ship: ShipState,
    segment: RouteSegment,
    plan: RoutePlan,
    arrivalEnvelope: ArrivalEnvelope | null,
    arrivalRadius: number,
    live: LiveMotionAuthority,
    fixedDeltaSeconds: number
  ): AutopilotActuatorRequest {
    const targetOffset = sub(segment.end, ship.position);
    const targetDirection = normalize(targetOffset);
    const isTerminalSegment = this.currentSegment(plan).id === segment.id && this.activeSegmentIndex >= plan.segments.length - 1;
    const segmentDirection = magnitude(normalize(sub(segment.end, segment.start))) > 1e-6 ? normalize(sub(segment.end, segment.start)) : targetDirection;
    const projectedSegmentSpeed = Math.max(0, dot(ship.velocity, segmentDirection));
    const segmentEnvelopeRadius = isTerminalSegment ? Math.max(0, arrivalRadius) : Math.max(2, Math.min(8, segment.clearanceRadius));
    const arrivalTerminalSpeed = terminalSpeedForArrival(arrivalEnvelope);
    const terminalSpeed = isTerminalSegment
      ? segment.motionConstraint?.terminalSpeedMps ?? (arrivalEnvelope?.stopBehavior === "NoStopRequired" ? segment.motionConstraint?.exitSpeedMps ?? segment.desiredSpeed : arrivalTerminalSpeed ?? 0)
      : segment.motionConstraint?.exitSpeedMps ?? this.waypointTurnSpeed(plan, segment);
    const distanceToSegmentEnd = magnitude(targetOffset);
    const publishTerminalTelemetry = isTerminalSegment && isTerminalTelemetryEnvelope(arrivalEnvelope);
    const desiredTerminalVelocity = isTerminalSegment && arrivalEnvelope?.stopBehavior === "MatchTerminalSpeed"
      ? scale(targetDirection, terminalSpeed)
      : vec3();
    const routeTrackingTranslationCommand = this.createRcsTranslationCommand(ship, this.routeTrackingRcsAcceleration(ship, segment));
    const routeTrackingActive = magnitude(routeTrackingTranslationCommand) > 1e-6;
    const inactiveRequest = (
      motionPhase: LockedTransitPhase,
      facingDirection: ShipState["position"],
      terminalState: TerminalTelemetryState = inactiveTerminalTelemetry,
      braking = false
    ): AutopilotActuatorRequest => {
      const rampedDownAccelerationMps2 = this.rampPoweredAcceleration(0, live.maximumJerkMps3, fixedDeltaSeconds);
      if (Number.isFinite(rampedDownAccelerationMps2) && rampedDownAccelerationMps2 > 1e-9) {
        const currentForward = bodyForward(ship);
        return {
          facingDirection: currentForward,
          throttle: clamp(rampedDownAccelerationMps2 / Math.max(live.mainAccelerationMps2, 1e-6), 0, 1),
          desiredAcceleration: scale(currentForward, rampedDownAccelerationMps2),
          translationCommand: routeTrackingTranslationCommand,
          allowRcsTranslationOutsideTranslationMode: routeTrackingActive,
          mainThrustAlignmentToleranceRadians: live.mainThrustAlignmentToleranceRadians,
          desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
          arrivalPhase: terminalState.arrivalPhase,
          terminalCaptureActive: terminalState.terminalCaptureActive,
          terminalHoldingActive: terminalState.terminalHoldingActive,
          braking,
          motionPhase
        };
      }
      return {
        facingDirection,
        throttle: 0,
        desiredAcceleration: vec3(),
        translationCommand: routeTrackingTranslationCommand,
        allowRcsTranslationOutsideTranslationMode: routeTrackingActive,
        mainThrustAlignmentToleranceRadians: live.mainThrustAlignmentToleranceRadians,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        arrivalPhase: terminalState.arrivalPhase,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive,
        braking,
        motionPhase
      };
    };
    const poweredRequest = (
      motionPhase: LockedTransitPhase,
      facingDirection: ShipState["position"],
      targetAccelerationMps2: number,
      availableAccelerationMps2: number,
      terminalState: TerminalTelemetryState,
      braking: boolean
    ): AutopilotActuatorRequest => {
      const commandedAccelerationMps2 = this.rampPoweredAcceleration(targetAccelerationMps2, live.maximumJerkMps3, fixedDeltaSeconds);
      const normalizedFacingDirection = normalize(facingDirection);
      const desiredAcceleration = commandedAccelerationMps2 > 1e-9 && magnitude(normalizedFacingDirection) > 1e-9
        ? scale(normalizedFacingDirection, commandedAccelerationMps2)
        : vec3();
      return {
        facingDirection: magnitude(normalizedFacingDirection) > 1e-9 ? normalizedFacingDirection : targetDirection,
        throttle: commandedAccelerationMps2 <= 1e-9 ? 0 : clamp(commandedAccelerationMps2 / Math.max(availableAccelerationMps2, 1e-6), 0, 1),
        desiredAcceleration,
        translationCommand: routeTrackingTranslationCommand,
        allowRcsTranslationOutsideTranslationMode: routeTrackingActive,
        mainThrustAlignmentToleranceRadians: live.mainThrustAlignmentToleranceRadians,
        desiredTerminalVelocity: terminalState.desiredTerminalVelocity,
        arrivalPhase: terminalState.arrivalPhase,
        terminalCaptureActive: terminalState.terminalCaptureActive,
        terminalHoldingActive: terminalState.terminalHoldingActive,
        braking,
        motionPhase
      };
    };

    const insideTerminalCaptureEnvelope =
      isTerminalSegment &&
      isTerminalTelemetryEnvelope(arrivalEnvelope) &&
      Number.isFinite(arrivalRadius) &&
      distanceToSegmentEnd <= Math.max(0, arrivalRadius);
    const hasPassedTerminalEnd = isTerminalSegment && dot(targetOffset, segmentDirection) < 0;
    const rcsAcceleration = ship.rcsEnabled && ship.authority.rcsAvailable
      ? defaultFlightControllerOptions.rcsAcceleration * Math.max(0, ship.authority.translationAuthority)
      : 0;
    const rcsCaptureSpeed = Math.sqrt(Math.max(0, terminalSpeed * terminalSpeed + 2 * rcsAcceleration * Math.max(0, arrivalRadius)));
    const canBeginTerminalCapture =
      isTerminalSegment &&
      isTerminalTelemetryEnvelope(arrivalEnvelope) &&
      this.brakingCommitted &&
      magnitude(ship.velocity) <= rcsCaptureSpeed + 1e-6;
    const shouldCommitTerminalCapture =
      canBeginTerminalCapture ||
      ((!this.brakingCommitted || rcsAcceleration <= 1e-9) && isTerminalTelemetryEnvelope(arrivalEnvelope) && (insideTerminalCaptureEnvelope || hasPassedTerminalEnd));

    const terminalPdDemand = terminalPdAcceleration(ship, plan.target.position, desiredTerminalVelocity);
    const terminalPdDemandMagnitudeMps2 = magnitude(terminalPdDemand);
    const terminalPdDemandBraking = dot(terminalPdDemand, ship.velocity) < 0;
    const terminalPdDirectionAuthorityMps2 = terminalPdDemandBraking
      ? live.brakingAccelerationMps2
      : live.mainAccelerationMps2;
    const pendingRampDownDeltaVMps = this.pendingRampDownDeltaVMps(live.maximumJerkMps3, fixedDeltaSeconds);
    const terminalPdDemandFiniteAndWithinLiveAuthority =
      Number.isFinite(terminalPdDemand.x) &&
      Number.isFinite(terminalPdDemand.y) &&
      Number.isFinite(terminalPdDemand.z) &&
      Number.isFinite(terminalPdDemandMagnitudeMps2) &&
      Number.isFinite(terminalPdDirectionAuthorityMps2) &&
      terminalPdDemandMagnitudeMps2 <= terminalPdDirectionAuthorityMps2 + 1e-6;
    const signedAlongRouteSpeedMps = dot(ship.velocity, segmentDirection);
    const shouldLatchTerminalCommittedBrakeCloseCorrection =
      isTerminalSegment &&
      isTerminalTelemetryEnvelope(arrivalEnvelope) &&
      this.brakingCommitted &&
      this.activeMotionPhase === "Brake" &&
      !this.terminalCaptureCommitted &&
      !shouldCommitTerminalCapture &&
      Number.isFinite(terminalSpeed) &&
      Number.isFinite(signedAlongRouteSpeedMps) &&
      Number.isFinite(pendingRampDownDeltaVMps) &&
      terminalPdDemandFiniteAndWithinLiveAuthority &&
      signedAlongRouteSpeedMps <= terminalSpeed + pendingRampDownDeltaVMps + 0.05;
    this.terminalCommittedBrakeCloseCorrection =
      this.terminalCommittedBrakeCloseCorrection || shouldLatchTerminalCommittedBrakeCloseCorrection;
    if (this.terminalCommittedBrakeCloseCorrection && !this.terminalCaptureCommitted && !shouldCommitTerminalCapture) {
      const terminalState = terminalStateForPhase("TerminalBrake", desiredTerminalVelocity);
      const requestedDirection = terminalPdDemandMagnitudeMps2 > 1e-9
        ? normalize(terminalPdDemand)
        : scale(segmentDirection, -1);
      if (!this.isFacingStableForBurn(ship, requestedDirection, live)) {
        // The powered direction changes only after the existing symmetric ramp
        // has reached zero and the ordinary stable-facing gate has passed, but
        // this remains one committed Brake pass rather than a new flip phase.
        return inactiveRequest("Brake", requestedDirection, terminalState, true);
      }
      const desiredMainAcceleration = clampMagnitude(terminalPdDemand, terminalPdDirectionAuthorityMps2);
      return poweredRequest(
        "Brake",
        requestedDirection,
        magnitude(desiredMainAcceleration),
        terminalPdDirectionAuthorityMps2,
        terminalState,
        terminalPdDemandBraking
      );
    }

    this.terminalCaptureCommitted = this.terminalCaptureCommitted || shouldCommitTerminalCapture;
    if (this.terminalCaptureCommitted && isTerminalSegment && isTerminalTelemetryEnvelope(arrivalEnvelope)) {
      const terminalState = terminalStateForPhase("Capture", desiredTerminalVelocity);
      const requestedAcceleration = terminalPdDemand;
      const braking = terminalPdDemandBraking;
      const rcsControlDistance = rcsAcceleration > 1e-9
        ? Math.max(0, arrivalRadius) + Math.max(0, (rcsCaptureSpeed * rcsCaptureSpeed - terminalSpeed * terminalSpeed) / (2 * rcsAcceleration))
        : Math.max(0, arrivalRadius);
      const requiresMainTerminalCorrection =
        distanceToSegmentEnd > rcsControlDistance ||
        magnitude(ship.velocity) > rcsCaptureSpeed + 1e-6;
      if (requiresMainTerminalCorrection) {
        const availableAcceleration = braking ? live.brakingAccelerationMps2 : live.mainAccelerationMps2;
        const desiredMainAcceleration = clampMagnitude(requestedAcceleration, availableAcceleration);
        return poweredRequest(
          "TerminalCapture",
          desiredMainAcceleration,
          magnitude(desiredMainAcceleration),
          availableAcceleration,
          terminalState,
          braking
        );
      }
      return this.createTerminalRcsRequest(ship, requestedAcceleration, terminalState, "TerminalCapture", braking, { live, fixedDeltaSeconds });
    }

    if (magnitude(targetDirection) <= 1e-6) {
      return inactiveRequest("TerminalCapture", targetDirection, publishTerminalTelemetry ? terminalStateForPhase("Capture", desiredTerminalVelocity) : inactiveTerminalTelemetry);
    }

    const dynamicBrakingReserve = this.dynamicBrakingReserveFor(ship, segment, plan, arrivalEnvelope, arrivalRadius, live);
    this.brakingCommitted = this.brakingCommitted || dynamicBrakingReserve.mustStartBraking;

    if (
      this.brakingCommitted &&
      (
        projectedSegmentSpeed > dynamicBrakingReserve.brakeTargetSpeedMps + 0.05 ||
        dynamicBrakingReserve.mustStartBraking
      )
    ) {
      const terminalState = terminalStateForPhase(publishTerminalTelemetry ? "TerminalBrake" : "None", desiredTerminalVelocity);
      if (!this.isFacingStableForBurn(ship, dynamicBrakingReserve.brakingDirection, live)) {
        return inactiveRequest("Flip", dynamicBrakingReserve.brakingDirection, terminalState, true);
      }
      return poweredRequest("Brake", dynamicBrakingReserve.brakingDirection, live.brakingAccelerationMps2, live.brakingAccelerationMps2, terminalState, true);
    }

    const lockedPeakSpeedReached = live.maximumPeakSpeedMps !== undefined && projectedSegmentSpeed >= live.maximumPeakSpeedMps - 0.05;
    if (lockedPeakSpeedReached) {
      return inactiveRequest("Coast", segmentDirection, publishTerminalTelemetry && !isStopCaptureEnvelope(arrivalEnvelope) ? terminalStateForPhase("Capture", desiredTerminalVelocity) : inactiveTerminalTelemetry);
    }

    if (!this.isFacingStableForBurn(ship, segmentDirection, live)) {
      return inactiveRequest("AlignForBurn", segmentDirection);
    }

    const distanceLimitedSpeed = Math.sqrt(Math.max(0, terminalSpeed * terminalSpeed + 2 * live.mainAccelerationMps2 * Math.max(0, distanceToSegmentEnd - segmentEnvelopeRadius)));
    const desiredSpeed = live.maximumPeakSpeedMps === undefined ? distanceLimitedSpeed : Math.min(live.maximumPeakSpeedMps, distanceLimitedSpeed);
    const requestedAccelerationMps2 = clamp((desiredSpeed - projectedSegmentSpeed) * 1.35, 0, live.mainAccelerationMps2);
    if (requestedAccelerationMps2 <= 1e-6) {
      return inactiveRequest("Coast", segmentDirection, publishTerminalTelemetry && !isStopCaptureEnvelope(arrivalEnvelope) ? terminalStateForPhase("Capture", desiredTerminalVelocity) : inactiveTerminalTelemetry);
    }
    return poweredRequest(
      "Accelerate",
      segmentDirection,
      requestedAccelerationMps2,
      live.mainAccelerationMps2,
      publishTerminalTelemetry && !isStopCaptureEnvelope(arrivalEnvelope) ? terminalStateForPhase("Capture", desiredTerminalVelocity) : inactiveTerminalTelemetry,
      false
    );
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

  private shouldHandoffToCollinearTerminalSegment(ship: ShipState, plan: RoutePlan, segment: RouteSegment): boolean {
    const nextSegment = plan.segments[this.activeSegmentIndex + 1];
    if (!this.brakingCommitted || this.activeMotionPhase !== "Brake" || nextSegment?.kind !== "Terminal") {
      return false;
    }

    const currentDirection = normalize(sub(segment.end, segment.start));
    const nextDirection = normalize(sub(nextSegment.end, nextSegment.start));
    if (magnitude(currentDirection) <= 1e-6 || magnitude(nextDirection) <= 1e-6 || dot(currentDirection, nextDirection) < collinearContinuationDirectionDot) {
      return false;
    }

    const terminalEntrySpeed = nextSegment.motionConstraint?.entrySpeedMps ?? segment.motionConstraint?.exitSpeedMps ?? segment.desiredSpeed;
    return Math.max(0, dot(ship.velocity, currentDirection)) <= terminalEntrySpeed + 0.05;
  }

  private advanceToNextSegment(plan: RoutePlan, segment: RouteSegment, ship: ShipState, fixedDeltaSeconds: number): void {
    const nextSegment = plan.segments[this.activeSegmentIndex + 1];
    const currentDirection = normalize(sub(segment.end, segment.start));
    const nextDirection = nextSegment ? normalize(sub(nextSegment.end, nextSegment.start)) : vec3();
    const preservesCollinearBrake = this.brakingCommitted && nextSegment !== undefined && dot(currentDirection, nextDirection) >= collinearContinuationDirectionDot;
    this.activeSegmentIndex = Math.min(this.activeSegmentIndex + 1, plan.segments.length - 1);
    if (preservesCollinearBrake) {
      this.activeMotionPhase = "Brake";
      return;
    }

    this.terminalCommittedBrakeCloseCorrection = false;

    const activeSegment = this.currentSegment(plan);
    const activeDirection = normalize(sub(activeSegment.end, activeSegment.start));
    const activeLockedEntrySpeedMps = activeSegment.motionConstraint?.entrySpeedMps ?? this.waypointTurnSpeed(plan, activeSegment);
    const activeEntrySpeedToleranceMps = activeSegment.motionConstraint === undefined
      ? 0.05
      : activeSegment.motionConstraint.plannedUsableBrakingAccelerationMps2 * Math.max(0, fixedDeltaSeconds) + 0.05;
    const projectedActiveSpeedMps = magnitude(activeDirection) <= 1e-6 ? 0 : Math.max(0, dot(ship.velocity, activeDirection));
    const mustRetargetCommittedBrake =
      this.brakingCommitted &&
      nextSegment !== undefined &&
      projectedActiveSpeedMps > activeLockedEntrySpeedMps + activeEntrySpeedToleranceMps;
    if (mustRetargetCommittedBrake) {
      // The prior direction was not a geometric continuation. Keep the existing
      // commitment, but make its next request a brake/flip for the new locked
      // segment before Coast or Accelerate can be selected.
      this.activeMotionPhase = "Flip";
      this.terminalCaptureCommitted = false;
      return;
    }

    this.activeMotionPhase = "AlignForBurn";
    this.brakingCommitted = false;
    this.terminalCaptureCommitted = false;
  }

  private offRouteDistance(position: ShipState["position"], segment: RouteSegment): number {
    const isActiveTerminalSegment = this.lockedPlan?.segments.length !== undefined &&
      this.activeSegmentIndex >= this.lockedPlan.segments.length - 1 &&
      this.currentSegment(this.lockedPlan).id === segment.id;
    if (isActiveTerminalSegment) {
      const segmentOffset = sub(segment.end, segment.start);
      const segmentLength = magnitude(segmentOffset);
      if (segmentLength > 1e-9) {
        const segmentDirection = scale(segmentOffset, 1 / segmentLength);
        const alongDistance = dot(sub(position, segment.start), segmentDirection);
        const pointOnTerminalLine = add(segment.start, scale(segmentDirection, alongDistance));
        return distance(position, pointOnTerminalLine);
      }
    }
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
    const actualTelemetry = ship.actuatorTelemetry;
    const flipAngleRadians = this.activeMotionPhase === "Flip" && segment
      ? angleBetween(bodyForward(ship), scale(normalize(sub(segment.end, segment.start)), -1))
      : 0;
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
      ...(this.activeMotionPhase === null ? {} : { motionPhase: this.activeMotionPhase }),
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
      requestedBurnDirection: actualTelemetry.requestedBurnDirection,
      actualMainThrustDirection: actualTelemetry.actualMainThrustDirection,
      mainThrustAlignment: actualTelemetry.mainThrustAlignment,
      mainThrustAlignmentErrorRadians: actualTelemetry.mainThrustAlignmentErrorRadians,
      flipActive: this.activeMotionPhase === "Flip",
      flipAngleRadians,
      commandedPoweredAccelerationMps2: this.commandedPoweredAccelerationMps2,
      appliedMainAccelerationMps2: actualTelemetry.appliedMainAccelerationMps2,
      appliedAccelerationMps2: magnitude(actualTelemetry.lastAppliedAcceleration),
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
