import { canonicalJsonHash, canonicalJsonStringify } from "./canonicalJson";
import {
  parseBlueprintId,
  parseBlueprintSchemaVersion,
  parseCatalogId,
  parseCatalogVersion,
  parseConnectionId,
  parsePartDefinitionId,
  parsePartInstanceId,
  parseSocketId
} from "./ids";
import type { ConnectionId, PartDefinitionId, PartInstanceId } from "./ids";
import type {
  ConnectionType,
  EulerDegrees,
  GridPosition,
  MirrorGroup,
  PartConnection,
  PartConnectionEndpoint,
  PartInstance,
  ShipBlueprint,
  ShipPartCatalogSnapshot
} from "./types";
import {
  dataError,
  dataPath,
  deepFreeze,
  readArray,
  readBoolean,
  readFiniteNumber,
  readInteger,
  readJsonValue,
  readNamespacedExtensions,
  readPlainObject,
  readPositiveFiniteNumber,
  readRequiredProperty,
  readString
} from "./validation";
import type { JsonObject, JsonValue } from "./validation";

export type SerializedShipBlueprintDocument = ShipBlueprint;

/** A caller may omit this field; construction derives it from authoritative instances. */
export type ShipBlueprintInput = Omit<ShipBlueprint, "referencedPartDefinitionIds"> & {
  readonly referencedPartDefinitionIds?: readonly PartDefinitionId[];
};

export interface ShipBlueprintBuildOptions {
  readonly catalog?: ShipPartCatalogSnapshot;
}

const BLUEPRINT_FIELDS = [
  "blueprintId",
  "displayName",
  "schemaVersion",
  "catalogId",
  "catalogVersion",
  "gridMeters",
  "instances",
  "connections",
  "referencedPartDefinitionIds",
  "mirrorGroups",
  "draftMetadata",
  "cachedValidationMetadata",
  "cachedStatsMetadata",
  "extensions"
] as const;

const INSTANCE_FIELDS = [
  "stableInstanceId",
  "partDefinitionId",
  "localGridPosition",
  "localRotation",
  "enabled",
  "mirrorGroupId",
  "customName",
  "extensions"
] as const;

const CONNECTION_FIELDS = ["connectionId", "from", "to", "connectionType", "enabled", "metadata"] as const;
const CONNECTION_ENDPOINT_FIELDS = ["partInstanceId", "socketId"] as const;
const MIRROR_GROUP_FIELDS = ["mirrorGroupId", "instanceIds", "extensions"] as const;

const hasOwn = (value: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const assertAllowedFields = (
  object: Readonly<Record<string, unknown>>,
  path: string,
  allowedFields: readonly string[]
): void => {
  for (const key of Object.keys(object).sort(compareText)) {
    if (!allowedFields.includes(key)) {
      throw dataError("InvalidValue", dataPath(path, key), "Unexpected field in v1 ship-builder data.");
    }
  }
};

const readOptional = <T>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  reader: (value: unknown, valuePath: string) => T
): T | undefined => (hasOwn(object, key) ? reader(object[key], dataPath(path, key)) : undefined);

const readRequired = <T>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  reader: (value: unknown, valuePath: string) => T
): T => reader(readRequiredProperty(object, key, path), dataPath(path, key));

const readNonEmptyString = (value: unknown, path: string): string => {
  const result = readString(value, path);
  if (result.length === 0) {
    throw dataError("InvalidValue", path, "Expected a non-empty string.");
  }
  return result;
};

const readJsonObject = (value: unknown, path: string): JsonObject => {
  const object = readPlainObject(value, path);
  const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const key of Object.keys(object).sort(compareText)) {
    result[key] = readJsonValue(object[key], dataPath(path, key));
  }
  return result;
};

const readSortedStableIds = <TId extends string>(
  value: unknown,
  path: string,
  parser: (candidate: unknown, candidatePath: string) => TId
): readonly TId[] => {
  const parsed = readArray(value, path).map((entry, index) => parser(entry, dataPath(path, index))).sort(compareText) as TId[];
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index - 1] === parsed[index]) {
      throw dataError("DuplicateId", dataPath(path, index), "Duplicate stable ID.");
    }
  }
  return parsed;
};

const readGridPosition = (value: unknown, path: string): GridPosition => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["x", "y", "z"]);
  return {
    x: readInteger(readRequiredProperty(object, "x", path), dataPath(path, "x")),
    y: readInteger(readRequiredProperty(object, "y", path), dataPath(path, "y")),
    z: readInteger(readRequiredProperty(object, "z", path), dataPath(path, "z"))
  };
};

const readV1Rotation = (value: unknown, path: string): EulerDegrees => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["yaw", "pitch", "roll"]);
  const yaw = readFiniteNumber(readRequiredProperty(object, "yaw", path), dataPath(path, "yaw"));
  const pitch = readFiniteNumber(readRequiredProperty(object, "pitch", path), dataPath(path, "pitch"));
  const roll = readFiniteNumber(readRequiredProperty(object, "roll", path), dataPath(path, "roll"));

  if (yaw !== 0 && yaw !== 90 && yaw !== 180 && yaw !== 270) {
    throw dataError("UnsupportedRotation", dataPath(path, "yaw"), "V1 blueprint yaw must be 0, 90, 180, or 270 degrees.");
  }
  if (pitch !== 0) {
    throw dataError("UnsupportedRotation", dataPath(path, "pitch"), "V1 blueprint pitch must be zero.");
  }
  if (roll !== 0) {
    throw dataError("UnsupportedRotation", dataPath(path, "roll"), "V1 blueprint roll must be zero.");
  }

  return { yaw, pitch, roll };
};

const readPartInstance = (value: unknown, path: string): PartInstance => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, INSTANCE_FIELDS);
  const stableInstanceId = readRequired(object, "stableInstanceId", path, parsePartInstanceId);
  const partDefinitionId = readRequired(object, "partDefinitionId", path, parsePartDefinitionId);
  const localGridPosition = readRequired(object, "localGridPosition", path, readGridPosition);
  const localRotation = readRequired(object, "localRotation", path, readV1Rotation);
  const enabled = readRequired(object, "enabled", path, readBoolean);
  const mirrorGroupId = readOptional(object, "mirrorGroupId", path, readNonEmptyString);
  const customName = readOptional(object, "customName", path, readString);
  const extensions = readOptional(object, "extensions", path, readNamespacedExtensions);

  return {
    stableInstanceId,
    partDefinitionId,
    localGridPosition,
    localRotation,
    enabled,
    ...(mirrorGroupId !== undefined ? { mirrorGroupId } : {}),
    ...(customName !== undefined ? { customName } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };
};

interface PartInstanceCandidate {
  readonly value: unknown;
  readonly stableInstanceId: PartInstanceId;
}

const readSortedPartInstances = (value: unknown, path: string): readonly PartInstance[] => {
  const candidates: PartInstanceCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    return {
      value: entry,
      stableInstanceId: parsePartInstanceId(
        readRequiredProperty(object, "stableInstanceId", entryPath),
        dataPath(entryPath, "stableInstanceId")
      )
    };
  });

  candidates.sort((left, right) => compareText(left.stableInstanceId, right.stableInstanceId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].stableInstanceId === candidates[index].stableInstanceId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "stableInstanceId"), "Duplicate part instance ID.");
    }
  }
  return candidates.map((candidate, index) => readPartInstance(candidate.value, dataPath(path, index)));
};

/** Copies a validated instance with a new transform while preserving its stable ID byte-for-byte. */
export const updatePartInstanceTransform = (
  instance: PartInstance,
  localGridPosition: unknown,
  localRotation: unknown
): PartInstance =>
  deepFreeze(
    readPartInstance(
      {
        ...instance,
        localGridPosition,
        localRotation
      },
      ""
    )
  ) as PartInstance;

export const withPartInstanceTransform = updatePartInstanceTransform;

const readPartConnectionEndpoint = (value: unknown, path: string): PartConnectionEndpoint => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, CONNECTION_ENDPOINT_FIELDS);
  return {
    partInstanceId: readRequired(object, "partInstanceId", path, parsePartInstanceId),
    socketId: readRequired(object, "socketId", path, parseSocketId)
  };
};

const readPartConnection = (value: unknown, path: string): PartConnection => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, CONNECTION_FIELDS);
  const connectionId = readRequired(object, "connectionId", path, parseConnectionId);
  const from = readRequired(object, "from", path, readPartConnectionEndpoint);
  const to = readRequired(object, "to", path, readPartConnectionEndpoint);
  const connectionType = readRequired(object, "connectionType", path, readNonEmptyString) as ConnectionType;
  const enabled = readRequired(object, "enabled", path, readBoolean);
  const metadata = readOptional(object, "metadata", path, readJsonObject);
  return {
    connectionId,
    from,
    to,
    connectionType,
    enabled,
    ...(metadata !== undefined ? { metadata } : {})
  };
};

interface PartConnectionCandidate {
  readonly value: unknown;
  readonly connectionId: ConnectionId;
}

const readSortedPartConnections = (value: unknown, path: string): readonly PartConnection[] => {
  const candidates: PartConnectionCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    return {
      value: entry,
      connectionId: parseConnectionId(readRequiredProperty(object, "connectionId", entryPath), dataPath(entryPath, "connectionId"))
    };
  });

  candidates.sort((left, right) => compareText(left.connectionId, right.connectionId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].connectionId === candidates[index].connectionId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "connectionId"), "Duplicate connection ID.");
    }
  }
  return candidates.map((candidate, index) => readPartConnection(candidate.value, dataPath(path, index)));
};

const readMirrorGroup = (value: unknown, path: string): MirrorGroup => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, MIRROR_GROUP_FIELDS);
  const mirrorGroupId = readRequired(object, "mirrorGroupId", path, readNonEmptyString);
  const instanceIds = readRequired(object, "instanceIds", path, (candidate, candidatePath) =>
    readSortedStableIds(candidate, candidatePath, parsePartInstanceId)
  );
  const extensions = readOptional(object, "extensions", path, readNamespacedExtensions);
  return {
    mirrorGroupId,
    instanceIds,
    ...(extensions !== undefined ? { extensions } : {})
  };
};

interface MirrorGroupCandidate {
  readonly value: unknown;
  readonly mirrorGroupId: string;
}

const readSortedMirrorGroups = (value: unknown, path: string): readonly MirrorGroup[] => {
  const candidates: MirrorGroupCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    return {
      value: entry,
      mirrorGroupId: readNonEmptyString(readRequiredProperty(object, "mirrorGroupId", entryPath), dataPath(entryPath, "mirrorGroupId"))
    };
  });

  candidates.sort((left, right) => compareText(left.mirrorGroupId, right.mirrorGroupId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].mirrorGroupId === candidates[index].mirrorGroupId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "mirrorGroupId"), "Duplicate mirror group ID.");
    }
  }
  return candidates.map((candidate, index) => readMirrorGroup(candidate.value, dataPath(path, index)));
};

const instanceRecord = (instances: readonly PartInstance[]): Readonly<Record<PartInstanceId, PartInstance>> => {
  const record: Record<PartInstanceId, PartInstance> = Object.create(null) as Record<PartInstanceId, PartInstance>;
  for (const instance of instances) {
    record[instance.stableInstanceId] = instance;
  }
  return Object.freeze(record);
};

const validateInstanceAndConnectionReferences = (
  instances: readonly PartInstance[],
  connections: readonly PartConnection[],
  mirrorGroups: readonly MirrorGroup[] | undefined,
  path: string
): void => {
  const instancesById = instanceRecord(instances);

  for (let connectionIndex = 0; connectionIndex < connections.length; connectionIndex += 1) {
    const connection = connections[connectionIndex];
    const connectionPath = dataPath(dataPath(path, "connections"), connectionIndex);
    const endpoints: readonly ["from" | "to", PartConnectionEndpoint][] = [
      ["from", connection.from],
      ["to", connection.to]
    ];
    for (const [endpointKey, endpoint] of endpoints) {
      if (!hasOwn(instancesById, endpoint.partInstanceId)) {
        throw dataError(
          "UnknownInstance",
          dataPath(dataPath(connectionPath, endpointKey), "partInstanceId"),
          "Connection endpoint instance does not exist in this blueprint."
        );
      }
    }
  }

  if (mirrorGroups !== undefined) {
    for (let groupIndex = 0; groupIndex < mirrorGroups.length; groupIndex += 1) {
      for (let instanceIndex = 0; instanceIndex < mirrorGroups[groupIndex].instanceIds.length; instanceIndex += 1) {
        const instanceId = mirrorGroups[groupIndex].instanceIds[instanceIndex];
        if (!hasOwn(instancesById, instanceId)) {
          throw dataError(
            "UnknownInstance",
            dataPath(dataPath(dataPath(dataPath(path, "mirrorGroups"), groupIndex), "instanceIds"), instanceIndex),
            "Mirror-group instance does not exist in this blueprint."
          );
        }
      }
    }
  }
};

const deriveReferencedPartDefinitionIds = (instances: readonly PartInstance[]): readonly PartDefinitionId[] => {
  const values = [...new Set(instances.map((instance) => instance.partDefinitionId))].sort(compareText) as PartDefinitionId[];
  return values;
};

const validateProvidedReferencedDefinitionIds = (
  value: unknown,
  path: string,
  derived: readonly PartDefinitionId[]
): readonly PartDefinitionId[] => {
  const provided = readSortedStableIds(value, path, parsePartDefinitionId);
  if (provided.length !== derived.length || provided.some((partDefinitionId, index) => partDefinitionId !== derived[index])) {
    throw dataError(
      "UnknownReference",
      path,
      "Referenced part definition IDs must exactly match the authoritative instances."
    );
  }
  return provided;
};

const validateCatalogReferences = (
  catalog: ShipPartCatalogSnapshot,
  blueprint: ShipBlueprint,
  path: string
): void => {
  if (catalog.catalogId !== blueprint.catalogId) {
    throw dataError("UnknownReference", dataPath(path, "catalogId"), "Blueprint catalog ID does not match the supplied catalog.");
  }
  if (catalog.catalogVersion !== blueprint.catalogVersion) {
    throw dataError(
      "UnknownReference",
      dataPath(path, "catalogVersion"),
      "Blueprint catalog version does not match the supplied catalog."
    );
  }

  const instancesById = instanceRecord(blueprint.instances);
  for (let instanceIndex = 0; instanceIndex < blueprint.instances.length; instanceIndex += 1) {
    const instance = blueprint.instances[instanceIndex];
    if (!hasOwn(catalog.indexes.partById, instance.partDefinitionId)) {
      throw dataError(
        "UnknownReference",
        dataPath(dataPath(dataPath(path, "instances"), instanceIndex), "partDefinitionId"),
        "Part definition does not exist in the supplied catalog."
      );
    }
  }

  for (let connectionIndex = 0; connectionIndex < blueprint.connections.length; connectionIndex += 1) {
    const connection = blueprint.connections[connectionIndex];
    const connectionPath = dataPath(dataPath(path, "connections"), connectionIndex);
    const endpoints: readonly ["from" | "to", PartConnectionEndpoint][] = [
      ["from", connection.from],
      ["to", connection.to]
    ];
    for (const [endpointKey, endpoint] of endpoints) {
      const instance = instancesById[endpoint.partInstanceId];
      const definition = catalog.indexes.partById[instance.partDefinitionId];
      if (!definition.sockets.some((socket) => socket.socketId === endpoint.socketId)) {
        throw dataError(
          "UnknownSocket",
          dataPath(dataPath(connectionPath, endpointKey), "socketId"),
          "Connection endpoint socket does not exist on the referenced part definition."
        );
      }
    }
  }
};

/** Validates unknown input and returns authoritative blueprint data in canonical array order. */
export const readShipBlueprint = (value: unknown, options: ShipBlueprintBuildOptions = {}): ShipBlueprint => {
  const path = "";
  const object = readPlainObject(value, path);
  const schemaVersion = readRequired(object, "schemaVersion", path, parseBlueprintSchemaVersion);
  assertAllowedFields(object, path, BLUEPRINT_FIELDS);
  const blueprintId = readRequired(object, "blueprintId", path, parseBlueprintId);
  const displayName = readRequired(object, "displayName", path, readNonEmptyString);
  const catalogId = readRequired(object, "catalogId", path, parseCatalogId);
  const catalogVersion = readRequired(object, "catalogVersion", path, parseCatalogVersion);
  const gridMeters = readRequired(object, "gridMeters", path, readPositiveFiniteNumber);
  const instances = readRequired(object, "instances", path, readSortedPartInstances);
  const connections = readRequired(object, "connections", path, readSortedPartConnections);
  const derivedReferencedPartDefinitionIds = deriveReferencedPartDefinitionIds(instances);
  const referencedPartDefinitionIds = hasOwn(object, "referencedPartDefinitionIds")
    ? validateProvidedReferencedDefinitionIds(
        object.referencedPartDefinitionIds,
        dataPath(path, "referencedPartDefinitionIds"),
        derivedReferencedPartDefinitionIds
      )
    : derivedReferencedPartDefinitionIds;
  const mirrorGroups = readOptional(object, "mirrorGroups", path, readSortedMirrorGroups);
  const draftMetadata = readOptional(object, "draftMetadata", path, readJsonObject);
  const cachedValidationMetadata = readOptional(object, "cachedValidationMetadata", path, readJsonObject);
  const cachedStatsMetadata = readOptional(object, "cachedStatsMetadata", path, readJsonObject);
  const extensions = readOptional(object, "extensions", path, readNamespacedExtensions);

  validateInstanceAndConnectionReferences(instances, connections, mirrorGroups, path);

  const blueprint: ShipBlueprint = {
    blueprintId,
    displayName,
    schemaVersion,
    catalogId,
    catalogVersion,
    gridMeters,
    instances,
    connections,
    referencedPartDefinitionIds,
    ...(mirrorGroups !== undefined ? { mirrorGroups } : {}),
    ...(draftMetadata !== undefined ? { draftMetadata } : {}),
    ...(cachedValidationMetadata !== undefined ? { cachedValidationMetadata } : {}),
    ...(cachedStatsMetadata !== undefined ? { cachedStatsMetadata } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };

  if (options.catalog !== undefined) {
    validateCatalogReferences(options.catalog, blueprint, path);
  }

  return blueprint;
};

/** Creates a deeply frozen canonical blueprint and optionally checks it against a supplied catalog snapshot. */
export const createShipBlueprint = (input: unknown, options: ShipBlueprintBuildOptions = {}): ShipBlueprint =>
  deepFreeze(readShipBlueprint(input, options)) as ShipBlueprint;

/** Returns all persisted blueprint state, including draft/cache fields but never derived helpers. */
export const blueprintDocumentForSerialization = (blueprint: ShipBlueprint): ShipBlueprint => ({
  blueprintId: blueprint.blueprintId,
  displayName: blueprint.displayName,
  schemaVersion: blueprint.schemaVersion,
  catalogId: blueprint.catalogId,
  catalogVersion: blueprint.catalogVersion,
  gridMeters: blueprint.gridMeters,
  instances: blueprint.instances,
  connections: blueprint.connections,
  referencedPartDefinitionIds: blueprint.referencedPartDefinitionIds,
  ...(blueprint.mirrorGroups !== undefined ? { mirrorGroups: blueprint.mirrorGroups } : {}),
  ...(blueprint.draftMetadata !== undefined ? { draftMetadata: blueprint.draftMetadata } : {}),
  ...(blueprint.cachedValidationMetadata !== undefined ? { cachedValidationMetadata: blueprint.cachedValidationMetadata } : {}),
  ...(blueprint.cachedStatsMetadata !== undefined ? { cachedStatsMetadata: blueprint.cachedStatsMetadata } : {}),
  ...(blueprint.extensions !== undefined ? { extensions: blueprint.extensions } : {})
});

export const canonicalShipBlueprintJson = (blueprint: ShipBlueprint): string =>
  canonicalJsonStringify(blueprintDocumentForSerialization(blueprint));

/**
 * Explicit authority projection for the layout hash. Display labels, blueprint
 * identity, draft/cache metadata, and instance custom names cannot affect it.
 */
export const shipBlueprintLayoutProjection = (blueprint: ShipBlueprint): unknown => ({
  schemaVersion: blueprint.schemaVersion,
  catalogId: blueprint.catalogId,
  catalogVersion: blueprint.catalogVersion,
  gridMeters: blueprint.gridMeters,
  referencedPartDefinitionIds: blueprint.referencedPartDefinitionIds,
  instances: blueprint.instances.map((instance) => ({
    stableInstanceId: instance.stableInstanceId,
    partDefinitionId: instance.partDefinitionId,
    localGridPosition: instance.localGridPosition,
    localRotation: instance.localRotation,
    enabled: instance.enabled,
    ...(instance.mirrorGroupId !== undefined ? { mirrorGroupId: instance.mirrorGroupId } : {}),
    ...(instance.extensions !== undefined ? { extensions: instance.extensions } : {})
  })),
  connections: blueprint.connections.map((connection) => ({
    connectionId: connection.connectionId,
    from: connection.from,
    to: connection.to,
    connectionType: connection.connectionType,
    enabled: connection.enabled,
    ...(connection.metadata !== undefined ? { metadata: connection.metadata } : {})
  })),
  ...(blueprint.mirrorGroups !== undefined ? { mirrorGroups: blueprint.mirrorGroups } : {}),
  ...(blueprint.extensions !== undefined ? { extensions: blueprint.extensions } : {})
});

export const shipBlueprintLayoutHash = (blueprint: ShipBlueprint): string =>
  canonicalJsonHash(shipBlueprintLayoutProjection(blueprint));
