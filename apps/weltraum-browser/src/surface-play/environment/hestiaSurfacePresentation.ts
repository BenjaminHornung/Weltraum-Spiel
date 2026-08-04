import {
  canonicalSignature,
  createMaterialProfile,
  materialProfileId,
  materialProfileSignature,
  type ContentHash,
  type MaterialProfile,
  type MaterialProfileId
} from "../../presentation";
import {
  type VoxelCoordinate
} from "../../voxel";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_PRESET_ID,
  type HestiaGeneratorProfile
} from "../../world-generation/hestia";
import {
  createSurfaceTerrainPresentationSnapshot,
  type SurfaceTerrainPresentationSnapshot
} from "../contracts";
import type {
  HestiaSurfaceDecorativePopulationFact,
  HestiaSurfaceWaterPatchFact,
  HestiaSurfaceWorldFacts
} from "../world";

const PRESENTATION_POLICY_VERSION = "hestia-surface-presentation.v1";

export interface HestiaSurfaceBrickPresentationFactInput {
  readonly brickId: string;
  readonly coordinate: Readonly<VoxelCoordinate>;
  readonly terrainHash: string;
}

export interface HestiaSurfaceBrickPresentationFact {
  readonly brickId: string;
  readonly coordinate: Readonly<VoxelCoordinate>;
  readonly terrainHash: string;
}

export type HestiaSurfaceScatterPresentationFact = HestiaSurfaceDecorativePopulationFact;

export type HestiaSurfaceWaterPatchPresentationFact = HestiaSurfaceWaterPatchFact;

export interface HestiaSurfaceRegionPresentationSnapshotInput {
  readonly terrain: SurfaceTerrainPresentationSnapshot;
  readonly world: Readonly<HestiaSurfaceWorldFacts>;
  readonly profile?: HestiaGeneratorProfile;
  readonly bricks: readonly HestiaSurfaceBrickPresentationFactInput[];
}

export interface HestiaSurfaceRegionPresentationSnapshot {
  readonly terrain: Readonly<SurfaceTerrainPresentationSnapshot>;
  readonly profile: HestiaGeneratorProfile;
  readonly rootSeed: string;
  readonly voxelSizeMeters: HestiaSurfaceWorldFacts["environment"]["voxelSizeMeters"];
  readonly bricks: readonly Readonly<HestiaSurfaceBrickPresentationFact>[];
  readonly scatter: readonly Readonly<HestiaSurfaceScatterPresentationFact>[];
  readonly waterPatches: readonly Readonly<HestiaSurfaceWaterPatchPresentationFact>[];
  readonly presentationSignature: ContentHash;
}

const createMaterialDefinitions = (colors: readonly Readonly<{ key: string; color: Readonly<{ r: number; g: number; b: number }> }>[]) =>
  Object.freeze(colors.map(({ key, color }) => Object.freeze({
    key,
    profile: createMaterialProfile({
      id: materialProfileId(`hestia-surface:${key}`),
      kind: "BasicLit",
      baseColor: color,
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  })));

const MATERIAL_PROFILE_DEFINITIONS = createMaterialDefinitions([
  { key: "dark_rock", color: { r: 0.045, g: 0.085, b: 0.082 } },
  { key: "wet_soil", color: { r: 0.105, g: 0.17, b: 0.145 } },
  { key: "moss", color: { r: 0.075, g: 0.245, b: 0.19 } },
  { key: "dense_biological_surface", color: { r: 0.045, g: 0.205, b: 0.22 } },
  { key: "shallow_water_boundary", color: { r: 0.07, g: 0.34, b: 0.39 } }
] as const);

const COAST_LUSH_MATERIAL_PROFILE_DEFINITIONS = createMaterialDefinitions([
  { key: "dark_rock", color: { r: 0.391572, g: 0.327778, b: 0.168269 } },
  { key: "wet_soil", color: { r: 0.076185, g: 0.109462, b: 0.048172 } },
  { key: "moss", color: { r: 0.155926, g: 0.346704, b: 0.059511 } },
  { key: "dense_biological_surface", color: { r: 0.028426, g: 0.116971, b: 0.039546 } },
  { key: "shallow_water_boundary", color: { r: 0.141263, g: 0.47932, b: 0.423268 } }
] as const);

const materialProfiles = (
  definitions: readonly Readonly<{ key: string; profile: MaterialProfile }>[]
): readonly MaterialProfile[] => Object.freeze(definitions.map(({ profile }) => profile));

const MATERIAL_PROFILE_DEFINITIONS_V1 = MATERIAL_PROFILE_DEFINITIONS;
const MATERIAL_PROFILE_DEFINITIONS_COAST_LUSH = COAST_LUSH_MATERIAL_PROFILE_DEFINITIONS;

export const HESTIA_SURFACE_MATERIAL_PROFILES: readonly MaterialProfile[] = Object.freeze(
  materialProfiles(MATERIAL_PROFILE_DEFINITIONS_V1)
);
export const HESTIA_SURFACE_COAST_LUSH_MATERIAL_PROFILES: readonly MaterialProfile[] = Object.freeze(
  materialProfiles(MATERIAL_PROFILE_DEFINITIONS_COAST_LUSH)
);
export const hestiaSurfaceMaterialProfilesForProfile = (
  profile: HestiaGeneratorProfile
): readonly MaterialProfile[] => profile === HESTIA_COAST_LUSH_PRESET_ID
  ? HESTIA_SURFACE_COAST_LUSH_MATERIAL_PROFILES
  : HESTIA_SURFACE_MATERIAL_PROFILES;

const MATERIAL_PROFILE_IDS = new Map<string, MaterialProfileId>(
  MATERIAL_PROFILE_DEFINITIONS_V1.map(({ key, profile }) => [key, profile.id])
);

export const hestiaSurfaceMaterialProfileIdForKey = (materialKey: string): MaterialProfileId => {
  const profileId = MATERIAL_PROFILE_IDS.get(materialKey);
  if (profileId === undefined) throw new RangeError(`Unsupported Hestia surface material key: ${materialKey}`);
  return profileId;
};

const requireStableText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    throw new TypeError(`${field} must be a non-empty trimmed string with at most 256 characters`);
  }
  return value;
};

const requireCoordinate = (coordinate: Readonly<VoxelCoordinate>, field: string): Readonly<VoxelCoordinate> => {
  if (typeof coordinate !== "object" || coordinate === null || Array.isArray(coordinate)) {
    throw new TypeError(`${field} must be a coordinate`);
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isSafeInteger(coordinate[axis])) throw new RangeError(`${field}.${axis} must be a safe integer`);
  }
  return Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });
};

const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const requireFinite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${field} must be finite`);
  return value;
};

const requireVec3 = (
  value: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>,
  field: string
) => Object.freeze({
  x: requireFinite(value.x, `${field}.x`),
  y: requireFinite(value.y, `${field}.y`),
  z: requireFinite(value.z, `${field}.z`)
});

const coordinateKey = (coordinate: Readonly<VoxelCoordinate>): string =>
  `${coordinate.x}:${coordinate.y}:${coordinate.z}`;

const coordinateKeys = (
  coordinates: readonly Readonly<VoxelCoordinate>[],
  field: string
): readonly string[] => {
  if (!Array.isArray(coordinates) || coordinates.length > 4096) {
    throw new RangeError(`${field} must be a bounded array`);
  }
  const keys = coordinates.map((coordinate, index) =>
    coordinateKey(requireCoordinate(coordinate, `${field}.${index}`))
  ).sort(compareAscii);
  if (new Set(keys).size !== keys.length) throw new RangeError(`${field} contains duplicate coordinates`);
  return keys;
};

const sameIdentity = (
  left: Readonly<{ bodyId: string; regionId: string; surfaceFrameId: string; regionRevision: number }>,
  right: Readonly<{ bodyId: string; regionId: string; surfaceFrameId: string; regionRevision: number }>
): boolean => left.bodyId === right.bodyId
  && left.regionId === right.regionId
  && left.surfaceFrameId === right.surfaceFrameId
  && left.regionRevision === right.regionRevision;

const sameVec3 = (
  left: Readonly<{ x: number; y: number; z: number }>,
  right: Readonly<{ x: number; y: number; z: number }>
): boolean => left.x === right.x && left.y === right.y && left.z === right.z;

const copyScatter = (
  facts: readonly Readonly<HestiaSurfaceDecorativePopulationFact>[]
): readonly Readonly<HestiaSurfaceScatterPresentationFact>[] => {
  if (!Array.isArray(facts) || facts.length > 65_536) {
    throw new RangeError("world.environment.decorativePopulation must be a bounded array");
  }
  const ids = new Set<string>();
  const copied = facts.map((fact, index) => {
    const id = requireStableText(fact.id, `world.environment.decorativePopulation.${index}.id`);
    if (ids.has(id)) throw new RangeError(`Duplicate Hestia population ID: ${id}`);
    ids.add(id);
    if (fact.kind !== "cyan_luminous_sprout" && fact.kind !== "cyan_luminous_cap") {
      throw new RangeError("Decorative population cannot contain Structural black_trunk facts");
    }
    if (!Number.isSafeInteger(fact.surfaceMaterialId) || fact.surfaceMaterialId < 0 || fact.surfaceMaterialId > 255) {
      throw new RangeError(`world.environment.decorativePopulation.${index}.surfaceMaterialId is invalid`);
    }
    const uniformScale = requireFinite(
      fact.uniformScale,
      `world.environment.decorativePopulation.${index}.uniformScale`
    );
    if (uniformScale <= 0) throw new RangeError("Decorative population scale must be positive");
    return Object.freeze({
      id,
      kind: fact.kind,
      positionMeters: requireVec3(
        fact.positionMeters,
        `world.environment.decorativePopulation.${index}.positionMeters`
      ),
      yawRadians: requireFinite(
        fact.yawRadians,
        `world.environment.decorativePopulation.${index}.yawRadians`
      ),
      uniformScale,
      surfaceMaterialId: fact.surfaceMaterialId
    });
  }).sort((left, right) => compareAscii(left.id, right.id));
  return Object.freeze(copied);
};

const copyWaterPatches = (
  facts: readonly Readonly<HestiaSurfaceWaterPatchFact>[]
): readonly Readonly<HestiaSurfaceWaterPatchPresentationFact>[] => {
  if (!Array.isArray(facts) || facts.length > 65_536) {
    throw new RangeError("world.environment.waterPatches must be a bounded array");
  }
  const ids = new Set<string>();
  const copied = facts.map((fact, index) => {
    const id = requireStableText(fact.id, `world.environment.waterPatches.${index}.id`);
    if (ids.has(id)) throw new RangeError(`Duplicate Hestia water-patch ID: ${id}`);
    ids.add(id);
    if (fact.source !== "Shore" && fact.source !== "WetDepression") {
      throw new RangeError(`world.environment.waterPatches.${index}.source is invalid`);
    }
    const uniformScale = requireFinite(fact.uniformScale, `world.environment.waterPatches.${index}.uniformScale`);
    if (uniformScale <= 0) throw new RangeError("Hestia water-patch scale must be positive");
    return Object.freeze({
      id,
      positionMeters: requireVec3(fact.positionMeters, `world.environment.waterPatches.${index}.positionMeters`),
      uniformScale,
      source: fact.source
    });
  }).sort((left, right) => compareAscii(left.id, right.id));
  return Object.freeze(copied);
};

export const createHestiaSurfacePresentationSnapshot = (
  input: HestiaSurfaceRegionPresentationSnapshotInput
): Readonly<HestiaSurfaceRegionPresentationSnapshot> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Hestia surface presentation input must be an object");
  }
  const terrain = createSurfaceTerrainPresentationSnapshot(input.terrain);
  const world = input.world;
  if (typeof world !== "object" || world === null || Array.isArray(world)) {
    throw new TypeError("world must be an immutable Hestia Surface World snapshot");
  }
  const environment = world.environment;
  if (typeof environment !== "object" || environment === null || Array.isArray(environment)) {
    throw new TypeError("world.environment must be an immutable World-owned facts snapshot");
  }
  if (!sameIdentity(world.identity, terrain) || !sameIdentity(environment.identity, world.identity)) {
    throw new RangeError("world identity and revision must exactly match terrain presentation");
  }
  const profile = input.profile
    ?? (world.identity.regionId.includes("coast-lush") ? HESTIA_COAST_LUSH_PRESET_ID : HESTIA_PRESET_ID);
  if (profile !== HESTIA_PRESET_ID && profile !== HESTIA_COAST_LUSH_PRESET_ID) {
    throw new RangeError("presentation profile is not an approved Hestia identity");
  }
  const rootSeed = requireStableText(environment.rootSeed, "world.environment.rootSeed");
  if (environment.voxelSizeMeters !== 0.25 && environment.voxelSizeMeters !== 0.5) {
    throw new RangeError("world.environment.voxelSizeMeters must be 0.25 or 0.5");
  }
  const waterSurfaceHeightMeters = requireFinite(
    environment.waterSurfaceHeightMeters,
    "world.environment.waterSurfaceHeightMeters"
  );
  if (waterSurfaceHeightMeters !== world.waterSurfaceHeightMeters) {
    throw new RangeError("world water height binding is inconsistent");
  }
  const worldAnchor = requireVec3(world.anchorCenterMeters, "world.anchorCenterMeters");
  const environmentAnchor = requireVec3(environment.anchorCenterMeters, "world.environment.anchorCenterMeters");
  if (!sameVec3(worldAnchor, environmentAnchor)) {
    throw new RangeError("world anchor binding is inconsistent");
  }
  if (!Array.isArray(input.bricks) || input.bricks.length > 4096) {
    throw new RangeError("bricks must be a bounded array");
  }

  const brickIds = new Set<string>();
  const bricks = input.bricks.map((brick, index) => {
    if (typeof brick !== "object" || brick === null || Array.isArray(brick)) {
      throw new TypeError(`bricks.${index} must be an object`);
    }
    const brickId = requireStableText(brick.brickId, `bricks.${index}.brickId`);
    if (brickIds.has(brickId)) throw new RangeError(`Duplicate brickId: ${brickId}`);
    brickIds.add(brickId);
    return Object.freeze({
      brickId,
      coordinate: requireCoordinate(brick.coordinate, `bricks.${index}.coordinate`),
      terrainHash: requireStableText(brick.terrainHash, `bricks.${index}.terrainHash`)
    });
  }).sort((left, right) => compareAscii(left.brickId, right.brickId));

  const visibleBrickIds = [...terrain.visibleBrickIds].sort(compareAscii);
  const suppliedBrickIds = bricks.map((brick) => brick.brickId);
  if (visibleBrickIds.length !== suppliedBrickIds.length
    || visibleBrickIds.some((brickId, index) => brickId !== suppliedBrickIds[index])) {
    throw new RangeError("bricks must cover every visible terrain brick exactly once");
  }
  const brickCoordinateKeys = coordinateKeys(bricks.map((brick) => brick.coordinate), "bricks");
  const worldCoordinateKeys = coordinateKeys(world.residentBrickCoordinates, "world.residentBrickCoordinates");
  const environmentCoordinateKeys = coordinateKeys(
    environment.residentBrickCoordinates,
    "world.environment.residentBrickCoordinates"
  );
  if (
    JSON.stringify(brickCoordinateKeys) !== JSON.stringify(worldCoordinateKeys)
    || JSON.stringify(environmentCoordinateKeys) !== JSON.stringify(worldCoordinateKeys)
  ) throw new RangeError("bricks must exactly match World-owned resident coverage");

  const base = {
    terrain,
    rootSeed,
    voxelSizeMeters: environment.voxelSizeMeters,
    bricks: Object.freeze(bricks)
  };
  const scatter = copyScatter(environment.decorativePopulation);
  const waterPatches = copyWaterPatches(environment.waterPatches);
  const presentationSignature = canonicalSignature({
    policy: PRESENTATION_POLICY_VERSION,
    terrain,
    rootSeed,
    voxelSizeMeters: environment.voxelSizeMeters,
    residentBrickCoordinates: world.residentBrickCoordinates,
    waterSurfaceHeightMeters,
    anchorCenterMeters: worldAnchor,
    bricks,
    materialProfiles: hestiaSurfaceMaterialProfilesForProfile(profile).map(materialProfileSignature),
    scatter,
    waterPatches
  });

  return Object.freeze({
    ...base,
    profile,
    scatter,
    waterPatches,
    presentationSignature
  });
};
