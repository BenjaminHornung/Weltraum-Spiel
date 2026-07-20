import { calculateVoxelBrickContentHash } from "./canonical";
import {
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_SAMPLE_COUNT,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_SAMPLE_DIMENSIONS
} from "./channels";
import { validateDensityChannel } from "./density";
import { isStrictVoxelInteger, isVoxelContentHash, validateVoxelRevision, validateVoxelStableId } from "./ids";
import {
  HESTIA_MATERIAL_REGISTRY_V1,
  validateMaterialChannel,
  validateVoxelMaterialRegistry
} from "./materials";
import {
  VOXEL_BRICK_INDEX_ORDER,
  VOXEL_BRICK_LAYOUT_VERSION,
  VOXEL_BRICK_SCHEMA_VERSION,
  invalidVoxelResult,
  throwIfVoxelInvalid,
  validVoxelResult,
  voxelIssue,
  VoxelContractError,
  type VoxelBrick,
  type VoxelBrickInput,
  type VoxelCoordinate,
  type VoxelDimensions,
  type VoxelMaterialRegistry,
  type VoxelValidationIssue,
  type VoxelValidationResult
} from "./types";

const AXES = ["x", "y", "z"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateExactDimensions = (
  value: unknown,
  expected: VoxelDimensions,
  path: string,
  issues: VoxelValidationIssue[]
): void => {
  if (!isRecord(value)) {
    issues.push(voxelIssue("InvalidDimensions", path, "must be an x/y/z dimensions object"));
    return;
  }
  for (const axis of AXES) {
    if (value[axis] !== expected[axis]) {
      issues.push(voxelIssue("InvalidDimensions", `${path}.${axis}`, `must equal ${expected[axis]} for VoxelBrick V1`));
    }
  }
};

const validateBrickCoordinate = (value: unknown, path: string, issues: VoxelValidationIssue[]): void => {
  if (!isRecord(value)) {
    issues.push(voxelIssue("InvalidCoordinate", path, "must be an x/y/z coordinate object"));
    return;
  }
  for (const axis of AXES) {
    const coordinate = value[axis];
    if (!isStrictVoxelInteger(coordinate)) {
      issues.push(voxelIssue("InvalidCoordinate", `${path}.${axis}`, "must be a safe integer"));
    }
  }
};

const addResult = (issues: VoxelValidationIssue[], result: VoxelValidationResult): void => {
  if (!result.valid) issues.push(...result.issues);
};

export const validateVoxelBrickInput = (
  value: unknown,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1
): VoxelValidationResult => {
  if (!isRecord(value)) {
    return invalidVoxelResult([voxelIssue("InvalidLayoutVersion", "brick", "must be an object")]);
  }
  const issues: VoxelValidationIssue[] = [];
  addResult(issues, validateVoxelMaterialRegistry(registry));
  if (value.schemaVersion !== VOXEL_BRICK_SCHEMA_VERSION) {
    issues.push(voxelIssue("InvalidSchemaVersion", "schemaVersion", `must equal ${VOXEL_BRICK_SCHEMA_VERSION}`));
  }
  if (value.layoutVersion !== VOXEL_BRICK_LAYOUT_VERSION) {
    issues.push(voxelIssue("InvalidLayoutVersion", "layoutVersion", `must equal ${VOXEL_BRICK_LAYOUT_VERSION}`));
  }
  if (value.indexOrder !== VOXEL_BRICK_INDEX_ORDER) {
    issues.push(voxelIssue("InvalidIndexOrder", "indexOrder", `must equal ${VOXEL_BRICK_INDEX_ORDER}`));
  }
  addResult(issues, validateVoxelStableId(value.bodyId, "bodyId"));
  addResult(issues, validateVoxelStableId(value.surfaceFrameId, "surfaceFrameId"));
  addResult(issues, validateVoxelStableId(value.regionId, "regionId"));
  addResult(issues, validateVoxelStableId(value.generatorVersion, "generatorVersion"));
  addResult(issues, validateVoxelStableId(value.materialRegistryVersion, "materialRegistryVersion"));
  if (value.materialRegistryVersion !== HESTIA_MATERIAL_REGISTRY_V1.version) {
    issues.push(voxelIssue(
      "InvalidMaterialRegistry",
      "materialRegistryVersion",
      `must equal ${HESTIA_MATERIAL_REGISTRY_V1.version}`
    ));
  }
  validateBrickCoordinate(value.brickCoordinate, "brickCoordinate", issues);
  if (typeof value.voxelSizeMeters !== "number" || !Number.isFinite(value.voxelSizeMeters) || value.voxelSizeMeters <= 0) {
    issues.push(voxelIssue("InvalidVoxelSize", "voxelSizeMeters", "must be a positive finite number"));
  }
  validateExactDimensions(value.cellDimensions, VOXEL_BRICK_CELL_DIMENSIONS, "cellDimensions", issues);
  validateExactDimensions(value.sampleDimensions, VOXEL_BRICK_SAMPLE_DIMENSIONS, "sampleDimensions", issues);
  if (value.apronWidth !== VOXEL_BRICK_APRON_WIDTH) {
    issues.push(voxelIssue("InvalidApronWidth", "apronWidth", `must equal ${VOXEL_BRICK_APRON_WIDTH}`));
  }
  addResult(issues, validateVoxelRevision(value.sourceRevision, "sourceRevision"));
  addResult(issues, validateVoxelRevision(value.editRevision, "editRevision"));
  if (value.editRevision !== 0) {
    issues.push(voxelIssue("InvalidRevision", "editRevision", "must equal zero for VoxelBrick V1"));
  }
  addResult(issues, validateDensityChannel(value.densityBuffer, VOXEL_BRICK_SAMPLE_COUNT));
  addResult(issues, validateMaterialChannel(
    value.materialBuffer,
    VOXEL_BRICK_SAMPLE_COUNT,
    HESTIA_MATERIAL_REGISTRY_V1
  ));
  return issues.length === 0 ? validVoxelResult() : invalidVoxelResult(issues);
};

export const validateVoxelBrick = (
  value: unknown,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1
): VoxelValidationResult => {
  const inputValidation = validateVoxelBrickInput(value, registry);
  if (!inputValidation.valid) return inputValidation;
  const brick = value as VoxelBrick;
  if (!isVoxelContentHash(brick.contentHash)) {
    return invalidVoxelResult([
      voxelIssue("InvalidContentHash", "contentHash", "must use the fnv1a64:<16 lowercase hex digits> format")
    ]);
  }
  if (calculateVoxelBrickContentHash(brick) !== brick.contentHash) {
    return invalidVoxelResult([voxelIssue("ContentHashMismatch", "contentHash", "does not match canonical brick content")]);
  }
  return validVoxelResult();
};

const copyCoordinate = (coordinate: VoxelCoordinate): VoxelCoordinate =>
  Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });

const copyDimensions = (dimensions: VoxelDimensions): VoxelDimensions =>
  Object.freeze({ x: dimensions.x, y: dimensions.y, z: dimensions.z });

/**
 * Creates frozen metadata and separate defensive full-array channel copies.
 * Typed-array elements intentionally remain mutable; content-hash validation detects later mutation.
 */
export const createVoxelBrick = (
  input: VoxelBrickInput,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1
): VoxelBrick => {
  throwIfVoxelInvalid("VoxelBrickInput", validateVoxelBrickInput(input, registry));
  const content: VoxelBrickInput = {
    ...input,
    brickCoordinate: copyCoordinate(input.brickCoordinate),
    cellDimensions: copyDimensions(input.cellDimensions),
    sampleDimensions: copyDimensions(input.sampleDimensions),
    densityBuffer: new Float32Array(input.densityBuffer),
    materialBuffer: new Uint8Array(input.materialBuffer)
  };
  const brick: VoxelBrick = Object.freeze({ ...content, contentHash: calculateVoxelBrickContentHash(content) });
  throwIfVoxelInvalid("VoxelBrick", validateVoxelBrick(brick, registry));
  return brick;
};

const requireSafeCoordinate = (coordinate: VoxelCoordinate, path: string): void => {
  for (const axis of AXES) {
    if (!isStrictVoxelInteger(coordinate[axis])) {
      throw new VoxelContractError("Voxel coordinate is invalid", [
        voxelIssue("InvalidCoordinate", `${path}.${axis}`, "must be a safe integer")
      ]);
    }
  }
};

/** Stored sample 0..dimension+2 maps to core-lattice coordinate -1..dimension+1. */
export const storedSampleToCoreCoordinate = (storedSample: VoxelCoordinate): VoxelCoordinate => {
  requireSafeCoordinate(storedSample, "storedSample");
  for (const axis of AXES) {
    if (storedSample[axis] < 0 || storedSample[axis] >= VOXEL_BRICK_SAMPLE_DIMENSIONS[axis]) {
      throw new VoxelContractError("Stored sample coordinate is invalid", [
        voxelIssue("InvalidCoordinate", `storedSample.${axis}`, `must be from 0 through ${VOXEL_BRICK_SAMPLE_DIMENSIONS[axis] - 1}`)
      ]);
    }
  }
  return Object.freeze({
    x: storedSample.x - VOXEL_BRICK_APRON_WIDTH,
    y: storedSample.y - VOXEL_BRICK_APRON_WIDTH,
    z: storedSample.z - VOXEL_BRICK_APRON_WIDTH
  });
};

export const coreSampleToStoredCoordinate = (coreSample: VoxelCoordinate): VoxelCoordinate => {
  requireSafeCoordinate(coreSample, "coreSample");
  for (const axis of AXES) {
    if (coreSample[axis] < -VOXEL_BRICK_APRON_WIDTH || coreSample[axis] > VOXEL_BRICK_CELL_DIMENSIONS[axis] + VOXEL_BRICK_APRON_WIDTH) {
      throw new VoxelContractError("Core sample coordinate is invalid", [
        voxelIssue("InvalidCoordinate", `coreSample.${axis}`, `must be from -1 through ${VOXEL_BRICK_CELL_DIMENSIONS[axis] + 1}`)
      ]);
    }
  }
  return Object.freeze({
    x: coreSample.x + VOXEL_BRICK_APRON_WIDTH,
    y: coreSample.y + VOXEL_BRICK_APRON_WIDTH,
    z: coreSample.z + VOXEL_BRICK_APRON_WIDTH
  });
};

/** global = brickCoordinate * cellDimensions + storedSample - apronWidth. */
export const storedSampleToGlobalCoordinate = (
  brickCoordinate: VoxelCoordinate,
  storedSample: VoxelCoordinate
): VoxelCoordinate => {
  requireSafeCoordinate(brickCoordinate, "brickCoordinate");
  const coreSample = storedSampleToCoreCoordinate(storedSample);
  const result = {
    x: brickCoordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x + coreSample.x,
    y: brickCoordinate.y * VOXEL_BRICK_CELL_DIMENSIONS.y + coreSample.y,
    z: brickCoordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z + coreSample.z
  };
  requireSafeCoordinate(result, "globalSample");
  return Object.freeze(result);
};

export const globalSampleToStoredCoordinate = (
  brickCoordinate: VoxelCoordinate,
  globalSample: VoxelCoordinate
): VoxelCoordinate => {
  requireSafeCoordinate(brickCoordinate, "brickCoordinate");
  requireSafeCoordinate(globalSample, "globalSample");
  const stored = {
    x: globalSample.x - brickCoordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x + VOXEL_BRICK_APRON_WIDTH,
    y: globalSample.y - brickCoordinate.y * VOXEL_BRICK_CELL_DIMENSIONS.y + VOXEL_BRICK_APRON_WIDTH,
    z: globalSample.z - brickCoordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z + VOXEL_BRICK_APRON_WIDTH
  };
  storedSampleToCoreCoordinate(stored);
  return Object.freeze(stored);
};

export const globalSamplePositionMeters = (
  globalSample: VoxelCoordinate,
  voxelSizeMeters: number
): Readonly<{ x: number; y: number; z: number }> => {
  requireSafeCoordinate(globalSample, "globalSample");
  if (!Number.isFinite(voxelSizeMeters) || voxelSizeMeters <= 0) {
    throw new VoxelContractError("Voxel size is invalid", [
      voxelIssue("InvalidVoxelSize", "voxelSizeMeters", "must be a positive finite number")
    ]);
  }
  const position = {
    x: globalSample.x * voxelSizeMeters,
    y: globalSample.y * voxelSizeMeters,
    z: globalSample.z * voxelSizeMeters
  };
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
    throw new VoxelContractError("Sample position is invalid", [
      voxelIssue("InvalidCoordinate", "globalSample", "produces a non-finite position")
    ]);
  }
  return Object.freeze(position);
};
