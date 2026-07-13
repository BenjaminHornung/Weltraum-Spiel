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
  evaluateShipFlightReadiness
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

const completeFuelCatalogSource = (): MutableRecord => {
  const source = cloneCatalog();
  const engine = partById(source, STARTER_PART_IDS.smallChemicalBell);
  const thruster = engine.components.find((component: MutableRecord) => component.kind === "MainThruster");
  thruster.propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
  return source;
};

const completeFuelCatalog = (): ReturnType<typeof createShipPartCatalogSnapshot> =>
  createShipPartCatalogSnapshot(completeFuelCatalogSource());

const catalogWithBrakeRatio = (ratio: number): ReturnType<typeof createShipPartCatalogSnapshot> => {
  const source = completeFuelCatalogSource();
  const engine = partById(source, STARTER_PART_IDS.smallChemicalBell);
  const forward = engine.components.find((component: MutableRecord) => component.kind === "MainThruster");
  const brakeSocket = structuredClone(engine.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-main"));
  brakeSocket.socketId = "nozzle-brake";
  brakeSocket.compatibilityAliases = ["nozzle-brake"];
  brakeSocket.direction = { x: 0, y: 0, z: -1 };
  engine.sockets.push(brakeSocket);
  engine.components.push({
    ...structuredClone(forward),
    componentId: "main-thruster-brake",
    nozzleSocketId: "nozzle-brake",
    maximumThrustNewtons: forward.maximumThrustNewtons * ratio
  });
  return createShipPartCatalogSnapshot(source);
};

const activeEligibleCatalog = (): ReturnType<typeof createShipPartCatalogSnapshot> => catalogWithBrakeRatio(0.25);

const overflowMassFlowCatalog = (): ReturnType<typeof createShipPartCatalogSnapshot> => {
  const source = completeFuelCatalogSource();
  const engine = partById(source, STARTER_PART_IDS.smallChemicalBell);
  const thruster = engine.components.find((component: MutableRecord) => component.kind === "MainThruster");
  thruster.propellantBurnKilogramsPerSecond = 1e308;
  engine.components.push({
    ...structuredClone(thruster),
    componentId: "main-thruster-overflow-secondary"
  });
  return createShipPartCatalogSnapshot(source);
};

const overflowCargoCapacityCatalog = (): ReturnType<typeof createShipPartCatalogSnapshot> => {
  const source = completeFuelCatalogSource();
  const cargoBay = partById(source, STARTER_PART_IDS.mediumCargoBay);
  const storage = cargoBay.components.find((component: MutableRecord) => component.kind === "CargoStorage");
  storage.capacityCubicMeters = 1e308;
  storage.maximumPayloadKilograms = 1e308;
  cargoBay.components.push({
    ...structuredClone(storage),
    componentId: "cargo-storage-overflow-secondary"
  });
  return createShipPartCatalogSnapshot(source);
};

describe("ship-builder flight readiness", () => {
  it("keeps an incomplete schema-valid ship DraftValid while blocking higher levels", () => {
    const source = cloneBlueprint();
    source.instances = [source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame")];
    source.connections = [];
    source.referencedPartDefinitionIds = [STARTER_PART_IDS.smallSpineFrame];
    const report = evaluateShipFlightReadiness(source, STARTER_CATALOG);

    expect(report.status).toBe("DraftValid");
    expect(report.assessments.draft).toMatchObject({ level: "DraftValid", eligible: true, blockingDiagnosticCodes: [] });
    expect(report.assessments.testFlight.eligible).toBe(false);
    expect(report.assessments.activeShip.eligible).toBe(false);
    expect(report.assessments.testFlight.blockingDiagnosticCodes).toEqual(expect.arrayContaining([
      "MissingControlCore",
      "NoMainThrust",
      "MissingUsableRcs"
    ]));
    expect(report.assessments.testFlight.warningDiagnosticCodes).toContain("CameraAnchorMissing");
  });

  it("blocks TestFlight on missing propulsion metadata but not on individual RCS-axis warnings", () => {
    const missingMetadata = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, STARTER_CATALOG);
    expect(missingMetadata.assessments.testFlight.blockingDiagnosticCodes).toContain("MissingPropulsionMetadata");
    expect(missingMetadata.assessments.testFlight.warningDiagnosticCodes).toEqual(expect.arrayContaining([
      "MissingRcsPositiveY",
      "MissingRcsNegativeY"
    ]));

    const complete = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, completeFuelCatalog());
    expect(complete.assessments.testFlight.blockingDiagnosticCodes).not.toContain("MissingPropulsionMetadata");
    expect(complete.assessments.testFlight.blockingDiagnosticCodes).not.toContain("MissingUsableRcs");
    expect(complete.assessments.testFlight.eligible).toBe(true);
  });

  it("fails both readiness levels closed when finite thruster inputs overflow propulsion aggregates", () => {
    const report = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, overflowMassFlowCatalog());
    const invalidStats = report.handlingReport.diagnostics.filter(
      (entry) => entry.code === "StatUnavailable" && entry.details.availability === "Invalid"
    );

    expect(report.statsReport.stats.deltaVMps.availability).toBe("Invalid");
    expect(report.statsReport.stats.burnTimeSeconds.availability).toBe("Invalid");
    expect(report.assessments.testFlight.eligible).toBe(false);
    expect(report.assessments.activeShip.eligible).toBe(false);
    expect(report.assessments.testFlight.blockingDiagnosticCodes).toContain("StatUnavailable");
    expect(invalidStats.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      "/stats/deltaVMps",
      "/stats/burnTimeSeconds"
    ]));
    expect(invalidStats.every((entry) =>
      entry.blocks.includes("TestFlightReady") && entry.blocks.includes("ActiveShipReady")
    )).toBe(true);
    expectFiniteNumericLeaves(report);
  });

  it("fails both readiness levels closed when finite cargo capacities overflow their aggregates", () => {
    const report = evaluateShipFlightReadiness(CARGO_BLUEPRINT, overflowCargoCapacityCatalog());
    const invalidStats = report.handlingReport.diagnostics.filter(
      (entry) => entry.code === "StatUnavailable" && entry.details.availability === "Invalid"
    );

    expect(report.statsReport.stats.cargoMassCapacityKg.availability).toBe("Invalid");
    expect(report.statsReport.stats.cargoVolumeCapacityM3.availability).toBe("Invalid");
    expect(report.assessments.testFlight.eligible).toBe(false);
    expect(report.assessments.activeShip.eligible).toBe(false);
    expect(report.assessments.testFlight.blockingDiagnosticCodes).toContain("StatUnavailable");
    expect(invalidStats.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      "/stats/cargoMassCapacityKg",
      "/stats/cargoVolumeCapacityM3"
    ]));
    expect(invalidStats.every((entry) =>
      entry.blocks.includes("TestFlightReady") && entry.blocks.includes("ActiveShipReady")
    )).toBe(true);
    expectFiniteNumericLeaves(report);
  });

  it("does not block TestFlight for a zero-direction visual muzzle-flash socket", () => {
    const source = completeFuelCatalogSource();
    const weapon = partById(source, STARTER_PART_IDS.fixedForwardCannonMount);
    const component = weapon.components.find((candidate: MutableRecord) => candidate.kind === "FixedWeapon");
    weapon.sockets.find(
      (socket: MutableRecord) => socket.socketId === component.muzzleFlashSocketId
    ).direction = { x: 0, y: 0, z: 0 };
    const report = evaluateShipFlightReadiness(WEAPON_BLUEPRINT, createShipPartCatalogSnapshot(source));

    expect(report.assessments.testFlight.blockingDiagnosticCodes).not.toContain("FunctionalSocketInvalid");
    expect(report.handlingReport.diagnostics.some(
      (entry) => entry.code === "FunctionalSocketInvalid" && entry.details.componentId === "fixed-weapon"
    )).toBe(false);
  });

  it("treats Active as stricter static eligibility with braking and thrust-offset gates", () => {
    const testFlight = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, completeFuelCatalog());
    expect(testFlight.assessments.activeShip.blockingDiagnosticCodes).toContain("WeakBraking");

    const active = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, activeEligibleCatalog());
    expect(active.statsReport.stats.brakingRatio.value).toBe(0.25);
    expect(active.assessments.activeShip.blockingDiagnosticCodes).not.toContain("WeakBraking");
    expect(active.assessments.activeShip.blockingDiagnosticCodes).not.toContain("ThrustOffsetExceeded");
    expect(active.assessments.activeShip.eligible).toBe(true);
    expect(active.status).toBe("ActiveShipReady");
  });

  it("requires exactly one valid camera anchor", () => {
    const missingCatalogSource = completeFuelCatalogSource();
    const cockpit = partById(missingCatalogSource, STARTER_PART_IDS.scoutCockpitSmall);
    delete cockpit.components.find((component: MutableRecord) => component.kind === "ControlCore").cameraSocketId;
    const missing = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(missingCatalogSource));
    expect(missing.assessments.testFlight.eligible).toBe(true);
    expect(missing.assessments.testFlight.warningDiagnosticCodes).toContain("CameraAnchorMissing");
    expect(missing.assessments.activeShip.blockingDiagnosticCodes).toContain("CameraAnchorMissing");

    const ambiguousCatalogSource = completeFuelCatalogSource();
    const ambiguousCockpit = partById(ambiguousCatalogSource, STARTER_PART_IDS.scoutCockpitSmall);
    const control = ambiguousCockpit.components.find((component: MutableRecord) => component.kind === "ControlCore");
    ambiguousCockpit.components.push({ ...structuredClone(control), componentId: "control-core-secondary" });
    const ambiguous = evaluateShipFlightReadiness(
      SCOUT_BLUEPRINT,
      createShipPartCatalogSnapshot(ambiguousCatalogSource)
    );
    expect(ambiguous.assessments.testFlight.eligible).toBe(true);
    expect(ambiguous.assessments.testFlight.warningDiagnosticCodes).toContain("CameraAnchorAmbiguous");
    expect(ambiguous.assessments.activeShip.blockingDiagnosticCodes).toContain("CameraAnchorAmbiguous");
  });

  it("fails Active closed when thrust offset or braking ratio is unavailable without blocking TestFlight", () => {
    const offsetUnavailable = evaluateShipFlightReadiness(SCOUT_BLUEPRINT, catalogWithBrakeRatio(1));
    expect(offsetUnavailable.statsReport.stats.thrustOffsetMeters.availability).not.toBe("Available");
    expect(offsetUnavailable.assessments.testFlight.eligible).toBe(true);
    expect(offsetUnavailable.assessments.activeShip.blockingDiagnosticCodes).toContain("ThrustOffsetUnavailable");
    expect(offsetUnavailable.assessments.activeShip.suggestedFixCodes).toContain("AlignThrustAxisWithCenterOfMass");

    const brakingSource = completeFuelCatalogSource();
    const engine = partById(brakingSource, STARTER_PART_IDS.smallChemicalBell);
    engine.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-main").direction = { x: 0, y: 0, z: -1 };
    const brakingUnavailable = evaluateShipFlightReadiness(
      SCOUT_BLUEPRINT,
      createShipPartCatalogSnapshot(brakingSource)
    );
    expect(brakingUnavailable.statsReport.stats.brakingRatio.availability).not.toBe("Available");
    expect(brakingUnavailable.assessments.testFlight.eligible).toBe(true);
    expect(brakingUnavailable.assessments.activeShip.blockingDiagnosticCodes).toContain("BrakingRatioUnavailable");
    expect(brakingUnavailable.assessments.activeShip.suggestedFixCodes).toContain("IncreaseBrakingAuthority");
  });

  it("nests matching provenance, pins signatures, freezes recursively, and preserves input", () => {
    const source = cloneBlueprint();
    const before = JSON.stringify(source);
    const first = evaluateShipFlightReadiness(source, STARTER_CATALOG);
    const second = evaluateShipFlightReadiness(source, STARTER_CATALOG);

    expect(first).toEqual(second);
    expect(first.signature).toBe("664ebe5a");
    expect(first.statsSignature).toBe(first.statsReport.signature);
    expect(first.handlingSignature).toBe(first.handlingReport.signature);
    expect(first.catalogSignature).toBe(first.statsReport.catalogSignature);
    expect(first.blueprintLayoutHash).toBe(first.handlingReport.blueprintLayoutHash);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.assessments)).toBe(true);
    expect(Object.isFrozen(first.statsReport.stats)).toBe(true);
    expect(Object.isFrozen(first.handlingReport.diagnostics)).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("canonicalizes insertion order and continues to throw parser and future-version errors", () => {
    const source = cloneBlueprint();
    source.instances.reverse();
    source.connections.reverse();
    source.referencedPartDefinitionIds.reverse();
    expect(evaluateShipFlightReadiness(source, STARTER_CATALOG)).toEqual(
      evaluateShipFlightReadiness(SCOUT_BLUEPRINT, STARTER_CATALOG)
    );

    const future = cloneBlueprint();
    future.schemaVersion = 999;
    expect(() => evaluateShipFlightReadiness(future, STARTER_CATALOG)).toThrowError(ShipBuilderDataError);
  });
});
