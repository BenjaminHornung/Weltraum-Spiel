import { parsePartCategoryId } from "./ids";
import type { PartCategoryId } from "./ids";
import type { PartCategoryDefinition } from "./types";
import { deepFreeze } from "./validation";

export const COCKPIT_CATEGORY_ID = parsePartCategoryId("cockpit", "/builtInCategories/cockpit");
export const HULL_FRAME_CATEGORY_ID = parsePartCategoryId("hullFrame", "/builtInCategories/hullFrame");
export const MAIN_THRUSTER_CATEGORY_ID = parsePartCategoryId("mainThruster", "/builtInCategories/mainThruster");
export const RCS_CATEGORY_ID = parsePartCategoryId("rcs", "/builtInCategories/rcs");
export const FUEL_POWER_CATEGORY_ID = parsePartCategoryId("fuelPower", "/builtInCategories/fuelPower");
export const CARGO_STORAGE_CATEGORY_ID = parsePartCategoryId("cargoStorage", "/builtInCategories/cargoStorage");
export const WEAPON_CATEGORY_ID = parsePartCategoryId("weapon", "/builtInCategories/weapon");
export const UTILITY_CATEGORY_ID = parsePartCategoryId("utility", "/builtInCategories/utility");

/**
 * Built-in category IDs use stable ASCII spellings. Categories are
 * deliberately open: this record is a palette baseline, not an exhaustive enum.
 */
export const BUILT_IN_PART_CATEGORY_IDS = deepFreeze({
  cockpit: COCKPIT_CATEGORY_ID,
  hullFrame: HULL_FRAME_CATEGORY_ID,
  mainThruster: MAIN_THRUSTER_CATEGORY_ID,
  rcs: RCS_CATEGORY_ID,
  fuelPower: FUEL_POWER_CATEGORY_ID,
  cargoStorage: CARGO_STORAGE_CATEGORY_ID,
  weapon: WEAPON_CATEGORY_ID,
  utility: UTILITY_CATEGORY_ID
});

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Stable sort order used by catalog construction and canonical domain projections. */
export const comparePartCategories = (left: PartCategoryDefinition, right: PartCategoryDefinition): number => {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return compareText(left.categoryId, right.categoryId);
};

export const sortPartCategories = (
  categories: readonly PartCategoryDefinition[]
): readonly PartCategoryDefinition[] => [...categories].sort(comparePartCategories);

export const BUILT_IN_PART_CATEGORIES: readonly PartCategoryDefinition[] = deepFreeze(
  sortPartCategories([
    {
      categoryId: COCKPIT_CATEGORY_ID,
      displayNameFallback: "Cockpit",
      descriptionFallback: "Command, crew, and control-core parts.",
      sortOrder: 10,
      paletteTags: ["command", "crew"],
      requiredSystemRole: "command",
      recommendedComponentKinds: ["ControlCore"]
    },
    {
      categoryId: HULL_FRAME_CATEGORY_ID,
      displayNameFallback: "Hull frame",
      descriptionFallback: "Structural frames and joining parts.",
      sortOrder: 20,
      paletteTags: ["frame", "structure"],
      recommendedComponentKinds: ["Structural", "Armor"]
    },
    {
      categoryId: MAIN_THRUSTER_CATEGORY_ID,
      displayNameFallback: "Main thruster",
      descriptionFallback: "Primary propulsion parts.",
      sortOrder: 30,
      paletteTags: ["propulsion", "engine"],
      recommendedComponentKinds: ["MainThruster"]
    },
    {
      categoryId: RCS_CATEGORY_ID,
      displayNameFallback: "RCS",
      descriptionFallback: "Reaction-control maneuvering parts.",
      sortOrder: 40,
      paletteTags: ["propulsion", "maneuvering"],
      recommendedComponentKinds: ["RcsCluster"]
    },
    {
      categoryId: FUEL_POWER_CATEGORY_ID,
      displayNameFallback: "Fuel and power",
      descriptionFallback: "Fuel storage and reserved utility capacity.",
      sortOrder: 50,
      paletteTags: ["fuel", "power"],
      recommendedComponentKinds: ["FuelTank", "PowerHeatReserved"]
    },
    {
      categoryId: CARGO_STORAGE_CATEGORY_ID,
      displayNameFallback: "Cargo storage",
      descriptionFallback: "Cargo-volume and payload-mass storage parts.",
      sortOrder: 60,
      paletteTags: ["cargo", "storage"],
      recommendedComponentKinds: ["CargoStorage"]
    },
    {
      categoryId: WEAPON_CATEGORY_ID,
      displayNameFallback: "Weapon",
      descriptionFallback: "Fixed and turreted weapon parts.",
      sortOrder: 70,
      paletteTags: ["weapon", "hardpoint"],
      recommendedComponentKinds: ["FixedWeapon", "TurretWeapon"]
    },
    {
      categoryId: UTILITY_CATEGORY_ID,
      displayNameFallback: "Utility",
      descriptionFallback: "Sensors, docking, and other utility parts.",
      sortOrder: 80,
      paletteTags: ["utility", "sensor", "docking"],
      recommendedComponentKinds: ["SensorUtility", "DockingConnector"]
    }
  ])
);

export const isBuiltInPartCategoryId = (value: PartCategoryId): boolean =>
  BUILT_IN_PART_CATEGORIES.some((category) => category.categoryId === value);
