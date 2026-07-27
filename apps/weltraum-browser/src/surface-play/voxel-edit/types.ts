import type { VoxelBrick } from "../../voxel";

export const SURFACE_REGION_VOXEL_SCHEMA_VERSION = "surface-region-voxel-state-v1" as const;
export const SURFACE_VOXEL_EDIT_SCHEMA_VERSION = "surface-voxel-edit-v1" as const;
export const SURFACE_VOXEL_EDIT_QUANTUM_METERS = 0.125 as const;
export const SURFACE_VOXEL_AIR_CHANNEL_VALUE = 0 as const;

export interface SurfaceVoxelCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceRegionBrickBounds {
  readonly minInclusive: Readonly<SurfaceVoxelCoordinate>;
  readonly maxExclusive: Readonly<SurfaceVoxelCoordinate>;
}

export interface SurfaceRegionVoxelAuthorityInput {
  readonly schemaVersion: typeof SURFACE_REGION_VOXEL_SCHEMA_VERSION;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regionId: string;
  readonly generatorVersion: string;
  readonly seed: string;
  readonly voxelSizeMeters: 0.25 | 0.5;
  readonly sourceRevision: number;
  readonly brickBounds: Readonly<SurfaceRegionBrickBounds>;
  readonly residentBrickCoordinates: readonly Readonly<SurfaceVoxelCoordinate>[];
  readonly maxSubtractRadiusMeters: number;
  readonly maxChangedSamplesPerEdit: number;
}

export interface SurfaceRegionVoxelBrickDescriptor {
  readonly key: string;
  readonly coordinate: Readonly<SurfaceVoxelCoordinate>;
  readonly contentHash: string;
  readonly regionRevision: number;
  readonly editRevision: number;
}

export type SurfaceVoxelEditOutcome = "Applied" | "NoChange";

export interface SurfaceVoxelEditRecord {
  readonly schemaVersion: typeof SURFACE_VOXEL_EDIT_SCHEMA_VERSION;
  readonly editId: string;
  readonly sequence: number;
  readonly expectedRegionRevision: number;
  readonly resultingRegionRevision: number;
  readonly resultingEditRevision: number;
  readonly tick: number;
  readonly actorId: string;
  readonly sourceId: string;
  readonly sourceImpactIntentId: string;
  readonly operation: "SubtractSphere";
  readonly centerSurfaceLocalMeters: Readonly<SurfaceVector3>;
  readonly centerGlobalQuantum: Readonly<SurfaceVoxelCoordinate>;
  readonly ownerBrickCoordinate: Readonly<SurfaceVoxelCoordinate>;
  readonly ownerBrickLocalQuantum: Readonly<SurfaceVoxelCoordinate>;
  readonly quantumMeters: typeof SURFACE_VOXEL_EDIT_QUANTUM_METERS;
  readonly radiusMeters: number;
  readonly outcome: SurfaceVoxelEditOutcome;
  readonly priorRegionHash: string;
  readonly resultingRegionHash: string;
  readonly changedBrickKeys: readonly string[];
}

export interface SurfaceRegionVoxelState {
  readonly schemaVersion: typeof SURFACE_REGION_VOXEL_SCHEMA_VERSION;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regionId: string;
  readonly generatorVersion: string;
  readonly seed: string;
  readonly voxelSizeMeters: 0.25 | 0.5;
  readonly sourceRevision: number;
  readonly regionRevision: number;
  readonly editRevision: number;
  readonly planningRevision: number;
  readonly materializationRevision: number;
  readonly brickBounds: Readonly<SurfaceRegionBrickBounds>;
  readonly residentBrickCoordinates: readonly Readonly<SurfaceVoxelCoordinate>[];
  readonly maxSubtractRadiusMeters: number;
  readonly maxChangedSamplesPerEdit: number;
  readonly editJournal: readonly Readonly<SurfaceVoxelEditRecord>[];
  readonly materializedBricks: readonly Readonly<SurfaceRegionVoxelBrickDescriptor>[];
  readonly currentVoxelContentHash: string;
  readonly currentRegionContentHash: string;
}

export interface SurfaceVoxelEditIntent {
  readonly schemaVersion: typeof SURFACE_VOXEL_EDIT_SCHEMA_VERSION;
  readonly editId: string;
  readonly expectedRegionRevision: number;
  readonly tick: number;
  readonly actorId: string;
  readonly sourceId: string;
  readonly sourceImpactIntentId: string;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regionId: string;
  readonly operation: "SubtractSphere";
  readonly centerGlobalQuantum: Readonly<SurfaceVoxelCoordinate>;
  readonly quantumMeters: typeof SURFACE_VOXEL_EDIT_QUANTUM_METERS;
  readonly radiusMeters: number;
}

export type SurfaceVoxelEditRejectionReason =
  | "InvalidInput"
  | "BodyMismatch"
  | "RegionMismatch"
  | "FrameMismatch"
  | "StaleRevision"
  | "DuplicateEditId"
  | "InvalidRadius"
  | "OutsideRegion"
  | "RegionBoundaryClipping"
  | "MissingCoverage"
  | "BudgetExceeded";

interface SurfaceVoxelEditResultBase {
  readonly priorRegionRevision: number;
  readonly resultingRegionRevision: number;
  readonly priorEditRevision: number;
  readonly resultingEditRevision: number;
  readonly priorRegionHash: string;
  readonly resultingRegionHash: string;
  readonly changedBrickKeys: readonly string[];
  readonly seamNeighborKeys: readonly string[];
  readonly requiredRemeshKeys: readonly string[];
  readonly requiredCollisionRefreshKeys: readonly string[];
}

export type SurfaceVoxelEditResult =
  | (SurfaceVoxelEditResultBase & Readonly<{ readonly status: "Applied"; readonly reason: null }>)
  | (SurfaceVoxelEditResultBase & Readonly<{ readonly status: "NoChange"; readonly reason: null }>)
  | (SurfaceVoxelEditResultBase & Readonly<{
      readonly status: "Rejected";
      readonly reason: SurfaceVoxelEditRejectionReason;
      readonly message: string;
    }>);

export interface SurfaceRegionMaterializedVoxelBrick {
  readonly key: string;
  readonly coordinate: Readonly<SurfaceVoxelCoordinate>;
  readonly regionRevision: number;
  readonly editRevision: number;
  readonly voxelBrick: VoxelBrick;
}

export interface SurfaceRegionVoxelAuthority {
  readonly state: Readonly<SurfaceRegionVoxelState>;
  materializeBrick(key: string): Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined;
}

export interface SurfaceVoxelEditTransition {
  readonly authority: SurfaceRegionVoxelAuthority;
  readonly state: Readonly<SurfaceRegionVoxelState>;
  readonly result: Readonly<SurfaceVoxelEditResult>;
}

export interface SurfaceVoxelResidentCoverage {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly editRevision: number;
  readonly residentBrickKeys: readonly string[];
  readonly maxRemeshBricks: number;
  readonly maxEstimatedCellWork: number;
}

export type SurfaceVoxelRemeshPlanRejection =
  | "EditNotApplied"
  | "IdentityMismatch"
  | "StaleCoverage"
  | "MissingCoverage"
  | "BudgetExceeded";

export type SurfaceVoxelRemeshPlanResult =
  | Readonly<{
      readonly status: "Planned";
      readonly changedBrickKeys: readonly string[];
      readonly seamNeighborKeys: readonly string[];
      readonly orderedRemeshKeys: readonly string[];
      readonly expectedRegionRevision: number;
      readonly expectedEditRevision: number;
      readonly estimatedCellWork: number;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly reason: SurfaceVoxelRemeshPlanRejection;
      readonly message: string;
      readonly expectedRegionRevision: number;
      readonly expectedEditRevision: number;
    }>;

export interface SurfaceVoxelCollisionBinding {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly expectedRegionRevision: number;
}

export type SurfaceVoxelCollisionRejectionReason =
  | "InvalidQuery"
  | "IdentityMismatch"
  | "StaleRevision"
  | "OutsideRegion"
  | "MissingCoverage"
  | "BudgetExceeded";

export type SurfaceVoxelDensityQueryResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly density: number;
      readonly materialValue: number;
      readonly classification: "Solid" | "Air";
      readonly regionRevision: number;
      readonly editRevision: number;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly reason: SurfaceVoxelCollisionRejectionReason;
      readonly message: string;
      readonly regionRevision: number;
      readonly editRevision: number;
    }>;

export interface SurfaceVoxelRaycastQuery extends SurfaceVoxelCollisionBinding {
  readonly originMeters: Readonly<SurfaceVector3>;
  readonly direction: Readonly<SurfaceVector3>;
  readonly maximumDistanceMeters: number;
  readonly maxSteps: number;
}

export interface SurfaceVoxelGroundQuery extends SurfaceVoxelCollisionBinding {
  readonly positionMeters: Readonly<SurfaceVector3>;
  readonly maximumDistanceMeters: number;
  readonly maxSteps: number;
}

export interface SurfaceVoxelRaycastHit {
  readonly pointMeters: Readonly<SurfaceVector3>;
  readonly normal: Readonly<SurfaceVector3>;
  readonly distanceMeters: number;
}

export type SurfaceVoxelRaycastResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly hit: Readonly<SurfaceVoxelRaycastHit> | null;
      readonly regionRevision: number;
      readonly editRevision: number;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly reason: SurfaceVoxelCollisionRejectionReason;
      readonly message: string;
      readonly regionRevision: number;
      readonly editRevision: number;
    }>;

export interface SurfaceRegionVoxelCollisionAdapter {
  sampleDensity(
    binding: Readonly<SurfaceVoxelCollisionBinding>,
    positionMeters: Readonly<SurfaceVector3>
  ): Readonly<SurfaceVoxelDensityQueryResult>;
  sampleSolidAir(
    binding: Readonly<SurfaceVoxelCollisionBinding>,
    positionMeters: Readonly<SurfaceVector3>
  ): Readonly<SurfaceVoxelDensityQueryResult>;
  raycast(query: Readonly<SurfaceVoxelRaycastQuery>): Readonly<SurfaceVoxelRaycastResult>;
  queryGround(query: Readonly<SurfaceVoxelGroundQuery>): Readonly<SurfaceVoxelRaycastResult>;
}
