import type { ArrivalEnvelope, AuthorityState, BrakingReserve, ObstacleDescriptor, RoutePlan, RouteScore, RouteValidationResult, ShipState, TargetDescriptor } from "../core";
import { vec3 } from "../core";
import { blockingCorridorObstacles, createShipState, noAutopilotAuthority, noMainThrustersAuthority, provingGroundTargets } from "../world/provingGroundWorld";

export type ScenarioId =
  | "direct-local-arrival"
  | "obstacle-avoidance-route"
  | "insufficient-fuel"
  | "no-authority"
  | "no-main-thrusters"
  | "brake-reserve-insufficient"
  | "off-route-divergence"
  | "locked-plan-hash-preservation"
  | "explicit-replan-required-signal";

export type PlannerKind = "DirectLocal" | "ObstacleAvoidanceLocal";

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly label: string;
  readonly planner: PlannerKind;
  readonly ship: ShipState;
  readonly target: TargetDescriptor;
  readonly obstacles: readonly ObstacleDescriptor[];
  readonly maxTicks: number;
  readonly divergenceDistance: number;
  readonly perturbation?: {
    readonly tick: number;
    readonly positionOffset: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly expected: {
    readonly status?: "Arrived" | "Executing" | "Diverged" | "OutOfFuel" | "NoAuthority" | "BrakeReserveInsufficient";
    readonly replanRequired?: boolean;
    readonly invalidationReason?: string;
    readonly routeValid?: boolean;
    readonly requiresAvoidanceSegment?: boolean;
    readonly preservePlanHash?: boolean;
  };
}

export interface ScenarioResult {
  readonly id: ScenarioId;
  readonly label: string;
  readonly classification: "PASS" | "FAIL";
  readonly tick: number;
  readonly planner: RoutePlan["planner"];
  readonly planHashBefore: string;
  readonly planHashAfter: string | null;
  readonly segmentKinds: readonly string[];
  readonly targetKind: TargetDescriptor["kind"];
  readonly arrivalEnvelope: ArrivalEnvelope;
  readonly routeValidation: RouteValidationResult;
  readonly routeScore: RouteScore;
  readonly status: string;
  readonly arrivalPhase: string;
  readonly replanRequired: boolean;
  readonly invalidationReasons: readonly string[];
  readonly failureReasonCodes: readonly string[];
  readonly routeValid: boolean;
  readonly authority: AuthorityState;
  readonly brakingReserve: BrakingReserve;
  readonly initialMass: number;
  readonly finalMass: number;
  readonly initialFuel: number;
  readonly finalFuel: number;
  readonly fuelUsed: number;
  readonly finalSpeed: number;
  readonly terminalSpeedLimit: number | null;
  readonly terminalSpeedError: number | null;
  readonly terminalRadialSpeed: number;
  readonly terminalTangentialSpeed: number;
  readonly desiredTerminalVelocity: { readonly x: number; readonly y: number; readonly z: number };
  readonly terminalCaptureActive: boolean;
  readonly terminalHoldingActive: boolean;
  readonly fuel: number;
  readonly finalPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly targetPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly distanceToTarget: number;
  readonly offRouteDistance: number;
  readonly notes: readonly string[];
}

export const scenarioCatalog: readonly ScenarioDefinition[] = [
  {
    id: "direct-local-arrival",
    label: "Direct local arrival",
    planner: "DirectLocal",
    ship: createShipState(),
    target: provingGroundTargets.nearArrival,
    obstacles: [],
    maxTicks: 4,
    divergenceDistance: 24,
    expected: { status: "Arrived", replanRequired: false, preservePlanHash: true }
  },
  {
    id: "obstacle-avoidance-route",
    label: "Obstacle avoidance route",
    planner: "ObstacleAvoidanceLocal",
    ship: createShipState(),
    target: provingGroundTargets.navigationBeta,
    obstacles: blockingCorridorObstacles,
    maxTicks: 8,
    divergenceDistance: 24,
    expected: { status: "Executing", replanRequired: false, requiresAvoidanceSegment: true, preservePlanHash: true }
  },
  {
    id: "insufficient-fuel",
    label: "Insufficient fuel",
    planner: "DirectLocal",
    ship: createShipState({ fuel: 0 }),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 2,
    divergenceDistance: 24,
    expected: { status: "OutOfFuel", replanRequired: true, invalidationReason: "FuelDepleted", preservePlanHash: true }
  },
  {
    id: "no-authority",
    label: "No authority",
    planner: "DirectLocal",
    ship: createShipState({ authority: noAutopilotAuthority }),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 2,
    divergenceDistance: 24,
    expected: { status: "NoAuthority", replanRequired: true, invalidationReason: "AutopilotUnavailable", preservePlanHash: true }
  },
  {
    id: "no-main-thrusters",
    label: "No main thrusters",
    planner: "DirectLocal",
    ship: createShipState({ authority: noMainThrustersAuthority }),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 2,
    divergenceDistance: 24,
    expected: { status: "NoAuthority", replanRequired: true, invalidationReason: "MainThrustersUnavailable", preservePlanHash: true }
  },
  {
    id: "brake-reserve-insufficient",
    label: "Brake reserve insufficient",
    planner: "DirectLocal",
    ship: createShipState({ fuel: { current: 6, reserve: 5, capacity: 100, burnRate: 0.02 }, velocity: vec3(80, 0, 0) }),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 2,
    divergenceDistance: 24,
    expected: { status: "BrakeReserveInsufficient", replanRequired: true, invalidationReason: "BrakeReserveInsufficient", preservePlanHash: true }
  },
  {
    id: "off-route-divergence",
    label: "Off-route divergence",
    planner: "DirectLocal",
    ship: createShipState(),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 3,
    divergenceDistance: 12,
    perturbation: { tick: 0, positionOffset: vec3(0, 40, 0) },
    expected: { status: "Diverged", replanRequired: true, invalidationReason: "OffLockedRoute", routeValid: false, preservePlanHash: true }
  },
  {
    id: "locked-plan-hash-preservation",
    label: "Locked plan hash preservation",
    planner: "DirectLocal",
    ship: createShipState(),
    target: provingGroundTargets.navigationBeta,
    obstacles: [],
    maxTicks: 12,
    divergenceDistance: 24,
    expected: { status: "Executing", replanRequired: false, preservePlanHash: true }
  },
  {
    id: "explicit-replan-required-signal",
    label: "Explicit replan-required signal",
    planner: "ObstacleAvoidanceLocal",
    ship: createShipState(),
    target: provingGroundTargets.navigationBeta,
    obstacles: blockingCorridorObstacles,
    maxTicks: 3,
    divergenceDistance: 10,
    perturbation: { tick: 0, positionOffset: vec3(0, 42, 0) },
    expected: { status: "Diverged", replanRequired: true, invalidationReason: "OffLockedRoute", routeValid: false, preservePlanHash: true }
  }
];

export const getScenarioDefinition = (id: ScenarioId): ScenarioDefinition => {
  const scenario = scenarioCatalog.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Unknown proving-ground scenario: ${id}`);
  }

  return scenario;
};
