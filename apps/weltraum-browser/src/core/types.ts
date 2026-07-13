import type { Vec3 } from "./vector";

export type AuthorityMode = "Manual" | "Assisted" | "Autopilot";

export type FailureReasonCode =
  | "FuelInsufficient"
  | "FuelDepleted"
  | "FuelReserveViolated"
  | "MainThrustersUnavailable"
  | "AutopilotUnavailable"
  | "AuthorityInsufficient"
  | "JerkAuthorityUnavailable"
  | "ComfortAccelerationUnavailable"
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

/** JSON-safe values permitted in a capability extension payload. */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Capability extension keys are namespaced so future producers do not collide. */
export type NamespacedExtensionKey = `${string}:${string}`;

export interface PropulsionFuelEfficiencyMetadata {
  readonly version: 1;
  /** Browser-v1 modeled impulse delivered per kilogram of fuel. */
  readonly modeledImpulsePerFuelKilogram: number;
}

export interface PropulsionHeatMetadata {
  readonly version: 1;
  /** Abstract thermal load accumulated per newton-second of powered thrust. */
  readonly heatLoadPerNewtonSecond: number;
  /** Abstract sustained cooling capacity for the capability snapshot. */
  readonly sustainedCoolingCapacity: number;
}

/**
 * Serializable physical propulsion snapshot. Values describe a ship's installed
 * capability rather than a planner/executor preference.
 */
export interface ShipPropulsionCapability {
  readonly version: 1;
  readonly mainThrustNewton: number;
  readonly effectiveBrakingThrustNewton: number;
  readonly structuralMaxAccelerationMps2: number;
  readonly sustainedThermalMaxAccelerationMps2: number;
  readonly maximumPeakAccelerationMps2: number;
  /** Radians per second squared. */
  readonly maximumAngularAcceleration: number;
  /** Radians per second. */
  readonly maximumAngularVelocity: number;
  readonly maximumCruiseSpeedMps?: number;
  readonly fuelEfficiency?: PropulsionFuelEfficiencyMetadata;
  readonly heat?: PropulsionHeatMetadata;
  readonly extensions?: Readonly<Partial<Record<NamespacedExtensionKey, JsonValue>>>;
}

export type OccupantMode = "HumanCrew" | "CrewlessDrone";

export type GravityFloorPolicy = "Preferred" | "RequiredWhenPhysicallyAvailable" | "Disabled";

/**
 * Occupant acceleration constraints. Crewless envelopes intentionally omit
 * biological acceleration maxima instead of serializing a non-finite sentinel.
 */
export interface OccupantAccelerationEnvelope {
  readonly version: 1;
  readonly occupantMode: OccupantMode;
  readonly preferredAccelerationMps2: number;
  readonly minimumComfortAccelerationMps2: number;
  readonly maximumSustainedAccelerationMps2?: number;
  readonly maximumPeakAccelerationMps2?: number;
  readonly maximumJerkMps3: number;
  readonly gravityFloorPolicy: GravityFloorPolicy;
}

export type TransitPolicyId = "CrewComfort" | "CrewSprint" | "Economy" | "DroneSprint" | "Custom";

export type LegacyTransitPolicyId = "Safe" | "Balanced" | "Fast";

export type RequestedTransitPolicyId = TransitPolicyId | LegacyTransitPolicyId;

export type TransitTurnBehavior = "Conservative" | "Balanced" | "Aggressive";

export type TransitWaypointBehavior = "BrakeForWaypoint" | "PreserveMomentum";

/** Serializable constraints locked with a resolved transit policy in later planning work. */
export interface TransitPolicyConstraints {
  readonly targetAccelerationMps2?: number;
  readonly targetAccelerationFraction?: number;
  readonly maximumAccelerationMps2: number;
  readonly maximumJerkMps3: number;
  readonly maximumPeakSpeedMps?: number;
  readonly coastAllowed: boolean;
  readonly coastFraction: number;
  readonly minimumTime: boolean;
  readonly brakingReserveMultiplier: number;
  readonly turnBehavior: TransitTurnBehavior;
  readonly waypointBehavior: TransitWaypointBehavior;
  readonly gravityFloorPolicy: GravityFloorPolicy;
}

/** Includes both the caller's identity and the canonical policy identity for deterministic hashing. */
export interface ResolvedTransitPolicy extends TransitPolicyConstraints {
  readonly version: 1;
  readonly requestedPolicyId: RequestedTransitPolicyId;
  readonly resolvedPolicyId: TransitPolicyId;
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
  /** Guidance direction requested by the executor; never an applied world-space thrust vector. */
  readonly requestedBurnDirection?: Vec3;
  /** Actual body-forward main-thrust direction when main thrust is applying force, otherwise zero. */
  readonly actualMainThrustDirection?: Vec3;
  /** Dot product of requested and current body-forward burn directions. */
  readonly mainThrustAlignment?: number;
  readonly mainThrustAlignmentErrorRadians?: number;
  readonly mainThrustAlignmentToleranceRadians?: number;
  readonly requestedMainAccelerationMps2?: number;
  readonly appliedMainAccelerationMps2?: number;
  /** Maximum safe vector sum of main and RCS acceleration for this step. */
  readonly combinedAccelerationLimitMps2?: number;
  /** Locked-profile jerk ceiling supplied for autonomous burn commands, zero when not applicable. */
  readonly maximumJerkMps3?: number;
  /** Applied body-forward main acceleration in the owner world/local-physics frame. */
  readonly lastAppliedMainAcceleration: Vec3;
  /** Applied RCS translation acceleration in the owner world/local-physics frame. */
  readonly lastAppliedRcsTranslationAcceleration: Vec3;
  /** Compatibility vector: main plus RCS translation in the owner world/local-physics frame. */
  readonly lastAppliedAcceleration: Vec3;
  /** Applied rotation/SAS acceleration in the owner ship body-local frame. */
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
  readonly propulsionCapability: ShipPropulsionCapability;
  readonly occupantAccelerationEnvelope: OccupantAccelerationEnvelope;
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

/** Stable phase names reserved for locked Browser transit profiles. */
export type LockedTransitPhase = "AlignForBurn" | "Accelerate" | "Coast" | "Flip" | "Brake" | "TerminalCapture" | "Holding";

/**
 * A finite turn constraint calculated from immutable route geometry and the
 * planning-time authority snapshot. It describes the transition at a
 * segment's exit, never a runtime route edit.
 */
export interface RouteTurnConstraint {
  readonly version: 1;
  readonly kind: "Straight" | "Corner" | "Terminal";
  readonly turnAngleRadians: number;
  readonly effectiveCornerRadiusM: number;
  readonly lateralAccelerationLimitMps2: number;
  readonly attitudeAngularAccelerationLimitRadps2: number;
  readonly attitudeAngularVelocityLimitRadps: number;
  readonly authorityScale: number;
  readonly nextSegmentBrakingAccelerationMps2: number;
  /** Present only when policy, capability, or corner geometry supplies a real finite cap. */
  readonly speedLimitMps?: number;
}

/** Immutable speed and authority bounds locked for one route segment. */
export interface RouteSegmentMotionConstraint {
  readonly version: 1;
  readonly entrySpeedMps: number;
  readonly exitSpeedMps: number;
  /** The unchanged target arrival speed when this is the terminal segment. */
  readonly terminalSpeedMps?: number;
  /** Present only when policy, capability, or corner geometry supplies a real finite cap. */
  readonly maximumPeakSpeedMps?: number;
  readonly plannedUsableMainAccelerationMps2: number;
  readonly plannedUsableBrakingAccelerationMps2: number;
  readonly turnConstraint: RouteTurnConstraint;
}

/**
 * Serializable route truth fixed before hashing. Fuel and live mass remain
 * execution inputs and therefore are intentionally not present here.
 */
export interface LockedRouteMotionProfile {
  readonly version: 1;
  readonly requestedPolicyId: RequestedTransitPolicyId;
  readonly resolvedPolicy: ResolvedTransitPolicy;
  readonly occupantAccelerationEnvelope: OccupantAccelerationEnvelope;
  readonly propulsionCapability: ShipPropulsionCapability;
  readonly planningAuthority: AuthorityState;
  readonly targetAccelerationMps2: number;
  readonly maximumAccelerationMps2: number;
  readonly maximumJerkMps3: number;
  /** Present only when policy or capability supplies a real finite route cap. */
  readonly maximumPeakSpeedMps?: number;
  readonly coastAllowed: boolean;
  readonly coastFraction: number;
  readonly minimumTime: boolean;
  readonly brakingReserveMultiplier: number;
  readonly turnBehavior: TransitTurnBehavior;
  readonly waypointBehavior: TransitWaypointBehavior;
  readonly gravityFloorPolicy: GravityFloorPolicy;
  readonly plannedUsableMainAccelerationMps2: number;
  readonly plannedUsableBrakingAccelerationMps2: number;
  readonly mainThrustAlignmentToleranceRadians: number;
  readonly flipCompletionToleranceRadians: number;
  readonly phaseVocabulary: readonly LockedTransitPhase[];
}

export interface RouteSegment {
  readonly id: string;
  readonly kind: RouteSegmentKind;
  readonly start: Vec3;
  readonly end: Vec3;
  /**
   * Legacy compatibility/diagnostic value. New transit execution must use the
   * immutable motionConstraint instead of treating this as a policy cap.
   */
  readonly desiredSpeed: number;
  readonly clearanceRadius: number;
  readonly brakeMarginMultiplier?: number;
  /** Omitted only for legacy manually-constructed segments. */
  readonly motionConstraint?: RouteSegmentMotionConstraint;
}

export interface RoutePlan {
  readonly id: string;
  readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal";
  readonly speedProfile: AutopilotSpeedProfileId;
  readonly createdAtTick: number;
  readonly target: TargetDescriptor;
  readonly segments: readonly RouteSegment[];
  readonly validation: RouteValidationResult;
  readonly score: RouteScore;
  /** Omitted only for legacy manually-constructed plans. Planner-created plans always lock this before hashing. */
  readonly motionProfile?: LockedRouteMotionProfile;
  readonly planHash: string;
}

export type RouteValidationReasonCode =
  | "InvalidTarget"
  | "UnsupportedTargetKind"
  | "UnsafeObstacle"
  | "UnsafeRouteSegment"
  | "RouteBudgetExceeded"
  | "RouteUnsolvable"
  | "ImpossibleArrivalEnvelope"
  | "FuelInsufficient"
  | "FuelReserveViolated"
  | "MainThrustersUnavailable"
  | "AutopilotUnavailable"
  | "AuthorityInsufficient"
  | "BrakeReserveInsufficient"
  | "InvalidMotionProfile";

export type RouteValidationSeverity = "Reject" | "Warning";

export interface RouteValidationIssue {
  readonly code: RouteValidationReasonCode;
  readonly severity: RouteValidationSeverity;
  readonly message: string;
  readonly targetId?: string;
  readonly obstacleId?: string;
  readonly segmentId?: string;
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

export type AutopilotSpeedProfileId = "Safe" | "Balanced" | "Fast";

export interface AutopilotSpeedProfile {
  readonly id: AutopilotSpeedProfileId;
  readonly label: string;
  readonly directDesiredSpeed: number;
  readonly avoidanceDesiredSpeed: number;
  readonly terminalApproachDesiredSpeed: number;
  readonly brakeMarginMultiplier: number;
  readonly notes: readonly string[];
}

export const autopilotSpeedProfiles: Readonly<Record<AutopilotSpeedProfileId, AutopilotSpeedProfile>> = {
  Safe: {
    id: "Safe",
    label: "Safe",
    directDesiredSpeed: 12,
    avoidanceDesiredSpeed: 10,
    terminalApproachDesiredSpeed: 8,
    brakeMarginMultiplier: 1.25,
    notes: ["Lower cruise speed and larger midcourse braking margin; terminal capture gates are unchanged."]
  },
  Balanced: {
    id: "Balanced",
    label: "Balanced",
    directDesiredSpeed: 18,
    avoidanceDesiredSpeed: 14,
    terminalApproachDesiredSpeed: 12,
    brakeMarginMultiplier: 1,
    notes: ["Current default browser autopilot cruise speeds with conservative terminal capture preserved."]
  },
  Fast: {
    id: "Fast",
    label: "Fast",
    directDesiredSpeed: 22,
    avoidanceDesiredSpeed: 18,
    terminalApproachDesiredSpeed: 15,
    brakeMarginMultiplier: 0.9,
    notes: ["Higher non-terminal desired speeds for stress evidence; StopWithinEnvelope terminal speed remains a hard gate."]
  }
};

export const autopilotSpeedProfileIds: readonly AutopilotSpeedProfileId[] = ["Safe", "Balanced", "Fast"];

export const autopilotSpeedProfileFor = (profile: AutopilotSpeedProfileId | null | undefined): AutopilotSpeedProfile =>
  autopilotSpeedProfiles[profile ?? "Balanced"];

export type AutopilotCourseExpectedOutcome = "Pass" | "KnownStress" | "ExpectedFail";

export type AutopilotCourseClassification = AutopilotCourseExpectedOutcome | "Fail";

export type AutopilotExpectedFailureReasonCode = FailureReasonCode | RouteValidationReasonCode;

export type AutopilotCourseCategory =
  | "DirectShort"
  | "DirectMedium"
  | "DirectLong"
  | "DirectExtreme"
  | "LateralInitialVelocity"
  | "HighInitialSpeed"
  | "LowAuthorityTerminal"
  | "LowFuelExpectedFail"
  | "NoMainThrusterExpectedFail"
  | "NoAuthorityExpectedFail"
  | "OffRouteDisturbanceExpectedFail"
  | "TerminalOverspeedExpectedFail"
  | "ObstacleSingle"
  | "ObstacleStress";

export interface AutopilotCourseAcceptance {
  readonly maxFinalDistance: number;
  readonly maxFinalSpeed: number;
  readonly minObstacleClearance: number;
  readonly maxTicks: number;
  readonly maxFuelUsed?: number;
  readonly allowReplanRequired?: boolean;
  /** Required primary failure reasons for ExpectedFail courses. */
  readonly expectedFailureReasonCodes?: readonly AutopilotExpectedFailureReasonCode[];
  /** Explicit failure-reason allow-list for ExpectedFail courses. */
  readonly allowedFailureReasonCodes?: readonly AutopilotExpectedFailureReasonCode[];
  /** Exact terminal executor status required by an ExpectedFail course. */
  readonly expectedFailureStatus?: "PlanningRejected" | Exclude<ExecutorStatus, "Idle" | "Executing" | "Arrived">;
}

export interface AutopilotProvingGroundCourse {
  readonly id: string;
  readonly label: string;
  readonly category: AutopilotCourseCategory;
  /** Straight-line distance from initial ship position to target in metres, rounded for catalog/evidence summaries. */
  readonly distanceMeters: number;
  /** Default evidence profile for this row; callers may still override it explicitly. */
  readonly speedProfile: AutopilotSpeedProfileId;
  readonly initialShip: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles: readonly ObstacleDescriptor[];
  readonly expectedOutcome: AutopilotCourseExpectedOutcome;
  readonly acceptance: AutopilotCourseAcceptance;
  readonly planner?: RoutePlan["planner"];
  readonly disturbance?: {
    readonly tick: number;
    readonly positionOffset?: Vec3;
    readonly velocityOffset?: Vec3;
  };
  readonly notes?: readonly string[];
}

export interface PlannerContext {
  readonly tick: number;
  readonly ship: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles?: readonly ObstacleDescriptor[];
  /** Preferred v1 policy selector. When omitted, the legacy speed profile resolves to its deterministic alias. */
  readonly transitPolicy?: RequestedTransitPolicyId;
  /** Required when transitPolicy is Custom; ignored by all canonical policy IDs. */
  readonly customTransitPolicyConstraints?: TransitPolicyConstraints;
  /** Planning-only override that is snapshotted into the locked route. */
  readonly occupantAccelerationEnvelope?: OccupantAccelerationEnvelope;
  /** Planning-only override that is snapshotted into the locked route. */
  readonly propulsionCapability?: ShipPropulsionCapability;
  /** Legacy compatibility/diagnostic selector retained during the transit-policy migration. */
  readonly speedProfile?: AutopilotSpeedProfileId;
}

export interface LocalPlanner {
  readonly kind: RoutePlan["planner"];
  planResult(context: PlannerContext): RoutePlanningResult;
  plan(context: PlannerContext): RoutePlan;
}

export type RouteLifecycle = "Idle" | "Executing" | "TerminalCapture" | "Arrived" | "Completed" | "Holding" | "Cancelled";

export type ExecutorStatus = "Idle" | "Executing" | "Arrived" | "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient";

export type ExecutorArrivalPhase = "None" | "TerminalBrake" | "Capture" | "Holding";

export interface ExecutorTelemetry {
  readonly tick: number;
  readonly status: ExecutorStatus;
  readonly routeLifecycle?: RouteLifecycle;
  /** Current immutable-profile execution phase, separate from terminal arrival state. */
  readonly motionPhase?: LockedTransitPhase;
  readonly arrivalPhase?: ExecutorArrivalPhase;
  readonly planHash: string | null;
  readonly completedPlanHash?: string | null;
  readonly lockedPlanActive?: boolean;
  readonly stationKeepingActive?: boolean;
  readonly canAcceptNewPlan?: boolean;
  readonly canSelectNewTarget?: boolean;
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
  readonly requestedBurnDirection?: Vec3;
  readonly actualMainThrustDirection?: Vec3;
  readonly mainThrustAlignment?: number;
  readonly mainThrustAlignmentErrorRadians?: number;
  readonly flipActive?: boolean;
  readonly flipAngleRadians?: number;
  readonly commandedPoweredAccelerationMps2?: number;
  readonly appliedMainAccelerationMps2?: number;
  readonly appliedAccelerationMps2?: number;
  readonly replanRequired: boolean;
  readonly invalidationReasons: readonly string[];
  readonly failureReasonCodes: readonly FailureReasonCode[];
  readonly fuel: FuelState;
  readonly flightSnapshot: FlightSnapshot;
  readonly position: Vec3;
  readonly velocity: Vec3;
}
