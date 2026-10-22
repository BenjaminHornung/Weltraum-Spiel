import type {
  EditRevision,
  GeneratorVersion,
  MaterialRegistryVersion,
  SourceRevision,
  SurfaceFrameId,
  VoxelBodyId,
  VoxelContentHash,
  VoxelMaterialId,
  VoxelMaterialKey,
  VoxelMeshRepresentationKey,
  VoxelRegionId
} from "./ids";

export const VOXEL_BRICK_SCHEMA_VERSION = 1 as const;
export const VOXEL_BRICK_LAYOUT_VERSION = "voxel-brick-x-fastest-v1" as const;
export const VOXEL_BRICK_INDEX_ORDER = "XFastest" as const;
export const VOXEL_MESH_SCHEMA_VERSION = 1 as const;
export const VOXEL_MESH_ALGORITHM_VERSION = "surface_nets_v1" as const;

export interface VoxelDimensions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VoxelCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type VoxelMaterialSemantic =
  | "SolidRock"
  | "WetSoil"
  | "MossCover"
  | "DenseBiologicalSurface"
  | "ShallowWaterBoundary";

export interface VoxelMaterialDefinition {
  readonly id: VoxelMaterialId;
  readonly key: VoxelMaterialKey;
  /** Domain meaning only. Water remains a separate, non-simulated presentation plane. */
  readonly semantic: VoxelMaterialSemantic;
}

export interface VoxelMaterialRegistry {
  readonly version: MaterialRegistryVersion;
  /** Canonically ordered by ascending byte ID. */
  readonly definitions: readonly VoxelMaterialDefinition[];
}

export interface VoxelBrickContent {
  readonly schemaVersion: typeof VOXEL_BRICK_SCHEMA_VERSION;
  readonly layoutVersion: typeof VOXEL_BRICK_LAYOUT_VERSION;
  readonly indexOrder: typeof VOXEL_BRICK_INDEX_ORDER;
  readonly bodyId: VoxelBodyId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly regionId: VoxelRegionId;
  readonly brickCoordinate: VoxelCoordinate;
  readonly voxelSizeMeters: number;
  readonly cellDimensions: VoxelDimensions;
  readonly sampleDimensions: VoxelDimensions;
  readonly apronWidth: number;
  readonly generatorVersion: GeneratorVersion;
  readonly materialRegistryVersion: MaterialRegistryVersion;
  readonly sourceRevision: SourceRevision;
  readonly editRevision: EditRevision;
  readonly densityBuffer: Float32Array;
  readonly materialBuffer: Uint8Array;
}

export type VoxelBrickInput = VoxelBrickContent;

export interface VoxelBrick extends VoxelBrickContent {
  readonly contentHash: VoxelContentHash;
}

export interface VoxelMeshBounds {
  readonly min: Readonly<VoxelCoordinate>;
  readonly max: Readonly<VoxelCoordinate>;
}

export interface VoxelMeshMaterialRange {
  readonly materialId: VoxelMaterialId;
  readonly materialKey: VoxelMaterialKey;
  readonly startIndex: number;
  readonly indexCount: number;
}

export interface VoxelMeshProductContent {
  readonly schemaVersion: typeof VOXEL_MESH_SCHEMA_VERSION;
  readonly representationKey: VoxelMeshRepresentationKey;
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: EditRevision;
  readonly algorithmVersion: typeof VOXEL_MESH_ALGORITHM_VERSION;
  readonly frameId: SurfaceFrameId;
  readonly materialRegistryVersion: MaterialRegistryVersion;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly materialRanges: readonly VoxelMeshMaterialRange[];
  readonly bounds: VoxelMeshBounds;
}

export interface VoxelMeshProduct extends VoxelMeshProductContent {
  readonly contentHash: VoxelContentHash;
}

export type VoxelValidationIssueCode =
  | "InvalidSchemaVersion"
  | "InvalidLayoutVersion"
  | "InvalidIndexOrder"
  | "InvalidStableId"
  | "InvalidContentHash"
  | "InvalidRevision"
  | "InvalidCoordinate"
  | "InvalidVoxelSize"
  | "InvalidDimensions"
  | "InvalidApronWidth"
  | "InvalidChannelType"
  | "InvalidChannelLength"
  | "NonFiniteDensity"
  | "InvalidMaterialId"
  | "InvalidMaterialRegistry"
  | "DuplicateMaterialId"
  | "DuplicateMaterialKey"
  | "InvalidMeshSchemaVersion"
  | "InvalidMeshAlgorithmVersion"
  | "InvalidMeshRepresentationKey"
  | "InvalidMeshChannel"
  | "InvalidMeshIndex"
  | "InvalidMaterialRange"
  | "InvalidBounds"
  | "DegenerateGeometry"
  | "ContentHashMismatch";

export interface VoxelValidationIssue {
  readonly code: VoxelValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type VoxelValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly issues: readonly VoxelValidationIssue[] };

/** Stable fail-closed error raised by constructors after structured validation. */
export class VoxelContractError extends Error {
  public readonly issues: readonly VoxelValidationIssue[];

  public constructor(message: string, issues: readonly VoxelValidationIssue[]) {
    super(message);
    this.name = "VoxelContractError";
    this.issues = Object.freeze([...issues]);
  }
}

export const voxelIssue = (
  code: VoxelValidationIssueCode,
  path: string,
  message: string
): VoxelValidationIssue => Object.freeze({ code, path, message });

export const validVoxelResult = (): VoxelValidationResult => Object.freeze({ valid: true });

export const invalidVoxelResult = (issues: readonly VoxelValidationIssue[]): VoxelValidationResult =>
  Object.freeze({ valid: false, issues: Object.freeze([...issues]) });

export const throwIfVoxelInvalid = (name: string, result: VoxelValidationResult): void => {
  if (!result.valid) {
    throw new VoxelContractError(`${name} is invalid`, result.issues);
  }
};
