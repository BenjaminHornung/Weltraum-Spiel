import {
  isStrictVoxelInteger,
  validateVoxelStableId,
  type VoxelCoordinate
} from "../../voxel";
import { fnv1a32Ascii, hashHestiaLattice, assertUint32 } from "../latticeNoise";
export { hashHestiaLattice } from "../latticeNoise";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_PRESET_ID,
  type HestiaGenerationInput
} from "./preset";

const UINT32_RANGE = 0x1_0000_0000;
const ROOT_SEED_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const HESTIA_SEED_DOMAINS = Object.freeze([
  "macro-elevation",
  "island-ridge",
  "rock-breakup",
  "domain-warp-x",
  "domain-warp-z",
  "wet-depressions",
  "material-biological",
  "scatter-accept",
  "scatter-kind",
  "scatter-yaw",
  "scatter-scale",
  "scatter-jitter"
] as const);

export type HestiaSeedDomain = (typeof HESTIA_SEED_DOMAINS)[number];

export interface HestiaSeedSet {
  readonly macroElevation: number;
  readonly islandRidge: number;
  readonly rockBreakup: number;
  readonly domainWarpX: number;
  readonly domainWarpZ: number;
  readonly wetDepressions: number;
  readonly materialBiological: number;
  readonly scatterAccept: number;
  readonly scatterKind: number;
  readonly scatterYaw: number;
  readonly scatterScale: number;
  readonly scatterJitter: number;
}

export function assertHestiaRootSeed(value: unknown): asserts value is string {
  if (typeof value !== "string" || !ROOT_SEED_PATTERN.test(value)) {
    throw new TypeError("rootSeed must be a 1-128 character ASCII token matching [A-Za-z0-9._:-]+");
  }
}

const assertStableId = (value: unknown, path: string): void => {
  const result = validateVoxelStableId(value, path);
  if (!result.valid) throw new TypeError(`${path} ${result.issues[0]?.message ?? "is invalid"}`);
};

const assertBrickCoordinate = (value: VoxelCoordinate): void => {
  for (const axis of ["x", "y", "z"] as const) {
    if (!isStrictVoxelInteger(value[axis])) throw new RangeError(`brickCoordinate.${axis} must be a safe integer`);
  }
};

export const assertHestiaGenerationInput = (
  input: HestiaGenerationInput
): void => {
  if (typeof input !== "object" || input === null) throw new TypeError("Hestia generation input must be an object");
  assertHestiaRootSeed(input.rootSeed);
  assertStableId(input.bodyId, "bodyId");
  assertStableId(input.surfaceFrameId, "surfaceFrameId");
  assertStableId(input.regionId, "regionId");
  if (typeof input.brickCoordinate !== "object" || input.brickCoordinate === null) {
    throw new TypeError("brickCoordinate must be an x/y/z coordinate object");
  }
  assertBrickCoordinate(input.brickCoordinate);
  if (input.voxelSizeMeters !== 0.25 && input.voxelSizeMeters !== 0.5) {
    throw new RangeError("voxelSizeMeters must be exactly 0.25 or 0.50 for Hestia V1");
  }
};

const assertDomain = (domain: HestiaSeedDomain): void => {
  if (!(HESTIA_SEED_DOMAINS as readonly string[]).includes(domain)) {
    throw new TypeError("domain must be a documented Hestia V1 seed domain");
  }
};

/** FNV-1a32 over the exact NUL-delimited Hestia V1 seed tuple. */
export const deriveHestiaDomainSeed = (
  input: HestiaGenerationInput,
  domain: HestiaSeedDomain
): number => {
  assertHestiaGenerationInput(input);
  assertDomain(domain);
  return fnv1a32Ascii(
    `hestia.seed.v1\0${input.rootSeed}\0${input.bodyId}\0${input.surfaceFrameId}\0${HESTIA_PRESET_ID}\0${domain}`
  );
};

export const createHestiaSeedSet = (input: HestiaGenerationInput): HestiaSeedSet => Object.freeze({
  macroElevation: deriveHestiaDomainSeed(input, "macro-elevation"),
  islandRidge: deriveHestiaDomainSeed(input, "island-ridge"),
  rockBreakup: deriveHestiaDomainSeed(input, "rock-breakup"),
  domainWarpX: deriveHestiaDomainSeed(input, "domain-warp-x"),
  domainWarpZ: deriveHestiaDomainSeed(input, "domain-warp-z"),
  wetDepressions: deriveHestiaDomainSeed(input, "wet-depressions"),
  materialBiological: deriveHestiaDomainSeed(input, "material-biological"),
  scatterAccept: deriveHestiaDomainSeed(input, "scatter-accept"),
  scatterKind: deriveHestiaDomainSeed(input, "scatter-kind"),
  scatterYaw: deriveHestiaDomainSeed(input, "scatter-yaw"),
  scatterScale: deriveHestiaDomainSeed(input, "scatter-scale"),
  scatterJitter: deriveHestiaDomainSeed(input, "scatter-jitter")
});

export const hestiaUnitFloat = (seed: number, ...coordinates: readonly number[]): number =>
  hashHestiaLattice(seed, ...coordinates) / UINT32_RANGE;

export const hestiaSeedHex = (seed: number): string => {
  assertUint32(seed);
  return seed.toString(16).padStart(8, "0");
};

/** Canonical job/cache identity; channel bytes remain authoritative in VoxelBrick. */
export const createHestiaGenerationKey = (input: HestiaGenerationInput): string => {
  assertHestiaGenerationInput(input);
  return JSON.stringify({
    generatorVersion: HESTIA_GENERATOR_VERSION_V1,
    presetId: HESTIA_PRESET_ID,
    rootSeed: input.rootSeed,
    bodyId: input.bodyId,
    surfaceFrameId: input.surfaceFrameId,
    regionId: input.regionId,
    brickCoordinate: [input.brickCoordinate.x, input.brickCoordinate.y, input.brickCoordinate.z],
    voxelSizeMeters: input.voxelSizeMeters
  });
};
