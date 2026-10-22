// Existing seed.ts arithmetic; unused local SurfaceFrame seed API is not imported.
import { isStrictVoxelInteger } from "../../voxel/ids";
import { fnv1aHash } from "../../core/hash";
const FNV1A32_PRIME = 0x01000193;
const assertAscii = (value: string, path: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) throw new TypeError(`${path} must contain ASCII characters only`);
  }
};
export const fnv1a32Ascii = (value: string): number => {
  assertAscii(value, "seed tuple");
  return Number.parseInt(fnv1aHash(value), 16) >>> 0;
};
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
export const hashHestiaLattice = (seed: number, ...coordinates: readonly number[]): number => {
  assertUint32(seed);
  if (coordinates.length === 0) throw new RangeError("at least one lattice coordinate is required");
  let hash = seed >>> 0;
  for (const coordinate of coordinates) {
    const [low, high] = coordinateWords(coordinate);
    hash = Math.imul((hash ^ low) >>> 0, FNV1A32_PRIME) >>> 0;
    hash = Math.imul((hash ^high) >>> 0, FNV1A32_PRIME) >>> 0;
  }
  return hash;
};
