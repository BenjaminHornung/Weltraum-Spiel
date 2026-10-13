import { fnv1aHash, stableStringify } from "../core/hash";
import type {
  ArrivalStopBehavior,
  ExecutorStatus,
  Quaternion,
  RouteLifecycle,
  RoutePlan,
  RouteSegmentKind,
  TargetDescriptor
} from "../core/types";
import type { Vec3 } from "../core/vector";
import type {
  NavigationMapEntitySnapshot,
  NavigationMapRouteSnapshot,
  NavigationMapTargetSnapshot
} from "../navigation/map";
import type { TelemetrySnapshot } from "../sim/telemetry";
import type { WorldChunkId } from "./chunkRegistry";
import type { RenderLodBand } from "./worldStreaming";

export interface WorldPresentationTarget {
  readonly sourceTargetId: string;
  readonly label: string;
  readonly kind: NavigationMapTargetSnapshot["kind"];
  readonly position: Vec3;
  readonly arrivalRadius: number;
  readonly terminalSpeed: number | null;
  readonly stopBehavior: ArrivalStopBehavior | null;
  readonly selected: boolean;
  readonly locked: boolean;
  readonly truthBacked: true;
}

export interface WorldPresentationShipState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly orientation: Quaternion;
}

export interface WorldPresentationNavigationState {
  readonly executorStatus: ExecutorStatus;
  readonly routeLifecycle: RouteLifecycle | null;
  readonly distanceToTarget: number | null;
  readonly offRouteDistance: number | null;
}

export type WorldPresentationRouteLifecycle = "Preview" | "Locked";
export type WorldPresentationRouteVisibility = "Visible" | "Hidden" | "Blocked";
export type WorldPresentationSegmentProgress = "Pending" | "Active" | "Completed";

export interface WorldPresentationRouteSegment {
  readonly sourceSegmentId: string;
  readonly kind: RouteSegmentKind;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly desiredSpeed: number;
  readonly clearanceRadius: number;
  readonly brakeMarginMultiplier: number | null;
  readonly progress: WorldPresentationSegmentProgress;
}

export interface WorldPresentationRoute {
  readonly sourceRouteId: string;
  readonly sourcePlanHash: string;
  readonly sourceTargetId: string;
  readonly lifecycle: WorldPresentationRouteLifecycle;
  readonly executorLifecycle: RouteLifecycle | null;
  readonly executorAssociation: "Current" | "Completed" | null;
  readonly visibility: WorldPresentationRouteVisibility;
  readonly blockerCode: string | null;
  readonly admissionReady: boolean;
  readonly activeSegmentId: string | null;
  readonly segments: readonly WorldPresentationRouteSegment[];
  readonly goal: WorldPresentationTarget;
  readonly truthBacked: true;
}

export interface WorldPresentationObstacle {
  readonly sourceObstacleId: string;
  readonly center: Vec3;
  readonly radius: number;
  readonly padding: number;
  readonly renderEligible: boolean;
  readonly truthBacked: true;
  readonly renderOnly: false;
  readonly radarVisible: true;
  readonly collisionRelevant: true;
  readonly visualProxyStyle: {
    readonly geometry: "SolidLowPoly";
    readonly outline: "Restrained";
    readonly radiusSource: "NavigationMapTruth";
  };
}

export interface WorldPresentationNavigationBeacon {
  readonly sourceTargetId: string;
  readonly label: string;
  readonly position: Vec3;
  readonly truthBacked: true;
  readonly renderOnly: false;
  readonly radarVisible: true;
  readonly collisionRelevant: false;
}

export type WorldPresentationEntityRole = "Ambient" | "Landmark";

export interface WorldPresentationEntity {
  readonly sourceEntityId: string;
  readonly absolutePosition: Vec3;
  readonly chunkId: WorldChunkId;
  readonly residence: NavigationMapEntitySnapshot["residence"];
  readonly renderLod: RenderLodBand;
  readonly presentationKey: string;
  readonly role: WorldPresentationEntityRole;
  readonly renderEligible: boolean;
  readonly truthBacked: true;
  readonly renderOnly: false;
  readonly radarVisible: true;
  readonly collisionRelevant: false;
}

export interface WorldPresentationWorldProvenance {
  readonly registrySignature: string;
  readonly streamingSignature: string;
  readonly fullChunkIds: readonly WorldChunkId[];
  readonly snapshotChunkIds: readonly WorldChunkId[];
}

export interface WorldPresentationSnapshot {
  readonly frameId: string;
  readonly renderFrameRevision: number;
  readonly signature: string;
  readonly sourceNavigationMapSignature: string;
  readonly shipState: WorldPresentationShipState;
  readonly navigationState: WorldPresentationNavigationState;
  readonly selectedTarget: WorldPresentationTarget | null;
  readonly navigationFocusTarget: WorldPresentationTarget | null;
  readonly navigationBeacon: WorldPresentationNavigationBeacon | null;
  readonly route: WorldPresentationRoute | null;
  readonly obstacles: readonly WorldPresentationObstacle[];
  readonly entities: readonly WorldPresentationEntity[];
  readonly world: WorldPresentationWorldProvenance;
  readonly runtimeTruthObstacleCount: number;
  readonly truthBackedObstacleProxyCount: number;
  readonly worldEntityCount: number;
  readonly residentWorldEntityCount: number;
  readonly renderEligibleWorldEntityCount: number;
  readonly landmarkWorldEntityCount: number;
  readonly ambientWorldEntityCount: number;
  readonly rendererOwnsWorldTruth: false;
}

export interface BuildWorldPresentationInput {
  readonly telemetry: TelemetrySnapshot;
  readonly renderFrameRevision: number;
  readonly landmarkEntityIds: readonly string[];
}

interface RoutePresentationIntent {
  readonly plan: RoutePlan;
  readonly lifecycle: WorldPresentationRouteLifecycle;
  readonly visibility: WorldPresentationRouteVisibility;
  readonly blockerCode: string | null;
  readonly admissionReady: boolean;
}

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const requiredId = <T extends string>(value: T, label: string): T => {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value;
};

const finite = (value: number, label: string): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const nonNegative = (value: number, label: string): number => {
  const normalized = finite(value, label);
  if (normalized < 0) {
    throw new Error(`${label} must be non-negative`);
  }
  return normalized;
};

const copyVec3 = (value: Vec3, label: string): Vec3 => ({
  x: finite(value.x, `${label}.x`),
  y: finite(value.y, `${label}.y`),
  z: finite(value.z, `${label}.z`)
});

const copyQuaternion = (value: Quaternion, label: string): Quaternion => ({
  x: finite(value.x, `${label}.x`),
  y: finite(value.y, `${label}.y`),
  z: finite(value.z, `${label}.z`),
  w: finite(value.w, `${label}.w`)
});

const assertUnique = <T>(values: readonly T[], idFor: (value: T) => string, label: string): void => {
  const ids = new Set<string>();
  for (const value of values) {
    const id = requiredId(idFor(value), `${label} id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}`);
    }
    ids.add(id);
  }
};

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

const metadataTargetFor = (telemetry: TelemetrySnapshot, targetId: string): TargetDescriptor | null => {
  const candidates = [
    telemetry.selectedTarget ?? null,
    ...(telemetry.selectableTargets ?? []),
    telemetry.lockedPlan?.target ?? null,
    telemetry.routePreview?.target ?? null,
    telemetry.routePreview?.plan?.target ?? null
  ];
  return candidates.find((candidate): candidate is TargetDescriptor => candidate?.id === targetId) ?? null;
};

const targetFor = (
  target: NavigationMapTargetSnapshot,
  metadata: TargetDescriptor | null,
  label: string,
  state: { readonly selected: boolean; readonly locked: boolean }
): WorldPresentationTarget => ({
  sourceTargetId: requiredId(target.id, `${label} target id`),
  label: requiredId(target.label, `${label} target label`),
  kind: target.kind,
  position: copyVec3(target.absolutePosition.value, `${label} target position`),
  arrivalRadius: nonNegative(target.arrivalRadius, `${label} target arrival radius`),
  terminalSpeed: metadata?.arrivalEnvelope.terminalSpeed === undefined
    ? null
    : nonNegative(metadata.arrivalEnvelope.terminalSpeed, `${label} target terminal speed`),
  stopBehavior: metadata?.arrivalEnvelope.stopBehavior ?? null,
  selected: state.selected,
  locked: state.locked,
  truthBacked: true
});

const routeIntentFor = (
  telemetry: TelemetrySnapshot,
  selectedTargetId: string | null
): RoutePresentationIntent | null => {
  const locked = telemetry.lockedPlan;
  if (locked) {
    return {
      plan: locked,
      lifecycle: "Locked",
      visibility: "Visible",
      blockerCode: null,
      admissionReady: true
    };
  }

  const preview = telemetry.routePreview;
  if (!preview?.plan) {
    return null;
  }

  let visibility: WorldPresentationRouteVisibility = "Hidden";
  let blockerCode: string | null = preview.staleReason ?? preview.state;
  let admissionReady = false;
  if (preview.state === "Ready" && !preview.stale) {
    if (selectedTargetId === null || preview.target?.id !== preview.plan.target.id || preview.plan.target.id !== selectedTargetId) {
      visibility = "Hidden";
      blockerCode = "TargetMismatch";
    } else if (!preview.lockAdmission.ok) {
      visibility = "Blocked";
      blockerCode = preview.lockAdmission.code;
    } else {
      visibility = "Visible";
      blockerCode = null;
      admissionReady = true;
    }
  }

  if (telemetry.executor.completedPlanHash === preview.plan.planHash) {
    visibility = "Hidden";
    blockerCode = "CompletedPlan";
    admissionReady = false;
  }

  return {
    plan: preview.plan,
    lifecycle: "Preview",
    visibility,
    blockerCode,
    admissionReady
  };
};

const sameVec3 = (left: Vec3, right: Vec3): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z;

const routeMapMismatch = (mapRoute: NavigationMapRouteSnapshot, plan: RoutePlan): string | null => {
  if (mapRoute.planHash !== plan.planHash) {
    return `planHash ${mapRoute.planHash} does not match ${plan.planHash}`;
  }
  if (mapRoute.targetId !== plan.target.id) {
    return `target ${mapRoute.targetId} does not match ${plan.target.id}`;
  }
  if (mapRoute.segments.length !== plan.segments.length) {
    return `segment count ${mapRoute.segments.length} does not match ${plan.segments.length}`;
  }
  for (const [index, mapSegment] of mapRoute.segments.entries()) {
    const sourceSegment = plan.segments[index];
    if (mapSegment.id !== sourceSegment.id) {
      return `segment order differs at ${index}: ${mapSegment.id} does not match ${sourceSegment.id}`;
    }
    if (
      mapSegment.kind !== sourceSegment.kind
      || !sameVec3(mapSegment.start.value, sourceSegment.start)
      || !sameVec3(mapSegment.end.value, sourceSegment.end)
      || mapSegment.desiredSpeed !== sourceSegment.desiredSpeed
      || mapSegment.clearanceRadius !== sourceSegment.clearanceRadius
      || (mapSegment.brakeMarginMultiplier ?? null) !== (sourceSegment.brakeMarginMultiplier ?? null)
    ) {
      return `geometry differs for segment ${mapSegment.id}`;
    }
  }
  return null;
};

const routeFor = (
  telemetry: TelemetrySnapshot,
  selectedTargetId: string | null,
  targetById: ReadonlyMap<string, NavigationMapTargetSnapshot>,
  mapRoute: NavigationMapRouteSnapshot | null
): WorldPresentationRoute | null => {
  const intent = routeIntentFor(telemetry, selectedTargetId);
  if (!intent) {
    return null;
  }

  const mismatch = mapRoute === null ? "canonical navigation map route is missing" : routeMapMismatch(mapRoute, intent.plan);
  const canonicalMapRoute = mismatch === null && intent.visibility !== "Hidden" ? mapRoute : null;
  const mapTarget = targetById.get(intent.plan.target.id);
  if (!mapTarget) {
    throw new Error(`Navigation map target contradiction: target ${intent.plan.target.id} is missing`);
  }

  const isCurrentExecutorPlan = telemetry.executor.planHash === intent.plan.planHash;
  const isCompletedExecutorPlan = telemetry.executor.completedPlanHash === intent.plan.planHash;
  const executorAssociation = isCurrentExecutorPlan ? "Current" : isCompletedExecutorPlan ? "Completed" : null;
  const requestedActiveSegmentId = isCurrentExecutorPlan ? telemetry.executor.activeSegmentId : null;
  const canonicalSegments = canonicalMapRoute?.segments ?? [];
  const activeIndex = requestedActiveSegmentId === null
    ? -1
    : canonicalSegments.findIndex((segment) => segment.id === requestedActiveSegmentId);
  if (requestedActiveSegmentId !== null && canonicalMapRoute && activeIndex < 0) {
    throw new Error(`Active segment id ${requestedActiveSegmentId} is not present in navigation map route ${canonicalMapRoute.id}`);
  }
  const activeSegmentId = canonicalMapRoute && activeIndex >= 0 ? requestedActiveSegmentId : null;
  const goal = targetFor(mapTarget, metadataTargetFor(telemetry, mapTarget.id), "Route goal", {
    selected: selectedTargetId === mapTarget.id,
    locked: intent.lifecycle === "Locked"
  });
  const segments = canonicalSegments.map((segment, index): WorldPresentationRouteSegment => ({
    sourceSegmentId: requiredId(segment.id, "Route segment id"),
    kind: segment.kind,
    start: copyVec3(segment.start.value, `Route segment ${segment.id} start`),
    end: copyVec3(segment.end.value, `Route segment ${segment.id} end`),
    desiredSpeed: nonNegative(segment.desiredSpeed, `Route segment ${segment.id} desiredSpeed`),
    clearanceRadius: nonNegative(segment.clearanceRadius, `Route segment ${segment.id} clearanceRadius`),
    brakeMarginMultiplier: segment.brakeMarginMultiplier === undefined
      ? null
      : nonNegative(segment.brakeMarginMultiplier, `Route segment ${segment.id} brakeMarginMultiplier`),
    progress: activeIndex < 0 ? "Pending" : index < activeIndex ? "Completed" : index === activeIndex ? "Active" : "Pending"
  }));

  return {
    sourceRouteId: requiredId(canonicalMapRoute?.id ?? intent.plan.id, "Route id"),
    sourcePlanHash: requiredId(intent.plan.planHash, "Route sourcePlanHash"),
    sourceTargetId: goal.sourceTargetId,
    lifecycle: intent.lifecycle,
    executorLifecycle: executorAssociation === null ? null : (telemetry.executor.routeLifecycle ?? null),
    executorAssociation,
    visibility: mismatch === null ? intent.visibility : "Hidden",
    blockerCode: mismatch === null ? intent.blockerCode : "NavigationMapRouteMismatch",
    admissionReady: mismatch === null && intent.admissionReady,
    activeSegmentId,
    segments,
    goal,
    truthBacked: true
  };
};

const copyWorldChunkIds = (values: readonly WorldChunkId[], label: string): readonly WorldChunkId[] => {
  const result = values.map((value) => requiredId(value, label)).sort(compareIds);
  assertUnique(result, (value) => value, label);
  return result;
};

export const buildWorldPresentationSnapshot = (input: BuildWorldPresentationInput): WorldPresentationSnapshot => {
  const navigationMap = input.telemetry.navigationMap;
  if (!navigationMap) {
    throw new Error("TelemetrySnapshot.navigationMap is required for world presentation");
  }

  const frameId = requiredId(navigationMap.absoluteFrameId, "Navigation map absolute frame id");
  const sourceNavigationMapSignature = requiredId(navigationMap.signature, "Navigation map signature");
  const renderFrameRevision = nonNegative(input.renderFrameRevision, "renderFrameRevision");
  if (!Number.isInteger(renderFrameRevision)) {
    throw new Error("renderFrameRevision must be an integer");
  }

  assertUnique(navigationMap.targets, (target) => target.id, "navigation map target");
  assertUnique(navigationMap.obstacles, (obstacle) => obstacle.id, "navigation map obstacle");
  assertUnique(navigationMap.entities, (entity) => entity.id, "navigation map entity");
  const targetById = new Map(navigationMap.targets.map((target) => [target.id, target] as const));
  if (navigationMap.selectedTargetId !== null && !targetById.has(navigationMap.selectedTargetId)) {
    throw new Error(`Navigation map selected target contradiction: target ${navigationMap.selectedTargetId} is missing`);
  }
  if (navigationMap.route && !targetById.has(navigationMap.route.targetId)) {
    throw new Error(`Navigation map route target contradiction: target ${navigationMap.route.targetId} is missing`);
  }

  const selectedMapTarget = navigationMap.selectedTargetId === null
    ? null
    : (targetById.get(navigationMap.selectedTargetId) ?? null);
  const selectedTarget = selectedMapTarget === null
    ? null
    : targetFor(selectedMapTarget, metadataTargetFor(input.telemetry, selectedMapTarget.id), "Selected", {
      selected: true,
      locked: input.telemetry.lockedPlan?.target.id === selectedMapTarget.id
        && input.telemetry.lockedPlan.planHash === navigationMap.route?.planHash
    });
  const route = routeFor(input.telemetry, navigationMap.selectedTargetId, targetById, navigationMap.route);
  const navigationFocusTarget = route?.visibility === "Visible" && route.admissionReady ? route.goal : selectedTarget;
  const navigationBeacon: WorldPresentationNavigationBeacon | null = navigationFocusTarget === null ? null : {
    sourceTargetId: navigationFocusTarget.sourceTargetId,
    label: navigationFocusTarget.label,
    position: copyVec3(navigationFocusTarget.position, "Navigation beacon position"),
    truthBacked: true,
    renderOnly: false,
    radarVisible: true,
    collisionRelevant: false
  };

  const obstacles = navigationMap.obstacles
    .map((obstacle): WorldPresentationObstacle => ({
      sourceObstacleId: requiredId(obstacle.id, "Obstacle id"),
      center: copyVec3(obstacle.center.value, `Obstacle ${obstacle.id} center`),
      radius: nonNegative(obstacle.radius, `Obstacle ${obstacle.id} radius`),
      padding: nonNegative(obstacle.padding, `Obstacle ${obstacle.id} padding`),
      renderEligible: true,
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: true,
      visualProxyStyle: {
        geometry: "SolidLowPoly",
        outline: "Restrained",
        radiusSource: "NavigationMapTruth"
      }
    }))
    .sort((left, right) => compareIds(left.sourceObstacleId, right.sourceObstacleId));

  const landmarkEntityIds = new Set(
    input.landmarkEntityIds.map((entityId) => requiredId(entityId, "Landmark entity id"))
  );

  const entities = navigationMap.entities
    .map((entity): WorldPresentationEntity => ({
      sourceEntityId: requiredId(entity.id, "World entity id"),
      absolutePosition: copyVec3(entity.absolutePosition.value, `World entity ${entity.id} position`),
      chunkId: requiredId(entity.chunkId, `World entity ${entity.id} chunk id`),
      residence: entity.residence,
      renderLod: entity.renderLod,
      presentationKey: requiredId(entity.presentationKey, `World entity ${entity.id} presentation key`),
      role: landmarkEntityIds.has(entity.id) ? "Landmark" : "Ambient",
      renderEligible: entity.renderLod !== "Culled",
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: false
    }))
    .sort((left, right) => compareIds(left.sourceEntityId, right.sourceEntityId));

  const world: WorldPresentationWorldProvenance = {
    registrySignature: requiredId(navigationMap.world.registrySignature, "World registry signature"),
    streamingSignature: requiredId(navigationMap.world.streamingSignature, "World streaming signature"),
    fullChunkIds: copyWorldChunkIds(navigationMap.world.fullChunkIds, "Full chunk id"),
    snapshotChunkIds: copyWorldChunkIds(navigationMap.world.snapshotChunkIds, "Snapshot chunk id")
  };
  const routeAssociated = route?.executorAssociation !== null && route?.executorAssociation !== undefined;
  const semanticPayload = {
    frameId,
    sourceNavigationMapSignature,
    shipState: {
      position: copyVec3(navigationMap.ship.absolutePosition.value, "Ship position"),
      velocity: copyVec3(input.telemetry.ship.velocity, "Ship velocity"),
      orientation: copyQuaternion(navigationMap.ship.orientation, "Ship orientation")
    },
    navigationState: {
      executorStatus: routeAssociated ? input.telemetry.executor.status : "Idle",
      routeLifecycle: route?.executorLifecycle ?? null,
      distanceToTarget: routeAssociated
        ? finite(input.telemetry.executor.distanceToTarget, "Navigation distanceToTarget")
        : null,
      offRouteDistance: routeAssociated
        ? finite(input.telemetry.executor.offRouteDistance, "Navigation offRouteDistance")
        : null
    },
    selectedTarget,
    navigationFocusTarget,
    navigationBeacon,
    route,
    obstacles,
    entities,
    world,
    runtimeTruthObstacleCount: obstacles.length,
    truthBackedObstacleProxyCount: obstacles.length,
    worldEntityCount: entities.length,
    residentWorldEntityCount: entities.length,
    renderEligibleWorldEntityCount: entities.filter((entity) => entity.renderEligible).length,
    landmarkWorldEntityCount: entities.filter((entity) => entity.role === "Landmark").length,
    ambientWorldEntityCount: entities.filter((entity) => entity.role === "Ambient").length,
    rendererOwnsWorldTruth: false as const
  };

  return deepFreeze({
    ...semanticPayload,
    renderFrameRevision,
    signature: fnv1aHash(stableStringify(semanticPayload))
  });
};
