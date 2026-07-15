import type { Vec3 } from "../core/vector";
import { cullPlanetBoundingSphereByFrustum, type PlanetFrustumPlane } from "./frustumCulling";
import { cullPlanetTileCapByHorizon } from "./horizonCulling";
import { planetTileId } from "./ids";
import {
  calculatePlanetScreenSpaceError,
  planetGeometricErrorAtLevel
} from "./screenSpaceError";
import { createPlanetTileKey, tilesPerPlanetFace } from "./tileAddress";
import { createPlanetTileBounds, type PlanetTileBounds } from "./tileBounds";
import {
  createPlanetTileReadinessSnapshot,
  assertPlanetTileReadinessRevision,
  type PlanetTileReadinessSnapshot,
  type PlanetTileReadinessState
} from "./tileReadiness";
import { planetTileChildren } from "./tileTree";
import {
  assertPlanetTileSelectionRevision,
  comparePlanetTileLoadRequests,
  comparePlanetTileIds,
  createPlanetTileVisibilityPlan,
  type PlanetTileLoadRequest,
  type PlanetTileLoadRequestReasonCode,
  type PlanetTileVisibilityPlan,
  type PlanetTileVisibilityReason,
  type PlanetTileVisibilityReasonCode
} from "./tileVisibilityPlan";
import { PLANET_FACES, type PlanetTileId, type PlanetTileKey } from "./types";

export type PlanetTileSelectorErrorCode =
  | "INVALID_SELECTOR_INPUT"
  | "INVALID_SELECTOR_BUDGET"
  | "INVALID_GEOMETRIC_ERROR";

export class PlanetTileSelectorError extends Error {
  public constructor(
    public readonly code: PlanetTileSelectorErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetTileSelectorError";
  }
}

export interface PlanetTileSelectorInput {
  readonly selectionRevision: number;
  readonly acceptedReadinessRevision: number;
  readonly bodyId: string;
  readonly bodyRadiusMeters: number;
  readonly minHeightMeters: number;
  readonly maxHeightMeters: number;
  readonly conservativeHeightMarginMeters: number;
  readonly cameraPosition: Vec3;
  readonly viewportHeightPixels: number;
  readonly verticalFovRadians: number;
  readonly nearClampMeters: number;
  readonly frustumPlanes: readonly PlanetFrustumPlane[];
  readonly frustumToleranceMeters?: number;
  readonly horizonAngularToleranceRadians?: number;
  readonly maxLevel: number;
  /** A root error halved per level, or one explicit finite value for every level through maxLevel. */
  readonly geometricErrorMeters: number | readonly number[];
  readonly splitThresholdPixels: number;
  readonly readiness: PlanetTileReadinessSnapshot;
  readonly maxSelectedPrimaryTiles: number;
  readonly maxRequestedChildren: number;
}

export interface PlanetTileSelectionPriority {
  readonly coverageObligation: boolean;
  readonly visible: boolean;
  readonly ssePixels: number;
  readonly distanceToBoundMeters: number;
  readonly tileId: PlanetTileId;
}

export interface PlanetTileSelectionAccepted {
  readonly status: "accepted";
  readonly plan: PlanetTileVisibilityPlan;
}

export interface PlanetTileSelectionRevisionRejected {
  readonly status: "rejected";
  readonly reason: "readiness-revision-mismatch";
  readonly selectionRevision: number;
  readonly acceptedReadinessRevision: number;
  readonly readinessRevision: number;
}

export interface PlanetTileSelectionBudgetRejected {
  readonly status: "rejected";
  readonly reason: "insufficient-primary-budget";
  readonly selectionRevision: number;
  readonly readinessRevision: number;
  readonly requiredVisibleRootTiles: number;
  readonly maxSelectedPrimaryTiles: number;
}

export type PlanetTileSelectionRejected =
  | PlanetTileSelectionRevisionRejected
  | PlanetTileSelectionBudgetRejected;

export type PlanetTileSelectionResult = PlanetTileSelectionAccepted | PlanetTileSelectionRejected;

interface Candidate extends PlanetTileSelectionPriority {
  readonly key: PlanetTileKey;
  readonly bounds: PlanetTileBounds;
  readonly shouldSplit: boolean;
  readonly cullingReason: "culled-frustum" | "culled-horizon" | null;
}

interface PrimaryCandidate {
  readonly candidate: Candidate;
  readonly reason:
    | "primary-at-or-below-split-threshold"
    | "primary-max-level"
    | "primary-budget-deferred-refinement";
}

interface RequestCandidate {
  readonly candidate: Candidate;
  readonly state: Exclude<PlanetTileReadinessState, "render-ready">;
}

const compareBooleanDescending = (left: boolean, right: boolean): number =>
  left === right ? 0 : left ? -1 : 1;

const compareNumberAscending = (left: number, right: number): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareNumberDescending = (left: number, right: number): number =>
  left > right ? -1 : left < right ? 1 : 0;

/**
 * Exact V1 best-first priority: coverage obligation, visibility, SSE descending,
 * distance ascending, then canonical stable tile identity.
 */
export const comparePlanetTileSelectionPriority = (
  left: PlanetTileSelectionPriority,
  right: PlanetTileSelectionPriority
): number =>
  compareBooleanDescending(left.coverageObligation, right.coverageObligation) ||
  compareBooleanDescending(left.visible, right.visible) ||
  compareNumberDescending(left.ssePixels, right.ssePixels) ||
  compareNumberAscending(left.distanceToBoundMeters, right.distanceToBoundMeters) ||
  comparePlanetTileIds(left.tileId, right.tileId);

const geometricErrorAtLevel = (input: PlanetTileSelectorInput, level: number): number => {
  if (typeof input.geometricErrorMeters === "number") {
    return planetGeometricErrorAtLevel(input.geometricErrorMeters, level);
  }
  return input.geometricErrorMeters[level];
};

const validateSelectorInput = (input: PlanetTileSelectorInput): void => {
  tilesPerPlanetFace(input.maxLevel);
  if (
    !Number.isSafeInteger(input.maxSelectedPrimaryTiles) ||
    input.maxSelectedPrimaryTiles < 0 ||
    !Number.isSafeInteger(input.maxRequestedChildren) ||
    input.maxRequestedChildren < 0
  ) {
    throw new PlanetTileSelectorError(
      "INVALID_SELECTOR_BUDGET",
      "Planet tile primary and requested-child budgets must be non-negative safe integers."
    );
  }
  if (typeof input.geometricErrorMeters === "number") {
    if (!Number.isFinite(input.geometricErrorMeters) || input.geometricErrorMeters < 0) {
      throw new PlanetTileSelectorError(
        "INVALID_GEOMETRIC_ERROR",
        "Root geometric error must be a finite non-negative number."
      );
    }
  } else {
    if (
      !Array.isArray(input.geometricErrorMeters) ||
      input.geometricErrorMeters.length !== input.maxLevel + 1
    ) {
      throw new PlanetTileSelectorError(
        "INVALID_GEOMETRIC_ERROR",
        "Per-level geometric errors must contain one finite non-negative value for every selected level."
      );
    }
    for (let level = 0; level <= input.maxLevel; level += 1) {
      if (
        !Object.prototype.hasOwnProperty.call(input.geometricErrorMeters, level) ||
        !Number.isFinite(input.geometricErrorMeters[level]) ||
        input.geometricErrorMeters[level] < 0
      ) {
        throw new PlanetTileSelectorError(
          "INVALID_GEOMETRIC_ERROR",
          `Per-level geometric error ${level} must be present, finite, and non-negative.`
        );
      }
    }
  }
};

const readinessReason = (
  state: Exclude<PlanetTileReadinessState, "render-ready">
): PlanetTileLoadRequestReasonCode => {
  switch (state) {
    case "not-requested": return "requested-child-not-requested";
    case "queued": return "requested-child-queued";
    case "loading": return "requested-child-loading";
    case "failed": return "requested-child-failed";
    case "evicted": return "requested-child-evicted";
  }
};

const reason = (tileId: PlanetTileId, code: PlanetTileVisibilityReasonCode): PlanetTileVisibilityReason =>
  Object.freeze({ tileId, code });

export const selectPlanetTiles = (input: PlanetTileSelectorInput): PlanetTileSelectionResult => {
  if (input === null || typeof input !== "object" || input.readiness === null || typeof input.readiness !== "object") {
    throw new PlanetTileSelectorError("INVALID_SELECTOR_INPUT", "Planet tile selector input is required.");
  }

  // Revision authority is checked before readiness normalization, bounds work, or traversal.
  assertPlanetTileSelectionRevision(input.selectionRevision);
  assertPlanetTileReadinessRevision(input.acceptedReadinessRevision);
  assertPlanetTileReadinessRevision(input.readiness.revision);
  if (input.readiness.revision !== input.acceptedReadinessRevision) {
    return Object.freeze({
      status: "rejected",
      reason: "readiness-revision-mismatch",
      selectionRevision: input.selectionRevision,
      acceptedReadinessRevision: input.acceptedReadinessRevision,
      readinessRevision: input.readiness.revision
    });
  }

  validateSelectorInput(input);
  const readiness = createPlanetTileReadinessSnapshot(input.readiness);
  const readinessById = new Map<PlanetTileId, PlanetTileReadinessState>(
    readiness.entries.map((entry) => [entry.tileId, entry.state])
  );
  const stateOf = (tileId: PlanetTileId): PlanetTileReadinessState =>
    readinessById.get(tileId) ?? "not-requested";

  const evaluateCandidate = (key: PlanetTileKey, coverageObligation: boolean): Candidate => {
    const canonicalKey = createPlanetTileKey(key);
    const tileId = planetTileId(canonicalKey);
    const bounds = createPlanetTileBounds({
      key: canonicalKey,
      bodyRadiusMeters: input.bodyRadiusMeters,
      minHeightMeters: input.minHeightMeters,
      maxHeightMeters: input.maxHeightMeters
    });
    const frustum = cullPlanetBoundingSphereByFrustum(
      bounds.boundingSphere,
      input.frustumPlanes,
      input.frustumToleranceMeters
    );
    const horizon = cullPlanetTileCapByHorizon({
      cameraPosition: input.cameraPosition,
      bodyRadiusMeters: input.bodyRadiusMeters,
      conservativeHeightMarginMeters: input.conservativeHeightMarginMeters,
      tileCap: bounds,
      angularToleranceRadians: input.horizonAngularToleranceRadians
    });
    const sse = calculatePlanetScreenSpaceError({
      geometricErrorMeters: geometricErrorAtLevel(input, canonicalKey.level),
      viewportHeightPixels: input.viewportHeightPixels,
      verticalFovRadians: input.verticalFovRadians,
      cameraPosition: input.cameraPosition,
      boundingSphere: bounds.boundingSphere,
      nearClampMeters: input.nearClampMeters,
      splitThresholdPixels: input.splitThresholdPixels
    });
    const cullingReason = frustum.culled ? "culled-frustum" : horizon.culled ? "culled-horizon" : null;
    return Object.freeze({
      key: canonicalKey,
      tileId,
      bounds,
      coverageObligation,
      visible: cullingReason === null,
      ssePixels: sse.ssePixels,
      distanceToBoundMeters: sse.distanceToBoundMeters,
      shouldSplit: sse.shouldSplit,
      cullingReason
    });
  };

  // All roots are evaluated before any plan collection is populated, so malformed
  // geometry/projection/frustum input cannot expose a partial plan.
  const roots = PLANET_FACES.map((face) => evaluateCandidate({
    bodyId: input.bodyId,
    face,
    level: 0,
    x: 0,
    y: 0
  }, true));
  const visibleRoots = roots.filter((candidate) => candidate.visible);
  if (visibleRoots.length > input.maxSelectedPrimaryTiles) {
    return Object.freeze({
      status: "rejected",
      reason: "insufficient-primary-budget",
      selectionRevision: input.selectionRevision,
      readinessRevision: readiness.revision,
      requiredVisibleRootTiles: visibleRoots.length,
      maxSelectedPrimaryTiles: input.maxSelectedPrimaryTiles
    });
  }

  const queue = [...visibleRoots];
  let activeFrontierSize = visibleRoots.length;
  const primaryCandidates: PrimaryCandidate[] = [];
  const fallbackCandidates: Candidate[] = [];
  const culledCandidates: Candidate[] = roots.filter((candidate) => !candidate.visible);
  const requestCandidates: RequestCandidate[] = [];
  const reasons: PlanetTileVisibilityReason[] = culledCandidates.map((candidate) =>
    reason(candidate.tileId, candidate.cullingReason as "culled-frustum" | "culled-horizon")
  );
  const loadRequest = (
    candidate: Candidate,
    requestReason: PlanetTileLoadRequestReasonCode,
    requiredForCoverage: boolean
  ): PlanetTileLoadRequest => Object.freeze({
    tileKey: candidate.key,
    reason: requestReason,
    priority: Object.freeze({
      coverageObligation: requiredForCoverage,
      visible: candidate.visible,
      ssePixels: candidate.ssePixels,
      distanceToBoundMeters: candidate.distanceToBoundMeters,
      tileId: candidate.tileId
    }),
    requiredForCoverage,
    expectedReadinessRevision: readiness.revision
  });

  while (queue.length > 0) {
    queue.sort(comparePlanetTileSelectionPriority);
    const candidate = queue.shift() as Candidate;

    if (candidate.shouldSplit && candidate.key.level < input.maxLevel) {
      const children = planetTileChildren(candidate.key).map((key) => evaluateCandidate(key, true));
      const requiredChildren = children.filter((child) => child.visible);
      const culledChildren = children.filter((child) => !child.visible);
      for (const child of culledChildren) {
        culledCandidates.push(child);
        reasons.push(reason(child.tileId, child.cullingReason as "culled-frustum" | "culled-horizon"));
      }

      const netFrontierGrowth = requiredChildren.length - 1;
      if (activeFrontierSize + netFrontierGrowth > input.maxSelectedPrimaryTiles) {
        primaryCandidates.push({ candidate, reason: "primary-budget-deferred-refinement" });
        continue;
      }

      const allRequiredChildrenReady = requiredChildren.every((child) => stateOf(child.tileId) === "render-ready");

      if (allRequiredChildrenReady) {
        activeFrontierSize += netFrontierGrowth;
        reasons.push(reason(candidate.tileId, "parent-hidden-complete-child-coverage"));
        queue.push(...requiredChildren);
      } else {
        fallbackCandidates.push(candidate);
        reasons.push(reason(candidate.tileId, "fallback-incomplete-child-coverage"));
        for (const child of requiredChildren) {
          const state = stateOf(child.tileId);
          if (state === "render-ready") {
            reasons.push(reason(child.tileId, "ready-child-hidden-incomplete-coverage"));
          } else {
            requestCandidates.push({ candidate: child, state });
          }
        }
      }
      continue;
    }

    primaryCandidates.push({
      candidate,
      reason: candidate.shouldSplit ? "primary-max-level" : "primary-at-or-below-split-threshold"
    });
  }

  primaryCandidates.sort((left, right) =>
    comparePlanetTileSelectionPriority(left.candidate, right.candidate)
  );
  for (const entry of primaryCandidates) reasons.push(reason(entry.candidate.tileId, entry.reason));

  const optionalRequests = requestCandidates
    .map((entry) => ({
      entry,
      request: loadRequest(entry.candidate, readinessReason(entry.state), false)
    }))
    .sort((left, right) => comparePlanetTileLoadRequests(left.request, right.request));
  const requestedOptional = optionalRequests.slice(0, input.maxRequestedChildren);
  const requestBudgetOverflow = optionalRequests.slice(input.maxRequestedChildren);
  for (const { entry, request } of requestedOptional) {
    reasons.push(reason(entry.candidate.tileId, request.reason));
  }
  for (const { entry, request } of requestBudgetOverflow) {
    reasons.push(reason(entry.candidate.tileId, request.reason));
    reasons.push(reason(entry.candidate.tileId, "request-budget-exhausted"));
  }

  const desiredCandidates = [
    ...primaryCandidates.map((entry) => entry.candidate),
    ...fallbackCandidates
  ];
  const mandatoryRequests = desiredCandidates.flatMap((candidate): readonly PlanetTileLoadRequest[] => {
    const state = stateOf(candidate.tileId);
    if (state === "render-ready") return [];
    const requestReason = candidate.key.level === 0
      ? "root-coverage-required"
      : readinessReason(state);
    reasons.push(reason(candidate.tileId, requestReason));
    return [loadRequest(candidate, requestReason, true)];
  });
  const coverageStatus = desiredCandidates.every((candidate) => stateOf(candidate.tileId) === "render-ready")
    ? "READY"
    : "NOT_READY";

  const plan = createPlanetTileVisibilityPlan({
    selectionRevision: input.selectionRevision,
    readinessRevision: readiness.revision,
    primary: primaryCandidates.map((entry) => entry.candidate.tileId),
    fallback: fallbackCandidates.map((entry) => entry.tileId),
    culled: culledCandidates.map((entry) => entry.tileId),
    loadRequests: [
      ...mandatoryRequests,
      ...requestedOptional.map(({ request }) => request)
    ],
    reasons,
    coverageStatus
  });
  return Object.freeze({ status: "accepted", plan });
};
