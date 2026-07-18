import { HESTIA_MATERIAL_IDS } from "../preset";
import {
  HESTIA_VEGETATION_SPECIES_IDS,
  type HestiaVegetationSpeciesDefinition,
  type HestiaVegetationSpeciesId
} from "./contracts";
import { freezeHestiaVegetationValue } from "./canonical";
import { hestiaVegetationSpeciesId } from "./validation";

export const HESTIA_VEGETATION_SPECIES_REGISTRY: readonly HestiaVegetationSpeciesDefinition[] =
  freezeHestiaVegetationValue([
    {
      id: "hestia.umbrella-tree.v1",
      maximumSlopeDegrees: 28,
      minimumMoisture: 0.45,
      maximumMoisture: 1,
      minimumRiverDistanceMeters: 3,
      maximumRiverDistanceMeters: 64,
      minimumWaterDistanceMeters: 2,
      maximumWaterDistanceMeters: 80,
      crownRadiusMeters: 3,
      allowedMaterialIds: [
        HESTIA_MATERIAL_IDS.WetSoil,
        HESTIA_MATERIAL_IDS.MossCover,
        HESTIA_MATERIAL_IDS.DenseBiologicalSurface
      ],
      allowedBiomeIds: ["hestia.biome.mist-forest.v1", "hestia.biome.wetland.v1"]
    },
    {
      id: "hestia.mist-sprout.v1",
      maximumSlopeDegrees: 40,
      minimumMoisture: 0.6,
      maximumMoisture: 1,
      minimumRiverDistanceMeters: 1,
      maximumRiverDistanceMeters: 36,
      minimumWaterDistanceMeters: 1,
      maximumWaterDistanceMeters: 48,
      crownRadiusMeters: 0.8,
      allowedMaterialIds: [
        HESTIA_MATERIAL_IDS.WetSoil,
        HESTIA_MATERIAL_IDS.MossCover,
        HESTIA_MATERIAL_IDS.DenseBiologicalSurface
      ],
      allowedBiomeIds: [
        "hestia.biome.mist-forest.v1",
        "hestia.biome.wetland.v1",
        "hestia.biome.biological-glade.v1"
      ]
    },
    {
      id: "hestia.luminous-cap.v1",
      maximumSlopeDegrees: 34,
      minimumMoisture: 0.5,
      maximumMoisture: 1,
      minimumRiverDistanceMeters: 1.5,
      maximumRiverDistanceMeters: 52,
      minimumWaterDistanceMeters: 1,
      maximumWaterDistanceMeters: 60,
      crownRadiusMeters: 1.1,
      allowedMaterialIds: [HESTIA_MATERIAL_IDS.MossCover, HESTIA_MATERIAL_IDS.DenseBiologicalSurface],
      allowedBiomeIds: ["hestia.biome.mist-forest.v1", "hestia.biome.biological-glade.v1"]
    }
  ] satisfies readonly HestiaVegetationSpeciesDefinition[]);

if (HESTIA_VEGETATION_SPECIES_REGISTRY.length !== HESTIA_VEGETATION_SPECIES_IDS.length
  || HESTIA_VEGETATION_SPECIES_REGISTRY.some((entry, index) => entry.id !== HESTIA_VEGETATION_SPECIES_IDS[index])) {
  throw new TypeError("Hestia vegetation registry order must match the exact V1 species order.");
}

export const getHestiaVegetationSpecies = (
  value: HestiaVegetationSpeciesId | string
): HestiaVegetationSpeciesDefinition => {
  const id = hestiaVegetationSpeciesId(value);
  const definition = HESTIA_VEGETATION_SPECIES_REGISTRY.find((entry) => entry.id === id);
  if (definition === undefined) throw new TypeError("Validated Hestia vegetation species is missing from the registry.");
  return definition;
};
