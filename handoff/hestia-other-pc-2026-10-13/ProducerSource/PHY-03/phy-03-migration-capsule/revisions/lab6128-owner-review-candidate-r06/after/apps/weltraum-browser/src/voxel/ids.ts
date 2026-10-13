import {
  invalidVoxelResult,
  validVoxelResult,
  voxelIssue,
  type VoxelValidationResult
} from "./types";

declare const voxelBodyIdBrand: unique symbol;
declare const surfaceFrameIdBrand: unique symbol;
declare const voxelRegionIdBrand: unique symbol;
declare const generatorVersionBrand: unique symbol;
declare const materialRegistryVersionBrand: unique symbol;
declare const voxelMaterialKeyBrand: unique symbol;
declare const voxelMaterialIdBrand: unique symbol;
declare const voxelContentHashBrand: unique symbol;
declare const sourceRevisionBrand: unique symbol;
declare const editRevisionBrand: unique symbol;
declare const voxelMeshRepresentationKeyBrand: unique symbol;

export type VoxelBodyId = string & { readonly [voxelBodyIdBrand]: true };
export type SurfaceFrameId = string & { readonly [surfaceFrameIdBrand]: true };
export type VoxelRegionId = string & { readonly [voxelRegionIdBrand]: true };
export type GeneratorVersion = string & { readonly [generatorVersionBrand]: true };
export type MaterialRegistryVersion = string & { readonly [materialRegistryVersionBrand]: true };
export type VoxelMaterialKey = string & { readonly [voxelMaterialKeyBrand]: true };
export type VoxelMaterialId = number & { readonly [voxelMaterialIdBrand]: true };
export type VoxelContentHash = string & { readonly [voxelContentHashBrand]: true };
export type SourceRevision = number & { readonly [sourceRevisionBrand]: true };
export type EditRevision = number & { readonly [editRevisionBrand]: true };
export type VoxelMeshRepresentationKey = string & { readonly [voxelMeshRepresentationKeyBrand]: true };

const STABLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const CONTENT_HASH_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const VOXEL_MESH_REPRESENTATION_KEY_PATTERN = /^voxel_mesh:[0-9a-f]{16}$/;

/** Strict discrete-number predicate shared by public VoxelBrick validators. */
export const isStrictVoxelInteger = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isFinite(value)
  && Number.isSafeInteger(value)
  && !Object.is(value, -0);

export const validateVoxelStableId = (value: unknown, path = "id"): VoxelValidationResult =>
  typeof value === "string" && value.length <= 128 && STABLE_ID_PATTERN.test(value)
    ? validVoxelResult()
    : invalidVoxelResult([
        voxelIssue(
          "InvalidStableId",
          path,
          "must be a 1-128 character lowercase ASCII identifier with stable separators"
        )
      ]);

const stableId = <T extends string>(value: unknown, path: string): T => {
  const validation = validateVoxelStableId(value, path);
  if (!validation.valid) {
    const message = validation.issues[0]?.message ?? "is invalid";
    throw new TypeError(`${path} ${message}`);
  }
  return value as T;
};

export const voxelBodyId = (value: unknown): VoxelBodyId => stableId<VoxelBodyId>(value, "bodyId");
export const surfaceFrameId = (value: unknown): SurfaceFrameId => stableId<SurfaceFrameId>(value, "surfaceFrameId");
export const voxelRegionId = (value: unknown): VoxelRegionId => stableId<VoxelRegionId>(value, "regionId");
export const generatorVersion = (value: unknown): GeneratorVersion => stableId<GeneratorVersion>(value, "generatorVersion");
export const materialRegistryVersion = (value: unknown): MaterialRegistryVersion =>
  stableId<MaterialRegistryVersion>(value, "materialRegistryVersion");
export const voxelMaterialKey = (value: unknown): VoxelMaterialKey => stableId<VoxelMaterialKey>(value, "materialKey");

export const validateVoxelRevision = (value: unknown, path = "revision"): VoxelValidationResult =>
  isStrictVoxelInteger(value) && value >= 0
    ? validVoxelResult()
    : invalidVoxelResult([voxelIssue("InvalidRevision", path, "must be a non-negative safe integer")]);

const revision = <T extends number>(value: unknown, path: string): T => {
  if (!validateVoxelRevision(value, path).valid) {
    throw new RangeError(`${path} must be a non-negative safe integer`);
  }
  return value as T;
};

export const sourceRevision = (value: unknown): SourceRevision => revision<SourceRevision>(value, "sourceRevision");

export const editRevision = (value: unknown): EditRevision => {
  const parsed = revision<EditRevision>(value, "editRevision");
  if (parsed !== 0) {
    throw new RangeError("editRevision must be zero for VoxelBrick V1");
  }
  return parsed;
};

export const validateVoxelMaterialId = (value: unknown, path = "materialId"): VoxelValidationResult =>
  isStrictVoxelInteger(value) && value >= 0 && value <= 255
    ? validVoxelResult()
    : invalidVoxelResult([voxelIssue("InvalidMaterialId", path, "must be an integer byte ID from 0 through 255")]);

export const voxelMaterialId = (value: unknown): VoxelMaterialId => {
  if (!validateVoxelMaterialId(value).valid) {
    throw new RangeError("materialId must be an integer byte ID from 0 through 255");
  }
  return value as VoxelMaterialId;
};

export const isVoxelContentHash = (value: unknown): value is VoxelContentHash =>
  typeof value === "string" && CONTENT_HASH_PATTERN.test(value);

export const voxelContentHash = (value: unknown): VoxelContentHash => {
  if (!isVoxelContentHash(value)) {
    throw new TypeError("contentHash must use the fnv1a64:<16 lowercase hex digits> format");
  }
  return value;
};

export const isVoxelMeshRepresentationKey = (value: unknown): value is VoxelMeshRepresentationKey =>
  typeof value === "string" && VOXEL_MESH_REPRESENTATION_KEY_PATTERN.test(value);

export const voxelMeshRepresentationKey = (value: unknown): VoxelMeshRepresentationKey => {
  if (!isVoxelMeshRepresentationKey(value)) {
    throw new TypeError("representationKey must use the voxel_mesh:<16 lowercase hex digits> format");
  }
  return value;
};
