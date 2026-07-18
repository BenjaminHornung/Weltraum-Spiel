import { createSurfaceEquipmentBlueprint } from "./catalog";
import {
  createSurfaceEquipmentDiagnostic,
  orderSurfaceEquipmentDiagnostics,
  type SurfaceEquipmentDiagnostic,
  type SurfaceEquipmentDiagnosticCode,
  type SurfaceEquipmentDiagnosticInput
} from "./diagnostics";
import type {
  SurfaceEquipmentBlueprintId,
  SurfaceEquipmentCalibrationId,
  SurfaceEquipmentCalibrationOptionId,
  SurfaceEquipmentCommandId,
  SurfaceEquipmentModuleId,
  SurfaceEquipmentModuleInstanceId,
  SurfaceEquipmentRevision,
  SurfaceEquipmentSlotId,
  SurfaceEquipmentTagId
} from "./ids";
import { SURFACE_EQUIPMENT_STABLE_ID_PATTERN } from "./ids";
import { deriveSurfaceEquipmentStats } from "./stats";
import type {
  SurfaceEquipmentBlueprint,
  SurfaceEquipmentCategory,
  SurfaceEquipmentCatalog,
  SurfaceEquipmentDisplayMetadata
} from "./types";
import { SurfaceEquipmentDataError, surfaceEquipmentDataError } from "./validation";

export const SURFACE_EQUIPMENT_COMMAND_KINDS = Object.freeze([
  "CreateBlueprint",
  "InstallModule",
  "RemoveModule",
  "ReplaceModule",
  "MoveModule",
  "SetCalibration",
  "RenameDisplayLabel"
] as const);
export type SurfaceEquipmentCommandKind = (typeof SURFACE_EQUIPMENT_COMMAND_KINDS)[number];

interface SurfaceEquipmentCommandBase<TKind extends SurfaceEquipmentCommandKind, TPayload> {
  readonly kind: TKind;
  readonly commandId: SurfaceEquipmentCommandId;
  readonly blueprintId: SurfaceEquipmentBlueprintId;
  readonly expectedRevision: SurfaceEquipmentRevision;
  readonly resultingRevision: SurfaceEquipmentRevision;
  readonly payload: TPayload;
  readonly source: string;
  readonly sequence: number;
}

export interface CreateBlueprintPayload {
  readonly category: SurfaceEquipmentCategory;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
  readonly slotAssignments: SurfaceEquipmentBlueprint["slotAssignments"];
  readonly moduleInstances: SurfaceEquipmentBlueprint["moduleInstances"];
  readonly calibrationChoices?: SurfaceEquipmentBlueprint["calibrationChoices"];
  readonly tags?: readonly SurfaceEquipmentTagId[];
}
export interface InstallModulePayload {
  readonly slotId: SurfaceEquipmentSlotId;
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly moduleId: SurfaceEquipmentModuleId;
}
export interface RemoveModulePayload { readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId }
export interface ReplaceModulePayload {
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly moduleId: SurfaceEquipmentModuleId;
}
export interface MoveModulePayload {
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly toSlotId: SurfaceEquipmentSlotId;
}
export interface SetCalibrationPayload {
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly calibrationId: SurfaceEquipmentCalibrationId;
  readonly optionId: SurfaceEquipmentCalibrationOptionId;
}
export type RenameDisplayLabelPayload =
  | { readonly displayLabel: string; readonly displayName?: never }
  | { readonly displayName: string; readonly displayLabel?: never };

export type CreateBlueprintCommand = SurfaceEquipmentCommandBase<"CreateBlueprint", CreateBlueprintPayload>;
export type InstallModuleCommand = SurfaceEquipmentCommandBase<"InstallModule", InstallModulePayload>;
export type RemoveModuleCommand = SurfaceEquipmentCommandBase<"RemoveModule", RemoveModulePayload>;
export type ReplaceModuleCommand = SurfaceEquipmentCommandBase<"ReplaceModule", ReplaceModulePayload>;
export type MoveModuleCommand = SurfaceEquipmentCommandBase<"MoveModule", MoveModulePayload>;
export type SetCalibrationCommand = SurfaceEquipmentCommandBase<"SetCalibration", SetCalibrationPayload>;
export type RenameDisplayLabelCommand = SurfaceEquipmentCommandBase<"RenameDisplayLabel", RenameDisplayLabelPayload>;
export type SurfaceEquipmentCommand =
  | CreateBlueprintCommand
  | InstallModuleCommand
  | RemoveModuleCommand
  | ReplaceModuleCommand
  | MoveModuleCommand
  | SetCalibrationCommand
  | RenameDisplayLabelCommand;

export interface SurfaceEquipmentAcceptedCommandResult {
  readonly status: "Accepted";
  readonly outcome: "Created" | "Changed";
  readonly blueprint: SurfaceEquipmentBlueprint;
  readonly diagnostics: readonly SurfaceEquipmentDiagnostic[];
}
export interface SurfaceEquipmentRejectedCommandResult {
  readonly status: "Rejected";
  /** The exact original object reference (or null for rejected creation) is retained. */
  readonly blueprint: SurfaceEquipmentBlueprint | null;
  readonly diagnostics: readonly SurfaceEquipmentDiagnostic[];
}
export type SurfaceEquipmentCommandResult =
  | SurfaceEquipmentAcceptedCommandResult
  | SurfaceEquipmentRejectedCommandResult;

const commandDiagnostic = (
  code: SurfaceEquipmentDiagnosticCode,
  path: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>
): SurfaceEquipmentDiagnosticInput => ({
  code, severity: "Error", phase: "Command", path, message, ...(details === undefined ? {} : { details })
});

const COMMAND_FIELDS = Object.freeze([
  "kind", "commandId", "blueprintId", "expectedRevision", "resultingRevision", "payload", "source", "sequence"
] as const);

const strictCommandClone = (value: unknown, path: string, ancestors = new Set<object>()): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw surfaceEquipmentDataError("InvalidJson", path, "Command data must contain finite numbers.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw surfaceEquipmentDataError("InvalidJson", path, "Command data must be plain JSON-compatible data.");
  }
  if (ancestors.has(value)) throw surfaceEquipmentDataError("InvalidJson", path, "Command data must not contain cycles.");
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      throw surfaceEquipmentDataError("UnexpectedField", path, "Command data must not contain symbol fields.");
    }
    for (const key of ownKeys as string[]) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor)) {
        throw surfaceEquipmentDataError("InvalidType", `${path}/${key}`, "Command data must not contain accessors.");
      }
    }
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw surfaceEquipmentDataError("InvalidType", path, "Command arrays must use the standard Array prototype.");
      }
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor !== undefined && "value" in lengthDescriptor ? lengthDescriptor.value : undefined;
      if (!Number.isSafeInteger(length) || length < 0) {
        throw surfaceEquipmentDataError("InvalidJson", path, "Command array length is invalid.");
      }
      for (const key of ownKeys as string[]) {
        if (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) {
          throw surfaceEquipmentDataError("UnexpectedField", `${path}/${key}`, "Command arrays must not contain extra fields.");
        }
      }
      const result: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined || !("value" in descriptor)) {
          throw surfaceEquipmentDataError("InvalidJson", `${path}/${index}`, "Command arrays must not be sparse.");
        }
        result.push(strictCommandClone(descriptor.value, `${path}/${index}`, ancestors));
      }
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw surfaceEquipmentDataError("InvalidType", path, "Command objects must be plain JSON objects.");
    }
    const result: Record<string, unknown> = {};
    for (const key of (ownKeys as string[]).sort()) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor)) continue;
      result[key] = strictCommandClone(descriptor.value, `${path}/${key}`, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
};

const strictRecord = (
  value: unknown,
  path: string,
  allowedFields: readonly string[],
  requiredFields: readonly string[] = allowedFields
): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw surfaceEquipmentDataError("InvalidType", path, "Expected a plain command object.");
  }
  const object = value as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(object).sort()) {
    if (!allowedFields.includes(key)) {
      throw surfaceEquipmentDataError("UnexpectedField", `${path}/${key}`, "Unexpected field in V1 command data.");
    }
  }
  for (const key of requiredFields) {
    if (!Object.hasOwn(object, key)) {
      throw surfaceEquipmentDataError("MissingRequiredField", `${path}/${key}`, "Required command field is missing.");
    }
  }
  return object;
};

const readCommandId = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !SURFACE_EQUIPMENT_STABLE_ID_PATTERN.test(value)) {
    throw surfaceEquipmentDataError("InvalidId", path, "Expected a valid stable command identifier.");
  }
  return value;
};

const parseCommand = (input: unknown): SurfaceEquipmentCommand => {
  const cloned = strictCommandClone(input, "/command");
  const object = strictRecord(cloned, "/command", COMMAND_FIELDS);
  const kindValue = object.kind;
  if (typeof kindValue !== "string" || !SURFACE_EQUIPMENT_COMMAND_KINDS.includes(kindValue as SurfaceEquipmentCommandKind)) {
    throw surfaceEquipmentDataError("InvalidValue", "/command/kind", "Unknown V1 surface-equipment command kind.");
  }
  const kind = kindValue as SurfaceEquipmentCommandKind;
  const commandId = readCommandId(object.commandId, "/command/commandId");
  const blueprintId = readCommandId(object.blueprintId, "/command/blueprintId");
  const source = readCommandId(object.source, "/command/source");
  for (const field of ["expectedRevision", "resultingRevision", "sequence"] as const) {
    if (!Number.isSafeInteger(object[field]) || (object[field] as number) < 0) {
      throw surfaceEquipmentDataError("InvalidInteger", `/command/${field}`, "Expected a non-negative safe integer.");
    }
  }
  let payload: Readonly<Record<string, unknown>>;
  switch (kind) {
    case "CreateBlueprint":
      payload = strictRecord(object.payload, "/command/payload", [
        "category", "displayMetadata", "slotAssignments", "moduleInstances", "calibrationChoices", "tags"
      ], ["category", "displayMetadata", "slotAssignments", "moduleInstances"]);
      break;
    case "InstallModule":
      payload = strictRecord(object.payload, "/command/payload", ["slotId", "moduleInstanceId", "moduleId"]);
      readCommandId(payload.slotId, "/command/payload/slotId");
      readCommandId(payload.moduleInstanceId, "/command/payload/moduleInstanceId");
      readCommandId(payload.moduleId, "/command/payload/moduleId");
      break;
    case "RemoveModule":
      payload = strictRecord(object.payload, "/command/payload", ["moduleInstanceId"]);
      readCommandId(payload.moduleInstanceId, "/command/payload/moduleInstanceId");
      break;
    case "ReplaceModule":
      payload = strictRecord(object.payload, "/command/payload", ["moduleInstanceId", "moduleId"]);
      readCommandId(payload.moduleInstanceId, "/command/payload/moduleInstanceId");
      readCommandId(payload.moduleId, "/command/payload/moduleId");
      break;
    case "MoveModule":
      payload = strictRecord(object.payload, "/command/payload", ["moduleInstanceId", "toSlotId"]);
      readCommandId(payload.moduleInstanceId, "/command/payload/moduleInstanceId");
      readCommandId(payload.toSlotId, "/command/payload/toSlotId");
      break;
    case "SetCalibration":
      payload = strictRecord(object.payload, "/command/payload", ["moduleInstanceId", "calibrationId", "optionId"]);
      readCommandId(payload.moduleInstanceId, "/command/payload/moduleInstanceId");
      readCommandId(payload.calibrationId, "/command/payload/calibrationId");
      readCommandId(payload.optionId, "/command/payload/optionId");
      break;
    case "RenameDisplayLabel": {
      payload = strictRecord(object.payload, "/command/payload", ["displayLabel", "displayName"], []);
      const names = ["displayLabel", "displayName"].filter((field) => Object.hasOwn(payload, field));
      if (names.length !== 1 || typeof payload[names[0]!] !== "string") {
        throw surfaceEquipmentDataError("InvalidValue", "/command/payload", "Rename requires exactly one string display-name field.");
      }
      break;
    }
  }
  return {
    kind,
    commandId,
    blueprintId,
    expectedRevision: object.expectedRevision,
    resultingRevision: object.resultingRevision,
    payload,
    source,
    sequence: object.sequence
  } as SurfaceEquipmentCommand;
};

const hasOwnDataField = (value: unknown, field: string): boolean => {
  if (value === null || typeof value !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor !== undefined && "value" in descriptor;
  } catch {
    return false;
  }
};

const looksLikeCatalog = (value: unknown): value is SurfaceEquipmentCatalog =>
  hasOwnDataField(value, "modules") && hasOwnDataField(value, "slots") && !hasOwnDataField(value, "kind");

const rejected = (
  original: SurfaceEquipmentBlueprint | null,
  diagnostics: readonly SurfaceEquipmentDiagnosticInput[]
): SurfaceEquipmentRejectedCommandResult => Object.freeze({
  status: "Rejected" as const,
  blueprint: original,
  diagnostics: orderSurfaceEquipmentDiagnostics(diagnostics)
});

const accepted = (
  outcome: SurfaceEquipmentAcceptedCommandResult["outcome"],
  blueprint: SurfaceEquipmentBlueprint
): SurfaceEquipmentAcceptedCommandResult => Object.freeze({
  status: "Accepted" as const,
  outcome,
  blueprint,
  diagnostics: Object.freeze([]) as readonly SurfaceEquipmentDiagnostic[]
});

const validateCommandEnvelope = (
  original: SurfaceEquipmentBlueprint | null,
  command: SurfaceEquipmentCommand
): readonly SurfaceEquipmentDiagnosticInput[] => {
  const diagnostics: SurfaceEquipmentDiagnosticInput[] = [];
  if (!SURFACE_EQUIPMENT_COMMAND_KINDS.includes(command.kind) ||
    !SURFACE_EQUIPMENT_STABLE_ID_PATTERN.test(command.commandId) ||
    !SURFACE_EQUIPMENT_STABLE_ID_PATTERN.test(command.blueprintId) ||
    !SURFACE_EQUIPMENT_STABLE_ID_PATTERN.test(command.source) ||
    !Number.isSafeInteger(command.sequence) || command.sequence < 0 ||
    !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 ||
    !Number.isSafeInteger(command.resultingRevision) || command.resultingRevision < 0) {
    diagnostics.push(commandDiagnostic("InvalidCommand", "/command", "Command envelope is not valid V1 plain data."));
    return diagnostics;
  }
  if (command.resultingRevision !== command.expectedRevision + 1) {
    diagnostics.push(commandDiagnostic("RevisionConflict", "/resultingRevision", "Resulting revision must equal expected revision plus one.", {
      expectedRevision: command.expectedRevision,
      resultingRevision: command.resultingRevision
    }));
  }
  if (original === null) {
    if (command.kind !== "CreateBlueprint") {
      diagnostics.push(commandDiagnostic("BlueprintMismatch", "/blueprintId", "A non-create command requires an existing blueprint."));
    } else if (command.expectedRevision !== 0) {
      diagnostics.push(commandDiagnostic("RevisionConflict", "/expectedRevision", "Blueprint creation must expect revision zero."));
    }
    return diagnostics;
  }
  if (command.kind === "CreateBlueprint") {
    diagnostics.push(commandDiagnostic("BlueprintMismatch", "/kind", "CreateBlueprint requires no existing blueprint."));
  }
  if (original.processedCommandIds.includes(command.commandId)) {
    diagnostics.push(commandDiagnostic("DuplicateCommand", "/commandId", "Command ID has already been processed."));
  }
  if (command.blueprintId !== original.blueprintId) {
    diagnostics.push(commandDiagnostic("BlueprintMismatch", "/blueprintId", "Command targets a different blueprint."));
  }
  if (command.expectedRevision !== original.revision) {
    diagnostics.push(commandDiagnostic("RevisionConflict", "/expectedRevision", "Expected revision does not match the blueprint.", {
      actualRevision: original.revision,
      expectedRevision: command.expectedRevision
    }));
  }
  return diagnostics;
};

const diagnosticForDataError = (error: SurfaceEquipmentDataError): SurfaceEquipmentDiagnosticInput => {
  let code: SurfaceEquipmentDiagnosticCode = "InvalidCommand";
  if (error.path.includes("calibrationChoices")) code = "CalibrationInvalid";
  else if (error.path.includes("moduleId") && error.code === "UnknownReference") code = "UnknownModule";
  else if (error.path.includes("slotAssignments") && error.message.includes("count")) code = "MissingRequiredSlot";
  else if (error.path.includes("slotAssignments") && error.code === "UnknownReference") code = "UnknownSlot";
  return commandDiagnostic(code, error.path, error.message);
};

const baseBlueprintInput = (blueprint: SurfaceEquipmentBlueprint, command: SurfaceEquipmentCommand) => ({
  blueprintId: blueprint.blueprintId,
  catalogId: blueprint.catalogId,
  catalogVersion: blueprint.catalogVersion,
  revision: command.resultingRevision,
  category: blueprint.category,
  displayMetadata: blueprint.displayMetadata,
  slotAssignments: blueprint.slotAssignments,
  moduleInstances: blueprint.moduleInstances,
  calibrationChoices: blueprint.calibrationChoices,
  tags: blueprint.tags,
  processedCommandIds: [...blueprint.processedCommandIds, command.commandId]
});

const mutateBlueprintInput = (
  original: SurfaceEquipmentBlueprint,
  command: Exclude<SurfaceEquipmentCommand, CreateBlueprintCommand>
): ReturnType<typeof baseBlueprintInput> => {
  const base = baseBlueprintInput(original, command);
  switch (command.kind) {
    case "InstallModule": {
      const assignment = base.slotAssignments.find((entry) => entry.slotId === command.payload.slotId);
      return {
        ...base,
        slotAssignments: assignment === undefined
          ? [...base.slotAssignments, { slotId: command.payload.slotId, moduleInstanceIds: [command.payload.moduleInstanceId] }]
          : base.slotAssignments.map((entry) => entry.slotId === command.payload.slotId
            ? { ...entry, moduleInstanceIds: [...entry.moduleInstanceIds, command.payload.moduleInstanceId] }
            : entry),
        moduleInstances: [...base.moduleInstances, {
          moduleInstanceId: command.payload.moduleInstanceId,
          moduleId: command.payload.moduleId
        }]
      };
    }
    case "RemoveModule":
      return {
        ...base,
        slotAssignments: base.slotAssignments.map((entry) => ({
          ...entry,
          moduleInstanceIds: entry.moduleInstanceIds.filter((id) => id !== command.payload.moduleInstanceId)
        })),
        moduleInstances: base.moduleInstances.filter((entry) => entry.moduleInstanceId !== command.payload.moduleInstanceId),
        calibrationChoices: base.calibrationChoices.filter((entry) => entry.moduleInstanceId !== command.payload.moduleInstanceId)
      };
    case "ReplaceModule":
      return {
        ...base,
        moduleInstances: base.moduleInstances.map((entry) => entry.moduleInstanceId === command.payload.moduleInstanceId
          ? { moduleInstanceId: entry.moduleInstanceId, moduleId: command.payload.moduleId }
          : entry),
        calibrationChoices: base.calibrationChoices.filter((entry) => entry.moduleInstanceId !== command.payload.moduleInstanceId)
      };
    case "MoveModule":
      return {
        ...base,
        slotAssignments: base.slotAssignments.some((entry) => entry.slotId === command.payload.toSlotId)
          ? base.slotAssignments.map((entry) => ({
            ...entry,
            moduleInstanceIds: entry.slotId === command.payload.toSlotId
              ? [...entry.moduleInstanceIds.filter((id) => id !== command.payload.moduleInstanceId), command.payload.moduleInstanceId]
              : entry.moduleInstanceIds.filter((id) => id !== command.payload.moduleInstanceId)
          }))
          : [...base.slotAssignments.map((entry) => ({
            ...entry,
            moduleInstanceIds: entry.moduleInstanceIds.filter((id) => id !== command.payload.moduleInstanceId)
          })), { slotId: command.payload.toSlotId, moduleInstanceIds: [command.payload.moduleInstanceId] }]
      };
    case "SetCalibration":
      return {
        ...base,
        calibrationChoices: [
          ...base.calibrationChoices.filter((entry) =>
            entry.moduleInstanceId !== command.payload.moduleInstanceId || entry.calibrationId !== command.payload.calibrationId),
          command.payload
        ]
      };
    case "RenameDisplayLabel": {
      const displayName = command.payload.displayLabel ?? command.payload.displayName ?? "";
      return { ...base, displayMetadata: { ...base.displayMetadata, displayName } };
    }
  }
};

const operationPreflight = (
  original: SurfaceEquipmentBlueprint,
  catalog: SurfaceEquipmentCatalog,
  command: Exclude<SurfaceEquipmentCommand, CreateBlueprintCommand>
): readonly SurfaceEquipmentDiagnosticInput[] => {
  const diagnostics: SurfaceEquipmentDiagnosticInput[] = [];
  const instanceId = command.kind === "InstallModule" || command.kind === "RenameDisplayLabel"
    ? undefined : command.payload.moduleInstanceId;
  if (instanceId !== undefined && !original.moduleInstances.some((entry) => entry.moduleInstanceId === instanceId)) {
    diagnostics.push(commandDiagnostic("UnknownModuleInstance", "/payload/moduleInstanceId", "Command targets an unknown module instance."));
  }
  if (command.kind === "InstallModule") {
    if (original.moduleInstances.some((entry) => entry.moduleInstanceId === command.payload.moduleInstanceId)) {
      diagnostics.push(commandDiagnostic("DuplicateModuleInstance", "/payload/moduleInstanceId", "Module instance ID already exists."));
    }
    if (!catalog.modules.some((entry) => entry.moduleId === command.payload.moduleId)) {
      diagnostics.push(commandDiagnostic("UnknownModule", "/payload/moduleId", "Catalog does not contain the requested module."));
    }
    const slot = catalog.slots.find((entry) => entry.slotId === command.payload.slotId);
    if (slot === undefined) {
      diagnostics.push(commandDiagnostic("UnknownSlot", "/payload/slotId", "Catalog does not contain the requested slot."));
    } else {
      const currentCount = original.slotAssignments.find((entry) => entry.slotId === slot.slotId)?.moduleInstanceIds.length ?? 0;
      if (currentCount >= slot.exactCount) {
        diagnostics.push(commandDiagnostic("SlotCapacityExceeded", "/payload/slotId", "Destination slot is already full.", {
          actual: currentCount,
          maximum: slot.exactCount
        }));
      }
    }
  }
  if (command.kind === "ReplaceModule" && !catalog.modules.some((entry) => entry.moduleId === command.payload.moduleId)) {
    diagnostics.push(commandDiagnostic("UnknownModule", "/payload/moduleId", "Catalog does not contain the replacement module."));
  }
  if (command.kind === "MoveModule") {
    const slot = catalog.slots.find((entry) => entry.slotId === command.payload.toSlotId);
    if (slot === undefined) {
      diagnostics.push(commandDiagnostic("UnknownSlot", "/payload/toSlotId", "Catalog does not contain the destination slot."));
    } else {
      const destinationAssignment = original.slotAssignments.find((entry) => entry.slotId === slot.slotId);
      const currentCount = destinationAssignment?.moduleInstanceIds.length ?? 0;
      const movingWithinSlot = destinationAssignment?.moduleInstanceIds.includes(command.payload.moduleInstanceId) ?? false;
      const capacityCount = currentCount - (movingWithinSlot ? 1 : 0);
      if (capacityCount >= slot.exactCount) {
        diagnostics.push(commandDiagnostic("SlotCapacityExceeded", "/payload/toSlotId", "Destination slot is already full.", {
          actual: capacityCount,
          maximum: slot.exactCount
        }));
      }
    }
  }
  if (command.kind === "RenameDisplayLabel") {
    const displayName = command.payload.displayLabel ?? command.payload.displayName ?? "";
    if (typeof displayName !== "string" || displayName.length === 0) {
      diagnostics.push(commandDiagnostic("InvalidCommand", "/payload/displayLabel", "Display label must be non-empty."));
    }
  }
  return diagnostics;
};

export function applySurfaceEquipmentCommand(
  original: SurfaceEquipmentBlueprint | null,
  catalog: SurfaceEquipmentCatalog,
  command: unknown
): SurfaceEquipmentCommandResult;
export function applySurfaceEquipmentCommand(
  original: SurfaceEquipmentBlueprint | null,
  command: unknown,
  catalog: SurfaceEquipmentCatalog
): SurfaceEquipmentCommandResult;
export function applySurfaceEquipmentCommand(
  original: SurfaceEquipmentBlueprint | null,
  catalogOrCommand: unknown,
  commandOrCatalog: unknown
): SurfaceEquipmentCommandResult {
  const catalog = looksLikeCatalog(catalogOrCommand)
    ? catalogOrCommand
    : looksLikeCatalog(commandOrCatalog) ? commandOrCatalog : undefined;
  const commandInput = catalog === catalogOrCommand ? commandOrCatalog : catalogOrCommand;
  if (catalog === undefined) {
    return rejected(original, [commandDiagnostic("InvalidCommand", "/command", "A valid catalog and command envelope are required.")]);
  }
  let command: SurfaceEquipmentCommand;
  try {
    command = parseCommand(commandInput);
  } catch {
    return rejected(original, [commandDiagnostic("InvalidCommand", "/command", "Command input is not valid V1 plain data.")]);
  }
  const envelopeDiagnostics = validateCommandEnvelope(original, command);
  if (envelopeDiagnostics.length > 0) return rejected(original, envelopeDiagnostics);
  try {
    let candidate: SurfaceEquipmentBlueprint;
    if (command.kind === "CreateBlueprint") {
      candidate = createSurfaceEquipmentBlueprint({
        blueprintId: command.blueprintId,
        catalogId: catalog.catalogId,
        catalogVersion: catalog.catalogVersion,
        revision: command.resultingRevision,
        category: command.payload.category,
        displayMetadata: command.payload.displayMetadata,
        slotAssignments: command.payload.slotAssignments,
        moduleInstances: command.payload.moduleInstances,
        calibrationChoices: command.payload.calibrationChoices ?? [],
        tags: command.payload.tags ?? [],
        processedCommandIds: [command.commandId]
      }, catalog);
    } else {
      if (original === null) return rejected(original, [commandDiagnostic("BlueprintMismatch", "/blueprint", "Blueprint is missing.")]);
      const preflightDiagnostics = operationPreflight(original, catalog, command);
      if (preflightDiagnostics.length > 0) return rejected(original, preflightDiagnostics);
      candidate = createSurfaceEquipmentBlueprint(mutateBlueprintInput(original, command), catalog);
    }
    const configurationDiagnostics = deriveSurfaceEquipmentStats(candidate, catalog).diagnostics
      .filter((diagnostic) => diagnostic.severity === "Error");
    if (configurationDiagnostics.length > 0) return rejected(original, configurationDiagnostics);
    return accepted(command.kind === "CreateBlueprint" ? "Created" : "Changed", candidate);
  } catch (error) {
    if (error instanceof SurfaceEquipmentDataError) return rejected(original, [diagnosticForDataError(error)]);
    return rejected(original, [createSurfaceEquipmentDiagnostic(commandDiagnostic(
      "InvalidCommand", "/command", error instanceof Error ? error.message : "Command could not be applied."
    ))]);
  }
}
