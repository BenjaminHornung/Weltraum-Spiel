import type { AuthorityState, FuelState, ObstacleDescriptor, ShipState, TargetDescriptor } from "../core";
import { createAuthorityState, createShipStateV2, vec3 } from "../core";
import { absoluteVelocity, createLocalPhysicsFrame, worldCoordinate, type FrameDescriptor, type LocalCoordinate } from "./frames";
import { projectEntitiesToLocalFrame } from "./floatingOrigin";
import type { WorldEntityState } from "./floatingOrigin";
import { createLowPolyInstanceBatch, type LowPolyInstanceBatch } from "./lowPolyInstances";

export const autopilotAuthority: AuthorityState = createAuthorityState({ mode: "Autopilot" });

export const noAutopilotAuthority: AuthorityState = createAuthorityState({
  mode: "Manual",
  mainThrustersAvailable: true,
  rcsAvailable: true,
  sasAvailable: true,
  autopilotAvailable: false
});

export const noMainThrustersAuthority: AuthorityState = createAuthorityState({
  mode: "Autopilot",
  mainThrustersAvailable: false,
  rcsAvailable: true,
  sasAvailable: true,
  autopilotAvailable: true
});

export const createShipState = (overrides: Partial<Omit<ShipState, "fuel">> & { readonly fuel?: Partial<FuelState> | number } = {}): ShipState =>
  createShipStateV2({
    position: overrides.position ?? vec3(0, 0, 0),
    velocity: overrides.velocity ?? vec3(0, 0, 0),
    fuel: overrides.fuel ?? 100,
    dryMass: overrides.mass?.dryMass,
    cargoMass: overrides.mass?.cargoMass,
    authority: overrides.authority ?? autopilotAuthority
  });

const playableStopTarget = (id: string, label: string, x: number): TargetDescriptor => ({
  id,
  label,
  kind: "Waypoint",
  position: vec3(x, 0, 0),
  arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
});

export const playableLargeFieldTargets = {
  range500: playableStopTarget("range-500m", "Range 500m", 500),
  range1000: playableStopTarget("range-1000m", "Range 1000m", 1_000),
  range2500: playableStopTarget("range-2500m", "Range 2500m", 2_500)
} satisfies Record<string, TargetDescriptor>;

export const provingGroundTargets = {
  nearArrival: {
    id: "arrival-near",
    label: "Direct arrival marker",
    kind: "Waypoint",
    position: vec3(1.5, 0, 0),
    arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
  },
  navigationAlpha: {
    id: "nav-alpha",
    label: "Navigation Alpha",
    kind: "Waypoint",
    position: vec3(120, 0, -30),
    arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
  },
  navigationBeta: {
    id: "nav-beta",
    label: "Navigation Beta",
    kind: "Point",
    position: vec3(90, 0, 0),
    arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
  },
  ...playableLargeFieldTargets
} satisfies Record<string, TargetDescriptor>;

export const defaultObstacles: readonly ObstacleDescriptor[] = [
  {
    id: "rock-a",
    center: vec3(58, 0, -14),
    radius: 11,
    padding: 8
  }
];

export const blockingCorridorObstacles: readonly ObstacleDescriptor[] = [
  {
    id: "corridor-rock",
    center: vec3(45, 0, 0),
    radius: 10,
    padding: 6
  }
];

export const playableLargeFieldObstacles: readonly ObstacleDescriptor[] = [
  {
    id: "playable-single-rock-500m",
    center: vec3(260, 0, 0),
    radius: 14,
    padding: 8
  },
  {
    id: "playable-corridor-upper-1000m",
    center: vec3(560, 32, 0),
    radius: 18,
    padding: 8
  },
  {
    id: "playable-corridor-lower-1000m",
    center: vec3(560, -32, 0),
    radius: 18,
    padding: 8
  },
  {
    id: "playable-corridor-center-1000m",
    center: vec3(760, 0, 0),
    radius: 16,
    padding: 8
  },
  {
    id: "playable-long-field-rock-a",
    center: vec3(1_320, 0, 84),
    radius: 22,
    padding: 10
  },
  {
    id: "playable-long-field-rock-b",
    center: vec3(1_850, 0, -90),
    radius: 22,
    padding: 10
  }
];

export const playableLargeFieldRuntimeObstacles: readonly ObstacleDescriptor[] = [
  ...defaultObstacles,
  ...playableLargeFieldObstacles
];

export const playableLargeFieldVisualLandmarks: readonly WorldEntityState[] = [
  { id: "range-gate-500-port", absolutePosition: worldCoordinate(vec3(500, -8, -54)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-gate-500-starboard", absolutePosition: worldCoordinate(vec3(500, 8, 54)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-gate-1000-port", absolutePosition: worldCoordinate(vec3(1_000, -10, -72)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-gate-1000-starboard", absolutePosition: worldCoordinate(vec3(1_000, 10, 72)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-gate-2500-port", absolutePosition: worldCoordinate(vec3(2_500, -16, -120)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-gate-2500-starboard", absolutePosition: worldCoordinate(vec3(2_500, 16, 120)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-beacon-1500", absolutePosition: worldCoordinate(vec3(1_500, 38, -130)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "range-beacon-2100", absolutePosition: worldCoordinate(vec3(2_100, -44, 140)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" }
];

export const provingGroundAsteroidField: readonly WorldEntityState[] = [
  { id: "asteroid-a", absolutePosition: worldCoordinate(vec3(22, -2, -36)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "asteroid-b", absolutePosition: worldCoordinate(vec3(38, 4, -64)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "asteroid-c", absolutePosition: worldCoordinate(vec3(64, -3, -48)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "asteroid-d", absolutePosition: worldCoordinate(vec3(86, 6, -78)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "asteroid-e", absolutePosition: worldCoordinate(vec3(114, -5, -42)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  { id: "asteroid-f", absolutePosition: worldCoordinate(vec3(132, 3, -92)), absoluteVelocity: absoluteVelocity(vec3(0, 0, 0)), renderBatchKey: "low-poly-asteroid" },
  ...playableLargeFieldVisualLandmarks
];

export interface ProvingGroundLowPolyRenderBatchOptions {
  readonly batchId?: string;
  readonly batchKey?: string;
  readonly frameId?: string;
  readonly frame?: FrameDescriptor;
  readonly maxInstances?: number;
  readonly localScale?: number | ((entity: { readonly localPosition: LocalCoordinate }, index: number) => number);
}

export const createProvingGroundLowPolyRenderBatch = (options: ProvingGroundLowPolyRenderBatchOptions = {}): LowPolyInstanceBatch => {
  const batchKey = options.batchKey ?? "low-poly-asteroid";
  const frame = options.frame ?? createLocalPhysicsFrame(options.frameId ?? "debug-local-render-frame", vec3(0, 0, 0));

  return createLowPolyInstanceBatch(projectEntitiesToLocalFrame(provingGroundAsteroidField, frame), {
    batchId: options.batchId ?? "debug-low-poly-asteroids",
    batchKey,
    sourceId: "proving-ground-world",
    maxInstances: options.maxInstances ?? 64,
    localScale: options.localScale ?? ((_entity, index) => 0.75 + (index % 3) * 0.22)
  });
};
