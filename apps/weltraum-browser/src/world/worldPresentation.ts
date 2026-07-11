import { fnv1aHash, stableStringify } from "../core/hash";
import type {
  ArrivalStopBehavior,
  ExecutorStatus,
  ObstacleDescriptor,
  Quaternion,
  RouteLifecycle,
  RoutePlan,
  RouteSegmentKind,
  TargetDescriptorKind
} from "../core/types";
import type { Vec3 } from "../core/vector";
import type { TelemetrySnapshot } from "../sim/telemetry";
import type { FrameDescriptor } from "./frames";
import type { WorldChunkId } from "./chunkRegistry";
import type { RenderLodBand, WorldStreamingSnapshot } from "./worldStreaming";

export interface WorldPresentationResidencyCandidate {
  readonly sourceId: string;
  readonly chunkId: WorldChunkId | null;
}

export interface WorldPresentationResidency {
  readonly sourceId: string;
  readonly chunkId: WorldChunkId | null;
  readonly renderEligible: boolean;
  readonly renderLod: RenderLodBand | null;
}

export interface WorldPresentationLandmarkDescriptor {
  readonly sourceLandmarkId: string;
  readonly label: string;
  readonly position: Vec3;
}

export interface WorldPresentationDecorationDescriptor {
  readonly sourceDecorationId: string;
  readonly position: Vec3;
  readonly scale: number;
  readonly batchKey: string;
}

export interface WorldPresentationTarget {
  readonly sourceTargetId: string;
  readonly label: string;
  readonly kind: TargetDescriptorKind;
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
    readonly radiusSource: "RuntimeTruth";
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

export interface WorldPresentationLandmark {
  readonly sourceLandmarkId: string;
  readonly label: string;
  readonly position: Vec3;
  readonly truthBacked: false;
  readonly renderOnly: true;
  readonly radarVisible: false;
  readonly collisionRelevant: false;
}

export interface WorldPresentationDecoration {
  readonly sourceDecorationId: string;
  readonly position: Vec3;
  readonly scale: number;
  readonly batchKey: string;
  readonly renderEligible: boolean;
  readonly truthBacked: false;
  readonly renderOnly: true;
  readonly radarVisible: false;
  readonly collisionRelevant: false;
}

export interface WorldPresentationSnapshot {
  readonly frameId: string;
  readonly renderFrameRevision: number;
  readonly signature: string;
  readonly shipState: WorldPresentationShipState;
  readonly navigationState: WorldPresentationNavigationState;
  readonly selectedTarget: WorldPresentationTarget | null;
  readonly navigationFocusTarget: WorldPresentationTarget | null;
  readonly navigationBeacon: WorldPresentationNavigationBeacon | null;
  readonly route: WorldPresentationRoute | null;
  readonly obstacles: readonly WorldPresentationObstacle[];
  readonly landmarks: readonly WorldPresentationLandmark[];
  readonly decorations: readonly WorldPresentationDecoration[];
  readonly residency: readonly WorldPresentationResidency[];
  readonly runtimeTruthObstacleCount: number;
  readonly truthBackedObstacleProxyCount: number;
  readonly decorativeObjectCount: number;
  readonly rendererOwnsWorldTruth: false;
}

export interface BuildWorldPresentationInput {
  readonly telemetry: TelemetrySnapshot;
  readonly frame: FrameDescriptor;
  readonly renderFrameRevision: number;
  readonly landmarks?: readonly WorldPresentationLandmarkDescriptor[];
  readonly decorations?: readonly WorldPresentationDecorationDescriptor[];
  readonly streaming?: WorldStreamingSnapshot | null;
  readonly streamingCandidates?: readonly WorldPresentationResidencyCandidate[];
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

const targetFor = (
  target: NonNullable<TelemetrySnapshot["selectedTarget"]>,
  label: string,
  state: { readonly selected: boolean; readonly locked: boolean }
): WorldPresentationTarget => ({
  sourceTargetId: requiredId(target.id, `${label} target id`),
  label: target.label,
  kind: target.kind,
  position: copyVec3(target.position, `${label} target position`),
  arrivalRadius: nonNegative(target.arrivalEnvelope.radius, `${label} target arrival radius`),
  terminalSpeed: target.arrivalEnvelope.terminalSpeed === undefined
    ? null
    : nonNegative(target.arrivalEnvelope.terminalSpeed, `${label} target terminal speed`),
  stopBehavior: target.arrivalEnvelope.stopBehavior ?? null,
  selected: state.selected,
  locked: state.locked,
  truthBacked: true
});

export const adaptWorldStreamingResidency = (
  candidates: readonly WorldPresentationResidencyCandidate[],
  streaming?: WorldStreamingSnapshot | null
): readonly WorldPresentationResidency[] => {
  assertUnique(candidates, (candidate) => candidate.sourceId, "residency source");
  const visibleLods = new Map((streaming?.visibleLods ?? []).map((entry) => [entry.chunkId, entry.lod] as const));
  const result = candidates
    .map((candidate): WorldPresentationResidency => {
      const sourceId = requiredId(candidate.sourceId, "Residency source id");
      const chunkId = candidate.chunkId === null ? null : requiredId(candidate.chunkId, `Residency chunk id for ${sourceId}`);
      const renderLod = chunkId === null || !streaming ? null : (visibleLods.get(chunkId) ?? "Culled");
      return {
        sourceId,
        chunkId,
        renderEligible: chunkId === null || !streaming || renderLod !== "Culled",
        renderLod
      };
    })
    .sort((left, right) => compareIds(left.sourceId, right.sourceId));
  return deepFreeze(result);
};

const routeFor = (telemetry: TelemetrySnapshot): WorldPresentationRoute | null => {
  const selectedTargetId = telemetry.selectedTarget?.id ?? null;
  const locked = telemetry.lockedPlan;
  const preview = telemetry.routePreview;
  let plan: RoutePlan | null = null;
  let lifecycle: WorldPresentationRouteLifecycle = "Preview";
  let visibility: WorldPresentationRouteVisibility = "Visible";
  let blockerCode: string | null = null;
  let admissionReady = false;

  if (locked) {
    plan = locked;
    lifecycle = "Locked";
    admissionReady = true;
  } else if (preview?.state === "Ready" && !preview.stale && preview.plan) {
    plan = preview.plan;
    admissionReady = preview.lockAdmission.ok;
    if (selectedTargetId === null || preview.target?.id !== plan.target.id || plan.target.id !== selectedTargetId) {
      visibility = "Hidden";
      blockerCode = "TargetMismatch";
      admissionReady = false;
    } else if (!preview.lockAdmission.ok) {
      visibility = "Blocked";
      blockerCode = preview.lockAdmission.code;
    }
  } else if (preview?.plan) {
    plan = preview.plan;
    visibility = "Hidden";
    blockerCode = preview.staleReason ?? preview.state;
  } else {
    return null;
  }

  assertUnique(plan.segments, (segment) => segment.id, "route segment");
  const isCurrentExecutorPlan = telemetry.executor.planHash === plan.planHash;
  const isCompletedExecutorPlan = telemetry.executor.completedPlanHash === plan.planHash;
  if (lifecycle === "Preview" && isCompletedExecutorPlan) {
    visibility = "Hidden";
    blockerCode = "CompletedPlan";
    admissionReady = false;
  }
  const executorAssociation = isCurrentExecutorPlan ? "Current" : isCompletedExecutorPlan ? "Completed" : null;
  const executorActiveSegmentId = isCurrentExecutorPlan ? telemetry.executor.activeSegmentId : null;
  const activeIndex = executorActiveSegmentId === null ? -1 : plan.segments.findIndex((segment) => segment.id === executorActiveSegmentId);
  if (executorActiveSegmentId !== null && activeIndex < 0) {
    throw new Error(`Active segment id ${executorActiveSegmentId} is not present in route ${plan.id}`);
  }
  const goal = targetFor(plan.target, "Route goal", {
    selected: selectedTargetId === plan.target.id,
    locked: lifecycle === "Locked"
  });
  const segments = plan.segments.map((segment, index): WorldPresentationRouteSegment => ({
    sourceSegmentId: requiredId(segment.id, "Route segment id"),
    kind: segment.kind,
    start: copyVec3(segment.start, `Route segment ${segment.id} start`),
    end: copyVec3(segment.end, `Route segment ${segment.id} end`),
    desiredSpeed: nonNegative(segment.desiredSpeed, `Route segment ${segment.id} desiredSpeed`),
    clearanceRadius: nonNegative(segment.clearanceRadius, `Route segment ${segment.id} clearanceRadius`),
    brakeMarginMultiplier: segment.brakeMarginMultiplier === undefined
      ? null
      : nonNegative(segment.brakeMarginMultiplier, `Route segment ${segment.id} brakeMarginMultiplier`),
    progress: activeIndex < 0 ? "Pending" : index < activeIndex ? "Completed" : index === activeIndex ? "Active" : "Pending"
  }));

  return {
    sourceRouteId: requiredId(plan.id, "Route id"),
    sourcePlanHash: requiredId(plan.planHash, "Route sourcePlanHash"),
    sourceTargetId: goal.sourceTargetId,
    lifecycle,
    executorLifecycle: executorAssociation === null ? null : (telemetry.executor.routeLifecycle ?? null),
    executorAssociation,
    visibility,
    blockerCode,
    admissionReady,
    activeSegmentId: executorActiveSegmentId,
    segments,
    goal,
    truthBacked: true
  };
};

export const buildWorldPresentationSnapshot = (input: BuildWorldPresentationInput): WorldPresentationSnapshot => {
  const frameId = requiredId(input.frame.id, "Presentation frame id");
  const renderFrameRevision = nonNegative(input.renderFrameRevision, "renderFrameRevision");
  if (!Number.isInteger(renderFrameRevision)) {
    throw new Error("renderFrameRevision must be an integer");
  }

  const obstacles = input.telemetry.obstacles ?? [];
  const landmarks = input.landmarks ?? [];
  const decorations = input.decorations ?? [];
  assertUnique(obstacles, (obstacle) => obstacle.id, "obstacle");
  assertUnique(landmarks, (landmark) => landmark.sourceLandmarkId, "landmark");
  assertUnique(decorations, (decoration) => decoration.sourceDecorationId, "decoration");

  const residencyCandidates: readonly WorldPresentationResidencyCandidate[] = input.streamingCandidates ?? [
    ...obstacles.map((obstacle) => ({ sourceId: obstacle.id, chunkId: null })),
    ...decorations.map((decoration) => ({ sourceId: decoration.sourceDecorationId, chunkId: null }))
  ];
  const residency = adaptWorldStreamingResidency(residencyCandidates, input.streaming);
  const residencyById = new Map(residency.map((entry) => [entry.sourceId, entry] as const));
  const renderEligibleFor = (sourceId: string): boolean => residencyById.get(sourceId)?.renderEligible ?? true;

  const obstacleSnapshots = obstacles
    .map((obstacle: ObstacleDescriptor): WorldPresentationObstacle => ({
      sourceObstacleId: requiredId(obstacle.id, "Obstacle id"),
      center: copyVec3(obstacle.center, `Obstacle ${obstacle.id} center`),
      radius: nonNegative(obstacle.radius, `Obstacle ${obstacle.id} radius`),
      padding: nonNegative(obstacle.padding, `Obstacle ${obstacle.id} padding`),
      renderEligible: renderEligibleFor(obstacle.id),
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: true,
      visualProxyStyle: {
        geometry: "SolidLowPoly",
        outline: "Restrained",
        radiusSource: "RuntimeTruth"
      }
    }))
    .sort((left, right) => compareIds(left.sourceObstacleId, right.sourceObstacleId));

  const landmarkSnapshots = landmarks
    .map((landmark): WorldPresentationLandmark => ({
      sourceLandmarkId: requiredId(landmark.sourceLandmarkId, "Landmark id"),
      label: landmark.label,
      position: copyVec3(landmark.position, `Landmark ${landmark.sourceLandmarkId} position`),
      truthBacked: false,
      renderOnly: true,
      radarVisible: false,
      collisionRelevant: false
    }))
    .sort((left, right) => compareIds(left.sourceLandmarkId, right.sourceLandmarkId));

  const decorationSnapshots = decorations
    .map((decoration): WorldPresentationDecoration => ({
      sourceDecorationId: requiredId(decoration.sourceDecorationId, "Decoration id"),
      position: copyVec3(decoration.position, `Decoration ${decoration.sourceDecorationId} position`),
      scale: nonNegative(decoration.scale, `Decoration ${decoration.sourceDecorationId} scale`),
      batchKey: requiredId(decoration.batchKey, `Decoration ${decoration.sourceDecorationId} batchKey`),
      renderEligible: renderEligibleFor(decoration.sourceDecorationId),
      truthBacked: false,
      renderOnly: true,
      radarVisible: false,
      collisionRelevant: false
    }))
    .sort((left, right) => compareIds(left.sourceDecorationId, right.sourceDecorationId));

  const selectedTarget = input.telemetry.selectedTarget ? targetFor(input.telemetry.selectedTarget, "Selected", {
    selected: true,
    locked: input.telemetry.lockedPlan?.target.id === input.telemetry.selectedTarget.id
  }) : null;
  const route = routeFor(input.telemetry);
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
  const semanticPayload = {
    frameId,
    shipState: {
      position: copyVec3(input.telemetry.ship.position, "Ship position"),
      velocity: copyVec3(input.telemetry.ship.velocity, "Ship velocity"),
      orientation: copyQuaternion(input.telemetry.ship.orientation, "Ship orientation")
    },
    navigationState: {
      executorStatus: route?.executorAssociation ? input.telemetry.executor.status : "Idle",
      routeLifecycle: route?.executorLifecycle ?? null,
      distanceToTarget: route?.executorAssociation
        ? finite(input.telemetry.executor.distanceToTarget, "Navigation distanceToTarget")
        : null,
      offRouteDistance: route?.executorAssociation
        ? finite(input.telemetry.executor.offRouteDistance, "Navigation offRouteDistance")
        : null
    },
    selectedTarget,
    navigationFocusTarget,
    navigationBeacon,
    route,
    obstacles: obstacleSnapshots,
    landmarks: landmarkSnapshots,
    decorations: decorationSnapshots,
    residency,
    runtimeTruthObstacleCount: obstacleSnapshots.length,
    truthBackedObstacleProxyCount: obstacleSnapshots.filter((obstacle) => obstacle.renderEligible).length,
    decorativeObjectCount: landmarkSnapshots.length + decorationSnapshots.length,
    rendererOwnsWorldTruth: false as const
  };

  return deepFreeze({
    ...semanticPayload,
    renderFrameRevision,
    signature: fnv1aHash(stableStringify(semanticPayload))
  });
};
