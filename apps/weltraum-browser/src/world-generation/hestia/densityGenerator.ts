import {
  HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_INDEX_ORDER,
  VOXEL_BRICK_LAYOUT_VERSION,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  VOXEL_BRICK_SCHEMA_VERSION,
  allocateVoxelChannels,
  createVoxelBrick,
  globalSamplePositionMeters,
  storedSampleToGlobalCoordinate,
  voxelSampleIndex,
  type VoxelBrick
} from "../../voxel";
import { classifyHestiaMaterial } from "./materialClassifier";
import { fbm2, fbm3, ridgedNoise2, valueNoise2 } from "./noise";
import {
  HESTIA_EDIT_REVISION_V1,
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SEA_LEVEL_METERS,
  HESTIA_SOURCE_REVISION_V1,
  type HestiaGenerationInput
} from "./preset";
import { assertHestiaGenerationInput, createHestiaSeedSet, type HestiaSeedSet } from "./seed";

export interface HestiaSurfaceFields {
  readonly warpedX: number;
  readonly warpedZ: number;
  readonly macroElevation: number;
  readonly islandMask: number;
  readonly ridge: number;
  readonly erosion: number;
  readonly wetDepression: number;
  readonly biological: number;
  readonly surfaceHeight: number;
}

export interface HestiaDensityFields extends HestiaSurfaceFields {
  readonly rockBreakup: number;
  readonly density: number;
}

export interface HestiaFieldContext {
  readonly seeds: HestiaSeedSet;
}

export interface HestiaVoxelBrickSliceOptions {
  readonly columnsPerSlice: number;
  readonly checkpoint: () => void | Promise<void>;
}

const HESTIA_SURFACE_FIELD_KEYS = Object.freeze([
  "warpedX",
  "warpedZ",
  "macroElevation",
  "islandMask",
  "ridge",
  "erosion",
  "wetDepression",
  "biological",
  "surfaceHeight"
] as const satisfies readonly (keyof HestiaSurfaceFields)[]);

const requireFinitePosition = (x: number, y: number, z: number): void => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError("Hestia field coordinates must be finite");
  }
};

const requireFiniteSurfaceFields = (value: HestiaSurfaceFields): void => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("surfaceFields must be a HestiaSurfaceFields object");
  }
  const candidate = value as unknown as Record<string, unknown>;
  for (const key of HESTIA_SURFACE_FIELD_KEYS) {
    const field = candidate[key];
    if (typeof field !== "number" || !Number.isFinite(field)) {
      throw new RangeError(`surfaceFields.${key} must be finite`);
    }
  }
};

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
};

export const createHestiaFieldContext = (input: HestiaGenerationInput): HestiaFieldContext => {
  assertHestiaGenerationInput(input);
  return Object.freeze({ seeds: createHestiaSeedSet(input) });
};

export const sampleHestiaSurfaceFields = (
  context: HestiaFieldContext,
  xMeters: number,
  zMeters: number
): HestiaSurfaceFields => {
  requireFinitePosition(xMeters, 0, zMeters);
  const warpX = 18 * fbm2(context.seeds.domainWarpX, xMeters * 0.0075, zMeters * 0.0075, 3);
  const warpZ = 18 * fbm2(context.seeds.domainWarpZ, xMeters * 0.0075, zMeters * 0.0075, 3);
  const warpedX = xMeters + warpX;
  const warpedZ = zMeters + warpZ;
  const macroElevation = fbm2(context.seeds.macroElevation, warpedX * 0.01, warpedZ * 0.01, 4);
  const islandNoise = fbm2(context.seeds.islandRidge, warpedX * 0.0065, warpedZ * 0.0065, 3);
  const islandMask = smoothstep(0.38, 0.72, 0.5 + 0.5 * islandNoise);
  const ridge = ridgedNoise2(context.seeds.islandRidge, warpedX * 0.014, warpedZ * 0.014);
  // V1 intentionally reuses the island/ridge domain for the erosion-like layer;
  // no unversioned extra seed domain is introduced.
  const erosion = fbm2(context.seeds.islandRidge, warpedX * 0.03, warpedZ * 0.03, 3);
  const wetDepression = smoothstep(
    0.58,
    0.82,
    0.5 + 0.5 * valueNoise2(context.seeds.wetDepressions, warpedX * 0.018, warpedZ * 0.018)
  );
  const biological = 0.5 + 0.5 * fbm2(
    context.seeds.materialBiological,
    warpedX * 0.08,
    warpedZ * 0.08,
    3
  );
  const surfaceHeight = HESTIA_SEA_LEVEL_METERS - 5
    + 14 * islandMask
    + 4 * macroElevation
    + 3 * ridge
    + 1.5 * erosion
    - 2.5 * wetDepression;
  if (![warpedX, warpedZ, macroElevation, islandMask, ridge, erosion, wetDepression, biological, surfaceHeight]
    .every(Number.isFinite)) {
    throw new RangeError("Hestia surface field produced a non-finite result");
  }
  return { warpedX, warpedZ, macroElevation, islandMask, ridge, erosion, wetDepression, biological, surfaceHeight };
};

export const sampleHestiaDensityFields = (
  context: HestiaFieldContext,
  xMeters: number,
  yMeters: number,
  zMeters: number,
  surfaceFields: HestiaSurfaceFields = sampleHestiaSurfaceFields(context, xMeters, zMeters)
): HestiaDensityFields => {
  requireFinitePosition(xMeters, yMeters, zMeters);
  requireFiniteSurfaceFields(surfaceFields);
  const rockBreakup = 1.4 * fbm3(
    context.seeds.rockBreakup,
    surfaceFields.warpedX * 0.055,
    yMeters * 0.055,
    surfaceFields.warpedZ * 0.055,
    3
  );
  const density = Math.fround(yMeters - surfaceFields.surfaceHeight + rockBreakup);
  if (!Number.isFinite(rockBreakup) || !Number.isFinite(density)) {
    throw new RangeError("Hestia density field produced a non-finite result");
  }
  return { ...surfaceFields, rockBreakup, density };
};

class HestiaVoxelBrickGenerationSession {
  readonly #context: HestiaFieldContext;
  readonly #channels = allocateVoxelChannels();
  #nextColumn = 0;

  public constructor(private readonly input: HestiaGenerationInput) {
    assertHestiaGenerationInput(input);
    this.#context = createHestiaFieldContext(input);
  }

  public generateColumns(maximumColumns: number): boolean {
    if (!Number.isSafeInteger(maximumColumns) || maximumColumns <= 0) {
      throw new RangeError("maximumColumns must be a positive safe integer");
    }
    const columnCount = VOXEL_BRICK_SAMPLE_DIMENSIONS.x * VOXEL_BRICK_SAMPLE_DIMENSIONS.z;
    const stopColumn = Math.min(columnCount, this.#nextColumn + maximumColumns);
    while (this.#nextColumn < stopColumn) {
      const z = Math.floor(this.#nextColumn / VOXEL_BRICK_SAMPLE_DIMENSIONS.x);
      const x = this.#nextColumn - z * VOXEL_BRICK_SAMPLE_DIMENSIONS.x;
      const referenceGlobal = storedSampleToGlobalCoordinate(this.input.brickCoordinate, { x, y: 0, z });
      const xzPosition = globalSamplePositionMeters(referenceGlobal, this.input.voxelSizeMeters);
      const surface = sampleHestiaSurfaceFields(this.#context, xzPosition.x, xzPosition.z);
      for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
        const global = storedSampleToGlobalCoordinate(this.input.brickCoordinate, { x, y, z });
        const position = globalSamplePositionMeters(global, this.input.voxelSizeMeters);
        const fields = sampleHestiaDensityFields(this.#context, position.x, position.y, position.z, surface);
        const index = voxelSampleIndex({ x, y, z });
        this.#channels.densityBuffer[index] = fields.density;
        this.#channels.materialBuffer[index] = classifyHestiaMaterial({
          yMeters: position.y,
          density: fields.density,
          surfaceHeight: fields.surfaceHeight,
          rockBreakup: fields.rockBreakup,
          wetDepression: fields.wetDepression,
          biological: fields.biological
        });
      }
      this.#nextColumn += 1;
    }
    return this.#nextColumn === columnCount;
  }

  public complete(): VoxelBrick {
    if (this.#nextColumn !== VOXEL_BRICK_SAMPLE_DIMENSIONS.x * VOXEL_BRICK_SAMPLE_DIMENSIONS.z) {
      throw new RangeError("Hestia voxel generation is incomplete");
    }
    return createVoxelBrick({
      schemaVersion: VOXEL_BRICK_SCHEMA_VERSION,
      layoutVersion: VOXEL_BRICK_LAYOUT_VERSION,
      indexOrder: VOXEL_BRICK_INDEX_ORDER,
      bodyId: this.input.bodyId,
      surfaceFrameId: this.input.surfaceFrameId,
      regionId: this.input.regionId,
      brickCoordinate: this.input.brickCoordinate,
      voxelSizeMeters: this.input.voxelSizeMeters,
      cellDimensions: VOXEL_BRICK_CELL_DIMENSIONS,
      sampleDimensions: VOXEL_BRICK_SAMPLE_DIMENSIONS,
      apronWidth: VOXEL_BRICK_APRON_WIDTH,
      generatorVersion: HESTIA_GENERATOR_VERSION_V1,
      materialRegistryVersion: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
      sourceRevision: HESTIA_SOURCE_REVISION_V1,
      editRevision: HESTIA_EDIT_REVISION_V1,
      densityBuffer: this.#channels.densityBuffer,
      materialBuffer: this.#channels.materialBuffer
    });
  }
}

/** Generates and validates the exact 35x67x35 canonical VoxelBrick channels. */
export const generateHestiaVoxelBrick = (input: HestiaGenerationInput): VoxelBrick => {
  const session = new HestiaVoxelBrickGenerationSession(input);
  session.generateColumns(VOXEL_BRICK_SAMPLE_DIMENSIONS.x * VOXEL_BRICK_SAMPLE_DIMENSIONS.z);
  return session.complete();
};

/** Uses the same canonical session as the synchronous API while exposing bounded cooperative checkpoints. */
export const generateHestiaVoxelBrickInSlices = async (
  input: HestiaGenerationInput,
  options: HestiaVoxelBrickSliceOptions
): Promise<VoxelBrick> => {
  if (!Number.isSafeInteger(options.columnsPerSlice) || options.columnsPerSlice <= 0) {
    throw new RangeError("columnsPerSlice must be a positive safe integer");
  }
  if (typeof options.checkpoint !== "function") throw new TypeError("checkpoint must be a function");
  const session = new HestiaVoxelBrickGenerationSession(input);
  while (!session.generateColumns(options.columnsPerSlice)) await options.checkpoint();
  return session.complete();
};
