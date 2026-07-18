import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HESTIA_MATERIAL_IDS } from "../../src/world-generation/hestia/preset";
import {
  HESTIA_VEGETATION_GRID_METERS,
  HESTIA_VEGETATION_GRID_QUANTA,
  HESTIA_VEGETATION_MAX_JITTER_METERS,
  HESTIA_VEGETATION_MAX_JITTER_QUANTA,
  HESTIA_VEGETATION_SPECIES_IDS,
  HESTIA_VEGETATION_SPECIES_REGISTRY,
  HestiaVegetationError,
  canonicalHestiaVegetationJson,
  createHestiaVegetationProxy,
  compareHestiaVegetationCandidates,
  generateHestiaVegetationCandidates,
  getHestiaVegetationSpecies,
  hestiaVegetationSpeciesId,
  isHestiaVegetationValueFrozen,
  mergeHestiaVegetationCandidateSets,
  populateHestiaVegetation,
  type HestiaVegetationHydrologySample,
  type HestiaVegetationInstance,
  type HestiaVegetationPopulationRequest,
  type HestiaVegetationRegionBounds,
  type HestiaVegetationTerrainSample
} from "../../src/world-generation/hestia/vegetation";

const region = (
  minXQuanta: number,
  maxXQuanta: number,
  minZQuanta: number,
  maxZQuanta: number
): HestiaVegetationRegionBounds => ({ minXQuanta, maxXQuanta, minZQuanta, maxZQuanta });

const hydrologySample = (
  xMeters: number,
  zMeters: number,
  overrides: Partial<HestiaVegetationHydrologySample> = {}
): HestiaVegetationHydrologySample => Object.freeze({
  channelDepth: 0,
  channelDistance: 12,
  bankBlend: 0,
  adjustedTerrainHeight: 7.375 + xMeters * 0 + zMeters * 0,
  moisture: 0.8,
  waterKind: null,
  distanceToWaterMeters: 10,
  ...overrides
});

const terrainSample = (
  overrides: Partial<HestiaVegetationTerrainSample> = {}
): HestiaVegetationTerrainSample => ({
  materialId: HESTIA_MATERIAL_IDS.WetSoil,
  biomeId: "hestia.biome.mist-forest.v1",
  rootMaterialId: 1,
  ...overrides
});

const populationRequest = (
  overrides: Partial<HestiaVegetationPopulationRequest> = {}
): HestiaVegetationPopulationRequest => ({
  rootSeed: "hestia-vegetation-unit-v1",
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  regions: [region(0, 144, 0, 96)],
  speciesIds: ["hestia.umbrella-tree.v1"],
  hydrologySampler: (xMeters, zMeters) => hydrologySample(xMeters, zMeters),
  terrainSampler: () => terrainSample(),
  budget: { maxInstances: 100, maxCrownAreaSquareMeters: 10_000 },
  ...overrides
});

const recursivelyExpectFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) recursivelyExpectFrozen(child, seen);
};

describe("Structural Hestia vegetation Phase 1 mandatory checks", () => {
  it("[01] exposes exactly the three species in stable registry order", () => {
    expect(HESTIA_VEGETATION_SPECIES_IDS).toEqual([
      "hestia.umbrella-tree.v1",
      "hestia.mist-sprout.v1",
      "hestia.luminous-cap.v1"
    ]);
    expect(HESTIA_VEGETATION_SPECIES_REGISTRY.map((entry) => entry.id)).toEqual(HESTIA_VEGETATION_SPECIES_IDS);
    expect(new Set(HESTIA_VEGETATION_SPECIES_REGISTRY.map((entry) => entry.id)).size).toBe(3);
    expect(Object.isFrozen(HESTIA_VEGETATION_SPECIES_REGISTRY)).toBe(true);
    expect(getHestiaVegetationSpecies("hestia.umbrella-tree.v1").id).toBe("hestia.umbrella-tree.v1");
  });

  it("[02] validates exact species identities and rejects unknown or malformed IDs", () => {
    for (const id of HESTIA_VEGETATION_SPECIES_IDS) expect(hestiaVegetationSpeciesId(id)).toBe(id);
    for (const invalid of [
      "hestia.unknown.v1",
      "hestia.umbrella_tree.v1",
      "hestia.umbrella-tree.v2",
      " hestia.umbrella-tree.v1",
      ""
    ]) {
      expect(() => hestiaVegetationSpeciesId(invalid)).toThrow(HestiaVegetationError);
    }
  });

  it("[03] produces deterministic population identities, ordering, and hashes", () => {
    const first = populateHestiaVegetation(populationRequest());
    const second = populateHestiaVegetation(populationRequest());
    expect(first.instances.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(second.populationHash).toBe(first.populationHash);
    expect(second.instances.map((entry) => entry.instanceId)).toEqual(first.instances.map((entry) => entry.instanceId));
    expect(second.instances.map((entry) => entry.instanceHash)).toEqual(first.instances.map((entry) => entry.instanceHash));
    const candidates = generateHestiaVegetationCandidates(populationRequest({
      speciesIds: [...HESTIA_VEGETATION_SPECIES_IDS]
    })).candidates;
    expect(candidates.every((entry, index) => index === 0
      || compareHestiaVegetationCandidates(candidates[index - 1]!, entry) <= 0)).toBe(true);
  });

  it("[04] normalizes equivalent region and species input ordering", () => {
    const first = populateHestiaVegetation(populationRequest({
      regions: [region(0, 72, 0, 96), region(72, 144, 0, 96)],
      speciesIds: ["hestia.umbrella-tree.v1", "hestia.mist-sprout.v1"]
    }));
    const second = populateHestiaVegetation(populationRequest({
      regions: [region(72, 144, 0, 96), region(0, 72, 0, 96)],
      speciesIds: ["hestia.mist-sprout.v1", "hestia.umbrella-tree.v1", "hestia.mist-sprout.v1"]
    }));
    expect(second).toEqual(first);
    expect(second.populationHash).toBe(first.populationHash);
  });

  it("[05] owns candidates by unjittered global anchors and deduplicates overlap", () => {
    const request = populationRequest({
      regions: [region(0, 96, 0, 96), region(48, 144, 0, 96)]
    });
    const set = generateHestiaVegetationCandidates(request);
    expect(new Set(set.candidates.map((candidate) => candidate.candidateId)).size).toBe(set.candidates.length);
    expect(set.candidates.every((candidate) => candidate.anchorQuanta.x % HESTIA_VEGETATION_GRID_QUANTA === 0
      && candidate.anchorQuanta.z % HESTIA_VEGETATION_GRID_QUANTA === 0)).toBe(true);
    expect(HESTIA_VEGETATION_GRID_QUANTA).toBe(48);
    expect(HESTIA_VEGETATION_GRID_METERS).toBe(6);
  });

  it("[06] keeps deterministic jitter inside plus or minus two metres", () => {
    const set = generateHestiaVegetationCandidates(populationRequest({
      regions: [region(-144, 144, -144, 144)],
      speciesIds: [...HESTIA_VEGETATION_SPECIES_IDS]
    }));
    expect(set.candidates.length).toBeGreaterThan(0);
    for (const candidate of set.candidates) {
      expect(Math.abs(candidate.jitterQuanta.x)).toBeLessThanOrEqual(HESTIA_VEGETATION_MAX_JITTER_QUANTA);
      expect(Math.abs(candidate.jitterQuanta.z)).toBeLessThanOrEqual(HESTIA_VEGETATION_MAX_JITTER_QUANTA);
      expect(Math.abs(candidate.positionMeters.x - candidate.anchorQuanta.x * 0.125))
        .toBeLessThanOrEqual(HESTIA_VEGETATION_MAX_JITTER_METERS);
      expect(Math.abs(candidate.positionMeters.z - candidate.anchorQuanta.z * 0.125))
        .toBeLessThanOrEqual(HESTIA_VEGETATION_MAX_JITTER_METERS);
    }
  });

  it("[07] rejects Ocean and Lake placement before creating an instance", () => {
    for (const waterKind of ["Ocean", "Lake"] as const) {
      const result = populateHestiaVegetation(populationRequest({
        regions: [region(0, 1, 0, 1)],
        hydrologySampler: (xMeters, zMeters) => hydrologySample(xMeters, zMeters, { waterKind })
      }));
      expect(result.instances).toEqual([]);
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0]?.reason).toBe("OceanOrLake");
    }
  });

  it("[08] applies river, water, moisture, and slope gates", () => {
    const cases: readonly [Partial<HestiaVegetationHydrologySample>, string][] = [
      [{ channelDistance: 0.5 }, "RiverDistanceOutOfRange"],
      [{ distanceToWaterMeters: 0.5 }, "WaterDistanceOutOfRange"],
      [{ moisture: 0.1 }, "MoistureOutOfRange"]
    ];
    for (const [sampleOverride, reason] of cases) {
      const result = populateHestiaVegetation(populationRequest({
        regions: [region(0, 1, 0, 1)],
        hydrologySampler: (xMeters, zMeters) => hydrologySample(xMeters, zMeters, sampleOverride)
      }));
      expect(result.instances).toEqual([]);
      expect(result.rejections[0]?.reason).toBe(reason);
    }
    const steep = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      hydrologySampler: (xMeters, zMeters) => hydrologySample(xMeters, zMeters, {
        adjustedTerrainHeight: xMeters * 2
      })
    }));
    expect(steep.instances).toEqual([]);
    expect(steep.rejections[0]?.reason).toBe("SlopeOutOfRange");

    const wrongMaterial = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      terrainSampler: () => terrainSample({ materialId: HESTIA_MATERIAL_IDS.SolidRock })
    }));
    expect(wrongMaterial.instances).toEqual([]);
    expect(wrongMaterial.rejections[0]?.reason).toBe("MaterialNotAllowed");

    const wrongBiome = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      terrainSampler: () => terrainSample({ biomeId: "hestia.biome.biological-glade.v1" })
    }));
    expect(wrongBiome.instances).toEqual([]);
    expect(wrongBiome.rejections[0]?.reason).toBe("BiomeNotAllowed");
  });

  it("[09] fails closed for missing or non-finite terrain", () => {
    const missing = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      hydrologySampler: () => null
    }));
    expect(missing.instances).toEqual([]);
    expect(missing.rejections[0]?.reason).toBe("MissingTerrain");

    const nonFinite = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      hydrologySampler: (xMeters, zMeters) => hydrologySample(xMeters, zMeters, {
        adjustedTerrainHeight: Number.NaN
      })
    }));
    expect(nonFinite.instances).toEqual([]);
    expect(nonFinite.rejections[0]?.reason).toBe("MissingTerrain");
  });

  it("[09] fails closed when hydrology waterKind is missing or outside the exact contract", () => {
    const validSample = hydrologySample(0, 0);
    const { waterKind: _waterKind, ...missingWaterKind } = validSample;
    const malformedSamples = [
      missingWaterKind,
      { ...validSample, waterKind: "Bog" }
    ];

    for (const malformedSample of malformedSamples) {
      const result = populateHestiaVegetation(populationRequest({
        regions: [region(0, 1, 0, 1)],
        hydrologySampler: () => malformedSample as HestiaVegetationHydrologySample
      }));
      expect(result.instances).toEqual([]);
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0]?.reason).toBe("MissingTerrain");
    }
  });

  it("[10] rejects Air roots and grounds accepted instances at finite terrain", () => {
    const air = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      terrainSampler: () => terrainSample({ rootMaterialId: 0 })
    }));
    expect(air.instances).toEqual([]);
    expect(air.rejections[0]?.reason).toBe("AirRoot");

    const accepted = populateHestiaVegetation(populationRequest());
    expect(accepted.instances.length).toBeGreaterThan(0);
    expect(accepted.instances.every((instance) => instance.positionMeters.y === 7.375)).toBe(true);
    expect(accepted.instances.every((instance) => instance.rootQuantum.y === Math.floor(7.375 / 0.125))).toBe(true);
    expect(accepted.instances.every((instance) => Number.isFinite(instance.positionMeters.y))).toBe(true);
  });

  it("[11] enforces crown spacing in canonical candidate order", () => {
    const result = populateHestiaVegetation(populationRequest({
      regions: [region(0, 1, 0, 1)],
      speciesIds: ["hestia.umbrella-tree.v1", "hestia.mist-sprout.v1"]
    }));
    expect(result.instances).toHaveLength(1);
    expect(result.rejections.some((entry) => entry.reason === "CrownSpacing")).toBe(true);
  });

  it("[12] rejects every otherwise-valid candidate when either explicit budget is exhausted", () => {
    const countBudget = populateHestiaVegetation(populationRequest({
      budget: { maxInstances: 0, maxCrownAreaSquareMeters: 10_000 }
    }));
    expect(countBudget.instances).toEqual([]);
    expect(countBudget.rejections.some((entry) => entry.reason === "BudgetExceeded")).toBe(true);

    const areaBudget = populateHestiaVegetation(populationRequest({
      budget: { maxInstances: 10, maxCrownAreaSquareMeters: 1 }
    }));
    expect(areaBudget.instances).toEqual([]);
    expect(areaBudget.rejections.some((entry) => entry.reason === "BudgetExceeded")).toBe(true);
  });

  it("[16] emits a stable multi-part Umbrella trunk, branch, and canopy proxy", () => {
    const population = populateHestiaVegetation(populationRequest());
    const instance = population.instances[0];
    if (instance === undefined) throw new Error("Expected Umbrella instance fixture.");
    const first = createHestiaVegetationProxy(instance);
    const second = createHestiaVegetationProxy(instance);
    expect(second).toEqual(first);
    expect(first.parts.length).toBeGreaterThan(8);
    expect(first.parts.some((part) => part.role === "trunk")).toBe(true);
    expect(first.parts.some((part) => part.role === "branch")).toBe(true);
    expect(first.parts.filter((part) => part.role === "canopy").length).toBeGreaterThan(1);
    expect(first.parts.every((part) => part.shape !== ("sphere" as never) && part.shape !== ("cone" as never))).toBe(true);
    expect(new Set(first.parts.map((part) => part.partId)).size).toBe(first.parts.length);

    const speciesInstances = HESTIA_VEGETATION_SPECIES_IDS.map((speciesId, index) => Object.freeze({
      ...instance,
      speciesId,
      instanceId: `hestia.vegetation.instance.v1:proxy-species-${index}`,
      instanceHash: `fnv1a64-v1:proxy-species-${index}`
    }) as HestiaVegetationInstance);
    const speciesProxies = speciesInstances.map(createHestiaVegetationProxy);
    expect(speciesProxies.map((proxy) => proxy.speciesId)).toEqual(HESTIA_VEGETATION_SPECIES_IDS);
    expect(speciesProxies.every((proxy) => proxy.parts.length > 1)).toBe(true);

    for (const invalidSpeciesId of ["hestia.unknown.v1", "malformed species"] as const) {
      const invalidInstance = { ...instance, speciesId: invalidSpeciesId } as unknown as HestiaVegetationInstance;
      let failure: unknown;
      try {
        createHestiaVegetationProxy(invalidInstance);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(HestiaVegetationError);
      expect(failure).toMatchObject({ code: "InvalidSpeciesId", path: "speciesId" });
    }
  });

  it("[25] preserves canonical candidate and population unions across region subdivision", () => {
    const unsplitRequest = populationRequest({ regions: [region(0, 144, 0, 96)] });
    const splitRequest = populationRequest({
      regions: [region(72, 144, 0, 96), region(0, 72, 0, 96)]
    });
    const unsplitCandidates = generateHestiaVegetationCandidates(unsplitRequest);
    const left = generateHestiaVegetationCandidates(populationRequest({ regions: [region(0, 72, 0, 96)] }));
    const right = generateHestiaVegetationCandidates(populationRequest({ regions: [region(72, 144, 0, 96)] }));
    const merged = mergeHestiaVegetationCandidateSets([right, left]);
    expect(merged).toEqual(unsplitCandidates);
    const unsplitPopulation = populateHestiaVegetation(unsplitRequest);
    expect(populateHestiaVegetation(splitRequest)).toEqual(unsplitPopulation);
    const splitPopulationUnion = [
      ...populateHestiaVegetation(populationRequest({ regions: [region(0, 72, 0, 96)] })).instances,
      ...populateHestiaVegetation(populationRequest({ regions: [region(72, 144, 0, 96)] })).instances
    ].sort((leftInstance, rightInstance) => leftInstance.candidateHash < rightInstance.candidateHash ? -1 : 1);
    const unsplitPopulationUnion = [...unsplitPopulation.instances]
      .sort((leftInstance, rightInstance) => leftInstance.candidateHash < rightInstance.candidateHash ? -1 : 1);
    expect(splitPopulationUnion).toEqual(unsplitPopulationUnion);
  });

  it("[26] does not mutate candidate, population, or sampler-owned inputs", () => {
    const mutableRegions = [region(72, 144, 0, 96), region(0, 72, 0, 96)];
    const mutableSpecies = ["hestia.umbrella-tree.v1", "hestia.mist-sprout.v1"];
    const mutableBudget = { maxInstances: 10, maxCrownAreaSquareMeters: 1_000 };
    const mutableTerrain = terrainSample();
    const before = JSON.stringify({ mutableRegions, mutableSpecies, mutableBudget, mutableTerrain });
    populateHestiaVegetation(populationRequest({
      regions: mutableRegions,
      speciesIds: mutableSpecies,
      budget: mutableBudget,
      terrainSampler: () => mutableTerrain
    }));
    expect(JSON.stringify({ mutableRegions, mutableSpecies, mutableBudget, mutableTerrain })).toBe(before);
    expect(Object.isFrozen(mutableRegions)).toBe(false);
    expect(Object.isFrozen(mutableBudget)).toBe(false);
    expect(Object.isFrozen(mutableTerrain)).toBe(false);
  });

  it("[27] returns recursively frozen candidates, populations, instances, and proxies", () => {
    const candidates = generateHestiaVegetationCandidates(populationRequest());
    const population = populateHestiaVegetation(populationRequest());
    const proxy = createHestiaVegetationProxy(population.instances[0]!);
    expect(isHestiaVegetationValueFrozen(candidates)).toBe(true);
    expect(isHestiaVegetationValueFrozen(population)).toBe(true);
    expect(isHestiaVegetationValueFrozen(proxy)).toBe(true);
    recursivelyExpectFrozen(candidates);
    recursivelyExpectFrozen(population);
    recursivelyExpectFrozen(proxy);
    expect(canonicalHestiaVegetationJson(population)).toContain(population.populationHash);
  });

  it("[28] keeps the authority free of Three.js, DOM, Date, and random APIs", () => {
    const sourceDirectory = resolve(process.cwd(), "src/world-generation/hestia/vegetation");
    const sources = readdirSync(sourceDirectory)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(resolve(sourceDirectory, name), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/from\s+["']three(?:\/|["'])/);
    expect(sources).not.toMatch(/\b(?:window|document|navigator|HTMLElement)\b/);
    expect(sources).not.toMatch(/\bDate\b/);
    expect(sources).not.toContain("Math.random");
  });
});
