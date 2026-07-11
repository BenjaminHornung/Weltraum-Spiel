import { canonicalJsonHash, canonicalJsonStringify } from "./canonicalJson";
import { comparePartCategories } from "./categories";
import { isComponentKind } from "./components";
import {
  parseCatalogId,
  parseCatalogSchemaVersion,
  parseCatalogVersion,
  parseComponentId,
  parseComponentSchemaVersion,
  parsePartCategoryId,
  parsePartDefinitionId,
  parsePartDefinitionSchemaVersion,
  parseSocketId,
  parseSocketSchemaVersion
} from "./ids";
import { validateLocalSocketReferences, validateSocketSpatialData } from "./sockets";
import type {
  BuildCostReference,
  ComponentKind,
  GridFootprint,
  MeterDimensions,
  MountSide,
  NamespacedExtensions,
  PartAssetReference,
  PartCategoryDefinition,
  PartDefinition,
  PartSocket,
  SerializableVector3,
  ShipBuilderComponent,
  ShipPartCatalogDocument,
  ShipPartCatalogIndexes,
  ShipPartCatalogSnapshot,
  ShipPartCatalogSummary,
  SocketArcMetadata,
  SocketCapacityClass,
  SocketDirectionRole,
  SocketRole,
  SocketType
} from "./types";
import {
  dataError,
  dataPath,
  deepFreeze,
  readArray,
  readBoolean,
  readFiniteNumber,
  readFiniteVector3,
  readNamespacedExtensions,
  readNonNegativeFiniteNumber,
  readNormalizedQuaternion,
  readPlainObject,
  readPositiveFiniteNumber,
  readPositiveInteger,
  readRequiredProperty,
  readString
} from "./validation";
import type {
  ComponentId,
  PartCategoryId,
  PartDefinitionId,
  SocketId
} from "./ids";

export type SerializedShipPartCatalogDocument = ShipPartCatalogDocument;

const MOUNT_SIDES = ["front", "back", "left", "right", "top", "bottom", "internal", "any"] as const;
const SOCKET_ROLES = ["Structural", "Functional", "Visual", "Camera"] as const;
const SOCKET_DIRECTION_ROLES = ["None", "MountNormal", "Thrust", "Aim", "Docking", "Camera"] as const;
const SOCKET_CAPACITY_CLASSES = ["light", "standard", "heavy", "unlimited"] as const;
const CONTROL_MODES = ["manual", "assisted", "autopilot"] as const;
const AXES = ["x", "y", "z"] as const;

const CATEGORY_FIELDS = [
  "categoryId",
  "displayNameKey",
  "displayNameFallback",
  "descriptionKey",
  "descriptionFallback",
  "sortOrder",
  "presentationKey",
  "paletteTags",
  "requiredSystemRole",
  "allowedComponentKinds",
  "recommendedComponentKinds",
  "extensions"
] as const;

const CATALOG_FIELDS = ["catalogId", "catalogVersion", "schemaVersion", "categories", "partDefinitions", "extensions"] as const;

const PART_DEFINITION_FIELDS = [
  "partDefinitionId",
  "schemaVersion",
  "displayName",
  "description",
  "categoryId",
  "tags",
  "dimensionsMeters",
  "gridFootprint",
  "dryMassKilograms",
  "allowedMountSides",
  "sockets",
  "components",
  "buildCostReferences",
  "visualReference",
  "colliderReference",
  "variantGroupId",
  "balanceTier",
  "extensions"
] as const;

const SOCKET_FIELDS = [
  "socketId",
  "schemaVersion",
  "socketType",
  "localPosition",
  "localRotation",
  "role",
  "directionRole",
  "direction",
  "compatibleCategoryIds",
  "compatibleComponentKinds",
  "capacityClass",
  "mountSide",
  "requiredForComponentIds",
  "compatibilityAliases",
  "arc",
  "vfxRole",
  "excludedFromCameraBounds",
  "extensions"
] as const;

const COMPONENT_COMMON_FIELDS = ["componentId", "kind", "schemaVersion", "tags", "extensions"] as const;

const COMPONENT_FIELDS_BY_KIND: Readonly<Record<ComponentKind, readonly string[]>> = {
  ControlCore: ["controlSocketId", "cameraSocketId", "seatCount", "controlRating", "supportedControlModes"],
  Structural: ["structuralSocketIds", "structuralRating"],
  MainThruster: [
    "nozzleSocketId",
    "maximumThrustNewtons",
    "propellantBurnKilogramsPerSecond",
    "throttleResponseSeconds",
    "gimbalDegrees"
  ],
  RcsCluster: [
    "nozzleSocketIds",
    "thrustPerNozzleNewtons",
    "propellantBurnKilogramsPerSecond",
    "translationAxes",
    "rotationAxes"
  ],
  FuelTank: ["capacityKilograms", "fuelKind", "feedSocketIds", "fillSocketId"],
  CargoStorage: ["cargoAttachSocketIds", "capacityCubicMeters", "maximumPayloadKilograms", "accessSocketId"],
  FixedWeapon: [
    "hardpointSocketId",
    "muzzleSocketId",
    "muzzleFlashSocketId",
    "damagePerShot",
    "projectileSpeedMetersPerSecond",
    "rangeMeters",
    "rateOfFirePerSecond",
    "recoilNewtons"
  ],
  TurretWeapon: [
    "turretBaseSocketId",
    "yawPivotSocketId",
    "pitchPivotSocketId",
    "muzzleSocketId",
    "muzzleFlashSocketId",
    "damagePerShot",
    "projectileSpeedMetersPerSecond",
    "rangeMeters",
    "rateOfFirePerSecond",
    "recoilNewtons"
  ],
  SensorUtility: ["mountSocketId", "rangeMeters", "scanRatePerSecond", "sensorRating"],
  DockingConnector: ["connectorSocketId", "dockingRating", "maximumApproachSpeedMetersPerSecond"],
  Armor: ["armorRating", "coverageFraction", "addedMassKilograms"],
  PowerHeatReserved: ["reservedPowerWatts", "reservedHeatWatts", "reservationReason"]
};

const BUILD_COST_REFERENCE_FIELDS = ["resourceId", "quantity", "extensions"] as const;
const ASSET_REFERENCE_FIELDS = ["assetId", "variantId", "extensions"] as const;
const SOCKET_ARC_FIELDS = ["yawDegrees", "pitchDegrees", "minimumRangeMeters", "maximumRangeMeters"] as const;

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

const sortUniqueStrings = (values: readonly string[]): readonly string[] => {
  const ordered = [...values].sort(compareText);
  return ordered.filter((value, index) => index === 0 || value !== ordered[index - 1]);
};

const readSortedStringArray = (value: unknown, path: string, requireNonEmpty = false): readonly string[] => {
  const result = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    return requireNonEmpty ? readNonEmptyString(entry, entryPath) : readString(entry, entryPath);
  });
  return sortUniqueStrings(result);
};

const readEnum = <TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  label: string
): TValue => {
  const result = readString(value, path);
  if (!(allowedValues as readonly string[]).includes(result)) {
    throw dataError("InvalidValue", path, `${label} is not supported.`);
  }

  return result as TValue;
};

const readComponentKind = (value: unknown, path: string): ComponentKind => {
  if (!isComponentKind(value)) {
    throw dataError("InvalidValue", path, "Component kind is not supported by schema v1.");
  }

  return value;
};

const readSortedComponentKinds = (value: unknown, path: string): readonly ComponentKind[] =>
  sortUniqueStrings(
    readArray(value, path).map((entry, index) => readComponentKind(entry, dataPath(path, index)))
  ) as readonly ComponentKind[];

const readSortedStableIds = <TId extends string>(
  value: unknown,
  path: string,
  parser: (candidate: unknown, candidatePath: string) => TId
): readonly TId[] =>
  sortUniqueStrings(readArray(value, path).map((entry, index) => parser(entry, dataPath(path, index)))) as readonly TId[];

const readCompatibleCategoryIds = (
  value: unknown,
  path: string,
  categoryById: Readonly<Record<PartCategoryId, PartCategoryDefinition>>
): readonly PartCategoryId[] => {
  const candidates = readArray(value, path).map((entry, index) => ({
    categoryId: parsePartCategoryId(entry, dataPath(path, index)),
    path: dataPath(path, index)
  }));
  candidates.sort((left, right) => compareText(left.categoryId, right.categoryId));

  for (const candidate of candidates) {
    if (categoryById[candidate.categoryId] === undefined) {
      throw dataError("UnknownCategory", candidate.path, "Socket compatible category does not exist in this catalog.");
    }
  }

  return candidates
    .map((candidate) => candidate.categoryId)
    .filter((categoryId, index, ordered) => index === 0 || categoryId !== ordered[index - 1]);
};

const readRequiredSocketId = (object: Readonly<Record<string, unknown>>, key: string, path: string): SocketId =>
  readRequired(object, key, path, parseSocketId);

const readOptionalSocketId = (object: Readonly<Record<string, unknown>>, key: string, path: string): SocketId | undefined =>
  readOptional(object, key, path, parseSocketId);

const readFiniteDimensions = (value: unknown, path: string): MeterDimensions => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["x", "y", "z"]);
  return {
    x: readPositiveFiniteNumber(readRequiredProperty(object, "x", path), dataPath(path, "x")),
    y: readPositiveFiniteNumber(readRequiredProperty(object, "y", path), dataPath(path, "y")),
    z: readPositiveFiniteNumber(readRequiredProperty(object, "z", path), dataPath(path, "z"))
  };
};

const readGridFootprint = (value: unknown, path: string): GridFootprint => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["x", "y", "z"]);
  return {
    x: readPositiveInteger(readRequiredProperty(object, "x", path), dataPath(path, "x")),
    y: readPositiveInteger(readRequiredProperty(object, "y", path), dataPath(path, "y")),
    z: readPositiveInteger(readRequiredProperty(object, "z", path), dataPath(path, "z"))
  };
};

const readOptionalExtensions = (
  object: Readonly<Record<string, unknown>>,
  path: string
): NamespacedExtensions | undefined => readOptional(object, "extensions", path, readNamespacedExtensions);

const readSocketArc = (value: unknown, path: string): SocketArcMetadata => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, SOCKET_ARC_FIELDS);
  const yawDegrees = readOptional(object, "yawDegrees", path, readFiniteNumber);
  const pitchDegrees = readOptional(object, "pitchDegrees", path, readFiniteNumber);
  const minimumRangeMeters = readOptional(object, "minimumRangeMeters", path, readNonNegativeFiniteNumber);
  const maximumRangeMeters = readOptional(object, "maximumRangeMeters", path, readNonNegativeFiniteNumber);

  if (minimumRangeMeters !== undefined && maximumRangeMeters !== undefined && maximumRangeMeters < minimumRangeMeters) {
    throw dataError(
      "OutOfRange",
      dataPath(path, "maximumRangeMeters"),
      "Maximum socket range must not be below the minimum range."
    );
  }

  return {
    ...(yawDegrees !== undefined ? { yawDegrees } : {}),
    ...(pitchDegrees !== undefined ? { pitchDegrees } : {}),
    ...(minimumRangeMeters !== undefined ? { minimumRangeMeters } : {}),
    ...(maximumRangeMeters !== undefined ? { maximumRangeMeters } : {})
  };
};

const readPartSocket = (
  value: unknown,
  path: string,
  categoryById: Readonly<Record<PartCategoryId, PartCategoryDefinition>>
): PartSocket => {
  const object = readPlainObject(value, path);
  const schemaVersion = readRequired(object, "schemaVersion", path, parseSocketSchemaVersion);
  assertAllowedFields(object, path, SOCKET_FIELDS);
  const socketId = readRequired(object, "socketId", path, parseSocketId);
  const socketType = readRequired(object, "socketType", path, readNonEmptyString) as SocketType;
  const localPosition = readRequired(object, "localPosition", path, readFiniteVector3) as SerializableVector3;
  const localRotation = readRequired(object, "localRotation", path, readNormalizedQuaternion);
  const role = readRequired(object, "role", path, (candidate, candidatePath) =>
    readEnum(candidate, candidatePath, SOCKET_ROLES, "Socket role")
  ) as SocketRole;
  const directionRole = readRequired(object, "directionRole", path, (candidate, candidatePath) =>
    readEnum(candidate, candidatePath, SOCKET_DIRECTION_ROLES, "Socket direction role")
  ) as SocketDirectionRole;
  const direction = readRequired(object, "direction", path, readFiniteVector3) as SerializableVector3;
  const compatibleCategoryIds = readRequired(object, "compatibleCategoryIds", path, (candidate, candidatePath) =>
    readCompatibleCategoryIds(candidate, candidatePath, categoryById)
  );
  const compatibleComponentKinds = readRequired(object, "compatibleComponentKinds", path, readSortedComponentKinds);
  const capacityClass = readRequired(object, "capacityClass", path, (candidate, candidatePath) =>
    readEnum(candidate, candidatePath, SOCKET_CAPACITY_CLASSES, "Socket capacity class")
  ) as SocketCapacityClass;
  const mountSide = readRequired(object, "mountSide", path, (candidate, candidatePath) =>
    readEnum(candidate, candidatePath, MOUNT_SIDES, "Mount side")
  ) as MountSide;
  const requiredForComponentIds = readRequired(object, "requiredForComponentIds", path, (candidate, candidatePath) =>
    readSortedStableIds(candidate, candidatePath, parseComponentId)
  );
  const compatibilityAliases = readRequired(object, "compatibilityAliases", path, (candidate, candidatePath) =>
    readSortedStringArray(candidate, candidatePath, true)
  );
  const arc = readOptional(object, "arc", path, readSocketArc);
  const vfxRole = readOptional(object, "vfxRole", path, readString);
  const excludedFromCameraBounds = readRequired(object, "excludedFromCameraBounds", path, readBoolean);
  const extensions = readOptionalExtensions(object, path);

  const socket: PartSocket = {
    socketId,
    schemaVersion,
    socketType,
    localPosition,
    localRotation,
    role,
    directionRole,
    direction,
    compatibleCategoryIds,
    compatibleComponentKinds,
    capacityClass,
    mountSide,
    requiredForComponentIds,
    compatibilityAliases,
    ...(arc !== undefined ? { arc } : {}),
    ...(vfxRole !== undefined ? { vfxRole } : {}),
    excludedFromCameraBounds,
    ...(extensions !== undefined ? { extensions } : {})
  };

  validateSocketSpatialData(socket, path);
  return socket;
};

interface SocketCandidate {
  readonly value: unknown;
  readonly socketId: SocketId;
}

const readSortedSockets = (
  value: unknown,
  path: string,
  categoryById: Readonly<Record<PartCategoryId, PartCategoryDefinition>>
): readonly PartSocket[] => {
  const candidates: SocketCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    readRequired(object, "schemaVersion", entryPath, parseSocketSchemaVersion);
    return {
      value: entry,
      socketId: parseSocketId(readRequiredProperty(object, "socketId", entryPath), dataPath(entryPath, "socketId"))
    };
  });

  candidates.sort((left, right) => compareText(left.socketId, right.socketId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].socketId === candidates[index].socketId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "socketId"), "Duplicate local socket ID.");
    }
  }

  return candidates.map((candidate, index) => readPartSocket(candidate.value, dataPath(path, index), categoryById));
};

const componentBase = <TKind extends ComponentKind>(
  object: Readonly<Record<string, unknown>>,
  path: string,
  kind: TKind,
  schemaVersion: ReturnType<typeof parseComponentSchemaVersion>
) => {
  const componentId = readRequired(object, "componentId", path, parseComponentId);
  const tags = readOptional(object, "tags", path, readSortedStringArray);
  const extensions = readOptionalExtensions(object, path);
  return {
    componentId,
    kind,
    schemaVersion,
    ...(tags !== undefined ? { tags } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };
};

const readNonNegative = (object: Readonly<Record<string, unknown>>, key: string, path: string): number =>
  readRequired(object, key, path, readNonNegativeFiniteNumber);

const readPositive = (object: Readonly<Record<string, unknown>>, key: string, path: string): number =>
  readRequired(object, key, path, readPositiveFiniteNumber);

const readComponent = (value: unknown, path: string): ShipBuilderComponent => {
  const object = readPlainObject(value, path);
  const schemaVersion = readRequired(object, "schemaVersion", path, parseComponentSchemaVersion);
  const kind = readRequired(object, "kind", path, readComponentKind);
  assertAllowedFields(object, path, [...COMPONENT_COMMON_FIELDS, ...COMPONENT_FIELDS_BY_KIND[kind]]);
  switch (kind) {
    case "ControlCore": {
      const controlSocketId = readRequiredSocketId(object, "controlSocketId", path);
      const cameraSocketId = readOptionalSocketId(object, "cameraSocketId", path);
      const seatCount = readRequired(object, "seatCount", path, readPositiveInteger);
      const controlRating = readNonNegative(object, "controlRating", path);
      const supportedControlModes = readRequired(object, "supportedControlModes", path, (candidate, candidatePath) =>
        sortUniqueStrings(
          readArray(candidate, candidatePath).map((entry, index) =>
            readEnum(entry, dataPath(candidatePath, index), CONTROL_MODES, "Control mode")
          )
        ) as readonly ("manual" | "assisted" | "autopilot")[]
      );
      return {
        ...componentBase(object, path, "ControlCore", schemaVersion),
        controlSocketId,
        ...(cameraSocketId !== undefined ? { cameraSocketId } : {}),
        seatCount,
        controlRating,
        supportedControlModes
      };
    }
    case "Structural":
      return {
        ...componentBase(object, path, "Structural", schemaVersion),
        structuralSocketIds: readRequired(object, "structuralSocketIds", path, (candidate, candidatePath) =>
          readSortedStableIds(candidate, candidatePath, parseSocketId)
        ),
        structuralRating: readNonNegative(object, "structuralRating", path)
      };
    case "MainThruster": {
      const gimbalDegrees = readOptional(object, "gimbalDegrees", path, readNonNegativeFiniteNumber);
      return {
        ...componentBase(object, path, "MainThruster", schemaVersion),
        nozzleSocketId: readRequiredSocketId(object, "nozzleSocketId", path),
        maximumThrustNewtons: readPositive(object, "maximumThrustNewtons", path),
        propellantBurnKilogramsPerSecond: readNonNegative(object, "propellantBurnKilogramsPerSecond", path),
        throttleResponseSeconds: readNonNegative(object, "throttleResponseSeconds", path),
        ...(gimbalDegrees !== undefined ? { gimbalDegrees } : {})
      };
    }
    case "RcsCluster":
      return {
        ...componentBase(object, path, "RcsCluster", schemaVersion),
        nozzleSocketIds: readRequired(object, "nozzleSocketIds", path, (candidate, candidatePath) =>
          readSortedStableIds(candidate, candidatePath, parseSocketId)
        ),
        thrustPerNozzleNewtons: readPositive(object, "thrustPerNozzleNewtons", path),
        propellantBurnKilogramsPerSecond: readNonNegative(object, "propellantBurnKilogramsPerSecond", path),
        translationAxes: readRequired(object, "translationAxes", path, (candidate, candidatePath) =>
          sortUniqueStrings(
            readArray(candidate, candidatePath).map((entry, index) =>
              readEnum(entry, dataPath(candidatePath, index), AXES, "Translation axis")
            )
          ) as readonly ("x" | "y" | "z")[]
        ),
        rotationAxes: readRequired(object, "rotationAxes", path, (candidate, candidatePath) =>
          sortUniqueStrings(
            readArray(candidate, candidatePath).map((entry, index) =>
              readEnum(entry, dataPath(candidatePath, index), AXES, "Rotation axis")
            )
          ) as readonly ("x" | "y" | "z")[]
        )
      };
    case "FuelTank": {
      const feedSocketIds = readOptional(object, "feedSocketIds", path, (candidate, candidatePath) =>
        readSortedStableIds(candidate, candidatePath, parseSocketId)
      );
      const fillSocketId = readOptionalSocketId(object, "fillSocketId", path);
      return {
        ...componentBase(object, path, "FuelTank", schemaVersion),
        capacityKilograms: readNonNegative(object, "capacityKilograms", path),
        fuelKind: readRequired(object, "fuelKind", path, readNonEmptyString),
        ...(feedSocketIds !== undefined ? { feedSocketIds } : {}),
        ...(fillSocketId !== undefined ? { fillSocketId } : {})
      };
    }
    case "CargoStorage": {
      const accessSocketId = readOptionalSocketId(object, "accessSocketId", path);
      return {
        ...componentBase(object, path, "CargoStorage", schemaVersion),
        cargoAttachSocketIds: readRequired(object, "cargoAttachSocketIds", path, (candidate, candidatePath) =>
          readSortedStableIds(candidate, candidatePath, parseSocketId)
        ),
        capacityCubicMeters: readNonNegative(object, "capacityCubicMeters", path),
        maximumPayloadKilograms: readNonNegative(object, "maximumPayloadKilograms", path),
        ...(accessSocketId !== undefined ? { accessSocketId } : {})
      };
    }
    case "FixedWeapon": {
      const muzzleFlashSocketId = readOptionalSocketId(object, "muzzleFlashSocketId", path);
      return {
        ...componentBase(object, path, "FixedWeapon", schemaVersion),
        hardpointSocketId: readRequiredSocketId(object, "hardpointSocketId", path),
        muzzleSocketId: readRequiredSocketId(object, "muzzleSocketId", path),
        ...(muzzleFlashSocketId !== undefined ? { muzzleFlashSocketId } : {}),
        damagePerShot: readNonNegative(object, "damagePerShot", path),
        projectileSpeedMetersPerSecond: readNonNegative(object, "projectileSpeedMetersPerSecond", path),
        rangeMeters: readNonNegative(object, "rangeMeters", path),
        rateOfFirePerSecond: readNonNegative(object, "rateOfFirePerSecond", path),
        recoilNewtons: readNonNegative(object, "recoilNewtons", path)
      };
    }
    case "TurretWeapon": {
      const muzzleFlashSocketId = readOptionalSocketId(object, "muzzleFlashSocketId", path);
      return {
        ...componentBase(object, path, "TurretWeapon", schemaVersion),
        turretBaseSocketId: readRequiredSocketId(object, "turretBaseSocketId", path),
        yawPivotSocketId: readRequiredSocketId(object, "yawPivotSocketId", path),
        pitchPivotSocketId: readRequiredSocketId(object, "pitchPivotSocketId", path),
        muzzleSocketId: readRequiredSocketId(object, "muzzleSocketId", path),
        ...(muzzleFlashSocketId !== undefined ? { muzzleFlashSocketId } : {}),
        damagePerShot: readNonNegative(object, "damagePerShot", path),
        projectileSpeedMetersPerSecond: readNonNegative(object, "projectileSpeedMetersPerSecond", path),
        rangeMeters: readNonNegative(object, "rangeMeters", path),
        rateOfFirePerSecond: readNonNegative(object, "rateOfFirePerSecond", path),
        recoilNewtons: readNonNegative(object, "recoilNewtons", path)
      };
    }
    case "SensorUtility":
      return {
        ...componentBase(object, path, "SensorUtility", schemaVersion),
        mountSocketId: readRequiredSocketId(object, "mountSocketId", path),
        rangeMeters: readNonNegative(object, "rangeMeters", path),
        scanRatePerSecond: readNonNegative(object, "scanRatePerSecond", path),
        sensorRating: readNonNegative(object, "sensorRating", path)
      };
    case "DockingConnector":
      return {
        ...componentBase(object, path, "DockingConnector", schemaVersion),
        connectorSocketId: readRequiredSocketId(object, "connectorSocketId", path),
        dockingRating: readNonNegative(object, "dockingRating", path),
        maximumApproachSpeedMetersPerSecond: readNonNegative(object, "maximumApproachSpeedMetersPerSecond", path)
      };
    case "Armor":
      return {
        ...componentBase(object, path, "Armor", schemaVersion),
        armorRating: readNonNegative(object, "armorRating", path),
        coverageFraction: readRequired(object, "coverageFraction", path, (candidate, candidatePath) =>
          readFiniteNumber(candidate, candidatePath, { minimum: 0, maximum: 1 })
        ),
        addedMassKilograms: readNonNegative(object, "addedMassKilograms", path)
      };
    case "PowerHeatReserved":
      return {
        ...componentBase(object, path, "PowerHeatReserved", schemaVersion),
        reservedPowerWatts: readNonNegative(object, "reservedPowerWatts", path),
        reservedHeatWatts: readNonNegative(object, "reservedHeatWatts", path),
        reservationReason: readRequired(object, "reservationReason", path, readNonEmptyString)
      };
  }
};

interface ComponentCandidate {
  readonly value: unknown;
  readonly componentId: ComponentId;
}

const readSortedComponents = (value: unknown, path: string): readonly ShipBuilderComponent[] => {
  const candidates: ComponentCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    readRequired(object, "schemaVersion", entryPath, parseComponentSchemaVersion);
    return {
      value: entry,
      componentId: parseComponentId(readRequiredProperty(object, "componentId", entryPath), dataPath(entryPath, "componentId"))
    };
  });

  candidates.sort((left, right) => compareText(left.componentId, right.componentId));
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index - 1].componentId === candidates[index].componentId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "componentId"), "Duplicate local component ID.");
    }
  }

  return candidates.map((candidate, index) => readComponent(candidate.value, dataPath(path, index)));
};

const readBuildCostReference = (value: unknown, path: string): BuildCostReference => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, BUILD_COST_REFERENCE_FIELDS);
  const resourceId = readRequired(object, "resourceId", path, readNonEmptyString);
  const quantity = readRequired(object, "quantity", path, readNonNegativeFiniteNumber);
  const extensions = readOptionalExtensions(object, path);
  return { resourceId, quantity, ...(extensions !== undefined ? { extensions } : {}) };
};

const readSortedBuildCostReferences = (value: unknown, path: string): readonly BuildCostReference[] => {
  const costs = readArray(value, path).map((entry, index) => readBuildCostReference(entry, dataPath(path, index)));
  costs.sort((left, right) => compareText(left.resourceId, right.resourceId));
  for (let index = 1; index < costs.length; index += 1) {
    if (costs[index - 1].resourceId === costs[index].resourceId) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "resourceId"), "Duplicate build-cost resource ID.");
    }
  }
  return costs;
};

const readPartAssetReference = (value: unknown, path: string): PartAssetReference => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ASSET_REFERENCE_FIELDS);
  const assetId = readRequired(object, "assetId", path, readNonEmptyString);
  const variantId = readOptional(object, "variantId", path, readNonEmptyString);
  const extensions = readOptionalExtensions(object, path);
  return {
    assetId,
    ...(variantId !== undefined ? { variantId } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };
};

const readPartDefinition = (
  value: unknown,
  path: string,
  categoryById: Readonly<Record<PartCategoryId, PartCategoryDefinition>>
): PartDefinition => {
  const object = readPlainObject(value, path);
  const schemaVersion = readRequired(object, "schemaVersion", path, parsePartDefinitionSchemaVersion);
  assertAllowedFields(object, path, PART_DEFINITION_FIELDS);
  const partDefinitionId = readRequired(object, "partDefinitionId", path, parsePartDefinitionId);
  const displayName = readRequired(object, "displayName", path, readNonEmptyString);
  const description = readRequired(object, "description", path, readString);
  const categoryId = readRequired(object, "categoryId", path, parsePartCategoryId);
  const tags = readRequired(object, "tags", path, readSortedStringArray);
  const dimensionsMeters = readRequired(object, "dimensionsMeters", path, readFiniteDimensions);
  const gridFootprint = readRequired(object, "gridFootprint", path, readGridFootprint);
  const dryMassKilograms = readRequired(object, "dryMassKilograms", path, readNonNegativeFiniteNumber);
  const allowedMountSides = readRequired(object, "allowedMountSides", path, (candidate, candidatePath) =>
    sortUniqueStrings(
      readArray(candidate, candidatePath).map((entry, index) =>
        readEnum(entry, dataPath(candidatePath, index), MOUNT_SIDES, "Mount side")
      )
    ) as readonly MountSide[]
  );
  const sockets = readRequired(object, "sockets", path, (candidate, candidatePath) =>
    readSortedSockets(candidate, candidatePath, categoryById)
  );
  const components = readRequired(object, "components", path, readSortedComponents);
  const buildCostReferences = readOptional(object, "buildCostReferences", path, readSortedBuildCostReferences);
  const visualReference = readOptional(object, "visualReference", path, readPartAssetReference);
  const colliderReference = readOptional(object, "colliderReference", path, readPartAssetReference);
  const variantGroupId = readOptional(object, "variantGroupId", path, readNonEmptyString);
  const balanceTier = readOptional(object, "balanceTier", path, readNonEmptyString);
  const extensions = readOptionalExtensions(object, path);

  validateLocalSocketReferences(sockets, components, dataPath(path, "sockets"), dataPath(path, "components"));

  return {
    partDefinitionId,
    schemaVersion,
    displayName,
    description,
    categoryId,
    tags,
    dimensionsMeters,
    gridFootprint,
    dryMassKilograms,
    allowedMountSides,
    sockets,
    components,
    ...(buildCostReferences !== undefined ? { buildCostReferences } : {}),
    ...(visualReference !== undefined ? { visualReference } : {}),
    ...(colliderReference !== undefined ? { colliderReference } : {}),
    ...(variantGroupId !== undefined ? { variantGroupId } : {}),
    ...(balanceTier !== undefined ? { balanceTier } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };
};

const readPartCategoryDefinition = (value: unknown, path: string): PartCategoryDefinition => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, CATEGORY_FIELDS);
  const categoryId = readRequired(object, "categoryId", path, parsePartCategoryId);
  const displayNameKey = readOptional(object, "displayNameKey", path, readNonEmptyString);
  const displayNameFallback = readOptional(object, "displayNameFallback", path, readNonEmptyString);
  const descriptionKey = readOptional(object, "descriptionKey", path, readNonEmptyString);
  const descriptionFallback = readOptional(object, "descriptionFallback", path, readString);

  if (displayNameKey === undefined && displayNameFallback === undefined) {
    throw dataError("MissingRequiredField", dataPath(path, "displayNameFallback"), "A category display name key or fallback is required.");
  }
  if (descriptionKey === undefined && descriptionFallback === undefined) {
    throw dataError("MissingRequiredField", dataPath(path, "descriptionFallback"), "A category description key or fallback is required.");
  }

  const sortOrder = readRequired(object, "sortOrder", path, readFiniteNumber);
  const presentationKey = readOptional(object, "presentationKey", path, readNonEmptyString);
  const paletteTags = readRequired(object, "paletteTags", path, (candidate, candidatePath) =>
    readSortedStringArray(candidate, candidatePath, true)
  );
  const requiredSystemRole = readOptional(object, "requiredSystemRole", path, readNonEmptyString);
  const allowedComponentKinds = readOptional(object, "allowedComponentKinds", path, readSortedComponentKinds);
  const recommendedComponentKinds = readOptional(object, "recommendedComponentKinds", path, readSortedComponentKinds);
  const extensions = readOptionalExtensions(object, path);

  return {
    categoryId,
    ...(displayNameKey !== undefined ? { displayNameKey } : {}),
    ...(displayNameFallback !== undefined ? { displayNameFallback } : {}),
    ...(descriptionKey !== undefined ? { descriptionKey } : {}),
    ...(descriptionFallback !== undefined ? { descriptionFallback } : {}),
    sortOrder,
    ...(presentationKey !== undefined ? { presentationKey } : {}),
    paletteTags,
    ...(requiredSystemRole !== undefined ? { requiredSystemRole } : {}),
    ...(allowedComponentKinds !== undefined ? { allowedComponentKinds } : {}),
    ...(recommendedComponentKinds !== undefined ? { recommendedComponentKinds } : {}),
    ...(extensions !== undefined ? { extensions } : {})
  };
};

interface CategoryCandidate {
  readonly value: unknown;
  readonly categoryId: PartCategoryId;
  readonly sortOrder: number;
}

const readSortedCategories = (value: unknown, path: string): readonly PartCategoryDefinition[] => {
  const candidates: CategoryCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    return {
      value: entry,
      categoryId: parsePartCategoryId(readRequiredProperty(object, "categoryId", entryPath), dataPath(entryPath, "categoryId")),
      sortOrder: readFiniteNumber(readRequiredProperty(object, "sortOrder", entryPath), dataPath(entryPath, "sortOrder"))
    };
  });

  candidates.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return compareText(left.categoryId, right.categoryId);
  });

  const seenCategoryIds = new Set<PartCategoryId>();
  for (let index = 0; index < candidates.length; index += 1) {
    if (seenCategoryIds.has(candidates[index].categoryId)) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "categoryId"), "Duplicate category ID.");
    }
    seenCategoryIds.add(candidates[index].categoryId);
  }

  return candidates.map((candidate, index) => readPartCategoryDefinition(candidate.value, dataPath(path, index)));
};

interface PartDefinitionCandidate {
  readonly value: unknown;
  readonly partDefinitionId: PartDefinitionId;
  readonly categoryId: PartCategoryId;
}

const readSortedPartDefinitions = (
  value: unknown,
  path: string,
  categories: readonly PartCategoryDefinition[]
): readonly PartDefinition[] => {
  const categoryById: Record<PartCategoryId, PartCategoryDefinition> = Object.create(null) as Record<
    PartCategoryId,
    PartCategoryDefinition
  >;
  for (const category of categories) {
    categoryById[category.categoryId] = category;
  }

  const candidates: PartDefinitionCandidate[] = readArray(value, path).map((entry, index) => {
    const entryPath = dataPath(path, index);
    const object = readPlainObject(entry, entryPath);
    readRequired(object, "schemaVersion", entryPath, parsePartDefinitionSchemaVersion);
    return {
      value: entry,
      partDefinitionId: parsePartDefinitionId(
        readRequiredProperty(object, "partDefinitionId", entryPath),
        dataPath(entryPath, "partDefinitionId")
      ),
      categoryId: parsePartCategoryId(readRequiredProperty(object, "categoryId", entryPath), dataPath(entryPath, "categoryId"))
    };
  });

  candidates.sort((left, right) => {
    const leftCategory = categoryById[left.categoryId];
    const rightCategory = categoryById[right.categoryId];
    if (leftCategory !== undefined && rightCategory !== undefined) {
      const categoryComparison = comparePartCategories(leftCategory, rightCategory);
      if (categoryComparison !== 0) {
        return categoryComparison;
      }
    } else if (leftCategory !== undefined) {
      return -1;
    } else if (rightCategory !== undefined) {
      return 1;
    } else {
      const categoryComparison = compareText(left.categoryId, right.categoryId);
      if (categoryComparison !== 0) {
        return categoryComparison;
      }
    }
    return compareText(left.partDefinitionId, right.partDefinitionId);
  });

  const seenPartDefinitionIds = new Set<PartDefinitionId>();
  for (let index = 0; index < candidates.length; index += 1) {
    if (seenPartDefinitionIds.has(candidates[index].partDefinitionId)) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "partDefinitionId"), "Duplicate part definition ID.");
    }
    seenPartDefinitionIds.add(candidates[index].partDefinitionId);
  }

  return candidates.map((candidate, index) => {
    if (categoryById[candidate.categoryId] === undefined) {
      throw dataError("UnknownCategory", dataPath(dataPath(path, index), "categoryId"), "Part category does not exist in this catalog.");
    }
    return readPartDefinition(candidate.value, dataPath(path, index), categoryById);
  });
};

/**
 * Validates unknown input and produces the canonical serializable catalog
 * document. It is intentionally independent from derived snapshot indexes.
 */
export const readShipPartCatalogDocument = (value: unknown, path = ""): ShipPartCatalogDocument => {
  const object = readPlainObject(value, path);
  const schemaVersion = readRequired(object, "schemaVersion", path, parseCatalogSchemaVersion);
  assertAllowedFields(object, path, CATALOG_FIELDS);
  const catalogId = readRequired(object, "catalogId", path, parseCatalogId);
  const catalogVersion = readRequired(object, "catalogVersion", path, parseCatalogVersion);
  const categories = readSortedCategories(readRequiredProperty(object, "categories", path), dataPath(path, "categories"));
  const partDefinitions = readSortedPartDefinitions(
    readRequiredProperty(object, "partDefinitions", path),
    dataPath(path, "partDefinitions"),
    categories
  );
  const extensions = readOptionalExtensions(object, path);

  return {
    catalogId,
    catalogVersion,
    schemaVersion,
    categories,
    partDefinitions,
    ...(extensions !== undefined ? { extensions } : {})
  };
};

const createIndexes = (
  categories: readonly PartCategoryDefinition[],
  partDefinitions: readonly PartDefinition[]
): ShipPartCatalogIndexes => {
  const partById: Record<PartDefinitionId, PartDefinition> = Object.create(null) as Record<PartDefinitionId, PartDefinition>;
  const categoryById: Record<PartCategoryId, PartCategoryDefinition> = Object.create(null) as Record<
    PartCategoryId,
    PartCategoryDefinition
  >;
  const partsByCategory: Record<PartCategoryId, PartDefinition[]> = Object.create(null) as Record<
    PartCategoryId,
    PartDefinition[]
  >;
  const partsByComponentKind: Partial<Record<ComponentKind, PartDefinition[]>> = Object.create(null) as Partial<
    Record<ComponentKind, PartDefinition[]>
  >;
  const partsByTag: Record<string, PartDefinition[]> = Object.create(null) as Record<string, PartDefinition[]>;

  for (const category of categories) {
    categoryById[category.categoryId] = category;
    partsByCategory[category.categoryId] = [];
  }

  for (const part of partDefinitions) {
    partById[part.partDefinitionId] = part;
    partsByCategory[part.categoryId].push(part);

    const kindsOnPart = new Set<ComponentKind>();
    for (const component of part.components) {
      kindsOnPart.add(component.kind);
    }
    for (const kind of [...kindsOnPart].sort(compareText)) {
      const indexedParts = partsByComponentKind[kind] ?? [];
      indexedParts.push(part);
      partsByComponentKind[kind] = indexedParts;
    }

    for (const tag of part.tags) {
      const indexedParts = partsByTag[tag] ?? [];
      indexedParts.push(part);
      partsByTag[tag] = indexedParts;
    }
  }

  const orderRecord = <TValue>(record: Readonly<Record<string, TValue>>): Record<string, TValue> => {
    const ordered: Record<string, TValue> = Object.create(null) as Record<string, TValue>;
    for (const key of Object.keys(record).sort(compareText)) {
      ordered[key] = record[key];
    }
    return ordered;
  };

  return deepFreeze({
    partById: orderRecord(partById),
    categoryById: orderRecord(categoryById),
    partsByCategory: orderRecord(partsByCategory),
    partsByComponentKind: orderRecord(partsByComponentKind),
    partsByTag: orderRecord(partsByTag)
  }) as ShipPartCatalogIndexes;
};

const createSummary = (
  categories: readonly PartCategoryDefinition[],
  partDefinitions: readonly PartDefinition[]
): ShipPartCatalogSummary =>
  deepFreeze({
    categoryCount: categories.length,
    partDefinitionCount: partDefinitions.length,
    componentCount: partDefinitions.reduce((count, part) => count + part.components.length, 0),
    socketCount: partDefinitions.reduce((count, part) => count + part.sockets.length, 0)
  }) as ShipPartCatalogSummary;

/** Returns only persisted catalog data, never generated indexes, summary, or signature. */
export const catalogDocumentForSerialization = (
  catalog: Pick<ShipPartCatalogSnapshot, "catalogId" | "catalogVersion" | "schemaVersion" | "categories" | "partDefinitions" | "extensions">
): ShipPartCatalogDocument => ({
  catalogId: catalog.catalogId,
  catalogVersion: catalog.catalogVersion,
  schemaVersion: catalog.schemaVersion,
  categories: catalog.categories,
  partDefinitions: catalog.partDefinitions,
  ...(catalog.extensions !== undefined ? { extensions: catalog.extensions } : {})
});

export const canonicalShipPartCatalogJson = (catalog: ShipPartCatalogSnapshot): string =>
  canonicalJsonStringify(catalogDocumentForSerialization(catalog));

/** Builds a deeply immutable snapshot with deterministic generated record/array indexes. */
export const createShipPartCatalogSnapshot = (input: unknown): ShipPartCatalogSnapshot => {
  const document = readShipPartCatalogDocument(input);
  const immutableDocument = deepFreeze(document) as ShipPartCatalogDocument;
  const signature = canonicalJsonHash(catalogDocumentForSerialization(immutableDocument));
  const summary = createSummary(immutableDocument.categories, immutableDocument.partDefinitions);
  const indexes = createIndexes(immutableDocument.categories, immutableDocument.partDefinitions);

  return deepFreeze({
    ...immutableDocument,
    summary,
    signature,
    indexes
  }) as ShipPartCatalogSnapshot;
};

/** The catalog signature hashes only canonical persisted catalog data. */
export const shipPartCatalogSignature = (catalog: ShipPartCatalogSnapshot): string =>
  canonicalJsonHash(catalogDocumentForSerialization(catalog));
