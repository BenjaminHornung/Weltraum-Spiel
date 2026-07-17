import type {
  AdaptiveAuthorityRetention,
  AdaptiveBrickKey,
  AdaptivePlanningEpoch,
  AuthorityRevision,
  GlobalQuantumCoordinate,
  MeterBounds,
  MeterPoint,
  QuantumBounds,
  QuantumPoint,
  StableAuthorityId
} from "../adaptive";

export const STRUCTURAL_OBJECT_SCHEMA_VERSION = "structural-microvoxel-object-v1" as const;
export const STRUCTURAL_BRICK_SCHEMA_VERSION = "structural-microvoxel-brick-v1" as const;
export const STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION = "structural-microvoxel-frame-binding-v1" as const;
export const STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION = "structural-microvoxel-source-binding-v1" as const;
export const STRUCTURAL_COMMAND_SCHEMA_VERSION = "structural-microvoxel-command-v1" as const;
export const STRUCTURAL_RESULT_SCHEMA_VERSION = "structural-microvoxel-result-v1" as const;
export const STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION = "structural-microvoxel-command-evidence-v1" as const;
export const STRUCTURAL_COMPONENT_SCHEMA_VERSION = "structural-microvoxel-component-v1" as const;
export const STRUCTURAL_COMPONENT_ID_VERSION = "structural-microvoxel-component-id-v1" as const;
export const STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION = "structural-microvoxel-mass-properties-v1" as const;
export const STRUCTURAL_MASS_ALGORITHM_VERSION = "structural-microvoxel-mass-v1" as const;
export const STRUCTURAL_MESH_SCHEMA_VERSION = "structural-microvoxel-mesh-v1" as const;
export const STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION = "structural-microvoxel-greedy-mesh-v1" as const;
export const STRUCTURAL_AIR_MATERIAL_ID = 0 as const;

declare const structuralBrand: unique symbol;
export type StructuralObjectId = StableAuthorityId;
export type StructuralPartId = StableAuthorityId;
export type StructuralSemanticKey = string & { readonly [structuralBrand]: "StructuralSemanticKey" };
export type StructuralDamageKey = string & { readonly [structuralBrand]: "StructuralDamageKey" };
export type StructuralClass = string & { readonly [structuralBrand]: "StructuralClass" };
export type StructuralTag = string & { readonly [structuralBrand]: "StructuralTag" };
export type StructuralMaterialId = number & { readonly [structuralBrand]: "StructuralMaterialId" };
export type StructuralRevision = number & { readonly [structuralBrand]: "StructuralRevision" };
export type StructuralCommandSequence = number & { readonly [structuralBrand]: "StructuralCommandSequence" };
export type StructuralLocalCellIndex = number & { readonly [structuralBrand]: "StructuralLocalCellIndex" };
export type StructuralComponentId = string & { readonly [structuralBrand]: "StructuralComponentId" };

export interface StructuralMaterialDefinition {
  readonly materialId: StructuralMaterialId;
  readonly densityKgPerCubicMeter: number;
  readonly structuralClass: StructuralClass;
  readonly destructible: boolean;
  readonly tags: readonly StructuralTag[] | null;
}

export interface StructuralVoxelState {
  readonly materialId: StructuralMaterialId;
  readonly partId: StructuralPartId | null;
  readonly semanticKey: StructuralSemanticKey | null;
  readonly damageKey: StructuralDamageKey | null;
}

export interface StructuralLocalCellOffset {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface StructuralCellAddress {
  readonly brickKey: AdaptiveBrickKey;
  readonly local: StructuralLocalCellOffset;
}

export interface StructuralBrickCell {
  readonly localIndex: StructuralLocalCellIndex;
  readonly state: StructuralVoxelState;
}

export interface StructuralBrick {
  readonly schemaVersion: typeof STRUCTURAL_BRICK_SCHEMA_VERSION;
  readonly key: AdaptiveBrickKey;
  readonly cells: readonly StructuralBrickCell[];
}

export interface StructuralFrameBinding {
  readonly schemaVersion: typeof STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION;
  readonly bodyId: StableAuthorityId;
  readonly surfaceFrameId: StableAuthorityId;
  readonly regionId: StableAuthorityId;
  readonly generatorVersion: StableAuthorityId;
  readonly objectOriginQuantum: QuantumPoint;
}

export interface StructuralAdaptiveSourceBinding {
  readonly schemaVersion: typeof STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION;
  readonly baseFieldIdentity: StableAuthorityId;
  readonly baseFieldVersion: StableAuthorityId;
  readonly baseFieldDescriptorDigest: string;
  readonly journalDigest: string;
  readonly snapshotProjectionDigest: string;
  readonly proofDigests: readonly string[];
  readonly sourceRevision: AuthorityRevision;
  readonly editRevision: AuthorityRevision;
  readonly brickRevision: AuthorityRevision;
  readonly planningEpoch: AdaptivePlanningEpoch;
}

export type StructuralSourceBinding = StructuralAdaptiveSourceBinding;

export interface StructuralAnchor {
  readonly anchorId: StableAuthorityId;
  readonly cell: StructuralCellAddress;
}

export interface StructuralJointEndpoint {
  readonly cell: StructuralCellAddress;
  readonly role: string;
}

export interface StructuralJoint {
  readonly jointId: StableAuthorityId;
  readonly jointClass: string;
  readonly endpointA: StructuralJointEndpoint;
  readonly endpointB: StructuralJointEndpoint;
}

export type StructuralCommandStatus = "Applied" | "NoChange" | "Rejected";

export interface StructuralCommandEvidence {
  readonly schemaVersion: typeof STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION;
  readonly commandId: StableAuthorityId;
  readonly commandHash: string;
  readonly status: Exclude<StructuralCommandStatus, "Rejected">;
  readonly previousObjectRevision: StructuralRevision;
  readonly resultingObjectRevision: StructuralRevision;
  readonly previousEditRevision: StructuralRevision;
  readonly resultingEditRevision: StructuralRevision;
  readonly previousContentHash: string;
  readonly resultingContentHash: string;
  readonly changedBrickKeys: readonly AdaptiveBrickKey[];
  readonly selectedVoxelCount: number;
  readonly changedVoxelCount: number;
  readonly adaptiveJournalDigest: string;
}

export interface StructuralObject {
  readonly schemaVersion: typeof STRUCTURAL_OBJECT_SCHEMA_VERSION;
  readonly objectId: StructuralObjectId;
  readonly frame: StructuralFrameBinding;
  readonly source: StructuralAdaptiveSourceBinding;
  readonly materials: readonly StructuralMaterialDefinition[];
  readonly bricks: readonly StructuralBrick[];
  readonly anchors: readonly StructuralAnchor[];
  readonly joints: readonly StructuralJoint[];
  readonly objectRevision: StructuralRevision;
  readonly editRevision: StructuralRevision;
  readonly contentHash: string;
  readonly commandEvidence: readonly StructuralCommandEvidence[];
  readonly evidenceHash: string;
}

export interface StructuralMaterialFilter {
  readonly materialIds: readonly StructuralMaterialId[];
}

export interface StructuralSphereShape {
  readonly kind: "sphere";
  readonly space: "global-quantum" | "object-local-quantum";
  readonly centerQuantum: QuantumPoint;
  readonly radiusQuantum: GlobalQuantumCoordinate;
}

export interface StructuralBoxShape {
  readonly kind: "box";
  readonly space: "global-quantum" | "object-local-quantum";
  readonly boundsQuantum: QuantumBounds;
}

export interface StructuralCommandBudgets {
  readonly maxVisitedBricks: number;
  readonly maxVisitedCells: number;
  readonly maxSelectedCells: number;
  readonly maxChangedCells: number;
  readonly maxConnectivityCells: number;
  readonly maxComponents: number;
  readonly maxMassCells: number;
}

export type StructuralCommandOrder =
  | { readonly sequence: StructuralCommandSequence; readonly tick?: never }
  | { readonly sequence?: never; readonly tick: StructuralCommandSequence };

interface StructuralCommandBase {
  readonly schemaVersion: typeof STRUCTURAL_COMMAND_SCHEMA_VERSION;
  readonly commandId: StableAuthorityId;
  readonly targetObjectId: StructuralObjectId;
  readonly expectedObjectRevision: StructuralRevision;
  readonly resultingObjectRevision: StructuralRevision;
  readonly materialFilter: StructuralMaterialFilter | null;
  readonly actor: StableAuthorityId;
  readonly source: StableAuthorityId;
  readonly budgets: StructuralCommandBudgets;
}

export type StructuralSubtractSphereCommand = StructuralCommandBase & StructuralCommandOrder & {
  readonly kind: "SubtractSphere";
  readonly shape: StructuralSphereShape;
};

export type StructuralSubtractBoxCommand = StructuralCommandBase & StructuralCommandOrder & {
  readonly kind: "SubtractBox";
  readonly shape: StructuralBoxShape;
};

export type StructuralSetMaterialSphereCommand = StructuralCommandBase & StructuralCommandOrder & {
  readonly kind: "SetMaterialSphere";
  readonly shape: StructuralSphereShape;
  readonly materialId: StructuralMaterialId;
};

export type StructuralSetMaterialBoxCommand = StructuralCommandBase & StructuralCommandOrder & {
  readonly kind: "SetMaterialBox";
  readonly shape: StructuralBoxShape;
  readonly materialId: StructuralMaterialId;
};

export type StructuralDestructionCommand =
  | StructuralSubtractSphereCommand
  | StructuralSubtractBoxCommand
  | StructuralSetMaterialSphereCommand
  | StructuralSetMaterialBoxCommand;

export type StructuralRejectionCode =
  | "InvalidContract"
  | "WrongTarget"
  | "RevisionConflict"
  | "DuplicateCommand"
  | "InvalidMaterial"
  | "MissingBrickCoverage"
  | "StaleAdaptiveAuthority"
  | "ArithmeticOverflow"
  | "BudgetExceeded"
  | "ConnectivityRejected"
  | "MassRejected";

export interface StructuralDerivedInvalidation {
  readonly kind: "Components" | "MassProperties" | "Mesh";
  readonly sourceObjectRevision: StructuralRevision;
  readonly sourceContentHash: string;
}

export interface StructuralAcceptedCommandResult {
  readonly schemaVersion: typeof STRUCTURAL_RESULT_SCHEMA_VERSION;
  readonly status: "Applied" | "NoChange";
  readonly commandId: StableAuthorityId;
  readonly object: StructuralObject;
  readonly changedBrickKeys: readonly AdaptiveBrickKey[];
  readonly selectedVoxelCount: number;
  readonly changedVoxelCount: number;
  readonly invalidations: readonly StructuralDerivedInvalidation[];
  readonly resultHash: string;
}

export interface StructuralRejectedCommandResult {
  readonly schemaVersion: typeof STRUCTURAL_RESULT_SCHEMA_VERSION;
  readonly status: "Rejected";
  readonly commandId: StableAuthorityId | null;
  readonly object: StructuralObject;
  readonly code: StructuralRejectionCode;
  readonly path: string;
  readonly resultHash: string;
}

export type StructuralCommandResult = StructuralAcceptedCommandResult | StructuralRejectedCommandResult;

export interface StructuralActiveAnchorFact {
  readonly anchorId: StableAuthorityId;
  readonly cell: StructuralCellAddress;
}

export interface StructuralActiveJointFact {
  readonly jointId: StableAuthorityId;
  readonly endpoint: "A" | "B";
  readonly cell: StructuralCellAddress;
  readonly role: string;
}

export interface StructuralComponent {
  readonly schemaVersion: typeof STRUCTURAL_COMPONENT_SCHEMA_VERSION;
  readonly componentIdVersion: typeof STRUCTURAL_COMPONENT_ID_VERSION;
  readonly componentId: StructuralComponentId;
  readonly objectId: StructuralObjectId;
  readonly objectRevision: StructuralRevision;
  readonly occupiedCells: readonly StructuralCellAddress[];
  readonly smallestOccupiedCellKey: string;
  readonly activeAnchors: readonly StructuralActiveAnchorFact[];
  readonly activeJoints: readonly StructuralActiveJointFact[];
  readonly anchored: boolean;
  readonly componentContentHash: string;
}

export interface StructuralConnectivityBudgets {
  readonly maxVisitedCells: number;
  readonly maxComponents: number;
}

export interface StructuralComponentClassification {
  readonly components: readonly StructuralComponent[];
  readonly anchoredComponents: readonly StructuralComponent[];
  readonly detachedComponents: readonly StructuralComponent[];
}

export interface StructuralInertiaTensor {
  readonly xx: number;
  readonly yy: number;
  readonly zz: number;
  readonly xy: number;
  readonly xz: number;
  readonly yz: number;
}

export interface StructuralMassProperties {
  readonly schemaVersion: typeof STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION;
  readonly algorithmVersion: typeof STRUCTURAL_MASS_ALGORITHM_VERSION;
  readonly totalMassKg: number;
  readonly centerOfMassMeters: MeterPoint | null;
  readonly boundsMeters: MeterBounds | null;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  readonly occupiedVoxelCount: number;
  readonly sourceRevision: StructuralRevision;
  readonly sourceContentHash: string;
  readonly contentHash: string;
}

export interface StructuralMassBudgets {
  readonly maxVisitedCells: number;
}

export interface StructuralMeshBudgets {
  readonly maxVisitedCells: number;
  readonly maxQuads: number;
  readonly maxVertices: number;
  readonly maxIndices: number;
}

export interface StructuralMeshMaterialRange {
  readonly materialId: StructuralMaterialId;
  readonly firstIndex: number;
  readonly indexCount: number;
}

export interface StructuralMeshProduct {
  readonly schemaVersion: typeof STRUCTURAL_MESH_SCHEMA_VERSION;
  readonly algorithmVersion: typeof STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION;
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly indices: readonly number[];
  readonly materialRanges: readonly StructuralMeshMaterialRange[];
  readonly boundsMeters: MeterBounds | null;
  readonly contentHash: string;
  readonly sourceRevision: StructuralRevision;
  readonly sourceContentHash: string;
}

export interface StructuralMeshSuccess {
  readonly status: "Produced";
  readonly product: StructuralMeshProduct;
}

export interface StructuralMeshFailure {
  readonly status: "Rejected";
  readonly code: "MissingNeighborCoverage" | "BudgetExceeded" | "InvalidStructuralState";
  readonly missingNeighborKey: AdaptiveBrickKey | null;
}

export type StructuralMeshResult = StructuralMeshSuccess | StructuralMeshFailure;

export interface StructuralAdaptiveMaterialBinding {
  readonly adaptiveMaterialId: StableAuthorityId;
  readonly structuralMaterialId: StructuralMaterialId;
}

export interface StructuralAdaptiveIngestInput {
  readonly objectId: string;
  readonly frame: unknown;
  readonly authority: AdaptiveAuthorityRetention;
  readonly snapshot: unknown;
  readonly materials: readonly unknown[];
  readonly materialBindings: readonly unknown[];
  readonly bricks: readonly unknown[];
  readonly anchors: readonly unknown[];
  readonly joints: readonly unknown[];
  readonly objectRevision: number;
  readonly editRevision: number;
  readonly commandEvidence: readonly unknown[];
}
