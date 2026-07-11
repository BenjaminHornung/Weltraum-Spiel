import { dataError } from "./validation";

export type Brand<T, Name extends string> = T & {
  readonly __shipBuilderBrand: Name;
};

export type PartCategoryId = Brand<string, "PartCategoryId">;
export type PartDefinitionId = Brand<string, "PartDefinitionId">;
export type PartInstanceId = Brand<string, "PartInstanceId">;
export type SocketId = Brand<string, "SocketId">;
export type ComponentId = Brand<string, "ComponentId">;
export type BlueprintId = Brand<string, "BlueprintId">;
export type ConnectionId = Brand<string, "ConnectionId">;
export type CatalogId = Brand<string, "CatalogId">;

export type CatalogVersion = Brand<number, "CatalogVersion">;
export type CatalogSchemaVersion = Brand<number, "CatalogSchemaVersion">;
export type BlueprintSchemaVersion = Brand<number, "BlueprintSchemaVersion">;
export type PartDefinitionSchemaVersion = Brand<number, "PartDefinitionSchemaVersion">;
export type ComponentSchemaVersion = Brand<number, "ComponentSchemaVersion">;
export type SocketSchemaVersion = Brand<number, "SocketSchemaVersion">;

export const MAX_STABLE_ID_LENGTH = 128;
export const STABLE_ID_PATTERN = /^[a-z][A-Za-z0-9]*(?:[._:/-][A-Za-z0-9]+)*$/;

export const CATALOG_VERSION_V1 = 1 as CatalogVersion;
export const CATALOG_SCHEMA_VERSION_V1 = 1 as CatalogSchemaVersion;
export const BLUEPRINT_SCHEMA_VERSION_V1 = 1 as BlueprintSchemaVersion;
export const PART_DEFINITION_SCHEMA_VERSION_V1 = 1 as PartDefinitionSchemaVersion;
export const COMPONENT_SCHEMA_VERSION_V1 = 1 as ComponentSchemaVersion;
export const SOCKET_SCHEMA_VERSION_V1 = 1 as SocketSchemaVersion;

const parseStableId = <TId extends string>(value: unknown, path: string, label: string): TId => {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_STABLE_ID_LENGTH || !STABLE_ID_PATTERN.test(value)) {
    throw dataError("InvalidId", path, `${label} must be a stable ASCII ID.`, {
      maximumLength: MAX_STABLE_ID_LENGTH
    });
  }

  return value as TId;
};

export const parsePartCategoryId = (value: unknown, path: string): PartCategoryId =>
  parseStableId<PartCategoryId>(value, path, "Part category ID");

export const parsePartDefinitionId = (value: unknown, path: string): PartDefinitionId =>
  parseStableId<PartDefinitionId>(value, path, "Part definition ID");

export const parsePartInstanceId = (value: unknown, path: string): PartInstanceId =>
  parseStableId<PartInstanceId>(value, path, "Part instance ID");

export const parseSocketId = (value: unknown, path: string): SocketId =>
  parseStableId<SocketId>(value, path, "Socket ID");

export const parseComponentId = (value: unknown, path: string): ComponentId =>
  parseStableId<ComponentId>(value, path, "Component ID");

export const parseBlueprintId = (value: unknown, path: string): BlueprintId =>
  parseStableId<BlueprintId>(value, path, "Blueprint ID");

export const parseConnectionId = (value: unknown, path: string): ConnectionId =>
  parseStableId<ConnectionId>(value, path, "Connection ID");

export const parseCatalogId = (value: unknown, path: string): CatalogId =>
  parseStableId<CatalogId>(value, path, "Catalog ID");

const parsePositiveVersion = <TVersion extends number>(value: unknown, path: string, label: string): TVersion => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw dataError("InvalidVersion", path, `${label} must be a positive integer.`);
  }

  return value as TVersion;
};

const parseSupportedVersion = <TVersion extends number>(
  value: unknown,
  path: string,
  label: string,
  supportedVersion: number,
  unsupportedCode: "UnsupportedVersion" | "UnsupportedSchemaVersion"
): TVersion => {
  const version = parsePositiveVersion<TVersion>(value, path, label);
  if (version !== supportedVersion) {
    throw dataError(unsupportedCode, path, `${label} is not supported.`, { supportedVersion });
  }

  return version;
};

/** Parses any positive catalog version for migration dispatch. */
export const parsePositiveCatalogVersion = (value: unknown, path: string): CatalogVersion =>
  parsePositiveVersion<CatalogVersion>(value, path, "Catalog version");

/** Parses the currently supported catalog version only. */
export const parseCatalogVersion = (value: unknown, path: string): CatalogVersion =>
  parseSupportedVersion<CatalogVersion>(value, path, "Catalog version", CATALOG_VERSION_V1, "UnsupportedVersion");

export const parseCatalogSchemaVersion = (value: unknown, path: string): CatalogSchemaVersion =>
  parseSupportedVersion<CatalogSchemaVersion>(
    value,
    path,
    "Catalog schema version",
    CATALOG_SCHEMA_VERSION_V1,
    "UnsupportedSchemaVersion"
  );

/** Parses any positive blueprint schema version for migration dispatch. */
export const parsePositiveBlueprintSchemaVersion = (value: unknown, path: string): BlueprintSchemaVersion =>
  parsePositiveVersion<BlueprintSchemaVersion>(value, path, "Blueprint schema version");

export const parseBlueprintSchemaVersion = (value: unknown, path: string): BlueprintSchemaVersion =>
  parseSupportedVersion<BlueprintSchemaVersion>(
    value,
    path,
    "Blueprint schema version",
    BLUEPRINT_SCHEMA_VERSION_V1,
    "UnsupportedSchemaVersion"
  );

export const parsePartDefinitionSchemaVersion = (value: unknown, path: string): PartDefinitionSchemaVersion =>
  parseSupportedVersion<PartDefinitionSchemaVersion>(
    value,
    path,
    "Part definition schema version",
    PART_DEFINITION_SCHEMA_VERSION_V1,
    "UnsupportedSchemaVersion"
  );

export const parseComponentSchemaVersion = (value: unknown, path: string): ComponentSchemaVersion =>
  parseSupportedVersion<ComponentSchemaVersion>(
    value,
    path,
    "Component schema version",
    COMPONENT_SCHEMA_VERSION_V1,
    "UnsupportedSchemaVersion"
  );

export const parseSocketSchemaVersion = (value: unknown, path: string): SocketSchemaVersion =>
  parseSupportedVersion<SocketSchemaVersion>(
    value,
    path,
    "Socket schema version",
    SOCKET_SCHEMA_VERSION_V1,
    "UnsupportedSchemaVersion"
  );
