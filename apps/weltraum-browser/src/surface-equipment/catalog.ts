import { DAMAGE_TYPES, type DamageType } from "../combat";
import { createInteractionCapabilityId, type InteractionCapabilityId } from "../interaction";
import { createResourceRequirement, type ResourceRequirement } from "../resources";
import { createSuitInterfaceId, type SuitInterfaceId } from "../suit";
import { cloneAndFreezeSurfaceEquipmentValue, createSurfaceEquipmentSignature } from "./canonical";
import {
  SURFACE_EQUIPMENT_SCHEMA_VERSION,
  createSurfaceEquipmentBlueprintId,
  createSurfaceEquipmentCalibrationId,
  createSurfaceEquipmentCalibrationOptionId,
  createSurfaceEquipmentCatalogId,
  createSurfaceEquipmentCatalogVersion,
  createSurfaceEquipmentCommandId,
  createSurfaceEquipmentLegalClassId,
  createSurfaceEquipmentModuleId,
  createSurfaceEquipmentModuleInstanceId,
  createSurfaceEquipmentModuleVersion,
  createSurfaceEquipmentRevision,
  createSurfaceEquipmentSlotId,
  createSurfaceEquipmentSlotTypeId,
  createSurfaceEquipmentTagId,
  type SurfaceEquipmentCalibrationId,
  type SurfaceEquipmentCalibrationOptionId,
  type SurfaceEquipmentModuleInstanceId,
  type SurfaceEquipmentSlotId,
  type SurfaceEquipmentSlotTypeId
} from "./ids";
import {
  SURFACE_EQUIPMENT_CAPACITY_KINDS,
  SURFACE_EQUIPMENT_CATEGORIES,
  SURFACE_EQUIPMENT_DELIVERY_CLASSES,
  SURFACE_EQUIPMENT_LEGAL_CLASSES,
  SURFACE_EQUIPMENT_MODULE_ROLES,
  type SurfaceEquipmentBalanceMetadata,
  type SurfaceEquipmentBlueprint,
  type SurfaceEquipmentCalibrationChoice,
  type SurfaceEquipmentCalibrationDefinition,
  type SurfaceEquipmentCalibrationOptionDefinition,
  type SurfaceEquipmentCapacity,
  type SurfaceEquipmentCatalog,
  type SurfaceEquipmentDisplayMetadata,
  type SurfaceEquipmentLegalMetadata,
  type SurfaceEquipmentModuleDefinition,
  type SurfaceEquipmentModuleInstance,
  type SurfaceEquipmentSafetyMetadata,
  type SurfaceEquipmentSlotAssignment,
  type SurfaceEquipmentSlotDefinition
} from "./types";
import {
  assertSurfaceEquipmentFields,
  compareSurfaceEquipmentText,
  readSurfaceEquipmentArray,
  readSurfaceEquipmentBoolean,
  readSurfaceEquipmentEnum,
  readSurfaceEquipmentNonEmptyString,
  readSurfaceEquipmentRecord,
  readSurfaceEquipmentRequired,
  readSurfaceEquipmentSafeInteger,
  rejectSurfaceEquipmentDuplicates,
  surfaceEquipmentDataError,
  surfaceEquipmentDataPath
} from "./validation";

export interface SurfaceEquipmentDisplayMetadataInput {
  readonly displayName: string;
  readonly description: string;
}

export interface SurfaceEquipmentCalibrationOptionDefinitionInput {
  readonly optionId: string;
  readonly order: number;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
}

export interface SurfaceEquipmentCalibrationDefinitionInput {
  readonly calibrationId: string;
  readonly order: number;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
  readonly defaultOptionId: string;
  readonly options: readonly SurfaceEquipmentCalibrationOptionDefinitionInput[];
}

export interface SurfaceEquipmentSlotDefinitionInput {
  readonly slotId: string;
  readonly order: number;
  readonly slotTypeId: string;
  readonly required: boolean;
  readonly exactCount: number;
  readonly allowedRoles: readonly string[];
  readonly allowedTags: readonly string[];
  readonly excludedTags: readonly string[];
  readonly requiredSuitInterfaces: readonly SuitInterfaceId[];
  readonly maximumMassGrams: number;
  readonly maximumBulkMicroUnits: number;
  readonly parentSlotId?: string;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
}

export interface SurfaceEquipmentModuleDefinitionInput {
  readonly moduleId: string;
  readonly moduleVersion: number;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
  readonly primaryRole: string;
  readonly tags: readonly string[];
  readonly massGrams: number;
  readonly bulkMicroUnits: number;
  readonly continuousPowerMilliwatts: number;
  readonly pulseEnergyMillijoules: number;
  readonly heatPerActionMillijoules: number;
  readonly activeThermalLoadMilliwatts: number;
  readonly passiveDissipationMilliwatts: number;
  readonly compatibleSlotTypeIds: readonly string[];
  readonly interactionCapabilities: readonly InteractionCapabilityId[];
  readonly requiredSuitInterfaces: readonly SuitInterfaceId[];
  readonly resourceRequirements: readonly ResourceRequirement[];
  readonly damageType?: DamageType;
  readonly deliveryClass?: string;
  readonly rangeMillimeters?: number;
  readonly cycleTicks?: number;
  readonly capacity?: { readonly kind: string; readonly units: number };
  readonly calibrationDefinitions?: readonly SurfaceEquipmentCalibrationDefinitionInput[];
  readonly safetyMetadata: { readonly interlockRequired: boolean; readonly certified: boolean };
  readonly legalMetadata: { readonly legalClassId: string; readonly legalClass: string };
  readonly balanceMetadata: { readonly tier: "provisional-v0"; readonly rationale: string };
}

export interface SurfaceEquipmentCatalogInput {
  readonly catalogId: string;
  readonly catalogVersion: number;
  readonly schemaVersion: 1;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
  readonly slots: readonly SurfaceEquipmentSlotDefinitionInput[];
  readonly modules: readonly SurfaceEquipmentModuleDefinitionInput[];
}

export interface SurfaceEquipmentBlueprintInput {
  readonly blueprintId: string;
  readonly catalogId: string;
  readonly catalogVersion: number;
  readonly revision: number;
  readonly category: string;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadataInput;
  readonly slotAssignments: readonly { readonly slotId: string; readonly moduleInstanceIds: readonly string[] }[];
  readonly moduleInstances: readonly { readonly moduleInstanceId: string; readonly moduleId: string }[];
  readonly calibrationChoices?: readonly {
    readonly moduleInstanceId: string;
    readonly calibrationId: string;
    readonly optionId: string;
  }[];
  readonly tags?: readonly string[];
  readonly processedCommandIds?: readonly string[];
}

const required = <T>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  reader: (value: unknown, valuePath: string) => T
): T => reader(readSurfaceEquipmentRequired(object, key, path), surfaceEquipmentDataPath(path, key));

const optional = <T>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  reader: (value: unknown, valuePath: string) => T
): T | undefined => Object.hasOwn(object, key) ? reader(object[key], surfaceEquipmentDataPath(path, key)) : undefined;

const readDisplayMetadata = (value: unknown, path: string): SurfaceEquipmentDisplayMetadata => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["displayName", "description"]);
  return {
    displayName: required(object, "displayName", path, readSurfaceEquipmentNonEmptyString),
    description: required(object, "description", path, readSurfaceEquipmentNonEmptyString)
  };
};

const sortedUnique = <T extends string>(
  value: unknown,
  path: string,
  reader: (entry: unknown, entryPath: string) => T,
  label: string
): readonly T[] => {
  const result = readSurfaceEquipmentArray(value, path).map((entry, index) =>
    reader(entry, surfaceEquipmentDataPath(path, index))
  );
  rejectSurfaceEquipmentDuplicates(result, path, label);
  return result.slice().sort(compareSurfaceEquipmentText);
};

const readTags = (value: unknown, path: string) =>
  sortedUnique(value, path, createSurfaceEquipmentTagId, "Tag ID");

const readSuitInterfaces = (value: unknown, path: string): readonly SuitInterfaceId[] =>
  sortedUnique(value, path, createSuitInterfaceId, "Suit interface ID");

const readCompatibleSlotTypes = (value: unknown, path: string): readonly SurfaceEquipmentSlotTypeId[] =>
  sortedUnique(value, path, createSurfaceEquipmentSlotTypeId, "Compatible slot type ID");

const readInteractionCapabilities = (value: unknown, path: string): readonly InteractionCapabilityId[] =>
  sortedUnique(value, path, createInteractionCapabilityId, "Interaction capability ID");

const readCalibrationOption = (value: unknown, path: string): SurfaceEquipmentCalibrationOptionDefinition => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["optionId", "order", "displayMetadata"]);
  return {
    optionId: required(object, "optionId", path, createSurfaceEquipmentCalibrationOptionId),
    order: required(object, "order", path, readSurfaceEquipmentSafeInteger),
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata)
  };
};

const readCalibrationDefinition = (value: unknown, path: string): SurfaceEquipmentCalibrationDefinition => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["calibrationId", "order", "displayMetadata", "defaultOptionId", "options"]);
  const options = required(object, "options", path, readSurfaceEquipmentArray)
    .map((entry, index) => readCalibrationOption(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "options"), index)))
    .sort((left, right) => left.order - right.order || compareSurfaceEquipmentText(left.optionId, right.optionId));
  rejectSurfaceEquipmentDuplicates(options.map((entry) => entry.optionId), surfaceEquipmentDataPath(path, "options"), "Option ID");
  if (options.length === 0) {
    throw surfaceEquipmentDataError("InvalidValue", surfaceEquipmentDataPath(path, "options"), "Calibration requires options.");
  }
  const defaultOptionId = required(object, "defaultOptionId", path, createSurfaceEquipmentCalibrationOptionId);
  if (!options.some((entry) => entry.optionId === defaultOptionId)) {
    throw surfaceEquipmentDataError("UnknownReference", surfaceEquipmentDataPath(path, "defaultOptionId"), "Unknown default option.");
  }
  return {
    calibrationId: required(object, "calibrationId", path, createSurfaceEquipmentCalibrationId),
    order: required(object, "order", path, readSurfaceEquipmentSafeInteger),
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata),
    defaultOptionId,
    options
  };
};

const calibrationDefinitionSignaturePayload = (definition: SurfaceEquipmentCalibrationDefinition) => ({
  calibrationId: definition.calibrationId,
  order: definition.order,
  defaultOptionId: definition.defaultOptionId,
  options: definition.options.map((option) => ({ optionId: option.optionId, order: option.order }))
});

const slotSignaturePayload = (slot: SurfaceEquipmentSlotDefinition) => ({
  slotId: slot.slotId,
  order: slot.order,
  slotTypeId: slot.slotTypeId,
  required: slot.required,
  exactCount: slot.exactCount,
  allowedRoles: slot.allowedRoles,
  allowedTags: slot.allowedTags,
  excludedTags: slot.excludedTags,
  requiredSuitInterfaces: slot.requiredSuitInterfaces,
  maximumMassGrams: slot.maximumMassGrams,
  maximumBulkMicroUnits: slot.maximumBulkMicroUnits,
  ...(slot.parentSlotId === undefined ? {} : { parentSlotId: slot.parentSlotId })
});

export const createSurfaceEquipmentSlotDefinition = (input: unknown, path = "/slot"): SurfaceEquipmentSlotDefinition => {
  const cloned = cloneAndFreezeSurfaceEquipmentValue(input);
  const object = readSurfaceEquipmentRecord(cloned, path);
  assertSurfaceEquipmentFields(object, path, [
    "slotId", "order", "slotTypeId", "required", "exactCount", "allowedRoles", "allowedTags", "excludedTags",
    "requiredSuitInterfaces", "maximumMassGrams", "maximumBulkMicroUnits", "parentSlotId", "displayMetadata"
  ]);
  const allowedTags = required(object, "allowedTags", path, readTags);
  const excludedTags = required(object, "excludedTags", path, readTags);
  if (allowedTags.some((tag) => excludedTags.includes(tag))) {
    throw surfaceEquipmentDataError("InvalidValue", surfaceEquipmentDataPath(path, "excludedTags"), "Allowed and excluded tags overlap.");
  }
  const requiredFlag = required(object, "required", path, readSurfaceEquipmentBoolean);
  const exactCount = required(object, "exactCount", path, (value, valuePath) =>
    readSurfaceEquipmentSafeInteger(value, valuePath, 0, false)
  );
  const parentSlotId = optional(object, "parentSlotId", path, createSurfaceEquipmentSlotId);
  return cloneAndFreezeSurfaceEquipmentValue({
    slotId: required(object, "slotId", path, createSurfaceEquipmentSlotId),
    order: required(object, "order", path, readSurfaceEquipmentSafeInteger),
    slotTypeId: required(object, "slotTypeId", path, createSurfaceEquipmentSlotTypeId),
    required: requiredFlag,
    exactCount,
    allowedRoles: sortedUnique(
      readSurfaceEquipmentRequired(object, "allowedRoles", path),
      surfaceEquipmentDataPath(path, "allowedRoles"),
      (value, valuePath) => readSurfaceEquipmentEnum(value, SURFACE_EQUIPMENT_MODULE_ROLES, valuePath),
      "Module role"
    ),
    allowedTags,
    excludedTags,
    requiredSuitInterfaces: required(object, "requiredSuitInterfaces", path, readSuitInterfaces),
    maximumMassGrams: required(object, "maximumMassGrams", path, readSurfaceEquipmentSafeInteger),
    maximumBulkMicroUnits: required(object, "maximumBulkMicroUnits", path, readSurfaceEquipmentSafeInteger),
    ...(parentSlotId === undefined ? {} : { parentSlotId }),
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata)
  }) as SurfaceEquipmentSlotDefinition;
};

const readResourceRequirements = (value: unknown, path: string): readonly ResourceRequirement[] => {
  const requirements = readSurfaceEquipmentArray(value, path).map((entry, index) => {
    const entryPath = surfaceEquipmentDataPath(path, index);
    const object = readSurfaceEquipmentRecord(entry, entryPath);
    assertSurfaceEquipmentFields(object, entryPath, ["resourceId", "quantity"]);
    return createResourceRequirement(object);
  }).sort((left, right) => compareSurfaceEquipmentText(left.resourceId, right.resourceId));
  rejectSurfaceEquipmentDuplicates(requirements.map((entry) => entry.resourceId), path, "Resource ID");
  return requirements;
};

const readSafetyMetadata = (value: unknown, path: string): SurfaceEquipmentSafetyMetadata => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["interlockRequired", "certified"]);
  return {
    interlockRequired: required(object, "interlockRequired", path, readSurfaceEquipmentBoolean),
    certified: required(object, "certified", path, readSurfaceEquipmentBoolean)
  };
};

const readLegalMetadata = (value: unknown, path: string): SurfaceEquipmentLegalMetadata => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["legalClassId", "legalClass"]);
  const legalClass = required(object, "legalClass", path, (entry, entryPath) =>
    readSurfaceEquipmentEnum(entry, SURFACE_EQUIPMENT_LEGAL_CLASSES, entryPath)
  );
  const legalClassId = required(object, "legalClassId", path, createSurfaceEquipmentLegalClassId);
  return { legalClassId, legalClass };
};

const readBalanceMetadata = (value: unknown, path: string): SurfaceEquipmentBalanceMetadata => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["tier", "rationale"]);
  const tier = required(object, "tier", path, readSurfaceEquipmentNonEmptyString);
  if (tier !== "provisional-v0") {
    throw surfaceEquipmentDataError("InvalidValue", surfaceEquipmentDataPath(path, "tier"), "V1 balance tier must be provisional-v0.");
  }
  return { tier, rationale: required(object, "rationale", path, readSurfaceEquipmentNonEmptyString) };
};

const readCapacity = (value: unknown, path: string): SurfaceEquipmentCapacity => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["kind", "units"]);
  return {
    kind: required(object, "kind", path, (entry, entryPath) =>
      readSurfaceEquipmentEnum(entry, SURFACE_EQUIPMENT_CAPACITY_KINDS, entryPath)
    ),
    units: required(object, "units", path, readSurfaceEquipmentSafeInteger)
  };
};

export const surfaceEquipmentModuleContentPayload = (module: SurfaceEquipmentModuleDefinition) => ({
  moduleId: module.moduleId,
  moduleVersion: module.moduleVersion,
  primaryRole: module.primaryRole,
  tags: module.tags,
  massGrams: module.massGrams,
  bulkMicroUnits: module.bulkMicroUnits,
  continuousPowerMilliwatts: module.continuousPowerMilliwatts,
  pulseEnergyMillijoules: module.pulseEnergyMillijoules,
  heatPerActionMillijoules: module.heatPerActionMillijoules,
  activeThermalLoadMilliwatts: module.activeThermalLoadMilliwatts,
  passiveDissipationMilliwatts: module.passiveDissipationMilliwatts,
  compatibleSlotTypeIds: module.compatibleSlotTypeIds,
  interactionCapabilities: module.interactionCapabilities,
  requiredSuitInterfaces: module.requiredSuitInterfaces,
  resourceRequirements: module.resourceRequirements,
  ...(module.damageType === undefined ? {} : { damageType: module.damageType }),
  ...(module.deliveryClass === undefined ? {} : { deliveryClass: module.deliveryClass }),
  ...(module.rangeMillimeters === undefined ? {} : { rangeMillimeters: module.rangeMillimeters }),
  ...(module.cycleTicks === undefined ? {} : { cycleTicks: module.cycleTicks }),
  ...(module.capacity === undefined ? {} : { capacity: module.capacity }),
  calibrationDefinitions: module.calibrationDefinitions.map(calibrationDefinitionSignaturePayload),
  safetyMetadata: module.safetyMetadata,
  legalMetadata: module.legalMetadata,
  balanceMetadata: module.balanceMetadata
});

export const createSurfaceEquipmentModuleDefinition = (
  input: unknown,
  path = "/module"
): SurfaceEquipmentModuleDefinition => {
  const cloned = cloneAndFreezeSurfaceEquipmentValue(input);
  const object = readSurfaceEquipmentRecord(cloned, path);
  assertSurfaceEquipmentFields(object, path, [
    "moduleId", "moduleVersion", "displayMetadata", "primaryRole", "tags", "massGrams", "bulkMicroUnits",
    "continuousPowerMilliwatts", "pulseEnergyMillijoules", "heatPerActionMillijoules", "activeThermalLoadMilliwatts",
    "passiveDissipationMilliwatts", "compatibleSlotTypeIds", "interactionCapabilities", "requiredSuitInterfaces",
    "resourceRequirements", "damageType", "deliveryClass",
    "rangeMillimeters", "cycleTicks", "capacity", "calibrationDefinitions", "safetyMetadata", "legalMetadata", "balanceMetadata"
  ]);
  const calibrationDefinitions = (optional(object, "calibrationDefinitions", path, readSurfaceEquipmentArray) ?? [])
    .map((entry, index) => readCalibrationDefinition(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "calibrationDefinitions"), index)))
    .sort((left, right) => left.order - right.order || compareSurfaceEquipmentText(left.calibrationId, right.calibrationId));
  rejectSurfaceEquipmentDuplicates(
    calibrationDefinitions.map((entry) => entry.calibrationId),
    surfaceEquipmentDataPath(path, "calibrationDefinitions"),
    "Calibration ID"
  );
  const damageType = optional(object, "damageType", path, (value, valuePath) =>
    readSurfaceEquipmentEnum(value, DAMAGE_TYPES, valuePath)
  );
  const deliveryClass = optional(object, "deliveryClass", path, (value, valuePath) =>
    readSurfaceEquipmentEnum(value, SURFACE_EQUIPMENT_DELIVERY_CLASSES, valuePath)
  );
  const rangeMillimeters = optional(object, "rangeMillimeters", path, readSurfaceEquipmentSafeInteger);
  const cycleTicks = optional(object, "cycleTicks", path, (value, valuePath) =>
    readSurfaceEquipmentSafeInteger(value, valuePath, 0, false)
  );
  const capacity = optional(object, "capacity", path, readCapacity);
  const compatibleSlotTypeIds = required(object, "compatibleSlotTypeIds", path, readCompatibleSlotTypes);
  if (compatibleSlotTypeIds.length === 0) {
    throw surfaceEquipmentDataError(
      "InvalidValue",
      surfaceEquipmentDataPath(path, "compatibleSlotTypeIds"),
      "A module must declare at least one compatible slot type."
    );
  }
  const unsigned = {
    moduleId: required(object, "moduleId", path, createSurfaceEquipmentModuleId),
    moduleVersion: required(object, "moduleVersion", path, createSurfaceEquipmentModuleVersion),
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata),
    primaryRole: required(object, "primaryRole", path, (value, valuePath) =>
      readSurfaceEquipmentEnum(value, SURFACE_EQUIPMENT_MODULE_ROLES, valuePath)
    ),
    tags: required(object, "tags", path, readTags),
    massGrams: required(object, "massGrams", path, readSurfaceEquipmentSafeInteger),
    bulkMicroUnits: required(object, "bulkMicroUnits", path, readSurfaceEquipmentSafeInteger),
    continuousPowerMilliwatts: required(object, "continuousPowerMilliwatts", path, readSurfaceEquipmentSafeInteger),
    pulseEnergyMillijoules: required(object, "pulseEnergyMillijoules", path, readSurfaceEquipmentSafeInteger),
    heatPerActionMillijoules: required(object, "heatPerActionMillijoules", path, readSurfaceEquipmentSafeInteger),
    activeThermalLoadMilliwatts: required(object, "activeThermalLoadMilliwatts", path, readSurfaceEquipmentSafeInteger),
    passiveDissipationMilliwatts: required(object, "passiveDissipationMilliwatts", path, readSurfaceEquipmentSafeInteger),
    compatibleSlotTypeIds,
    interactionCapabilities: required(object, "interactionCapabilities", path, readInteractionCapabilities),
    requiredSuitInterfaces: required(object, "requiredSuitInterfaces", path, readSuitInterfaces),
    resourceRequirements: required(object, "resourceRequirements", path, readResourceRequirements),
    ...(damageType === undefined ? {} : { damageType }),
    ...(deliveryClass === undefined ? {} : { deliveryClass }),
    ...(rangeMillimeters === undefined ? {} : { rangeMillimeters }),
    ...(cycleTicks === undefined ? {} : { cycleTicks }),
    ...(capacity === undefined ? {} : { capacity }),
    calibrationDefinitions,
    safetyMetadata: required(object, "safetyMetadata", path, readSafetyMetadata),
    legalMetadata: required(object, "legalMetadata", path, readLegalMetadata),
    balanceMetadata: required(object, "balanceMetadata", path, readBalanceMetadata)
  } as Omit<SurfaceEquipmentModuleDefinition, "contentSignature">;
  return cloneAndFreezeSurfaceEquipmentValue({
    ...unsigned,
    contentSignature: createSurfaceEquipmentSignature(surfaceEquipmentModuleContentPayload(unsigned as SurfaceEquipmentModuleDefinition))
  }) as SurfaceEquipmentModuleDefinition;
};

const catalogContentPayload = (
  catalog: Omit<SurfaceEquipmentCatalog, "contentSignature" | "displayMetadata">
) => ({
  catalogId: catalog.catalogId,
  catalogVersion: catalog.catalogVersion,
  schemaVersion: catalog.schemaVersion,
  slots: catalog.slots.map(slotSignaturePayload),
  modules: catalog.modules.map((module) => ({ moduleId: module.moduleId, contentSignature: module.contentSignature }))
});

export const createSurfaceEquipmentCatalog = (input: unknown, path = "/catalog"): SurfaceEquipmentCatalog => {
  const cloned = cloneAndFreezeSurfaceEquipmentValue(input);
  const object = readSurfaceEquipmentRecord(cloned, path);
  assertSurfaceEquipmentFields(object, path, ["catalogId", "catalogVersion", "schemaVersion", "displayMetadata", "slots", "modules"]);
  const schemaVersion = required(object, "schemaVersion", path, readSurfaceEquipmentSafeInteger);
  if (schemaVersion !== SURFACE_EQUIPMENT_SCHEMA_VERSION) {
    throw surfaceEquipmentDataError("InvalidValue", surfaceEquipmentDataPath(path, "schemaVersion"), "Unsupported schema version.");
  }
  const slots = required(object, "slots", path, readSurfaceEquipmentArray)
    .map((entry, index) => createSurfaceEquipmentSlotDefinition(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "slots"), index)))
    .sort((left, right) => left.order - right.order || compareSurfaceEquipmentText(left.slotId, right.slotId));
  const modules = required(object, "modules", path, readSurfaceEquipmentArray)
    .map((entry, index) => createSurfaceEquipmentModuleDefinition(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "modules"), index)))
    .sort((left, right) => compareSurfaceEquipmentText(left.moduleId, right.moduleId));
  rejectSurfaceEquipmentDuplicates(slots.map((slot) => slot.slotId), surfaceEquipmentDataPath(path, "slots"), "Slot ID");
  rejectSurfaceEquipmentDuplicates(modules.map((module) => module.moduleId), surfaceEquipmentDataPath(path, "modules"), "Module ID");
  const slotIds = new Set(slots.map((slot) => slot.slotId));
  for (const slot of slots) {
    if (slot.parentSlotId !== undefined && !slotIds.has(slot.parentSlotId)) {
      throw surfaceEquipmentDataError("UnknownReference", `${path}/slots/${slot.slotId}/parentSlotId`, "Unknown parent slot.");
    }
    const visited = new Set<SurfaceEquipmentSlotId>([slot.slotId]);
    let current = slot;
    while (current.parentSlotId !== undefined) {
      if (visited.has(current.parentSlotId)) {
        throw surfaceEquipmentDataError("InvalidValue", `${path}/slots/${slot.slotId}/parentSlotId`, "Slot parent cycle detected.");
      }
      visited.add(current.parentSlotId);
      const parent = slots.find((candidate) => candidate.slotId === current.parentSlotId);
      if (parent === undefined) break;
      current = parent;
    }
  }
  const unsigned = {
    catalogId: required(object, "catalogId", path, createSurfaceEquipmentCatalogId),
    catalogVersion: required(object, "catalogVersion", path, createSurfaceEquipmentCatalogVersion),
    schemaVersion: SURFACE_EQUIPMENT_SCHEMA_VERSION,
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata),
    slots,
    modules
  };
  return cloneAndFreezeSurfaceEquipmentValue({
    ...unsigned,
    contentSignature: createSurfaceEquipmentSignature(catalogContentPayload(unsigned))
  }) as SurfaceEquipmentCatalog;
};

const readModuleInstance = (value: unknown, path: string): SurfaceEquipmentModuleInstance => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["moduleInstanceId", "moduleId"]);
  return {
    moduleInstanceId: required(object, "moduleInstanceId", path, createSurfaceEquipmentModuleInstanceId),
    moduleId: required(object, "moduleId", path, createSurfaceEquipmentModuleId)
  };
};

const readSlotAssignment = (value: unknown, path: string): SurfaceEquipmentSlotAssignment => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["slotId", "moduleInstanceIds"]);
  return {
    slotId: required(object, "slotId", path, createSurfaceEquipmentSlotId),
    moduleInstanceIds: required(object, "moduleInstanceIds", path, (entry, entryPath) =>
      sortedUnique(entry, entryPath, createSurfaceEquipmentModuleInstanceId, "Module instance ID")
    )
  };
};

const readCalibrationChoice = (value: unknown, path: string): SurfaceEquipmentCalibrationChoice => {
  const object = readSurfaceEquipmentRecord(value, path);
  assertSurfaceEquipmentFields(object, path, ["moduleInstanceId", "calibrationId", "optionId"]);
  return {
    moduleInstanceId: required(object, "moduleInstanceId", path, createSurfaceEquipmentModuleInstanceId),
    calibrationId: required(object, "calibrationId", path, createSurfaceEquipmentCalibrationId),
    optionId: required(object, "optionId", path, createSurfaceEquipmentCalibrationOptionId)
  };
};

const blueprintContentPayload = (blueprint: Omit<SurfaceEquipmentBlueprint, "contentSignature" | "displayMetadata">) => ({
  blueprintId: blueprint.blueprintId,
  catalogId: blueprint.catalogId,
  catalogVersion: blueprint.catalogVersion,
  category: blueprint.category,
  slotAssignments: blueprint.slotAssignments,
  moduleInstances: blueprint.moduleInstances,
  calibrationChoices: blueprint.calibrationChoices,
  tags: blueprint.tags
});

export const createSurfaceEquipmentBlueprint = (
  input: unknown,
  catalog: SurfaceEquipmentCatalog,
  path = "/blueprint"
): SurfaceEquipmentBlueprint => {
  const cloned = cloneAndFreezeSurfaceEquipmentValue(input);
  const object = readSurfaceEquipmentRecord(cloned, path);
  assertSurfaceEquipmentFields(object, path, [
    "blueprintId", "catalogId", "catalogVersion", "revision", "category", "displayMetadata", "slotAssignments",
    "moduleInstances", "calibrationChoices", "tags", "processedCommandIds"
  ]);
  const catalogId = required(object, "catalogId", path, createSurfaceEquipmentCatalogId);
  const catalogVersion = required(object, "catalogVersion", path, createSurfaceEquipmentCatalogVersion);
  if (catalogId !== catalog.catalogId || catalogVersion !== catalog.catalogVersion) {
    throw surfaceEquipmentDataError("UnknownReference", surfaceEquipmentDataPath(path, "catalogId"), "Blueprint catalog does not match.");
  }
  const moduleInstances = required(object, "moduleInstances", path, readSurfaceEquipmentArray)
    .map((entry, index) => readModuleInstance(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "moduleInstances"), index)))
    .sort((left, right) => compareSurfaceEquipmentText(left.moduleInstanceId, right.moduleInstanceId));
  rejectSurfaceEquipmentDuplicates(
    moduleInstances.map((entry) => entry.moduleInstanceId),
    surfaceEquipmentDataPath(path, "moduleInstances"),
    "Module instance ID"
  );
  const modulesById = new Map(catalog.modules.map((module) => [module.moduleId, module]));
  for (const instance of moduleInstances) {
    if (!modulesById.has(instance.moduleId)) {
      throw surfaceEquipmentDataError("UnknownReference", `${path}/moduleInstances/${instance.moduleInstanceId}/moduleId`, "Unknown module.");
    }
  }
  const slotAssignments = required(object, "slotAssignments", path, readSurfaceEquipmentArray)
    .map((entry, index) => readSlotAssignment(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "slotAssignments"), index)))
    .sort((left, right) => compareSurfaceEquipmentText(left.slotId, right.slotId));
  rejectSurfaceEquipmentDuplicates(slotAssignments.map((entry) => entry.slotId), surfaceEquipmentDataPath(path, "slotAssignments"), "Slot ID");
  const instancesById = new Map(moduleInstances.map((instance) => [instance.moduleInstanceId, instance]));
  const assignedInstanceIds: SurfaceEquipmentModuleInstanceId[] = [];
  for (const assignment of slotAssignments) {
    const slot = catalog.slots.find((candidate) => candidate.slotId === assignment.slotId);
    if (slot === undefined) {
      throw surfaceEquipmentDataError("UnknownReference", `${path}/slotAssignments/${assignment.slotId}/slotId`, "Unknown slot.");
    }
    if ((slot.required && assignment.moduleInstanceIds.length !== slot.exactCount) ||
      (!slot.required && assignment.moduleInstanceIds.length !== 0 && assignment.moduleInstanceIds.length !== slot.exactCount)) {
      throw surfaceEquipmentDataError("InvalidValue", `${path}/slotAssignments/${assignment.slotId}`, "Slot assignment count is invalid.");
    }
    for (const instanceId of assignment.moduleInstanceIds) {
      if (!instancesById.has(instanceId)) {
        throw surfaceEquipmentDataError("UnknownReference", `${path}/slotAssignments/${assignment.slotId}`, "Unknown module instance.");
      }
      assignedInstanceIds.push(instanceId);
    }
  }
  rejectSurfaceEquipmentDuplicates(assignedInstanceIds, surfaceEquipmentDataPath(path, "slotAssignments"), "Assigned module instance ID");
  if (assignedInstanceIds.length !== moduleInstances.length) {
    throw surfaceEquipmentDataError("UnknownReference", surfaceEquipmentDataPath(path, "moduleInstances"), "Every module instance must be assigned once.");
  }
  const calibrationChoices = (optional(object, "calibrationChoices", path, readSurfaceEquipmentArray) ?? [])
    .map((entry, index) => readCalibrationChoice(entry, surfaceEquipmentDataPath(surfaceEquipmentDataPath(path, "calibrationChoices"), index)))
    .sort((left, right) =>
      compareSurfaceEquipmentText(left.moduleInstanceId, right.moduleInstanceId) ||
      compareSurfaceEquipmentText(left.calibrationId, right.calibrationId)
    );
  const choiceKeys = calibrationChoices.map((choice) => `${choice.moduleInstanceId}:${choice.calibrationId}`);
  rejectSurfaceEquipmentDuplicates(choiceKeys, surfaceEquipmentDataPath(path, "calibrationChoices"), "Calibration choice");
  for (const choice of calibrationChoices) {
    const instance = instancesById.get(choice.moduleInstanceId);
    const module = instance === undefined ? undefined : modulesById.get(instance.moduleId);
    const definition = module?.calibrationDefinitions.find((entry) => entry.calibrationId === choice.calibrationId);
    if (definition === undefined || !definition.options.some((option) => option.optionId === choice.optionId)) {
      throw surfaceEquipmentDataError("UnknownReference", `${path}/calibrationChoices/${choice.moduleInstanceId}`, "Unknown calibration choice.");
    }
  }
  const unsigned = {
    blueprintId: required(object, "blueprintId", path, createSurfaceEquipmentBlueprintId),
    catalogId,
    catalogVersion,
    revision: required(object, "revision", path, createSurfaceEquipmentRevision),
    category: required(object, "category", path, (value, valuePath) =>
      readSurfaceEquipmentEnum(value, SURFACE_EQUIPMENT_CATEGORIES, valuePath)
    ),
    displayMetadata: required(object, "displayMetadata", path, readDisplayMetadata),
    slotAssignments,
    moduleInstances,
    calibrationChoices,
    tags: optional(object, "tags", path, readTags) ?? [],
    processedCommandIds: optional(object, "processedCommandIds", path, (value, valuePath) =>
      sortedUnique(value, valuePath, createSurfaceEquipmentCommandId, "Command ID")
    ) ?? []
  };
  return cloneAndFreezeSurfaceEquipmentValue({
    ...unsigned,
    contentSignature: createSurfaceEquipmentSignature(blueprintContentPayload(unsigned))
  }) as SurfaceEquipmentBlueprint;
};

export const validateSurfaceEquipmentCatalog = createSurfaceEquipmentCatalog;
export const validateSurfaceEquipmentModuleDefinition = createSurfaceEquipmentModuleDefinition;
export const validateSurfaceEquipmentSlotDefinition = createSurfaceEquipmentSlotDefinition;
export const validateSurfaceEquipmentBlueprint = createSurfaceEquipmentBlueprint;

export const getSurfaceEquipmentModule = (
  catalog: SurfaceEquipmentCatalog,
  moduleId: string
): SurfaceEquipmentModuleDefinition | undefined => catalog.modules.find((module) => module.moduleId === moduleId);

export const getSurfaceEquipmentSlot = (
  catalog: SurfaceEquipmentCatalog,
  slotId: string
): SurfaceEquipmentSlotDefinition | undefined => catalog.slots.find((slot) => slot.slotId === slotId);

export const isSurfaceEquipmentCalibrationChoice = (
  module: SurfaceEquipmentModuleDefinition,
  calibrationId: SurfaceEquipmentCalibrationId,
  optionId: SurfaceEquipmentCalibrationOptionId
): boolean => module.calibrationDefinitions.some(
  (definition) => definition.calibrationId === calibrationId && definition.options.some((option) => option.optionId === optionId)
);
