import { describe, expect, it } from "vitest";
import {
  CARGO_BLUEPRINT,
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  STARTER_PART_IDS,
  ShipBuilderDataError,
  WEAPON_BLUEPRINT,
  catalogDocumentForSerialization,
  createShipPartCatalogSnapshot,
  evaluateHandlingDiagnostics,
  evaluateShipStats
} from "../../src/ship-builder";
import type { ShipBlueprint } from "../../src/ship-builder";

type MutableRecord = Record<string, any>;
const cloneBlueprint = (source: ShipBlueprint = SCOUT_BLUEPRINT): MutableRecord => structuredClone(source) as MutableRecord;
const cloneCatalog = (): MutableRecord =>
  structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;
const partById = (catalog: MutableRecord, id: string): MutableRecord => {
  const part = catalog.partDefinitions.find((candidate: MutableRecord) => candidate.partDefinitionId === id);
  if (part === undefined) throw new Error(`Missing part ${id}.`);
  return part;
};

const expectFiniteNumericLeaves = (value: unknown, path = "$root"): void => {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => expectFiniteNumericLeaves(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      expectFiniteNumericLeaves(entry, `${path}.${key}`);
    }
  }
};

describe("ship-builder handling diagnostics", () => {
  it("produces a deterministic signed immutable diagnostic report without mutating caller input", () => {
    const source = cloneBlueprint();
    const before = JSON.stringify(source);
    const first = evaluateHandlingDiagnostics(source, STARTER_CATALOG);
    const second = evaluateHandlingDiagnostics(source, STARTER_CATALOG);

    expect(first).toEqual(second);
    expect(first.signature).toBe("eaac5696");
    expect(first.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "MissingPropulsionMetadata",
      "WeakBraking",
      "MissingRcsPositiveY",
      "MissingRcsNegativeY"
    ]));
    expect(first.diagnostics.map((entry) => entry.code)).not.toContain("MissingUsableRcs");
    expect(first.diagnostics.map((entry) => entry.code)).not.toContain("LowAcceleration");
    expect(first.diagnostics.map((entry) => entry.code)).not.toContain("RcsAuthorityAsymmetric");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.diagnostics)).toBe(true);
    expect(Object.isFrozen(first.diagnostics[0])).toBe(true);
    expectFiniteNumericLeaves(first);
    expect(new Set(first.suggestedFixCodes).size).toBe(first.suggestedFixCodes.length);
    expect(first.suggestedFixCodes.indexOf("DeclarePropulsionSupply")).toBeLessThan(
      first.suggestedFixCodes.indexOf("IncreaseBrakingAuthority")
    );
    expect(first.diagnostics.map((entry) => [entry.phase, entry.code, entry.path])).toEqual(
      second.diagnostics.map((entry) => [entry.phase, entry.code, entry.path])
    );
    expect(JSON.stringify(source)).toBe(before);
    source.displayName = "caller remains mutable";
    expect(source.displayName).toBe("caller remains mutable");
  });

  it("accepts an intact injected stats report and rejects a tampered payload with its stale signature", () => {
    const statsReport = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG);
    const accepted = evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, STARTER_CATALOG, { statsReport });
    const tampered = structuredClone(statsReport) as MutableRecord;
    tampered.stats.deltaVMps = { availability: "Available", value: 123, unit: "m/s" };
    tampered.stats.burnTimeSeconds = { availability: "Available", value: 456, unit: "s" };

    expect(statsReport.signature).toBe("107deb2e");
    expect(accepted.statsSignature).toBe(statsReport.signature);
    expect(() =>
      evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, STARTER_CATALOG, {
        statsReport: tampered as typeof statsReport
      })
    ).toThrowError(ShipBuilderDataError);
  });

  it("detects the Cargo docking/engine 83.33 percent overlap and unclamped cargo excess", () => {
    const report = evaluateHandlingDiagnostics(CARGO_BLUEPRINT, STARTER_CATALOG, {
      preview: { cargoPreviewMassKg: 1501, cargoPreviewVolumeM3: 8.6 }
    });
    const dockingEngine = report.diagnostics.find(
      (entry) => entry.path === "/overlaps/cargo-docking/cargo-engine"
    );

    expect(dockingEngine?.code).toBe("HardPartOverlap");
    expect(dockingEngine?.details.sharedVolumeRatio).toBeCloseTo(5 / 6, 12);
    expect(report.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "CargoMassOverCapacity",
      "CargoVolumeOverCapacity"
    ]));
    expect(report.suggestedFixCodes).toEqual(expect.arrayContaining([
      "ResolveHardOverlap",
      "ReduceCargoPreviewMass",
      "ReduceCargoPreviewVolume"
    ]));
  });

  it("uses a strict greater-than hard-overlap boundary", () => {
    const source = cloneBlueprint();
    const rcs = source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs");
    source.instances = [
      { ...rcs, stableInstanceId: "boundary-a", localGridPosition: { x: 0, y: 0, z: 0 } },
      { ...rcs, stableInstanceId: "boundary-b", localGridPosition: { x: 0, y: 0, z: 1 } }
    ];
    source.connections = [];
    source.referencedPartDefinitionIds = [STARTER_PART_IDS.fourWayCornerRcs];

    const atBoundary = evaluateHandlingDiagnostics(source, STARTER_CATALOG);
    expect(atBoundary.diagnostics.find((entry) => entry.code === "HardPartOverlap")).toBeUndefined();

    source.instances[1].localGridPosition.z = 0;
    const aboveBoundary = evaluateHandlingDiagnostics(source, STARTER_CATALOG);
    expect(aboveBoundary.diagnostics.find((entry) => entry.code === "HardPartOverlap")?.details.sharedVolumeRatio).toBe(1);
  });

  it("uses strict handling thresholds and enables low-acceleration/asymmetry only by caller policy", () => {
    const exactBoundary = evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, STARTER_CATALOG, {
      policy: { thrustOffsetWarningMeters: 19 / 322, weakBrakingRatio: 0 }
    });
    expect(exactBoundary.diagnostics.map((entry) => entry.code)).not.toContain("ThrustOffsetExceeded");
    expect(exactBoundary.diagnostics.map((entry) => entry.code)).not.toContain("WeakBraking");

    const catalogSource = cloneCatalog();
    const rcs = partById(catalogSource, STARTER_PART_IDS.fourWayCornerRcs);
    rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-left").direction = { x: 1, y: 0, z: 0 };
    const report = evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(catalogSource), {
      policy: {
        thrustOffsetWarningMeters: 0.05,
        lowAccelerationMps2: 100,
        minimumRcsSymmetryRatio: 0.5
      }
    });
    expect(report.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "ThrustOffsetExceeded",
      "LowAcceleration",
      "RcsAuthorityAsymmetric"
    ]));
  });

  it("distinguishes missing compatible tanks from a zero planned fuel load", () => {
    const noTankSource = cloneCatalog();
    const noTankThruster = partById(noTankSource, STARTER_PART_IDS.smallChemicalBell).components.find(
      (component: MutableRecord) => component.kind === "MainThruster"
    );
    noTankThruster.propulsionSupply = { mode: "Fuel", fuelKind: "unavailable-propellant" };
    expect(
      evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(noTankSource)).diagnostics.map(
        (entry) => entry.code
      )
    ).toContain("NoCompatibleFuel");

    const emptySource = cloneCatalog();
    const emptyThruster = partById(emptySource, STARTER_PART_IDS.smallChemicalBell).components.find(
      (component: MutableRecord) => component.kind === "MainThruster"
    );
    emptyThruster.propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
    expect(
      evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(emptySource), {
        preview: { fuelFillFraction: 0 }
      }).diagnostics.map((entry) => entry.code)
    ).toContain("NoRequiredFuel");
  });

  it.each([
    ["ControlCore control", SCOUT_BLUEPRINT, STARTER_PART_IDS.scoutCockpitSmall, "control-primary", "directionRole", "MountNormal", "control-core"],
    ["FuelTank feed", SCOUT_BLUEPRINT, STARTER_PART_IDS.smallTank, "fuel-feed", "socketType", "cargoAttach", "fuel-tank"],
    ["CargoStorage access", CARGO_BLUEPRINT, STARTER_PART_IDS.mediumCargoBay, "cargo-access", "role", "Visual", "cargo-storage"],
    ["FixedWeapon hardpoint", WEAPON_BLUEPRINT, STARTER_PART_IDS.fixedForwardCannonMount, "hardpoint-main", "directionRole", "MountNormal", "fixed-weapon"],
    ["SensorUtility mount", WEAPON_BLUEPRINT, STARTER_PART_IDS.sensorDishModule, "sensor-mount", "socketType", "cargoAttach", "sensor-utility"],
    ["TurretWeapon yaw", WEAPON_BLUEPRINT, STARTER_PART_IDS.smallSingleGunTurret, "turret-yaw", "role", "Camera", "turret-weapon"]
  ])("blocks parser-valid but functionally invalid %s socket metadata", (_name, blueprint, partId, socketId, field, value, componentId) => {
    const source = cloneCatalog();
    const socket = partById(source, partId).sockets.find((candidate: MutableRecord) => candidate.socketId === socketId);
    socket[field] = value;
    const report = evaluateHandlingDiagnostics(blueprint, createShipPartCatalogSnapshot(source));
    const diagnostic = report.diagnostics.find(
      (entry) => entry.code === "FunctionalSocketInvalid" && entry.details.componentId === componentId
    );

    expect(diagnostic?.blocks).toEqual(["TestFlightReady", "ActiveShipReady"]);
    expect(diagnostic?.suggestedFixCodes).toEqual(["FixFunctionalSocket"]);
  });

  it("accepts a parser-valid zero-direction visual muzzle-flash socket", () => {
    const source = cloneCatalog();
    const weapon = partById(source, STARTER_PART_IDS.fixedForwardCannonMount);
    const component = weapon.components.find((candidate: MutableRecord) => candidate.kind === "FixedWeapon");
    weapon.sockets.find(
      (socket: MutableRecord) => socket.socketId === component.muzzleFlashSocketId
    ).direction = { x: 0, y: 0, z: 0 };
    const report = evaluateHandlingDiagnostics(WEAPON_BLUEPRINT, createShipPartCatalogSnapshot(source));

    expect(report.diagnostics.some(
      (entry) => entry.code === "FunctionalSocketInvalid" && entry.details.componentId === "fixed-weapon"
    )).toBe(false);
  });

  it("accepts one physically derived translation direction plus one torque axis as usable RCS", () => {
    const source = cloneCatalog();
    const rcs = partById(source, STARTER_PART_IDS.fourWayCornerRcs);
    rcs.components.find((component: MutableRecord) => component.kind === "RcsCluster").nozzleSocketIds = ["nozzle-front"];
    rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-front").direction = { x: 1, y: 0, z: 0 };
    const report = evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(source));

    expect(report.diagnostics.map((entry) => entry.code)).not.toContain("MissingUsableRcs");
    expect(report.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "MissingRcsNegativeX",
      "MissingRcsPositiveY",
      "MissingRcsNegativeY",
      "MissingRcsPositiveZ",
      "MissingRcsNegativeZ"
    ]));
  });

  it("keeps individual RCS-axis and torque gaps warning-only while requiring any translation and any torque", () => {
    const scout = evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, STARTER_CATALOG);
    const axisWarnings = scout.diagnostics.filter((entry) => entry.code.startsWith("MissingRcs"));
    expect(axisWarnings.every((entry) => entry.severity === "Warning" && entry.blocks.length === 0)).toBe(true);

    const source = cloneBlueprint();
    source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs").enabled = false;
    const noRcs = evaluateHandlingDiagnostics(source, STARTER_CATALOG);
    expect(noRcs.diagnostics.find((entry) => entry.code === "MissingUsableRcs")?.blocks).toEqual([
      "TestFlightReady",
      "ActiveShipReady"
    ]);
  });

  it("canonicalizes instance and connection insertion order", () => {
    const source = cloneBlueprint();
    source.instances.reverse();
    source.connections.reverse();
    source.referencedPartDefinitionIds.reverse();

    expect(evaluateHandlingDiagnostics(source, STARTER_CATALOG)).toEqual(
      evaluateHandlingDiagnostics(SCOUT_BLUEPRINT, STARTER_CATALOG)
    );
  });
});
