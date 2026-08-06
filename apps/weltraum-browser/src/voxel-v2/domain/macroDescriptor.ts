import {
  DEFAULT_WORLD_SEED,
  SEA_LEVEL_CELL,
  SEA_LEVEL_METERS,
  VOXEL_SIZE_METERS,
  WORLD_VERSION
} from "./constants";
import type {
  MacroAnchor,
  MacroBiome,
  MacroFeature,
  MacroTerrainFamily,
  MacroTreeArchetype,
  MacroWorldSample
} from "./types";

const UINT32_SCALE = 0x100000000;
const SPAWN_X_METERS = (34 + 0.5) * VOXEL_SIZE_METERS;
const SPAWN_Z_METERS = (56 + 0.5) * VOXEL_SIZE_METERS;
const SPAWN_CLEARING_RADIUS_METERS = 6.25;

export interface MacroWorldDescriptor {
  readonly seed: string;
  readonly worldVersion: string;
  readonly seedHash: number;
  readonly sample: (xMeters: number, zMeters: number) => MacroWorldSample;
}

export const hashString32 = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const mix32 = (seed: number, x: number, z: number, salt: number): number => {
  let hash = seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(z, 0x85ebca77) ^ salt;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
};

const unitFloat = (value: number): number => value / UINT32_SCALE;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothStep = (value: number): number => value * value * (3 - 2 * value);
const positiveModulo = (value: number, divisor: number): number => {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
};

const latticeValue = (seed: number, x: number, z: number, salt: number): number =>
  unitFloat(mix32(seed, x, z, salt)) * 2 - 1;

const valueNoise = (seed: number, x: number, z: number, scale: number, salt: number): number => {
  const scaledX = x / scale;
  const scaledZ = z / scale;
  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = smoothStep(scaledX - x0);
  const tz = smoothStep(scaledZ - z0);
  const top = latticeValue(seed, x0, z0, salt) * (1 - tx) + latticeValue(seed, x1, z0, salt) * tx;
  const bottom = latticeValue(seed, x0, z1, salt) * (1 - tx) + latticeValue(seed, x1, z1, salt) * tx;
  return top * (1 - tz) + bottom * tz;
};

const ridgeNoise = (seed: number, x: number, z: number, scale: number, salt: number): number =>
  1 - Math.abs(valueNoise(seed, x, z, scale, salt));

const distance = (x: number, z: number, centerX: number, centerZ: number): number =>
  Math.hypot(x - centerX, z - centerZ);

const irregularIsland = (
  seed: number,
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  salt: number
): number => {
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  const angle = Math.atan2(dz, dx);
  const radialNoise = valueNoise(seed, x + centerX, z - centerZ, 23, salt) * 0.18;
  const lobes = Math.sin(angle * 3 + salt * 0.00001) * 0.08 + Math.sin(angle * 5 - salt * 0.00002) * 0.05;
  return 1 - Math.hypot(dx, dz) + radialNoise + lobes;
};

interface RawMacroSample {
  readonly heightMeters: number;
  readonly isWater: boolean;
  readonly isChannel: boolean;
  readonly isShore: boolean;
  readonly waterDepthMeters: number;
  readonly coastDistanceMeters: number;
  readonly riverDistanceMeters: number;
  readonly moisture: number;
  readonly slope: number;
  readonly curvature: number;
  readonly massif: number;
  readonly valley: number;
  readonly lagoon: boolean;
  readonly spawnClearing: boolean;
  readonly flowDirection: Readonly<{ readonly x: number; readonly z: number }>;
}

const rawSurface = (seedHash: number, xMeters: number, zMeters: number): RawMacroSample => {
  const phase = unitFloat(seedHash) * Math.PI * 2;
  const warpX = xMeters + valueNoise(seedHash, xMeters, zMeters, 42, 0x167b3a21) * 12;
  const warpZ = zMeters + valueNoise(seedHash, xMeters + 140, zMeters - 90, 50, 0x2e4f1987) * 10;
  const coastLine = -11 + Math.sin(warpZ * 0.055 + phase) * 5.5
    + Math.sin(warpZ * 0.019 - phase * 0.7) * 3.2
    + valueNoise(seedHash, warpX, warpZ, 28, 0x53d41e0b) * 4.5;
  const mainlandScore = (warpX - coastLine) / 3.4;
  const islands = Math.max(
    irregularIsland(seedHash, warpX, warpZ, -25, -18, 10, 8, 0x4c52a811),
    irregularIsland(seedHash, warpX, warpZ, -19, 8, 8, 12, 0x7a21c44d),
    irregularIsland(seedHash, warpX, warpZ, 13, 30, 15, 11, 0x1d9e63a7),
    irregularIsland(seedHash, warpX, warpZ, 42, -16, 18, 12, 0x2a6cbf05)
  );
  const landScore = Math.max(mainlandScore, islands);
  const riverCenterZ = -5 + Math.sin((warpX + 13) * 0.075 + phase * 0.35) * 4.5
    + valueNoise(seedHash, warpX, warpZ, 30, 0x6b3d29e1) * 3.5;
  const riverDistanceMeters = Math.abs(warpZ - riverCenterZ);
  const riverWidth = 1.2 + clamp01((warpX + 18) / 70) * 1.35;
  const riverChannel = landScore > 0.1 && warpX > coastLine - 2 && riverDistanceMeters < riverWidth;
  const lagoonValue = irregularIsland(seedHash, warpX, warpZ, -8, -5, 10, 7, 0x2d78e9b3);
  const lagoon = lagoonValue > 0.18 && warpX > coastLine - 7;
  const lagoonSpill = warpX < -10 && warpZ > -8 && warpZ < 0 && valueNoise(seedHash, warpX, warpZ, 11, 0x1afc72b9) > -0.25;
  const isChannel = riverChannel || lagoon || lagoonSpill;
  const spawnClearing = distance(xMeters, zMeters, SPAWN_X_METERS, SPAWN_Z_METERS) <= SPAWN_CLEARING_RADIUS_METERS;
  const isWater = !spawnClearing && (landScore <= 0 || isChannel);
  const isShore = !spawnClearing && (Math.abs(landScore) < 1.1 || (isWater && (lagoonValue > -0.22 || riverDistanceMeters < riverWidth + 2.5)));
  const massif = Math.max(
    0,
    1 - distance(warpX, warpZ, 12, 9) / 31,
    ridgeNoise(seedHash, warpX + 23, warpZ - 17, 34, 0x9c4f18d3) * 0.6
  );
  const valley = Math.exp(-riverDistanceMeters / 10) * 0.9 + ridgeNoise(seedHash, warpX - 15, warpZ + 25, 44, 0x50ad3381) * 0.35;
  const localSlope = clamp01(
    Math.abs(valueNoise(seedHash, warpX + 3, warpZ, 12, 0x2f8b1d95)) * 0.45
      + Math.abs(valueNoise(seedHash, warpX, warpZ - 4, 18, 0x41c237e7)) * 0.35
      + massif * 0.2
  );
  const moisture = clamp01(
    (isWater ? 0.95 : 0.12)
      + (isShore ? 0.32 : 0)
      + clamp01(1 - riverDistanceMeters / 17) * 0.45
      + valueNoise(seedHash, warpX + 70, warpZ - 50, 36, 0x5bc7e12f) * 0.18
      - massif * 0.16
  );
  const inlandMeters = Math.max(0, warpX - coastLine);
  const broadRelief = inlandMeters * 0.16 + massif * 13 - valley * 4.5;
  const terrainNoise = valueNoise(seedHash, warpX, warpZ, 17, 0x73a41d89) * 3.8
    + ridgeNoise(seedHash, warpX - 40, warpZ + 18, 8, 0x2c1a8f4b) * 1.5;
  const terraceSignal = Math.sin(warpX * 0.29 + warpZ * 0.17 + terrainNoise * 0.16 + phase) * (1.1 + localSlope * 2.4);
  const heightMeters = spawnClearing
    ? SEA_LEVEL_METERS + 2.45 + Math.sin((xMeters + zMeters) * 0.11) * 0.18
    : isWater
      ? SEA_LEVEL_METERS - (isChannel ? 0.55 : 1.8) - Math.max(0, terrainNoise) * 0.11
      : SEA_LEVEL_METERS + 1.5 + broadRelief + terrainNoise + terraceSignal;
  const coastDistanceMeters = Math.max(0, Math.abs(landScore) * 3.2 - (isChannel ? 1.5 : 0));
  const flowSlope = -0.075 * Math.cos((warpX + 13) * 0.075 + phase * 0.35)
    - 0.005 * valueNoise(seedHash, warpX, warpZ, 30, 0x6b3d29e1);
  const flowLength = Math.hypot(-1, flowSlope);

  return {
    heightMeters,
    isWater,
    isChannel,
    isShore,
    waterDepthMeters: isWater ? (isChannel ? 0.35 + clamp01(riverWidth / 3) * 0.7 : 1.1 + clamp01(-landScore) * 1.4) : 0,
    coastDistanceMeters,
    riverDistanceMeters,
    moisture,
    slope: localSlope,
    curvature: terraceSignal / 4,
    massif,
    valley,
    lagoon: lagoon || lagoonSpill,
    spawnClearing,
    flowDirection: Object.freeze({ x: -1 / flowLength, z: flowSlope / flowLength })
  };
};

const treeArchetype = (raw: RawMacroSample): MacroTreeArchetype => {
  if (raw.isChannel || (raw.isShore && raw.moisture > 0.65)) return "mangrove";
  if (raw.isShore || raw.coastDistanceMeters < 8) return "coast-savanna";
  if (raw.massif > 0.72 || raw.slope > 0.58) return "buttress-root";
  return "umbrella";
};

const biome = (raw: RawMacroSample): MacroBiome => {
  if (raw.isWater && raw.lagoon) return "lagoon";
  if (raw.isWater) return "open-water";
  if (raw.isChannel || raw.moisture > 0.78) return "wetland";
  if (raw.isShore) return "coast";
  if (raw.massif > 0.66) return "massif";
  if (raw.valley > 0.78) return "valley";
  if (raw.moisture > 0.52) return "forest";
  return "savanna";
};

const terrainFamily = (raw: RawMacroSample, heightCells: number): MacroTerrainFamily => {
  if (raw.isWater) return "water";
  if (raw.isShore || heightCells <= SEA_LEVEL_CELL + 4) return "sand";
  if (raw.moisture > 0.7) return "wet-rock";
  if (raw.slope > 0.62 || raw.massif > 0.72) return "rock";
  if (raw.moisture < 0.3) return "soil";
  return "grass";
};

const feature = (raw: RawMacroSample): MacroFeature => {
  if (raw.isWater && raw.lagoon) return "lagoon";
  if (raw.isChannel) return "channel";
  if (raw.isWater) return "ocean";
  if (raw.massif > 0.7) return "massif";
  if (raw.isShore) return "coast";
  if (raw.valley > 0.76) return "valley";
  return raw.coastDistanceMeters > 7 ? "mainland" : "island";
};

const createAnchor = (
  seedHash: number,
  xMeters: number,
  zMeters: number,
  archetype: MacroTreeArchetype
): MacroAnchor => {
  const gridX = Math.floor(xMeters / 16);
  const gridZ = Math.floor(zMeters / 16);
  const placement = mix32(seedHash, gridX, gridZ, 0x4d3a2f11);
  return Object.freeze({
    key: `${gridX}:${gridZ}`,
    x: gridX * 16 + 8 + (placement % 7) - 3,
    z: gridZ * 16 + 8 + ((placement >>> 8) % 7) - 3,
    cluster: (placement >>> 16) % 9,
    recommendedTreeArchetype: archetype
  });
};

const freezeSample = (seedHash: number, xMeters: number, zMeters: number): MacroWorldSample => {
  const raw = rawSurface(seedHash, xMeters, zMeters);
  const surfaceLevelCells = Math.round(raw.heightMeters / VOXEL_SIZE_METERS);
  const archetype = treeArchetype(raw);
  const anchor = createAnchor(seedHash, xMeters, zMeters, archetype);
  const anchorArchetype = treeArchetype(rawSurface(seedHash, anchor.x, anchor.z));
  return Object.freeze({
    heightMeters: raw.heightMeters,
    surfaceHeightMeters: raw.heightMeters,
    surfaceLevelCells,
    isWater: raw.isWater,
    isChannel: raw.isChannel,
    isShore: raw.isShore,
    waterDepthMeters: raw.waterDepthMeters,
    biome: biome(raw),
    terrainFamily: terrainFamily(raw, surfaceLevelCells),
    feature: feature(raw),
    slope: raw.slope,
    moisture: raw.moisture,
    coastDistanceMeters: raw.coastDistanceMeters,
    riverDistanceMeters: raw.riverDistanceMeters,
    flowDirection: raw.flowDirection,
    strataIndex: positiveModulo(Math.floor(surfaceLevelCells / 3) + Math.floor(raw.curvature * 2), 4),
    terraceIndex: positiveModulo(Math.floor((raw.heightMeters + raw.curvature) / 1.4), 7),
    curvature: raw.curvature,
    spawnClearing: raw.spawnClearing,
    anchor: Object.freeze({ ...anchor, recommendedTreeArchetype: anchorArchetype })
  });
};

export const sampleMacroWorld = (
  descriptor: MacroWorldDescriptor,
  xMeters: number,
  zMeters: number
): MacroWorldSample => descriptor.sample(xMeters, zMeters);

export const createMacroWorldDescriptor = (
  seed = DEFAULT_WORLD_SEED,
  worldVersion = WORLD_VERSION
): MacroWorldDescriptor => {
  if (seed.trim().length === 0 || worldVersion.trim().length === 0) {
    throw new Error("V2 macro descriptor seed and world version are required.");
  }
  const seedHash = hashString32(`${worldVersion}:${seed}`);
  return Object.freeze({
    seed,
    worldVersion,
    seedHash,
    sample: (xMeters: number, zMeters: number): MacroWorldSample => {
      if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) throw new RangeError("V2 macro coordinates must be finite.");
      return freezeSample(seedHash, xMeters, zMeters);
    }
  });
};
