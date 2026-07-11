import { describe, expect, it } from "vitest";
import {
  BUILT_IN_COMPONENT_KINDS,
  BUILT_IN_PART_CATEGORY_IDS,
  ShipBuilderDataError,
  STARTER_CATALOG,
  STARTER_CATALOG_SIGNATURE,
  STARTER_PART_IDS,
  canonicalShipPartCatalogJson,
  catalogDocumentForSerialization,
  createShipPartCatalogSnapshot,
  parsePartCategoryId,
  parseShipPartCatalog,
  serializeShipPartCatalog
} from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneStarterCatalog = (): MutableRecord => structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;

const partById = (catalog: MutableRecord, partDefinitionId: string): MutableRecord => {
  const part = catalog.partDefinitions.find((candidate: MutableRecord) => candidate.partDefinitionId === partDefinitionId);
  if (part === undefined) {
    throw new Error(`Missing starter part ${partDefinitionId}.`);
  }
  return part;
};

const dataError = (operation: () => unknown): ShipBuilderDataError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ShipBuilderDataError);
    return error as ShipBuilderDataError;
  }

  throw new Error("Expected a ShipBuilderDataError.");
};

describe("ship-builder starter catalog", () => {
  it("contains eight deterministic categories and exactly two named concepts per category", () => {
    expect(STARTER_CATALOG.categories.map((category) => category.categoryId)).toEqual([
      "cockpit",
      "hullFrame",
      "mainThruster",
      "rcs",
      "fuelPower",
      "cargoStorage",
      "weapon",
      "utility"
    ]);
    expect(STARTER_CATALOG.summary.categoryCount).toBe(8);
    expect(STARTER_CATALOG.summary.partDefinitionCount).toBe(16);
    expect(STARTER_CATALOG.partDefinitions.map((part) => part.partDefinitionId)).toEqual([
      STARTER_PART_IDS.industrialCockpitBox,
      STARTER_PART_IDS.scoutCockpitSmall,
      STARTER_PART_IDS.mediumRectangularFrame,
      STARTER_PART_IDS.smallSpineFrame,
      STARTER_PART_IDS.smallChemicalBell,
      STARTER_PART_IDS.twinMediumEngine,
      STARTER_PART_IDS.fourWayCornerRcs,
      STARTER_PART_IDS.sixWayCubeRcs,
      STARTER_PART_IDS.mediumSideTank,
      STARTER_PART_IDS.smallTank,
      STARTER_PART_IDS.mediumCargoBay,
      STARTER_PART_IDS.smallStorageBox,
      STARTER_PART_IDS.fixedForwardCannonMount,
      STARTER_PART_IDS.smallSingleGunTurret,
      STARTER_PART_IDS.dockingConnector,
      STARTER_PART_IDS.sensorDishModule
    ]);

    for (const category of STARTER_CATALOG.categories) {
      expect(STARTER_CATALOG.indexes.partsByCategory[category.categoryId]).toHaveLength(2);
    }

    for (const definition of STARTER_CATALOG.partDefinitions) {
      expect(definition.extensions?.["weltraum.balance"]).toEqual(
        expect.objectContaining({ provisional: true, source: "docs/spielkonzept/ship-builder-modular-parts.md" })
      );
      expect("buildCostReferences" in definition).toBe(false);
      expect("stats" in definition).toBe(false);
    }
  });

  it("preserves the required serialized built-in IDs and accepts only stable ASCII IDs", () => {
    expect(Object.values(BUILT_IN_PART_CATEGORY_IDS)).toEqual([
      "cockpit",
      "hullFrame",
      "mainThruster",
      "rcs",
      "fuelPower",
      "cargoStorage",
      "weapon",
      "utility"
    ]);

    for (const categoryId of Object.values(BUILT_IN_PART_CATEGORY_IDS)) {
      expect(parsePartCategoryId(categoryId, "/categoryId")).toBe(categoryId);
    }

    for (const malformedId of ["HullFrame", "hull frame", "hüllFrame", "hull--frame"]) {
      const error = dataError(() => parsePartCategoryId(malformedId, "/categoryId"));
      expect(error.code).toBe("InvalidId");
      expect(error.path).toBe("/categoryId");
    }
  });

  it("uses explicit components for every built-in capability kind", () => {
    const kinds = new Set(STARTER_CATALOG.partDefinitions.flatMap((definition) => definition.components.map((component) => component.kind)));
    expect([...kinds].sort()).toEqual([...BUILT_IN_COMPONENT_KINDS].sort());
  });

  it("accepts a future custom category without changing the definition shape", () => {
    const catalog = cloneStarterCatalog();
    catalog.categories.push({
      categoryId: "research",
      displayNameFallback: "Research",
      descriptionFallback: "Future validated research parts.",
      sortOrder: 90,
      paletteTags: ["research"]
    });
    const probe = structuredClone(partById(catalog, STARTER_PART_IDS.sensorDishModule));
    probe.partDefinitionId = "research_probe_v0";
    probe.categoryId = "research";
    catalog.partDefinitions.push(probe);

    const snapshot = createShipPartCatalogSnapshot(catalog);
    expect(snapshot.indexes.partsByCategory["research" as never].map((part) => part.partDefinitionId)).toEqual(["research_probe_v0"]);
  });

  it("canonicalizes equivalent category and part insertion orders identically", () => {
    const canonical = canonicalShipPartCatalogJson(STARTER_CATALOG);
    const reordered = cloneStarterCatalog();
    reordered.categories.reverse();
    reordered.partDefinitions.reverse();
    const reorderedSnapshot = createShipPartCatalogSnapshot(reordered);

    expect(canonicalShipPartCatalogJson(reorderedSnapshot)).toBe(canonical);
    expect(reorderedSnapshot.signature).toBe(STARTER_CATALOG.signature);
  });

  it("rejects duplicate category IDs even when their sort orders differ", () => {
    const catalog = cloneStarterCatalog();
    catalog.categories.push({ ...catalog.categories[0], sortOrder: 999 });

    const error = dataError(() => createShipPartCatalogSnapshot(catalog));
    expect(error.code).toBe("DuplicateId");
    expect(error.path).toBe("/categories/8/categoryId");
  });

  it("rejects duplicate part IDs across category ordering", () => {
    const catalog = cloneStarterCatalog();
    catalog.partDefinitions.push({
      ...structuredClone(partById(catalog, STARTER_PART_IDS.scoutCockpitSmall)),
      categoryId: "utility"
    });

    const error = dataError(() => createShipPartCatalogSnapshot(catalog));
    expect(error.code).toBe("DuplicateId");
    expect(error.path).toBe("/partDefinitions/14/partDefinitionId");
  });

  it("rejects unknown categories with a stable code and canonical path", () => {
    const catalog = cloneStarterCatalog();
    partById(catalog, STARTER_PART_IDS.scoutCockpitSmall).categoryId = "unknown-category";

    const error = dataError(() => createShipPartCatalogSnapshot(catalog));
    expect(error.code).toBe("UnknownCategory");
    expect(error.path).toBe("/partDefinitions/15/categoryId");
  });

  it("rejects duplicate sockets, missing component sockets, and zero functional directions", () => {
    const duplicateSocket = cloneStarterCatalog();
    const scout = partById(duplicateSocket, STARTER_PART_IDS.scoutCockpitSmall);
    scout.sockets.push(structuredClone(scout.sockets.find((socket: MutableRecord) => socket.socketId === "structural-back")));
    expect(dataError(() => createShipPartCatalogSnapshot(duplicateSocket)).code).toBe("DuplicateId");

    const missingSocket = cloneStarterCatalog();
    const engine = partById(missingSocket, STARTER_PART_IDS.smallChemicalBell);
    engine.components.find((component: MutableRecord) => component.componentId === "main-thruster").nozzleSocketId = "missing-nozzle";
    const missingSocketError = dataError(() => createShipPartCatalogSnapshot(missingSocket));
    expect(missingSocketError.code).toBe("UnknownSocket");
    expect(missingSocketError.path).toBe("/partDefinitions/4/components/0/nozzleSocketId");

    const zeroDirection = cloneStarterCatalog();
    const zeroDirectionEngine = partById(zeroDirection, STARTER_PART_IDS.smallChemicalBell);
    zeroDirectionEngine.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-main").direction = { x: 0, y: 0, z: 0 };
    const zeroDirectionError = dataError(() => createShipPartCatalogSnapshot(zeroDirection));
    expect(zeroDirectionError.code).toBe("InvalidVector");
    expect(zeroDirectionError.path).toBe("/partDefinitions/4/sockets/0/direction");

    const duplicateComponent = cloneStarterCatalog();
    const duplicateComponentEngine = partById(duplicateComponent, STARTER_PART_IDS.smallChemicalBell);
    duplicateComponentEngine.components.push(
      structuredClone(duplicateComponentEngine.components.find((component: MutableRecord) => component.componentId === "main-thruster"))
    );
    const duplicateComponentError = dataError(() => createShipPartCatalogSnapshot(duplicateComponent));
    expect(duplicateComponentError.code).toBe("DuplicateId");
    expect(duplicateComponentError.path).toBe("/partDefinitions/4/components/1/componentId");
  });

  it("rejects negative and non-finite typed numeric data without a stats bag", () => {
    const negativeMass = cloneStarterCatalog();
    partById(negativeMass, STARTER_PART_IDS.smallChemicalBell).dryMassKilograms = -1;
    expect(dataError(() => createShipPartCatalogSnapshot(negativeMass)).code).toBe("OutOfRange");

    const nonFiniteMass = cloneStarterCatalog();
    partById(nonFiniteMass, STARTER_PART_IDS.smallChemicalBell).dryMassKilograms = Number.POSITIVE_INFINITY;
    expect(dataError(() => createShipPartCatalogSnapshot(nonFiniteMass)).code).toBe("InvalidNumber");

    const invalidDimensions = cloneStarterCatalog();
    partById(invalidDimensions, STARTER_PART_IDS.smallChemicalBell).dimensionsMeters.x = -1;
    expect(dataError(() => createShipPartCatalogSnapshot(invalidDimensions)).code).toBe("OutOfRange");

    const nonFiniteDimensions = cloneStarterCatalog();
    partById(nonFiniteDimensions, STARTER_PART_IDS.smallChemicalBell).dimensionsMeters.x = Number.POSITIVE_INFINITY;
    expect(dataError(() => createShipPartCatalogSnapshot(nonFiniteDimensions)).code).toBe("InvalidNumber");

    const negativeThrust = cloneStarterCatalog();
    partById(negativeThrust, STARTER_PART_IDS.smallChemicalBell).components.find(
      (component: MutableRecord) => component.componentId === "main-thruster"
    ).maximumThrustNewtons = -10;
    expect(dataError(() => createShipPartCatalogSnapshot(negativeThrust)).code).toBe("OutOfRange");

    const nonFiniteThrust = cloneStarterCatalog();
    partById(nonFiniteThrust, STARTER_PART_IDS.smallChemicalBell).components.find(
      (component: MutableRecord) => component.componentId === "main-thruster"
    ).maximumThrustNewtons = Number.POSITIVE_INFINITY;
    expect(dataError(() => createShipPartCatalogSnapshot(nonFiniteThrust)).code).toBe("InvalidNumber");

    const negativeCapacity = cloneStarterCatalog();
    partById(negativeCapacity, STARTER_PART_IDS.mediumCargoBay).components.find(
      (component: MutableRecord) => component.componentId === "cargo-storage"
    ).capacityCubicMeters = -1;
    expect(dataError(() => createShipPartCatalogSnapshot(negativeCapacity)).code).toBe("OutOfRange");

    const nonFiniteCapacity = cloneStarterCatalog();
    partById(nonFiniteCapacity, STARTER_PART_IDS.mediumCargoBay).components.find(
      (component: MutableRecord) => component.componentId === "cargo-storage"
    ).capacityCubicMeters = Number.POSITIVE_INFINITY;
    expect(dataError(() => createShipPartCatalogSnapshot(nonFiniteCapacity)).code).toBe("InvalidNumber");
  });

  it("roundtrips a multi-component definition and keeps categories separate from capability", () => {
    const roundtrip = parseShipPartCatalog(serializeShipPartCatalog(STARTER_CATALOG));
    const scout = roundtrip.indexes.partById[STARTER_PART_IDS.scoutCockpitSmall as never];
    expect(scout.components.map((component) => component.kind)).toEqual([
      "ControlCore",
      "PowerHeatReserved",
      "SensorUtility",
      "Structural"
    ]);

    const catalog = cloneStarterCatalog();
    const emptyPropulsion = partById(catalog, STARTER_PART_IDS.smallSpineFrame);
    emptyPropulsion.categoryId = "mainThruster";
    const snapshot = createShipPartCatalogSnapshot(catalog);
    expect(snapshot.indexes.partsByComponentKind.MainThruster?.map((part) => part.partDefinitionId)).not.toContain(
      STARTER_PART_IDS.smallSpineFrame
    );
  });

  it("rejects dangling socket category compatibility after category normalization", () => {
    const catalog = cloneStarterCatalog();
    const scout = partById(catalog, STARTER_PART_IDS.scoutCockpitSmall);
    scout.sockets.find((socket: MutableRecord) => socket.socketId === "control-primary").compatibleCategoryIds = [
      "utility",
      "unregisteredCategory"
    ];

    const error = dataError(() => createShipPartCatalogSnapshot(catalog));
    expect(error.code).toBe("UnknownCategory");
    expect(error.path).toBe("/partDefinitions/1/sockets/1/compatibleCategoryIds/1");
  });

  it.each([
    ["vector", "localPosition", "/partDefinitions/4/sockets/0/localPosition/unexpected"],
    ["vector", "direction", "/partDefinitions/4/sockets/0/direction/unexpected"],
    ["quaternion", "localRotation", "/partDefinitions/4/sockets/0/localRotation/unexpected"]
  ])("rejects unknown %s keys at the exact path", (_shape, field, expectedPath) => {
    const catalog = cloneStarterCatalog();
    const engine = partById(catalog, STARTER_PART_IDS.smallChemicalBell);
    const nozzle = engine.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-main");
    nozzle[field] = { ...nozzle[field], unexpected: true };

    const error = dataError(() => createShipPartCatalogSnapshot(catalog));
    expect(error.code).toBe("InvalidValue");
    expect(error.path).toBe(expectedPath);
  });

  it("exposes immutable snapshot and index views with a pinned signature", () => {
    expect(STARTER_CATALOG.signature).toBe(STARTER_CATALOG_SIGNATURE);
    expect(STARTER_CATALOG_SIGNATURE).toBe("5aaa27fd");
    expect(Object.isFrozen(STARTER_CATALOG)).toBe(true);
    expect(Object.isFrozen(STARTER_CATALOG.partDefinitions)).toBe(true);
    expect(Object.isFrozen(STARTER_CATALOG.indexes.partById)).toBe(true);
    const partsByCategory = STARTER_CATALOG.indexes.partsByCategory as unknown as Record<string, readonly unknown[]>;
    expect(Object.isFrozen(partsByCategory.cockpit)).toBe(true);

    const indexes = STARTER_CATALOG.indexes.partById as Record<string, unknown>;
    try {
      indexes.injected = "not allowed";
    } catch {
      // Frozen records throw in strict-mode test modules; either outcome must preserve the view.
    }
    expect(indexes.injected).toBeUndefined();
  });
});
