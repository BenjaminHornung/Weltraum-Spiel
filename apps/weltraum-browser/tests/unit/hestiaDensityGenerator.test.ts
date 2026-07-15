import { describe, expect, it } from "vitest";
import {
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_SAMPLE_COUNT,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  isSolidDensity,
  surfaceFrameId,
  validateVoxelBrick,
  voxelBodyId,
  voxelRegionId,
  voxelSampleIndex,
  type VoxelCoordinate
} from "../../src/voxel";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_MATERIAL_IDS,
  classifyHestiaMaterial,
  createHestiaFieldContext,
  generateHestiaVoxelBrick,
  sampleHestiaDensityFields,
  sampleHestiaSurfaceFields,
  type HestiaGenerationInput,
  type HestiaSurfaceFields
} from "../../src/world-generation/hestia";

const input = (brickCoordinate: VoxelCoordinate = { x: 0, y: -1, z: 0 }): HestiaGenerationInput => ({
  rootSeed: "hestia-fixture-alpha",
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
  regionId: voxelRegionId("region:hestia.preview"),
  brickCoordinate,
  voxelSizeMeters: 0.5
});

const SURFACE_FIELD_NAMES = [
  "warpedX",
  "warpedZ",
  "macroElevation",
  "islandMask",
  "ridge",
  "erosion",
  "wetDepression",
  "biological",
  "surfaceHeight"
] as const satisfies readonly (keyof HestiaSurfaceFields)[];

const densityBits = (channel: Float32Array, index: number): number =>
  new DataView(channel.buffer, channel.byteOffset, channel.byteLength).getUint32(index * 4, true);

describe("Hestia V1 density and material generation", () => {
  it("returns a strictly validated exact-size VoxelBrick with finite canonical channels", () => {
    const brick = generateHestiaVoxelBrick(input());
    expect(validateVoxelBrick(brick)).toEqual({ valid: true });
    expect(brick.cellDimensions).toEqual({ x: 32, y: 64, z: 32 });
    expect(brick.sampleDimensions).toEqual({ x: 35, y: 67, z: 35 });
    expect(brick.densityBuffer).toBeInstanceOf(Float32Array);
    expect(brick.materialBuffer).toBeInstanceOf(Uint8Array);
    expect(brick.densityBuffer).toHaveLength(VOXEL_BRICK_SAMPLE_COUNT);
    expect(brick.materialBuffer).toHaveLength(VOXEL_BRICK_SAMPLE_COUNT);
    expect(brick.generatorVersion).toBe(HESTIA_GENERATOR_VERSION_V1);
    expect(brick.sourceRevision).toBe(0);
    expect(brick.editRevision).toBe(0);
    expect(Array.from(brick.densityBuffer).every(Number.isFinite)).toBe(true);
    expect(Array.from(brick.materialBuffer).every((value) => value >= 0 && value <= 4)).toBe(true);
    expect(brick.densityBuffer.some((value) => isSolidDensity(value))).toBe(true);
    expect(brick.densityBuffer.some((value) => !isSolidDensity(value))).toBe(true);
  });

  it("pins the V1 field equations at a non-lattice surface-local point", () => {
    const context = createHestiaFieldContext(input());
    const surface = sampleHestiaSurfaceFields(context, 12.75, -8.5);
    const fields = sampleHestiaDensityFields(context, 12.75, 3.25, -8.5, surface);
    const vector = {
      warpedX: surface.warpedX,
      warpedZ: surface.warpedZ,
      macroElevation: surface.macroElevation,
      islandMask: surface.islandMask,
      ridge: surface.ridge,
      erosion: surface.erosion,
      wetDepression: surface.wetDepression,
      biological: surface.biological,
      surfaceHeight: surface.surfaceHeight,
      rockBreakup: fields.rockBreakup,
      density: fields.density
    };
    // V1 equation drift guard: changing any frequency, coefficient, seed domain,
    // interpolation rule, or Float32 density assignment changes this vector.
    expect(vector).toEqual({
      warpedX: 19.382478580308327,
      warpedZ: -16.003253269608457,
      macroElevation: -0.37147323711261315,
      islandMask: 0,
      ridge: 0.11758994762423589,
      erosion: 0.0036969700213794437,
      wetDepression: 0,
      biological: 0.4838185376849856,
      surfaceHeight: -6.127577650545675,
      rockBreakup: -0.8587909666029567,
      density: 8.518786430358887
    });
  });

  it.each(SURFACE_FIELD_NAMES)("fails closed for malformed cached surface field %s", (fieldName) => {
    const context = createHestiaFieldContext(input());
    const valid = sampleHestiaSurfaceFields(context, 12.75, -8.5);
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined]) {
      const malformed = { ...valid, [fieldName]: invalid } as HestiaSurfaceFields;
      expect(
        () => sampleHestiaDensityFields(context, 12.75, 3.25, -8.5, malformed),
        `${fieldName} must reject ${String(invalid)}`
      ).toThrow(new RegExp(`surfaceFields\\.${fieldName} must be finite`));
    }
  });

  it("fails closed for malformed cached surface-field structure", () => {
    const context = createHestiaFieldContext(input());
    for (const malformed of [null, [], "surface"] as const) {
      expect(() => sampleHestiaDensityFields(
        context,
        12.75,
        3.25,
        -8.5,
        malformed as unknown as HestiaSurfaceFields
      )).toThrow(TypeError);
    }
  });

  it("applies all five exact material IDs in normative priority order", () => {
    expect(HESTIA_MATERIAL_IDS).toEqual({
      SolidRock: 0,
      WetSoil: 1,
      MossCover: 2,
      DenseBiologicalSurface: 3,
      ShallowWaterBoundary: 4
    });
    const base = {
      yMeters: 5,
      density: 3,
      surfaceHeight: 5,
      rockBreakup: 0,
      wetDepression: 0,
      biological: 0
    };
    expect(classifyHestiaMaterial({ ...base, yMeters: 0.5, density: 1, surfaceHeight: 10, rockBreakup: 1 }))
      .toBe(HESTIA_MATERIAL_IDS.ShallowWaterBoundary);
    expect(classifyHestiaMaterial({ ...base, yMeters: 1, surfaceHeight: 4 }))
      .toBe(HESTIA_MATERIAL_IDS.SolidRock);
    expect(classifyHestiaMaterial({ ...base, wetDepression: 0.58 }))
      .toBe(HESTIA_MATERIAL_IDS.WetSoil);
    expect(classifyHestiaMaterial({ ...base, density: 1.25, biological: 0.58 }))
      .toBe(HESTIA_MATERIAL_IDS.DenseBiologicalSurface);
    expect(classifyHestiaMaterial(base)).toBe(HESTIA_MATERIAL_IDS.MossCover);
    expect(() => classifyHestiaMaterial({ ...base, density: Number.NaN })).toThrow(RangeError);
  });

  it("generates deterministic hashes and byte-identical stored apron samples across X, Y, and Z neighbors", () => {
    const originCoordinate: VoxelCoordinate = { x: 0, y: -1, z: 0 };
    const origin = generateHestiaVoxelBrick(input(originCoordinate));
    for (const axis of ["x", "y", "z"] as const) {
      const neighborCoordinate: VoxelCoordinate = {
        ...originCoordinate,
        [axis]: originCoordinate[axis] + 1
      };
      const neighbor = generateHestiaVoxelBrick(input(neighborCoordinate));
      const repeatedNeighbor = generateHestiaVoxelBrick(input(neighborCoordinate));
      expect(neighbor.contentHash).toBe(repeatedNeighbor.contentHash);
      expect(neighbor.contentHash).not.toBe(origin.contentHash);

      for (let z = 0; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z; z += 1) {
        for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
          for (let x = 0; x < VOXEL_BRICK_SAMPLE_DIMENSIONS.x; x += 1) {
            const originStored = { x, y, z };
            if (originStored[axis] < VOXEL_BRICK_CELL_DIMENSIONS[axis]) continue;
            const neighborStored = {
              ...originStored,
              [axis]: originStored[axis] - VOXEL_BRICK_CELL_DIMENSIONS[axis]
            };
            const originIndex = voxelSampleIndex(originStored);
            const neighborIndex = voxelSampleIndex(neighborStored);
            expect(densityBits(origin.densityBuffer, originIndex)).toBe(
              densityBits(neighbor.densityBuffer, neighborIndex)
            );
            expect(origin.materialBuffer[originIndex]).toBe(neighbor.materialBuffer[neighborIndex]);
          }
        }
      }
    }
  });
});
