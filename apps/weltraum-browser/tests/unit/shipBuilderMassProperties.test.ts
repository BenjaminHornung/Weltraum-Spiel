import { describe, expect, it } from "vitest";
import {
  CARGO_BLUEPRINT,
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  STARTER_CATALOG_SIGNATURE,
  ShipBuilderDataError,
  WEAPON_BLUEPRINT,
  catalogDocumentForSerialization,
  createShipPartCatalogSnapshot,
  evaluateShipBlueprintMassProperties,
  shipBlueprintLayoutHash
} from "../../src/ship-builder";
import type {
  ShipBlueprint,
  ShipBuilderAxisAlignedBounds,
  ShipBuilderMassPropertiesReport,
  ShipBuilderVector3,
  ShipPartCatalogSnapshot
} from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneBlueprint = (source: ShipBlueprint = SCOUT_BLUEPRINT): MutableRecord => structuredClone(source) as MutableRecord;
const cloneCatalog = (): MutableRecord =>
  structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;

const vector = (x: number, y: number, z: number): ShipBuilderVector3 => ({ x, y, z });
const bounds = (minimum: ShipBuilderVector3, maximum: ShipBuilderVector3): ShipBuilderAxisAlignedBounds => ({
  minimum,
  maximum,
  size: vector(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
});
const scaleVector = (value: ShipBuilderVector3, scale: number): ShipBuilderVector3 =>
  vector(value.x * scale, value.y * scale, value.z * scale);
const scaleBounds = (value: ShipBuilderAxisAlignedBounds, scale: number): ShipBuilderAxisAlignedBounds =>
  bounds(scaleVector(value.minimum, scale), scaleVector(value.maximum, scale));

const evaluate = (
  source: unknown = SCOUT_BLUEPRINT,
  catalog: ShipPartCatalogSnapshot = STARTER_CATALOG
): ShipBuilderMassPropertiesReport => evaluateShipBlueprintMassProperties(source, catalog);

const expectVectorClose = (actual: ShipBuilderVector3 | undefined, expected: ShipBuilderVector3): void => {
  expect(actual).toBeDefined();
  expect(actual?.x).toBeCloseTo(expected.x, 12);
  expect(actual?.y).toBeCloseTo(expected.y, 12);
  expect(actual?.z).toBeCloseTo(expected.z, 12);
};

describe("ship-builder mass properties", () => {
  it.each([
    {
      name: "Scout",
      blueprint: SCOUT_BLUEPRINT,
      dryMassKg: 1450,
      center: vector(0, -3 / 145, 63 / 145),
      gridBounds: bounds(vector(-2, -3, -5), vector(2, 2.5, 4.5))
    },
    {
      name: "Cargo",
      blueprint: CARGO_BLUEPRINT,
      dryMassKg: 2540,
      center: vector(-105 / 254, 0, 30 / 127),
      gridBounds: bounds(vector(-5, -2.5, -8), vector(2.5, 2.5, 6))
    },
    {
      name: "Weapon",
      blueprint: WEAPON_BLUEPRINT,
      dryMassKg: 2560,
      center: vector(3 / 128, 17 / 64, 39 / 256),
      gridBounds: bounds(vector(-5, -2.5, -6), vector(5, 3.5, 5.5))
    }
  ])("matches the exact $name fixture dry mass, COM, and bounds", ({ blueprint, dryMassKg, center, gridBounds }) => {
    const report = evaluate(blueprint);

    expect(report.status).toBe("Valid");
    expect(report.catalogSignature).toBe(STARTER_CATALOG_SIGNATURE);
    expect(report.dryMassKg).toBe(dryMassKg);
    expectVectorClose(report.centerOfMass?.grid, center);
    expectVectorClose(report.centerOfMass?.meters, scaleVector(center, blueprint.gridMeters));
    expect(report.gridBounds).toEqual({
      grid: gridBounds,
      meters: scaleBounds(gridBounds, blueprint.gridMeters)
    });
    expect(report.contributions.map((contribution) => contribution.partInstanceId)).toEqual(
      blueprint.instances.map((instance) => instance.stableInstanceId).sort()
    );
    expect(report.contributions.reduce((sum, contribution) => sum + contribution.dryMassKg, 0)).toBe(dryMassKg);
    expect(report.diagnostics).toEqual([]);
    expect(report.signature).toMatch(/^[0-9a-f]{8}$/);
  });

  it("pins the unchanged catalog signature and all starter layout hashes", () => {
    expect(STARTER_CATALOG_SIGNATURE).toBe("5aaa27fd");
    expect({
      scout: shipBlueprintLayoutHash(SCOUT_BLUEPRINT),
      cargo: shipBlueprintLayoutHash(CARGO_BLUEPRINT),
      weapon: shipBlueprintLayoutHash(WEAPON_BLUEPRINT)
    }).toEqual({
      scout: "fc4597b6",
      cargo: "8613314e",
      weapon: "b38b31ec"
    });
  });

  it("uses enabled instances and definition dry mass only", () => {
    const source = cloneBlueprint();
    source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-engine").enabled = false;
    const report = evaluate(source);

    expect(report.dryMassKg).toBe(1210);
    expect(report.contributions.map((contribution) => contribution.partInstanceId)).not.toContain("scout-engine");
    expect(JSON.stringify(report)).not.toContain("addedMassKilograms");
    expect(JSON.stringify(report)).not.toContain("capacityKilograms");
  });

  it("keeps bounds for nonempty zero-mass blueprints and returns a Warning with null COM", () => {
    const catalogSource = cloneCatalog();
    for (const definition of catalogSource.partDefinitions) {
      definition.dryMassKilograms = 0;
    }
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const report = evaluate(cloneBlueprint(), catalog);

    expect(report.status).toBe("ValidWithWarnings");
    expect(report.dryMassKg).toBe(0);
    expect(report.centerOfMass).toBeNull();
    expect(report.gridBounds?.grid).toEqual(bounds(vector(-2, -3, -5), vector(2, 2.5, 4.5)));
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["ZeroDryMass"]);
  });

  it("returns null COM and bounds for an empty blueprint without adding ZeroDryMass", () => {
    const source = cloneBlueprint();
    source.instances = [];
    source.connections = [];
    source.referencedPartDefinitionIds = [];
    const report = evaluate(source);

    expect(report.status).toBe("Invalid");
    expect(report.dryMassKg).toBe(0);
    expect(report.centerOfMass).toBeNull();
    expect(report.gridBounds).toBeNull();
    expect(report.contributions).toEqual([]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["NoEnabledInstances"]);
  });

  it("swaps asymmetric X/Z footprint bounds at yaw 90 without changing mass or COM", () => {
    const yawZeroSource = cloneBlueprint();
    const frame = yawZeroSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame");
    yawZeroSource.instances = [frame];
    yawZeroSource.connections = [];
    yawZeroSource.referencedPartDefinitionIds = [frame.partDefinitionId];
    frame.localRotation.yaw = 0;
    const yawZero = evaluate(yawZeroSource);

    const yawNinetySource = structuredClone(yawZeroSource) as MutableRecord;
    yawNinetySource.instances[0].localRotation.yaw = 90;
    const yawNinety = evaluate(yawNinetySource);

    expect(yawZero.dryMassKg).toBe(300);
    expect(yawNinety.dryMassKg).toBe(300);
    expect(yawNinety.centerOfMass).toEqual(yawZero.centerOfMass);
    expect(yawZero.gridBounds?.grid).toEqual(bounds(vector(-2, -1, -3), vector(2, 1, 3)));
    expect(yawNinety.gridBounds?.grid).toEqual(bounds(vector(-3, -1, -2), vector(3, 1, 2)));
  });

  it("projects meter-space bound sizes directly from grid sizes", () => {
    const catalogSource = cloneCatalog();
    const source = cloneBlueprint();
    const frame = source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame");
    const frameDefinition = catalogSource.partDefinitions.find(
      (definition: MutableRecord) => definition.partDefinitionId === frame.partDefinitionId
    );
    if (frameDefinition === undefined) {
      throw new Error("Missing frame definition.");
    }
    frameDefinition.gridFootprint.x = 1;
    source.instances = [frame];
    source.connections = [];
    source.referencedPartDefinitionIds = [frame.partDefinitionId];
    source.gridMeters = 0.1;
    frame.localGridPosition.x = -100;
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const report = evaluate(source, catalog);

    expect(report.status).toBe("Valid");
    expect(report.gridBounds?.grid.size.x).toBe(1);
    expect(report.gridBounds?.meters.size.x).toBe(0.1);
    expect(report.gridBounds?.meters.size.x).toBe(report.gridBounds!.grid.size.x * source.gridMeters);
  });

  it("fails closed on dry-mass aggregation overflow", () => {
    const catalogSource = cloneCatalog();
    for (const definition of catalogSource.partDefinitions) {
      definition.dryMassKilograms = Number.MAX_VALUE;
    }
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const report = evaluate(cloneBlueprint(), catalog);

    expect(report.status).toBe("Invalid");
    expect(report.dryMassKg).toBeNull();
    expect(report.centerOfMass).toBeNull();
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain("NonFiniteDryMassAggregate");
    expect(JSON.stringify(report)).not.toMatch(/Infinity|NaN/);
  });

  it("returns null for nonfinite COM and bounds projections", () => {
    const source = cloneBlueprint();
    const frame = source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame");
    source.instances = [frame];
    source.connections = [];
    source.referencedPartDefinitionIds = [frame.partDefinitionId];
    source.gridMeters = Number.MAX_VALUE;
    frame.localGridPosition.x = 2;
    const report = evaluate(source);

    expect(report.dryMassKg).toBe(300);
    expect(report.centerOfMass).toBeNull();
    expect(report.gridBounds).toBeNull();
    expect(report.contributions[0].massCenter.meters).toBeNull();
    expect(report.contributions[0].gridBounds).toBeNull();
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "NonFiniteCenterOfMass",
      "InvalidGridBounds"
    ]);
    expect(JSON.stringify(report)).not.toMatch(/Infinity|NaN/);
  });

  it("detects weighted COM overflow and precision-collapsed footprint bounds", () => {
    const source = cloneBlueprint();
    const frame = source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame");
    source.instances = [frame];
    source.connections = [];
    source.referencedPartDefinitionIds = [frame.partDefinitionId];
    source.gridMeters = 1;
    frame.localGridPosition.x = Number.MAX_VALUE;
    const report = evaluate(source);

    expect(report.dryMassKg).toBe(300);
    expect(report.centerOfMass).toBeNull();
    expect(report.gridBounds).toBeNull();
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "NonFiniteCenterOfMass",
      "InvalidGridBounds"
    ]);
    expect(JSON.stringify(report)).not.toMatch(/Infinity|NaN/);
  });

  it("canonicalizes reordered input to an identical report and signature", () => {
    const reordered = cloneBlueprint(WEAPON_BLUEPRINT);
    reordered.instances.reverse();
    reordered.connections.reverse();
    reordered.referencedPartDefinitionIds.reverse();

    const canonical = evaluate(WEAPON_BLUEPRINT);
    const reorderedReport = evaluate(reordered);
    expect(reorderedReport).toEqual(canonical);
    expect(reorderedReport.signature).toBe(canonical.signature);
  });

  it("keeps invalid references in the schema layer", () => {
    const invalid = cloneBlueprint();
    invalid.instances[0].partDefinitionId = "missing-definition";
    invalid.referencedPartDefinitionIds = [
      ...new Set(invalid.instances.map((instance: MutableRecord) => instance.partDefinitionId))
    ].sort();

    expect(() => evaluate(invalid)).toThrowError(ShipBuilderDataError);
  });

  it("deeply freezes contributions, coordinates, bounds, diagnostics, and summary", () => {
    const report = evaluate(SCOUT_BLUEPRINT);

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.contributions)).toBe(true);
    expect(Object.isFrozen(report.contributions[0])).toBe(true);
    expect(Object.isFrozen(report.contributions[0].massCenter.grid)).toBe(true);
    expect(Object.isFrozen(report.gridBounds?.grid.minimum)).toBe(true);
    expect(Object.isFrozen(report.diagnostics)).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
  });
});
