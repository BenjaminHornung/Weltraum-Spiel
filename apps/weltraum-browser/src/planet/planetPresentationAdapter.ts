import {
  artifactRevision,
  canonicalSignature,
  createMeshArtifact,
  createVisibilityPlan,
  representationKey,
  sourceRevision,
  visibilityPlanRevision,
  type ArtifactRevision,
  type FrameId,
  type MaterialProfileId,
  type MeshArtifact,
  type RepresentationKey,
  type SourceRevision,
  type VisibilityPlan
} from "../presentation";
import { parsePlanetTileId, planetTileId } from "./ids";
import type { PlanetShellMesh } from "./shellMeshGenerator";
import type { PlanetTileReadinessSnapshot } from "./tileReadiness";
import {
  comparePlanetTileIds,
  type PlanetTileLoadRequest,
  type PlanetTileLoadRequestReasonCode,
  type PlanetTileVisibilityPlan
} from "./tileVisibilityPlan";
import type { PlanetTileId, PlanetTileKey } from "./types";
import type { PlanetTileSelectionPriority } from "./tileSelector";

export {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMaterialProfile,
  frameId,
  frameRevision,
  materialProfileId,
  sourceRevision
} from "../presentation";

const CONTENT_HASH_PREFIX_LENGTH = "fnv1a64:".length;

export interface PlanetShellMeshArtifactInput {
  readonly mesh: PlanetShellMesh;
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
  readonly frameId: FrameId;
  readonly materialProfileId: MaterialProfileId;
}

export interface PlanetPresentationLoadJob {
  readonly tileId: PlanetTileId;
  readonly tileKey: PlanetTileKey;
  readonly reason: PlanetTileLoadRequestReasonCode;
  readonly priority: PlanetTileSelectionPriority;
  readonly requiredForCoverage: boolean;
  readonly expectedReadinessRevision: number;
}

export interface PlanetPresentationAdapterInput {
  readonly corePlan: PlanetTileVisibilityPlan;
  readonly readiness: PlanetTileReadinessSnapshot;
}

export const PLANET_PRESENTATION_HOLD_REASON_CODES = Object.freeze([
  "readiness-revision-mismatch",
  "coverage-not-ready",
  "active-tile-not-render-ready"
] as const);

export type PlanetPresentationHoldReasonCode =
  (typeof PLANET_PRESENTATION_HOLD_REASON_CODES)[number];

export interface PlanetPresentationPublishResult {
  readonly status: "publish";
  readonly visibilityPlan: VisibilityPlan;
  readonly loadJobs: readonly PlanetPresentationLoadJob[];
}

export interface PlanetPresentationHoldResult {
  readonly status: "hold-last-complete-plan";
  readonly reasonCode: PlanetPresentationHoldReasonCode;
  readonly missingActiveTileKeys: readonly PlanetTileId[];
  readonly loadJobs: readonly PlanetPresentationLoadJob[];
}

export type PlanetPresentationAdapterResult =
  | PlanetPresentationPublishResult
  | PlanetPresentationHoldResult;

export const planetTileRepresentationKey = (tileId: PlanetTileId): RepresentationKey => {
  parsePlanetTileId(tileId);
  const stableTileHash = canonicalSignature({ version: 1, tileId });
  return representationKey(`planet_tile:${stableTileHash.slice(CONTENT_HASH_PREFIX_LENGTH)}`);
};

export const createPlanetShellMeshArtifact = (input: PlanetShellMeshArtifactInput): MeshArtifact =>
  createMeshArtifact({
    representationKey: planetTileRepresentationKey(input.mesh.tileId),
    sourceRevision: sourceRevision(input.sourceRevision),
    artifactRevision: artifactRevision(input.artifactRevision),
    algorithmVersion: input.mesh.algorithmVersion,
    frameId: input.frameId,
    positions: input.mesh.positionsRelative,
    normals: input.mesh.normals,
    indices: input.mesh.indices,
    attributes: { uv: input.mesh.uv },
    materialRanges: [{
      materialProfileId: input.materialProfileId,
      startIndex: 0,
      indexCount: input.mesh.indices.length
    }],
    bounds: input.mesh.boundsRelative
  });

const loadJob = (request: PlanetTileLoadRequest): PlanetPresentationLoadJob => Object.freeze({
  tileId: planetTileId(request.tileKey),
  tileKey: Object.freeze({ ...request.tileKey }),
  reason: request.reason,
  priority: Object.freeze({ ...request.priority }),
  requiredForCoverage: request.requiredForCoverage,
  expectedReadinessRevision: request.expectedReadinessRevision
});

const canonicalActiveTileKeys = (plan: PlanetTileVisibilityPlan): readonly PlanetTileId[] =>
  Object.freeze([...new Set([...plan.primary, ...plan.fallback])].sort(comparePlanetTileIds));

const holdLastCompletePlan = (
  reasonCode: PlanetPresentationHoldReasonCode,
  missingActiveTileKeys: readonly PlanetTileId[],
  loadJobs: readonly PlanetPresentationLoadJob[]
): PlanetPresentationHoldResult => Object.freeze({
  status: "hold-last-complete-plan",
  reasonCode,
  missingActiveTileKeys,
  loadJobs
});

export const adaptPlanetPresentation = (
  input: PlanetPresentationAdapterInput
): PlanetPresentationAdapterResult => {
  const activeTileKeys = canonicalActiveTileKeys(input.corePlan);
  const loadJobs = Object.freeze(input.corePlan.loadRequests.map(loadJob));
  if (input.readiness.revision !== input.corePlan.readinessRevision) {
    return holdLastCompletePlan("readiness-revision-mismatch", activeTileKeys, loadJobs);
  }

  const renderReady = new Set(input.readiness.entries
    .filter((entry) => entry.state === "render-ready")
    .map((entry) => entry.tileId));
  const missingActiveTileKeys = Object.freeze(activeTileKeys.filter((tileId) => !renderReady.has(tileId)));
  if (input.corePlan.coverageStatus === "NOT_READY") {
    return holdLastCompletePlan("coverage-not-ready", missingActiveTileKeys, loadJobs);
  }
  if (missingActiveTileKeys.length > 0) {
    return holdLastCompletePlan("active-tile-not-render-ready", missingActiveTileKeys, loadJobs);
  }

  const visibilityPlan = createVisibilityPlan({
    planRevision: visibilityPlanRevision(input.corePlan.selectionRevision),
    visibleRepresentationKeys: activeTileKeys.map(planetTileRepresentationKey),
    fallbackRepresentationKeys: [],
    hiddenRepresentationKeys: []
  });
  return Object.freeze({ status: "publish", visibilityPlan, loadJobs });
};
