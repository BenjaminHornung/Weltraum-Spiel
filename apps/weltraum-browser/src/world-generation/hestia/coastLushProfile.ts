import { fbm2, fbm3, ridgedFbm2, valueNoise2 } from "./noise";
import type { HestiaSeedSet } from "./seed";

export interface HestiaCoastLushSurfaceFields {
  readonly warpX: number;
  readonly warpZ: number;
  readonly warpedX: number;
  readonly warpedZ: number;
  readonly macroElevation: number;
  readonly ridgeNoise: number;
  readonly wetDepression: number;
  readonly biological: number;
  readonly shelfMask: number;
  readonly corridorMask: number;
  readonly basinMask: number;
  readonly overlookMask: number;
  readonly ridgeNorthMask: number;
  readonly ridgeWestMask: number;
  readonly ridgeSouthMask: number;
  readonly ridgeMask: number;
  readonly stepOuterMask: number;
  readonly stepMiddleMask: number;
  readonly stepInnerMask: number;
  readonly stepMask: number;
  readonly wetFoldMask: number;
  readonly surfaceHeight: number;
}

export interface HestiaCoastLushDensityFields {
  readonly rockBreakup: number;
  readonly density: number;
}

export type HestiaCoastLushMaterialSemantic =
  | "ShallowWaterBoundary"
  | "SolidRock"
  | "WetSoil"
  | "DenseBiologicalSurface"
  | "MossCover";

export interface HestiaCoastLushMaterialSample {
  readonly yMeters: number;
  readonly density: number;
  readonly surfaceHeight: number;
  readonly fields: HestiaCoastLushSurfaceFields;
}

export interface HestiaCoastLushScatterPolicy {
  readonly acceptanceThreshold: number;
  readonly sproutThreshold: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const pointDistance = (x: number, z: number, centerX: number, centerZ: number): number =>
  Math.hypot(x - centerX, z - centerZ);

const segmentDistance = (
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): number => {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const amount = clamp(((x - startX) * dx + (z - startZ) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - (startX + dx * amount), z - (startZ + dz * amount));
};

const mask = (distance: number, core: number, outer: number): number => {
  const amount = clamp((distance - core) / (outer - core), 0, 1);
  return 1 - amount * amount * (3 - 2 * amount);
};

const lerp = (left: number, right: number, amount: number): number =>
  left * (1 - amount) + right * amount;

export const sampleHestiaCoastLushSurfaceFields = (
  seeds: HestiaSeedSet,
  xMeters: number,
  zMeters: number
): HestiaCoastLushSurfaceFields => {
  const warpX = 1.25 * fbm2(seeds.domainWarpX, xMeters / 32, zMeters / 32, 2);
  const warpZ = 1.25 * fbm2(seeds.domainWarpZ, xMeters / 32, zMeters / 32, 2);
  const warpedX = xMeters + warpX;
  const warpedZ = zMeters + warpZ;
  const u = xMeters - 64;
  const v = -32 - zMeters;
  const px = u + warpX;
  const pz = v - warpZ;
  const macroElevation = fbm2(seeds.macroElevation, warpedX / 24, warpedZ / 24, 3);
  const ridgeNoise = 2 * ridgedFbm2(seeds.islandRidge, warpedX / 14, warpedZ / 14, 2) - 1;
  const wetDepression = 0.5 + 0.5 * valueNoise2(seeds.wetDepressions, warpedX / 12, warpedZ / 12);
  const biological = 0.5 + 0.5 * fbm2(seeds.materialBiological, warpedX / 8, warpedZ / 8, 3);
  const shelfMask = mask(pointDistance(u, v, 0, 0), 8, 13);
  const corridorMask = mask(segmentDistance(u, v, 0, -6, 0, 18), 2.25, 3.75);
  const baseBasinMask = mask(segmentDistance(px, pz, 21, -17, 21, 17), 2, 20);
  const basinMask = baseBasinMask;
  const overlookMask = mask(pointDistance(u, v, 10, 5), 2, 9);
  const ridgeNorthMask = mask(segmentDistance(px, pz, -20, 27, 10, 27), 3, 10);
  const ridgeWestMask = mask(segmentDistance(px, pz, -28, -22, -28, 27), 2, 8);
  const ridgeSouthMask = mask(segmentDistance(px, pz, -22, -28, 20, -28), 2, 8);
  const ridgeMask = Math.max(ridgeNorthMask, ridgeWestMask, ridgeSouthMask);
  const stepOuterMask = mask(pointDistance(px, pz, -13, 2), 8.5, 10);
  const stepMiddleMask = mask(pointDistance(px, pz, -13, 2), 5.5, 7);
  const stepInnerMask = mask(pointDistance(px, pz, -13, 2), 2.5, 4);
  const stepMask = Math.max(stepOuterMask, stepMiddleMask, stepInnerMask);
  const wetFoldMask = mask(segmentDistance(px, pz, 7, 14, 14, -8), 1.5, 4);

  let surfaceHeight = 6.25 + 0.3 * macroElevation + 0.2 * ridgeNoise;
  surfaceHeight = lerp(surfaceHeight, -0.5, basinMask);
  surfaceHeight -= 1.1 * wetFoldMask;
  surfaceHeight += 2.5 * overlookMask;
  surfaceHeight += 0.35 * stepOuterMask;
  surfaceHeight += 0.35 * stepMiddleMask;
  surfaceHeight += 0.35 * stepInnerMask;
  surfaceHeight += 6.25 * ridgeMask;
  surfaceHeight = lerp(surfaceHeight, 8, shelfMask);
  surfaceHeight = lerp(surfaceHeight, 8 - 0.1 * clamp(v - 6, 0, 12), corridorMask);
  surfaceHeight = Math.max(0, surfaceHeight);

  return {
    warpX,
    warpZ,
    warpedX,
    warpedZ,
    macroElevation,
    ridgeNoise,
    wetDepression,
    biological,
    shelfMask,
    corridorMask,
    basinMask,
    overlookMask,
    ridgeNorthMask,
    ridgeWestMask,
    ridgeSouthMask,
    ridgeMask,
    stepOuterMask,
    stepMiddleMask,
    stepInnerMask,
    stepMask,
    wetFoldMask,
    surfaceHeight
  };
};

export const sampleHestiaCoastLushDensityFields = (
  seeds: HestiaSeedSet,
  yMeters: number,
  surface: HestiaCoastLushSurfaceFields
): HestiaCoastLushDensityFields => {
  const amplitude = 0.1
    * clamp(surface.surfaceHeight / 0.1, 0, 1)
    * (1 - Math.max(surface.shelfMask, surface.corridorMask));
  const rockBreakup = amplitude === 0
    ? 0
    : amplitude * fbm3(
        seeds.rockBreakup,
        surface.warpedX / 4,
        yMeters / 4,
        surface.warpedZ / 4,
        2
      );
  return {
    rockBreakup,
    density: Math.fround(yMeters - surface.surfaceHeight + rockBreakup)
  };
};

export const classifyHestiaCoastLushMaterialSemantic = (
  sample: HestiaCoastLushMaterialSample
): HestiaCoastLushMaterialSemantic => {
  if (Math.abs(sample.yMeters) <= 0.5 && Math.abs(sample.density) <= 0.75) {
    return "ShallowWaterBoundary";
  }
  if (
    sample.surfaceHeight - sample.yMeters >= 1.5
    || sample.fields.ridgeMask >= 0.55
    || sample.fields.stepMask >= 0.35
  ) {
    return "SolidRock";
  }
  if (
    Math.abs(sample.density) <= 1
    && (
      sample.fields.wetFoldMask >= 0.35
      || sample.fields.wetDepression >= 0.62
      || (sample.fields.basinMask >= 0.6 && sample.surfaceHeight <= 2)
    )
  ) {
    return "WetSoil";
  }
  if (Math.abs(sample.density) <= 1 && sample.fields.biological >= 0.56) {
    return "DenseBiologicalSurface";
  }
  return "MossCover";
};

export const hestiaCoastLushScatterPolicy = (
  fields: HestiaCoastLushSurfaceFields,
  groundHeightMeters: number,
  xMeters: number,
  zMeters: number
): HestiaCoastLushScatterPolicy | undefined => {
  const u = xMeters - 64;
  const v = -32 - zMeters;
  if (
    groundHeightMeters < 1
    || Math.hypot(u, v) <= 4
    || segmentDistance(u, v, 0, -6, 0, 18) <= 2.25
  ) {
    return undefined;
  }
  if (fields.overlookMask >= 0.5) return { acceptanceThreshold: 0.08, sproutThreshold: 0.8 };
  if (fields.wetFoldMask >= 0.35 || (fields.basinMask >= 0.58 && fields.surfaceHeight <= 2.25)) {
    return { acceptanceThreshold: 0.62, sproutThreshold: 0.94 };
  }
  if (fields.stepMask >= 0.35 || fields.ridgeMask >= 0.55) {
    return { acceptanceThreshold: 0.14, sproutThreshold: 0.72 };
  }
  if (fields.biological >= 0.56) return { acceptanceThreshold: 0.54, sproutThreshold: 0.84 };
  return { acceptanceThreshold: 0.24, sproutThreshold: 0.8 };
};
