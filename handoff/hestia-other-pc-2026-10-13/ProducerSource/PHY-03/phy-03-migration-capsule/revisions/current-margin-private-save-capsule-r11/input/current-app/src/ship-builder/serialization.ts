import {
  canonicalShipBlueprintJson,
  createShipBlueprint
} from "./blueprint";
import type { ShipBlueprintBuildOptions } from "./blueprint";
import {
  canonicalShipPartCatalogJson,
  createShipPartCatalogSnapshot
} from "./catalog";
import { BLUEPRINT_SCHEMA_VERSION_V1, CATALOG_SCHEMA_VERSION_V1 } from "./ids";
import type { ShipBlueprint, ShipPartCatalogSnapshot } from "./types";
import { dataError, dataPath, readPlainObject, readRequiredProperty } from "./validation";

/** A deterministic, code-side migration step. It is never serialized into catalog JSON. */
export interface CatalogMigrationStep {
  readonly fromSchemaVersion: number;
  readonly toSchemaVersion: number;
  migrate(document: unknown): unknown;
}

/** A deterministic, code-side migration step. It is never serialized into blueprint JSON. */
export interface BlueprintMigrationStep {
  readonly fromSchemaVersion: number;
  readonly toSchemaVersion: number;
  migrate(document: unknown): unknown;
}

/** Plain frozen records avoid exposing a mutable Map or Set as migration state. */
export interface CatalogMigrationRegistry {
  readonly steps: Readonly<Record<number, CatalogMigrationStep>>;
}

/** Plain frozen records avoid exposing a mutable Map or Set as migration state. */
export interface BlueprintMigrationRegistry {
  readonly steps: Readonly<Record<number, BlueprintMigrationStep>>;
}

const emptyCatalogSteps = Object.freeze(Object.create(null)) as Readonly<Record<number, CatalogMigrationStep>>;
const emptyBlueprintSteps = Object.freeze(Object.create(null)) as Readonly<Record<number, BlueprintMigrationStep>>;

/** V1 deliberately has no historical migration steps. */
export const EMPTY_CATALOG_MIGRATION_REGISTRY: CatalogMigrationRegistry = Object.freeze({
  steps: emptyCatalogSteps
});

/** V1 deliberately has no historical migration steps. */
export const EMPTY_BLUEPRINT_MIGRATION_REGISTRY: BlueprintMigrationRegistry = Object.freeze({
  steps: emptyBlueprintSteps
});

export interface ParseShipBlueprintOptions extends ShipBlueprintBuildOptions {
  readonly migrationRegistry?: BlueprintMigrationRegistry;
}

const parseJsonInput = (value: string | unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw dataError("InvalidJson", "", "Invalid JSON text.");
  }
};

const readMigrationSchemaVersion = (value: unknown): number => {
  const object = readPlainObject(value, "");
  const schemaPath = dataPath("", "schemaVersion");
  const schemaVersion = readRequiredProperty(object, "schemaVersion", "");
  if (typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion) || !Number.isInteger(schemaVersion) || schemaVersion <= 0) {
    throw dataError("InvalidVersion", schemaPath, "Schema version must be a positive integer.");
  }
  return Object.is(schemaVersion, -0) ? 0 : schemaVersion;
};

const unsupportedSchema = (schemaVersion: number, supportedVersion: number): never => {
  throw dataError("UnsupportedSchemaVersion", "/schemaVersion", "Schema version is not supported.", {
    supportedVersion,
    schemaVersion
  });
};

const migrateCatalogDocumentToV1 = (source: unknown, registry: CatalogMigrationRegistry): unknown => {
  let document = source;
  let schemaVersion = readMigrationSchemaVersion(document);
  const seenVersions = new Set<number>();

  while (schemaVersion !== CATALOG_SCHEMA_VERSION_V1) {
    if (schemaVersion > CATALOG_SCHEMA_VERSION_V1) {
      return unsupportedSchema(schemaVersion, CATALOG_SCHEMA_VERSION_V1);
    }
    if (seenVersions.has(schemaVersion)) {
      return unsupportedSchema(schemaVersion, CATALOG_SCHEMA_VERSION_V1);
    }
    seenVersions.add(schemaVersion);

    const step = registry.steps[schemaVersion];
    if (
      step === undefined ||
      step.fromSchemaVersion !== schemaVersion ||
      !Number.isInteger(step.toSchemaVersion) ||
      step.toSchemaVersion <= schemaVersion ||
      step.toSchemaVersion > CATALOG_SCHEMA_VERSION_V1
    ) {
      return unsupportedSchema(schemaVersion, CATALOG_SCHEMA_VERSION_V1);
    }

    document = step.migrate(document);
    const migratedSchemaVersion = readMigrationSchemaVersion(document);
    if (migratedSchemaVersion !== step.toSchemaVersion) {
      throw dataError("InvalidValue", "/schemaVersion", "Catalog migration did not produce its declared target schema version.");
    }
    schemaVersion = migratedSchemaVersion;
  }

  return document;
};

const migrateBlueprintDocumentToV1 = (source: unknown, registry: BlueprintMigrationRegistry): unknown => {
  let document = source;
  let schemaVersion = readMigrationSchemaVersion(document);
  const seenVersions = new Set<number>();

  while (schemaVersion !== BLUEPRINT_SCHEMA_VERSION_V1) {
    if (schemaVersion > BLUEPRINT_SCHEMA_VERSION_V1) {
      return unsupportedSchema(schemaVersion, BLUEPRINT_SCHEMA_VERSION_V1);
    }
    if (seenVersions.has(schemaVersion)) {
      return unsupportedSchema(schemaVersion, BLUEPRINT_SCHEMA_VERSION_V1);
    }
    seenVersions.add(schemaVersion);

    const step = registry.steps[schemaVersion];
    if (
      step === undefined ||
      step.fromSchemaVersion !== schemaVersion ||
      !Number.isInteger(step.toSchemaVersion) ||
      step.toSchemaVersion <= schemaVersion ||
      step.toSchemaVersion > BLUEPRINT_SCHEMA_VERSION_V1
    ) {
      return unsupportedSchema(schemaVersion, BLUEPRINT_SCHEMA_VERSION_V1);
    }

    document = step.migrate(document);
    const migratedSchemaVersion = readMigrationSchemaVersion(document);
    if (migratedSchemaVersion !== step.toSchemaVersion) {
      throw dataError("InvalidValue", "/schemaVersion", "Blueprint migration did not produce its declared target schema version.");
    }
    schemaVersion = migratedSchemaVersion;
  }

  return document;
};

/** Parses JSON text or decoded unknown data into a canonical immutable catalog snapshot. */
export const parseShipPartCatalog = (
  source: string | unknown,
  migrationRegistry: CatalogMigrationRegistry = EMPTY_CATALOG_MIGRATION_REGISTRY
): ShipPartCatalogSnapshot => createShipPartCatalogSnapshot(migrateCatalogDocumentToV1(parseJsonInput(source), migrationRegistry));

/** Emits only canonical persisted catalog data; snapshot indexes, summary, and signature are excluded. */
export const serializeShipPartCatalog = (catalog: ShipPartCatalogSnapshot): string => canonicalShipPartCatalogJson(catalog);

/** Parses JSON text or decoded unknown data into a canonical immutable authoritative blueprint. */
export const parseShipBlueprint = (source: string | unknown, options: ParseShipBlueprintOptions = {}): ShipBlueprint => {
  const document = migrateBlueprintDocumentToV1(
    parseJsonInput(source),
    options.migrationRegistry ?? EMPTY_BLUEPRINT_MIGRATION_REGISTRY
  );
  return createShipBlueprint(document, { catalog: options.catalog });
};

/** Emits canonical persisted blueprint data, including supported draft and cache metadata for lossless roundtrips. */
export const serializeShipBlueprint = (blueprint: ShipBlueprint): string => canonicalShipBlueprintJson(blueprint);

export const parseShipPartCatalogJson = parseShipPartCatalog;
export const serializeShipPartCatalogJson = serializeShipPartCatalog;
export const parseShipBlueprintJson = parseShipBlueprint;
export const serializeShipBlueprintJson = serializeShipBlueprint;
