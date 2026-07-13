import {
  StableIdError,
  parseBaseId,
  parseContainerId,
  parseDroneId,
  parseEncounterId,
  parseEventId,
  parseExternalReferenceId,
  parseMissionId,
  parsePlayerId,
  parseSaveId,
  parseShipId,
  parseShipVariantId,
  parseSiteId,
  parseStableInstanceId,
  parseStationId,
  type DroneId,
  type ExternalReferenceId,
  type ShipId,
  type ShipVariantId,
  type StableInstanceId
} from "./ids";
import { UniverseTimeError, createSimulationTick, validateUniverseTime, type UniverseTime } from "./time";
import type {
  BasePersistentState,
  DefinitionReference,
  DefinitionResolutionSnapshot,
  DefinitionsVersionReference,
  DiscoveryPersistentState,
  DomainEvent,
  EncounterPersistentState,
  EventQueueSnapshot,
  EventSeverity,
  EventStatus,
  EventType,
  FiniteQuaternion,
  FiniteVector3,
  JsonObject,
  JsonValue,
  MissionPersistentState,
  MobileObjectPersistentState,
  NeutralPersistentRecord,
  PlayerPersistentState,
  SaveGameEnvelopeV1,
  SaveGameMetadata,
  SimulationMode,
  StationPersistentState
} from "./types";
import {
  assertAllowedFields,
  cloneJsonObject,
  cloneJsonValue,
  deepFreeze,
  failPersistenceValidation,
  parsePersistenceJson,
  persistencePath,
  readArray,
  readBoolean,
  readFiniteNumber,
  readNonEmptyString,
  readNonNegativeSafeInteger,
  readPlainObject,
  readRequired
} from "./validation";

export const SAVE_GAME_SCHEMA_VERSION_V1 = 1 as const;

const codeUnitCompare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const domainPattern = /^[a-z][a-z0-9._-]*$/;
const simulationModes = new Set<SimulationMode>([
  "Active",
  "Background",
  "Dormant",
  "NeedsReplan",
  "NeedsPlayerAttention",
  "Destroyed"
]);
const eventTypes = new Set<EventType>([
  "MissionComplete",
  "FuelReserveLow",
  "WarpExited",
  "CargoFull",
  "ContactLost",
  "NeedsReplan",
  "NeedsPlayerAttention",
  "DefinitionMissing",
  "MigrationApplied"
]);
const eventSeverities = new Set<EventSeverity>(["Info", "Warning", "Critical"]);
const eventStatuses = new Set<EventStatus>(["Pending", "Acknowledged"]);
const forbiddenEventPayloadKeys = new Set(["title", "summary", "message", "displayText", "localizedText"]);

interface LocatedDefinitionReference {
  readonly reference: DefinitionReference;
  readonly path: string;
}

interface LocatedMobileDefinitionId {
  readonly definitionId: ShipVariantId;
  readonly path: string;
}

const stableId = <T>(reader: (value: unknown, path: string) => T, value: unknown, path: string): T => {
  try {
    return reader(value, path);
  } catch (error) {
    if (error instanceof StableIdError) {
      return failPersistenceValidation("INVALID_ID", path, error.message);
    }
    throw error;
  }
};

const parseDomain = (value: unknown, path: string): string => {
  const domain = readNonEmptyString(value, path);
  if (domain.length > 128 || !domainPattern.test(domain)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Definition domain must be normalized lowercase ASCII.");
  }
  return domain;
};

const parseVersion = (value: unknown, path: string): string => {
  const version = readNonEmptyString(value, path);
  if (version.length > 128) {
    return failPersistenceValidation("INVALID_VALUE", path, "Definitions version is too long.");
  }
  for (let index = 0; index < version.length; index += 1) {
    if (version.charCodeAt(index) > 0x7f) {
      return failPersistenceValidation("INVALID_VALUE", path, "Definitions version must be ASCII.");
    }
  }
  return version;
};

const parseDefinitionsVersionReference = (value: unknown, path: string): DefinitionsVersionReference => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["domain", "version"]);
  return {
    domain: parseDomain(readRequired(object, "domain", path), persistencePath(path, "domain")),
    version: parseVersion(readRequired(object, "version", path), persistencePath(path, "version"))
  };
};

const parseDefinitionReference = (
  value: unknown,
  path: string,
  locatedReferences: LocatedDefinitionReference[]
): DefinitionReference => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["domain", "definitionId", "definitionsVersionRef"]);
  const domain = parseDomain(readRequired(object, "domain", path), persistencePath(path, "domain"));
  const definitionsVersionRef = parseDefinitionsVersionReference(
    readRequired(object, "definitionsVersionRef", path),
    persistencePath(path, "definitionsVersionRef")
  );
  if (definitionsVersionRef.domain !== domain) {
    return failPersistenceValidation(
      "DEFINITIONS_VERSION_MISMATCH",
      persistencePath(persistencePath(path, "definitionsVersionRef"), "domain"),
      "Definition reference domain and version-reference domain must match."
    );
  }
  const reference: DefinitionReference = {
    domain,
    definitionId: stableId(
      parseShipVariantId,
      readRequired(object, "definitionId", path),
      persistencePath(path, "definitionId")
    ),
    definitionsVersionRef
  };
  locatedReferences.push({ reference, path });
  return reference;
};

const parseUniverseTime = (value: unknown, path: string): UniverseTime => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["tick", "epochSeconds"]);
  try {
    return validateUniverseTime(
      {
        tick: createSimulationTick(readRequired(object, "tick", path), persistencePath(path, "tick")),
        epochSeconds: readFiniteNumber(
          readRequired(object, "epochSeconds", path),
          persistencePath(path, "epochSeconds"),
          true
        ) as UniverseTime["epochSeconds"]
      },
      path
    );
  } catch (error) {
    if (error instanceof UniverseTimeError) {
      const code = error.code === "INVALID_TICK" ? "INVALID_INTEGER" : "INVALID_VALUE";
      return failPersistenceValidation(code, error.path, error.message);
    }
    throw error;
  }
};

const parseVector3 = (value: unknown, path: string): FiniteVector3 => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["x", "y", "z"]);
  return {
    x: readFiniteNumber(readRequired(object, "x", path), persistencePath(path, "x")),
    y: readFiniteNumber(readRequired(object, "y", path), persistencePath(path, "y")),
    z: readFiniteNumber(readRequired(object, "z", path), persistencePath(path, "z"))
  };
};

const parseQuaternion = (value: unknown, path: string): FiniteQuaternion => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["x", "y", "z", "w"]);
  const result: FiniteQuaternion = {
    x: readFiniteNumber(readRequired(object, "x", path), persistencePath(path, "x")),
    y: readFiniteNumber(readRequired(object, "y", path), persistencePath(path, "y")),
    z: readFiniteNumber(readRequired(object, "z", path), persistencePath(path, "z")),
    w: readFiniteNumber(readRequired(object, "w", path), persistencePath(path, "w"))
  };
  if (result.x === 0 && result.y === 0 && result.z === 0 && result.w === 0) {
    return failPersistenceValidation("INVALID_VALUE", path, "Orientation quaternion must be nonzero.");
  }
  return result;
};

const parseNullable = <T>(value: unknown, parse: (entry: unknown, path: string) => T, path: string): T | null =>
  value === null ? null : parse(value, path);

const parseSimulationMode = (value: unknown, path: string): SimulationMode => {
  if (typeof value !== "string" || !simulationModes.has(value as SimulationMode)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Simulation mode is not supported.");
  }
  return value as SimulationMode;
};

const parseContainerIds = (value: unknown, path: string): readonly ReturnType<typeof parseContainerId>[] => {
  const seen = new Set<string>();
  const ids = readArray(value, path).map((entry, index) => {
    const entryPath = persistencePath(path, index);
    const id = stableId(parseContainerId, entry, entryPath);
    if (seen.has(id)) {
      return failPersistenceValidation("DUPLICATE_ID", entryPath, "Duplicate cargo container reference.");
    }
    seen.add(id);
    return id;
  });
  return ids.sort(codeUnitCompare);
};

const parseMobileObject = <TId extends ShipId | DroneId>(
  value: unknown,
  path: string,
  idReader: (entry: unknown, entryPath: string) => TId,
  locatedDefinitionIds: LocatedMobileDefinitionId[]
): MobileObjectPersistentState<TId> => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "objectId",
    "ownerId",
    "definitionId",
    "frameId",
    "positionMeters",
    "velocityMetersPerSecond",
    "angularVelocity",
    "orientation",
    "epochSeconds",
    "currentMassKg",
    "dryMassKg",
    "fuelMassKg",
    "cargoContainerIds",
    "damageStateRef",
    "powerStateRef",
    "activePlanRef",
    "activeMissionRef",
    "simulationMode"
  ]);
  const external = (entry: unknown, entryPath: string): ExternalReferenceId =>
    stableId(parseExternalReferenceId, entry, entryPath);
  const definitionPath = persistencePath(path, "definitionId");
  const definitionId = stableId(parseShipVariantId, readRequired(object, "definitionId", path), definitionPath);
  locatedDefinitionIds.push({ definitionId, path: definitionPath });
  return {
    objectId: stableId(idReader, readRequired(object, "objectId", path), persistencePath(path, "objectId")),
    ownerId: stableId(parseStableInstanceId, readRequired(object, "ownerId", path), persistencePath(path, "ownerId")),
    definitionId,
    frameId: external(readRequired(object, "frameId", path), persistencePath(path, "frameId")),
    positionMeters: parseVector3(readRequired(object, "positionMeters", path), persistencePath(path, "positionMeters")),
    velocityMetersPerSecond: parseVector3(
      readRequired(object, "velocityMetersPerSecond", path),
      persistencePath(path, "velocityMetersPerSecond")
    ),
    angularVelocity: parseVector3(
      readRequired(object, "angularVelocity", path),
      persistencePath(path, "angularVelocity")
    ),
    orientation: parseQuaternion(readRequired(object, "orientation", path), persistencePath(path, "orientation")),
    epochSeconds: readFiniteNumber(readRequired(object, "epochSeconds", path), persistencePath(path, "epochSeconds"), true),
    currentMassKg: readFiniteNumber(readRequired(object, "currentMassKg", path), persistencePath(path, "currentMassKg"), true),
    dryMassKg: readFiniteNumber(readRequired(object, "dryMassKg", path), persistencePath(path, "dryMassKg"), true),
    fuelMassKg: readFiniteNumber(readRequired(object, "fuelMassKg", path), persistencePath(path, "fuelMassKg"), true),
    cargoContainerIds: parseContainerIds(
      readRequired(object, "cargoContainerIds", path),
      persistencePath(path, "cargoContainerIds")
    ),
    damageStateRef: parseNullable(
      readRequired(object, "damageStateRef", path),
      external,
      persistencePath(path, "damageStateRef")
    ),
    powerStateRef: parseNullable(
      readRequired(object, "powerStateRef", path),
      external,
      persistencePath(path, "powerStateRef")
    ),
    activePlanRef: parseNullable(
      readRequired(object, "activePlanRef", path),
      external,
      persistencePath(path, "activePlanRef")
    ),
    activeMissionRef: parseNullable(
      readRequired(object, "activeMissionRef", path),
      (entry, entryPath) => stableId(parseMissionId, entry, entryPath),
      persistencePath(path, "activeMissionRef")
    ),
    simulationMode: parseSimulationMode(
      readRequired(object, "simulationMode", path),
      persistencePath(path, "simulationMode")
    )
  };
};

const parsePlayer = (value: unknown, path: string): PlayerPersistentState => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["playerId", "activeShipId", "activeMissionRef", "data"]);
  return {
    playerId: stableId(parsePlayerId, readRequired(object, "playerId", path), persistencePath(path, "playerId")),
    activeShipId: parseNullable(
      readRequired(object, "activeShipId", path),
      (entry, entryPath) => stableId(parseShipId, entry, entryPath),
      persistencePath(path, "activeShipId")
    ),
    activeMissionRef: parseNullable(
      readRequired(object, "activeMissionRef", path),
      (entry, entryPath) => stableId(parseMissionId, entry, entryPath),
      persistencePath(path, "activeMissionRef")
    ),
    data: cloneJsonObject(readRequired(object, "data", path), persistencePath(path, "data"))
  };
};

const parseSchemaVersionOne = (object: Readonly<Record<string, unknown>>, path: string): 1 => {
  const schemaPath = persistencePath(path, "schemaVersion");
  const value = readRequired(object, "schemaVersion", path);
  if (value !== 1) {
    return failPersistenceValidation("UNSUPPORTED_SCHEMA_VERSION", schemaPath, "Only record schema version 1 is supported.");
  }
  return 1;
};

const parseNeutralRecord = <TId extends StableInstanceId>(
  value: unknown,
  path: string,
  idReader: (entry: unknown, entryPath: string) => TId,
  locatedReferences: LocatedDefinitionReference[]
): NeutralPersistentRecord<TId> => {
  const object = readPlainObject(value, path);
  parseSchemaVersionOne(object, path);
  assertAllowedFields(object, path, ["schemaVersion", "instanceId", "definitionRef", "data"]);
  const definitionValue = readRequired(object, "definitionRef", path);
  return {
    schemaVersion: 1,
    instanceId: stableId(idReader, readRequired(object, "instanceId", path), persistencePath(path, "instanceId")),
    definitionRef:
      definitionValue === null
        ? null
        : parseDefinitionReference(definitionValue, persistencePath(path, "definitionRef"), locatedReferences),
    data: cloneJsonObject(readRequired(object, "data", path), persistencePath(path, "data"))
  };
};

const parseDiscovery = (value: unknown, path: string): DiscoveryPersistentState => {
  const object = readPlainObject(value, path);
  parseSchemaVersionOne(object, path);
  assertAllowedFields(object, path, ["schemaVersion", "siteId", "discoveredAtTick", "data"]);
  return {
    schemaVersion: 1,
    siteId: stableId(parseSiteId, readRequired(object, "siteId", path), persistencePath(path, "siteId")),
    discoveredAtTick: createSimulationTick(
      readNonNegativeSafeInteger(readRequired(object, "discoveredAtTick", path), persistencePath(path, "discoveredAtTick")),
      persistencePath(path, "discoveredAtTick")
    ),
    data: cloneJsonObject(readRequired(object, "data", path), persistencePath(path, "data"))
  };
};

const parseEventType = (value: unknown, path: string): EventType => {
  if (typeof value !== "string" || !eventTypes.has(value as EventType)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Event type is not supported.");
  }
  return value as EventType;
};

const parseEventSeverity = (value: unknown, path: string): EventSeverity => {
  if (typeof value !== "string" || !eventSeverities.has(value as EventSeverity)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Event severity is not supported.");
  }
  return value as EventSeverity;
};

const parseEventStatus = (value: unknown, path: string): EventStatus => {
  if (typeof value !== "string" || !eventStatuses.has(value as EventStatus)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Event status is not supported.");
  }
  return value as EventStatus;
};

const parseNullableInstanceId = (value: unknown, path: string): StableInstanceId | null =>
  value === null ? null : stableId(parseStableInstanceId, value, path);

const assertMachineEventPayload = (value: JsonValue, path: string): void => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertMachineEventPayload(entry, persistencePath(path, index)));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  const objectValue = value as JsonObject;
  for (const key of Object.keys(value).sort()) {
    if (forbiddenEventPayloadKeys.has(key)) {
      failPersistenceValidation(
        "INVALID_VALUE",
        persistencePath(path, key),
        "Persistent event payloads contain machine facts, not UI presentation text."
      );
    }
    assertMachineEventPayload(objectValue[key] as JsonValue, persistencePath(path, key));
  }
};

const parseDomainEvent = (value: unknown, path: string): DomainEvent => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "eventId",
    "type",
    "universeTime",
    "sourceId",
    "targetId",
    "severity",
    "actionRequired",
    "payload",
    "status",
    "acknowledgedAt"
  ]);
  const status = parseEventStatus(readRequired(object, "status", path), persistencePath(path, "status"));
  const acknowledgedValue = readRequired(object, "acknowledgedAt", path);
  const acknowledgedAt = acknowledgedValue === null
    ? null
    : parseUniverseTime(acknowledgedValue, persistencePath(path, "acknowledgedAt"));
  if ((status === "Pending" && acknowledgedAt !== null) || (status === "Acknowledged" && acknowledgedAt === null)) {
    return failPersistenceValidation(
      "INVALID_VALUE",
      persistencePath(path, "acknowledgedAt"),
      "Event status and acknowledgement Universe Time are inconsistent."
    );
  }
  const payloadPath = persistencePath(path, "payload");
  const payload = cloneJsonValue(readRequired(object, "payload", path), payloadPath);
  assertMachineEventPayload(payload, payloadPath);
  return {
    eventId: stableId(parseEventId, readRequired(object, "eventId", path), persistencePath(path, "eventId")),
    type: parseEventType(readRequired(object, "type", path), persistencePath(path, "type")),
    universeTime: parseUniverseTime(readRequired(object, "universeTime", path), persistencePath(path, "universeTime")),
    sourceId: parseNullableInstanceId(readRequired(object, "sourceId", path), persistencePath(path, "sourceId")),
    targetId: parseNullableInstanceId(readRequired(object, "targetId", path), persistencePath(path, "targetId")),
    severity: parseEventSeverity(readRequired(object, "severity", path), persistencePath(path, "severity")),
    actionRequired: readBoolean(readRequired(object, "actionRequired", path), persistencePath(path, "actionRequired")),
    payload,
    status,
    acknowledgedAt
  };
};

const parseEventQueue = (value: unknown, path: string): EventQueueSnapshot => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["events"]);
  const seen = new Set<string>();
  const events = readArray(readRequired(object, "events", path), persistencePath(path, "events")).map((entry, index) => {
    const eventPath = persistencePath(persistencePath(path, "events"), index);
    const event = parseDomainEvent(entry, eventPath);
    if (seen.has(event.eventId)) {
      return failPersistenceValidation("DUPLICATE_ID", persistencePath(eventPath, "eventId"), "Duplicate event ID.");
    }
    seen.add(event.eventId);
    return event;
  });
  events.sort((left, right) => left.universeTime.tick - right.universeTime.tick || codeUnitCompare(left.eventId, right.eventId));
  return { events };
};

/** Validates a complete persistent domain event independently of a save envelope. */
export const validateDomainEvent = (value: unknown, path = ""): DomainEvent =>
  deepFreeze(parseDomainEvent(value, path)) as DomainEvent;

/** Validates, orders, defensively clones, and freezes a persistent event queue. */
export const validateEventQueueSnapshot = (value: unknown, path = ""): EventQueueSnapshot =>
  deepFreeze(parseEventQueue(value, path)) as EventQueueSnapshot;

const parseMetadata = (value: unknown, path: string): SaveGameMetadata => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["createdAtTick", "updatedAtTick", "provenance"]);
  const tick = (entry: unknown, entryPath: string) => createSimulationTick(readNonNegativeSafeInteger(entry, entryPath), entryPath);
  const provenance = readRequired(object, "provenance", path);
  return {
    createdAtTick: tick(readRequired(object, "createdAtTick", path), persistencePath(path, "createdAtTick")),
    updatedAtTick: tick(readRequired(object, "updatedAtTick", path), persistencePath(path, "updatedAtTick")),
    provenance: provenance === null ? null : cloneJsonObject(provenance, persistencePath(path, "provenance"))
  };
};

const parseDefinitionSnapshots = (value: readonly DefinitionResolutionSnapshot[]): readonly DefinitionResolutionSnapshot[] => {
  const snapshots = readArray(value, "/definitionSnapshots").map((entry, index) => {
    const path = persistencePath("/definitionSnapshots", index);
    const object = readPlainObject(entry, path);
    assertAllowedFields(object, path, ["domain", "version", "definitionIds"]);
    const definitionIds = readArray(readRequired(object, "definitionIds", path), persistencePath(path, "definitionIds"))
      .map((id, definitionIndex) =>
        stableId(parseShipVariantId, id, persistencePath(persistencePath(path, "definitionIds"), definitionIndex))
      )
      .sort(codeUnitCompare);
    const duplicateIndex = definitionIds.findIndex((id, definitionIndex) => definitionIndex > 0 && id === definitionIds[definitionIndex - 1]);
    if (duplicateIndex >= 0) {
      return failPersistenceValidation(
        "DUPLICATE_ID",
        persistencePath(persistencePath(path, "definitionIds"), duplicateIndex),
        "Duplicate definition ID in resolution snapshot."
      );
    }
    return {
      domain: parseDomain(readRequired(object, "domain", path), persistencePath(path, "domain")),
      version: parseVersion(readRequired(object, "version", path), persistencePath(path, "version")),
      definitionIds
    };
  });
  snapshots.sort((left, right) => codeUnitCompare(left.domain, right.domain));
  for (let index = 1; index < snapshots.length; index += 1) {
    if (snapshots[index]?.domain === snapshots[index - 1]?.domain) {
      return failPersistenceValidation(
        "DUPLICATE_ID",
        persistencePath(persistencePath("/definitionSnapshots", index), "domain"),
        "Only one definition snapshot per domain is allowed."
      );
    }
  }
  return snapshots;
};

const resolveDefinitions = (
  references: readonly LocatedDefinitionReference[],
  mobileDefinitionIds: readonly LocatedMobileDefinitionId[],
  versions: readonly DefinitionsVersionReference[],
  snapshots: readonly DefinitionResolutionSnapshot[]
): void => {
  const versionsByDomain = new Map(versions.map((entry) => [entry.domain, entry]));
  const snapshotsByDomain = new Map(snapshots.map((entry) => [entry.domain, entry]));
  for (const located of references) {
    const { reference, path } = located;
    const version = versionsByDomain.get(reference.domain);
    if (version === undefined) {
      return failPersistenceValidation(
        "MISSING_DEFINITIONS_VERSION",
        persistencePath(path, "definitionsVersionRef"),
        "Definition domain has no envelope version reference."
      );
    }
    if (version.version !== reference.definitionsVersionRef.version) {
      failPersistenceValidation(
        "DEFINITIONS_VERSION_MISMATCH",
        persistencePath(persistencePath(path, "definitionsVersionRef"), "version"),
        "Definition reference does not match the envelope definitions version."
      );
    }
    const snapshot = snapshotsByDomain.get(reference.domain);
    if (snapshot === undefined) {
      return failPersistenceValidation(
        "MISSING_DEFINITION_SNAPSHOT",
        persistencePath(path, "definitionId"),
        "Definition domain has no supplied resolution snapshot."
      );
    }
    if (snapshot.version !== version.version) {
      failPersistenceValidation(
        "DEFINITIONS_VERSION_MISMATCH",
        persistencePath(path, "definitionsVersionRef"),
        "Supplied definition snapshot version does not match the save."
      );
    }
    if (!snapshot.definitionIds.includes(reference.definitionId)) {
      failPersistenceValidation(
        "MISSING_DEFINITION",
        persistencePath(path, "definitionId"),
        "Referenced definition ID is absent from the supplied version-bound snapshot."
      );
    }
  }

  for (const located of mobileDefinitionIds) {
    const matchingSnapshots = snapshots.filter((snapshot) => snapshot.definitionIds.includes(located.definitionId));
    if (matchingSnapshots.length === 0) {
      failPersistenceValidation(
        "MISSING_DEFINITION",
        located.path,
        "Mobile definition ID is absent from every supplied version-bound snapshot."
      );
    }
    if (matchingSnapshots.length > 1) {
      failPersistenceValidation(
        "DUPLICATE_ID",
        located.path,
        "Mobile definition ID resolves ambiguously in more than one definition snapshot."
      );
    }
    const snapshot = matchingSnapshots[0];
    if (snapshot === undefined) {
      return failPersistenceValidation("MISSING_DEFINITION", located.path, "Mobile definition resolution failed.");
    }
    const matchingVersions = versions.filter((version) => version.domain === snapshot.domain);
    if (matchingVersions.length === 0) {
      failPersistenceValidation(
        "MISSING_DEFINITIONS_VERSION",
        located.path,
        "Resolved mobile definition domain has no envelope version reference."
      );
    }
    if (matchingVersions.length > 1) {
      failPersistenceValidation(
        "DUPLICATE_ID",
        located.path,
        "Resolved mobile definition domain has more than one envelope version reference."
      );
    }
    const version = matchingVersions[0];
    if (version === undefined) {
      return failPersistenceValidation("MISSING_DEFINITIONS_VERSION", located.path, "Mobile definition version resolution failed.");
    }
    if (snapshot.version !== version.version) {
      failPersistenceValidation(
        "DEFINITIONS_VERSION_MISMATCH",
        located.path,
        "Resolved mobile definition snapshot version does not match the envelope version."
      );
    }
  }
};

const registerOwnedId = (seen: Map<string, string>, id: string, path: string): void => {
  const previousPath = seen.get(id);
  if (previousPath !== undefined) {
    failPersistenceValidation("DUPLICATE_ID", path, `Duplicate owned instance ID; first occurrence is ${previousPath}.`);
  }
  seen.set(id, path);
};

const assertOwnedIdsAndPlayerReferences = (envelope: SaveGameEnvelopeV1): void => {
  const seen = new Map<string, string>();
  registerOwnedId(seen, envelope.player.playerId, "/player/playerId");
  envelope.ships.forEach((entry, index) => registerOwnedId(seen, entry.objectId, `/ships/${index}/objectId`));
  envelope.drones.forEach((entry, index) => registerOwnedId(seen, entry.objectId, `/drones/${index}/objectId`));
  envelope.stations.forEach((entry, index) => registerOwnedId(seen, entry.instanceId, `/stations/${index}/instanceId`));
  envelope.bases.forEach((entry, index) => registerOwnedId(seen, entry.instanceId, `/bases/${index}/instanceId`));
  envelope.missions.forEach((entry, index) => registerOwnedId(seen, entry.instanceId, `/missions/${index}/instanceId`));
  envelope.encounters.forEach((entry, index) => registerOwnedId(seen, entry.instanceId, `/encounters/${index}/instanceId`));
  envelope.discoveries.forEach((entry, index) => registerOwnedId(seen, entry.siteId, `/discoveries/${index}/siteId`));
  envelope.worldEvents.events.forEach((entry, index) => registerOwnedId(seen, entry.eventId, `/worldEvents/events/${index}/eventId`));

  if (envelope.player.activeShipId !== null && !envelope.ships.some((ship) => ship.objectId === envelope.player.activeShipId)) {
    failPersistenceValidation("UNKNOWN_REFERENCE", "/player/activeShipId", "Player active ship is not present in the save.");
  }
  if (
    envelope.player.activeMissionRef !== null &&
    !envelope.missions.some((mission) => mission.instanceId === envelope.player.activeMissionRef)
  ) {
    failPersistenceValidation("UNKNOWN_REFERENCE", "/player/activeMissionRef", "Player active mission is not present in the save.");
  }
};

const parseCollection = <T>(value: unknown, path: string, parse: (entry: unknown, entryPath: string) => T): T[] =>
  readArray(value, path).map((entry, index) => parse(entry, persistencePath(path, index)));

/** Validates, normalizes, defensively clones, and deeply freezes an untrusted V1 save. */
export const validateSaveGameEnvelopeV1 = (
  value: unknown,
  definitionSnapshots: readonly DefinitionResolutionSnapshot[]
): SaveGameEnvelopeV1 => {
  const source = typeof value === "string" ? parsePersistenceJson(value) : value;
  const object = readPlainObject(source, "");
  const schemaVersion = readRequired(object, "schemaVersion", "");
  if (typeof schemaVersion === "number" && schemaVersion > SAVE_GAME_SCHEMA_VERSION_V1) {
    return failPersistenceValidation(
      "UNSUPPORTED_FUTURE_SCHEMA_VERSION",
      "/schemaVersion",
      "Future SaveGame schema versions are not supported by the V1 validator."
    );
  }
  if (schemaVersion !== SAVE_GAME_SCHEMA_VERSION_V1) {
    return failPersistenceValidation("UNSUPPORTED_SCHEMA_VERSION", "/schemaVersion", "Only SaveGame schema version 1 is supported.");
  }
  assertAllowedFields(object, "", [
    "schemaVersion",
    "gameVersion",
    "saveId",
    "universeTime",
    "definitionsVersionRefs",
    "player",
    "ships",
    "drones",
    "stations",
    "bases",
    "missions",
    "encounters",
    "discoveries",
    "worldEvents",
    "metadata"
  ]);

  const locatedReferences: LocatedDefinitionReference[] = [];
  const locatedMobileDefinitionIds: LocatedMobileDefinitionId[] = [];
  const versions = parseCollection(
    readRequired(object, "definitionsVersionRefs", ""),
    "/definitionsVersionRefs",
    parseDefinitionsVersionReference
  ).sort((left, right) => codeUnitCompare(left.domain, right.domain));
  for (let index = 1; index < versions.length; index += 1) {
    if (versions[index]?.domain === versions[index - 1]?.domain) {
      return failPersistenceValidation(
        "DUPLICATE_ID",
        `/definitionsVersionRefs/${index}/domain`,
        "Only one definitions version reference per domain is allowed."
      );
    }
  }

  const ships = parseCollection(readRequired(object, "ships", ""), "/ships", (entry, path) =>
    parseMobileObject(entry, path, parseShipId, locatedMobileDefinitionIds)
  ).sort((left, right) => codeUnitCompare(left.objectId, right.objectId));
  const drones = parseCollection(readRequired(object, "drones", ""), "/drones", (entry, path) =>
    parseMobileObject(entry, path, parseDroneId, locatedMobileDefinitionIds)
  ).sort((left, right) => codeUnitCompare(left.objectId, right.objectId));
  const stations = parseCollection(readRequired(object, "stations", ""), "/stations", (entry, path) =>
    parseNeutralRecord(entry, path, parseStationId, locatedReferences) as StationPersistentState
  ).sort((left, right) => codeUnitCompare(left.instanceId, right.instanceId));
  const bases = parseCollection(readRequired(object, "bases", ""), "/bases", (entry, path) =>
    parseNeutralRecord(entry, path, parseBaseId, locatedReferences) as BasePersistentState
  ).sort((left, right) => codeUnitCompare(left.instanceId, right.instanceId));
  const missions = parseCollection(readRequired(object, "missions", ""), "/missions", (entry, path) =>
    parseNeutralRecord(entry, path, parseMissionId, locatedReferences) as MissionPersistentState
  ).sort((left, right) => codeUnitCompare(left.instanceId, right.instanceId));
  const encounters = parseCollection(readRequired(object, "encounters", ""), "/encounters", (entry, path) =>
    parseNeutralRecord(entry, path, parseEncounterId, locatedReferences) as EncounterPersistentState
  ).sort((left, right) => codeUnitCompare(left.instanceId, right.instanceId));
  const discoveries = parseCollection(readRequired(object, "discoveries", ""), "/discoveries", parseDiscovery)
    .sort((left, right) => codeUnitCompare(left.siteId, right.siteId));

  const envelope: SaveGameEnvelopeV1 = {
    schemaVersion: SAVE_GAME_SCHEMA_VERSION_V1,
    gameVersion: readNonEmptyString(readRequired(object, "gameVersion", ""), "/gameVersion"),
    saveId: stableId(parseSaveId, readRequired(object, "saveId", ""), "/saveId"),
    universeTime: parseUniverseTime(readRequired(object, "universeTime", ""), "/universeTime"),
    definitionsVersionRefs: versions,
    player: parsePlayer(readRequired(object, "player", ""), "/player"),
    ships,
    drones,
    stations,
    bases,
    missions,
    encounters,
    discoveries,
    worldEvents: parseEventQueue(readRequired(object, "worldEvents", ""), "/worldEvents"),
    metadata: parseMetadata(readRequired(object, "metadata", ""), "/metadata")
  };

  assertOwnedIdsAndPlayerReferences(envelope);
  const parsedDefinitionSnapshots = parseDefinitionSnapshots(definitionSnapshots);
  resolveDefinitions(locatedReferences, locatedMobileDefinitionIds, versions, parsedDefinitionSnapshots);
  return deepFreeze(envelope) as SaveGameEnvelopeV1;
};

export const parseSaveGameEnvelopeV1 = validateSaveGameEnvelopeV1;
