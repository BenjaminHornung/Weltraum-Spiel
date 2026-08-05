import type { PaletteRecord } from "./types";

export const VoxelMaterial = Object.freeze({
  Air: 0,
  MossGrass: 1,
  Soil: 2,
  LightRock: 3,
  DarkWetRock: 4,
  Sand: 5,
  WetBoundary: 6,
  Wood: 7,
  Leaves: 8,
  FloraCoral: 9,
  FloraAzure: 10,
  FloraGold: 11
} as const);

export const HESTIA_V2_PALETTE: readonly PaletteRecord[] = Object.freeze([
  Object.freeze({ id: 0, name: "Air", baseColor: "#000000", roughness: 1, emissive: 0, physicalClass: "air", destructible: false }),
  Object.freeze({ id: 1, name: "Moss Grass", baseColor: "#3f8f4d", roughness: 0.94, emissive: 0, physicalClass: "soil", destructible: true }),
  Object.freeze({ id: 2, name: "Rich Soil", baseColor: "#66513a", roughness: 1, emissive: 0, physicalClass: "soil", destructible: true }),
  Object.freeze({ id: 3, name: "Light Strata Rock", baseColor: "#b9b8a4", roughness: 0.86, emissive: 0, physicalClass: "rock", destructible: true }),
  Object.freeze({ id: 4, name: "Dark Wet Rock", baseColor: "#41545a", roughness: 0.78, emissive: 0, physicalClass: "rock", destructible: true }),
  Object.freeze({ id: 5, name: "Pale Sand", baseColor: "#c9bd8b", roughness: 0.96, emissive: 0, physicalClass: "sand", destructible: true }),
  Object.freeze({ id: 6, name: "Wet Shore Boundary", baseColor: "#497f78", roughness: 0.7, emissive: 0, physicalClass: "wet", destructible: true }),
  Object.freeze({ id: 7, name: "Hestia Wood", baseColor: "#765038", roughness: 0.92, emissive: 0, physicalClass: "wood", destructible: true }),
  Object.freeze({ id: 8, name: "Broad Leaves", baseColor: "#2e7446", roughness: 0.88, emissive: 0, physicalClass: "foliage", destructible: true }),
  Object.freeze({ id: 9, name: "Coral Flora", baseColor: "#d45f74", roughness: 0.82, emissive: 0.08, physicalClass: "flora", destructible: true }),
  Object.freeze({ id: 10, name: "Azure Flora", baseColor: "#4ac4ce", roughness: 0.76, emissive: 0.12, physicalClass: "flora", destructible: true }),
  Object.freeze({ id: 11, name: "Gold Flora", baseColor: "#e7bd55", roughness: 0.84, emissive: 0.08, physicalClass: "flora", destructible: true })
] satisfies readonly PaletteRecord[]);

export const paletteRecord = (id: number): PaletteRecord => {
  const record = HESTIA_V2_PALETTE[id];
  if (!record || record.id !== id) throw new Error(`Unknown V2 material ${id}.`);
  return record;
};

export const validatePalette = (palette: readonly PaletteRecord[] = HESTIA_V2_PALETTE): void => {
  if (palette.length !== 12 || palette[0]?.id !== VoxelMaterial.Air || palette[0].physicalClass !== "air") {
    throw new Error("V2 palette must contain the complete stable 12-material layout with Air at zero.");
  }
  const ids = new Set<number>();
  for (let index = 0; index < palette.length; index += 1) {
    const record = palette[index];
    if (
      !record || record.id !== index || ids.has(record.id) || record.name.length === 0
      || !/^#[0-9a-f]{6}$/i.test(record.baseColor)
      || !Number.isFinite(record.roughness) || record.roughness < 0 || record.roughness > 1
      || !Number.isFinite(record.emissive) || record.emissive < 0
    ) {
      throw new Error(`Invalid V2 palette record at ${index}.`);
    }
    ids.add(record.id);
  }
};
