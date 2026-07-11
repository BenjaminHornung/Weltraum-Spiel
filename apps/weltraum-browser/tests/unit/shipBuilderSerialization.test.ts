import { describe, expect, it } from "vitest";
import {
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  ShipBuilderDataError,
  parseShipBlueprint,
  parseShipPartCatalog,
  readShipBlueprint,
  readShipPartCatalogDocument,
  serializeShipBlueprint,
  serializeShipPartCatalog
} from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneStarterCatalog = (): MutableRecord => JSON.parse(serializeShipPartCatalog(STARTER_CATALOG)) as MutableRecord;

const dataError = (operation: () => unknown): ShipBuilderDataError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ShipBuilderDataError);
    return error as ShipBuilderDataError;
  }

  throw new Error("Expected a ShipBuilderDataError.");
};

describe("ship-builder canonical serialization", () => {
  it("roundtrips catalog bytes and excludes snapshot-only indexes and summary data", () => {
    const serialized = serializeShipPartCatalog(STARTER_CATALOG);
    const persisted = JSON.parse(serialized) as Record<string, unknown>;
    const reparsed = parseShipPartCatalog(serialized);

    expect(persisted.indexes).toBeUndefined();
    expect(persisted.signature).toBeUndefined();
    expect(persisted.summary).toBeUndefined();
    expect(serializeShipPartCatalog(reparsed)).toBe(serialized);
    expect(reparsed.signature).toBe(STARTER_CATALOG.signature);
  });

  it("roundtrips blueprint bytes through validated catalog-aware parsing", () => {
    const serialized = serializeShipBlueprint(SCOUT_BLUEPRINT);
    const reparsed = parseShipBlueprint(serialized, { catalog: STARTER_CATALOG });

    expect(serializeShipBlueprint(reparsed)).toBe(serialized);
    expect(reparsed.connections.map((connection) => connection.connectionId)).toEqual(
      SCOUT_BLUEPRINT.connections.map((connection) => connection.connectionId)
    );
  });

  it("rejects future catalog and blueprint schemas with stable errors", () => {
    const futureCatalog = JSON.parse(serializeShipPartCatalog(STARTER_CATALOG)) as Record<string, unknown>;
    futureCatalog.schemaVersion = 2;
    const catalogError = dataError(() => parseShipPartCatalog(futureCatalog));
    expect(catalogError.code).toBe("UnsupportedSchemaVersion");
    expect(catalogError.path).toBe("/schemaVersion");

    const futureBlueprint = JSON.parse(serializeShipBlueprint(SCOUT_BLUEPRINT)) as Record<string, unknown>;
    futureBlueprint.schemaVersion = 2;
    const blueprintError = dataError(() => parseShipBlueprint(futureBlueprint, { catalog: STARTER_CATALOG }));
    expect(blueprintError.code).toBe("UnsupportedSchemaVersion");
    expect(blueprintError.path).toBe("/schemaVersion");
  });

  it.each([
    ["catalog", () => cloneStarterCatalog(), readShipPartCatalogDocument, parseShipPartCatalog],
    [
      "blueprint",
      () => JSON.parse(serializeShipBlueprint(SCOUT_BLUEPRINT)) as MutableRecord,
      (value: unknown) => readShipBlueprint(value, { catalog: STARTER_CATALOG }),
      (value: unknown) => parseShipBlueprint(value, { catalog: STARTER_CATALOG })
    ]
  ])("rejects future root %s schemas before field allowlists for direct and root reads", (_name, createDocument, readDirect, readRoot) => {
    for (const read of [readDirect, readRoot]) {
      const document = createDocument();
      const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = document;
      const futureDocument = { unexpectedBeforeSchemaVersion: true, ...withoutSchemaVersion, schemaVersion: 2 };
      const error = dataError(() => read(futureDocument));
      expect(error.code).toBe("UnsupportedSchemaVersion");
      expect(error.path).toBe("/schemaVersion");
    }
  });

  it.each([
    ["part", "/partDefinitions/4/schemaVersion", (catalog: MutableRecord) => {
      const partIndex = catalog.partDefinitions.findIndex(
        (candidate: MutableRecord) => candidate.partDefinitionId === "thruster_small_chemical_bell_v0"
      );
      const part = catalog.partDefinitions[partIndex];
      const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = part;
      catalog.partDefinitions[partIndex] = { unexpectedBeforeSchemaVersion: true, ...withoutSchemaVersion, schemaVersion: 2 };
    }],
    ["socket", "/partDefinitions/4/sockets/0/schemaVersion", (catalog: MutableRecord) => {
      const partIndex = catalog.partDefinitions.findIndex(
        (candidate: MutableRecord) => candidate.partDefinitionId === "thruster_small_chemical_bell_v0"
      );
      const part = catalog.partDefinitions[partIndex];
      const socketIndex = part.sockets.findIndex((candidate: MutableRecord) => candidate.socketId === "nozzle-main");
      const socket = part.sockets[socketIndex];
      const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = socket;
      part.sockets[socketIndex] = { unexpectedBeforeSchemaVersion: true, ...withoutSchemaVersion, schemaVersion: 2 };
    }],
    ["component", "/partDefinitions/4/components/0/schemaVersion", (catalog: MutableRecord) => {
      const partIndex = catalog.partDefinitions.findIndex(
        (candidate: MutableRecord) => candidate.partDefinitionId === "thruster_small_chemical_bell_v0"
      );
      const part = catalog.partDefinitions[partIndex];
      const componentIndex = part.components.findIndex((candidate: MutableRecord) => candidate.componentId === "main-thruster");
      const component = part.components[componentIndex];
      const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = component;
      part.components[componentIndex] = { unexpectedBeforeSchemaVersion: true, ...withoutSchemaVersion, schemaVersion: 2 };
    }]
  ])("rejects future nested %s schema before field allowlists for direct and root reads", (_name, expectedPath, mutate) => {
    for (const read of [readShipPartCatalogDocument, parseShipPartCatalog]) {
      const catalog = cloneStarterCatalog();
      mutate(catalog);
      const error = dataError(() => read(catalog));
      expect(error.code).toBe("UnsupportedSchemaVersion");
      expect(error.path).toBe(expectedPath);
    }
  });

  it("rejects malformed JSON and non-JSON extension values at serialization boundaries", () => {
    const invalidJson = dataError(() => parseShipPartCatalog("{"));
    expect(invalidJson.code).toBe("InvalidJson");
    expect(invalidJson.path).toBe("");

    const invalidExtension = JSON.parse(serializeShipPartCatalog(STARTER_CATALOG)) as Record<string, any>;
    invalidExtension.extensions = { "weltraum.test": { callback: () => undefined } };
    const extensionError = dataError(() => parseShipPartCatalog(invalidExtension));
    expect(extensionError.code).toBe("InvalidExtension");
    expect(extensionError.path).toBe("/extensions/weltraum.test/callback");
  });
});
