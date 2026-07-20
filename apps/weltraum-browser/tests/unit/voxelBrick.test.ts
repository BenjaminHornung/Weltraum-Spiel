import { describe, expect, it } from "vitest";
import {
  HESTIA_MATERIAL_REGISTRY_V1,
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_CELL_COUNT,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_INDEX_ORDER,
  VOXEL_BRICK_LAYOUT_VERSION,
  VOXEL_BRICK_SAMPLE_COUNT,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  VOXEL_BRICK_SCHEMA_VERSION,
  VOXEL_CHANNEL_BYTES,
  VOXEL_DENSITY_BYTES,
  VOXEL_MATERIAL_BYTES,
  VoxelContractError,
  allocateVoxelChannels,
  calculateVoxelBrickContentHash,
  createVoxelBrick,
  editRevision,
  generatorVersion,
  isSolidDensity,
  serializeCanonicalVoxelBrick,
  sourceRevision,
  surfaceFrameId,
  validateVoxelBrick,
  validateVoxelBrickInput,
  voxelBodyId,
  voxelRegionId,
  voxelSampleCoordinate,
  voxelSampleIndex,
  type VoxelBrickInput,
  type VoxelMaterialRegistry
} from "../../src/voxel";

const brickInput = (): VoxelBrickInput => {
  const channels = allocateVoxelChannels();
  channels.densityBuffer.fill(1);
  return {
    schemaVersion: VOXEL_BRICK_SCHEMA_VERSION,
    layoutVersion: VOXEL_BRICK_LAYOUT_VERSION,
    indexOrder: VOXEL_BRICK_INDEX_ORDER,
    bodyId: voxelBodyId("planet.hestia"),
    surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
    regionId: voxelRegionId("region:hestia.preview"),
    brickCoordinate: { x: -2, y: 0, z: 3 },
    voxelSizeMeters: 0.5,
    cellDimensions: VOXEL_BRICK_CELL_DIMENSIONS,
    sampleDimensions: VOXEL_BRICK_SAMPLE_DIMENSIONS,
    apronWidth: VOXEL_BRICK_APRON_WIDTH,
    generatorVersion: generatorVersion("hestia.generator.v1"),
    materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
    sourceRevision: sourceRevision(7),
    editRevision: editRevision(0),
    ...channels
  };
};

const issueCodes = (value: unknown): readonly string[] => {
  const result = validateVoxelBrickInput(value);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
};

describe("VoxelBrick V1 layout", () => {
  it("fixes dimensions, channel types, counts, and exact memory sizes", () => {
    const channels = allocateVoxelChannels();
    expect(VOXEL_BRICK_CELL_DIMENSIONS).toEqual({ x: 32, y: 64, z: 32 });
    expect(VOXEL_BRICK_SAMPLE_DIMENSIONS).toEqual({ x: 35, y: 67, z: 35 });
    expect(VOXEL_BRICK_CELL_COUNT).toBe(65_536);
    expect(VOXEL_BRICK_SAMPLE_COUNT).toBe(82_075);
    expect(channels.densityBuffer).toBeInstanceOf(Float32Array);
    expect(channels.materialBuffer).toBeInstanceOf(Uint8Array);
    expect(channels.densityBuffer.byteLength).toBe(VOXEL_DENSITY_BYTES);
    expect(channels.materialBuffer.byteLength).toBe(VOXEL_MATERIAL_BYTES);
    expect(VOXEL_DENSITY_BYTES).toBe(328_300);
    expect(VOXEL_MATERIAL_BYTES).toBe(82_075);
    expect(VOXEL_CHANNEL_BYTES).toBe(410_375);
  });

  it("uses X-fastest indexing at boundaries and in the interior", () => {
    expect(voxelSampleIndex({ x: 0, y: 0, z: 0 })).toBe(0);
    expect(voxelSampleIndex({ x: 1, y: 0, z: 0 })).toBe(1);
    expect(voxelSampleIndex({ x: 0, y: 1, z: 0 })).toBe(35);
    expect(voxelSampleIndex({ x: 0, y: 0, z: 1 })).toBe(35 * 67);
    expect(voxelSampleIndex({ x: 7, y: 11, z: 13 })).toBe(7 + 35 * (11 + 67 * 13));
    expect(voxelSampleIndex({ x: 34, y: 66, z: 34 })).toBe(VOXEL_BRICK_SAMPLE_COUNT - 1);
    expect(voxelSampleCoordinate(voxelSampleIndex({ x: 7, y: 11, z: 13 }))).toEqual({ x: 7, y: 11, z: 13 });
    expect(() => voxelSampleIndex({ x: 35, y: 0, z: 0 })).toThrow(VoxelContractError);
  });

  it("rejects fractional, negative-zero, nonfinite, and unsafe public discrete inputs", () => {
    const invalidDiscreteValues = [-0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
    for (const value of invalidDiscreteValues) {
      expect(() => voxelSampleIndex({ x: value, y: 0, z: 0 })).toThrow(VoxelContractError);
      expect(() => voxelSampleCoordinate(value)).toThrow(VoxelContractError);
      expect(issueCodes({ ...brickInput(), brickCoordinate: { x: value, y: 0, z: 0 } })).toContain("InvalidCoordinate");
      expect(issueCodes({ ...brickInput(), sourceRevision: value })).toContain("InvalidRevision");
      expect(issueCodes({ ...brickInput(), editRevision: value })).toContain("InvalidRevision");
      expect(() => sourceRevision(value)).toThrow(RangeError);
      expect(() => editRevision(value)).toThrow(RangeError);
    }

    for (const voxelSizeMeters of [-0, 0, -0.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(issueCodes({ ...brickInput(), voxelSizeMeters })).toContain("InvalidVoxelSize");
    }
  });

  it("creates a validated renderer-neutral snapshot with stable metadata", () => {
    const input = brickInput();
    const brick = createVoxelBrick(input);
    expect(validateVoxelBrick(brick)).toEqual({ valid: true });
    expect(brick.layoutVersion).toBe("voxel-brick-x-fastest-v1");
    expect(brick.sourceRevision).toBe(7);
    expect(brick.editRevision).toBe(0);
    expect(brick.densityBuffer).not.toBe(input.densityBuffer);
    expect(brick.materialBuffer).not.toBe(input.materialBuffer);
    expect(Object.isFrozen(brick)).toBe(true);
    expect(Object.isFrozen(brick.brickCoordinate)).toBe(true);
  });

  it("returns explicit issues and throws a structured error for malformed contracts", () => {
    const valid = brickInput();
    expect(issueCodes({ ...valid, voxelSizeMeters: Number.NaN })).toContain("InvalidVoxelSize");
    expect(issueCodes({ ...valid, cellDimensions: { x: 31, y: 64, z: 32 } })).toContain("InvalidDimensions");
    expect(issueCodes({ ...valid, sampleDimensions: { x: 35, y: 66, z: 35 } })).toContain("InvalidDimensions");
    expect(issueCodes({ ...valid, layoutVersion: "voxel-brick-v2" })).toContain("InvalidLayoutVersion");
    expect(issueCodes({ ...valid, indexOrder: "ZFastest" })).toContain("InvalidIndexOrder");
    expect(issueCodes({ ...valid, sourceRevision: -1 })).toContain("InvalidRevision");
    expect(issueCodes({ ...valid, editRevision: 1 })).toContain("InvalidRevision");
    expect(issueCodes({ ...valid, densityBuffer: new Float32Array(3) })).toContain("InvalidChannelLength");
    expect(issueCodes({ ...valid, densityBuffer: new Float64Array(VOXEL_BRICK_SAMPLE_COUNT) })).toContain("InvalidChannelType");
    expect(issueCodes({ ...valid, materialBuffer: new Uint8Array(3) })).toContain("InvalidChannelLength");

    const nonFinite = brickInput();
    nonFinite.densityBuffer[10] = Number.POSITIVE_INFINITY;
    expect(issueCodes(nonFinite)).toContain("NonFiniteDensity");
    expect(() => createVoxelBrick(nonFinite)).toThrow(VoxelContractError);
  });

  it("treats negative and zero density as solid and rejects nonfinite density", () => {
    expect(isSolidDensity(-12.5)).toBe(true);
    expect(isSolidDensity(-0)).toBe(true);
    expect(isSolidDensity(0)).toBe(true);
    expect(isSolidDensity(Number.MIN_VALUE)).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => isSolidDensity(value)).toThrow(VoxelContractError);
    }
  });

  it("rejects a forged version-matching registry before it can authorize channel IDs", () => {
    const forgedRegistry = {
      version: HESTIA_MATERIAL_REGISTRY_V1.version,
      definitions: HESTIA_MATERIAL_REGISTRY_V1.definitions.map((definition, index) =>
        index === 4 ? { ...definition, id: 5 } : definition
      )
    } as unknown as VoxelMaterialRegistry;
    const input = brickInput();
    input.materialBuffer[0] = 5;
    const validation = validateVoxelBrickInput(input, forgedRegistry);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.issues.map((issue) => issue.code)).toContain("InvalidMaterialRegistry");
      expect(validation.issues.map((issue) => issue.code)).toContain("InvalidMaterialId");
    }
    expect(() => createVoxelBrick(input, forgedRegistry)).toThrow(VoxelContractError);
  });

  it("serializes and hashes equivalent inputs identically and contract changes differently", () => {
    const first = brickInput();
    first.densityBuffer[123] = -0.25;
    first.materialBuffer[123] = 3;
    const equivalent = brickInput();
    equivalent.densityBuffer[123] = -0.25;
    equivalent.materialBuffer[123] = 3;

    expect(serializeCanonicalVoxelBrick(first)).toEqual(serializeCanonicalVoxelBrick(equivalent));
    expect(calculateVoxelBrickContentHash(first)).toBe(calculateVoxelBrickContentHash(equivalent));
    expect(calculateVoxelBrickContentHash({ ...equivalent, voxelSizeMeters: 0.25 })).not.toBe(
      calculateVoxelBrickContentHash(first)
    );
    equivalent.materialBuffer[123] = 4;
    expect(calculateVoxelBrickContentHash(equivalent)).not.toBe(calculateVoxelBrickContentHash(first));

    const brick = createVoxelBrick(first);
    brick.densityBuffer[0] = -1;
    const validation = validateVoxelBrick(brick);
    expect(validation.valid).toBe(false);
    if (!validation.valid) expect(validation.issues.map((issue) => issue.code)).toContain("ContentHashMismatch");
  });

  it("matches the independently established canonical little-endian serialization and FNV-1a vector", () => {
    const input = brickInput();
    input.densityBuffer[0] = -1.5;
    input.densityBuffer[1] = 0.25;
    input.densityBuffer[2] = 12.5;
    input.materialBuffer[0] = 4;
    input.materialBuffer[1] = 3;
    input.materialBuffer[VOXEL_BRICK_SAMPLE_COUNT - 1] = 2;

    const bytes = serializeCanonicalVoxelBrick(input);
    const prefix = "weltraum-voxel-brick-v1\n";
    expect(new TextDecoder().decode(bytes.subarray(0, prefix.length))).toBe(prefix);
    expect(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(prefix.length, true)).toBe(538);
    const densityOffset = prefix.length + 4 + 538;
    expect(new TextDecoder().decode(bytes.subarray(prefix.length + 4, densityOffset))).toContain(
      '\"density\":{\"format\":\"Float32LE\",\"elementCount\":82075}'
    );
    expect(Array.from(bytes.subarray(densityOffset, densityOffset + 12))).toEqual([
      0x00, 0x00, 0xc0, 0xbf,
      0x00, 0x00, 0x80, 0x3e,
      0x00, 0x00, 0x48, 0x41
    ]);
    expect(bytes[densityOffset + VOXEL_DENSITY_BYTES]).toBe(4);
    expect(bytes[bytes.length - 1]).toBe(2);

    // Fixed independently with a Python struct/JSON FNV-1a oracle, not this production hash function.
    expect(calculateVoxelBrickContentHash(input)).toBe("fnv1a64:bf8d9fba62147aa1");
  });
});
