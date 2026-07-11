import { createShipBlueprint } from "./blueprint";
import { STARTER_CATALOG, STARTER_PART_IDS } from "./starterCatalog";
import type { ShipBlueprint } from "./types";

const instance = (
  stableInstanceId: string,
  partDefinitionId: string,
  x: number,
  y: number,
  z: number,
  yaw = 0
) => ({
  stableInstanceId,
  partDefinitionId,
  localGridPosition: { x, y, z },
  localRotation: { yaw, pitch: 0, roll: 0 },
  enabled: true
});

const connection = (
  connectionId: string,
  fromPartInstanceId: string,
  fromSocketId: string,
  toPartInstanceId: string,
  toSocketId: string
) => ({
  connectionId,
  from: { partInstanceId: fromPartInstanceId, socketId: fromSocketId },
  to: { partInstanceId: toPartInstanceId, socketId: toSocketId },
  connectionType: "Structural",
  enabled: true
});

const fixtureExtensions = (fixture: string) => ({
  "weltraum.fixture": {
    fixture,
    purpose: "schema-integrity-only"
  }
});

const createFixtureBlueprint = (blueprintId: string, displayName: string, instances: readonly object[], connections: readonly object[]) =>
  createShipBlueprint(
    {
      blueprintId,
      displayName,
      schemaVersion: 1,
      catalogId: STARTER_CATALOG.catalogId,
      catalogVersion: STARTER_CATALOG.catalogVersion,
      gridMeters: 0.5,
      instances,
      connections,
      extensions: fixtureExtensions(blueprintId)
    },
    { catalog: STARTER_CATALOG }
  );

/** Schema-integrity fixture only; it does not claim future flight-ready validation. */
export const SCOUT_BLUEPRINT: ShipBlueprint = createFixtureBlueprint(
  "blueprint_scout_v0",
  "Scout starter fixture",
  [
    instance("scout-cockpit", STARTER_PART_IDS.scoutCockpitSmall, 0, 0, 3),
    instance("scout-engine", STARTER_PART_IDS.smallChemicalBell, 0, 0, -3),
    instance("scout-fuel", STARTER_PART_IDS.smallTank, 0, -1, -1),
    instance("scout-frame", STARTER_PART_IDS.smallSpineFrame, 0, 0, 0),
    instance("scout-rcs", STARTER_PART_IDS.fourWayCornerRcs, 0, 1, 0)
  ],
  [
    connection("connection_scout_cockpit_frame", "scout-cockpit", "structural-back", "scout-frame", "structural-front"),
    connection("connection_scout_frame_engine", "scout-frame", "structural-back", "scout-engine", "structural-front"),
    connection("connection_scout_frame_fuel", "scout-frame", "structural-bottom", "scout-fuel", "structural-back"),
    connection("connection_scout_frame_rcs", "scout-frame", "structural-top", "scout-rcs", "structural-back")
  ]
);

/** Schema-integrity fixture only; it demonstrates cargo definitions and explicit connections. */
export const CARGO_BLUEPRINT: ShipBlueprint = createFixtureBlueprint(
  "blueprint_cargo_v0",
  "Cargo starter fixture",
  [
    instance("cargo-bay", STARTER_PART_IDS.mediumCargoBay, 0, 0, -3),
    instance("cargo-cockpit", STARTER_PART_IDS.industrialCockpitBox, 0, 0, 4),
    instance("cargo-docking", STARTER_PART_IDS.dockingConnector, 0, 0, -5),
    instance("cargo-engine", STARTER_PART_IDS.smallChemicalBell, 0, 0, -6),
    instance("cargo-frame", STARTER_PART_IDS.mediumRectangularFrame, 0, 0, 1),
    instance("cargo-tank", STARTER_PART_IDS.mediumSideTank, -3, 0, 1)
  ],
  [
    connection("connection_cargo_bay_docking", "cargo-bay", "structural-front", "cargo-docking", "structural-back"),
    connection("connection_cargo_bay_engine", "cargo-bay", "structural-back", "cargo-engine", "structural-front"),
    connection("connection_cargo_cockpit_frame", "cargo-cockpit", "structural-back", "cargo-frame", "structural-front"),
    connection("connection_cargo_frame_bay", "cargo-frame", "structural-back", "cargo-bay", "structural-front"),
    connection("connection_cargo_frame_tank", "cargo-frame", "structural-left", "cargo-tank", "structural-right")
  ]
);

/** Schema-integrity fixture only; it demonstrates fixed and turret weapon definitions. */
export const WEAPON_BLUEPRINT: ShipBlueprint = createFixtureBlueprint(
  "blueprint_weapon_v0",
  "Weapon starter fixture",
  [
    instance("weapon-cannon", STARTER_PART_IDS.fixedForwardCannonMount, 3, 0, 1),
    instance("weapon-cockpit", STARTER_PART_IDS.scoutCockpitSmall, 0, 0, 4),
    instance("weapon-engine", STARTER_PART_IDS.twinMediumEngine, 0, 0, -4),
    instance("weapon-frame", STARTER_PART_IDS.mediumRectangularFrame, 0, 0, 0),
    instance("weapon-rcs", STARTER_PART_IDS.sixWayCubeRcs, -3, 0, 0),
    instance("weapon-sensor", STARTER_PART_IDS.sensorDishModule, 0, 2, 0),
    instance("weapon-turret", STARTER_PART_IDS.smallSingleGunTurret, 0, 2, 1)
  ],
  [
    connection("connection_weapon_cockpit_frame", "weapon-cockpit", "structural-back", "weapon-frame", "structural-front"),
    connection("connection_weapon_frame_cannon", "weapon-frame", "structural-right", "weapon-cannon", "structural-back"),
    connection("connection_weapon_frame_engine", "weapon-frame", "structural-back", "weapon-engine", "structural-front"),
    connection("connection_weapon_frame_rcs", "weapon-frame", "structural-left", "weapon-rcs", "structural-back"),
    connection("connection_weapon_frame_sensor", "weapon-frame", "structural-top", "weapon-sensor", "structural-bottom"),
    connection("connection_weapon_frame_turret", "weapon-frame", "structural-top", "weapon-turret", "structural-bottom")
  ]
);

export const STARTER_BLUEPRINT_FIXTURES = Object.freeze({
  scout: SCOUT_BLUEPRINT,
  cargo: CARGO_BLUEPRINT,
  weapon: WEAPON_BLUEPRINT
});

export const createScoutBlueprint = (): ShipBlueprint => SCOUT_BLUEPRINT;
export const createCargoBlueprint = (): ShipBlueprint => CARGO_BLUEPRINT;
export const createWeaponBlueprint = (): ShipBlueprint => WEAPON_BLUEPRINT;
