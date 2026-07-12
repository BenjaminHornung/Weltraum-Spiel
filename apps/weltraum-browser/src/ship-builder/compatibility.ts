import { createShipBlueprint } from "./blueprint";
import { canonicalJsonHash, canonicalJsonStringify } from "./canonicalJson";
import { isComponentKind } from "./components";
import {
  createShipBuilderDiagnostic,
  orderShipBuilderDiagnostics
} from "./diagnostics";
import type {
  ShipBuilderDiagnostic,
  ShipBuilderDiagnosticEndpoint,
  ShipBuilderDiagnosticSeverity
} from "./diagnostics";
import { parsePartCategoryId, parsePartDefinitionId, parseSocketId } from "./ids";
import type { ConnectionId, PartCategoryId, PartDefinitionId, SocketId } from "./ids";
import type {
  ComponentKind,
  ConnectionType,
  MountSide,
  PartConnection,
  PartConnectionEndpoint,
  PartDefinition,
  PartInstance,
  PartSocket,
  SerializableVector3,
  ShipBlueprint,
  ShipPartCatalogSnapshot,
  SocketCapacityClass,
  SocketType
} from "./types";
import {
  assertAllowedObjectFields,
  dataError,
  dataPath,
  deepFreeze,
  readArray,
  readBoolean,
  readOptionalProperty,
  readPlainObject,
  readPositiveInteger,
  readRequiredProperty,
  readString
} from "./validation";

export type ShipBuilderEndpointOccupancy = "Exclusive" | "Shared";
export type ShipBuilderDirectionMode = "Finite" | "NonZero" | "Opposed";

export interface ShipBuilderEndpointRule {
  readonly socketType: SocketType;
  readonly occupancy: ShipBuilderEndpointOccupancy;
}

export interface ShipBuilderConnectionRule {
  readonly socketTypes: readonly [SocketType, SocketType];
  readonly connectionTypes: readonly ConnectionType[];
  readonly capacityPairs: readonly (readonly [SocketCapacityClass, SocketCapacityClass])[];
  readonly mountSidePairs: readonly (readonly [MountSide, MountSide])[];
  readonly directionMode: ShipBuilderDirectionMode;
  readonly allowSameInstance: boolean;
  readonly contributesToStructure: boolean;
}

export interface ShipBuilderRequiredSocketRule {
  readonly ruleId: string;
  readonly severity: ShipBuilderDiagnosticSeverity;
  readonly partDefinitionIds: readonly PartDefinitionId[];
  readonly categoryIds: readonly PartCategoryId[];
  readonly componentKinds: readonly ComponentKind[];
  readonly socketTypes: readonly SocketType[];
  readonly socketIds: readonly SocketId[];
}

export interface ShipBuilderValidationPolicyDocument {
  readonly policyId: string;
  readonly version: number;
  readonly endpointRules: readonly ShipBuilderEndpointRule[];
  readonly connectionRules: readonly ShipBuilderConnectionRule[];
  readonly requiredSocketRules: readonly ShipBuilderRequiredSocketRule[];
}

export interface ShipBuilderValidationPolicy extends ShipBuilderValidationPolicyDocument {
  readonly signature: string;
}

export interface PartConnectionCompatibilityResult {
  readonly connectionId: ConnectionId;
  readonly status: "Compatible" | "Incompatible";
  readonly enabled: boolean;
  readonly endpoints: readonly ShipBuilderDiagnosticEndpoint[];
  readonly matchedSocketTypes: readonly [SocketType, SocketType] | null;
  readonly contributesToStructure: boolean;
  readonly diagnostics: readonly ShipBuilderDiagnostic[];
}

const ENDPOINT_RULE_FIELDS = ["socketType", "occupancy"] as const;
const CONNECTION_RULE_FIELDS = [
  "socketTypes",
  "connectionTypes",
  "capacityPairs",
  "mountSidePairs",
  "directionMode",
  "allowSameInstance",
  "contributesToStructure"
] as const;
const REQUIRED_SOCKET_RULE_FIELDS = [
  "ruleId",
  "severity",
  "partDefinitionIds",
  "categoryIds",
  "componentKinds",
  "socketTypes",
  "socketIds"
] as const;
const POLICY_FIELDS = ["policyId", "version", "endpointRules", "connectionRules", "requiredSocketRules"] as const;

const SOCKET_CAPACITY_CLASSES = ["light", "standard", "heavy", "unlimited"] as const;
const MOUNT_SIDES = ["front", "back", "left", "right", "top", "bottom", "internal", "any"] as const;
const ENDPOINT_OCCUPANCIES = ["Exclusive", "Shared"] as const;
const DIRECTION_MODES = ["Finite", "NonZero", "Opposed"] as const;
const DIAGNOSTIC_SEVERITIES = ["Error", "Warning", "Info"] as const;

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const readNonEmptyString = (value: unknown, path: string): string => {
  const result = readString(value, path);
  if (result.length === 0) {
    throw dataError("InvalidValue", path, "Expected a non-empty string.");
  }
  return result;
};

const readEnum = <TValue extends string>(
  value: unknown,
  path: string,
  allowed: readonly TValue[],
  label: string
): TValue => {
  const result = readString(value, path);
  if (!(allowed as readonly string[]).includes(result)) {
    throw dataError("InvalidValue", path, `Unsupported ${label}.`, { value: result });
  }
  return result as TValue;
};

const readSocketType = (value: unknown, path: string): SocketType => readNonEmptyString(value, path) as SocketType;
const readConnectionType = (value: unknown, path: string): ConnectionType => readNonEmptyString(value, path) as ConnectionType;
const readCapacityClass = (value: unknown, path: string): SocketCapacityClass =>
  readEnum(value, path, SOCKET_CAPACITY_CLASSES, "socket capacity class");
const readMountSide = (value: unknown, path: string): MountSide => readEnum(value, path, MOUNT_SIDES, "mount side");
const readOccupancy = (value: unknown, path: string): ShipBuilderEndpointOccupancy =>
  readEnum(value, path, ENDPOINT_OCCUPANCIES, "endpoint occupancy");
const readDirectionMode = (value: unknown, path: string): ShipBuilderDirectionMode =>
  readEnum(value, path, DIRECTION_MODES, "direction mode");
const readSeverity = (value: unknown, path: string): ShipBuilderDiagnosticSeverity =>
  readEnum(value, path, DIAGNOSTIC_SEVERITIES, "diagnostic severity");
const readComponentKind = (value: unknown, path: string): ComponentKind => {
  if (!isComponentKind(value)) {
    throw dataError("InvalidValue", path, "Unsupported component kind.", { value: typeof value === "string" ? value : null });
  }
  return value;
};

const canonicalPair = <TValue extends string>(left: TValue, right: TValue): readonly [TValue, TValue] =>
  (compareText(left, right) <= 0 ? [left, right] : [right, left]) as readonly [TValue, TValue];

const comparePairs = <TValue extends string>(
  left: readonly [TValue, TValue],
  right: readonly [TValue, TValue]
): number => {
  const firstComparison = compareText(left[0], right[0]);
  return firstComparison !== 0 ? firstComparison : compareText(left[1], right[1]);
};

const readPair = <TValue extends string>(
  value: unknown,
  path: string,
  reader: (candidate: unknown, candidatePath: string) => TValue
): readonly [TValue, TValue] => {
  const values = readArray(value, path);
  if (values.length !== 2) {
    throw dataError("InvalidValue", path, "Expected exactly two values for a symmetric pair.");
  }
  return canonicalPair(reader(values[0], dataPath(path, 0)), reader(values[1], dataPath(path, 1)));
};

const readSortedUniqueArray = <TValue extends string>(
  value: unknown,
  path: string,
  reader: (candidate: unknown, candidatePath: string) => TValue,
  allowEmpty = true
): readonly TValue[] => {
  const parsed = readArray(value, path).map((candidate, index) => reader(candidate, dataPath(path, index))).sort(compareText);
  if (!allowEmpty && parsed.length === 0) {
    throw dataError("InvalidValue", path, "Expected at least one value.");
  }
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index - 1] === parsed[index]) {
      throw dataError("InvalidValue", dataPath(path, index), "Duplicate policy value.");
    }
  }
  return parsed;
};

const readSortedUniquePairs = <TValue extends string>(
  value: unknown,
  path: string,
  reader: (candidate: unknown, candidatePath: string) => TValue
): readonly (readonly [TValue, TValue])[] => {
  const parsed = readArray(value, path)
    .map((candidate, index) => readPair(candidate, dataPath(path, index), reader))
    .sort(comparePairs);
  if (parsed.length === 0) {
    throw dataError("InvalidValue", path, "Expected at least one symmetric pair.");
  }
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index - 1][0] === parsed[index][0] && parsed[index - 1][1] === parsed[index][1]) {
      throw dataError("InvalidValue", dataPath(path, index), "Duplicate policy pair.");
    }
  }
  return parsed;
};

const readEndpointRule = (value: unknown, path: string): ShipBuilderEndpointRule => {
  const object = readPlainObject(value, path);
  assertAllowedObjectFields(object, path, ENDPOINT_RULE_FIELDS);
  return {
    socketType: readSocketType(readRequiredProperty(object, "socketType", path), dataPath(path, "socketType")),
    occupancy: readOccupancy(readRequiredProperty(object, "occupancy", path), dataPath(path, "occupancy"))
  };
};

const readConnectionRule = (value: unknown, path: string): ShipBuilderConnectionRule => {
  const object = readPlainObject(value, path);
  assertAllowedObjectFields(object, path, CONNECTION_RULE_FIELDS);
  return {
    socketTypes: readPair(readRequiredProperty(object, "socketTypes", path), dataPath(path, "socketTypes"), readSocketType),
    connectionTypes: readSortedUniqueArray(
      readRequiredProperty(object, "connectionTypes", path),
      dataPath(path, "connectionTypes"),
      readConnectionType,
      false
    ),
    capacityPairs: readSortedUniquePairs(
      readRequiredProperty(object, "capacityPairs", path),
      dataPath(path, "capacityPairs"),
      readCapacityClass
    ),
    mountSidePairs: readSortedUniquePairs(
      readRequiredProperty(object, "mountSidePairs", path),
      dataPath(path, "mountSidePairs"),
      readMountSide
    ),
    directionMode: readDirectionMode(
      readRequiredProperty(object, "directionMode", path),
      dataPath(path, "directionMode")
    ),
    allowSameInstance: readBoolean(
      readRequiredProperty(object, "allowSameInstance", path),
      dataPath(path, "allowSameInstance")
    ),
    contributesToStructure: readBoolean(
      readRequiredProperty(object, "contributesToStructure", path),
      dataPath(path, "contributesToStructure")
    )
  };
};

const readOptionalSortedUniqueArray = <TValue extends string>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  reader: (candidate: unknown, candidatePath: string) => TValue
): readonly TValue[] => {
  const value = readOptionalProperty(object, key);
  return value === undefined ? [] : readSortedUniqueArray(value, dataPath(path, key), reader);
};

const readRequiredSocketRule = (value: unknown, path: string): ShipBuilderRequiredSocketRule => {
  const object = readPlainObject(value, path);
  assertAllowedObjectFields(object, path, REQUIRED_SOCKET_RULE_FIELDS);
  const rule: ShipBuilderRequiredSocketRule = {
    ruleId: readNonEmptyString(readRequiredProperty(object, "ruleId", path), dataPath(path, "ruleId")),
    severity: readSeverity(readRequiredProperty(object, "severity", path), dataPath(path, "severity")),
    partDefinitionIds: readOptionalSortedUniqueArray(object, "partDefinitionIds", path, parsePartDefinitionId),
    categoryIds: readOptionalSortedUniqueArray(object, "categoryIds", path, parsePartCategoryId),
    componentKinds: readOptionalSortedUniqueArray(object, "componentKinds", path, readComponentKind),
    socketTypes: readOptionalSortedUniqueArray(object, "socketTypes", path, readSocketType),
    socketIds: readOptionalSortedUniqueArray(object, "socketIds", path, parseSocketId)
  };

  if (
    rule.partDefinitionIds.length === 0 &&
    rule.categoryIds.length === 0 &&
    rule.componentKinds.length === 0 &&
    rule.socketTypes.length === 0 &&
    rule.socketIds.length === 0
  ) {
    throw dataError("InvalidValue", path, "A required-socket rule needs at least one explicit selector.");
  }

  return rule;
};

const readPolicyDocument = (input: unknown): ShipBuilderValidationPolicyDocument => {
  const path = "";
  const object = readPlainObject(input, path);
  assertAllowedObjectFields(object, path, POLICY_FIELDS);
  const endpointRules = readArray(readRequiredProperty(object, "endpointRules", path), "/endpointRules")
    .map((entry, index) => readEndpointRule(entry, dataPath("/endpointRules", index)))
    .sort((left, right) => compareText(left.socketType, right.socketType));
  for (let index = 1; index < endpointRules.length; index += 1) {
    if (endpointRules[index - 1].socketType === endpointRules[index].socketType) {
      throw dataError("InvalidValue", dataPath("/endpointRules", index), "Duplicate endpoint socket-type rule.");
    }
  }

  const connectionRules = readArray(readRequiredProperty(object, "connectionRules", path), "/connectionRules")
    .map((entry, index) => readConnectionRule(entry, dataPath("/connectionRules", index)))
    .sort((left, right) => comparePairs(left.socketTypes, right.socketTypes));
  for (let index = 1; index < connectionRules.length; index += 1) {
    const previous = connectionRules[index - 1].socketTypes;
    const current = connectionRules[index].socketTypes;
    if (previous[0] === current[0] && previous[1] === current[1]) {
      throw dataError("InvalidValue", dataPath("/connectionRules", index), "Duplicate socket-type connection rule.");
    }
  }

  const endpointSocketTypes = new Set(endpointRules.map((rule) => rule.socketType));
  for (let index = 0; index < connectionRules.length; index += 1) {
    for (const socketType of connectionRules[index].socketTypes) {
      if (!endpointSocketTypes.has(socketType)) {
        throw dataError(
          "UnknownReference",
          dataPath(dataPath("/connectionRules", index), "socketTypes"),
          "Connection rule socket type has no explicit endpoint occupancy rule.",
          { socketType }
        );
      }
    }
  }

  const requiredSocketRulesValue = readOptionalProperty(object, "requiredSocketRules");
  const requiredSocketRules = (requiredSocketRulesValue === undefined
    ? []
    : readArray(requiredSocketRulesValue, "/requiredSocketRules").map((entry, index) =>
        readRequiredSocketRule(entry, dataPath("/requiredSocketRules", index))
      )
  ).sort((left, right) => compareText(left.ruleId, right.ruleId));
  for (let index = 1; index < requiredSocketRules.length; index += 1) {
    if (requiredSocketRules[index - 1].ruleId === requiredSocketRules[index].ruleId) {
      throw dataError("DuplicateId", dataPath(dataPath("/requiredSocketRules", index), "ruleId"), "Duplicate rule ID.");
    }
  }

  return {
    policyId: readNonEmptyString(readRequiredProperty(object, "policyId", path), "/policyId"),
    version: readPositiveInteger(readRequiredProperty(object, "version", path), "/version"),
    endpointRules,
    connectionRules,
    requiredSocketRules
  };
};

export const shipBuilderValidationPolicyDocument = (
  policy: ShipBuilderValidationPolicy
): ShipBuilderValidationPolicyDocument => ({
  policyId: policy.policyId,
  version: policy.version,
  endpointRules: policy.endpointRules,
  connectionRules: policy.connectionRules,
  requiredSocketRules: policy.requiredSocketRules
});

export const createShipBuilderValidationPolicy = (input: unknown): ShipBuilderValidationPolicy => {
  const document = deepFreeze(readPolicyDocument(input)) as ShipBuilderValidationPolicyDocument;
  return deepFreeze({
    ...document,
    signature: canonicalJsonHash(document)
  }) as ShipBuilderValidationPolicy;
};

export const STARTER_SHIP_BUILDER_VALIDATION_POLICY = createShipBuilderValidationPolicy({
  policyId: "starter-ship-builder-validation-v1",
  version: 1,
  endpointRules: [{ socketType: "structural", occupancy: "Shared" }],
  connectionRules: [
    {
      socketTypes: ["structural", "structural"],
      connectionTypes: ["Structural"],
      capacityPairs: [["standard", "standard"]],
      mountSidePairs: [
        ["back", "front"],
        ["back", "bottom"],
        ["back", "top"],
        ["back", "left"],
        ["back", "right"],
        ["left", "right"],
        ["top", "bottom"]
      ],
      directionMode: "NonZero",
      allowSameInstance: false,
      contributesToStructure: true
    }
  ],
  requiredSocketRules: []
});

export const shipBuilderEndpointKey = (endpoint: PartConnectionEndpoint): string =>
  canonicalJsonStringify([endpoint.partInstanceId, endpoint.socketId]);

export const compareShipBuilderConnectionEndpoints = (
  left: PartConnectionEndpoint,
  right: PartConnectionEndpoint
): number => {
  const instanceComparison = compareText(left.partInstanceId, right.partInstanceId);
  return instanceComparison !== 0 ? instanceComparison : compareText(left.socketId, right.socketId);
};

export const endpointOccupancyForSocketType = (
  policy: ShipBuilderValidationPolicy,
  socketType: SocketType
): ShipBuilderEndpointOccupancy | undefined =>
  policy.endpointRules.find((rule) => rule.socketType === socketType)?.occupancy;

export const connectionRuleForSocketTypes = (
  policy: ShipBuilderValidationPolicy,
  leftSocketType: SocketType,
  rightSocketType: SocketType
): ShipBuilderConnectionRule | undefined => {
  const pair = canonicalPair(leftSocketType, rightSocketType);
  return policy.connectionRules.find(
    (rule) => rule.socketTypes[0] === pair[0] && rule.socketTypes[1] === pair[1]
  );
};

export const transformMountSideByYaw = (mountSide: MountSide, yaw: number): MountSide => {
  if (mountSide === "top" || mountSide === "bottom" || mountSide === "internal" || mountSide === "any") {
    return mountSide;
  }

  const horizontal: readonly MountSide[] = ["front", "right", "back", "left"];
  const startIndex = horizontal.indexOf(mountSide);
  const steps = (((yaw / 90) % 4) + 4) % 4;
  return horizontal[(startIndex + steps) % horizontal.length];
};

export const transformDirectionByYaw = (
  direction: SerializableVector3,
  yaw: number
): SerializableVector3 => {
  switch (yaw) {
    case 0:
      return { x: direction.x, y: direction.y, z: direction.z };
    case 90:
      return { x: direction.z, y: direction.y, z: -direction.x };
    case 180:
      return { x: -direction.x, y: direction.y, z: -direction.z };
    case 270:
      return { x: -direction.z, y: direction.y, z: direction.x };
    default:
      return { x: Number.NaN, y: Number.NaN, z: Number.NaN };
  }
};

interface ResolvedConnectionEndpoint {
  readonly endpoint: PartConnectionEndpoint;
  readonly instance: PartInstance;
  readonly definition: PartDefinition;
  readonly socket: PartSocket;
}

const resolveConnectionEndpoint = (
  endpoint: PartConnectionEndpoint,
  blueprint: ShipBlueprint,
  catalog: ShipPartCatalogSnapshot,
  endpointPath: string
): ResolvedConnectionEndpoint => {
  const instance = blueprint.instances.find((candidate) => candidate.stableInstanceId === endpoint.partInstanceId);
  if (instance === undefined) {
    throw dataError("UnknownInstance", dataPath(endpointPath, "partInstanceId"), "Connection endpoint instance is missing.");
  }
  const definition = catalog.indexes.partById[instance.partDefinitionId];
  if (definition === undefined) {
    throw dataError("UnknownReference", dataPath(endpointPath, "partInstanceId"), "Connection endpoint definition is missing.");
  }
  const socket = definition.sockets.find((candidate) => candidate.socketId === endpoint.socketId);
  if (socket === undefined) {
    throw dataError("UnknownSocket", dataPath(endpointPath, "socketId"), "Connection endpoint socket is missing.");
  }
  return { endpoint, instance, definition, socket };
};

const diagnosticEndpoints = (
  endpoints: readonly ResolvedConnectionEndpoint[]
): readonly ShipBuilderDiagnosticEndpoint[] =>
  endpoints.map((resolved) => ({
    partInstanceId: resolved.endpoint.partInstanceId,
    socketId: resolved.endpoint.socketId
  }));

const samePair = <TValue extends string>(
  pair: readonly [TValue, TValue],
  left: TValue,
  right: TValue
): boolean => {
  const candidate = canonicalPair(left, right);
  return pair[0] === candidate[0] && pair[1] === candidate[1];
};

const mountValuesMatch = (left: MountSide, right: MountSide): boolean =>
  left === "any" || right === "any" || left === right;

const mountPairMatches = (
  pair: readonly [MountSide, MountSide],
  left: MountSide,
  right: MountSide
): boolean =>
  (mountValuesMatch(pair[0], left) && mountValuesMatch(pair[1], right)) ||
  (mountValuesMatch(pair[0], right) && mountValuesMatch(pair[1], left));

const finiteDirection = (direction: SerializableVector3): boolean =>
  Number.isFinite(direction.x) && Number.isFinite(direction.y) && Number.isFinite(direction.z);

const nonZeroDirection = (direction: SerializableVector3): boolean =>
  finiteDirection(direction) && (direction.x !== 0 || direction.y !== 0 || direction.z !== 0);

const normalizedDirection = (direction: SerializableVector3): SerializableVector3 => {
  const scale = Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z));
  const scaled = { x: direction.x / scale, y: direction.y / scale, z: direction.z / scale };
  const length = Math.hypot(scaled.x, scaled.y, scaled.z);
  return { x: scaled.x / length, y: scaled.y / length, z: scaled.z / length };
};

const definitionComponentKinds = (definition: PartDefinition): readonly ComponentKind[] =>
  [...new Set(definition.components.map((component) => component.kind))].sort(compareText);

export const evaluatePartConnectionCompatibility = (
  connection: PartConnection,
  blueprintSource: ShipBlueprint,
  catalog: ShipPartCatalogSnapshot,
  policy: ShipBuilderValidationPolicy
): PartConnectionCompatibilityResult => {
  const blueprint = createShipBlueprint(blueprintSource, { catalog });
  const connectionIndex = blueprint.connections.findIndex((candidate) => candidate.connectionId === connection.connectionId);
  if (connectionIndex < 0) {
    throw dataError("UnknownReference", "/connectionId", "Connection is not part of the supplied blueprint.");
  }
  const canonicalConnection = blueprint.connections[connectionIndex];
  if (canonicalJsonStringify(connection) !== canonicalJsonStringify(canonicalConnection)) {
    throw dataError("UnknownReference", "/connectionId", "Connection differs from authoritative blueprint data.");
  }

  const connectionPath = dataPath("/connections", connectionIndex);
  const from = resolveConnectionEndpoint(canonicalConnection.from, blueprint, catalog, dataPath(connectionPath, "from"));
  const to = resolveConnectionEndpoint(canonicalConnection.to, blueprint, catalog, dataPath(connectionPath, "to"));
  const resolvedEndpoints = [from, to] as const;
  const endpoints = diagnosticEndpoints(resolvedEndpoints);
  const diagnostics: ShipBuilderDiagnostic[] = [];
  const addDiagnostic = (
    code: ShipBuilderDiagnostic["code"],
    details?: unknown
  ): void => {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code,
        severity: "Error",
        phase: "ConnectionCompatibility",
        path: connectionPath,
        instanceIds: [from.instance.stableInstanceId, to.instance.stableInstanceId],
        connectionIds: [canonicalConnection.connectionId],
        endpoints,
        ...(details !== undefined ? { details } : {})
      })
    );
  };

  const rule = connectionRuleForSocketTypes(policy, from.socket.socketType, to.socket.socketType);
  if (canonicalConnection.enabled) {
    const disabledInstanceIds = resolvedEndpoints
      .filter((resolved) => !resolved.instance.enabled)
      .map((resolved) => resolved.instance.stableInstanceId)
      .sort(compareText);
    if (disabledInstanceIds.length > 0) {
      addDiagnostic("ConnectionEndpointDisabled", { disabledInstanceIds });
    }

    const identicalEndpoints = shipBuilderEndpointKey(from.endpoint) === shipBuilderEndpointKey(to.endpoint);
    if (identicalEndpoints) {
      addDiagnostic("IdenticalConnectionEndpoints");
    }

    if (
      !identicalEndpoints &&
      from.instance.stableInstanceId === to.instance.stableInstanceId &&
      rule?.allowSameInstance !== true
    ) {
      addDiagnostic("SelfConnectionNotAllowed");
    }

    if (rule === undefined) {
      addDiagnostic("SocketTypeIncompatible", {
        socketTypes: canonicalPair(from.socket.socketType, to.socket.socketType)
      });
    } else {
      if (!rule.connectionTypes.includes(canonicalConnection.connectionType)) {
        addDiagnostic("ConnectionTypeIncompatible", {
          actualConnectionType: canonicalConnection.connectionType,
          allowedConnectionTypes: rule.connectionTypes
        });
      }

      if (!rule.capacityPairs.some((pair) => samePair(pair, from.socket.capacityClass, to.socket.capacityClass))) {
        addDiagnostic("SocketCapacityIncompatible", {
          capacityClasses: canonicalPair(from.socket.capacityClass, to.socket.capacityClass),
          allowedCapacityPairs: rule.capacityPairs
        });
      }
    }

    const categoryFailures = resolvedEndpoints.filter((resolved, index) => {
      const peer = resolvedEndpoints[index === 0 ? 1 : 0];
      return resolved.socket.compatibleCategoryIds.length > 0 &&
        !resolved.socket.compatibleCategoryIds.includes(peer.definition.categoryId);
    });
    if (categoryFailures.length > 0) {
      addDiagnostic("SocketCategoryIncompatible", {
        restrictedEndpoints: categoryFailures.map((resolved) => shipBuilderEndpointKey(resolved.endpoint)).sort(compareText)
      });
    }

    const componentFailures = resolvedEndpoints.filter((resolved, index) => {
      const peerKinds = definitionComponentKinds(resolvedEndpoints[index === 0 ? 1 : 0].definition);
      return resolved.socket.compatibleComponentKinds.length > 0 &&
        !resolved.socket.compatibleComponentKinds.some((kind) => peerKinds.includes(kind));
    });
    if (componentFailures.length > 0) {
      addDiagnostic("SocketComponentKindIncompatible", {
        restrictedEndpoints: componentFailures.map((resolved) => shipBuilderEndpointKey(resolved.endpoint)).sort(compareText)
      });
    }

    if (rule !== undefined) {
      const transformedMountSides = [
        transformMountSideByYaw(from.socket.mountSide, from.instance.localRotation.yaw),
        transformMountSideByYaw(to.socket.mountSide, to.instance.localRotation.yaw)
      ] as const;
      if (!rule.mountSidePairs.some((pair) => mountPairMatches(pair, transformedMountSides[0], transformedMountSides[1]))) {
        addDiagnostic("SocketMountSideIncompatible", {
          mountSides: canonicalPair(transformedMountSides[0], transformedMountSides[1]),
          allowedMountSidePairs: rule.mountSidePairs
        });
      }

      const transformedDirections = [
        transformDirectionByYaw(from.socket.direction, from.instance.localRotation.yaw),
        transformDirectionByYaw(to.socket.direction, to.instance.localRotation.yaw)
      ] as const;
      const validDirections = transformedDirections.map((direction) =>
        rule.directionMode === "Finite" ? finiteDirection(direction) : nonZeroDirection(direction)
      );
      if (!validDirections[0] || !validDirections[1]) {
        addDiagnostic("SocketDirectionInvalid", {
          directionMode: rule.directionMode,
          invalidEndpoints: resolvedEndpoints
            .filter((_resolved, index) => !validDirections[index])
            .map((resolved) => shipBuilderEndpointKey(resolved.endpoint))
            .sort(compareText)
        });
      } else if (rule.directionMode === "Opposed") {
        const left = normalizedDirection(transformedDirections[0]);
        const right = normalizedDirection(transformedDirections[1]);
        const dotProduct = left.x * right.x + left.y * right.y + left.z * right.z;
        if (!Number.isFinite(dotProduct) || dotProduct > -0.999999) {
          addDiagnostic("SocketDirectionsIncompatible", { dotProduct, maximumDotProduct: -0.999999 });
        }
      }
    }
  }

  const orderedDiagnostics = orderShipBuilderDiagnostics(diagnostics);
  const status = orderedDiagnostics.some((diagnostic) => diagnostic.severity === "Error")
    ? "Incompatible"
    : "Compatible";
  const enabledEndpoints = from.instance.enabled && to.instance.enabled;

  return deepFreeze({
    connectionId: canonicalConnection.connectionId,
    status,
    enabled: canonicalConnection.enabled,
    endpoints: [...endpoints].sort(compareShipBuilderConnectionEndpoints),
    matchedSocketTypes: rule?.socketTypes ?? null,
    contributesToStructure:
      canonicalConnection.enabled && enabledEndpoints && status === "Compatible" && rule?.contributesToStructure === true,
    diagnostics: orderedDiagnostics
  }) as PartConnectionCompatibilityResult;
};
