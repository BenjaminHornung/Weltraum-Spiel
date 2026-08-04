import type {
  AdaptiveLevel,
  AdaptiveRefinementReason,
  AdaptiveRefinementRequest,
  QuantumPoint
} from "../adaptive";

export const REPRESENTATION_LADDER_SCHEMA_VERSION = "voxel-representation-ladder-v2" as const;
export const OBJECT_PROXY_SCHEMA_VERSION = "voxel-object-proxy-v2" as const;
export const SURFACE_PROXY_SCHEMA_VERSION = "voxel-surface-proxy-v2" as const;
export const REPRESENTATION_DECISION_SCHEMA_VERSION = "voxel-representation-decision-v2" as const;

export const REPRESENTATION_MAX_BANDS = 32 as const;
export const REPRESENTATION_MAX_SELECTION_CANDIDATES = 256 as const;
export const REPRESENTATION_MAX_ACTIVE_PINS = 64 as const;
export const REPRESENTATION_MAX_SOURCE_BINDINGS_PER_BAND = 16 as const;
export const REPRESENTATION_MAX_READINESS_REQUIREMENTS_PER_BAND = 16 as const;
export const REPRESENTATION_MAX_DOMAINS_PER_BAND = 8 as const;
export const REPRESENTATION_MAX_FALLBACK_GROUPS = 256 as const;
export const REPRESENTATION_MAX_FALLBACK_CHILDREN = 4_096 as const;
export const REPRESENTATION_MAX_ESTIMATED_BYTES = 1_099_511_627_776 as const;
export const REPRESENTATION_MAX_WORK_UNITS = 1_000_000_000 as const;
export const REPRESENTATION_MAX_UPLOAD_UNITS = 1_000_000_000 as const;

export type RepresentationProductKind =
  | "AdaptiveMicrovoxel"
  | "VoxelRenderProxy"
  | "DamageAwareObjectProxy"
  | "SurfaceRegionProxy"
  | "SurfaceTileProxy"
  | "CelestialProxy"
  | "StructuralMesh"
  ;

export type RepresentationSourceBindingKind = "AdaptiveAuthority" | "StructuralAuthority" | "EditJournal";
export type RepresentationReadinessRequirement = "SourceCurrent" | "ProductComplete" | "CoverageComplete";
export type RepresentationDomain = "Render" | "Simulation" | "Fallback";

export interface RepresentationMeterPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RepresentationMeterBounds {
  readonly min: RepresentationMeterPoint;
  readonly max: RepresentationMeterPoint;
}

export interface RepresentationCosts {
  readonly estimatedBytes: number;
  readonly workUnits: number;
  readonly uploadUnits: number;
}

export interface RepresentationBand {
  readonly bandId: string;
  readonly rank: number;
  readonly productKind: RepresentationProductKind;
  readonly algorithmVersion: string;
  readonly productVersion: string;
  readonly geometricErrorMeters: number;
  readonly coverageBoundsMeters: RepresentationMeterBounds;
  readonly sourceBindingKinds: readonly RepresentationSourceBindingKind[];
  readonly readinessRequirements: readonly RepresentationReadinessRequirement[];
  readonly allowedDomains: readonly RepresentationDomain[];
  readonly visualAdaptiveLevel: AdaptiveLevel | null;
  readonly costs: RepresentationCosts;
}

export interface RepresentationLadderDescriptor {
  readonly schemaVersion: typeof REPRESENTATION_LADDER_SCHEMA_VERSION;
  readonly descriptorId: string;
  readonly bands: readonly RepresentationBand[];
  readonly descriptorHash: string;
}

export interface ObjectProxyIdentity {
  readonly schemaVersion: typeof OBJECT_PROXY_SCHEMA_VERSION;
  readonly objectId: string;
  readonly objectRevision: number;
  readonly structuralContentHash: string;
  readonly damageDigest: string;
  readonly bandId: string;
  readonly proxyAlgorithmVersion: string;
  readonly proxyContentHash: string;
}

export interface SurfaceProxyIdentity {
  readonly schemaVersion: typeof SURFACE_PROXY_SCHEMA_VERSION;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly locationKind: "Region" | "Tile";
  readonly locationId: string;
  readonly generatorVersion: string;
  readonly sourceRevision: number;
  readonly editRevision: number;
  readonly sourceContentHash: string;
  readonly bandId: string;
  readonly proxyAlgorithmVersion: string;
  readonly proxyContentHash: string;
}

export type ProxyCurrentSourceResult =
  | Readonly<{ status: "Ready" }>
  | Readonly<{
      status: "Rejected";
       code:
         | "ProxyContentHashMismatch"
         | "ObjectIdMismatch"
         | "StaleObjectRevision"
         | "StructuralContentHashMismatch"
         | "DamageDigestMismatch"
         | "BodyIdMismatch"
         | "SurfaceFrameIdMismatch"
         | "LocationKindMismatch"
         | "LocationIdMismatch"
         | "GeneratorVersionMismatch"
         | "StaleSourceRevision"
         | "StaleEditRevision"
         | "SourceContentHashMismatch"
         | "BandIdMismatch"
         | "ProxyAlgorithmVersionMismatch";
    }>;

export interface VoxelQualityPolicy {
  readonly schemaVersion: "voxel-quality-policy-v2";
  readonly detail: "Low" | "Medium" | "High" | "Ultra";
  readonly maximumVisualAdaptiveLevel: AdaptiveLevel;
  readonly detailDistanceMeters: number;
  readonly streamingBudget: "Low" | "Medium" | "High" | "Ultra";
  readonly maximumEstimatedBytes: number;
  readonly maximumWorkUnits: number;
  readonly maximumUploadUnits: number;
}

export interface ScreenSpaceErrorInput {
  readonly cameraPosition: RepresentationMeterPoint;
  readonly boundsCenter: RepresentationMeterPoint;
  readonly boundsRadiusMeters: number;
  readonly geometricErrorMeters: number;
  readonly viewportHeightPixels: number;
  readonly verticalFovRadians: number;
  readonly minimumDistanceMeters: number;
}

export interface ScreenSpaceErrorResult {
  readonly focalLengthPixels: number;
  readonly centerDistanceMeters: number;
  readonly distanceToBoundsMeters: number;
  readonly projectedErrorPixels: number;
  readonly projectedBoundsRadiusPixels: number;
}

export type RepresentationCandidateReadiness = "Ready" | "Loading" | "Stale" | "Invalid" | "Incomplete" | "Cancelled";

export interface RepresentationCandidate {
  readonly bandId: string;
  readonly readiness: RepresentationCandidateReadiness;
  readonly sourceCurrent: boolean;
}

export interface RepresentationSelectionThresholds {
  readonly refineErrorPixels: number;
  readonly collapseErrorPixels: number;
  readonly cullDistanceMeters: number;
  readonly cullProjectedBoundsRadiusPixels: number;
}

export interface RepresentationSelectionInput {
  readonly descriptor: RepresentationLadderDescriptor;
  readonly candidates: readonly RepresentationCandidate[];
  readonly projection: Omit<ScreenSpaceErrorInput, "geometricErrorMeters">;
  readonly qualityPolicy: VoxelQualityPolicy;
  readonly thresholds: RepresentationSelectionThresholds;
  readonly priorBandId: string | null;
  readonly simulationRequirements: readonly string[];
  readonly requiredAuthorityRequests: readonly AdaptiveRefinementRequest[];
  readonly fallbackGroup: AtomicFallbackGroup | null;
  readonly readiness: readonly string[];
  readonly evictionEligibility: EvictionEligibility;
}

export interface RepresentationSelectionAccepted {
  readonly schemaVersion: typeof REPRESENTATION_DECISION_SCHEMA_VERSION;
  readonly status: "Accepted";
  readonly renderSelection: Readonly<{ kind: "Band"; bandId: string }> | Readonly<{ kind: "Culled" }>;
  readonly simulationRequirements: readonly string[];
  readonly requiredAuthorityRequests: readonly AdaptiveRefinementRequest[];
  readonly fallbackDecision: AtomicFallbackDecision | null;
  readonly readiness: readonly string[];
  readonly evictionEligibility: EvictionEligibility;
  readonly decisionReasons: readonly string[];
  readonly decisionHash: string;
}

export interface RepresentationSelectionRejected {
  readonly schemaVersion: typeof REPRESENTATION_DECISION_SCHEMA_VERSION;
  readonly status: "Rejected";
  readonly code: "NoReadyCandidate" | "BudgetExceeded";
  readonly renderSelection: null;
  readonly simulationRequirements: readonly [];
  readonly requiredAuthorityRequests: readonly [];
  readonly fallbackDecision: null;
  readonly readiness: readonly [];
  readonly evictionEligibility: null;
  readonly decisionReasons: readonly string[];
  readonly decisionHash: string;
}

export type RepresentationSelectionResult = RepresentationSelectionAccepted | RepresentationSelectionRejected;

export const HARD_ADAPTIVE_REFINEMENT_REASONS = Object.freeze([
  "CollisionRequired",
  "ToolInteraction",
  "Explosion",
  "ProjectileImpact",
  "MeteorImpact",
  "StructuralFracture"
] as const satisfies readonly AdaptiveRefinementReason[]);

export type HardAdaptiveRefinementReason = (typeof HARD_ADAPTIVE_REFINEMENT_REASONS)[number];
export type RepresentationLifecyclePinReason =
  | "ActiveRigidBody"
  | "UnsettledFragment"
  | "StructuralSolvePending"
  | "PhysicsHandoffPending";

export type StructuralLifecycleState = "Dirty" | "Solving" | "Settled";

export interface EvictionEligibility {
  readonly derivedProductsEvictable: boolean;
  readonly retainedSourceBindings: readonly ["AdaptiveAuthority", "EditJournal", "StructuralAuthority"];
  readonly reasons: readonly string[];
}

export type ProxyInteractionResult =
  | Readonly<{
      status: "READY";
      authorityCoordinates: QuantumPoint;
      authorityRequest: AdaptiveRefinementRequest;
    }>
  | Readonly<{
      status: "NOT_READY" | "Blocked";
      authorityCoordinates: null;
      authorityRequest: AdaptiveRefinementRequest | null;
      code: "AuthorityCoordinatesMissing" | "Level4CoverageMissing" | "AuthorityBudgetExceeded";
    }>;

export interface AtomicFallbackChild {
  readonly childId: string;
  readonly revision: number;
  readonly readiness: "Ready" | "Stale" | "Invalid" | "Cancelled" | "Incomplete";
}

export interface AtomicFallbackParent {
  readonly parentId: string;
  readonly revision: number;
  readonly readiness: "Ready" | "Stale" | "Invalid" | "Cancelled" | "Incomplete";
}

export interface AtomicFallbackGroup {
  readonly groupId: string;
  readonly parent: AtomicFallbackParent | null;
  readonly revision: number;
  readonly requiredChildIds: readonly string[];
  readonly children: readonly AtomicFallbackChild[];
}

export type AtomicFallbackDecision =
  | Readonly<{ groupId: string; settledCoverage: "Parent"; parentId: string; childIds: readonly []; reason: string }>
  | Readonly<{ groupId: string; settledCoverage: "Children"; parentId: null; childIds: readonly string[]; reason: string }>;
