import { describe, expect, it } from "vitest";
import {
  CARGO_BLUEPRINT,
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  STARTER_CATALOG_SIGNATURE,
  STARTER_PART_IDS,
  ShipBuilderDataError,
  WEAPON_BLUEPRINT,
  catalogDocumentForSerialization,
  createShipAnalysisPolicy,
  createShipPartCatalogSnapshot,
  createShipStatPreview,
  evaluateShipBlueprintMassProperties,
  evaluateShipStats
} from "../../src/ship-builder";
import type { ShipBlueprint, ShipPartCatalogSnapshot } from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneBlueprint = (source: ShipBlueprint = SCOUT_BLUEPRINT): MutableRecord => structuredClone(source) as MutableRecord;
const cloneCatalog = (): MutableRecord =>
  structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;
const partById = (catalog: MutableRecord, id: string): MutableRecord => {
  const part = catalog.partDefinitions.find((candidate: MutableRecord) => candidate.partDefinitionId === id);
  if (part === undefined) throw new Error(`Missing part ${id}.`);
  return part;
};
const componentByKind = (part: MutableRecord, kind: string): MutableRecord => {
  const component = part.components.find((candidate: MutableRecord) => candidate.kind === kind);
  if (component === undefined) throw new Error(`Missing component ${kind}.`);
  return component;
};
const fuelCatalog = (): ShipPartCatalogSnapshot => {
  const source = cloneCatalog();
  const thruster = componentByKind(partById(source, STARTER_PART_IDS.smallChemicalBell), "MainThruster");
  thruster.propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
  return createShipPartCatalogSnapshot(source);
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

describe("ship-builder full stats", () => {
  it("creates canonical frozen preview and policy defaults and rejects invalid numbers", () => {
    const preview = createShipStatPreview();
    const policy = createShipAnalysisPolicy();

    expect(preview).toMatchObject({ fuelFillFraction: 1, cargoPreviewMassKg: 0, cargoPreviewVolumeM3: 0 });
    expect(policy).toMatchObject({
      thrustOffsetWarningMeters: 0.35,
      weakBrakingRatio: 0.25,
      hardOverlapRatio: 0.75,
      lowAccelerationMps2: null,
      minimumRcsSymmetryRatio: null
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(policy)).toBe(true);
    expect(preview.signature).toMatch(/^[0-9a-f]{8}$/);
    expect(policy.signature).toMatch(/^[0-9a-f]{8}$/);
    expect(() => createShipStatPreview({ fuelFillFraction: 1.01 })).toThrowError(ShipBuilderDataError);
    expect(() => createShipStatPreview({ cargoPreviewMassKg: Number.NaN })).toThrowError(ShipBuilderDataError);
  });

  it.each([
    ["Scout", SCOUT_BLUEPRINT, 1450, 0, 0, "107deb2e"],
    ["Cargo", CARGO_BLUEPRINT, 2540, 1500, 8.5, "4b0534b4"],
    ["Weapon", WEAPON_BLUEPRINT, 2560, 0, 0, "7ad391fc"]
  ])("produces deterministic explicit stats for the %s fixture", (_name, blueprint, dryMass, cargoMass, cargoVolume, signature) => {
    const first = evaluateShipStats(blueprint, STARTER_CATALOG);
    const second = evaluateShipStats(blueprint, STARTER_CATALOG);

    expect(first).toEqual(second);
    expect(first.signature).toBe(signature);
    expect(second.signature).toBe(signature);
    expect(first.catalogSignature).toBe(STARTER_CATALOG_SIGNATURE);
    expect(first.stats.dryMassKg).toEqual({ availability: "Available", value: dryMass, unit: "kg" });
    expect(first.stats.dryMassKg.value).toBe(evaluateShipBlueprintMassProperties(blueprint, STARTER_CATALOG).dryMassKg);
    expect(first.stats.cargoMassCapacityKg.value).toBe(cargoMass);
    expect(first.stats.cargoVolumeCapacityM3.value).toBe(cargoVolume);
    expectFiniteNumericLeaves(first);
    expect(Object.isFrozen(first.stats.centerOfMass)).toBe(true);
  });

  it("keeps the starter signature and omission of propulsion metadata unchanged", () => {
    expect(STARTER_CATALOG_SIGNATURE).toBe("5aaa27fd");
    expect(
      STARTER_CATALOG.partDefinitions
        .flatMap((part) => part.components)
        .filter((component) => component.kind === "MainThruster" || component.kind === "RcsCluster")
        .every((component) => !("propulsionSupply" in component))
    ).toBe(true);
  });

  it("adds fuel and cargo to loaded mass, shifts COM, and preserves unclamped preview values", () => {
    const noLoad = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG, {
      preview: { fuelFillFraction: 0 }
    });
    const loaded = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG, {
      preview: { fuelFillFraction: 1, cargoPreviewMassKg: 25, cargoPreviewVolumeM3: 9 }
    });

    expect(noLoad.stats.totalLoadedMassKg.value).toBe(1450);
    expect(loaded.stats.plannedFuelMassKg.value).toBe(160);
    expect(loaded.stats.totalLoadedMassKg.value).toBe(1635);
    expect(loaded.stats.plannedCargoMassKg.value).toBe(25);
    expect(loaded.stats.plannedCargoVolumeM3.value).toBe(9);
    expect(loaded.stats.centerOfMass.availability).toBe("Invalid");
    expect(loaded.stats.accelerationLoadedMps2.value).toBeLessThan(noLoad.stats.accelerationLoadedMps2.value as number);
  });

  it("pins the Scout COM, thrust geometry, braking, and reservation formulas", () => {
    const report = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG);

    expect(report.stats.centerOfMass).toEqual({
      availability: "Available",
      value: { x: 0, y: -19 / 322, z: 47 / 322 },
      unit: "m"
    });
    expect(report.stats.thrustAxisPoint).toEqual({
      availability: "Available",
      value: { x: 0, y: 0, z: -2.4 },
      unit: "m"
    });
    expect(report.stats.thrustAxisDirection).toEqual({
      availability: "Available",
      value: { x: 0, y: 0, z: 1 },
      unit: "unitless"
    });
    expect(report.stats.thrustOffsetMeters).toEqual({ availability: "Available", value: 19 / 322, unit: "m" });
    expect(report.stats.forwardAccelerationMps2).toEqual({
      availability: "Available",
      value: 18000 / 1610,
      unit: "m/s^2"
    });
    expect(report.stats.brakingAccelerationMps2).toEqual({ availability: "Available", value: 0, unit: "m/s^2" });
    expect(report.stats.brakingRatio).toEqual({ availability: "Available", value: 0, unit: "ratio" });
    expect(report.stats.powerRequired).toEqual({ availability: "Available", value: 250 + 120, unit: "W" });
    expect(report.stats.heatGenerated).toEqual({ availability: "Available", value: 125 + 600, unit: "W" });
  });

  it("positions cargo at storage origins and marks unpositionable cargo COM invalid", () => {
    const cargo = evaluateShipStats(CARGO_BLUEPRINT, STARTER_CATALOG, {
      preview: { fuelFillFraction: 0, cargoPreviewMassKg: 500 }
    });
    const scout = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG, {
      preview: { fuelFillFraction: 0, cargoPreviewMassKg: 1 }
    });

    expect(cargo.stats.centerOfMass.availability).toBe("Available");
    expect(cargo.stats.centerOfMass.value?.z).toBeLessThan(0);
    expect(scout.stats.totalLoadedMassKg.value).toBe(1451);
    expect(scout.stats.centerOfMass.availability).toBe("Invalid");
  });

  it("summarizes enabled builder weapons without a combat dependency", () => {
    const source = cloneBlueprint(WEAPON_BLUEPRINT);
    const complete = evaluateShipStats(source, STARTER_CATALOG);
    source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "weapon-turret").enabled = false;
    const disabled = evaluateShipStats(source, STARTER_CATALOG);

    expect(complete.stats.weaponCount.value).toBe(2);
    expect(complete.stats.usableWeaponCount.value).toBe(2);
    expect(complete.stats.fixedWeaponCount.value).toBe(1);
    expect(complete.stats.turretWeaponCount.value).toBe(1);
    expect(complete.stats.missingMuzzleCount.value).toBe(0);
    expect(complete.stats.blockedOrInvalidWeaponCount.value).toBe(0);
    expect(disabled.stats.weaponCount.value).toBe(1);
  });

  it("calculates finite rocket-equation performance only for a complete compatible fuel mode", () => {
    const catalog = fuelCatalog();
    const report = evaluateShipStats(SCOUT_BLUEPRINT, catalog);

    expect(report.stats.deltaVMps.availability).toBe("Available");
    expect(report.stats.deltaVMps.value).toBeCloseTo((18000 / 0.35) * Math.log(1610 / 1450), 10);
    expect(report.stats.burnTimeSeconds.value).toBeCloseTo(160 / 0.35, 10);
    expect(Number.isFinite(report.stats.deltaVMps.value as number)).toBe(true);
    expect(report.signature).toBe("38cf44b3");
  });

  it("keeps missing, fuel-free, mixed, and empty propellant modes explicitly unavailable", () => {
    expect(evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG).stats.deltaVMps.availability).toBe(
      "UnavailableMissingMetadata"
    );
    const fuelFreeSource = cloneCatalog();
    const fuelFree = componentByKind(partById(fuelFreeSource, STARTER_PART_IDS.smallChemicalBell), "MainThruster");
    fuelFree.propellantBurnKilogramsPerSecond = 0;
    fuelFree.propulsionSupply = { mode: "FuelFreeExperimental" };
    expect(evaluateShipStats(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(fuelFreeSource)).stats.deltaVMps.availability).toBe(
      "UnavailableUnsupported"
    );
    expect(evaluateShipStats(SCOUT_BLUEPRINT, fuelCatalog(), { preview: { fuelFillFraction: 0 } }).stats.deltaVMps.availability).toBe(
      "UnavailableNoFuel"
    );

    const mixedSource = cloneCatalog();
    const engines = partById(mixedSource, STARTER_PART_IDS.twinMediumEngine).components.filter(
      (component: MutableRecord) => component.kind === "MainThruster"
    );
    engines[0].propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
    engines[1].propellantBurnKilogramsPerSecond = 0;
    engines[1].propulsionSupply = { mode: "FuelFreeExperimental" };
    expect(evaluateShipStats(WEAPON_BLUEPRINT, createShipPartCatalogSnapshot(mixedSource)).stats.deltaVMps.availability).toBe(
      "UnavailableUnsupported"
    );

    const mixedFuelKindsSource = cloneCatalog();
    const mixedFuelKindEngines = partById(mixedFuelKindsSource, STARTER_PART_IDS.twinMediumEngine).components.filter(
      (component: MutableRecord) => component.kind === "MainThruster"
    );
    mixedFuelKindEngines[0].propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
    mixedFuelKindEngines[1].propulsionSupply = { mode: "Fuel", fuelKind: "second-propellant" };
    expect(
      evaluateShipStats(WEAPON_BLUEPRINT, createShipPartCatalogSnapshot(mixedFuelKindsSource)).stats.deltaVMps.availability
    ).toBe("UnavailableUnsupported");
  });

  it("rejects inconsistent propulsion metadata at the catalog boundary", () => {
    const source = cloneCatalog();
    const thruster = componentByKind(partById(source, STARTER_PART_IDS.smallChemicalBell), "MainThruster");
    thruster.propulsionSupply = { mode: "Fuel", fuelKind: "chemical-propellant" };
    thruster.propellantBurnKilogramsPerSecond = 0;
    expect(() => createShipPartCatalogSnapshot(source)).toThrowError(ShipBuilderDataError);
  });

  it("canonicalizes insertion order, freezes every result, and preserves mutable caller inputs", () => {
    const source = cloneBlueprint(WEAPON_BLUEPRINT);
    source.instances.reverse();
    source.connections.reverse();
    source.referencedPartDefinitionIds.reverse();
    const before = JSON.stringify(source);
    const reordered = evaluateShipStats(source, STARTER_CATALOG);
    const canonical = evaluateShipStats(WEAPON_BLUEPRINT, STARTER_CATALOG);

    expect(reordered).toEqual(canonical);
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(reordered)).toBe(true);
    expect(Object.isFrozen(reordered.preview)).toBe(true);
    expect(Object.isFrozen(reordered.stats)).toBe(true);
    source.displayName = "still caller-owned";
    expect(source.displayName).toBe("still caller-owned");
  });

  it("canonicalizes catalog insertion order to the same report signature", () => {
    const reorderedSource = cloneCatalog();
    reorderedSource.categories.reverse();
    reorderedSource.partDefinitions.reverse();
    for (const definition of reorderedSource.partDefinitions) {
      definition.components.reverse();
      definition.sockets.reverse();
    }
    const reorderedCatalog = createShipPartCatalogSnapshot(reorderedSource);

    expect(reorderedCatalog.signature).toBe(STARTER_CATALOG_SIGNATURE);
    expect(evaluateShipStats(SCOUT_BLUEPRINT, reorderedCatalog)).toEqual(
      evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG)
    );
  });

  it("returns unavailable thrust dependencies when no usable main thruster exists", () => {
    const source = cloneBlueprint();
    source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-engine").enabled = false;
    const report = evaluateShipStats(source, STARTER_CATALOG);

    expect(report.stats.mainThrustNewtons.availability).toBe("UnavailableNoThrust");
    expect(report.stats.accelerationLoadedMps2.availability).toBe("UnavailableNoThrust");
    expect(report.stats.thrustAxisDirection.availability).toBe("UnavailableNoThrust");
  });
});
