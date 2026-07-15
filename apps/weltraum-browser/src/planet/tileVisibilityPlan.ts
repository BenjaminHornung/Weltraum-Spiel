import { comparePlanetTileKeys } from "./canonical";
import { parsePlanetTileId, planetTileId } from "./ids";
import { createPlanetTileKey } from "./tileAddress";
import { assertPlanetTileReadinessRevision } from "./tileReadiness";
import type { PlanetTileSelectionPriority } from "./tileSelector";
import type { PlanetTileId, PlanetTileKey } from "./types";

export const PLANET_TILE_VISIBILITY_REASON_CODES = Object.freeze([
  "primary-at-or-below-split-threshold",
  "primary-max-level",
  "primary-budget-deferred-refinement",
  "fallback-incomplete-child-coverage",
  "parent-hidden-complete-child-coverage",
  "ready-child-hidden-incomplete-coverage",
  "culled-frustum",
  "culled-horizon",
  "root-coverage-required",
  "requested-child-not-requested",
  "requested-child-queued",
  "requested-child-loading",
  "requested-child-failed",
  "requested-child-evicted",
  "request-budget-exhausted"
] as const);

export const PLANET_TILE_LOAD_REQUEST_REASON_CODES = Object.freeze([
  "root-coverage-required",
  "requested-child-not-requested",
  "requested-child-queued",
  "requested-child-loading",
  "requested-child-failed",
  "requested-child-evicted"
] as const);

export const PLANET_TILE_COVERAGE_STATUSES = Object.freeze(["READY", "NOT_READY"] as const);

export type PlanetTileVisibilityReasonCode = (typeof PLANET_TILE_VISIBILITY_REASON_CODES)[number];
export type PlanetTileLoadRequestReasonCode = (typeof PLANET_TILE_LOAD_REQUEST_REASON_CODES)[number];
export type PlanetTileCoverageStatus = (typeof PLANET_TILE_COVERAGE_STATUSES)[number];

export type PlanetTileVisibilityPlanErrorCode =
  | "INVALID_SELECTION_REVISION"
  | "INVALID_VISIBILITY_PLAN"
  | "INVALID_VISIBILITY_TILE_ID"
  | "OVERLAPPING_VISIBILITY_TILE"
  | "INVALID_VISIBILITY_REASON"
  | "INVALID_LOAD_REQUEST"
  | "INVALID_COVERAGE_STATUS";

export class PlanetTileVisibilityPlanError extends Error {
  public constructor(
    public readonly code: PlanetTileVisibilityPlanErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetTileVisibilityPlanError";
  }
}

export interface PlanetTileLoadRequest {
  readonly tileKey: PlanetTileKey;
  readonly reason: PlanetTileLoadRequestReasonCode;
  readonly priority: PlanetTileSelectionPriority;
  readonly requiredForCoverage: boolean;
  readonly expectedReadinessRevision: number;
}

export interface PlanetTileVisibilityReason {
  readonly tileId: PlanetTileId;
  readonly code: PlanetTileVisibilityReasonCode;
}

export interface PlanetTileVisibilityPlan {
  readonly selectionRevision: number;
  readonly readinessRevision: number;
  readonly primary: readonly PlanetTileId[];
  readonly fallback: readonly PlanetTileId[];
  readonly culled: readonly PlanetTileId[];
  readonly loadRequests: readonly PlanetTileLoadRequest[];
  readonly reasons: readonly PlanetTileVisibilityReason[];
  readonly coverageStatus: PlanetTileCoverageStatus;
}

export const assertPlanetTileSelectionRevision = (revision: number): void => {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new PlanetTileVisibilityPlanError(
      "INVALID_SELECTION_REVISION",
      "Planet tile selection revision must be a non-negative safe integer."
    );
  }
};

export const comparePlanetTileIds = (left: PlanetTileId, right: PlanetTileId): number =>
  comparePlanetTileKeys(parsePlanetTileId(left), parsePlanetTileId(right));

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const compareBooleanDescending = (left: boolean, right: boolean): number =>
  left === right ? 0 : left ? -1 : 1;
const compareNumberAscending = (left: number, right: number): number =>
  left < right ? -1 : left > right ? 1 : 0;
const compareNumberDescending = (left: number, right: number): number =>
  left > right ? -1 : left < right ? 1 : 0;

const isPlanetTileVisibilityReasonCode = (value: unknown): value is PlanetTileVisibilityReasonCode => {
  switch (value) {
    case "primary-at-or-below-split-threshold":
    case "primary-max-level":
    case "primary-budget-deferred-refinement":
    case "fallback-incomplete-child-coverage":
    case "parent-hidden-complete-child-coverage":
    case "ready-child-hidden-incomplete-coverage":
    case "culled-frustum":
    case "culled-horizon":
    case "root-coverage-required":
    case "requested-child-not-requested":
    case "requested-child-queued":
    case "requested-child-loading":
    case "requested-child-failed":
    case "requested-child-evicted":
    case "request-budget-exhausted":
      return true;
    default:
      return false;
  }
};

const isPlanetTileLoadRequestReasonCode = (value: unknown): value is PlanetTileLoadRequestReasonCode => {
  switch (value) {
    case "root-coverage-required":
    case "requested-child-not-requested":
    case "requested-child-queued":
    case "requested-child-loading":
    case "requested-child-failed":
    case "requested-child-evicted":
      return true;
    default:
      return false;
  }
};

const canonicalIds = (values: readonly PlanetTileId[]): readonly PlanetTileId[] => {
  if (!Array.isArray(values)) {
    throw new PlanetTileVisibilityPlanError("INVALID_VISIBILITY_PLAN", "Visibility tile lists must be arrays.");
  }
  const unique = new Set<PlanetTileId>();
  for (const tileId of values) {
    try {
      parsePlanetTileId(tileId);
    } catch {
      throw new PlanetTileVisibilityPlanError(
        "INVALID_VISIBILITY_TILE_ID",
        "Visibility plan contains an invalid planet tile ID."
      );
    }
    unique.add(tileId);
  }
  return Object.freeze([...unique].sort(comparePlanetTileIds));
};

const canonicalReasons = (
  values: readonly PlanetTileVisibilityReason[]
): readonly PlanetTileVisibilityReason[] => {
  if (!Array.isArray(values)) {
    throw new PlanetTileVisibilityPlanError("INVALID_VISIBILITY_PLAN", "Visibility reasons must be an array.");
  }
  const unique = new Map<string, PlanetTileVisibilityReason>();
  for (const reason of values) {
    if (reason === null || typeof reason !== "object") {
      throw new PlanetTileVisibilityPlanError("INVALID_VISIBILITY_REASON", "Visibility reason entries are required.");
    }
    try {
      parsePlanetTileId(reason.tileId);
    } catch {
      throw new PlanetTileVisibilityPlanError(
        "INVALID_VISIBILITY_REASON",
        "Visibility reason contains an invalid planet tile ID."
      );
    }
    if (!isPlanetTileVisibilityReasonCode(reason.code)) {
      throw new PlanetTileVisibilityPlanError(
        "INVALID_VISIBILITY_REASON",
        "Visibility reason contains an invalid reason code."
      );
    }
    unique.set(`${reason.tileId}\u0000${reason.code}`, Object.freeze({ tileId: reason.tileId, code: reason.code }));
  }
  return Object.freeze([...unique.values()].sort((left, right) =>
    comparePlanetTileIds(left.tileId, right.tileId) || compareText(left.code, right.code)
  ));
};

const compareRequestPriority = (
  left: PlanetTileSelectionPriority,
  right: PlanetTileSelectionPriority
): number =>
  compareBooleanDescending(left.coverageObligation, right.coverageObligation) ||
  compareBooleanDescending(left.visible, right.visible) ||
  compareNumberDescending(left.ssePixels, right.ssePixels) ||
  compareNumberAscending(left.distanceToBoundMeters, right.distanceToBoundMeters);

export const comparePlanetTileLoadRequests = (
  left: PlanetTileLoadRequest,
  right: PlanetTileLoadRequest
): number =>
  compareRequestPriority(left.priority, right.priority) ||
  compareText(left.reason, right.reason) ||
  comparePlanetTileIds(planetTileId(left.tileKey), planetTileId(right.tileKey));

const canonicalLoadRequest = (
  request: PlanetTileLoadRequest,
  readinessRevision: number
): PlanetTileLoadRequest => {
  if (request === null || typeof request !== "object") {
    throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Planet tile load request is required.");
  }
  let tileKey: PlanetTileKey;
  try {
    tileKey = createPlanetTileKey(request.tileKey);
  } catch {
    throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Load request contains an invalid tile key.");
  }
  const tileId = planetTileId(tileKey);
  if (!isPlanetTileLoadRequestReasonCode(request.reason)) {
    throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Load request contains an invalid reason.");
  }
  if (request.priority === null || typeof request.priority !== "object") {
    throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Load request priority is required.");
  }
  if (
    typeof request.priority.coverageObligation !== "boolean" ||
    typeof request.priority.visible !== "boolean" ||
    !Number.isFinite(request.priority.ssePixels) ||
    request.priority.ssePixels < 0 ||
    !Number.isFinite(request.priority.distanceToBoundMeters) ||
    request.priority.distanceToBoundMeters < 0 ||
    request.priority.tileId !== tileId
  ) {
    throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Load request priority is invalid or targets another tile.");
  }
  if (
    typeof request.requiredForCoverage !== "boolean" ||
    request.priority.coverageObligation !== request.requiredForCoverage
  ) {
    throw new PlanetTileVisibilityPlanError(
      "INVALID_LOAD_REQUEST",
      "Load request coverage authority must match its structured priority."
    );
  }
  assertPlanetTileReadinessRevision(request.expectedReadinessRevision);
  if (request.expectedReadinessRevision !== readinessRevision) {
    throw new PlanetTileVisibilityPlanError(
      "INVALID_LOAD_REQUEST",
      "Load request expected readiness revision must match the accepted plan revision."
    );
  }
  const priority = Object.freeze({
    coverageObligation: request.priority.coverageObligation,
    visible: request.priority.visible,
    ssePixels: request.priority.ssePixels,
    distanceToBoundMeters: request.priority.distanceToBoundMeters,
    tileId
  });
  return Object.freeze({
    tileKey,
    reason: request.reason,
    priority,
    requiredForCoverage: request.requiredForCoverage,
    expectedReadinessRevision: request.expectedReadinessRevision
  });
};

const canonicalLoadRequests = (
  values: readonly PlanetTileLoadRequest[],
  readinessRevision: number
): readonly PlanetTileLoadRequest[] => {
  if (!Array.isArray(values)) {
    throw new PlanetTileVisibilityPlanError("INVALID_VISIBILITY_PLAN", "Load requests must be an array.");
  }
  const byId = new Map<PlanetTileId, PlanetTileLoadRequest>();
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) {
      throw new PlanetTileVisibilityPlanError("INVALID_LOAD_REQUEST", "Load requests must be dense.");
    }
    const request = canonicalLoadRequest(values[index], readinessRevision);
    const tileId = planetTileId(request.tileKey);
    const previous = byId.get(tileId);
    if (
      previous === undefined ||
      (request.requiredForCoverage && !previous.requiredForCoverage) ||
      (request.requiredForCoverage === previous.requiredForCoverage && comparePlanetTileLoadRequests(request, previous) < 0)
    ) {
      byId.set(tileId, request);
    }
  }
  return Object.freeze([...byId.values()].sort(comparePlanetTileLoadRequests));
};

const isCoverageStatus = (value: unknown): value is PlanetTileCoverageStatus =>
  value === "READY" || value === "NOT_READY";

export const createPlanetTileVisibilityPlan = (
  input: PlanetTileVisibilityPlan
): PlanetTileVisibilityPlan => {
  if (input === null || typeof input !== "object") {
    throw new PlanetTileVisibilityPlanError("INVALID_VISIBILITY_PLAN", "Planet tile visibility plan is required.");
  }
  assertPlanetTileSelectionRevision(input.selectionRevision);
  assertPlanetTileReadinessRevision(input.readinessRevision);
  if (!isCoverageStatus(input.coverageStatus)) {
    throw new PlanetTileVisibilityPlanError("INVALID_COVERAGE_STATUS", "Coverage status must be READY or NOT_READY.");
  }

  const primary = canonicalIds(input.primary);
  const fallback = canonicalIds(input.fallback);
  const culled = canonicalIds(input.culled);
  const loadRequests = canonicalLoadRequests(input.loadRequests, input.readinessRevision);
  const reasons = canonicalReasons(input.reasons);
  const owner = new Map<PlanetTileId, string>();
  for (const [name, ids] of [
    ["primary", primary],
    ["fallback", fallback],
    ["culled", culled]
  ] as const) {
    for (const tileId of ids) {
      const previous = owner.get(tileId);
      if (previous !== undefined) {
        throw new PlanetTileVisibilityPlanError(
          "OVERLAPPING_VISIBILITY_TILE",
          `Planet tile ${tileId} appears in both ${previous} and ${name}.`
        );
      }
      owner.set(tileId, name);
    }
  }

  const explained = new Set(reasons.map((entry) => entry.tileId));
  const explainedIds = new Set<PlanetTileId>([
    ...owner.keys(),
    ...loadRequests.map((request) => planetTileId(request.tileKey))
  ]);
  for (const tileId of explainedIds) {
    if (!explained.has(tileId)) {
      throw new PlanetTileVisibilityPlanError(
        "INVALID_VISIBILITY_REASON",
        `Planet tile ${tileId} has no visibility reason.`
      );
    }
  }

  return Object.freeze({
    selectionRevision: input.selectionRevision,
    readinessRevision: input.readinessRevision,
    primary,
    fallback,
    culled,
    loadRequests,
    reasons,
    coverageStatus: input.coverageStatus
  });
};
