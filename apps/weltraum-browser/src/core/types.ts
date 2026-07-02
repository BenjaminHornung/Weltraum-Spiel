import type { Vec3 } from "./vector";

export type AuthorityMode = "Manual" | "Assisted" | "Autopilot";

export type FailureReasonCode =
  | "FuelInsufficient"
  | "FuelDepleted"
  | "FuelReserveViolated"
  | "MainThrustersUnavailable"
  | "AutopilotUnavailable"
  | "AuthorityInsufficient"
  | "BrakeReserveInsufficient"
  | "OffLockedRoute";

export interface ShipMass {
  /** Dry hull mass in kilograms. */
  readonly dryMass: number;
  /** Cargo mass is a browser-mainline stub until cargo contracts exist. Unit: kilograms. */
  readonly cargoMass?: number;
  /** Fuel mass currently onboard. Unit: kilograms in this browser-native model. */
  readonly fuelMass: number;
  /** Computed owner value, never recomputed by HUD. Unit: kilograms. */
  readonly totalMass: number;
}

export interface FuelState {
  /** Maximum fuel mass/amount. Unit: kilograms for v1. */
  readonly capacity: number;
  /** Current fuel mass/amount. Unit: kilograms for v1. */
  readonly current: number;
  /** Reserved fuel that autopilot may not consume. Unit: kilograms for v1. */
  readonly reserve: number;
  /** Fuel burn in kilograms per kilonewton-second. */
  readonly burnRate: number;
  readonly status: "Ready" | "Blocked";
  readonly reasonCodes: readonly FailureReasonCode[];
}

export interface AuthorityState {
  readonly mode: AuthorityMode;
  readonly autopilotAvailable: boolean;
  readonly mainThrustersAvailable: boolean;
  readonly rcsAvailable: boolean;
  readonly sasAvailable: boolean;
  readonly translationAuthority: number;
  readonly rotationAuthority: number;
  readonly reasonCodes: readonly FailureReasonCode[];
}

export interface BrakingReserve {
  readonly requiredDeltaV: number;
  readonly availableDeltaV: number;
  readonly canBrake: boolean;
  readonly reasonCodes: readonly FailureReasonCode[];
}

export interface FlightSnapshot {
  readonly mass: ShipMass;
  readonly fuel: FuelState;
  readonly authority: AuthorityState;
  readonly brakingReserve: BrakingReserve;
  readonly routeValid: boolean;
  readonly failureReasonCodes: readonly FailureReasonCode[];
  readonly etaSeconds: number | null;
}

export interface Quaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export type FlightControlMode = "Cruise" | "Precision" | "Translation";

export type ControlModeEffectReasonCode =
  | "MainThrustModeBlocked"
  | "MainThrustUnavailable"
  | "MainThrustFuelBlocked"
  | "RcsDisabled"
  | "RcsUnavailable"
  | "RcsTranslationModeBlocked"
  | "RcsTranslationNoAuthority"
  | "RcsRotationNoAuthority"
  | "SasDisabled"
  | "SasUnavailable"
  | "SasNoRcsAuthority";

export interface ControlModeEffectSnapshot {
  readonly controlMode: FlightControlMode;
  readonly mainThrustAllowed: boolean;
  readonly rcsTranslationAllowed: boolean;
  readonly rcsRotationAllowed: boolean;
  readonly sasAllowed: boolean;
  readonly modeEffectLabel: string;
  readonly blockedReasonCodes: readonly ControlModeEffectReasonCode[];
  readonly notes: readonly string[];
  readonly rotationResponseScale: number;
}

export interface ActuatorTelemetry {
  readonly mainThrustActive: boolean;
  readonly rcsTranslationActive: boolean;
  readonly rcsRotationActive: boolean;
  readonly sasCorrectionActive: boolean;
  readonly controlModeEffect: ControlModeEffectSnapshot;
  readonly lastAppliedAcceleration: Vec3;
  readonly lastAppliedAngularAcceleration: Vec3;
}

export interface ShipState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly orientation: Quaternion;
  readonly angularVelocity: Vec3;
  readonly throttle: number;
  readonly controlMode: FlightControlMode;
  readonly rcsEnabled: boolean;
  readonly sasEnabled: boolean;
  readonly mainThrottleCommand: number;
  readonly translationCommand: Vec3;
  readonly rotationCommand: Vec3;
  readonly actuatorTelemetry: ActuatorTelemetry;
  readonly mass: ShipMass;
  readonly fuel: FuelState;
  readonly authority: AuthorityState;
}

export type TargetDescriptorKind = "Waypoint" | "Point" | "Landing" | "Docking" | "Cargo" | "Orbit";

export type ArrivalStopBehavior = "NoStopRequired" | "StopWithinEnvelope" | "MatchTerminalSpeed";

export interface ArrivalEnvelope {
  readonly radius: number;
  readonly terminalSpeed?: number;
  readonly stopBehavior?: ArrivalStopBehavior;
}

export interface TargetDescriptor {
  readonly id: string;
  readonly label: string;
  readonly kind: TargetDescriptorKind;
  readonly position: Vec3;
  readonly arrivalEnvelope: ArrivalEnvelope;
  /** @deprecated Use arrivalEnvelope.radius. Kept only as a compatibility bridge during v1 migration. */
  readonly arrivalRadius?: number;
}

export type RouteSegmentKind = "Direct" | "Avoidance" | "Terminal";

export interface RouteSegment {
  readonly id: string;
  readonly kind: RouteSegmentKind;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly desiredSpeed: number;
  readonly clearanceRadius: number;
}

export interface RoutePlan {
  readonly id: string;
  readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal";
  readonly createdAtTick: number;
  readonly target: TargetDescriptor;
  readonly segments: readonly RouteSegment[];
  readonly validation: RouteValidationResult;
  readonly score: RouteScore;
  readonly planHash: string;
}

export type RouteValidationReasonCode =
  | "InvalidTarget"
  | "UnsupportedTargetKind"
  | "UnsafeObstacle"
  | "ImpossibleArrivalEnvelope"
  | "FuelInsufficient"
  | "FuelReserveViolated"
  | "MainThrustersUnavailable"
  | "AutopilotUnavailable"
  | "AuthorityInsufficient"
  | "BrakeReserveInsufficient";

export type RouteValidationSeverity = "Reject" | "Warning";

export interface RouteValidationIssue {
  readonly code: RouteValidationReasonCode;
  readonly severity: RouteValidationSeverity;
  readonly message: string;
  readonly targetId?: string;
  readonly obstacleId?: string;
}

export interface RouteValidationResult {
  readonly ok: boolean;
  readonly issues: readonly RouteValidationIssue[];
  readonly rejectedReasonCodes: readonly RouteValidationReasonCode[];
}

export interface RouteScore {
  readonly distance: number;
  readonly segmentCount: number;
  readonly clearanceRisk: number;
  readonly fuelCostEstimate: number;
  readonly authorityRisk: number;
  readonly total: number;
  readonly reasons: readonly string[];
}

export interface RouteCandidate {
  readonly id: string;
  readonly planner: RoutePlan["planner"];
  readonly target: TargetDescriptor;
  readonly segments: readonly RouteSegment[];
  readonly validation: RouteValidationResult;
  readonly score: RouteScore;
}

export interface PlannerRejection {
  readonly planner: RoutePlan["planner"];
  readonly targetId: string | null;
  readonly reasonCodes: readonly RouteValidationReasonCode[];
  readonly issues: readonly RouteValidationIssue[];
}

export type RoutePlanningResult =
  | {
      readonly ok: true;
      readonly plan: RoutePlan;
      readonly candidate: RouteCandidate;
      readonly validation: RouteValidationResult;
      readonly score: RouteScore;
    }
  | {
      readonly ok: false;
      readonly rejection: PlannerRejection;
      readonly validation: RouteValidationResult;
      readonly candidate?: RouteCandidate;
    };

export interface ObstacleDescriptor {
  readonly id: string;
  readonly center: Vec3;
  readonly radius: number;
  readonly padding: number;
}

export interface PlannerContext {
  readonly tick: number;
  readonly ship: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles?: readonly ObstacleDescriptor[];
}

export interface LocalPlanner {
  readonly kind: RoutePlan["planner"];
  planResult(context: PlannerContext): RoutePlanningResult;
  plan(context: PlannerContext): RoutePlan;
}

export type ExecutorStatus = "Idle" | "Executing" | "Arrived" | "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient";

export type ExecutorArrivalPhase = "None" | "TerminalBrake" | "Capture" | "Holding";

export interface ExecutorTelemetry {
  readonly tick: number;
  readonly status: ExecutorStatus;
  readonly arrivalPhase?: ExecutorArrivalPhase;
  readonly planHash: string | null;
  readonly activeSegmentId: string | null;
  readonly distanceToTarget: number;
  readonly offRouteDistance: number;
  readonly terminalSpeedLimit?: number | null;
  readonly currentSpeed?: number;
  readonly terminalError?: number | null;
  readonly terminalSpeedError?: number | null;
  readonly terminalRadialSpeed?: number;
  readonly terminalTangentialSpeed?: number;
  readonly desiredTerminalVelocity?: Vec3;
  readonly terminalCaptureActive?: boolean;
  readonly terminalHoldingActive?: boolean;
  readonly replanRequired: boolean;
  readonly invalidationReasons: readonly string[];
  readonly failureReasonCodes: readonly FailureReasonCode[];
  readonly fuel: FuelState;
  readonly flightSnapshot: FlightSnapshot;
  readonly position: Vec3;
  readonly velocity: Vec3;
}
