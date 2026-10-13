import { VOXEL_BRICK_CELL_DIMENSIONS, type VoxelMaterialId } from "../../voxel";
import {
  createHestiaFieldContext,
  sampleHestiaDensityFields,
  sampleHestiaSurfaceFields
} from "./densityGenerator";
import { classifyHestiaMaterial } from "./materialClassifier";
import {
  HESTIA_MATERIAL_IDS,
  HESTIA_SCATTER_SPACING_METERS,
  type HestiaGenerationInput
} from "./preset";
import {
  assertHestiaGenerationInput,
  createHestiaSeedSet,
  hestiaSeedHex,
  hestiaUnitFloat
} from "./seed";

export type HestiaScatterKind = "black_trunk" | "cyan_luminous_sprout" | "cyan_luminous_cap";

export interface HestiaScatterRecord {
  readonly id: string;
  readonly kind: HestiaScatterKind;
  readonly positionMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly yawRadians: number;
  readonly uniformScale: number;
  readonly surfaceMaterialId: VoxelMaterialId;
  readonly sourceAnchorGlobal: Readonly<{ x: number; z: number }>;
}

/** @internal Pure V1 policy seam; intentionally excluded from the public Hestia barrel. */
export const hestiaScatterAcceptanceThreshold = (materialId: VoxelMaterialId): number | undefined => {
  if (materialId === HESTIA_MATERIAL_IDS.WetSoil) return 0.18;
  if (materialId === HESTIA_MATERIAL_IDS.MossCover) return 0.28;
  if (materialId === HESTIA_MATERIAL_IDS.DenseBiologicalSurface) return 0.42;
  return undefined;
};

const scatterKind = (selector: number): HestiaScatterKind => {
  if (selector < 0.55) return "black_trunk";
  if (selector < 0.85) return "cyan_luminous_sprout";
  return "cyan_luminous_cap";
};

const freezeRecord = (record: HestiaScatterRecord): HestiaScatterRecord => Object.freeze({
  ...record,
  positionMeters: Object.freeze({ ...record.positionMeters }),
  sourceAnchorGlobal: Object.freeze({ ...record.sourceAnchorGlobal })
});

/** Reconstructs neutral V1 presentation scatter; it never changes VoxelBrick bytes. */
export const generateHestiaScatter = (
  input: HestiaGenerationInput
): readonly HestiaScatterRecord[] => {
  assertHestiaGenerationInput(input);
  const strideCells = HESTIA_SCATTER_SPACING_METERS / input.voxelSizeMeters;
  const minX = input.brickCoordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x;
  const maxX = minX + VOXEL_BRICK_CELL_DIMENSIONS.x;
  const minZ = input.brickCoordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z;
  const maxZ = minZ + VOXEL_BRICK_CELL_DIMENSIONS.z;
  if (![minX, maxX, minZ, maxZ].every(Number.isSafeInteger)) {
    throw new RangeError("brickCoordinate produces unsafe scatter ownership bounds");
  }
  const firstX = Math.ceil(minX / strideCells) * strideCells;
  const firstZ = Math.ceil(minZ / strideCells) * strideCells;
  const seeds = createHestiaSeedSet(input);
  const context = createHestiaFieldContext(input);
  const seedHex = hestiaSeedHex(seeds.scatterAccept);
  const jitterLimit = HESTIA_SCATTER_SPACING_METERS * 0.35;
  const records: HestiaScatterRecord[] = [];

  for (let anchorZ = firstZ; anchorZ < maxZ; anchorZ += strideCells) {
    for (let anchorX = firstX; anchorX < maxX; anchorX += strideCells) {
      const jitterX = (hestiaUnitFloat(seeds.scatterJitter, anchorX, anchorZ, 0) * 2 - 1) * jitterLimit;
      const jitterZ = (hestiaUnitFloat(seeds.scatterJitter, anchorX, anchorZ, 1) * 2 - 1) * jitterLimit;
      const xMeters = anchorX * input.voxelSizeMeters + jitterX;
      const zMeters = anchorZ * input.voxelSizeMeters + jitterZ;
      const surface = sampleHestiaSurfaceFields(context, xMeters, zMeters);
      let yMeters = surface.surfaceHeight;
      for (let iteration = 0; iteration < 4; iteration += 1) {
        const solved = sampleHestiaDensityFields(context, xMeters, yMeters, zMeters, surface);
        yMeters = surface.surfaceHeight - solved.rockBreakup;
      }
      const fields = sampleHestiaDensityFields(context, xMeters, yMeters, zMeters, surface);
      const materialId = classifyHestiaMaterial({
        yMeters,
        density: fields.density,
        surfaceHeight: fields.surfaceHeight,
        rockBreakup: fields.rockBreakup,
        wetDepression: fields.wetDepression,
        biological: fields.biological
      });
      const threshold = hestiaScatterAcceptanceThreshold(materialId);
      if (threshold === undefined || hestiaUnitFloat(seeds.scatterAccept, anchorX, anchorZ) >= threshold) continue;

      records.push(freezeRecord({
        id: `hestia.scatter.v1:${seedHex}:${anchorX}:${anchorZ}`,
        kind: scatterKind(hestiaUnitFloat(seeds.scatterKind, anchorX, anchorZ)),
        positionMeters: { x: xMeters, y: yMeters, z: zMeters },
        yawRadians: Math.PI * 2 * hestiaUnitFloat(seeds.scatterYaw, anchorX, anchorZ),
        uniformScale: 0.8 + 0.55 * hestiaUnitFloat(seeds.scatterScale, anchorX, anchorZ),
        surfaceMaterialId: materialId,
        sourceAnchorGlobal: { x: anchorX, z: anchorZ }
      }));
    }
  }

  records.sort((left, right) =>
    left.sourceAnchorGlobal.z - right.sourceAnchorGlobal.z
    || left.sourceAnchorGlobal.x - right.sourceAnchorGlobal.x
    || left.id.localeCompare(right.id)
  );
  return Object.freeze(records);
};
