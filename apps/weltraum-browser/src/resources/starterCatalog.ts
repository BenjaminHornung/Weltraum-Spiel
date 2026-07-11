import { createResourceCategory, type ResourceCategory } from "./categories";
import { createResourceCatalog, type ResourceCatalog } from "./catalog";
import { createResourceCatalogId } from "./ids";
import { createResourceDefinition, type ResourceDefinition } from "./types";

export const STARTER_RESOURCE_CATALOG_ID = createResourceCatalogId("starter_resource_catalog_v1");

export const starterResourceCategories: readonly ResourceCategory[] = Object.freeze([
  createResourceCategory({ categoryId: "raw_ore", label: "Raw Ore" }),
  createResourceCategory({ categoryId: "volatile_fuel", label: "Volatile Fuel" }),
  createResourceCategory({ categoryId: "component", label: "Component" }),
  createResourceCategory({ categoryId: "refined_material", label: "Refined Material" }),
  createResourceCategory({ categoryId: "fuel", label: "Fuel" }),
  createResourceCategory({ categoryId: "ammo_material", label: "Ammo Material" }),
  createResourceCategory({ categoryId: "research_sample", label: "Research Sample" }),
  createResourceCategory({ categoryId: "mission_cargo", label: "Mission Cargo" })
]);

export const starterResourceDefinitions: readonly ResourceDefinition[] = Object.freeze([
  // Provisional balance: heavy, low-value bulk ore makes cargo mass meaningful before playtest tuning.
  createResourceDefinition({
    resourceId: "ore_iron_silicate",
    displayName: "Iron-Silicate Ore",
    categoryId: "raw_ore",
    massPerUnitKg: 8,
    volumePerUnitM3: 0.004,
    baseValueCredits: 4,
    stackRule: { kind: "Bulk", maxQuantity: 500, splitAllowed: true },
    rarityTier: "Common",
    tags: ["ore", "bulk", "refinable", "builder", "legal_public"],
    hazardFlags: [],
    legalStatus: "Legal",
    ownershipImplication: "ClaimedCargo",
    defaultUse: "ship_builder",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: ice is a bulky volatile input for early life-support and fuel routes.
  createResourceDefinition({
    resourceId: "volatile_water_ice",
    displayName: "Water Ice",
    categoryId: "volatile_fuel",
    massPerUnitKg: 1,
    volumePerUnitM3: 0.0012,
    baseValueCredits: 6,
    stackRule: { kind: "Bulk", maxQuantity: 500, splitAllowed: true },
    rarityTier: "Common",
    tags: ["volatile", "fuel_input", "life_support", "bulk"],
    hazardFlags: ["volatile"],
    legalStatus: "Legal",
    ownershipImplication: "ClaimedCargo",
    defaultUse: "fuel_input",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: compact salvage has a useful repair value without becoming a large crafting table.
  createResourceDefinition({
    resourceId: "component_scrap_electronics",
    displayName: "Scrap Electronics",
    categoryId: "component",
    massPerUnitKg: 0.75,
    volumePerUnitM3: 0.001,
    baseValueCredits: 24,
    stackRule: { kind: "Bulk", maxQuantity: 50, splitAllowed: true },
    rarityTier: "Uncommon",
    tags: ["salvage", "electronics", "repair", "builder"],
    hazardFlags: [],
    legalStatus: "Legal",
    ownershipImplication: "SalvageOwned",
    defaultUse: "repair",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: plates are a medium-density early bridge from ore to construction and repair.
  createResourceDefinition({
    resourceId: "material_structural_plate",
    displayName: "Structural Plate",
    categoryId: "refined_material",
    massPerUnitKg: 5,
    volumePerUnitM3: 0.003,
    baseValueCredits: 30,
    stackRule: { kind: "Bulk", maxQuantity: 100, splitAllowed: true },
    rarityTier: "Common",
    tags: ["builder", "repair", "outpost", "refined"],
    hazardFlags: [],
    legalStatus: "Legal",
    ownershipImplication: "None",
    defaultUse: "ship_builder",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: propellant remains low-value but needs a volatile-compatible container policy later.
  createResourceDefinition({
    resourceId: "fuel_refined_propellant",
    displayName: "Refined Propellant",
    categoryId: "fuel",
    massPerUnitKg: 1,
    volumePerUnitM3: 0.0013,
    baseValueCredits: 8,
    stackRule: { kind: "Bulk", maxQuantity: 1000, splitAllowed: true },
    rarityTier: "Common",
    tags: ["fuel", "volatile", "ship_consumable", "regulated"],
    hazardFlags: ["volatile"],
    legalStatus: "Restricted",
    ownershipImplication: "None",
    defaultUse: "fuel",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: compact explosive powder creates an early restricted ammunition cost.
  createResourceDefinition({
    resourceId: "ammo_ballistic_powder",
    displayName: "Ballistic Powder",
    categoryId: "ammo_material",
    massPerUnitKg: 0.5,
    volumePerUnitM3: 0.0006,
    baseValueCredits: 18,
    stackRule: { kind: "Bulk", maxQuantity: 100, splitAllowed: true },
    rarityTier: "Uncommon",
    tags: ["ammo", "explosive", "restricted"],
    hazardFlags: ["explosive"],
    legalStatus: "Restricted",
    ownershipImplication: "None",
    defaultUse: "ammo",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: a small, high-value discrete sample fits suit inventory and research contracts.
  createResourceDefinition({
    resourceId: "sample_geology_core",
    displayName: "Geology Core Sample",
    categoryId: "research_sample",
    massPerUnitKg: 0.25,
    volumePerUnitM3: 0.0004,
    baseValueCredits: 120,
    stackRule: { kind: "Discrete", maxQuantity: 1, splitAllowed: false },
    rarityTier: "Rare",
    tags: ["sample", "research", "mission_possible"],
    hazardFlags: [],
    legalStatus: "ProtectedSample",
    ownershipImplication: "FactionEvidence",
    defaultUse: "research",
    extensions: { "weltraum.provisional-balance": "v1" }
  }),
  // Provisional balance: fixed sealed-crate dimensions reserve meaningful cargo space and have no market value.
  createResourceDefinition({
    resourceId: "cargo_mission_sealed_crate",
    displayName: "Sealed Mission Crate",
    categoryId: "mission_cargo",
    massPerUnitKg: 50,
    volumePerUnitM3: 0.08,
    baseValueCredits: 0,
    stackRule: { kind: "Sealed", maxQuantity: 1, splitAllowed: false },
    rarityTier: "Uncommon",
    tags: ["mission", "sealed", "no_market_sale"],
    hazardFlags: [],
    legalStatus: "Restricted",
    ownershipImplication: "MissionOwned",
    defaultUse: "mission_delivery",
    extensions: { "weltraum.provisional-balance": "v1" }
  })
]);

/** Creates a fresh canonical snapshot so callers cannot retain mutable registration state. */
export const createStarterResourceCatalog = (): ResourceCatalog =>
  createResourceCatalog({
    catalogId: STARTER_RESOURCE_CATALOG_ID,
    categories: starterResourceCategories,
    resources: starterResourceDefinitions,
    extensions: { "weltraum.catalog": "starter-v1" }
  });
