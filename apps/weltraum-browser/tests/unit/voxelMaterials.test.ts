import { describe, expect, it } from "vitest";
import {
  HESTIA_MATERIAL_REGISTRY_V1,
  VOXEL_BRICK_SAMPLE_COUNT,
  VoxelContractError,
  createVoxelMaterialRegistry,
  validateMaterialChannel,
  validateVoxelMaterialId,
  validateVoxelMaterialRegistry,
  voxelMaterialDefinition,
  voxelMaterialId,
  type VoxelMaterialRegistry
} from "../../src/voxel";

const definitions = [
  { id: 0, key: "dark_rock", semantic: "SolidRock" },
  { id: 1, key: "wet_soil", semantic: "WetSoil" },
  { id: 2, key: "moss", semantic: "MossCover" },
  { id: 3, key: "dense_biological_surface", semantic: "DenseBiologicalSurface" },
  { id: 4, key: "shallow_water_boundary", semantic: "ShallowWaterBoundary" }
] as const;

const codes = (value: unknown): readonly string[] => {
  const result = validateVoxelMaterialRegistry(value);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
};

describe("VoxelBrick V1 material registry", () => {
  it("publishes the canonical renderer-neutral Hestia IDs and semantics", () => {
    expect(HESTIA_MATERIAL_REGISTRY_V1.version).toBe("hestia.materials.v1");
    expect(HESTIA_MATERIAL_REGISTRY_V1.definitions).toEqual(definitions);
    expect(voxelMaterialDefinition(HESTIA_MATERIAL_REGISTRY_V1, voxelMaterialId(4))).toEqual(definitions[4]);
    expect(Object.isFrozen(HESTIA_MATERIAL_REGISTRY_V1)).toBe(true);
    expect(Object.isFrozen(HESTIA_MATERIAL_REGISTRY_V1.definitions)).toBe(true);
    for (const definition of HESTIA_MATERIAL_REGISTRY_V1.definitions) {
      expect(Object.keys(definition).sort()).toEqual(["id", "key", "semantic"]);
    }
  });

  it("canonicalizes equivalent definition order deterministically", () => {
    const reversed = createVoxelMaterialRegistry({
      version: "hestia.materials.v1",
      definitions: [...definitions].reverse()
    });
    expect(reversed).toEqual(HESTIA_MATERIAL_REGISTRY_V1);
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(HESTIA_MATERIAL_REGISTRY_V1));
  });

  it("rejects invalid and duplicate material definitions explicitly", () => {
    const duplicateId = definitions.map((definition, index) => index === 1 ? { ...definition, id: 0 } : definition);
    const duplicateKey = definitions.map((definition, index) => index === 1 ? { ...definition, key: "dark_rock" } : definition);
    const invalidId = definitions.map((definition, index) => index === 0 ? { ...definition, id: 256 } : definition);
    const invalidSemantic = definitions.map((definition, index) =>
      index === 0 ? { ...definition, semantic: "ColorProfile" } : definition
    );
    expect(codes({ version: "hestia.materials.v1", definitions: duplicateId }))
      .toContain("DuplicateMaterialId");
    expect(codes({ version: "hestia.materials.v1", definitions: duplicateKey }))
      .toContain("DuplicateMaterialKey");
    expect(codes({ version: "hestia.materials.v1", definitions: invalidId }))
      .toContain("InvalidMaterialId");
    expect(codes({ version: "hestia.materials.v1", definitions: invalidSemantic }))
      .toContain("InvalidMaterialRegistry");
    const sparse = [...definitions] as unknown[];
    delete sparse[2];
    expect(codes({ version: "hestia.materials.v1", definitions: sparse })).toContain("InvalidMaterialRegistry");
    expect(() => createVoxelMaterialRegistry({
      version: "hestia.materials.v1",
      definitions: duplicateId
    })).toThrow(VoxelContractError);
  });

  it("rejects every malformed public material ID without coercion", () => {
    for (const value of [-0, 0.5, -1, 256, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const validation = validateVoxelMaterialId(value);
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.issues.map((issue) => issue.code)).toContain("InvalidMaterialId");
      expect(() => voxelMaterialId(value)).toThrow(RangeError);
    }
  });

  it("validates channel width, length, and registry membership without coercion", () => {
    const valid = new Uint8Array(VOXEL_BRICK_SAMPLE_COUNT);
    valid[100] = 4;
    expect(validateMaterialChannel(valid, VOXEL_BRICK_SAMPLE_COUNT)).toEqual({ valid: true });

    const unknown = new Uint8Array(valid);
    unknown[100] = 5;
    const unknownResult = validateMaterialChannel(unknown, VOXEL_BRICK_SAMPLE_COUNT);
    expect(unknownResult.valid).toBe(false);
    if (!unknownResult.valid) expect(unknownResult.issues.map((issue) => issue.code)).toContain("InvalidMaterialId");

    const wrongType = validateMaterialChannel(new Uint16Array(VOXEL_BRICK_SAMPLE_COUNT), VOXEL_BRICK_SAMPLE_COUNT);
    expect(wrongType.valid).toBe(false);
    if (!wrongType.valid) expect(wrongType.issues.map((issue) => issue.code)).toContain("InvalidChannelType");

    const forgedRegistry = {
      version: HESTIA_MATERIAL_REGISTRY_V1.version,
      definitions: definitions.map((definition, index) => index === 4 ? { ...definition, id: 5 } : definition)
    } as unknown as VoxelMaterialRegistry;
    const forgedChannel = new Uint8Array(VOXEL_BRICK_SAMPLE_COUNT);
    forgedChannel[100] = 5;
    const forgedResult = validateMaterialChannel(forgedChannel, VOXEL_BRICK_SAMPLE_COUNT, forgedRegistry);
    expect(forgedResult.valid).toBe(false);
    if (!forgedResult.valid) {
      expect(forgedResult.issues.map((issue) => issue.code)).toContain("InvalidMaterialRegistry");
    }
    expect(() => voxelMaterialDefinition(forgedRegistry, voxelMaterialId(0))).toThrow(VoxelContractError);
  });
});
