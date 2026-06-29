import type { Vec3 } from "./vector";

export type AuthorityMode = "Manual" | "Assisted" | "Autopilot";

export interface AuthorityState {
  readonly mode: AuthorityMode;
  readonly mainThrusters: boolean;
  readonly rcs: boolean;
  readonly autopilot: boolean;
}

export interface ShipState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly fuel: number;
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

export type ExecutorStatus = "Idle" | "Executing" | "Arrived" | "Diverged" | "OutOfFuel" | "NoAuthority";

export interface ExecutorTelemetry {
  readonly tick: number;
  readonly status: ExecutorStatus;
  readonly planHash: string | null;
  readonly activeSegmentId: string | null;
  readonly distanceToTarget: number;
  readonly offRouteDistance: number;
  readonly replanRequired: boolean;
  readonly invalidationReasons: readonly string[];
  readonly fuel: number;
  readonly position: Vec3;
  readonly velocity: Vec3;
}
