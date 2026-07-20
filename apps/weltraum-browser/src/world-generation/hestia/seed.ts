import {
  isStrictVoxelInteger,
  validateVoxelStableId,
  type VoxelCoordinate
} from "../../voxel";
import { fnv1aHash } from "../../core/hash";
import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_PRESET_ID,
  type HestiaGenerationInput
} from "./preset";

const FNV1A32_PRIME = 0x01000193;
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

const assertAscii = (value: string, path: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) throw new TypeError(`${path} must contain ASCII characters only`);
  }
};

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

const fnv1a32Ascii = (value: string): number => {
  assertAscii(value, "seed tuple");
  // hestia.seed.v1 is ASCII-only, so the neutral UTF-16-code-unit FNV helper
  // is byte-equivalent here; fixed seed vectors bind this version boundary.
  return Number.parseInt(fnv1aHash(value), 16) >>> 0;
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

const assertUint32 = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff || Object.is(value, -0)) {
    throw new RangeError("seed must be an unsigned 32-bit integer");
  }
};

const coordinateWords = (coordinate: number): readonly [number, number] => {
  if (!isStrictVoxelInteger(coordinate)) throw new RangeError("lattice coordinates must be safe integers");
  const bits = BigInt.asUintN(64, BigInt(coordinate));
  return [Number(bits & 0xffff_ffffn), Number((bits >> 32n) & 0xffff_ffffn)];
};

/**
 * FNV word-mixing over both low and high two's-complement words. This is the
 * V1 safe-coordinate rule and intentionally does not truncate coordinates.
 */
export const hashHestiaLattice = (seed: number, ...coordinates: readonly number[]): number => {
  assertUint32(seed);
  if (coordinates.length === 0) throw new RangeError("at least one lattice coordinate is required");
  let hash = seed >>> 0;
  for (const coordinate of coordinates) {
    const [low, high] = coordinateWords(coordinate);
    hash = Math.imul((hash ^ low) >>> 0, FNV1A32_PRIME) >>> 0;
    hash = Math.imul((hash ^ high) >>> 0, FNV1A32_PRIME) >>> 0;
  }
  return hash;
};

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
