import { BUILT_IN_PART_CATEGORIES } from "./categories";
import { catalogDocumentForSerialization, createShipPartCatalogSnapshot } from "./catalog";
import type { ShipPartCatalogDocument, ShipPartCatalogSnapshot } from "./types";
import { deepFreeze } from "./validation";

const CONCEPT_SOURCE = "docs/spielkonzept/ship-builder-modular-parts.md";

const identityRotation = { x: 0, y: 0, z: 0, w: 1 };

const vector = (x: number, y: number, z: number) => ({ x, y, z });

const balanceExtensions = (concept: string) => ({
  "weltraum.balance": {
    provisional: true,
    source: CONCEPT_SOURCE,
    concept
  }
});

const socket = (
  socketId: string,
  socketType: string,
  localPosition: { x: number; y: number; z: number },
  role: "Structural" | "Functional" | "Visual" | "Camera",
  directionRole: "None" | "MountNormal" | "Thrust" | "Aim" | "Docking" | "Camera",
  direction: { x: number; y: number; z: number },
  mountSide: "front" | "back" | "left" | "right" | "top" | "bottom" | "internal" | "any",
  compatibleComponentKinds: readonly string[] = []
) => ({
  socketId,
  schemaVersion: 1,
  socketType,
  localPosition,
  localRotation: identityRotation,
  role,
  directionRole,
  direction,
  compatibleCategoryIds: [],
  compatibleComponentKinds,
  capacityClass: "standard",
  mountSide,
  requiredForComponentIds: [],
  compatibilityAliases: [socketId],
  excludedFromCameraBounds: false
});

const structuralSocket = (
  socketId: string,
  localPosition: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  mountSide: "front" | "back" | "left" | "right" | "top" | "bottom"
) => socket(socketId, "structural", localPosition, "Structural", "MountNormal", direction, mountSide);

const functionalSocket = (
  socketId: string,
  socketType: string,
  localPosition: { x: number; y: number; z: number },
  directionRole: "MountNormal" | "Thrust" | "Aim" | "Docking",
  direction: { x: number; y: number; z: number },
  mountSide: "front" | "back" | "left" | "right" | "top" | "bottom" | "internal" | "any",
  compatibleComponentKinds: readonly string[]
) => socket(socketId, socketType, localPosition, "Functional", directionRole, direction, mountSide, compatibleComponentKinds);

const visualSocket = (
  socketId: string,
  localPosition: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  mountSide: "front" | "back" | "left" | "right" | "top" | "bottom"
) => socket(socketId, "muzzleFlash", localPosition, "Visual", "Aim", direction, mountSide);

const cameraSocket = (
  socketId: string,
  localPosition: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  mountSide: "front" | "back" | "left" | "right" | "top" | "bottom"
) => socket(socketId, "cameraAnchor", localPosition, "Camera", "Camera", direction, mountSide);

const component = (componentId: string, kind: string, fields: Record<string, unknown>) => ({
  componentId,
  kind,
  schemaVersion: 1,
  ...fields
});

interface StarterPartInput {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly categoryId: string;
  readonly tags: readonly string[];
  readonly dimensions: readonly [number, number, number];
  readonly footprint: readonly [number, number, number];
  readonly dryMassKilograms: number;
  readonly allowedMountSides: readonly string[];
  readonly sockets: readonly Record<string, unknown>[];
  readonly components: readonly Record<string, unknown>[];
}

const part = (input: StarterPartInput) => ({
  partDefinitionId: input.id,
  schemaVersion: 1,
  displayName: input.displayName,
  description: input.description,
  categoryId: input.categoryId,
  tags: input.tags,
  dimensionsMeters: {
    x: input.dimensions[0],
    y: input.dimensions[1],
    z: input.dimensions[2]
  },
  gridFootprint: {
    x: input.footprint[0],
    y: input.footprint[1],
    z: input.footprint[2]
  },
  dryMassKilograms: input.dryMassKilograms,
  allowedMountSides: input.allowedMountSides,
  sockets: input.sockets,
  components: input.components,
  balanceTier: "provisional-v0",
  extensions: balanceExtensions(input.displayName)
});

/** Stable v0 concept IDs; changing one is a serialized catalog compatibility change. */
export const STARTER_PART_IDS = deepFreeze({
  scoutCockpitSmall: "cockpit_scout_small_v0",
  industrialCockpitBox: "cockpit_industrial_box_v0",
  smallSpineFrame: "hull_small_spine_v0",
  mediumRectangularFrame: "hull_medium_rectangular_frame_v0",
  smallChemicalBell: "thruster_small_chemical_bell_v0",
  twinMediumEngine: "thruster_twin_medium_engine_v0",
  fourWayCornerRcs: "rcs_4way_corner_v0",
  sixWayCubeRcs: "rcs_6way_cube_v0",
  smallTank: "fuel_small_tank_v0",
  mediumSideTank: "fuel_medium_side_tank_v0",
  smallStorageBox: "cargo_small_storage_box_v0",
  mediumCargoBay: "cargo_medium_bay_v0",
  smallSingleGunTurret: "weapon_small_single_gun_turret_v0",
  fixedForwardCannonMount: "weapon_fixed_forward_cannon_mount_v0",
  sensorDishModule: "utility_sensor_dish_module_v0",
  dockingConnector: "utility_docking_connector_v0"
});

const STARTER_CATALOG_INPUT = {
  catalogId: "weltraum.starter-catalog.v0",
  catalogVersion: 1,
  schemaVersion: 1,
  categories: BUILT_IN_PART_CATEGORIES,
  partDefinitions: [
    part({
      id: STARTER_PART_IDS.scoutCockpitSmall,
      displayName: "Scout cockpit small",
      description: "Tiny forward command pod for lightweight craft.",
      categoryId: "cockpit",
      tags: ["command", "light", "scout"],
      dimensions: [2, 2.2, 1.5],
      footprint: [4, 5, 3],
      dryMassKilograms: 520,
      allowedMountSides: ["front", "back", "top"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -0.75), vector(0, 0, -1), "back"),
        structuralSocket("structural-front", vector(0, 0, 0.75), vector(0, 0, 1), "front"),
        functionalSocket("control-primary", "hardpoint", vector(0, 0, 0), "Aim", vector(0, 0, 1), "internal", ["ControlCore"]),
        cameraSocket("camera-primary", vector(0, 0.65, 0.25), vector(0, 0, 1), "top"),
        functionalSocket("sensor-nose", "hardpoint", vector(0, 0, 0.8), "Aim", vector(0, 0, 1), "front", ["SensorUtility"])
      ],
      components: [
        component("control-core", "ControlCore", {
          controlSocketId: "control-primary",
          cameraSocketId: "camera-primary",
          seatCount: 1,
          controlRating: 1,
          supportedControlModes: ["manual", "assisted"]
        }),
        component("sensor-core", "SensorUtility", {
          mountSocketId: "sensor-nose",
          rangeMeters: 4000,
          scanRatePerSecond: 0.5,
          sensorRating: 1
        }),
        component("structure-core", "Structural", {
          structuralSocketIds: ["structural-back", "structural-front"],
          structuralRating: 1
        }),
        component("power-reserve", "PowerHeatReserved", {
          reservedPowerWatts: 250,
          reservedHeatWatts: 125,
          reservationReason: "Provisional cockpit avionics reservation."
        })
      ]
    }),
    part({
      id: STARTER_PART_IDS.industrialCockpitBox,
      displayName: "Industrial cockpit box",
      description: "Durable cockpit with cargo-friendly side rails.",
      categoryId: "cockpit",
      tags: ["command", "cargo", "industrial"],
      dimensions: [2.2, 2.2, 2],
      footprint: [5, 5, 4],
      dryMassKilograms: 760,
      allowedMountSides: ["front", "back", "left", "right", "top"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1), vector(0, 0, -1), "back"),
        structuralSocket("structural-left", vector(-1.1, 0, 0), vector(-1, 0, 0), "left"),
        structuralSocket("structural-right", vector(1.1, 0, 0), vector(1, 0, 0), "right"),
        functionalSocket("control-primary", "hardpoint", vector(0, 0, 0), "Aim", vector(0, 0, 1), "internal", ["ControlCore"]),
        cameraSocket("camera-primary", vector(0, 0.7, 0.15), vector(0, 0, 1), "top")
      ],
      components: [
        component("armor-shell", "Armor", { armorRating: 8, coverageFraction: 0.45, addedMassKilograms: 80 }),
        component("control-core", "ControlCore", {
          controlSocketId: "control-primary",
          cameraSocketId: "camera-primary",
          seatCount: 1,
          controlRating: 2,
          supportedControlModes: ["assisted", "manual"]
        }),
        component("power-reserve", "PowerHeatReserved", {
          reservedPowerWatts: 400,
          reservedHeatWatts: 200,
          reservationReason: "Provisional industrial bridge reservation."
        }),
        component("structure-core", "Structural", {
          structuralSocketIds: ["structural-back", "structural-left", "structural-right"],
          structuralRating: 2
        })
      ]
    }),
    part({
      id: STARTER_PART_IDS.smallSpineFrame,
      displayName: "Small spine frame",
      description: "Lightweight connection spine for compact craft.",
      categoryId: "hullFrame",
      tags: ["frame", "light", "spine"],
      dimensions: [2, 1, 3],
      footprint: [4, 2, 6],
      dryMassKilograms: 300,
      allowedMountSides: ["front", "back", "top", "bottom"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1.5), vector(0, 0, -1), "back"),
        structuralSocket("structural-bottom", vector(0, -0.5, 0), vector(0, -1, 0), "bottom"),
        structuralSocket("structural-front", vector(0, 0, 1.5), vector(0, 0, 1), "front"),
        structuralSocket("structural-top", vector(0, 0.5, 0), vector(0, 1, 0), "top")
      ],
      components: [
        component("structure-core", "Structural", {
          structuralSocketIds: ["structural-back", "structural-bottom", "structural-front", "structural-top"],
          structuralRating: 2
        })
      ]
    }),
    part({
      id: STARTER_PART_IDS.mediumRectangularFrame,
      displayName: "Medium rectangular frame",
      description: "Core hull section for medium craft.",
      categoryId: "hullFrame",
      tags: ["frame", "medium", "structure"],
      dimensions: [2.5, 2, 3],
      footprint: [5, 4, 6],
      dryMassKilograms: 620,
      allowedMountSides: ["front", "back", "left", "right", "top", "bottom"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1.5), vector(0, 0, -1), "back"),
        structuralSocket("structural-front", vector(0, 0, 1.5), vector(0, 0, 1), "front"),
        structuralSocket("structural-left", vector(-1.25, 0, 0), vector(-1, 0, 0), "left"),
        structuralSocket("structural-right", vector(1.25, 0, 0), vector(1, 0, 0), "right"),
        structuralSocket("structural-top", vector(0, 1, 0), vector(0, 1, 0), "top")
      ],
      components: [
        component("armor-shell", "Armor", { armorRating: 6, coverageFraction: 0.5, addedMassKilograms: 90 }),
        component("structure-core", "Structural", {
          structuralSocketIds: ["structural-back", "structural-front", "structural-left", "structural-right", "structural-top"],
          structuralRating: 4
        })
      ]
    }),
    part({
      id: STARTER_PART_IDS.smallChemicalBell,
      displayName: "Small chemical bell",
      description: "Standard compact main engine with an explicit plume origin.",
      categoryId: "mainThruster",
      tags: ["chemical", "engine", "light"],
      dimensions: [1.8, 1.2, 1.8],
      footprint: [4, 3, 4],
      dryMassKilograms: 240,
      allowedMountSides: ["back", "bottom"],
      sockets: [
        structuralSocket("structural-front", vector(0, 0, 0.9), vector(0, 0, 1), "front"),
        functionalSocket("nozzle-main", "mainThrusterNozzle", vector(0, 0, -0.9), "Thrust", vector(0, 0, 1), "back", ["MainThruster"])
      ],
      components: [
        component("main-thruster", "MainThruster", {
          nozzleSocketId: "nozzle-main",
          maximumThrustNewtons: 18000,
          propellantBurnKilogramsPerSecond: 0.35,
          throttleResponseSeconds: 0.45,
          gimbalDegrees: 0
        }),
        component("power-reserve", "PowerHeatReserved", {
          reservedPowerWatts: 120,
          reservedHeatWatts: 600,
          reservationReason: "Provisional chemical engine heat reservation."
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-front"], structuralRating: 1 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.twinMediumEngine,
      displayName: "Twin medium engine",
      description: "Paired medium main engines for higher maneuverability.",
      categoryId: "mainThruster",
      tags: ["engine", "medium", "twin"],
      dimensions: [2.4, 1.6, 2],
      footprint: [5, 4, 4],
      dryMassKilograms: 540,
      allowedMountSides: ["back", "left", "right"],
      sockets: [
        structuralSocket("structural-front", vector(0, 0, 1), vector(0, 0, 1), "front"),
        functionalSocket("nozzle-left", "mainThrusterNozzle", vector(-0.65, 0, -1), "Thrust", vector(0, 0, 1), "back", ["MainThruster"]),
        functionalSocket("nozzle-right", "mainThrusterNozzle", vector(0.65, 0, -1), "Thrust", vector(0, 0, 1), "back", ["MainThruster"])
      ],
      components: [
        component("main-thruster-left", "MainThruster", {
          nozzleSocketId: "nozzle-left",
          maximumThrustNewtons: 22000,
          propellantBurnKilogramsPerSecond: 0.45,
          throttleResponseSeconds: 0.5,
          gimbalDegrees: 3
        }),
        component("main-thruster-right", "MainThruster", {
          nozzleSocketId: "nozzle-right",
          maximumThrustNewtons: 22000,
          propellantBurnKilogramsPerSecond: 0.45,
          throttleResponseSeconds: 0.5,
          gimbalDegrees: 3
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-front"], structuralRating: 2 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.fourWayCornerRcs,
      displayName: "4-way corner RCS",
      description: "Corner reaction-control block with four explicit force directions.",
      categoryId: "rcs",
      tags: ["maneuvering", "rcs", "translation"],
      dimensions: [1.8, 1.2, 1.8],
      footprint: [4, 3, 4],
      dryMassKilograms: 180,
      allowedMountSides: ["front", "back", "left", "right"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -0.9), vector(0, 0, -1), "back"),
        functionalSocket("nozzle-back", "rcsNozzle", vector(0, 0, -0.9), "Thrust", vector(0, 0, -1), "back", ["RcsCluster"]),
        functionalSocket("nozzle-front", "rcsNozzle", vector(0, 0, 0.9), "Thrust", vector(0, 0, 1), "front", ["RcsCluster"]),
        functionalSocket("nozzle-left", "rcsNozzle", vector(-0.9, 0, 0), "Thrust", vector(-1, 0, 0), "left", ["RcsCluster"]),
        functionalSocket("nozzle-right", "rcsNozzle", vector(0.9, 0, 0), "Thrust", vector(1, 0, 0), "right", ["RcsCluster"])
      ],
      components: [
        component("rcs-cluster", "RcsCluster", {
          nozzleSocketIds: ["nozzle-back", "nozzle-front", "nozzle-left", "nozzle-right"],
          thrustPerNozzleNewtons: 550,
          propellantBurnKilogramsPerSecond: 0.04,
          translationAxes: ["x", "z"],
          rotationAxes: ["x", "y", "z"]
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 1 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.sixWayCubeRcs,
      displayName: "6-way cube RCS",
      description: "Omnidirectional reaction-control block with six explicit force directions.",
      categoryId: "rcs",
      tags: ["maneuvering", "omnidirectional", "rcs"],
      dimensions: [1.8, 1.8, 1.8],
      footprint: [4, 4, 4],
      dryMassKilograms: 260,
      allowedMountSides: ["front", "back", "left", "right", "top", "bottom"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -0.9), vector(0, 0, -1), "back"),
        functionalSocket("nozzle-back", "rcsNozzle", vector(0, 0, -0.9), "Thrust", vector(0, 0, -1), "back", ["RcsCluster"]),
        functionalSocket("nozzle-bottom", "rcsNozzle", vector(0, -0.9, 0), "Thrust", vector(0, -1, 0), "bottom", ["RcsCluster"]),
        functionalSocket("nozzle-front", "rcsNozzle", vector(0, 0, 0.9), "Thrust", vector(0, 0, 1), "front", ["RcsCluster"]),
        functionalSocket("nozzle-left", "rcsNozzle", vector(-0.9, 0, 0), "Thrust", vector(-1, 0, 0), "left", ["RcsCluster"]),
        functionalSocket("nozzle-right", "rcsNozzle", vector(0.9, 0, 0), "Thrust", vector(1, 0, 0), "right", ["RcsCluster"]),
        functionalSocket("nozzle-top", "rcsNozzle", vector(0, 0.9, 0), "Thrust", vector(0, 1, 0), "top", ["RcsCluster"])
      ],
      components: [
        component("rcs-cluster", "RcsCluster", {
          nozzleSocketIds: ["nozzle-back", "nozzle-bottom", "nozzle-front", "nozzle-left", "nozzle-right", "nozzle-top"],
          thrustPerNozzleNewtons: 700,
          propellantBurnKilogramsPerSecond: 0.06,
          translationAxes: ["x", "y", "z"],
          rotationAxes: ["x", "y", "z"]
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 2 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.smallTank,
      displayName: "Small tank",
      description: "Short-range fuel reserve with explicit fill and feed sockets.",
      categoryId: "fuelPower",
      tags: ["fuel", "light", "tank"],
      dimensions: [1.6, 1.6, 2],
      footprint: [4, 4, 4],
      dryMassKilograms: 210,
      allowedMountSides: ["back", "bottom"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1), vector(0, 0, -1), "back"),
        functionalSocket("fuel-feed", "hardpoint", vector(0, 0, -0.85), "MountNormal", vector(0, 0, -1), "back", ["FuelTank"]),
        functionalSocket("fuel-fill", "hardpoint", vector(0, 0.8, 0), "MountNormal", vector(0, 1, 0), "top", ["FuelTank"])
      ],
      components: [
        component("fuel-tank", "FuelTank", {
          capacityKilograms: 160,
          fuelKind: "chemical-propellant",
          feedSocketIds: ["fuel-feed"],
          fillSocketId: "fuel-fill"
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 1 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.mediumSideTank,
      displayName: "Medium side tank",
      description: "Compact lateral fuel extension for medium craft.",
      categoryId: "fuelPower",
      tags: ["fuel", "medium", "side-mount"],
      dimensions: [2, 1.4, 2.6],
      footprint: [4, 3, 5],
      dryMassKilograms: 350,
      allowedMountSides: ["front", "left", "right"],
      sockets: [
        structuralSocket("structural-left", vector(-1, 0, 0), vector(-1, 0, 0), "left"),
        structuralSocket("structural-right", vector(1, 0, 0), vector(1, 0, 0), "right"),
        functionalSocket("fuel-feed", "hardpoint", vector(0, 0, -1.1), "MountNormal", vector(0, 0, -1), "back", ["FuelTank"]),
        functionalSocket("fuel-fill", "hardpoint", vector(0, 0.7, 0), "MountNormal", vector(0, 1, 0), "top", ["FuelTank"])
      ],
      components: [
        component("fuel-tank", "FuelTank", {
          capacityKilograms: 300,
          fuelKind: "chemical-propellant",
          feedSocketIds: ["fuel-feed"],
          fillSocketId: "fuel-fill"
        }),
        component("power-reserve", "PowerHeatReserved", {
          reservedPowerWatts: 60,
          reservedHeatWatts: 0,
          reservationReason: "Provisional tank monitoring reservation."
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-left", "structural-right"], structuralRating: 2 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.smallStorageBox,
      displayName: "Small storage box",
      description: "Lightweight cargo container with an explicit attachment socket.",
      categoryId: "cargoStorage",
      tags: ["cargo", "light", "storage"],
      dimensions: [1.4, 1.4, 1.4],
      footprint: [3, 3, 3],
      dryMassKilograms: 180,
      allowedMountSides: ["back", "bottom", "left", "right"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -0.7), vector(0, 0, -1), "back"),
        functionalSocket("cargo-attach", "cargoAttach", vector(0, 0, -0.65), "MountNormal", vector(0, 0, -1), "back", ["CargoStorage"]),
        functionalSocket("cargo-access", "hardpoint", vector(0, 0, 0.7), "Aim", vector(0, 0, 1), "front", ["CargoStorage"])
      ],
      components: [
        component("cargo-storage", "CargoStorage", {
          cargoAttachSocketIds: ["cargo-attach"],
          capacityCubicMeters: 2.1,
          maximumPayloadKilograms: 350,
          accessSocketId: "cargo-access"
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 1 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.mediumCargoBay,
      displayName: "Medium cargo bay",
      description: "Main load bay with two explicit attachment points.",
      categoryId: "cargoStorage",
      tags: ["cargo", "medium", "storage"],
      dimensions: [2, 1.6, 2.2],
      footprint: [4, 3, 4],
      dryMassKilograms: 440,
      allowedMountSides: ["front", "back", "top"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1.1), vector(0, 0, -1), "back"),
        structuralSocket("structural-front", vector(0, 0, 1.1), vector(0, 0, 1), "front"),
        functionalSocket("cargo-attach-a", "cargoAttach", vector(-0.6, 0, 0), "MountNormal", vector(-1, 0, 0), "left", ["CargoStorage"]),
        functionalSocket("cargo-attach-b", "cargoAttach", vector(0.6, 0, 0), "MountNormal", vector(1, 0, 0), "right", ["CargoStorage"]),
        functionalSocket("cargo-access", "hardpoint", vector(0, 0, 1.1), "Aim", vector(0, 0, 1), "front", ["CargoStorage"])
      ],
      components: [
        component("cargo-storage", "CargoStorage", {
          cargoAttachSocketIds: ["cargo-attach-a", "cargo-attach-b"],
          capacityCubicMeters: 8.5,
          maximumPayloadKilograms: 1500,
          accessSocketId: "cargo-access"
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back", "structural-front"], structuralRating: 3 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.smallSingleGunTurret,
      displayName: "Small single gun turret",
      description: "Light defensive turret with explicit base, pivots, muzzle, and flash sockets.",
      categoryId: "weapon",
      tags: ["defense", "turret", "weapon"],
      dimensions: [1.5, 1.2, 1.5],
      footprint: [3, 3, 3],
      dryMassKilograms: 190,
      allowedMountSides: ["front", "left", "right", "top"],
      sockets: [
        structuralSocket("structural-bottom", vector(0, -0.6, 0), vector(0, -1, 0), "bottom"),
        functionalSocket("muzzle-primary", "muzzle", vector(0, 0.1, 0.8), "Aim", vector(0, 0, 1), "front", ["TurretWeapon"]),
        visualSocket("muzzle-flash-primary", vector(0, 0.1, 0.9), vector(0, 0, 1), "front"),
        functionalSocket("turret-base", "turretBase", vector(0, -0.55, 0), "MountNormal", vector(0, 1, 0), "bottom", ["TurretWeapon"]),
        functionalSocket("turret-pitch", "turretPitchPivot", vector(0, 0.05, 0.15), "Aim", vector(0, 0, 1), "top", ["TurretWeapon"]),
        functionalSocket("turret-yaw", "turretYawPivot", vector(0, -0.05, 0), "Aim", vector(0, 0, 1), "top", ["TurretWeapon"])
      ],
      components: [
        component("structure-core", "Structural", { structuralSocketIds: ["structural-bottom"], structuralRating: 1 }),
        component("turret-weapon", "TurretWeapon", {
          turretBaseSocketId: "turret-base",
          yawPivotSocketId: "turret-yaw",
          pitchPivotSocketId: "turret-pitch",
          muzzleSocketId: "muzzle-primary",
          muzzleFlashSocketId: "muzzle-flash-primary",
          damagePerShot: 8,
          projectileSpeedMetersPerSecond: 480,
          rangeMeters: 900,
          rateOfFirePerSecond: 2,
          recoilNewtons: 900
        })
      ]
    }),
    part({
      id: STARTER_PART_IDS.fixedForwardCannonMount,
      displayName: "Fixed forward cannon mount",
      description: "No-traverse hardpoint cannon with an explicit forward muzzle.",
      categoryId: "weapon",
      tags: ["cannon", "fixed", "weapon"],
      dimensions: [2, 1.1, 2.4],
      footprint: [4, 3, 5],
      dryMassKilograms: 280,
      allowedMountSides: ["front", "top"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -1.2), vector(0, 0, -1), "back"),
        functionalSocket("hardpoint-main", "hardpoint", vector(0, 0, -1.1), "Aim", vector(0, 0, 1), "back", ["FixedWeapon"]),
        functionalSocket("muzzle-primary", "muzzle", vector(0, 0, 1.2), "Aim", vector(0, 0, 1), "front", ["FixedWeapon"]),
        visualSocket("muzzle-flash-primary", vector(0, 0, 1.3), vector(0, 0, 1), "front")
      ],
      components: [
        component("fixed-weapon", "FixedWeapon", {
          hardpointSocketId: "hardpoint-main",
          muzzleSocketId: "muzzle-primary",
          muzzleFlashSocketId: "muzzle-flash-primary",
          damagePerShot: 18,
          projectileSpeedMetersPerSecond: 720,
          rangeMeters: 1400,
          rateOfFirePerSecond: 1.25,
          recoilNewtons: 2200
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 2 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.sensorDishModule,
      displayName: "Sensor dish/module",
      description: "Exploration and target-scanning utility dish.",
      categoryId: "utility",
      tags: ["sensor", "utility", "exploration"],
      dimensions: [1.8, 1.3, 1.6],
      footprint: [4, 3, 3],
      dryMassKilograms: 150,
      allowedMountSides: ["top", "back"],
      sockets: [
        structuralSocket("structural-bottom", vector(0, -0.65, 0), vector(0, -1, 0), "bottom"),
        functionalSocket("sensor-mount", "hardpoint", vector(0, 0.65, 0), "Aim", vector(0, 0, 1), "top", ["SensorUtility"])
      ],
      components: [
        component("sensor-utility", "SensorUtility", {
          mountSocketId: "sensor-mount",
          rangeMeters: 6500,
          scanRatePerSecond: 0.8,
          sensorRating: 3
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-bottom"], structuralRating: 1 })
      ]
    }),
    part({
      id: STARTER_PART_IDS.dockingConnector,
      displayName: "Docking connector",
      description: "Hardpoint-compatible ship linking connector with an explicit docking normal.",
      categoryId: "utility",
      tags: ["connector", "docking", "utility"],
      dimensions: [1.2, 1.2, 1.2],
      footprint: [3, 3, 3],
      dryMassKilograms: 130,
      allowedMountSides: ["front", "back"],
      sockets: [
        structuralSocket("structural-back", vector(0, 0, -0.6), vector(0, 0, -1), "back"),
        functionalSocket("docking-port", "dockingConnector", vector(0, 0, 0.6), "Docking", vector(0, 0, 1), "front", ["DockingConnector"])
      ],
      components: [
        component("docking-connector", "DockingConnector", {
          connectorSocketId: "docking-port",
          dockingRating: 1,
          maximumApproachSpeedMetersPerSecond: 2
        }),
        component("structure-core", "Structural", { structuralSocketIds: ["structural-back"], structuralRating: 1 })
      ]
    })
  ]
};

/** Deep-frozen, validated starter snapshot used by fixtures and public consumers. */
export const STARTER_CATALOG: ShipPartCatalogSnapshot = createShipPartCatalogSnapshot(STARTER_CATALOG_INPUT);

/** Canonical persisted starter document; derived indexes, summary, and signature are intentionally absent. */
export const STARTER_CATALOG_DOCUMENT: ShipPartCatalogDocument = deepFreeze(catalogDocumentForSerialization(STARTER_CATALOG));

export const STARTER_CATALOG_SIGNATURE = STARTER_CATALOG.signature;

/** The starter data is immutable, so consumers may safely share this snapshot. */
export const createStarterCatalog = (): ShipPartCatalogSnapshot => STARTER_CATALOG;

export const createStarterShipPartCatalog = createStarterCatalog;
