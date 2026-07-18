import type { VoxelMaterialId } from "../../../voxel";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  globalQuantumCoordinate,
  type GlobalQuantumCoordinate
} from "../../../voxel/adaptive";
import {
  STRUCTURAL_AIR_MATERIAL_ID,
  type StructuralMaterialId
} from "../../../voxel/structural";
import {
  sampleHydrologyTerrainAdjustment,
  type HydrologySnapshot
} from "../hydrology";
import {
  HESTIA_VEGETATION_GRID_QUANTA,
  HESTIA_VEGETATION_MAX_JITTER_QUANTA,
  HESTIA_VEGETATION_SCHEMA_VERSION,
  HESTIA_VEGETATION_SPECIES_IDS,
  type HestiaVegetationCandidate,
  type HestiaVegetationCandidateRequest,
  type HestiaVegetationCandidateSet,
  type HestiaVegetationHydrologySample,
  type HestiaVegetationHydrologySampler,
  type HestiaVegetationInstance,
  type HestiaVegetationPlacementRejection,
  type HestiaVegetationPlacementRejectionReason,
  type HestiaVegetationPopulation,
  type HestiaVegetationPopulationRequest,
  type HestiaVegetationRegionBounds,
  type HestiaVegetationSpeciesDefinition,
  type HestiaVegetationSpeciesId,
  type HestiaVegetationTerrainSample
} from "./contracts";
import {
  freezeHestiaVegetationValue,
  hashHestiaVegetationCanonical,
  hestiaVegetationHashUnitFloat
} from "./canonical";
import { getHestiaVegetationSpecies } from "./registry";
import {
  hestiaVegetationBiomeId,
  hestiaVegetationSpeciesId,
  validateHestiaVegetationAuthorityIdentity,
  validateHestiaVegetationBudget,
  validateHestiaVegetationRegionBounds,
  validateHestiaVegetationRootMaterialId,
  vegetationFail
} from "./validation";

const codeUnitCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const compareHestiaVegetationCandidates = (
  left: HestiaVegetationCandidate,
  right: HestiaVegetationCandidate
): number => left.anchorQuanta.z - right.anchorQuanta.z
  || left.anchorQuanta.x - right.anchorQuanta.x
  || codeUnitCompare(left.speciesId, right.speciesId)
  || codeUnitCompare(left.candidateHash, right.candidateHash);

const normalizeSpeciesIds = (
  values: readonly (HestiaVegetationSpeciesId | string)[] | undefined
): readonly HestiaVegetationSpeciesId[] => {
  const source = values ?? HESTIA_VEGETATION_SPECIES_IDS;
  const unique = new Set<HestiaVegetationSpeciesId>();
  for (const value of source) unique.add(hestiaVegetationSpeciesId(value));
  return freezeHestiaVegetationValue([...unique].sort(codeUnitCompare));
};

const regionCompare = (left: HestiaVegetationRegionBounds, right: HestiaVegetationRegionBounds): number =>
  left.minZQuanta - right.minZQuanta
  || left.minXQuanta - right.minXQuanta
  || left.maxZQuanta - right.maxZQuanta
  || left.maxXQuanta - right.maxXQuanta;

const normalizeRegions = (values: readonly HestiaVegetationRegionBounds[]): readonly HestiaVegetationRegionBounds[] => {
  if (!Array.isArray(values) || values.length === 0) {
    return vegetationFail("InvalidBounds", "regions", "At least one owned region is required.");
  }
  const unique = new Map<string, HestiaVegetationRegionBounds>();
  values.forEach((value, index) => {
    const region = validateHestiaVegetationRegionBounds(value, `regions/${index}`);
    unique.set(`${region.minXQuanta}:${region.maxXQuanta}:${region.minZQuanta}:${region.maxZQuanta}`, region);
  });
  return freezeHestiaVegetationValue([...unique.values()].sort(regionCompare));
};

const firstGridCoordinate = (minimum: number): number =>
  Math.ceil(minimum / HESTIA_VEGETATION_GRID_QUANTA) * HESTIA_VEGETATION_GRID_QUANTA;

const jitterForAnchor = (
  rootSeed: string,
  bodyId: string,
  surfaceFrameId: string,
  anchorX: number,
  anchorZ: number,
  axis: "x" | "z"
): number => Math.floor(hestiaVegetationHashUnitFloat({
  domain: "hestia-vegetation-jitter-v1",
  rootSeed,
  bodyId,
  surfaceFrameId,
  anchorX,
  anchorZ,
  axis
}) * (HESTIA_VEGETATION_MAX_JITTER_QUANTA * 2 + 1)) - HESTIA_VEGETATION_MAX_JITTER_QUANTA;

const createCandidate = (
  rootSeed: string,
  bodyId: string,
  surfaceFrameId: string,
  anchorX: number,
  anchorZ: number,
  speciesId: HestiaVegetationSpeciesId
): HestiaVegetationCandidate => {
  const jitterX = jitterForAnchor(rootSeed, bodyId, surfaceFrameId, anchorX, anchorZ, "x");
  const jitterZ = jitterForAnchor(rootSeed, bodyId, surfaceFrameId, anchorX, anchorZ, "z");
  const positionX = globalQuantumCoordinate(anchorX + jitterX, "candidate/positionQuanta/x");
  const positionZ = globalQuantumCoordinate(anchorZ + jitterZ, "candidate/positionQuanta/z");
  const identity = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    rootSeed,
    bodyId,
    surfaceFrameId,
    speciesId,
    anchorQuanta: { x: anchorX, z: anchorZ },
    jitterQuanta: { x: jitterX, z: jitterZ }
  });
  const candidateHash = hashHestiaVegetationCanonical(identity);
  return freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    candidateId: `hestia.vegetation.candidate.v1:${candidateHash.slice(-16)}`,
    speciesId,
    anchorQuanta: {
      x: globalQuantumCoordinate(anchorX, "candidate/anchorQuanta/x"),
      z: globalQuantumCoordinate(anchorZ, "candidate/anchorQuanta/z")
    },
    jitterQuanta: { x: jitterX, z: jitterZ },
    positionQuanta: { x: positionX, z: positionZ },
    positionMeters: {
      x: positionX * MICROVOXEL_BASE_QUANTUM_METERS,
      z: positionZ * MICROVOXEL_BASE_QUANTUM_METERS
    },
    candidateHash
  });
};

export const generateHestiaVegetationCandidates = (
  request: HestiaVegetationCandidateRequest
): HestiaVegetationCandidateSet => {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return vegetationFail("InvalidSample", "request", "Candidate request must be an object.");
  }
  const rootSeed = validateHestiaVegetationAuthorityIdentity(request.rootSeed, "rootSeed");
  const bodyId = validateHestiaVegetationAuthorityIdentity(request.bodyId, "bodyId");
  const surfaceFrameId = validateHestiaVegetationAuthorityIdentity(request.surfaceFrameId, "surfaceFrameId");
  const regions = normalizeRegions(request.regions);
  const speciesIds = normalizeSpeciesIds(request.speciesIds);
  const anchors = new Set<string>();

  for (const region of regions) {
    for (let z = firstGridCoordinate(region.minZQuanta); z < region.maxZQuanta; z += HESTIA_VEGETATION_GRID_QUANTA) {
      for (let x = firstGridCoordinate(region.minXQuanta); x < region.maxXQuanta; x += HESTIA_VEGETATION_GRID_QUANTA) {
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) {
          return vegetationFail("InvalidBounds", "regions", "Grid traversal exceeded safe global quanta.");
        }
        anchors.add(`${x}:${z}`);
      }
    }
  }

  const candidates: HestiaVegetationCandidate[] = [];
  for (const anchor of anchors) {
    const [anchorXText, anchorZText] = anchor.split(":");
    const anchorX = Number(anchorXText);
    const anchorZ = Number(anchorZText);
    for (const speciesId of speciesIds) {
      candidates.push(createCandidate(rootSeed, bodyId, surfaceFrameId, anchorX, anchorZ, speciesId));
    }
  }
  candidates.sort(compareHestiaVegetationCandidates);
  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    candidates: freezeHestiaVegetationValue(candidates)
  });
  return freezeHestiaVegetationValue({
    ...payload,
    contentHash: hashHestiaVegetationCanonical(payload)
  });
};

export const mergeHestiaVegetationCandidateSets = (
  values: readonly HestiaVegetationCandidateSet[]
): HestiaVegetationCandidateSet => {
  const unique = new Map<string, HestiaVegetationCandidate>();
  for (const value of values) {
    for (const candidate of value.candidates) {
      const existing = unique.get(candidate.candidateId);
      if (existing !== undefined && existing.candidateHash !== candidate.candidateHash) {
        return vegetationFail("InvalidSample", "candidateSets", "Candidate ID collision has different canonical content.");
      }
      unique.set(candidate.candidateId, candidate);
    }
  }
  const candidates = freezeHestiaVegetationValue([...unique.values()].sort(compareHestiaVegetationCandidates));
  const payload = freezeHestiaVegetationValue({ schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION, candidates });
  return freezeHestiaVegetationValue({ ...payload, contentHash: hashHestiaVegetationCanonical(payload) });
};

export const createHestiaVegetationHydrologySampler = (
  snapshot: HydrologySnapshot
): HestiaVegetationHydrologySampler => {
  if (!Object.isFrozen(snapshot)) throw new TypeError("snapshot must be a frozen Hydrology snapshot");
  const bodyKinds = new Map(snapshot.waterBodies.map((body) => [body.id, body.kind] as const));
  return (globalXMeters, globalZMeters) => {
    const adjustment = sampleHydrologyTerrainAdjustment(snapshot, globalXMeters, globalZMeters);
    let nearestBodyDistance = Number.POSITIVE_INFINITY;
    for (const body of snapshot.waterBodies) {
      for (const index of body.sampleIndices) {
        const sample = snapshot.samples[index];
        if (sample === undefined) continue;
        nearestBodyDistance = Math.min(nearestBodyDistance, Math.hypot(
          globalXMeters - sample.coordinate.xMeters,
          globalZMeters - sample.coordinate.zMeters
        ));
      }
    }
    const waterKind = adjustment.waterBodyId === undefined
      ? adjustment.waterSurfaceHeight === undefined ? null : "River"
      : bodyKinds.get(adjustment.waterBodyId) ?? null;
    return freezeHestiaVegetationValue({
      ...adjustment,
      waterKind,
      distanceToWaterMeters: Math.min(adjustment.channelDistance, nearestBodyDistance)
    });
  };
};

const finiteHydrologySample = (
  sampler: HestiaVegetationHydrologySampler,
  xMeters: number,
  zMeters: number
): HestiaVegetationHydrologySample | null => {
  try {
    const sample = sampler(xMeters, zMeters);
    if (sample === null || typeof sample !== "object") return null;
    const numbers = [
      sample.channelDepth,
      sample.channelDistance,
      sample.bankBlend,
      sample.adjustedTerrainHeight,
      sample.moisture,
      sample.distanceToWaterMeters
    ];
    if (!numbers.every(Number.isFinite)) return null;
    if (sample.waterSurfaceHeight !== undefined && !Number.isFinite(sample.waterSurfaceHeight)) return null;
    if (sample.waterKind !== null && sample.waterKind !== "River"
      && sample.waterKind !== "Ocean" && sample.waterKind !== "Lake") return null;
    if (sample.moisture < 0 || sample.moisture > 1 || sample.channelDistance < 0 || sample.distanceToWaterMeters < 0) return null;
    return freezeHestiaVegetationValue({ ...sample });
  } catch {
    return null;
  }
};

const slopeDegreesAt = (
  sampler: HestiaVegetationHydrologySampler,
  center: HestiaVegetationHydrologySample,
  xMeters: number,
  zMeters: number
): number | null => {
  const offset = 1;
  const west = finiteHydrologySample(sampler, xMeters - offset, zMeters);
  const east = finiteHydrologySample(sampler, xMeters + offset, zMeters);
  const north = finiteHydrologySample(sampler, xMeters, zMeters - offset);
  const south = finiteHydrologySample(sampler, xMeters, zMeters + offset);
  if (west === null || east === null || north === null || south === null) return null;
  const dx = (east.adjustedTerrainHeight - west.adjustedTerrainHeight) / (offset * 2);
  const dz = (south.adjustedTerrainHeight - north.adjustedTerrainHeight) / (offset * 2);
  const slope = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  return Number.isFinite(slope) && Number.isFinite(center.adjustedTerrainHeight) ? slope : null;
};

interface PlacementFacts {
  readonly hydrology: HestiaVegetationHydrologySample;
  readonly slopeDegrees: number;
  readonly rootQuantum: Readonly<{
    x: GlobalQuantumCoordinate;
    y: GlobalQuantumCoordinate;
    z: GlobalQuantumCoordinate;
  }>;
  readonly terrain: HestiaVegetationTerrainSample;
  readonly materialId: VoxelMaterialId;
  readonly rootMaterialId: StructuralMaterialId;
}

type PlacementEvaluation =
  | Readonly<{ accepted: true; facts: PlacementFacts }>
  | Readonly<{ accepted: false; reason: HestiaVegetationPlacementRejectionReason }>;

const rejected = (reason: HestiaVegetationPlacementRejectionReason): PlacementEvaluation =>
  freezeHestiaVegetationValue({ accepted: false, reason });

const evaluatePlacement = (
  candidate: HestiaVegetationCandidate,
  species: HestiaVegetationSpeciesDefinition,
  request: HestiaVegetationPopulationRequest
): PlacementEvaluation => {
  const hydrology = finiteHydrologySample(request.hydrologySampler, candidate.positionMeters.x, candidate.positionMeters.z);
  if (hydrology === null) return rejected("MissingTerrain");
  const slopeDegrees = slopeDegreesAt(
    request.hydrologySampler,
    hydrology,
    candidate.positionMeters.x,
    candidate.positionMeters.z
  );
  if (slopeDegrees === null) return rejected("MissingTerrain");
  if (slopeDegrees > species.maximumSlopeDegrees) return rejected("SlopeOutOfRange");
  if (hydrology.waterKind === "Ocean" || hydrology.waterKind === "Lake") return rejected("OceanOrLake");
  if (hydrology.channelDistance < species.minimumRiverDistanceMeters
    || hydrology.channelDistance > species.maximumRiverDistanceMeters) {
    return rejected("RiverDistanceOutOfRange");
  }
  if (hydrology.distanceToWaterMeters < species.minimumWaterDistanceMeters
    || hydrology.distanceToWaterMeters > species.maximumWaterDistanceMeters) {
    return rejected("WaterDistanceOutOfRange");
  }
  if (hydrology.moisture < species.minimumMoisture || hydrology.moisture > species.maximumMoisture) {
    return rejected("MoistureOutOfRange");
  }
  const rootY = Math.floor(hydrology.adjustedTerrainHeight / MICROVOXEL_BASE_QUANTUM_METERS);
  if (!Number.isSafeInteger(rootY)) return rejected("MissingTerrain");
  const rootQuantum = freezeHestiaVegetationValue({
    x: candidate.positionQuanta.x,
    y: globalQuantumCoordinate(rootY, "rootQuantum/y"),
    z: candidate.positionQuanta.z
  });
  let terrain: HestiaVegetationTerrainSample | null;
  try {
    terrain = request.terrainSampler(freezeHestiaVegetationValue({
      xMeters: candidate.positionMeters.x,
      zMeters: candidate.positionMeters.z,
      terrainHeightMeters: hydrology.adjustedTerrainHeight,
      rootQuantum
    }));
  } catch {
    terrain = null;
  }
  if (terrain === null || typeof terrain !== "object") return rejected("MissingTerrain");
  if (typeof terrain.materialId !== "number" || !Number.isInteger(terrain.materialId)) return rejected("MissingTerrain");
  if (!species.allowedMaterialIds.includes(terrain.materialId)) return rejected("MaterialNotAllowed");
  let biomeId;
  try {
    biomeId = hestiaVegetationBiomeId(terrain.biomeId);
  } catch {
    return rejected("BiomeNotAllowed");
  }
  if (!species.allowedBiomeIds.includes(biomeId)) return rejected("BiomeNotAllowed");
  let rootMaterialId;
  try {
    rootMaterialId = validateHestiaVegetationRootMaterialId(terrain.rootMaterialId);
  } catch {
    return rejected("MissingTerrain");
  }
  if (rootMaterialId === STRUCTURAL_AIR_MATERIAL_ID) return rejected("AirRoot");
  const normalizedTerrain = freezeHestiaVegetationValue({
    materialId: terrain.materialId,
    biomeId,
    rootMaterialId
  });
  return freezeHestiaVegetationValue({
    accepted: true,
    facts: {
      hydrology,
      slopeDegrees,
      rootQuantum,
      terrain: normalizedTerrain,
      materialId: terrain.materialId,
      rootMaterialId
    }
  });
};

export const hasHestiaVegetationCrownSpacing = (
  candidatePosition: Readonly<{ x: number; z: number }>,
  candidateRadiusMeters: number,
  accepted: readonly HestiaVegetationInstance[]
): boolean => accepted.every((instance) => Math.hypot(
  candidatePosition.x - instance.positionMeters.x,
  candidatePosition.z - instance.positionMeters.z
) >= candidateRadiusMeters + instance.crownRadiusMeters);

const compareCrownPriority = (
  left: HestiaVegetationCandidate,
  right: HestiaVegetationCandidate
): number => codeUnitCompare(left.candidateHash, right.candidateHash)
  || compareHestiaVegetationCandidates(left, right);

const winsGlobalCrownCompetition = (
  candidate: HestiaVegetationCandidate,
  species: HestiaVegetationSpeciesDefinition,
  speciesIds: readonly HestiaVegetationSpeciesId[],
  request: HestiaVegetationPopulationRequest,
  placementCache: Map<string, PlacementEvaluation>
): boolean => {
  for (let anchorZOffset = -1; anchorZOffset <= 1; anchorZOffset += 1) {
    for (let anchorXOffset = -1; anchorXOffset <= 1; anchorXOffset += 1) {
      const anchorX = candidate.anchorQuanta.x + anchorXOffset * HESTIA_VEGETATION_GRID_QUANTA;
      const anchorZ = candidate.anchorQuanta.z + anchorZOffset * HESTIA_VEGETATION_GRID_QUANTA;
      if (!Number.isSafeInteger(anchorX) || !Number.isSafeInteger(anchorZ)) continue;
      for (const neighborSpeciesId of speciesIds) {
        const neighbor = createCandidate(
          request.rootSeed,
          request.bodyId,
          request.surfaceFrameId,
          anchorX,
          anchorZ,
          neighborSpeciesId
        );
        if (neighbor.candidateId === candidate.candidateId) continue;
        const neighborSpecies = getHestiaVegetationSpecies(neighbor.speciesId);
        const separation = Math.hypot(
          candidate.positionMeters.x - neighbor.positionMeters.x,
          candidate.positionMeters.z - neighbor.positionMeters.z
        );
        if (separation >= species.crownRadiusMeters + neighborSpecies.crownRadiusMeters) continue;
        let neighborEvaluation = placementCache.get(neighbor.candidateId);
        if (neighborEvaluation === undefined) {
          neighborEvaluation = evaluatePlacement(neighbor, neighborSpecies, request);
          placementCache.set(neighbor.candidateId, neighborEvaluation);
        }
        if (neighborEvaluation.accepted && compareCrownPriority(neighbor, candidate) < 0) return false;
      }
    }
  }
  return true;
};

const createInstance = (
  candidate: HestiaVegetationCandidate,
  species: HestiaVegetationSpeciesDefinition,
  facts: PlacementFacts
): HestiaVegetationInstance => {
  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    speciesId: species.id,
    positionMeters: {
      x: candidate.positionMeters.x,
      y: facts.hydrology.adjustedTerrainHeight,
      z: candidate.positionMeters.z
    },
    rootQuantum: facts.rootQuantum,
    slopeDegrees: facts.slopeDegrees,
    moisture: facts.hydrology.moisture,
    materialId: facts.materialId,
    biomeId: hestiaVegetationBiomeId(facts.terrain.biomeId),
    rootMaterialId: facts.rootMaterialId,
    crownRadiusMeters: species.crownRadiusMeters
  });
  const instanceHash = hashHestiaVegetationCanonical(payload);
  return freezeHestiaVegetationValue({
    ...payload,
    instanceId: `hestia.vegetation.instance.v1:${instanceHash.slice(-16)}`,
    instanceHash
  });
};

export const populateHestiaVegetation = (
  request: HestiaVegetationPopulationRequest
): HestiaVegetationPopulation => {
  if (typeof request.hydrologySampler !== "function" || typeof request.terrainSampler !== "function") {
    return vegetationFail("InvalidSample", "request", "Population requires hydrology and terrain samplers.");
  }
  const budget = validateHestiaVegetationBudget(request.budget);
  const candidateSet = generateHestiaVegetationCandidates(request);
  const speciesIds = normalizeSpeciesIds(request.speciesIds);
  const instances: HestiaVegetationInstance[] = [];
  const rejections: HestiaVegetationPlacementRejection[] = [];
  const placementCache = new Map<string, PlacementEvaluation>();
  let usedCrownAreaSquareMeters = 0;

  for (const candidate of candidateSet.candidates) {
    const species = getHestiaVegetationSpecies(candidate.speciesId);
    let evaluation = placementCache.get(candidate.candidateId);
    if (evaluation === undefined) {
      evaluation = evaluatePlacement(candidate, species, request);
      placementCache.set(candidate.candidateId, evaluation);
    }
    let reason: HestiaVegetationPlacementRejectionReason | null = null;
    if (!evaluation.accepted) {
      reason = evaluation.reason;
    } else if (!winsGlobalCrownCompetition(candidate, species, speciesIds, request, placementCache)) {
      reason = "CrownSpacing";
    } else {
      const crownArea = Math.PI * species.crownRadiusMeters ** 2;
      if (instances.length >= budget.maxInstances
        || usedCrownAreaSquareMeters + crownArea > budget.maxCrownAreaSquareMeters) {
        reason = "BudgetExceeded";
      } else {
        instances.push(createInstance(candidate, species, evaluation.facts));
        usedCrownAreaSquareMeters += crownArea;
      }
    }
    if (reason !== null) {
      rejections.push(freezeHestiaVegetationValue({
        candidateId: candidate.candidateId,
        candidateHash: candidate.candidateHash,
        reason
      }));
    }
  }

  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    candidateSetHash: candidateSet.contentHash,
    instances: freezeHestiaVegetationValue(instances),
    rejections: freezeHestiaVegetationValue(rejections),
    usedCrownAreaSquareMeters
  });
  return freezeHestiaVegetationValue({
    ...payload,
    populationHash: hashHestiaVegetationCanonical(payload)
  });
};
