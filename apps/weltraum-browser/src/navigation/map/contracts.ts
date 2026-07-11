import { fnv1aHash, stableStringify } from "../../core/hash";
import type {
  ObstacleDescriptor,
  Quaternion,
  RoutePlan,
  RouteSegment,
  TargetDescriptor,
  TargetDescriptorKind
} from "../../core/types";
import type { Vec3 } from "../../core/vector";
import { ABSOLUTE_SYSTEM_FRAME, worldCoordinate, type WorldCoordinate } from "../../world/frames";
import type { SimulationUpdateMode } from "../../world/simulationBubble";
import type { WorldChunkId } from "../../world/chunkRegistry";
import type { RenderLodBand } from "../../world/worldStreaming";

export type NavigationMapOrbit = "north-up" | "ship-up";

export interface ActiveShipPresentationDescriptor {
  readonly displayName: string;
  readonly blueprintId: string;
  readonly visualId: string;
  readonly symbolKey: string;
  readonly forwardAxis: "+X";
}

export interface NavigationMapShipSnapshot {
  readonly id: string;
  readonly absolutePosition: WorldCoordinate;
  readonly orientation: Quaternion;
  readonly presentation: ActiveShipPresentationDescriptor;
}

export interface NavigationMapTargetSnapshot {
  readonly id: string;
  readonly label: string;
  readonly kind: TargetDescriptorKind;
  readonly absolutePosition: WorldCoordinate;
  readonly arrivalRadius: number;
}

export interface NavigationMapObstacleSnapshot {
  readonly id: string;
  readonly center: WorldCoordinate;
  readonly radius: number;
  readonly padding: number;
}

export interface NavigationMapRouteNodeSnapshot {
  readonly id: string;
  readonly absolutePosition: WorldCoordinate;
}

export interface NavigationMapRouteSegmentSnapshot {
  readonly id: string;
  readonly kind: RouteSegment["kind"];
  readonly start: WorldCoordinate;
  readonly end: WorldCoordinate;
  readonly desiredSpeed: number;
  readonly clearanceRadius: number;
  readonly brakeMarginMultiplier?: number;
}

export interface NavigationMapRouteSnapshot {
  readonly id: string;
  readonly planner: RoutePlan["planner"];
  readonly speedProfile: RoutePlan["speedProfile"];
  readonly targetId: string;
  readonly nodes: readonly NavigationMapRouteNodeSnapshot[];
  readonly segments: readonly NavigationMapRouteSegmentSnapshot[];
}

export interface NavigationMapEntitySnapshot {
  readonly id: string;
  readonly absolutePosition: WorldCoordinate;
  readonly chunkId: WorldChunkId;
  readonly residence: Exclude<SimulationUpdateMode, "Dormant">;
  readonly renderLod: RenderLodBand;
  readonly presentationKey: string;
}

export interface NavigationMapWorldProvenance {
  readonly registrySignature: string;
  readonly streamingSignature: string;
  readonly fullChunkIds: readonly WorldChunkId[];
  readonly snapshotChunkIds: readonly WorldChunkId[];
}

export interface NavigationMapSnapshot {
  readonly schemaVersion: 1;
  readonly absoluteFrameId: string;
  readonly floatingOriginFrameId?: string;
  readonly ship: NavigationMapShipSnapshot;
  readonly targets: readonly NavigationMapTargetSnapshot[];
  readonly selectedTargetId: string | null;
  readonly route: NavigationMapRouteSnapshot | null;
  readonly obstacles: readonly NavigationMapObstacleSnapshot[];
  readonly entities: readonly NavigationMapEntitySnapshot[];
  readonly world: NavigationMapWorldProvenance;
  readonly signature: string;
}

export interface NavigationMapViewportState {
  readonly orbit: NavigationMapOrbit;
  readonly centerAbsoluteX: number;
  readonly centerAbsoluteZ: number;
  readonly metersPerPixel: number;
}

export interface CreateNavigationMapSnapshotInput {
  readonly absoluteFrameId?: string;
  readonly floatingOriginFrameId?: string;
  readonly ship: NavigationMapShipSnapshot;
  readonly targets: readonly NavigationMapTargetSnapshot[];
  readonly selectedTargetId?: string | null;
  readonly route?: NavigationMapRouteSnapshot | null;
  readonly obstacles?: readonly NavigationMapObstacleSnapshot[];
  readonly entities?: readonly NavigationMapEntitySnapshot[];
  readonly world: NavigationMapWorldProvenance;
}

const codeUnitCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const requiredId = (value: string, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value;
};

const finiteNumber = (value: number, label: string): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const nonNegativeFiniteNumber = (value: number, label: string): number => {
  const finite = finiteNumber(value, label);
  if (finite < 0) {
    throw new Error(`${label} must be non-negative`);
  }
  return finite;
};

const activeShipForwardAxis = (value: ActiveShipPresentationDescriptor["forwardAxis"]): "+X" => {
  if (value !== "+X") {
    throw new Error("Ship presentation forward axis must be +X");
  }
  return value;
};

const residentSimulationMode = (value: NavigationMapEntitySnapshot["residence"], entityId: string): NavigationMapEntitySnapshot["residence"] => {
  if (value !== "Full" && value !== "Snapshot") {
    throw new Error(`World entity ${entityId} must be Full or Snapshot resident`);
  }
  return value;
};

const cloneQuaternion = (value: Quaternion): Quaternion => deepFreeze({
  x: finiteNumber(value.x, "Ship orientation x"),
  y: finiteNumber(value.y, "Ship orientation y"),
  z: finiteNumber(value.z, "Ship orientation z"),
  w: finiteNumber(value.w, "Ship orientation w")
});

const cloneWorldCoordinate = (position: WorldCoordinate, label: string): WorldCoordinate => {
  if (position.kind !== "WorldCoordinate" || position.frame.type !== "AbsoluteSystem") {
    throw new Error(`${label} must use an absolute WorldCoordinate`);
  }
  requiredId(position.frame.id, `${label} frame id`);
  const value = {
    x: finiteNumber(position.value.x, `${label} x`),
    y: finiteNumber(position.value.y, `${label} y`),
    z: finiteNumber(position.value.z, `${label} z`)
  };
  const originAbsolutePosition = {
    x: finiteNumber(position.frame.originAbsolutePosition.x, `${label} frame origin x`),
    y: finiteNumber(position.frame.originAbsolutePosition.y, `${label} frame origin y`),
    z: finiteNumber(position.frame.originAbsolutePosition.z, `${label} frame origin z`)
  };
  return deepFreeze({
    kind: "WorldCoordinate" as const,
    value,
    frame: { ...position.frame, originAbsolutePosition }
  });
};

const cloneShip = (ship: NavigationMapShipSnapshot): NavigationMapShipSnapshot => deepFreeze({
  id: requiredId(ship.id, "Ship id"),
  absolutePosition: cloneWorldCoordinate(ship.absolutePosition, "Ship position"),
  orientation: cloneQuaternion(ship.orientation),
  presentation: {
    displayName: requiredId(ship.presentation.displayName, "Ship display name"),
    blueprintId: requiredId(ship.presentation.blueprintId, "Ship blueprint id"),
    visualId: requiredId(ship.presentation.visualId, "Ship visual id"),
    symbolKey: requiredId(ship.presentation.symbolKey, "Ship symbol key"),
    forwardAxis: activeShipForwardAxis(ship.presentation.forwardAxis)
  }
});

const cloneTarget = (target: NavigationMapTargetSnapshot): NavigationMapTargetSnapshot => deepFreeze({
  id: requiredId(target.id, "Target id"),
  label: requiredId(target.label, "Target label"),
  kind: target.kind,
  absolutePosition: cloneWorldCoordinate(target.absolutePosition, `Target ${target.id} position`),
  arrivalRadius: nonNegativeFiniteNumber(target.arrivalRadius, `Target ${target.id} arrival radius`)
});

const cloneObstacle = (obstacle: NavigationMapObstacleSnapshot): NavigationMapObstacleSnapshot => deepFreeze({
  id: requiredId(obstacle.id, "Obstacle id"),
  center: cloneWorldCoordinate(obstacle.center, `Obstacle ${obstacle.id} center`),
  radius: nonNegativeFiniteNumber(obstacle.radius, `Obstacle ${obstacle.id} radius`),
  padding: nonNegativeFiniteNumber(obstacle.padding, `Obstacle ${obstacle.id} padding`)
});

const cloneRoute = (route: NavigationMapRouteSnapshot): NavigationMapRouteSnapshot => deepFreeze({
  id: requiredId(route.id, "Route id"),
  planner: route.planner,
  speedProfile: route.speedProfile,
  targetId: requiredId(route.targetId, "Route target id"),
  nodes: route.nodes.map((node) => ({
    id: requiredId(node.id, "Route node id"),
    absolutePosition: cloneWorldCoordinate(node.absolutePosition, `Route node ${node.id} position`)
  })),
  segments: route.segments.map((segment) => ({
    id: requiredId(segment.id, "Route segment id"),
    kind: segment.kind,
    start: cloneWorldCoordinate(segment.start, `Route segment ${segment.id} start`),
    end: cloneWorldCoordinate(segment.end, `Route segment ${segment.id} end`),
    desiredSpeed: nonNegativeFiniteNumber(segment.desiredSpeed, `Route segment ${segment.id} desired speed`),
    clearanceRadius: nonNegativeFiniteNumber(segment.clearanceRadius, `Route segment ${segment.id} clearance radius`),
    ...(segment.brakeMarginMultiplier === undefined ? {} : {
      brakeMarginMultiplier: nonNegativeFiniteNumber(segment.brakeMarginMultiplier, `Route segment ${segment.id} brake margin multiplier`)
    })
  }))
});

const cloneEntity = (entity: NavigationMapEntitySnapshot): NavigationMapEntitySnapshot => deepFreeze({
  id: requiredId(entity.id, "World entity id"),
  absolutePosition: cloneWorldCoordinate(entity.absolutePosition, `World entity ${entity.id} position`),
  chunkId: requiredId(entity.chunkId, `World entity ${entity.id} chunk id`) as WorldChunkId,
  residence: residentSimulationMode(entity.residence, entity.id),
  renderLod: entity.renderLod,
  presentationKey: requiredId(entity.presentationKey, `World entity ${entity.id} presentation key`)
});

const assertUniqueIds = (values: readonly { readonly id: string }[], label: string): void => {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) {
      throw new Error(`${label} contains duplicate id ${value.id}`);
    }
    ids.add(value.id);
  }
};

const canonicalWorld = (world: NavigationMapWorldProvenance): NavigationMapWorldProvenance => deepFreeze({
  registrySignature: requiredId(world.registrySignature, "World registry signature"),
  streamingSignature: requiredId(world.streamingSignature, "World streaming signature"),
  fullChunkIds: [...new Set(world.fullChunkIds)].sort(codeUnitCompare),
  snapshotChunkIds: [...new Set(world.snapshotChunkIds)].sort(codeUnitCompare)
});

type NavigationMapSignaturePayload = Omit<NavigationMapSnapshot, "floatingOriginFrameId" | "signature">;

const signaturePayload = (snapshot: Omit<NavigationMapSnapshot, "signature">): NavigationMapSignaturePayload => ({
  schemaVersion: snapshot.schemaVersion,
  absoluteFrameId: snapshot.absoluteFrameId,
  ship: snapshot.ship,
  targets: snapshot.targets,
  selectedTargetId: snapshot.selectedTargetId,
  route: snapshot.route,
  obstacles: snapshot.obstacles,
  entities: snapshot.entities,
  world: snapshot.world
});

export const createNavigationMapSnapshot = (input: CreateNavigationMapSnapshotInput): NavigationMapSnapshot => {
  const ship = cloneShip(input.ship);
  const targets = input.targets.map(cloneTarget).sort((left, right) => codeUnitCompare(left.id, right.id));
  const obstacles = (input.obstacles ?? []).map(cloneObstacle).sort((left, right) => codeUnitCompare(left.id, right.id));
  const entities = (input.entities ?? []).map(cloneEntity).sort((left, right) => codeUnitCompare(left.id, right.id));
  assertUniqueIds(targets, "Navigation map targets");
  assertUniqueIds(obstacles, "Navigation map obstacles");
  assertUniqueIds(entities, "Navigation map entities");

  const withoutSignature: Omit<NavigationMapSnapshot, "signature"> = deepFreeze({
    schemaVersion: 1 as const,
    absoluteFrameId: requiredId(input.absoluteFrameId ?? ship.absolutePosition.frame.id, "Absolute frame id"),
    ...(input.floatingOriginFrameId === undefined ? {} : {
      floatingOriginFrameId: requiredId(input.floatingOriginFrameId, "Floating-origin frame id")
    }),
    ship,
    targets,
    selectedTargetId: input.selectedTargetId ?? null,
    route: input.route ? cloneRoute(input.route) : null,
    obstacles,
    entities,
    world: canonicalWorld(input.world)
  });
  const signature = fnv1aHash(stableStringify(signaturePayload(withoutSignature)));
  return deepFreeze({ ...withoutSignature, signature });
};

export const serializeNavigationMapSnapshot = (snapshot: NavigationMapSnapshot): string =>
  stableStringify(createNavigationMapSnapshot(snapshot));

export const navigationMapShipSnapshot = (input: {
  readonly id?: string;
  readonly absolutePosition: WorldCoordinate;
  readonly orientation: Quaternion;
  readonly presentation: ActiveShipPresentationDescriptor;
}): NavigationMapShipSnapshot => cloneShip({
  id: input.id ?? "active-ship",
  absolutePosition: input.absolutePosition,
  orientation: input.orientation,
  presentation: input.presentation
});

export const navigationMapTargetSnapshot = (
  target: TargetDescriptor,
  frame = ABSOLUTE_SYSTEM_FRAME
): NavigationMapTargetSnapshot => cloneTarget({
  id: target.id,
  label: target.label,
  kind: target.kind,
  absolutePosition: worldCoordinate(target.position, frame),
  arrivalRadius: target.arrivalEnvelope.radius
});

export const navigationMapObstacleSnapshot = (
  obstacle: ObstacleDescriptor,
  frame = ABSOLUTE_SYSTEM_FRAME
): NavigationMapObstacleSnapshot => cloneObstacle({
  id: obstacle.id,
  center: worldCoordinate(obstacle.center, frame),
  radius: obstacle.radius,
  padding: obstacle.padding
});

const routeNodesFromSegments = (
  routeId: string,
  segments: readonly RouteSegment[],
  frameId: string
): readonly NavigationMapRouteNodeSnapshot[] => {
  if (segments.length === 0) {
    return [];
  }
  const frame = frameId === ABSOLUTE_SYSTEM_FRAME.id
    ? ABSOLUTE_SYSTEM_FRAME
    : { ...ABSOLUTE_SYSTEM_FRAME, id: frameId };
  return [segments[0].start, ...segments.map((segment) => segment.end)].map((value, index) => ({
    id: `${routeId}:node:${index}`,
    absolutePosition: worldCoordinate(value, frame)
  }));
};

export const navigationMapRouteSnapshot = (
  plan: RoutePlan,
  frame = ABSOLUTE_SYSTEM_FRAME
): NavigationMapRouteSnapshot => cloneRoute({
  id: plan.id,
  planner: plan.planner,
  speedProfile: plan.speedProfile,
  targetId: plan.target.id,
  nodes: routeNodesFromSegments(plan.id, plan.segments, frame.id),
  segments: plan.segments.map((segment) => ({
    id: segment.id,
    kind: segment.kind,
    start: worldCoordinate(segment.start, frame),
    end: worldCoordinate(segment.end, frame),
    desiredSpeed: segment.desiredSpeed,
    clearanceRadius: segment.clearanceRadius,
    ...(segment.brakeMarginMultiplier === undefined ? {} : { brakeMarginMultiplier: segment.brakeMarginMultiplier })
  }))
});

export const navigationMapViewportState = (overrides: Partial<NavigationMapViewportState> = {}): NavigationMapViewportState => {
  const metersPerPixel = finiteNumber(overrides.metersPerPixel ?? 1, "Viewport meters per pixel");
  if (metersPerPixel <= 0) {
    throw new Error("Viewport meters per pixel must be positive");
  }
  return deepFreeze({
    orbit: overrides.orbit ?? "north-up",
    centerAbsoluteX: finiteNumber(overrides.centerAbsoluteX ?? 0, "Viewport center x"),
    centerAbsoluteZ: finiteNumber(overrides.centerAbsoluteZ ?? 0, "Viewport center z"),
    metersPerPixel
  });
};

export const worldCoordinateValue = (position: WorldCoordinate): Vec3 => position.value;
