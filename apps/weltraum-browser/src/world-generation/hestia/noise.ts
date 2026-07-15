import { hashHestiaLattice } from "./seed";

const UINT32_RANGE = 0x1_0000_0000;

const requireFinite = (value: number, path: string): void => {
  if (!Number.isFinite(value)) throw new RangeError(`${path} must be finite`);
};

const latticeBounds = (value: number, path: string): readonly [number, number, number] => {
  requireFinite(value, path);
  const lower = Math.floor(value);
  const upper = lower + 1;
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper)) {
    throw new RangeError(`${path} must have safe-integer lattice bounds`);
  }
  return [lower, upper, value - lower];
};

export const quinticFade = (value: number): number => {
  requireFinite(value, "interpolation value");
  if (value < 0 || value > 1) throw new RangeError("interpolation value must be from 0 through 1");
  return value * value * value * (value * (value * 6 - 15) + 10);
};

const lerp = (left: number, right: number, amount: number): number => left + (right - left) * amount;

const latticeValue = (seed: number, ...coordinates: readonly number[]): number =>
  (hashHestiaLattice(seed, ...coordinates) / UINT32_RANGE) * 2 - 1;

export const valueNoise2 = (seed: number, x: number, z: number): number => {
  const [x0, x1, tx] = latticeBounds(x, "x");
  const [z0, z1, tz] = latticeBounds(z, "z");
  const sx = quinticFade(tx);
  const sz = quinticFade(tz);
  const near = lerp(latticeValue(seed, x0, z0), latticeValue(seed, x1, z0), sx);
  const far = lerp(latticeValue(seed, x0, z1), latticeValue(seed, x1, z1), sx);
  const result = lerp(near, far, sz);
  if (!Number.isFinite(result)) throw new RangeError("valueNoise2 produced a non-finite result");
  return result;
};

export const valueNoise3 = (seed: number, x: number, y: number, z: number): number => {
  const [x0, x1, tx] = latticeBounds(x, "x");
  const [y0, y1, ty] = latticeBounds(y, "y");
  const [z0, z1, tz] = latticeBounds(z, "z");
  const sx = quinticFade(tx);
  const sy = quinticFade(ty);
  const sz = quinticFade(tz);
  const zNearY0 = lerp(latticeValue(seed, x0, y0, z0), latticeValue(seed, x1, y0, z0), sx);
  const zNearY1 = lerp(latticeValue(seed, x0, y1, z0), latticeValue(seed, x1, y1, z0), sx);
  const zFarY0 = lerp(latticeValue(seed, x0, y0, z1), latticeValue(seed, x1, y0, z1), sx);
  const zFarY1 = lerp(latticeValue(seed, x0, y1, z1), latticeValue(seed, x1, y1, z1), sx);
  const result = lerp(lerp(zNearY0, zNearY1, sy), lerp(zFarY0, zFarY1, sy), sz);
  if (!Number.isFinite(result)) throw new RangeError("valueNoise3 produced a non-finite result");
  return result;
};

const requireOctaves = (octaves: number): void => {
  if (!Number.isSafeInteger(octaves) || octaves < 1 || octaves > 32 || Object.is(octaves, -0)) {
    throw new RangeError("octaves must be an integer from 1 through 32");
  }
};

export const fbm2 = (seed: number, x: number, z: number, octaves: number): number => {
  requireOctaves(octaves);
  requireFinite(x, "x");
  requireFinite(z, "z");
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let amplitudeSum = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2(seed, x * frequency, z * frequency) * amplitude;
    amplitudeSum += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  const result = total / amplitudeSum;
  if (!Number.isFinite(result)) throw new RangeError("fbm2 produced a non-finite result");
  return result;
};

export const fbm3 = (seed: number, x: number, y: number, z: number, octaves: number): number => {
  requireOctaves(octaves);
  requireFinite(x, "x");
  requireFinite(y, "y");
  requireFinite(z, "z");
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let amplitudeSum = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise3(seed, x * frequency, y * frequency, z * frequency) * amplitude;
    amplitudeSum += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  const result = total / amplitudeSum;
  if (!Number.isFinite(result)) throw new RangeError("fbm3 produced a non-finite result");
  return result;
};

export const ridgedNoise2 = (seed: number, x: number, z: number): number => {
  const ridge = 1 - Math.abs(valueNoise2(seed, x, z));
  return ridge * ridge;
};

export const ridgedFbm2 = (seed: number, x: number, z: number, octaves: number): number => {
  requireOctaves(octaves);
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let amplitudeSum = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += ridgedNoise2(seed, x * frequency, z * frequency) * amplitude;
    amplitudeSum += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  const result = total / amplitudeSum;
  if (!Number.isFinite(result)) throw new RangeError("ridgedFbm2 produced a non-finite result");
  return result;
};
