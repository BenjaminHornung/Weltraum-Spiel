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
import type {
  PlanetTileLoadRequest,
  PlanetTileLoadRequestReasonCode,
  PlanetTileVisibilityPlan
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

export interface PlanetPresentationAdapterResult {
  readonly visibilityPlan: VisibilityPlan;
  readonly loadJobs: readonly PlanetPresentationLoadJob[];
}

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

export const adaptPlanetPresentation = (
  input: PlanetPresentationAdapterInput
): PlanetPresentationAdapterResult => {
  const acceptedReadiness = input.readiness.revision === input.corePlan.readinessRevision;
  const renderReady = acceptedReadiness
    ? new Set(input.readiness.entries
        .filter((entry) => entry.state === "render-ready")
        .map((entry) => entry.tileId))
    : new Set<PlanetTileId>();
  const desiredCoverage = [...input.corePlan.primary, ...input.corePlan.fallback];
  const visibleRepresentationKeys = desiredCoverage
    .filter((tileId) => renderReady.has(tileId))
    .map(planetTileRepresentationKey);

  const visibilityPlan = createVisibilityPlan({
    planRevision: visibilityPlanRevision(input.corePlan.selectionRevision),
    visibleRepresentationKeys,
    fallbackRepresentationKeys: [],
    hiddenRepresentationKeys: []
  });
  const loadJobs = Object.freeze(input.corePlan.loadRequests.map(loadJob));
  return Object.freeze({ visibilityPlan, loadJobs });
};
