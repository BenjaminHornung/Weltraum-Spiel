export const MICROVOXEL_BASE_QUANTUM_METERS = 0.125 as const;
export const ADAPTIVE_BRICK_CELLS_PER_AXIS = 16 as const;
export const ADAPTIVE_BRICK_CELL_COUNT = 4_096 as const;
export const ADAPTIVE_LEVELS = Object.freeze([0, 1, 2, 3, 4] as const);
export const ADAPTIVE_KEY_SCHEMA_VERSION = "adaptive-microvoxel-key-v1" as const;
export const ADAPTIVE_EDIT_SCHEMA_VERSION = "adaptive-microvoxel-edit-v1" as const;
export const ADAPTIVE_JOURNAL_SCHEMA_VERSION = "adaptive-microvoxel-journal-v1" as const;
export const ADAPTIVE_BRICK_SCHEMA_VERSION = "adaptive-microvoxel-brick-v1" as const;
export const ADAPTIVE_MATERIALIZATION_VERSION = "adaptive-microvoxel-materialization-v1" as const;
export const ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION = "adaptive-microvoxel-base-field-descriptor-digest-v1" as const;
export const ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION = "adaptive-microvoxel-snapshot-projection-v1" as const;
export const ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION = "adaptive-microvoxel-resident-validation-proof-v1" as const;
export const ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION = "adaptive-microvoxel-resident-validation-proof-issuer-v1" as const;
export const ADAPTIVE_PLAN_SCHEMA_VERSION = "adaptive-microvoxel-plan-v1" as const;
export const ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION = "hestia-unified-adaptive-authority-v1" as const;
export const ADAPTIVE_AUTHORITY_SNAPSHOT_SCHEMA_VERSION = "hestia-unified-adaptive-authority-snapshot-v1" as const;
export const ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION = "hestia-unified-adaptive-authority-commitment-v1" as const;
export const ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION = "hestia-unified-adaptive-brick-derivation-v1" as const;
export const ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION = "hestia-unified-surface-material-table-v1" as const;

declare const brand: unique symbol;
export type AdaptiveLevel = (0 | 1 | 2 | 3 | 4) & { readonly [brand]: "AdaptiveLevel" };
export type GlobalQuantumCoordinate = number & { readonly [brand]: "GlobalQuantumCoordinate" };
export type AuthorityRevision = number & { readonly [brand]: "AuthorityRevision" };
export type EditSequence = number & { readonly [brand]: "EditSequence" };
export type StableAuthorityId = string & { readonly [brand]: "StableAuthorityId" };
export type AdaptiveRegionId = StableAuthorityId;
export type AdaptiveRefinementLevel = AdaptiveLevel;
export type AdaptiveBrickRevision = AuthorityRevision;
export type AdaptivePlanningEpoch = AuthorityRevision;
export type AdaptiveEditId = StableAuthorityId;
export type AdaptiveEditRevision = AuthorityRevision;
export type AdaptiveBrickResidencyState = "ready" | "stale" | "invalid" | "incomplete" | "cancelled";

export interface QuantumPoint {
  readonly x: GlobalQuantumCoordinate;
  readonly y: GlobalQuantumCoordinate;
  readonly z: GlobalQuantumCoordinate;
}

export type AdaptiveBrickCoordinate = QuantumPoint;

export interface QuantumBounds {
  readonly min: QuantumPoint;
  readonly max: QuantumPoint;
}

export interface MeterPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MeterBounds {
  readonly min: MeterPoint;
  readonly max: MeterPoint;
}

export interface AdaptiveBrickKey {
  readonly schemaVersion: typeof ADAPTIVE_KEY_SCHEMA_VERSION;
  readonly bodyId: StableAuthorityId;
  readonly surfaceFrameId: StableAuthorityId;
  readonly regionId: AdaptiveRegionId;
  readonly generatorVersion: StableAuthorityId;
  readonly level: AdaptiveRefinementLevel;
  readonly originQuantum: AdaptiveBrickCoordinate;
}

export type AdaptiveEditOperation =
  | "SubtractSphere"
  | "AddSphere"
  | "SubtractBox"
  | "AddBox"
  | "SetMaterialBox";

export interface QuantumSphere {
  readonly center: QuantumPoint;
  readonly radiusQuantum: GlobalQuantumCoordinate;
}

export interface AdaptiveEditRecord {
  readonly schemaVersion: typeof ADAPTIVE_EDIT_SCHEMA_VERSION;
  readonly editId: StableAuthorityId;
  readonly sequence: EditSequence;
  readonly expectedRegionRevision: AuthorityRevision;
  readonly resultRegionRevision: AuthorityRevision;
  readonly actorId: StableAuthorityId;
  readonly sourceId: StableAuthorityId;
  readonly operation: AdaptiveEditOperation;
  readonly sphere?: QuantumSphere;
  readonly box?: QuantumBounds;
  readonly materialId?: StableAuthorityId;
  readonly semanticId?: StableAuthorityId;
}

export interface AdaptiveEditJournal {
  readonly schemaVersion: typeof ADAPTIVE_JOURNAL_SCHEMA_VERSION;
  readonly initialRegionRevision: AuthorityRevision;
  readonly revision: AuthorityRevision;
  readonly records: readonly AdaptiveEditRecord[];
  readonly digest: string;
}

export interface AdaptiveBaseFieldSample {
  readonly density: number;
  readonly occupancy: number;
  readonly materialId: StableAuthorityId | null;
  readonly semanticId?: StableAuthorityId | null;
}

export interface AdaptiveConstantBaseFieldDescriptor {
  readonly kind: "constant-v1";
  readonly identity: StableAuthorityId;
  readonly version: StableAuthorityId;
  readonly sourceRevision: AuthorityRevision;
  readonly sample: AdaptiveBaseFieldSample;
}

export type AdaptiveBaseFieldDescriptor = AdaptiveConstantBaseFieldDescriptor;

export interface AdaptiveBrickProvenance {
  readonly schemaVersion: "adaptive-microvoxel-provenance-v1";
  readonly baseFieldIdentity: StableAuthorityId;
  readonly baseFieldVersion: StableAuthorityId;
  readonly baseFieldDescriptorDigest: string;
  readonly sourceRevision: AuthorityRevision;
  readonly editRevision: AuthorityRevision;
  readonly journalDigest: string;
  readonly hierarchyKeyHash: string;
  readonly materializationVersion: typeof ADAPTIVE_MATERIALIZATION_VERSION;
  readonly parentProvenanceHash: string | null;
  readonly provenanceHash: string;
}

export interface MaterializedAdaptiveBrick {
  readonly schemaVersion: typeof ADAPTIVE_BRICK_SCHEMA_VERSION;
  readonly materializationVersion: typeof ADAPTIVE_MATERIALIZATION_VERSION;
  readonly key: AdaptiveBrickKey;
  readonly originQuantum: QuantumPoint;
  readonly level: AdaptiveLevel;
  readonly cellSizeQuantum: number;
  readonly cellSizeMeters: number;
  readonly cellCount: typeof ADAPTIVE_BRICK_CELL_COUNT;
  readonly density: readonly number[];
  readonly occupancy: readonly number[];
  readonly material: readonly (StableAuthorityId | null)[];
  readonly semantic: readonly (StableAuthorityId | null)[];
  readonly baseFieldDescriptorDigest: string;
  readonly sourceRevision: AuthorityRevision;
  readonly editRevision: AuthorityRevision;
  readonly contentHash: string;
  readonly provenance: AdaptiveBrickProvenance;
}

export interface AdaptiveAuthorityProtocol {
  readonly schemaVersion: typeof ADAPTIVE_AUTHORITY_PROTOCOL_SCHEMA_VERSION;
  readonly derivationAlgorithmVersion: typeof ADAPTIVE_AUTHORITY_DERIVATION_ALGORITHM_VERSION;
  readonly materialTableVersion: typeof ADAPTIVE_AUTHORITY_MATERIAL_TABLE_VERSION;
}

export interface AdaptiveAuthoritySnapshotBrick {
  readonly role: StableAuthorityId;
  readonly brick: MaterializedAdaptiveBrick;
}

export interface AdaptiveAuthoritySnapshotPayload {
  readonly schemaVersion: typeof ADAPTIVE_AUTHORITY_SNAPSHOT_SCHEMA_VERSION;
  readonly protocol: AdaptiveAuthorityProtocol;
  readonly authorityId: StableAuthorityId;
  readonly revision: AuthorityRevision;
  readonly bricks: readonly AdaptiveAuthoritySnapshotBrick[];
  readonly orderedInputs: readonly AdaptiveEditRecord[];
}

export interface AdaptiveAuthoritySnapshot extends AdaptiveAuthoritySnapshotPayload {
  readonly contentHash: string;
}

export interface AdaptiveAuthoritySnapshotInput {
  readonly authorityId: string;
  readonly revision: number;
  readonly bricks: readonly {
    readonly role: string;
    readonly brick: MaterializedAdaptiveBrick;
  }[];
  readonly orderedInputs: readonly AdaptiveEditRecord[];
}

export interface AdaptiveAuthorityAdoptionCommitmentPayload {
  readonly schemaVersion: typeof ADAPTIVE_AUTHORITY_COMMITMENT_SCHEMA_VERSION;
  readonly protocol: AdaptiveAuthorityProtocol;
  readonly authorityId: StableAuthorityId;
  readonly predecessorRevision: AuthorityRevision;
  readonly predecessorHash: string;
  readonly candidateRevision: AuthorityRevision;
  readonly candidateHash: string;
}

export interface AdaptiveAuthorityAdoptionCommitment extends AdaptiveAuthorityAdoptionCommitmentPayload {
  readonly commitmentHash: string;
}

export interface AdaptiveAuthorityAdoptionCommitmentInput {
  readonly predecessorSnapshot: AdaptiveAuthoritySnapshot;
  readonly candidateSnapshot: AdaptiveAuthoritySnapshot;
}

export interface AdaptivePlannerBudgets {
  readonly maxBricks: number;
  readonly maxBytes: number;
  readonly maxWork: number;
  readonly maxCoverageQuantum: number;
}

export type AdaptiveRefinementReason =
  | "Inspection"
  | "PlayerProximity"
  | "CollisionRequired"
  | "ToolInteraction"
  | "Explosion"
  | "ProjectileImpact"
  | "MeteorImpact"
  | "StructuralFracture";

export interface AdaptiveAabbRefinementRegion {
  readonly kind: "aabb";
  readonly bounds: QuantumBounds;
}

export interface AdaptiveSphereRefinementRegion {
  readonly kind: "sphere";
  readonly center: QuantumPoint;
  readonly radiusQuantum: GlobalQuantumCoordinate;
}

export type AdaptiveRefinementRegion = AdaptiveAabbRefinementRegion | AdaptiveSphereRefinementRegion;

export interface AdaptiveRefinementRequest {
  readonly requestId: StableAuthorityId;
  readonly region: AdaptiveRefinementRegion;
  readonly targetLevel: AdaptiveRefinementLevel;
  readonly reason: AdaptiveRefinementReason;
  readonly requiredForCoverage: boolean;
  readonly deadlinePlanningEpoch?: AdaptivePlanningEpoch;
  readonly priority: number;
}

export type AdaptivePlanRequest = AdaptiveRefinementRequest;

export type AdaptiveReadiness = AdaptiveBrickResidencyState;

declare const residentValidationProofBrand: unique symbol;

export interface AdaptiveResidentValidationProof {
  readonly [residentValidationProofBrand]: true;
  readonly schemaVersion: typeof ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION;
  readonly proofVersion: typeof ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION;
  readonly key: AdaptiveBrickKey;
  readonly contentHash: string;
  readonly provenanceHash: string;
  readonly baseFieldDescriptorDigest: string;
  readonly journalDigest: string;
  readonly sourceRevision: AuthorityRevision;
  readonly editRevision: AdaptiveEditRevision;
  readonly brickRevision: AdaptiveBrickRevision;
  readonly planningEpoch: AdaptivePlanningEpoch;
  readonly snapshotProjectionDigest: string;
  readonly proofDigest: string;
}

export interface AdaptivePlannerAuthorityContext {
  readonly schemaVersion: "adaptive-microvoxel-planner-authority-v1";
  readonly baseField: AdaptiveBaseFieldDescriptor;
  readonly editJournal: AdaptiveEditJournal;
  readonly brickRevision: AdaptiveBrickRevision;
}

export interface AdaptiveResidentBrick {
  readonly key: AdaptiveBrickKey;
  readonly readiness: AdaptiveReadiness;
  readonly byteSize: number;
  readonly work: number;
  readonly contentHash: string;
  readonly provenanceHash: string;
  readonly baseFieldDescriptorDigest: string;
  readonly journalDigest: string;
  readonly sourceRevision: AuthorityRevision;
  readonly editRevision: AdaptiveEditRevision;
  readonly brickRevision: AdaptiveBrickRevision;
  readonly validationProof?: AdaptiveResidentValidationProof;
}

export interface AdaptivePlannerSnapshot {
  readonly schemaVersion: "adaptive-microvoxel-planner-snapshot-v1";
  readonly bodyId: StableAuthorityId;
  readonly surfaceFrameId: StableAuthorityId;
  readonly regionId: AdaptiveRegionId;
  readonly generatorVersion: StableAuthorityId;
  readonly authority: AdaptivePlannerAuthorityContext;
  readonly planningEpoch: AdaptivePlanningEpoch;
  readonly resident: readonly AdaptiveResidentBrick[];
  readonly activeCoverage: readonly AdaptiveCoverage[];
  readonly refinementRequests: readonly AdaptiveRefinementRequest[];
  readonly budgets: AdaptivePlannerBudgets;
}

export interface AdaptiveCoverage {
  readonly bounds: QuantumBounds;
  readonly key: AdaptiveBrickKey;
  readonly kind: "selected" | "fallback";
}

export interface AdaptiveFallback {
  readonly ancestor: AdaptiveBrickKey;
  readonly requiredChildren: readonly AdaptiveBrickKey[];
  readonly coverage: QuantumBounds;
}

export interface AdaptivePlan {
  readonly schemaVersion: typeof ADAPTIVE_PLAN_SCHEMA_VERSION;
  readonly status: "accepted";
  readonly desired: readonly AdaptiveBrickKey[];
  readonly keep: readonly AdaptiveBrickKey[];
  readonly materialize: readonly AdaptiveBrickKey[];
  readonly evict: readonly AdaptiveBrickKey[];
  readonly fallback: readonly AdaptiveFallback[];
  readonly coverage: readonly AdaptiveCoverage[];
  readonly reasons: readonly string[];
  readonly desiredKeys: readonly AdaptiveBrickKey[];
  readonly keepKeys: readonly AdaptiveBrickKey[];
  readonly materializeRequests: readonly AdaptiveBrickKey[];
  readonly evictCandidates: readonly AdaptiveBrickKey[];
  readonly parentFallbackKeys: readonly AdaptiveBrickKey[];
  readonly coverageStatus: Readonly<{
    readonly coverage: readonly AdaptiveCoverage[];
    readonly complete: boolean;
    readonly uncoveredRequiredKeyCount: number;
  }>;
  readonly deterministicReasons: readonly string[];
  readonly snapshotProjectionDigest: string;
  readonly planHash: string;
}

export type AdaptiveBudgetKind = "brick-count" | "bytes" | "work" | "coverage";

export interface AdaptivePlanRejection {
  readonly schemaVersion: typeof ADAPTIVE_PLAN_SCHEMA_VERSION;
  readonly status: "rejected";
  readonly code: "BudgetExceeded";
  readonly budget: AdaptiveBudgetKind;
  readonly required: number;
  readonly limit: number;
  readonly desired: readonly [];
  readonly keep: readonly [];
  readonly materialize: readonly [];
  readonly evict: readonly [];
  readonly fallback: readonly [];
  readonly coverage: readonly [];
  readonly reasons: readonly string[];
  readonly desiredKeys: readonly [];
  readonly keepKeys: readonly [];
  readonly materializeRequests: readonly [];
  readonly evictCandidates: readonly [];
  readonly parentFallbackKeys: readonly [];
  readonly coverageStatus: Readonly<{
    readonly coverage: readonly [];
    readonly complete: false;
    readonly uncoveredRequiredKeyCount: 0;
  }>;
  readonly deterministicReasons: readonly string[];
  readonly snapshotProjectionDigest: string;
  readonly planHash: string;
}

export type AdaptivePlanResult = AdaptivePlan | AdaptivePlanRejection;
