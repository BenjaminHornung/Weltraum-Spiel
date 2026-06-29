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

export interface ShipState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly mass: ShipMass;
  readonly fuel: FuelState;
  readonly authority: AuthorityState;
}

export interface TargetDescriptor {
  readonly id: string;
  readonly label: string;
  readonly position: Vec3;
  readonly arrivalRadius: number;
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
  readonly planHash: string;
}

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
  plan(context: PlannerContext): RoutePlan;
}

export type ExecutorStatus = "Idle" | "Executing" | "Arrived" | "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient";

export interface ExecutorTelemetry {
  readonly tick: number;
  readonly status: ExecutorStatus;
  readonly planHash: string | null;
  readonly activeSegmentId: string | null;
  readonly distanceToTarget: number;
  readonly offRouteDistance: number;
  readonly replanRequired: boolean;
  readonly invalidationReasons: readonly string[];
  readonly failureReasonCodes: readonly FailureReasonCode[];
  readonly fuel: FuelState;
  readonly flightSnapshot: FlightSnapshot;
  readonly position: Vec3;
  readonly velocity: Vec3;
}
